"use client";

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ChartData {
    department: string;
    value: number;
}

interface DepartmentChartProps {
    data: ChartData[];
    title?: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

export function DepartmentChart({ data, title = "各科別指標數值" }: DepartmentChartProps) {
    return (
        <Card className="col-span-1 min-h-[350px]">
            <CardHeader>
                <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent className="pl-0">
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} opacity={0.3} />
                        <XAxis type="number" hide />
                        <YAxis
                            dataKey="department"
                            type="category"
                            width={100}
                            tick={{ fontSize: 12 }}
                            tickLine={false}
                            axisLine={false}
                        />
                        <Tooltip
                            contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                            labelStyle={{ color: 'hsl(var(--foreground))' }}
                            cursor={{ fill: 'transparent' }}
                        />
                        <Bar dataKey="value" name="指標值" radius={[0, 4, 4, 0]} barSize={30}>
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
