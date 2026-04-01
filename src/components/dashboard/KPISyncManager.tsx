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
import { getSyncIndicators, getFhirRecordCount, syncFhirIndicatorBatch, getSyncLogs, syncFhirData } from "@/app/actions/sync-data";
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

    const addLog = (msg: string) => {
        setLogs(prev => {
            const timeStr = `[${new Date().toLocaleTimeString('zh-TW', { hour12: false })}]`;
            const fullMsg = msg.startsWith('[') ? msg : `${timeStr} ${msg}`;
            // Avoid duplicate logs if they come from the same second/content
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
        setStatus("正在啟動伺服器主控同步 (V10)...");
        addLog("🚀 請稍候，後台正在執行全自動同步與鎖定...");

        try {
            const res = await syncFhirData(sid);
            if (res.success) {
                setSyncStep('completed');
                setStatus("🎉 同步作業全數完成！");
                addLog("🎊 所有指標已順利同步完成。");
            } else {
                throw new Error(res.message);
            }
        } catch (e: any) {
            setSyncStep('error');
            setStatus("❌ 同步發生錯誤");
            addLog(`🚨 錯誤: ${e.message}`);
        } finally {
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
                    <div className="bg-slate-950 rounded-lg p-4 h-64 overflow-y-auto text-[0.8rem] font-mono border border-slate-800 shadow-inner">
                        {logs.length === 0 ? (
                            <div className="text-slate-500 italic">準備就緒，等待開始...</div>
                        ) : (
                            <div className="space-y-1.5">
                                {logs.map((log, idx) => (
                                    <div key={idx} className={
                                        log.includes('❌') || log.includes('🚨') ? 'text-rose-400 font-bold' : 
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
