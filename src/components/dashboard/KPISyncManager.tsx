"use client";

import React, { useState } from "react";
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
import { getSyncIndicators, getFhirRecordCount, syncFhirIndicatorBatch } from "@/app/actions/sync-data";
import { useRouter } from "next/navigation";

export function KPISyncManager() {
    const [open, setOpen] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [syncStep, setSyncStep] = useState<'idle' | 'preparing' | 'checking' | 'syncing' | 'completed' | 'error'>('idle');
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [status, setStatus] = useState("");
    const [logs, setLogs] = useState<string[]>([]);
    const router = useRouter();

    const addLog = (msg: string) => {
        setLogs(prev => [`[${new Date().toLocaleTimeString('zh-TW', { hour12: false })}] ${msg}`, ...prev]);
    };

    const handleSync = async () => {
        setSyncing(true);
        setSyncStep('preparing');
        setLogs([]);
        setStatus("正在取得指標清單...");
        addLog("🚀 開始同步流程...");

        try {
            // Phase 1: Get Indicators
            const metaRes = await getSyncIndicators();
            if (!metaRes.success || !metaRes.data) {
                throw new Error(metaRes.message || "取得指標清單失敗");
            }
            const indicators = metaRes.data;
            addLog(`✅ 已取得 ${indicators.length} 個指標定義。`);

            // Phase 2: Check Counts
            setSyncStep('checking');
            setProgress({ current: 0, total: indicators.length });
            
            for (let i = 0; i < indicators.length; i++) {
                const name = indicators[i];
                setStatus(`正在確認筆數: ${name} (${i + 1}/${indicators.length})`);
                setProgress({ current: i + 1, total: indicators.length });
                
                const countRes = await getFhirRecordCount(name);
                if (countRes.success) {
                    addLog(`🔍 指標「${name}」預計同步 ${countRes.count || 0} 筆數據 (${countRes.resourceType})`);
                }
            }

            // Phase 3: Sync Batches
            setSyncStep('syncing');
            setProgress({ current: 0, total: indicators.length });
            for (let i = 0; i < indicators.length; i++) {
                const name = indicators[i];
                setStatus(`正在同步: ${name} (${i + 1}/${indicators.length})`);
                setProgress({ current: i + 1, total: indicators.length });
                addLog(`⏳ 正在執行「${name}」同步計算...`);

                const res = await syncFhirIndicatorBatch(name);
                if (res.success) {
                    addLog(`✨ 指標「${name}」同步完成: ${res.message}`);
                } else {
                    addLog(`❌ 指標「${name}」同步失敗: ${res.message}`);
                }
            }

            setSyncStep('completed');
            setStatus("🎉 同步作業全數完成！");
            addLog("🎊 同步流程順利結束。");
        } catch (e: any) {
            setSyncStep('error');
            setStatus("❌ 同步發生錯誤");
            addLog(`🚨 錯誤: ${e.message}`);
        } finally {
            setSyncing(false);
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
