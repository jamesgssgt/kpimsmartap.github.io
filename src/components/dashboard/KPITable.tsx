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

interface KPITableProps {
    items: KPIDetail[];
}

export function KPITable({ items }: KPITableProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Logic for row click (optional, maybe filter by dept now?)
    // User removed Doctor column, so maybe we filtering by Dept?
    // Let's keep it simple for now and remove click-to-filter unless requested, 
    // or maybe click on Dept filters by Dept?

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle className="text-lg">[指標儀表板] 最近一日指標監控</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow className="bg-[#1f5f7e] hover:bg-[#1f5f7e]">
                            <TableHead className="text-white font-bold">科別</TableHead>
                            <TableHead className="text-white font-bold">指標名稱</TableHead>
                            <TableHead className="text-white font-bold">指標值</TableHead>
                            <TableHead className="text-white font-bold">分子值/分母值</TableHead>
                            <TableHead className="text-white font-bold">燈號</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.map((item, index) => (
                            <TableRow key={index} className="even:bg-slate-50 even:dark:bg-slate-900/50">
                                <TableCell className="font-medium">{item.department}</TableCell>
                                <TableCell>{item.indicator_name}</TableCell>
                                <TableCell>{item.value}{item.unit}</TableCell>
                                <TableCell>
                                    {item.numerator} / {item.denominator}
                                </TableCell>
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
