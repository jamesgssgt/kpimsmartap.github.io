"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TrendData {
    date: string;
    value: number;
}

interface TrendChartProps {
    data: TrendData[];
    title?: string;
}

export function TrendChart({ data, title = "術後 48 小時死亡率 (Monthly)" }: TrendChartProps) {
    return (
        <Card className="col-span-1 min-h-[350px]">
            <CardHeader>
                <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent className="pl-2">
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} vertical={false} />
                        <XAxis
                            dataKey="date"
                            stroke="#888888"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            stroke="#888888"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => `${value}`}
                            domain={[0, 6]} // Fixed domain for better visualization matching image
                        />
                        <Tooltip
                            contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                            labelStyle={{ color: 'hsl(var(--foreground))' }}
                        />
                        <Legend />
                        {/* Main Indicator Line */}
                        <Line
                            type="monotone"
                            dataKey="value"
                            stroke="#1f5f7e" // Dark Blue
                            strokeWidth={3}
                            name="指標值"
                            activeDot={{ r: 8 }}
                            dot={{ r: 4 }}
                        />
                        {/* Upper Limit (Mock Data for Viz) */}
                        <Line
                            type="monotone"
                            dataKey={() => 4.2} // Static value for viz
                            stroke="#f97316" // Orange
                            strokeWidth={2}
                            name="上限"
                            dot={false}
                            activeDot={false}
                        />
                        {/* Lower Limit (Mock Data for Viz) */}
                        <Line
                            type="monotone"
                            dataKey={() => 2.0} // Static value for viz
                            stroke="#22c55e" // Green
                            strokeWidth={2}
                            name="下限"
                            dot={false}
                            activeDot={false}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
