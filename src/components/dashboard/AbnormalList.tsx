import { KPIDetail } from "@/types/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

interface AbnormalListProps {
    items: KPIDetail[];
}

export function AbnormalList({ items }: AbnormalListProps) {
    return (
        <Card className="col-span-1 h-full min-h-[350px] overflow-hidden">
            <CardHeader className="flex flex-row items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <CardTitle>異常警示</CardTitle>
            </CardHeader>
            <CardContent className="overflow-auto max-h-[300px]">
                <div className="space-y-4">
                    {items.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">無異常資料</p>
                    ) : (
                        items.map((item, i) => (
                            <div
                                key={i}
                                className="flex items-center justify-between space-x-4 rounded-md border p-3 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <div className="space-y-1">
                                    <p className="text-sm font-medium leading-none">
                                        {item.indicator_name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {item.department} | {item.doctor}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        病患: {item.patient_id}
                                    </p>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <span className="text-red-500 font-bold text-sm">
                                        {item.value} {item.unit}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {new Date(item.report_date).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
