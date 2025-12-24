import { KPIItem } from "@/types/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUp, ArrowDown, Activity } from "lucide-react";

interface KPICardsProps {
    items: KPIItem[];
}

export function KPICards({ items }: KPICardsProps) {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {items.map((item, index) => (
                <Card key={index} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            {item.indicator_name}
                        </CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold flex items-center">
                            {item.value}
                            <span className="text-sm font-normal text-muted-foreground ml-1">{item.unit}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {item.doctor} | {item.department}
                        </p>
                        <div className="flex items-center space-x-2 mt-2 text-xs">
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">
                                Num: {item.numerator}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">
                                Den: {item.denominator}
                            </span>
                            <span className={`inline-block w-2 h-2 rounded-full ${item.value > 0 ? 'bg-red-500' : 'bg-green-500'}`}></span>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
