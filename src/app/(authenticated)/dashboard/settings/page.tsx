"use client";

import { useState, useEffect } from "react";
import { SMART_CONFIG } from "@/utils/smart-conf";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DataGenerator } from "@/components/DataGenerator";
import { useSettings } from "@/contexts/SettingsContext";
import { AiSettingsTable } from "@/components/settings/AiSettingsTable";
import { Loader2 } from "lucide-react";

import { getSyncIndicators, getFhirRecordCount, syncFhirIndicatorBatch } from "@/app/actions/sync-data";
import { saveSystemSetting, getSystemSettings } from "@/app/actions/system";
import { SystemSetting } from "@/types/system";

export default function SettingsPage() {
    const [fhirUrl, setFhirUrl] = useState(SMART_CONFIG.iss);
    const [loading, setLoading] = useState(false);
    const [saved, setSaved] = useState(false);
    
    // Sync state
    const [syncing, setSyncing] = useState(false);
    const [syncStep, setSyncStep] = useState<'idle' | 'preparing' | 'checking' | 'syncing' | 'completed' | 'error'>('idle');
    const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
    const [syncStatus, setSyncStatus] = useState("");
    const [syncLogs, setSyncLogs] = useState<string[]>([]);

    const { enableAi, setEnableAi, enableFavorites, setEnableFavorites } = useSettings();

    useEffect(() => {
        const loadSettings = async () => {
            const res = await getSystemSettings(2);
            const dbFhir = res.success ? res.data?.find(d => d.SysCode === 'FHIR_SERVER') : null;

            if (dbFhir && dbFhir.SysValue) {
                setFhirUrl(dbFhir.SysValue);
                localStorage.setItem("KPIM_FHIR_URL", dbFhir.SysValue);
            } else {
                const stored = localStorage.getItem("KPIM_FHIR_URL");
                if (stored) setFhirUrl(stored);
            }
        };
        loadSettings();
    }, []);

    const handleSave = async () => {
        setLoading(true);
        localStorage.setItem("KPIM_FHIR_URL", fhirUrl);
        const sysSetting: SystemSetting = {
            SysCode: 'FHIR_SERVER',
            SysName: 'Default FHIR Server',
            SysType: 2,
            SysValue: fhirUrl
        };
        const res = await saveSystemSetting(sysSetting);
        setLoading(false);
        if (res.success) {
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } else {
            alert("儲存到伺服器失敗: " + res.error);
        }
    };

    const addLog = (msg: string) => {
        setSyncLogs(prev => [`[${new Date().toLocaleTimeString('zh-TW', { hour12: false })}] ${msg}`, ...prev]);
    };

    const handleSync = async () => {
        setSyncing(true);
        setSyncStep('preparing');
        setSyncLogs([]);
        setSyncStatus("正在取得指標清單...");
        addLog("開始同步流程...");

        try {
            // Phase 1: Get Indicators
            const metaRes = await getSyncIndicators();
            if (!metaRes.success || !metaRes.data) {
                throw new Error(metaRes.message || "取得指標清單失敗");
            }
            const indicators = metaRes.data;
            addLog(`已取得 ${indicators.length} 個指標定義。`);

            // Phase 2: Check Counts
            setSyncStep('checking');
            setSyncProgress({ current: 0, total: indicators.length });
            const indicatorCounts: Record<string, number> = {};
            
            for (let i = 0; i < indicators.length; i++) {
                const name = indicators[i];
                setSyncStatus(`正在確認筆數: ${name} (${i + 1}/${indicators.length})`);
                setSyncProgress({ current: i + 1, total: indicators.length });
                
                const countRes = await getFhirRecordCount(name);
                if (countRes.success) {
                    indicatorCounts[name] = countRes.count || 0;
                    addLog(`指標「${name}」預計同步 ${countRes.count || 0} 筆數據 (${countRes.resourceType})`);
                }
            }

            // Phase 3: Sync Batches
            setSyncStep('syncing');
            setSyncProgress({ current: 0, total: indicators.length });
            for (let i = 0; i < indicators.length; i++) {
                const name = indicators[i];
                setSyncStatus(`正在同步: ${name} (${i + 1}/${indicators.length})`);
                setSyncProgress({ current: i + 1, total: indicators.length });
                addLog(`正在執行「${name}」同步計算...`);

                const res = await syncFhirIndicatorBatch(name);
                if (res.success) {
                    addLog(`指標「${name}」同步成功: ${res.message}`);
                } else {
                    addLog(`❌ 指標「${name}」同步失敗: ${res.message}`);
                }
            }

            setSyncStep('completed');
            setSyncStatus("同步作業全數完成！");
            addLog("🎉 同步流程結束。");
        } catch (e: any) {
            setSyncStep('error');
            setSyncStatus("同步發生錯誤");
            addLog(`❌ 錯誤: ${e.message}`);
        } finally {
            setSyncing(false);
        }
    };

    return (
        <div className="space-y-6 p-6 md:p-12">
            <h2 className="text-3xl font-bold tracking-tight">設定</h2>

            {/* AI and Extension Settings */}
            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>AI 智慧建議功能</CardTitle>
                        <CardDescription>控制是否啟用前端 AI 輔助功能。</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between space-x-2">
                            <Label htmlFor="ai-mode" className="flex flex-col space-y-1">
                                <span>啟用前端 AI 輔助</span>
                                <span className="text-xs text-muted-foreground">若關閉，相關 UI 按鈕將被隱藏。</span>
                            </Label>
                            <Switch id="ai-mode" checked={enableAi} onCheckedChange={setEnableAi} />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>擴充功能設定</CardTitle>
                        <CardDescription>調整儀表板的額外功能顯示。</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between space-x-2">
                            <Label htmlFor="fav-mode" className="flex flex-col space-y-1">
                                <span>啟用「我的最愛」功能</span>
                                <span className="text-xs text-muted-foreground">若開啟，側邊欄將顯示捷徑。</span>
                            </Label>
                            <Switch id="fav-mode" checked={enableFavorites} onCheckedChange={setEnableFavorites} />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <AiSettingsTable />

            {/* FHIR Server Settings */}
            <Card>
                <CardHeader>
                    <CardTitle>FHIR 伺服器設定</CardTitle>
                    <CardDescription>設定 FHIR 伺服器的連線資訊。</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="fhir-url">FHIR 伺服器網址</Label>
                        <Input id="fhir-url" value={fhirUrl} onChange={(e) => setFhirUrl(e.target.value)} />
                    </div>
                    <Button onClick={handleSave} disabled={loading}>{loading ? "儲存中..." : saved ? "已儲存！" : "儲存設定"}</Button>
                </CardContent>
            </Card>

            {/* Data Management Section */}
            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>資料生成器</CardTitle>
                        <CardDescription>生成演示用的測試資料到 FHIR Server。</CardDescription>
                    </CardHeader>
                    <CardContent><DataGenerator /></CardContent>
                </Card>

                <Card className={syncing ? "border-primary shadow-md transition-all" : ""}>
                    <CardHeader>
                        <CardTitle>分階段同步與計算</CardTitle>
                        <CardDescription>按指標分批同步 FHIR 資料，避免超時並顯示即時進度。</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {!syncing && syncStep === 'idle' && (
                            <Button variant="outline" onClick={handleSync} className="w-full">
                                開始同步流程
                            </Button>
                        )}

                        {(syncing || syncStep !== 'idle') && (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm font-medium">
                                        <span className="flex items-center gap-2">
                                            {syncing && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                                            {syncStatus}
                                        </span>
                                        {syncProgress.total > 0 && (
                                            <span>{syncProgress.current} / {syncProgress.total}</span>
                                        )}
                                    </div>
                                    
                                    {/* Custom Progress Bar */}
                                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-primary transition-all duration-500 ease-in-out"
                                            style={{ width: `${syncProgress.total > 0 ? (syncProgress.current / syncProgress.total) * 100 : 0}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Mini Logs */}
                                <div className="bg-muted/30 rounded-md p-3 h-40 overflow-y-auto text-[0.75rem] font-mono space-y-1 border">
                                    {syncLogs.map((log, idx) => (
                                        <div key={idx} className={log.includes('❌') ? 'text-destructive' : log.includes('🎉') ? 'text-emerald-600 font-bold' : 'text-muted-foreground'}>
                                            {log}
                                        </div>
                                    ))}
                                </div>

                                {syncStep === 'completed' && (
                                    <Button variant="outline" onClick={() => setSyncStep('idle')} className="w-full">
                                        完成
                                    </Button>
                                )}
                                {syncStep === 'error' && (
                                    <Button variant="destructive" onClick={handleSync} className="w-full">
                                        重試
                                    </Button>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
