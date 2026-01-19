
"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AiConfig, SystemSetting, parseAiConfig, stringifyAiConfig } from "@/types/system";
import { saveSystemSetting } from "@/app/actions/system";

interface AiConfigDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editingConfig: SystemSetting | null;
    onSave: () => void;
}

const PROVIDERS = {
    "Gemini": {
        label: "Google Gemini",
        defaultUrl: "https://generativelanguage.googleapis.com/v1beta",
        models: [
            { label: "Gemini 3 Pro (Preview)", value: "gemini-3-pro-preview" },
            { label: "Gemini 3 Flash (Preview)", value: "gemini-3-flash-preview" },
            { label: "Gemini 2.5 Pro", value: "gemini-2.5-pro" },
            { label: "Gemini 2.5 Flash", value: "gemini-2.5-flash" },
            { label: "Gemini 2.5 Flash-Lite", value: "gemini-2.5-flash-lite" },
            { label: "Gemini 2.0 Flash", value: "gemini-2.0-flash" },
            { label: "Gemini 2.0 Flash (Exp)", value: "gemini-2.0-flash-exp" },
            { label: "Gemini 1.5 Pro", value: "gemini-1.5-pro" },
            { label: "Gemini 1.5 Flash", value: "gemini-1.5-flash" }
        ]
    },
    "ChatGPT": {
        label: "ChatGPT (OpenAI)",
        defaultUrl: "https://api.openai.com/v1",
        models: [
            { label: "GPT-4o", value: "gpt-4o" },
            { label: "GPT-4 Turbo", value: "gpt-4-turbo" },
            { label: "GPT-3.5 Turbo", value: "gpt-3.5-turbo" }
        ]
    },
    "Custom": {
        label: "Custom / Local",
        defaultUrl: "",
        models: []
    }
};

export function AiConfigDialog({ open, onOpenChange, editingConfig, onSave }: AiConfigDialogProps) {
    const [name, setName] = useState("");
    const [provider, setProvider] = useState<keyof typeof PROVIDERS>("Custom");
    const [model, setModel] = useState("");
    const [apiUrl, setApiUrl] = useState("");
    const [apiKey, setApiKey] = useState("");
    const [expireDate, setExpireDate] = useState("");
    const [isEnabled, setIsEnabled] = useState(true);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (editingConfig) {
            const config = parseAiConfig(editingConfig.SysValue);
            if (config) {
                setName(config.name);
                setProvider((config.provider as keyof typeof PROVIDERS) || "Custom");
                setModel(config.model || "");
                setApiUrl(config.apiUrl);
                setApiKey(config.apiKey);
                setExpireDate(config.expireDate);
                setIsEnabled(config.isEnabled);
            } else {
                setName(editingConfig.SysName || "");
                setProvider("Custom");
            }
        } else {
            resetForm();
        }
    }, [editingConfig, open]);

    const resetForm = () => {
        setName("");
        setProvider("Custom");
        setModel("");
        setApiUrl("");
        setApiKey("");
        setExpireDate("");
        setIsEnabled(true);
    };

    const handleProviderChange = (val: string) => {
        const newProvider = val as keyof typeof PROVIDERS;
        setProvider(newProvider);
        if (PROVIDERS[newProvider].defaultUrl) {
            setApiUrl(PROVIDERS[newProvider].defaultUrl);
        }
        if (PROVIDERS[newProvider].models.length > 0) {
            setModel(PROVIDERS[newProvider].models[0].value);
        } else {
            setModel("");
        }
    };

    const handleSave = async () => {
        setLoading(true);

        const config: AiConfig = {
            name,
            provider,
            model,
            apiUrl,
            apiKey,
            expireDate,
            isEnabled
        };

        const sysSetting: SystemSetting = {
            SysCode: editingConfig?.SysCode || `AI_${Date.now()}`,
            SysName: name,
            SysType: 1, // AI Config Type
            SysValue: stringifyAiConfig(config)
        };

        const res = await saveSystemSetting(sysSetting);

        setLoading(false);
        if (res.success) {
            onSave();
            onOpenChange(false);
        } else {
            alert("儲存失敗: " + res.error);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{editingConfig ? "編輯 AI 設定" : "新增 AI 設定"}</DialogTitle>
                    <DialogDescription>
                        設定 AI 模型的連線資訊與效期。
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Provider</Label>
                        <div className="col-span-3">
                            <Select value={provider} onValueChange={handleProviderChange}>
                                <SelectTrigger>
                                    <SelectValue placeholder="選擇提供者" />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(PROVIDERS).map(([key, info]) => (
                                        <SelectItem key={key} value={key}>{info.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="model" className="text-right">Model</Label>
                        <div className="col-span-3">
                            {PROVIDERS[provider].models.length > 0 ? (
                                <Select value={model} onValueChange={setModel}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="選擇模型" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PROVIDERS[provider].models.map((m) => (
                                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <Input
                                    id="model"
                                    value={model}
                                    onChange={(e) => setModel(e.target.value)}
                                    placeholder="Model Name (e.g. llama-2)"
                                />
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">Alias Name</Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="col-span-3"
                            placeholder="顯示名稱 (e.g. My Gemini)"
                        />
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="url" className="text-right">API URL</Label>
                        <Input
                            id="url"
                            value={apiUrl}
                            onChange={(e) => setApiUrl(e.target.value)}
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="key" className="text-right">API Key</Label>
                        <Input
                            id="key"
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="date" className="text-right">到期日</Label>
                        <Input
                            id="date"
                            type="date"
                            value={expireDate}
                            onChange={(e) => setExpireDate(e.target.value)}
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="enable" className="text-right">啟用</Label>
                        <div className="col-span-3">
                            <Switch
                                id="enable"
                                checked={isEnabled}
                                onCheckedChange={setIsEnabled}
                            />
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleSave} disabled={loading}>
                        {loading ? "儲存中..." : "儲存"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
