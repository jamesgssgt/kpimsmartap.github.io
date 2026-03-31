"use client";

import React, { useState, useEffect } from "react";
import { SMART_CONFIG } from "@/utils/smart-conf";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DataGenerator } from "@/components/DataGenerator";
import { KPISyncManager } from "@/components/dashboard/KPISyncManager";
import { useSettings } from "@/contexts/SettingsContext";
import { AiSettingsTable } from "@/components/settings/AiSettingsTable";

import { saveSystemSetting, getSystemSettings } from "@/app/actions/system";
import { SystemSetting } from "@/types/system";

export default function SettingsPage() {
    const [fhirUrl, setFhirUrl] = useState(SMART_CONFIG.iss);
    const [loading, setLoading] = useState(false);
    const [saved, setSaved] = useState(false);
    
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

                <Card>
                    <CardHeader>
                        <CardTitle>分階段同步與計算</CardTitle>
                        <CardDescription>按指標分批同步 FHIR 資料，確保數據準確並避免伺服器超時。</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <KPISyncManager />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
