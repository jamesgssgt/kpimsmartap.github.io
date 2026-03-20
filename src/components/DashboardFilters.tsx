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
    showDeptFilter?: boolean;
    showDoctorFilter?: boolean;
}

export function DashboardFilters({
    departments,
    doctors,
    defaultStartDate,
    defaultEndDate,
    showDeptFilter = true,
    showDoctorFilter = true
}: DashboardFiltersProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Init state from URL (or defaults if first load - handled by layout/page usually, but we fallback here)
    const [selectedDepts, setSelectedDepts] = React.useState<string[]>(
        () => searchParams.get("dept")?.split(",").filter(Boolean) || []
    );
    const [selectedDoctors, setSelectedDoctors] = React.useState<string[]>(
        () => searchParams.get("doctor")?.split(",").filter(Boolean) || []
    );

    const [startDate, setStartDate] = React.useState(searchParams.get("startDate") || defaultStartDate || "");
    const [endDate, setEndDate] = React.useState(searchParams.get("endDate") || defaultEndDate || "");

    // Helper to push URL updates
    const updateUrl = React.useCallback((
        newDepts: string[],
        newDocs: string[],
        newStart: string,
        newEnd: string
    ) => {
        const params = new URLSearchParams(searchParams.toString());

        if (newDepts.length > 0) params.set("dept", newDepts.join(","));
        else params.delete("dept");

        if (newDocs.length > 0) params.set("doctor", newDocs.join(","));
        else params.delete("doctor");

        if (newStart) params.set("startDate", newStart);
        else params.delete("startDate");

        if (newEnd) params.set("endDate", newEnd);
        else params.delete("endDate");

        const newQueryString = params.toString();
        // Use replace for smoother filtering, keys don't need history spam typically
        router.replace(`${pathname}?${newQueryString}`);
    }, [searchParams, pathname, router]);

    // 1. Handle Dept/Doctor Changes IMMEDIATELY (No debounce required for selects)
    const handleDeptChange = (depts: string[]) => {
        setSelectedDepts(depts);
        updateUrl(depts, selectedDoctors, startDate, endDate);
    };

    const handleDoctorChange = (docs: string[]) => {
        setSelectedDoctors(docs);
        updateUrl(selectedDepts, docs, startDate, endDate);
    };

    // 2. Handle Date Changes with DEBOUNCE (to avoid flashing URL while typing)
    const handleStartDateChange = (val: string) => {
        setStartDate(val);
    };

    const handleEndDateChange = (val: string) => {
        setEndDate(val);
    };

    // Effect for Date Debounce
    React.useEffect(() => {
        const timer = setTimeout(() => {
            // Only update if dates differ from URL to avoid redundant pushes
            const urlStart = searchParams.get("startDate") || "";
            const urlEnd = searchParams.get("endDate") || "";

            // Check if we actually need to update URL (dates changed locally)
            const needsUpdate = (startDate !== urlStart || endDate !== urlEnd);

            if (needsUpdate) {
                updateUrl(selectedDepts, selectedDoctors, startDate, endDate);
            }
        }, 800);
        return () => clearTimeout(timer);
    }, [startDate, endDate, updateUrl, selectedDepts, selectedDoctors, searchParams]);

    // 3. Sync from URL *inwards* ONLY if URL changed via navigation (e.g. Back button)
    // We compare JSON stringify to avoid loop.
    React.useEffect(() => {
        const urlDepts = searchParams.get("dept")?.split(",").filter(Boolean) || [];
        const urlDoctors = searchParams.get("doctor")?.split(",").filter(Boolean) || [];
        const urlStart = searchParams.get("startDate") || "";
        const urlEnd = searchParams.get("endDate") || "";

        // Only update local state if it drastically differs (external nav)
        // Note: This collision with local state is the usual source of bugs.
        // We defer to URL as source of truth, BUT we must be careful not to overwrite
        // in-progress user editing (dates).
        // Since we debounce dates, instant URL overwrite is bad.
        // Strategy: Only sync Dept/Doc if different. Dates only if not focused? Hard to know focus.
        // Simple strategy: If URL changes, we update. 
        // Logic: dept/doc are instant, so they should match. Dates are debounced.

        if (JSON.stringify(urlDepts) !== JSON.stringify(selectedDepts)) {
            setSelectedDepts(urlDepts);
        }
        if (JSON.stringify(urlDoctors) !== JSON.stringify(selectedDoctors)) {
            setSelectedDoctors(urlDoctors);
        }

        // For Dates, if URL date is "A" and local is "B" (typing), and "B" hasn't pushed yet...
        if (urlStart && urlStart !== startDate) setStartDate(urlStart);
        if (urlEnd && urlEnd !== endDate) setEndDate(urlEnd);
    }, [searchParams]);

    // Force sync defaults when data bounds change (e.g. after data generation and router.refresh)
    React.useEffect(() => {
        if (!searchParams.get("startDate") && defaultStartDate) {
            setStartDate(defaultStartDate);
        }
    }, [defaultStartDate, searchParams]);

    React.useEffect(() => {
        if (!searchParams.get("endDate") && defaultEndDate) {
            setEndDate(defaultEndDate);
        }
    }, [defaultEndDate, searchParams]);

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
                        onChange={(e) => handleStartDateChange(e.target.value)}
                        className="w-[160px]"
                    />
                    <span className="font-medium whitespace-nowrap">～迄：</span>
                    <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => handleEndDateChange(e.target.value)}
                        className="w-[160px]"
                    />
                </div>

                {showDeptFilter && (
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
                )}
                {showDoctorFilter && (
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
                )}

                {(selectedDepts.length > 0 || selectedDoctors.length > 0 || (startDate && startDate !== defaultStartDate) || (endDate && endDate !== defaultEndDate)) && (
                    <button
                        onClick={() => {
                            setSelectedDepts([]);
                            setSelectedDoctors([]);
                            setStartDate(defaultStartDate || "");
                            setEndDate(defaultEndDate || "");
                            updateUrl([], [], defaultStartDate || "", defaultEndDate || "");
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
