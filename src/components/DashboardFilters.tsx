"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { MultiSelect } from "@/components/MultiSelect";
import { Input } from "@/components/ui/input";

interface DashboardFiltersProps {
    departments: string[];
    doctors: { name: string; dept: string }[];
    defaultStartMonth?: string;
    defaultEndMonth?: string;
}

export function DashboardFilters({ departments, doctors, defaultStartMonth, defaultEndMonth }: DashboardFiltersProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [selectedDepts, setSelectedDepts] = React.useState<string[]>(
        () => searchParams.get("dept")?.split(",").filter(Boolean) || []
    );
    const [selectedDoctors, setSelectedDoctors] = React.useState<string[]>(
        () => searchParams.get("doctor")?.split(",").filter(Boolean) || []
    );

    const [startMonth, setStartMonth] = React.useState(searchParams.get("startMonth") || defaultStartMonth || "");
    const [endMonth, setEndMonth] = React.useState(searchParams.get("endMonth") || defaultEndMonth || "");

    // FIX: Sync local state when URL params change externally
    React.useEffect(() => {
        const urlDepts = searchParams.get("dept")?.split(",").filter(Boolean) || [];
        const urlDoctors = searchParams.get("doctor")?.split(",").filter(Boolean) || [];
        const urlStart = searchParams.get("startMonth") || "";
        const urlEnd = searchParams.get("endMonth") || "";

        if (JSON.stringify(urlDepts) !== JSON.stringify(selectedDepts)) setSelectedDepts(urlDepts);
        setSelectedDoctors(urlDoctors);
        if (urlStart !== startMonth) setStartMonth(urlStart);
        if (urlEnd !== endMonth) setEndMonth(urlEnd);
    }, [searchParams]);

    // Sync state with URL
    React.useEffect(() => {
        const timer = setTimeout(() => {
            let finalDepts = [...selectedDepts];

            // 2. Build URL Params
            const params = new URLSearchParams(searchParams.toString());

            if (finalDepts.length > 0) params.set("dept", finalDepts.join(","));
            else params.delete("dept");

            if (selectedDoctors.length > 0) params.set("doctor", selectedDoctors.join(","));
            else params.delete("doctor");

            if (startMonth) params.set("startMonth", startMonth);
            else params.delete("startMonth");

            if (endMonth) params.set("endMonth", endMonth);
            else params.delete("endMonth");

            const newQueryString = params.toString();
            const currentQueryString = searchParams.toString();

            if (newQueryString !== currentQueryString) {
                router.push(`${pathname}?${newQueryString}`);
            }
        }, 800);

        return () => clearTimeout(timer);
    }, [selectedDepts, selectedDoctors, startMonth, endMonth, router, pathname, searchParams]);

    const handleDeptChange = (depts: string[]) => setSelectedDepts(depts);
    const handleDoctorChange = (docs: string[]) => setSelectedDoctors(docs);

    // Filtered options
    const deptOptions = departments.map(d => ({ label: d, value: d }));
    const availableDoctors = selectedDepts.length > 0
        ? doctors.filter(d => selectedDepts.includes(d.dept))
        : doctors;
    const doctorOptions = availableDoctors.map(d => ({ label: d.name, value: d.name }));

    return (
        <div className="flex flex-col gap-4 w-full">
            <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center flex-wrap">
                {/* Filters Row 1 */}
                <div className="flex items-center gap-2">
                    <span className="font-medium whitespace-nowrap">年月區間：</span>
                    <Input
                        type="month"
                        value={startMonth}
                        onChange={(e) => setStartMonth(e.target.value)}
                        className="w-[180px]"
                    />
                    <span>~</span>
                    <Input
                        type="month"
                        value={endMonth}
                        onChange={(e) => setEndMonth(e.target.value)}
                        className="w-[180px]"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <span className="font-medium whitespace-nowrap">科別：</span>
                    <div className="w-[200px]">
                        <MultiSelect
                            options={deptOptions}
                            selected={selectedDepts}
                            onChange={handleDeptChange}
                            placeholder="篩選科別..."
                        />
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="font-medium whitespace-nowrap">醫師：</span>
                    <div className="w-[200px]">
                        <MultiSelect
                            options={doctorOptions}
                            selected={selectedDoctors}
                            onChange={handleDoctorChange}
                            placeholder="篩選醫師..."
                        />
                    </div>
                </div>

                {(selectedDepts.length > 0 || selectedDoctors.length > 0 || startMonth || endMonth) && (
                    <button
                        onClick={() => {
                            setSelectedDepts([]);
                            setSelectedDoctors([]);
                            setStartMonth("");
                            setEndMonth("");
                        }}
                        className="px-4 py-2 bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-md text-sm font-medium transition-colors"
                    >
                        清除全部篩選
                    </button>
                )}
            </div>
        </div>
    );
}
