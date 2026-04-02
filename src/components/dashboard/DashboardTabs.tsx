"use client";

import { cn } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";

interface DashboardTabsProps {
    pinnedIndicators: string[];
    currentIndicator: string;
}

export function DashboardTabs({ pinnedIndicators, currentIndicator }: DashboardTabsProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const handleTabClick = (indicatorName: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('kpi', indicatorName);
        // 重置所有篩選條件，讓各指標套用自己的專屬日期預設值與總覽架構
        params.delete('dept');
        params.delete('doctor');
        params.delete('startDate');
        params.delete('endDate');
        router.push(`?${params.toString()}`);
    };

    if (pinnedIndicators.length <= 1) return null;

    return (
        <div className="flex space-x-2 bg-slate-100 p-1 rounded-lg w-fit mb-6 overflow-x-auto">
            {pinnedIndicators.map((name) => (
                <button
                    key={name}
                    onClick={() => handleTabClick(name)}
                    className={cn(
                        "px-4 py-2 rounded-md text-sm font-bold transition-all whitespace-nowrap",
                        currentIndicator === name
                            ? "bg-white text-indigo-600 shadow-sm"
                            : "text-slate-500 hover:text-slate-700 hover:bg-slate-200"
                    )}
                >
                    {name}
                </button>
            ))}
        </div>
    );
}
