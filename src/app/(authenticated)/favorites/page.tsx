
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

export default async function FavoritesPage(props: {
    searchParams: Promise<{ startDate?: string; endDate?: string }>;
}) {
    try {
        const searchParams = await props.searchParams;
        const supabase = await createClient();

        const getParam = (val: string | string[] | undefined) => {
            if (Array.isArray(val)) return val[0];
            return val;
        };

        const startDate = getParam(searchParams?.startDate);
        const endDate = getParam(searchParams?.endDate);

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return redirect("/login");
        }

        // --- ACCOUNT MAPPING LOGIC ---
        // Joseph -> 李醫師
        let targetDoctor = "";
        if (user.email === "joseph@kpim.com") {
            targetDoctor = "李醫師";
        } else {
            // Fallback or handle other users
            // For now, if not joseph, maybe show nothing or generic
        }

        // Fetch Data
        const { data: kpiDataRaw } = await supabase.from("KPI").select("*");
        const { data: detailDataRaw } = await supabase.from("KPI_Detail").select("*");

        let kpiItems: KPIItem[] = kpiDataRaw || [];
        let kpiDetails: KPIDetail[] = detailDataRaw || [];

        // 1. Filter by Target Doctor (My Favorites = My Data)
        if (targetDoctor) {
            kpiDetails = kpiDetails.filter(d => d.doctor === targetDoctor);
        }

        // 2. Filter by Specific Indicator "術後48小時死亡率" (Based on User Title Request)
        const targetIndicator = "術後48小時死亡率";
        kpiDetails = kpiDetails.filter(d => d.indicator_name.replace(/\s/g, "") === targetIndicator);

        // 3. Date Range Logic
        const allDates = kpiDetails
            .map(d => d.report_date ? new Date(d.report_date).getTime() : 0)
            .filter(d => d > 0);

        const globalMaxDateTs = allDates.length > 0 ? Math.max(...allDates) : 0;
        const globalMinDateTs = allDates.length > 0 ? Math.min(...allDates) : 0;

        const globalMaxDateStr = globalMaxDateTs > 0 ? new Date(globalMaxDateTs).toISOString().split('T')[0] : "";
        const globalMinDateStr = globalMinDateTs > 0 ? new Date(globalMinDateTs).toISOString().split('T')[0] : "";

        // Filters applied to details
        let filteredDetails = [...kpiDetails];
        if (startDate) {
            filteredDetails = filteredDetails.filter(d => d.report_date && d.report_date >= startDate);
        }
        if (endDate) {
            filteredDetails = filteredDetails.filter(d => d.report_date && d.report_date <= endDate);
        }

        // Find Latest Date for Title
        const filteredDates = filteredDetails
            .map(d => d.report_date ? d.report_date : "")
            .filter(Boolean);
        const latestFilteredDateStr = filteredDates.length > 0 ? filteredDates.sort().pop()! : globalMaxDateStr;
        const displayDate = latestFilteredDateStr ? latestFilteredDateStr.split('T')[0] : (new Date().toISOString().split('T')[0]);

        // 4. Metrics Calculation (Single Row for this Doctor)
        // Similar to Dashboard Drilled view
        const kpiMonthPrefix = endDate ? endDate.substring(0, 7) : globalMaxDateStr.substring(0, 7);
        const kpiRawData = kpiDetails.filter(d =>
            d.report_date && d.report_date.startsWith(kpiMonthPrefix)
        );

        let num = 0;
        let den = 0;
        let unit = "%";

        kpiRawData.forEach(item => {
            num += item.numerator;
            den += item.denominator;
            if (item.unit) unit = item.unit;
        });

        const val = den > 0 ? parseFloat(((num / den) * 100).toFixed(2)) : 0;

        const latestMetrics: KPIDetail[] = [{
            id: "favorites-1",
            department: "骨科", // Hardcoded or derived
            doctor: targetDoctor,
            indicator_name: "術後 48 小時死亡率",
            numerator: num,
            denominator: den,
            value: val,
            unit: unit,
            status: val > 0 ? "異常" : "正常",
            patient_id: "",
            patient_gender: "",
            patient_birthday: "",
            report_date: "",
            admission_date: "",
            discharge_date: "",
            op_start: "",
            op_end: "",
            abnormal_reason: ""
        }];

        // 5. Monthly Aggregation for Ranking Table (Top 4 by Mortality Rate)
        const monthlyStatsMap = new Map<string, { num: number; den: number; unit: string }>();
        const trendMap = new Map<string, { sum: number; count: number }>();

        filteredDetails.forEach((item) => {
            if (item.report_date) {
                const key = item.report_date.substring(0, 7); // YYYY-MM

                // For Ranking Table (Aggregated sums per month)
                const currentMonth = monthlyStatsMap.get(key) || { num: 0, den: 0, unit: "%" };
                monthlyStatsMap.set(key, {
                    num: currentMonth.num + item.numerator,
                    den: currentMonth.den + item.denominator,
                    unit: item.unit || "%"
                });

                // For Trend Map (Average of values - existing logic kept for consistency if needed, but we typically plot the aggregated rate now)
                // Actually, for the Trend Chart, it usually plots the calculated rate per point in time. 
                // Using the same aggregated logic for consistency is better.
                // Let's reuse monthlyStatsMap for TrendData to strictly match.
            }
        });

        // Create Monthly Items for Table
        const monthlyItems: KPIDetail[] = Array.from(monthlyStatsMap.entries())
            .map(([date, stats]) => {
                const val = stats.den > 0 ? parseFloat(((stats.num / stats.den) * 100).toFixed(2)) : 0;
                return {
                    id: `monthly-${date}`,
                    department: "骨科",
                    doctor: targetDoctor,
                    indicator_name: "術後 48 小時死亡率",
                    numerator: stats.num,
                    denominator: stats.den,
                    value: val,
                    unit: stats.unit,
                    status: val > 0 ? "異常" : "正常",
                    patient_id: "",
                    report_date: date, // YYYY-MM
                } as KPIDetail;
            })
            .sort((a, b) => b.value - a.value) // Sort by Value Descending (High to Low)
            .slice(0, 4); // Top 4

        // Create Trend Data (Sorted by Date Ascending)
        const trendData = Array.from(monthlyStatsMap.entries())
            .map(([date, stats]) => {
                const val = stats.den > 0 ? parseFloat(((stats.num / stats.den) * 100).toFixed(2)) : 0;
                return {
                    date,
                    value: val
                };
            })
            .sort((a, b) => a.date.localeCompare(b.date));


        // 6. Abnormal Items (Keep existing logic)
        const abnormalItems = kpiRawData
            .filter((item) => item.status === "異常")
            .sort((a, b) => {
                if (a.report_date && b.report_date) return new Date(b.report_date).getTime() - new Date(a.report_date).getTime();
                return 0;
            });

        return (
            <div className="flex-1 space-y-4 p-4 pt-[5px]">
                <div className="space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between space-y-2 md:space-y-0">
                        <h2 className="text-2xl font-bold tracking-tight">My Favorites</h2>
                        <div className="flex items-center space-x-2">
                            <span className="text-sm text-muted-foreground mr-2 hidden md:inline-block">{user.email}</span>
                            <SignOutButton />
                        </div>
                    </div>
                    <div className="flex justify-start w-full">
                        <DashboardFilters
                            departments={[]} // No options needed
                            doctors={[]} // No options needed
                            defaultStartDate={globalMinDateStr}
                            defaultEndDate={globalMaxDateStr}
                            showDeptFilter={false}
                            showDoctorFilter={false}
                        />
                    </div>
                </div>

                <div className="space-y-8">
                    {/* KPI Table - Monthly Ranking */}
                    <div className="space-y-4">
                        <KPITable
                            items={monthlyItems}
                            title={`指標監控-術後 48 小時死亡率-月監控資料最後一日(${displayDate})`}
                            viewType="date-ranking"
                        />
                    </div>

                    {/* Charts - Trend Only */}
                    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-7">
                        <div className="col-span-1 md:col-span-2 lg:col-span-7"> {/* Expanded to full width */}
                            <TrendChart data={trendData} title="指標趨勢 (月統計)" />
                        </div>
                    </div>

                    {/* Abnormal Table */}
                    <div className="space-y-4">
                        <AbnormalTable items={abnormalItems} />
                    </div>
                </div>
            </div>
        );

    } catch (error) {
        console.error("Favorites Page Error:", error);
        return (
            <div className="p-8 text-center">
                <h2 className="text-xl font-bold text-red-600">載入頁面時發生錯誤</h2>
                <div className="mt-4 p-4 bg-slate-100 rounded text-left overflow-auto max-w-2xl mx-auto">
                    <code className="text-xs">{String(error)}</code>
                </div>
            </div>
        );
    }
}
