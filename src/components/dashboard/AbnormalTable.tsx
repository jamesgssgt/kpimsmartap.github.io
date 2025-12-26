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

interface AbnormalTableProps {
    items: KPIDetail[];
}

export function AbnormalTable({ items }: AbnormalTableProps) {
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

    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle className="text-lg">術後 48 小時死亡率 (Monthly)異常詳細清單</CardTitle>
            </CardHeader>
            <CardContent className="p-0 sm:p-6">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-[#1f5f7e] hover:bg-[#1f5f7e]">
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
                        {items.map((item, index) => (
                            <TableRow key={index} className="even:bg-slate-50 even:dark:bg-slate-900/50">
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
                                <TableCell colSpan={8} className="text-center h-24 text-muted-foreground">無異常資料</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
