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

import { syncFhirData } from "@/app/actions/sync-data";
import { saveSystemSetting, getSystemSettings } from "@/app/actions/system";
import { SystemSetting } from "@/types/system";

export default function SettingsPage() {
    const [fhirUrl, setFhirUrl] = useState(SMART_CONFIG.iss);
    const [loading, setLoading] = useState(false);
    const [saved, setSaved] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const { enableAi, setEnableAi } = useSettings();

    // Load from LocalStorage on mount
    // Load from DB or LocalStorage on mount
    useEffect(() => {
        const loadSettings = async () => {
            // Try DB first
            const res = await getSystemSettings(2); // Type 2 = General
            const dbFhir = res.success ? res.data?.find(d => d.SysCode === 'FHIR_SERVER') : null;

            if (dbFhir && dbFhir.SysValue) {
                setFhirUrl(dbFhir.SysValue);
                // Sync local
                localStorage.setItem("KPIM_FHIR_URL", dbFhir.SysValue);
            } else {
                // Fallback to local
                const stored = localStorage.getItem("KPIM_FHIR_URL");
                if (stored) {
                    setFhirUrl(stored);
                }
            }
        };
        loadSettings();
    }, []);

    const handleSave = async () => {
        setLoading(true);
        // Save to LocalStorage (client-side backup/cache)
        localStorage.setItem("KPIM_FHIR_URL", fhirUrl);

        // Save to System Table (Server-side source of truth)
        // We use SysCode: 'FHIR_SERVER', SysType: 2 (General Config)
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

    const handleSync = async () => {
        setSyncing(true);
        try {
            const res = await syncFhirData();
            if (res.success) {
                alert(res.message);
            } else {
                alert("同步失敗: " + res.message);
            }
        } catch (e) {
            alert("同步發生錯誤");
        } finally {
            setSyncing(false);
        }
    };

    return (
        <div className="space-y-6 p-6 md:p-12">
            <h2 className="text-3xl font-bold tracking-tight">設定</h2>

            <Card>
                <CardHeader>
                    <CardTitle>AI 智慧建議功能</CardTitle>
                    <CardDescription>
                        控制是否啟用系統中的前端 AI 輔助功能 (如：指標建議、代碼生成)。此開關不影響後端模型配置。
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between space-x-2">
                        <Label htmlFor="ai-mode" className="flex flex-col space-y-1">
                            <span>啟用前端 AI 輔助</span>
                            <span className="font-normal text-[0.8rem] text-muted-foreground">
                                若關閉，相關 UI 按鈕將被隱藏。
                            </span>
                        </Label>
                        <Switch id="ai-mode" checked={enableAi} onCheckedChange={setEnableAi} />
                    </div>
                </CardContent>
            </Card>

            <AiSettingsTable />

            <Card>
                <CardHeader>
                    <CardTitle>FHIR 伺服器設定</CardTitle>
                    <CardDescription>
                        設定 FHIR 伺服器的連線資訊。
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="fhir-url">FHIR 伺服器網址</Label>
                        <Input
                            id="fhir-url"
                            placeholder="https://hapi.fhir.org/baseR4"
                            value={fhirUrl}
                            onChange={(e) => setFhirUrl(e.target.value)}
                        />
                        <p className="text-[0.8rem] text-muted-foreground">
                            欲連接的 FHIR 伺服器基礎網址 (Base URL)。
                        </p>
                    </div>
                    <Button onClick={handleSave} disabled={loading}>
                        {loading ? "儲存中..." : saved ? "已儲存！" : "儲存設定"}
                    </Button>
                </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>資料管理</CardTitle>
                        <CardDescription>
                            生成演示用的測試資料。
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <DataGenerator />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>FHIR 同步與計算</CardTitle>
                        <CardDescription>
                            手動觸發 FHIR 同步並依定義計算指標。
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button variant="outline" onClick={handleSync} disabled={syncing}>
                            {syncing ? "處理中..." : "同步與計算指標"}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
