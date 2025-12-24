"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { MultiSelect } from "@/components/MultiSelect";

interface DashboardFiltersProps {
    departments: string[];
    doctors: { name: string; dept: string }[];
}

export function DashboardFilters({ departments, doctors }: DashboardFiltersProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [selectedDepts, setSelectedDepts] = React.useState<string[]>(
        () => searchParams.get("dept")?.split(",").filter(Boolean) || []
    );
    const [selectedDoctors, setSelectedDoctors] = React.useState<string[]>(
        () => searchParams.get("doctor")?.split(",").filter(Boolean) || []
    );

    // FIX: Sync local state when URL params change externally (e.g. from KPITable click)
    React.useEffect(() => {
        const urlDepts = searchParams.get("dept")?.split(",").filter(Boolean) || [];
        const urlDoctors = searchParams.get("doctor")?.split(",").filter(Boolean) || [];

        // Update local state if URL differs from current state
        // We use JSON.stringify for simple array comparison
        if (JSON.stringify(urlDepts) !== JSON.stringify(selectedDepts)) {
            setSelectedDepts(urlDepts);
        }
        setSelectedDoctors(urlDoctors);
    }, [searchParams]);

    // Sync state with URL and Linked Logic
    React.useEffect(() => {
        const timer = setTimeout(() => {
            let finalDepts = [...selectedDepts];

            // 1. Sync Logic: REMOVED as per user request ("不要連動版本")
            // If doctors are selected, we do NOT automatically select their departments anymore.

            /* 
            if (selectedDoctors.length > 0) {
                // ... logic removed ...
            } 
            */

            // 2. Build URL Params
            const params = new URLSearchParams(searchParams.toString());

            if (finalDepts.length > 0) {
                params.set("dept", finalDepts.join(","));
            } else {
                params.delete("dept");
            }

            if (selectedDoctors.length > 0) {
                params.set("doctor", selectedDoctors.join(","));
            } else {
                params.delete("doctor");
            }

            const newQueryString = params.toString();
            const currentQueryString = searchParams.toString();

            // Only push if query changed to prevent redundant dynamic routing
            if (newQueryString !== currentQueryString) {
                router.push(`${pathname}?${newQueryString}`);
            }
        }, 1000); // 1 second delay to allow multiple selections

        return () => clearTimeout(timer);
    }, [selectedDepts, selectedDoctors, router, pathname, searchParams, doctors]);

    const handleDeptChange = (depts: string[]) => {
        setSelectedDepts(depts);
    };

    const handleDoctorChange = (docs: string[]) => {
        setSelectedDoctors(docs);
    };

    // Filtered options
    const deptOptions = departments.map(d => ({ label: d, value: d }));

    // Filter doctor options based on selected departments
    const availableDoctors = selectedDepts.length > 0
        ? doctors.filter(d => selectedDepts.includes(d.dept))
        : doctors;

    const doctorOptions = availableDoctors.map(d => ({ label: d.name, value: d.name }));

    return (
        <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
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

            {(selectedDepts.length > 0 || selectedDoctors.length > 0) && (
                <button
                    onClick={() => {
                        setSelectedDepts([]);
                        setSelectedDoctors([]);
                    }}
                    className="px-4 py-2 bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-md text-sm font-medium transition-colors"
                >
                    清除全部篩選
                </button>
            )}
        </div >
    );
}
