"use client";

import { useState } from "react";
import { generateData } from "@/app/actions/generate-data";
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
import { Loader2 } from "lucide-react";

export function DataGenerator() {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

    const handleGenerate = async () => {
        setLoading(true);
        const res = await generateData();
        setResult(res);
        setLoading(false);
    };

    const handleClose = () => {
        setOpen(false);
        setResult(null);
        // Optional: Refresh page to see data
        window.location.reload();
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">測試資料生成</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                {!result ? (
                    <>
                        <DialogHeader>
                            <DialogTitle>生成範例資料</DialogTitle>
                            <DialogDescription>
                                將生成 300 筆範例資料並寫入系統。此過程可能需要一點時間。
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4 flex justify-center">
                            {loading && <Loader2 className="h-8 w-8 animate-spin text-primary" />}
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                                取消
                            </Button>
                            <Button onClick={handleGenerate} disabled={loading}>
                                {loading ? "生成中..." : "確定"}
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
                            <Button onClick={handleClose}>結束</Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
