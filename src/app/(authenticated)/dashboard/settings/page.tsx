"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataGenerator } from "@/components/DataGenerator";

import { syncFhirData } from "@/app/actions/sync-data";

export default function SettingsPage() {
    const [fhirUrl, setFhirUrl] = useState("https://launch.smarthealthit.org/v/r4/fhir");
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);

    const handleSave = () => {
        setLoading(true);
        // Simulate save - in a real app this might save to env, db, or local storage for client-side init
        console.log("Saving FHIR URL:", fhirUrl);
        setTimeout(() => {
            setLoading(false);
            alert("Settings saved (Simulated)");
        }, 800);
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
        <div className="space-y-6">
            <h2 className="text-3xl font-bold tracking-tight">設定</h2>

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
                        {loading ? "儲存中..." : "儲存設定"}
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
                        <CardTitle>FHIR 同步</CardTitle>
                        <CardDescription>
                            手動觸發與已設定的 FHIR 伺服器同步。
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button variant="outline" onClick={handleSync} disabled={syncing}>
                            {syncing ? "同步中..." : "與 FHIR 伺服器同步"}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
