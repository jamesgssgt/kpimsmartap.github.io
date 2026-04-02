"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, RefreshCw } from "lucide-react";
import { getSyncIndicators, getIndicatorInitialUrl, getFhirRecordCount, syncSinglePage, getSyncLogs, syncFhirData, releaseSyncLock } from "@/app/actions/sync-data";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";

export function KPISyncManager() {
    const [open, setOpen] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [syncStep, setSyncStep] = useState<'idle' | 'preparing' | 'checking' | 'syncing' | 'completed' | 'error'>('idle');
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [status, setStatus] = useState("");
    const [logs, setLogs] = useState<string[]>([]);
    const [sessionId, setSessionId] = useState<string>("");
    const router = useRouter();

    const addLog = (msg: string, status: 'info' | 'success' | 'warning' | 'error' = 'info') => {
        setLogs(prev => {
            const timeStr = `[${new Date().toLocaleTimeString('zh-TW', { hour12: false })}]`;
            let prefix = "";
            if (status === 'warning') prefix = "⚠️ ";
            if (status === 'error') prefix = "❌ ";
            if (status === 'success') prefix = "✅ ";
            
            const fullMsg = `${timeStr} ${prefix}${msg}`;
            if (prev[0] === fullMsg) return prev;
            return [fullMsg, ...prev];
        });
    };

    // Polling logic for remote logs
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (syncing && sessionId) {
            interval = setInterval(async () => {
                const res = await getSyncLogs(sessionId);
                if (res.success && res.data) {
                    const remoteLogs = res.data.map((l: any) => {
                        const timeStr = `[${new Date(l.created_at).toLocaleTimeString('zh-TW', { hour12: false })}]`;
                        
                        // Parse progress from logs (V10 Logic)
                        if (l.message.includes('[STEP]')) {
                            const match = l.message.match(/\[STEP\] (\d+)\/(\d+)/);
                            if (match) {
                                setProgress({ current: parseInt(match[1]), total: parseInt(match[2]) });
                            }
                        }
                        
                        return `${timeStr} ${l.message}`;
                    });
                    
                    setLogs(prev => {
                        const newLogs = [...prev];
                        remoteLogs.forEach((rl: string) => {
                            if (!newLogs.includes(rl)) {
                                newLogs.push(rl);
                            }
                        });
                        return newLogs.sort((a, b) => b.localeCompare(a));
                    });
                }
            }, 1500); 
        }
        return () => clearInterval(interval);
    }, [syncing, sessionId]);

    const abortRef = useRef(false);

    const handleSync = async () => {
        const sid = uuidv4();
        setSessionId(sid);
        setSyncing(true);
        setSyncStep('syncing');
        setLogs([]);
        setProgress({ current: 0, total: 0 });
        setStatus("🚀 啟動 V14.0 並行加速同步引擎...");
        addLog("🔗 正在建立安全同步階段並取得指標清單...");
        abortRef.current = false;

        try {
            // 1. Initial Handshake & Get Indicators
            const initRes = await syncFhirData(sid);
            if (!initRes.success) throw new Error(initRes.message);
            const indicators = initRes.indicators || [];
            setProgress({ current: 0, total: indicators.length });

            // 2. Implementation of a simple Worker Pool for Concurrency (Limit: 3)
            const CONCURRENCY_LIMIT = 3;
            const queue = [...indicators];
            let completedCount = 0;

            const syncIndicatorWorker = async (name: string) => {
                if (abortRef.current) return;
                
                try {
                    addLog(`[${name}] 正在啟動同步任務...`);
                    
                    // 2.5 Get Total Count to calculate pages
                    const countRes = await getFhirRecordCount(name);
                    const totalRecords = countRes.success ? countRes.count : 0;
                    const totalPages = Math.ceil(totalRecords / 300);
                    
                    if (countRes.success) {
                        addLog(`📊 [${name}] 預計數據量：${totalRecords} 筆 (約 ${totalPages} 個分頁)`);
                    }

                    // 3. Get Initial URL
                    const urlRes = await getIndicatorInitialUrl(name);
                    if (!urlRes.success) {
                        addLog(`⚠️ [${name}] 初始化失敗: ${urlRes.message}`, 'warning');
                        return;
                    }

                    let currentUrl: string | null = urlRes.url ?? null;
                    let pageIdx = 1;
                    let processedInIndicator = 0;

                    // 4. Paging Loop
                    while (currentUrl) {
                        if (abortRef.current) break;

                        let retryCount = 0;
                        const MAX_RETRIES = 3;
                        let success = false;

                        while (retryCount < MAX_RETRIES && !success) {
                            try {
                                if (abortRef.current) break;
                                if (!currentUrl) break;
                                
                                setStatus(`⚙️ 並行處理中: ${name} (分頁 ${pageIdx}/${totalPages || '?'})`);
                                
                                const pageRes = await syncSinglePage(name, currentUrl, sid, processedInIndicator, pageIdx);
                                currentUrl = pageRes.nextUrl;
                                processedInIndicator = pageRes.totalProcessedSoFar;
                                pageIdx++;
                                success = true;
                            } catch (e: any) {
                                retryCount++;
                                if (retryCount >= MAX_RETRIES) {
                                    addLog(`🚨 [${name}] 分頁連續失敗 3 次，跳過此指標`, 'error');
                                    currentUrl = null;
                                } else {
                                    addLog(`⚠️ [${name}] 網路異常頁面 ${pageIdx}，正在重試 (${retryCount}/3)...`, 'warning');
                                    await new Promise(r => setTimeout(r, 2000));
                                }
                            }
                        }
                    }
                    
                    if (!abortRef.current) {
                        addLog(`✅ [${name}] 同步完成！共 ${processedInIndicator} 筆`, 'success');
                    }
                } catch (err: any) {
                    addLog(`❌ [${name}] 異常終止: ${err.message}`, 'error');
                } finally {
                    completedCount++;
                    setProgress(prev => ({ ...prev, current: completedCount }));
                }
            };

            // Start workers
            const workers = [];
            for (let i = 0; i < Math.min(CONCURRENCY_LIMIT, indicators.length); i++) {
                const startNext = async (): Promise<void> => {
                    if (queue.length > 0 && !abortRef.current) {
                        const name = queue.shift()!;
                        await syncIndicatorWorker(name);
                        return startNext();
                    }
                };
                workers.push(startNext());
            }

            await Promise.all(workers);

            if (abortRef.current) {
                setStatus("⏹️ 同步已由使用者手動中斷");
                setSyncStep('idle');
            } else {
                setSyncStep('completed');
                setStatus("🎉 全數指標同步完成！總耗時大幅優化。");
                addLog("🎊 並行加速同步引擎執行結束。");
            }

        } catch (e: any) {
            setSyncStep('error');
            setStatus("❌ 核心引擎發生錯誤");
            addLog(`🚨 系統錯誤: ${e.message}`);
        } finally {
            await releaseSyncLock();
            setSyncing(false);
            router.refresh();
        }
    };

    const handleClose = () => {
        setOpen(false);
        setSyncStep('idle');
        router.refresh();
    };

    return (
        <Dialog open={open} onOpenChange={(val) => !syncing && setOpen(val)}>
            <DialogTrigger asChild>
                <Button variant="outline" className="w-full gap-2">
                    <RefreshCw className="h-4 w-4" />
                    開始同步與計算指標
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] w-[95vw]" onInteractOutside={(e) => syncing && e.preventDefault()}>
                <DialogHeader>
                    <DialogTitle>分階段同步與計算</DialogTitle>
                    <DialogDescription>
                        按指標分批同步 FHIR 資料，確保數據準確並避免伺服器超時。
                    </DialogDescription>
                </DialogHeader>

                <div className="py-6 space-y-6">
                    {/* Status and Progress */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center text-sm font-medium">
                            <span className="flex items-center gap-2">
                                {syncing && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                                {status || "點擊按鈕開始同步"}
                            </span>
                            {progress.total > 0 && (
                                <span className="text-muted-foreground">{progress.current} / {progress.total}</span>
                            )}
                        </div>
                        
                        {/* Custom Progress Bar */}
                        <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                            <div 
                                className={`h-full transition-all duration-500 ease-in-out ${
                                    syncStep === 'error' ? 'bg-destructive' : 'bg-primary'
                                }`}
                                style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                            />
                        </div>
                    </div>

                    {/* Logs Area */}
                    <div className="bg-slate-950 rounded-lg p-4 h-64 overflow-y-auto text-[0.8rem] font-mono border border-slate-800 shadow-inner flex flex-col-reverse">
                        {logs.length === 0 ? (
                            <div className="text-slate-500 italic">準備就緒，等待開始...</div>
                        ) : (
                            <div className="space-y-1.5">
                                {logs.map((log, idx) => (
                                    <div key={idx} className={
                                        log.includes('❌') || log.includes('🚨') ? 'text-rose-400 font-bold' : 
                                        log.includes('⚠️') || log.includes('warning') ? 'text-amber-400' :
                                        log.includes('✨') || log.includes('✅') || log.includes('🎊') ? 'text-emerald-400' : 
                                        'text-slate-300'
                                    }>
                                        {log}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2">
                    {syncStep === 'idle' || syncStep === 'error' ? (
                        <>
                            <Button variant="ghost" onClick={() => setOpen(false)} disabled={syncing}>取消</Button>
                            <Button onClick={handleSync} disabled={syncing}>
                                {syncing ? "處理中..." : syncStep === 'error' ? "重新嘗試" : "開始同步"}
                            </Button>
                        </>
                    ) : syncStep === 'completed' ? (
                        <Button onClick={handleClose} className="w-full sm:w-auto">完成並離開</Button>
                    ) : (
                        <div className="text-xs text-muted-foreground flex items-center justify-center w-full italic">
                            正在運行中，請勿關閉視窗...
                        </div>
                    )}
                    {/* Abort Button Inside Dialog */}
                    {syncing && (
                        <div className="flex justify-end">
                            <Button 
                                onClick={() => abortRef.current = true}
                                variant="destructive"
                                size="sm"
                                className="font-bold shadow-inner"
                            >
                                🚫 中斷同步程序
                            </Button>
                        </div>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
