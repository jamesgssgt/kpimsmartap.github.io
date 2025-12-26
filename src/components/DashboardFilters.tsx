"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { MultiSelect } from "@/components/MultiSelect";
import { Input } from "@/components/ui/input";

interface DashboardFiltersProps {
    departments: string[];
    doctors: { name: string; dept: string }[];
    defaultStartDate?: string;
    defaultEndDate?: string;
}

export function DashboardFilters({ departments, doctors, defaultStartDate, defaultEndDate }: DashboardFiltersProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [selectedDepts, setSelectedDepts] = React.useState<string[]>(
        () => searchParams.get("dept")?.split(",").filter(Boolean) || []
    );
    const [selectedDoctors, setSelectedDoctors] = React.useState<string[]>(
        () => searchParams.get("doctor")?.split(",").filter(Boolean) || []
    );

    const [startDate, setStartDate] = React.useState(searchParams.get("startDate") || defaultStartDate || "");
    const [endDate, setEndDate] = React.useState(searchParams.get("endDate") || defaultEndDate || "");

    const isInitialized = React.useRef(false);

    // FIX: Sync local state when URL params change externally
    React.useEffect(() => {
        const urlDepts = searchParams.get("dept")?.split(",").filter(Boolean) || [];
        const urlDoctors = searchParams.get("doctor")?.split(",").filter(Boolean) || [];

        // Remove fallback to default props here. 
        // If param is missing, it's empty string (Clear action or Back button to empty).
        const urlStart = searchParams.get("startDate") || "";
        const urlEnd = searchParams.get("endDate") || "";

        // Protect initial default state from being wiped by empty URL on first load
        if (!isInitialized.current) {
            isInitialized.current = true;
            // If URL is completely empty associated to dates, keep the default state (from useState)
            if (!searchParams.has("startDate") && !searchParams.has("endDate")) {
                // However, we MUST sync other params like Dept/Doctor if they exist
                if (JSON.stringify(urlDepts) !== JSON.stringify(selectedDepts)) setSelectedDepts(urlDepts);
                setSelectedDoctors(urlDoctors);
                return;
            }
        }

        if (JSON.stringify(urlDepts) !== JSON.stringify(selectedDepts)) setSelectedDepts(urlDepts);
        setSelectedDoctors(urlDoctors);

        // Only update if different to avoid loops, but ensure we respect default if URL is empty
        if (urlStart !== startDate) setStartDate(urlStart);
        if (urlEnd !== endDate) setEndDate(urlEnd);
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

            if (startDate) params.set("startDate", startDate);
            else params.delete("startDate");

            if (endDate) params.set("endDate", endDate);
            else params.delete("endDate");

            const newQueryString = params.toString();
            const currentQueryString = searchParams.toString();

            if (newQueryString !== currentQueryString) {
                router.push(`${pathname}?${newQueryString}`);
            }
        }, 800);

        return () => clearTimeout(timer);
    }, [selectedDepts, selectedDoctors, startDate, endDate, router, pathname, searchParams]);

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
                    <span className="font-medium whitespace-nowrap">日期起：</span>
                    <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-[160px]"
                    />
                    <span className="font-medium whitespace-nowrap">～迄：</span>
                    <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-[160px]"
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

                {(selectedDepts.length > 0 || selectedDoctors.length > 0 || startDate || endDate) && (
                    <button
                        onClick={() => {
                            setSelectedDepts([]);
                            setSelectedDoctors([]);
                            setStartDate("");
                            setEndDate("");
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
