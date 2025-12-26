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
    searchParams: Promise<{ dept?: string; doctor?: string; startMonth?: string; endMonth?: string }>;
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
        const startMonth = getParam(searchParams?.startMonth);
        const endMonth = getParam(searchParams?.endMonth);

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

        // 3. Date Logic (Month Based)
        const allMonths = kpiDetails
            .map(d => d.report_date ? d.report_date.substring(0, 7) : "")
            .filter(Boolean);

        // Find Min/Max Month strings
        let minMonthStr = "";
        let maxMonthStr = "";

        if (allMonths.length > 0) {
            allMonths.sort();
            minMonthStr = allMonths[0];
            maxMonthStr = allMonths[allMonths.length - 1];
        }

        // Find absolute latest date string (YYYY-MM-DD) for Latest Metrics
        const allFullDates = kpiDetails
            .map(d => d.report_date ? d.report_date : "")
            .filter(Boolean);
        const maxDateStrFull = allFullDates.length > 0 ? allFullDates.sort().pop()! : "";

        // 4. Latest Day Metrics (for KPITable)
        // Filter details where report_date matches maxDateStrFull
        const latestMetrics = kpiDetails.filter(d => d.report_date === maxDateStrFull);

        // 5. Trend Chart Data (Filtered by Month Range)
        let trendDetails = [...kpiDetails];
        if (startMonth) {
            trendDetails = trendDetails.filter(d => d.report_date && d.report_date.substring(0, 7) >= startMonth);
        }
        if (endMonth) {
            trendDetails = trendDetails.filter(d => d.report_date && d.report_date.substring(0, 7) <= endMonth);
        }

        const trendMap = new Map<string, { sum: number; count: number }>();
        trendDetails.forEach((item) => {
            if (item.report_date) {
                // Group by Month (YYYY-MM)
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

        // 6. Bar Chart Data (Latest Day, Mortality, Group by Dept)
        // Filter for specific indicator: "術後 48 小時死亡率"
        const mortalityName = "術後 48 小時死亡率";
        const barRawData = latestMetrics.filter(d => d.indicator_name === mortalityName);

        // Group by Dept and Average
        const deptBarMap = new Map<string, { sum: number; count: number }>();
        barRawData.forEach(item => {
            const current = deptBarMap.get(item.department) || { sum: 0, count: 0 };
            deptBarMap.set(item.department, {
                sum: current.sum + item.value,
                count: current.count + 1
            });
        });

        const barChartData = Array.from(deptBarMap.entries()).map(([department, { sum, count }]) => ({
            department,
            value: count > 0 ? parseFloat((sum / count).toFixed(2)) : 0
        }));

        // 7. Abnormal Items (from Latest Day)
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
                            defaultStartMonth={minMonthStr}
                            defaultEndMonth={maxMonthStr}
                        />
                    </div>
                </div>

                <div className="space-y-8">
                    {/* Charts Section */}
                    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-7">
                        {/* Trend Chart (Left) - Uses Date Range Filter */}
                        <div className="col-span-1 md:col-span-2 lg:col-span-4">
                            <TrendChart data={trendData} title="指標趨勢 (依篩選區間)" />
                        </div>

                        {/* Bar Chart (Right) - Uses Latest Day */}
                        <div className="col-span-1 md:col-span-2 lg:col-span-3">
                            <DepartmentChart data={barChartData} title={`最新一日 (${maxDateStrFull}) 術後 48 小時死亡率`} />
                        </div>
                    </div>

                    {/* Tables Section (Bottom) - Latest Day Data */}
                    <div className="space-y-4">
                        {/* KPI Table (Latest Metrics) */}
                        <KPITable items={latestMetrics} />

                        {/* Abnormal Table */}
                        <AbnormalTable items={abnormalItems} />
                    </div>
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
