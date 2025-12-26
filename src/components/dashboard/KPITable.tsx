"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
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

interface KPITableProps {
    items: KPIDetail[];
    title?: string;
    viewType?: "department" | "doctor" | "none" | "date-ranking";
}

function DrillDownTooltip({ children, content }: { children: React.ReactNode; content: React.ReactNode }) {
    const [visible, setVisible] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0 });
    const triggerRef = useRef<HTMLDivElement>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleMouseEnter = () => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            // Calculate position: Center above the element
            // Using fixed positioning relative to viewport
            setCoords({
                top: rect.top - 8, // 8px spacing above
                left: rect.left + (rect.width / 2)
            });
            setVisible(true);
        }
    };

    return (
        <>
            <div
                ref={triggerRef}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={() => setVisible(false)}
                className="inline-block"
            >
                {children}
            </div>
            {mounted && visible && createPortal(
                <div
                    className="fixed z-[9999] px-3 py-2 bg-[#87CEEB] text-black text-base rounded shadow-lg pointer-events-none transform -translate-x-1/2 -translate-y-full font-bold"
                    style={{ top: coords.top, left: coords.left }}
                >
                    {content}
                    {/* Arrow */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-[#87CEEB]"></div>
                </div>,
                document.body
            )}
        </>
    );
}

export function KPITable({ items, title, viewType = "department" }: KPITableProps & { viewType?: "department" | "doctor" | "none" | "date-ranking" }) {
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
                            {viewType !== "none" && (
                                <TableHead className="text-white font-bold w-[15%]">
                                    {viewType === "department" ? "科別" :
                                        viewType === "doctor" ? "醫師" :
                                            viewType === "date-ranking" ? "日期" : ""}
                                </TableHead>
                            )}
                            <TableHead className="text-white font-bold w-[15%]">指標值</TableHead>
                            <TableHead className="text-white font-bold w-[42%] whitespace-nowrap">分子(術後 48 小時死亡人次)</TableHead>
                            <TableHead className="text-white font-bold w-[20%] whitespace-nowrap">分母(手術人次)</TableHead>
                            <TableHead className="text-white font-bold w-[8%]">燈號</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.map((item, index) => (
                            <TableRow key={index} className="even:bg-slate-50 even:dark:bg-slate-900/50">
                                {viewType !== "none" && (
                                    <TableCell className="font-medium">
                                        {viewType === "department" ? (
                                            <DrillDownTooltip content="點擊下向鑽取至醫師">
                                                <Link
                                                    href={`?${createQueryString("dept", item.department)}`}
                                                    className="text-blue-600 hover:underline"
                                                >
                                                    {item.department}
                                                </Link>
                                            </DrillDownTooltip>
                                        ) : viewType === "doctor" ? (
                                            item.doctor || "未指定"
                                        ) : viewType === "date-ranking" ? (
                                            item.report_date ? item.report_date.substring(0, 7) : "" // Display YYYY-MM
                                        ) : null}
                                    </TableCell>
                                )}
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
                                <TableCell colSpan={viewType !== "none" ? 5 : 4} className="text-center h-24 text-muted-foreground">無資料</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
