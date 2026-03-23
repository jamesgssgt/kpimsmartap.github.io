"use client";

import { useState } from "react";
import { clearGeneratedData, exportFHIRTestCases, generateDataV2 } from "@/app/actions/generate-data";
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
import { Loader2, Download } from "lucide-react";

import { useRouter } from "next/navigation";

export function DataGenerator() {
    const [open, setOpen] = useState(false);
    const [loadingAction, setLoadingAction] = useState<string | null>(null);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
    const router = useRouter();

    const handleGenerate = async (mode: 'mortality' | 'antibiotic') => {
        setLoadingAction(mode);
        const res = await generateDataV2(mode);
        setResult(res);
        setLoadingAction(null);
    };

    const handleClear = async () => {
        if (!confirm("確定要清除所有已生成的 KPI 資料嗎？這不會刪除指標定義，但會清空所有圖表數據。")) return;
        setLoadingAction('clear');
        const res = await clearGeneratedData('all');
        setLoadingAction(null);

        // Show alert for Clear action since it's outside the dialog
        alert(res.message);
        router.refresh();
    };

    const handleExportFHIR = async () => {
        setLoadingAction('export');
        try {
            const res = await exportFHIRTestCases();
            if (res.success && res.data) {
                const jsonString = JSON.stringify(res.data, null, 2);
                const blob = new Blob([jsonString], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `fhir_test_cases_${new Date().getTime()}.json`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                alert(res.message || "成功匯出測試案例！");
            } else {
                alert(res.message);
            }
        } catch (error) {
            console.error("Export FHIR Error:", error);
            alert("匯出發生錯誤");
        }
        setLoadingAction(null);
    };

    const handleClose = () => {
        setOpen(false);
        setResult(null);
        // Soft refresh to update data without full reload
        router.refresh();
    };

    return (
        <div className="flex flex-wrap items-center gap-4">
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline" type="button" disabled={loadingAction !== null}>開啟資料生成器</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]" onInteractOutside={(e) => e.preventDefault()}>
                    {!result ? (
                        <>
                            <DialogHeader>
                                <DialogTitle>生成範例資料</DialogTitle>
                                <DialogDescription>
                                    {loadingAction === 'mortality' ? "正在生成「手術後 48 小時內死亡率」半年份 (180天) 的範例資料並寫入系統，這可能需要一點時間..." :
                                     loadingAction === 'antibiotic' ? "正在生成「預防性抗生素未在劃刀前 1 小時給予」半年份 (180天) 的範例資料並寫入系統，這可能需要一點時間..." :
                                     "將生成 **半年份 (180天)** 的範例資料並寫入系統。此過程可能需要一點時間。"}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="py-4 flex justify-center">
                                {loadingAction && loadingAction !== 'export' && loadingAction !== 'clear' && <Loader2 className="h-8 w-8 animate-spin text-primary" />}
                            </div>
                            <DialogFooter className="flex-col sm:flex-row gap-2">
                                <Button variant="outline" onClick={() => setOpen(false)} disabled={loadingAction !== null} type="button">
                                    取消
                                </Button>
                                <Button
                                    className="bg-rose-600 hover:bg-rose-700"
                                    onClick={() => handleGenerate('mortality')}
                                    disabled={loadingAction !== null}
                                    type="button"
                                >
                                    {loadingAction === 'mortality' ? "生成「死亡率」中..." : "生成：術後死亡率"}
                                </Button>
                                <Button
                                    className="bg-emerald-600 hover:bg-emerald-700"
                                    onClick={() => handleGenerate('antibiotic')}
                                    disabled={loadingAction !== null}
                                    type="button"
                                >
                                    {loadingAction === 'antibiotic' ? "生成「抗生素」中..." : "生成：抗生素給予率"}
                                </Button>
                            </DialogFooter>
                        </>
                    ) : (
                        <>
                            <DialogHeader>
                                <DialogTitle>{result.success ? "生成完成" : "生成失敗"}</DialogTitle>
                                <DialogDescription>
                                    {result.message}
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <Button onClick={handleClose} type="button">結束</Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog >

            <Button
                variant="outline"
                onClick={handleExportFHIR}
                disabled={loadingAction !== null}
                type="button"
                className="gap-2"
            >
                {loadingAction === 'export' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                匯出測試案例(FHIR JSON)
            </Button>

            <Button
                variant="destructive"
                onClick={handleClear}
                disabled={loadingAction !== null}
                type="button"
            >
                {loadingAction === 'clear' ? "處理中..." : "清除所有資料"}
            </Button>
        </div>
    );
}
