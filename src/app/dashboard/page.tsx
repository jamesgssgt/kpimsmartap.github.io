import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { KPITable } from "@/components/dashboard/KPITable";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { DepartmentChart } from "@/components/dashboard/DepartmentChart";
import { AbnormalTable } from "@/components/dashboard/AbnormalTable";
import { DashboardFilters } from "@/components/DashboardFilters";
import { SignOutButton } from "@/components/SignOutButton";
import { KPIItem, KPIDetail } from "@/types/dashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardPage(props: {
    searchParams: Promise<{ dept?: string; doctor?: string; startDate?: string; endDate?: string }>;
}) {
    try {
        const searchParams = await props.searchParams;
        const supabase = await createClient();

        const getParam = (val: string | string[] | undefined) => {
            if (Array.isArray(val)) return val[0];
            return val;
        };

        const deptParam = getParam(searchParams?.dept);
        const doctorParam = getParam(searchParams?.doctor);
        const startDate = getParam(searchParams?.startDate);
        const endDate = getParam(searchParams?.endDate);

        const deptFilterStr = deptParam ? decodeURIComponent(deptParam) : undefined;
        const doctorFilterStr = doctorParam ? decodeURIComponent(doctorParam) : undefined;
        const deptFilters = deptFilterStr ? deptFilterStr.split(",") : [];
        const doctorFilters = doctorFilterStr ? doctorFilterStr.split(",") : [];

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return redirect("/login");
        }

        // Fetch KPI Summary (Used for filter lists)
        const { data: kpiDataRaw } = await supabase.from("KPI").select("*");
        const { data: detailDataRaw } = await supabase.from("KPI_Detail").select("*");

        let kpiItems: KPIItem[] = kpiDataRaw || [];
        let kpiDetails: KPIDetail[] = detailDataRaw || [];

        // 1. Prepare Filter Options
        const departments = Array.from(new Set(kpiItems.map(item => item.department).filter(Boolean)));
        const doctorsMap = new Map<string, string>();
        kpiItems.forEach(item => {
            if (item.doctor && item.department) doctorsMap.set(item.doctor, item.department);
        });
        const doctors = Array.from(doctorsMap.entries()).map(([name, dept]) => ({ name, dept }));

        // 2. Base Filtering (Dept/Doctor)
        if (deptFilters.length > 0) {
            kpiDetails = kpiDetails.filter(item => deptFilters.includes(item.department));
        }
        if (doctorFilters.length > 0) {
            kpiDetails = kpiDetails.filter(item => doctorFilters.includes(item.doctor));
        }

        // 3. Date Range Logic & Defaults
        const allDates = kpiDetails
            .map(d => d.report_date ? new Date(d.report_date).getTime() : 0)
            .filter(d => d > 0);

        const globalMaxDateTs = allDates.length > 0 ? Math.max(...allDates) : 0;
        const globalMinDateTs = allDates.length > 0 ? Math.min(...allDates) : 0;

        const globalMaxDateStr = globalMaxDateTs > 0 ? new Date(globalMaxDateTs).toISOString().split('T')[0] : "";
        const globalMinDateStr = globalMinDateTs > 0 ? new Date(globalMinDateTs).toISOString().split('T')[0] : "";

        // 4. Apply Date Range Filter to Data
        let filteredDetails = [...kpiDetails];
        if (startDate) {
            filteredDetails = filteredDetails.filter(d => d.report_date && d.report_date >= startDate);
        }
        if (endDate) {
            filteredDetails = filteredDetails.filter(d => d.report_date && d.report_date <= endDate);
        }

        // 5. Find "Latest Day" WITHIN the filtered range
        // If range is 2024-01-01 ~ 2024-01-10, latest day is max date in this range.
        const filteredDates = filteredDetails
            .map(d => d.report_date ? d.report_date : "")
            .filter(Boolean);

        const latestFilteredDateStr = filteredDates.length > 0 ? filteredDates.sort().pop()! : "";

        // 6. Metrics for KPI Table (Cumulative for the Month of the Filter End Date)
        // User request: Same logic as Bar Chart (Cumulative for End Date Month).
        // "收案月份至資料最後一日指標監控"

        const kpiMonthPrefix = endDate ? endDate.substring(0, 7) : globalMaxDateStr.substring(0, 7);
        const kpiRawData = kpiDetails.filter(d =>
            d.report_date && d.report_date.startsWith(kpiMonthPrefix)
        );

        // Aggregate by Dept + Indicator (User didn't strictly say Doctor, but usually KPI is granular. Let's aggregate by Department + Indicator for dashboard view)
        // Or Dept + Doctor + Indicator? The table has NO Doctor column in the view I just saw?
        // Wait, I checked KPITable.tsx: 
        // Columns: Dept, Indicator, Value...
        // NO Doctor column in the file I just read (Step 953).
        // So I should aggregate by Department + Indicator.

        const kpiAggMap = new Map<string, {
            dept: string;
            indicator: string;
            num: number;
            den: number;
            unit: string;
        }>();

        kpiRawData.forEach(item => {
            const key = `${item.department}|${item.indicator_name}`;
            const current = kpiAggMap.get(key) || {
                dept: item.department,
                indicator: item.indicator_name,
                num: 0,
                den: 0,
                unit: item.unit || "%"
            };
            kpiAggMap.set(key, {
                ...current,
                num: current.num + item.numerator,
                den: current.den + item.denominator
            });
        });

        const latestMetrics: KPIDetail[] = Array.from(kpiAggMap.values()).map(agg => {
            const val = agg.den > 0 ? parseFloat(((agg.num / agg.den) * 100).toFixed(2)) : 0;
            return {
                id: "-1", // Dummy ID
                created_at: "",
                department: agg.dept,
                doctor: "", // Aggregated
                indicator_name: agg.indicator,
                indicator_def: "",
                numerator: agg.num,
                denominator: agg.den,
                value: val,
                unit: agg.unit,
                status: val > 0 ? "異常" : "正常", // Simple logic: if mortality > 0 it's "Abnormal" technically? Or just use value check. 
                // Note: Original item.status was per case. 
                // Threshold for mortality is usually 0. But let's set status based on value > 0 for now or "Normal".
                // Actually the user didn't specify threshold. 
                // Logic: If any abnormal existed? Or just Value > 0?
                // Let's assume > 0 is Warning/Abnormal for Mortality.
                patient_id: "",
                patient_gender: "",
                patient_birthday: "",
                report_date: "",
                admission_date: "",
                discharge_date: "",
                op_start: "",
                op_end: "",
                abnormal_reason: ""
            };
        }).sort((a, b) => a.department.localeCompare(b.department)); // Sort by Dept

        // 7. Trend Chart Data (Group by Month - YYYY-MM)
        const trendMap = new Map<string, { sum: number; count: number }>();
        filteredDetails.forEach((item) => {
            if (item.report_date) {
                const key = item.report_date.substring(0, 7); // YYYY-MM
                const current = trendMap.get(key) || { sum: 0, count: 0 };
                trendMap.set(key, {
                    sum: current.sum + item.value,
                    count: current.count + 1,
                });
            }
        });

        const trendData = Array.from(trendMap.entries())
            .map(([date, { sum, count }]) => ({
                date,
                value: count > 0 ? parseFloat(((sum / count) * 100).toFixed(2)) : 0,
            }))
            .sort((a, b) => a.date.localeCompare(b.date));

        // 8. Bar Chart Data (Cumulative for the Month of the Filter End Date)
        // User request: "Recently Month" -> The month of the 'End Date'.
        // Sort: High to Low.

        const targetDateForBar = endDate || globalMaxDateStr;
        const barMonthPrefix = targetDateForBar ? targetDateForBar.substring(0, 7) : ""; // YYYY-MM

        const mortalityName = "術後48小時死亡率"; // Note: DB value is usually without spaces? Checking Generate Data: "術後48小時死亡率" (no spaces)
        // Wait, Generate Data code says: "術後48小時死亡率"
        // But previous code said: "術後 48 小時死亡率" (with spaces). 
        // Let's match flexible or check data. 
        // generate-data.ts Line 266: indicator_name: "術後48小時死亡率"
        // DashboardPage.tsx Line 119: const mortalityName = "術後 48 小時死亡率";
        // This mismatch might explain empty charts before? Or maybe I misread.
        // I will use "術後48小時死亡率" to match generate-data.ts, but standardizing is better.
        // Let's assume generate-data.ts is the source of truth for NEW data.

        // Filter filteredDetails (which is strictly range filtered)? 
        // User said: "迄日當月的累計值". 
        // If the range selected is small (e.g. 1 day), we might miss the rest of the month if we use filteredDetails.
        // We should probably use the FULL 'kpiDetails' (base filtered by dept/doctor) and filter by Month Prefix of EndDate.

        const barRawData = kpiDetails.filter(d =>
            d.indicator_name.replace(/\s/g, "") === "術後48小時死亡率" && // Normalize spaces
            d.report_date && d.report_date.startsWith(barMonthPrefix)
        );

        const deptBarMap = new Map<string, { num: number; den: number }>();
        barRawData.forEach(item => {
            const current = deptBarMap.get(item.department) || { num: 0, den: 0 };
            deptBarMap.set(item.department, {
                num: current.num + item.numerator,
                den: current.den + item.denominator
            });
        });

        const barChartData = Array.from(deptBarMap.entries())
            .map(([department, { num, den }]) => ({
                department,
                value: den > 0 ? parseFloat(((num / den) * 100).toFixed(2)) : 0
            }))
            .sort((a, b) => b.value - a.value); // Descending Sort

        // 9. Abnormal Items (Latest within filtered range)
        const abnormalItems = latestMetrics.filter((item) => item.status === "異常");

        return (
            <div className="flex-1 space-y-4 p-4 pt-[5px]">
                {/* Header & Filters */}
                <div className="space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between space-y-2 md:space-y-0">
                        <h2 className="text-2xl font-bold tracking-tight">KPIM Dashboard</h2>
                        <div className="flex items-center space-x-2">
                            <span className="text-sm text-muted-foreground mr-2 hidden md:inline-block">{user.email}</span>
                            <SignOutButton />
                        </div>
                    </div>
                    <div className="flex justify-start w-full">
                        <DashboardFilters
                            departments={departments}
                            doctors={doctors}
                            defaultStartDate={globalMinDateStr}
                            defaultEndDate={globalMaxDateStr}
                        />
                    </div>
                </div>

                <div className="space-y-8">
                    {/* TOP: KPI Table (Latest Day Metric) */}
                    <div className="space-y-4">
                        <KPITable
                            items={latestMetrics}
                            title={`[指標儀表板] 收案月份至資料最後一日指標監控 (${latestFilteredDateStr || "無資料"})`}
                        />
                    </div>

                    {/* MIDDLE: Charts Section */}
                    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-7">
                        {/* Trend Chart (Left) - Uses Date Range Filter */}
                        <div className="col-span-1 md:col-span-2 lg:col-span-4">
                            <TrendChart data={trendData} title="指標趨勢 (月統計) 區間年月" />
                        </div>

                        {/* Bar Chart (Right) - Uses Latest Day */}
                        <div className="col-span-1 md:col-span-2 lg:col-span-3">
                            <DepartmentChart data={barChartData} title="最近一月 術後 48 小時死亡率" />
                        </div>
                    </div>
                </div>

                {/* BOTTOM: Abnormal Table */}
                <div className="space-y-4">
                    <AbnormalTable items={abnormalItems} />
                </div>
            </div>

        );

    } catch (error) {
        console.error("Dashboard Page Error:", error);
        return (
            <div className="p-8 text-center">
                <h2 className="text-xl font-bold text-red-600">載入儀表板時發生錯誤</h2>
                <div className="mt-4 p-4 bg-slate-100 rounded text-left overflow-auto max-w-2xl mx-auto">
                    <code className="text-xs">{String(error)}</code>
                </div>
            </div>
        );
    }
}
