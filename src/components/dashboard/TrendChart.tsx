"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend, ReferenceLine } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TrendData {
    date: string;
    value: number;
}

interface TrendChartProps {
    data: TrendData[];
    title?: string;
    upperLimit?: number;
    lowerLimit?: number;
}

export function TrendChart({ data, title = "術後 48 小時死亡率 (Monthly)", upperLimit = 4.2, lowerLimit = 2.0 }: TrendChartProps) {
    return (
        <Card className="col-span-1 min-h-[350px]">
            <CardHeader>
                <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent className="pl-2">
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={data} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
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
                            tickFormatter={(value) => `${value}%`}
                            domain={[0, 6]}
                        />
                        <Tooltip
                            formatter={(value: any) => [`${value}%`, "指標值"]}
                            contentStyle={{ background: 'rgba(135, 206, 235, 0.2)', border: 'none', borderRadius: '4px' }}
                            labelStyle={{ color: '#1f5f7e', fontWeight: 'bold' }}
                            itemStyle={{ color: '#1f5f7e' }}
                        />

                        {/* Upper Limit (Dashed) */}
                        <ReferenceLine
                            y={upperLimit}
                            stroke="#f97316" // Orange
                            strokeDasharray="3 3"
                            label={{ position: 'insideBottomRight', value: '上限', fill: '#f97316', fontSize: 12 }}
                        />

                        {/* Lower Limit (Dashed) */}
                        <ReferenceLine
                            y={lowerLimit}
                            stroke="#22c55e" // Green
                            strokeDasharray="3 3"
                            label={{ position: 'insideBottomRight', value: '下限', fill: '#22c55e', fontSize: 12 }}
                        />

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
                    </LineChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
