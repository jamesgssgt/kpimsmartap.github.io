"use client";

import React, { useState, useEffect } from "react";
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

    const handleSync = async () => {
        const sid = uuidv4();
        setSessionId(sid);
        setSyncing(true);
        setSyncStep('syncing');
        setLogs([]);
        setProgress({ current: 0, total: 0 });
        setStatus("🚀 啟動 V13 分頁重試同步引擎...");
        addLog("🔗 正在建立安全同步階段並取得指標清單...");

        try {
            // 1. Initial Handshake & Get Indicators
            const initRes = await syncFhirData(sid);
            if (!initRes.success) throw new Error(initRes.message);
            const indicators = initRes.indicators || [];
            setProgress({ current: 0, total: indicators.length });

            // 2. Loop Indicators
            for (let i = 0; i < indicators.length; i++) {
                const name = indicators[i];
                setStatus(`正在準備同步指標：${name}`);
                addLog(`指標 [${i + 1}/${indicators.length}]: ${name}`);

                // 2.5 Optional: Get Total Count for display
                addLog(`⚙️ 正在統計伺服器數據量，請稍候...`);
                const countRes = await getFhirRecordCount(name);
                if (countRes.success) {
                    addLog(`📊 預計處理筆數：${countRes.count} 筆 (${countRes.resourceType})`);
                }

                // 3. Get Initial URL for this indicator
                const urlRes = await getIndicatorInitialUrl(name);
                if (!urlRes.success) {
                    addLog(`⚠️ 指標初始化失敗: ${urlRes.message}`, 'warning' as any);
                    continue;
                }

                let currentUrl: string | null = urlRes.url ?? null;
                let pageIdx = 1;
                let processedInIndicator = 0;

                // 4. Paging Loop for current indicator
                while (currentUrl) {
                    let retryCount = 0;
                    const MAX_RETRIES = 3;
                    let success = false;

                    while (retryCount < MAX_RETRIES && !success) {
                        try {
                            if (!currentUrl) break;
                            const pageRes = await syncSinglePage(name, currentUrl, sid, processedInIndicator, pageIdx);
                            currentUrl = pageRes.nextUrl;
                            processedInIndicator = pageRes.totalProcessedSoFar;
                            pageIdx++;
                            success = true;
                            retryCount = 0; // 重置重試計次
                        } catch (e: any) {
                            retryCount++;
                            if (retryCount >= MAX_RETRIES) {
                                addLog(`🚨 分頁連續失敗 3 次，跳過此指標: ${name}`, 'error' as any);
                                currentUrl = null; // 跳出當前指標循環
                            } else {
                                addLog(`⚠️ 網絡異常，正在進行第 ${retryCount} 次重載嘗試...`, 'warning' as any);
                                await new Promise(r => setTimeout(r, 2000)); // 等待 2 秒後重試
                            }
                        }
                    }
                }
                
                setProgress(prev => ({ ...prev, current: i + 1 }));
                addLog(`✅ 指標「${name}」同步完成！總計：${processedInIndicator} 筆`);
            }

            setSyncStep('completed');
            setStatus("🎉 全數同步作業已順利完成！");
            addLog("🎊 所有指標已通過分頁重試機制同步結束。");

        } catch (e: any) {
            setSyncStep('error');
            setStatus("❌ 同步發生錯誤");
            addLog(`🚨 終止錯誤: ${e.message}`);
        } finally {
            // Always release lock
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
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
