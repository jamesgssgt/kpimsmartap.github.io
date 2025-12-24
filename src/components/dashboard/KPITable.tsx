"use client";

import { KPIItem } from "@/types/dashboard";
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
    items: KPIItem[];
}

export function KPITable({ items }: KPITableProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const handleDoctorClick = (doctorName: string) => {
        const params = new URLSearchParams(searchParams.toString());
        // Set doctor filter to the clicked doctor (Single Select/Focus mode)
        params.set("doctor", doctorName);

        // Ensure dept is also synced if possible, or let DashboardFilters handle it?
        // Simpler to just set doctor and let the page re-filter.
        // DashboardFilters will see the URL change and sync its own state.

        router.push(`${pathname}?${params.toString()}`);
    };

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle className="text-lg">[指標儀表板] 術後 48 小時死亡率統計 (依醫師)指標監控</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow className="bg-[#1f5f7e] hover:bg-[#1f5f7e]">
                            <TableHead className="text-white font-bold">科別</TableHead>
                            <TableHead className="text-white font-bold">醫師</TableHead>
                            <TableHead className="text-white font-bold">指標名稱</TableHead>
                            <TableHead className="text-white font-bold">數值</TableHead>
                            <TableHead className="text-white font-bold">是否正常</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.map((item, index) => (
                            <TableRow key={index} className="even:bg-slate-50 even:dark:bg-slate-900/50">
                                <TableCell className="font-medium">{item.department}</TableCell>
                                <TableCell
                                    className="cursor-pointer hover:underline text-blue-600 dark:text-blue-400 font-medium"
                                    onClick={() => handleDoctorClick(item.doctor)}
                                >
                                    {item.doctor}
                                </TableCell>
                                <TableCell>{item.indicator_name}</TableCell>
                                <TableCell>{item.value}{item.unit}</TableCell>
                                <TableCell>
                                    <div className="flex items-center">
                                        <span
                                            className={`h-4 w-4 rounded-full ${item.value === 0 ? 'bg-green-500' : 'bg-red-500'}`}
                                            aria-label={item.value === 0 ? "正常" : "異常"}
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
