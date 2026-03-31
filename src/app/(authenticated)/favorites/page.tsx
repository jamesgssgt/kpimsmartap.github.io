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
        let targetDoctor = "";
        const { data: favData } = await supabase.from("favorites").select("doctor").eq("user_id", user.id).single();
        if (favData) {
            targetDoctor = favData.doctor;
        }
        if (!targetDoctor) {
            if (user.email === "joseph@kpim.com") targetDoctor = "李醫師";
            else if (user.email === "user_test@kpim.com") targetDoctor = "劉醫師";
        }

        // Fetch Data
        const { data: kpiDataRaw } = await supabase.from("KPI").select("*");
        
        // Target: 手術後 48 小時內死亡率
        const targetIndName = "手術後 48 小時內死亡率";
        const { data: targetKpiDef } = await supabase.from("kpi_definitions").select("kpiid, formula").eq("name", targetIndName).single();
        const targetKpiId = targetKpiDef?.kpiid;

        const { data: detailDataRaw } = await supabase
            .from("kpi_detail")
            .select("*")
            .eq("kpi_id", targetKpiId);

        let kpiItems: KPIItem[] = kpiDataRaw || [];
        
        // Map to KPIDetail interface
        let kpiDetails: KPIDetail[] = (detailDataRaw || []).map(d => ({
            id: d.id,
            department: d.department,
            doctor: d.doctor_name,
            indicator_name: targetIndName,
            numerator: d.numerator_value,
            denominator: d.denominator_value,
            value: d.kpi_value,
            unit: "%",
            status: d.kpi_value > 0 ? "異常" : "正常",
            patient_id: d.patient_id,
            patient_gender: d.patient_gender,
            patient_birthday: d.patient_birth_date,
            report_date: d.data_date,
            admission_date: "",
            discharge_date: "",
            op_start: "",
            op_end: "",
            abnormal_reason: ""
        }));

        // 1. Filter by Target Doctor
        if (targetDoctor) {
            kpiDetails = kpiDetails.filter(d => d.doctor === targetDoctor);
        }

        // 3. Date Range Logic
        const allDates = kpiDetails
            .map(d => d.report_date ? new Date(d.report_date).getTime() : 0)
            .filter(d => d > 0);

        const globalMaxDateTs = allDates.length > 0 ? Math.max(...allDates) : 0;
        const globalMaxDateStr = globalMaxDateTs > 0 ? new Date(globalMaxDateTs).toISOString().split('T')[0] : "";
        const globalMinDateStr = globalMaxDateTs > 0 ? "2026-01-01" : "";

        let filteredDetails = [...kpiDetails];
        if (startDate) {
            filteredDetails = filteredDetails.filter(d => d.report_date && d.report_date >= startDate);
        }
        if (endDate) {
            filteredDetails = filteredDetails.filter(d => d.report_date && d.report_date <= endDate);
        }

        const displayDate = globalMaxDateStr;

        // Metrics for the Header
        let num = 0;
        let den = 0;
        filteredDetails.forEach(item => {
            num += item.numerator;
            den += item.denominator;
        });
        const val = den > 0 ? parseFloat(((num / den) * 100).toFixed(2)) : 0;

        const latestMetrics: KPIDetail[] = [{
            id: "favorites-1",
            department: "骨科",
            doctor: targetDoctor,
            indicator_name: targetIndName,
            numerator: num,
            denominator: den,
            value: val,
            unit: "%",
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

        // Trend and Table Data
        const monthlyStatsMap = new Map<string, { num: number; den: number }>();
        filteredDetails.forEach((item) => {
            if (item.report_date) {
                const key = item.report_date.substring(0, 7);
                const currentMonth = monthlyStatsMap.get(key) || { num: 0, den: 0 };
                monthlyStatsMap.set(key, {
                    num: currentMonth.num + item.numerator,
                    den: currentMonth.den + item.denominator
                });
            }
        });

        const monthlyItems: KPIDetail[] = Array.from(monthlyStatsMap.entries())
            .map(([date, stats]) => {
                const val = stats.den > 0 ? parseFloat(((stats.num / stats.den) * 100).toFixed(2)) : 0;
                return {
                    id: `monthly-${date}`,
                    department: "骨科",
                    doctor: targetDoctor,
                    indicator_name: targetIndName,
                    numerator: stats.num,
                    denominator: stats.den,
                    value: val,
                    unit: "%",
                    status: val > 0 ? "異常" : "正常",
                    patient_id: "",
                    report_date: date,
                } as KPIDetail;
            })
            .sort((a, b) => b.report_date.localeCompare(a.report_date))
            .slice(0, 4);

        const trendData = Array.from(monthlyStatsMap.entries())
            .map(([date, stats]) => ({
                date,
                value: stats.den > 0 ? parseFloat(((stats.num / stats.den) * 100).toFixed(2)) : 0
            }))
            .sort((a, b) => a.date.localeCompare(b.date));

        const abnormalItems = filteredDetails
            .filter((item) => item.status === "異常")
            .sort((a, b) => {
                if (a.report_date && b.report_date) return new Date(b.report_date).getTime() - new Date(a.report_date).getTime();
                return 0;
            });

        return (
            <div className="flex-1 space-y-4 p-6 md:p-12">
                <div className="space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between space-y-2 md:space-y-0">
                        <h2 className="text-2xl font-bold tracking-tight">My Favorites</h2>
                        <div className="flex items-center space-x-2">
                            <span className="text-sm text-muted-foreground mr-2">{user.email}</span>
                            <SignOutButton />
                        </div>
                    </div>
                </div>

                <div className="space-y-8">
                    <div className="space-y-4">
                        <KPITable
                            items={latestMetrics}
                            title={`指標監控-個人指標統計`}
                            viewType="doctor"
                        />
                    </div>

                    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-7">
                        <div className="col-span-1 md:col-span-2 lg:col-span-7">
                            <TrendChart data={trendData} title={`${targetIndName} 趨勢 (月統計)`} />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <AbnormalTable items={abnormalItems} title="異常病患詳細清單" />
                    </div>
                </div>
            </div>
        );

    } catch (error) {
        if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
        console.error("Favorites Page Error:", error);
        return <div className="p-8 text-center text-red-600">載入頁面時發生錯誤</div>;
    }
}
