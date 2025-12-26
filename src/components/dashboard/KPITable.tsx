"use client";

import { KPIDetail } from "@/types/dashboard";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

import Link from "next/link";
// ... (keep imports)

interface KPITableProps {
    items: KPIDetail[];
    title?: string;
    viewType?: "department" | "doctor"; // New prop
}

export function KPITable({ items, title, viewType = "department" }: KPITableProps) {
    const searchParams = useSearchParams();
    // Helper to preserve other params (like dates) when adding dept query
    const createQueryString = (name: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set(name, value);
        return params.toString();
    };

    return (
        <Card className="w-full">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="text-lg">{title || "[指標儀表板] 最近一日指標監控"}</CardTitle>
                    {viewType === "doctor" && (
                        <Link href={`?${(() => {
                            const params = new URLSearchParams(searchParams.toString());
                            params.delete("dept");
                            return params.toString();
                        })()}`}
                            className="text-sm text-blue-500 hover:underline px-4 py-2 bg-blue-50 rounded">
                            返回科別總覽
                        </Link>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow className="bg-[#1f5f7e] hover:bg-[#1f5f7e]">
                            <TableHead className="text-white font-bold">{viewType === "department" ? "科別" : "醫師"}</TableHead>
                            <TableHead className="text-white font-bold">指標值</TableHead>
                            <TableHead className="text-white font-bold">術後 48 小時死亡人次</TableHead>
                            <TableHead className="text-white font-bold">手術人次</TableHead>
                            <TableHead className="text-white font-bold">燈號</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.map((item, index) => (
                            <TableRow key={index} className="even:bg-slate-50 even:dark:bg-slate-900/50">
                                <TableCell className="font-medium">
                                    {viewType === "department" ? (
                                        <Link
                                            href={`?${createQueryString("dept", item.department)}`}
                                            className="text-blue-600 hover:underline"
                                            title="點擊下向鑽取至醫師"
                                        >
                                            {item.department}
                                        </Link>
                                    ) : (
                                        item.doctor || "未指定" // Display doctor name if doctor view
                                    )}
                                </TableCell>
                                <TableCell>{item.value}{item.unit}</TableCell>
                                <TableCell>{item.numerator}</TableCell>
                                <TableCell>{item.denominator}</TableCell>
                                <TableCell>
                                    <div className="flex items-center">
                                        <span
                                            className={`h-4 w-4 rounded-full ${item.status === '正常' || item.value === 0 ? 'bg-green-500' : 'bg-red-500'}`}
                                            aria-label={item.status || (item.value === 0 ? "正常" : "異常")}
                                        />
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {items.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">無資料</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
