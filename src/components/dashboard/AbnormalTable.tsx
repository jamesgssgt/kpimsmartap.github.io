"use client";

import { useState } from "react";
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
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface AbnormalTableProps {
    items: KPIDetail[];
    title: string;
}

const ITEMS_PER_PAGE = 5;

export function AbnormalTable({ items, title }: AbnormalTableProps) {
    const [currentPage, setCurrentPage] = useState(1);

    const calculateAge = (birthday?: string) => {
        if (!birthday) return null;
        const birthDate = new Date(birthday);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    };

    const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
    const paginatedItems = items.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const handlePrevious = () => {
        setCurrentPage((prev) => Math.max(prev - 1, 1));
    };

    const handleNext = () => {
        setCurrentPage((prev) => Math.min(prev + 1, totalPages));
    };

    return (
        <Card className="h-full">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{title}</CardTitle>
                    {items.length > 0 && (
                        <span className="text-sm text-slate-500">
                            共 {items.length} 筆
                        </span>
                    )}
                </div>
            </CardHeader>
            <CardContent className="p-0 sm:p-6">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-[#1f5f7e] hover:bg-[#1f5f7e]">
                            <TableHead className="text-white font-bold w-[60px]">序號</TableHead>
                            <TableHead className="text-white font-bold">科別</TableHead>
                            <TableHead className="text-white font-bold">醫師</TableHead>
                            <TableHead className="text-white font-bold">病患代碼</TableHead>
                            <TableHead className="text-white font-bold">性別</TableHead>
                            <TableHead className="text-white font-bold">年齡</TableHead>
                            <TableHead className="text-white font-bold">入院時間</TableHead>
                            <TableHead className="text-white font-bold">出院時間</TableHead>
                            <TableHead className="text-white font-bold">手術完成時間</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedItems.map((item, index) => (
                            <TableRow key={index} className="even:bg-slate-50 even:dark:bg-slate-900/50">
                                <TableCell className="font-mono text-slate-500">
                                    {(currentPage - 1) * ITEMS_PER_PAGE + index + 1}
                                </TableCell>
                                <TableCell>{item.department}</TableCell>
                                <TableCell>{item.doctor}</TableCell>
                                <TableCell className="font-mono text-xs">{item.patient_id}</TableCell>
                                <TableCell>{item.patient_gender === 'male' ? '男' : item.patient_gender === 'female' ? '女' : item.patient_gender || '-'}</TableCell>
                                <TableCell>{calculateAge(item.patient_birthday) ?? item.patient_age ?? '-'}</TableCell>
                                <TableCell>
                                    {item.admission_date ? new Date(item.admission_date).toLocaleDateString('zh-TW', {
                                        year: 'numeric',
                                        month: '2-digit',
                                        day: '2-digit'
                                    }) : '-'}
                                </TableCell>
                                <TableCell>
                                    {item.discharge_date ? new Date(item.discharge_date).toLocaleDateString('zh-TW', {
                                        year: 'numeric',
                                        month: '2-digit',
                                        day: '2-digit'
                                    }) : '-'}
                                </TableCell>
                                <TableCell className="font-medium">
                                    {item.op_end ? new Date(item.op_end).toLocaleString('zh-TW', {
                                        year: 'numeric',
                                        month: '2-digit',
                                        day: '2-digit',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        hour12: false
                                    }) : '-'}
                                </TableCell>
                            </TableRow>
                        ))}
                        {items.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={9} className="text-center h-24 text-muted-foreground">無異常資料</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>

                {totalPages > 1 && (
                    <div className="flex items-center justify-center space-x-2 py-4 px-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handlePrevious}
                            disabled={currentPage === 1}
                        >
                            <ChevronLeft className="h-4 w-4" />
                            上一頁
                        </Button>
                        <div className="text-sm font-medium">
                            頁次 {currentPage} / {totalPages}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleNext}
                            disabled={currentPage === totalPages}
                        >
                            下一頁
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
