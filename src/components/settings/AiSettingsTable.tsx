
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Pencil, Trash2, Plus } from "lucide-react";
import { SystemSetting, parseAiConfig } from "@/types/system";
import { getSystemSettings, deleteSystemSetting } from "@/app/actions/system";
import { AiConfigDialog } from "./AiConfigDialog";

export function AiSettingsTable() {
    const [settings, setSettings] = useState<SystemSetting[]>([]);
    const [loading, setLoading] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<SystemSetting | null>(null);

    const fetchSettings = async () => {
        setLoading(true);
        const res = await getSystemSettings(1); // Type 1 = AI Config
        if (res.success && res.data) {
            setSettings(res.data);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const handleAdd = () => {
        setEditingItem(null);
        setDialogOpen(true);
    };

    const handleEdit = (item: SystemSetting) => {
        setEditingItem(item);
        setDialogOpen(true);
    };

    const handleDelete = async (sysCode: string) => {
        if (!confirm("確定要刪除此設定嗎？")) return;

        const res = await deleteSystemSetting(sysCode);
        if (res.success) {
            fetchSettings();
        } else {
            alert("刪除失敗");
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="space-y-1">
                    <CardTitle>AI 模型配置</CardTitle>
                    <CardDescription>
                        管理不同的 AI 模型連線設定。
                    </CardDescription>
                </div>
                <Button size="sm" onClick={handleAdd}>
                    <Plus className="mr-2 h-4 w-4" /> 新增設定
                </Button>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>名稱</TableHead>
                                <TableHead>模型 (Provider)</TableHead>
                                <TableHead>API URL</TableHead>
                                <TableHead>狀態</TableHead>
                                <TableHead>到期日</TableHead>
                                <TableHead className="text-right">操作</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24">載入中...</TableCell>
                                </TableRow>
                            ) : settings.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24">無設定資料</TableCell>
                                </TableRow>
                            ) : (
                                settings.map((item) => {
                                    const config = parseAiConfig(item.SysValue);
                                    return (
                                        <TableRow key={item.SysCode}>
                                            <TableCell className="font-medium">{item.SysName}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-semibold">{config?.model || "-"}</span>
                                                    <span className="text-xs text-muted-foreground">{config?.provider || "Custom"}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="truncate max-w-[150px] text-xs" title={config?.apiUrl}>{config?.apiUrl || "-"}</TableCell>
                                            <TableCell>
                                                {config?.isEnabled ?
                                                    <span className="text-green-600 font-bold">啟用</span> :
                                                    <span className="text-gray-400">停用</span>
                                                }
                                            </TableCell>
                                            <TableCell>{config?.expireDate || "-"}</TableCell>
                                            <TableCell className="text-right space-x-2">
                                                <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(item.SysCode)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>

            <AiConfigDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                editingConfig={editingItem}
                onSave={fetchSettings}
            />
        </Card>
    );
}
