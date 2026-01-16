import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { KPITable } from "@/components/dashboard/KPITable";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { DepartmentChart } from "@/components/dashboard/DepartmentChart";
import { AbnormalTable } from "@/components/dashboard/AbnormalTable";
import { DashboardFilters } from "@/components/DashboardFilters";
import { SignOutButton } from "@/components/SignOutButton";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";
import { KPIItem, KPIDetail } from "@/types/dashboard";


export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardPage(props: {
    searchParams: Promise<{ dept?: string; doctor?: string; startDate?: string; endDate?: string; kpi?: string }>;
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
        const kpiParam = getParam(searchParams?.kpi);

        const deptFilterStr = deptParam ? decodeURIComponent(deptParam) : undefined;
        const doctorFilterStr = doctorParam ? decodeURIComponent(doctorParam) : undefined;
        const deptFilters = deptFilterStr ? deptFilterStr.split(",") : [];
        const doctorFilters = doctorFilterStr ? doctorFilterStr.split(",") : [];


        const {
            data: { user },
        } = await supabase.auth.getUser();

        // [Auth Check] Support both Supabase Auth AND SMART on FHIR Session
        const cookieStore = await import("next/headers").then(m => m.cookies());
        const hasActiveSmartSession = cookieStore.has("fhir_access_token");

        if (!user && !hasActiveSmartSession) {
            return redirect("/login");
        }

        const identityCookie = hasActiveSmartSession ? cookieStore.get("fhir_user_identity")?.value : null;

        let displayName = user?.email || "Guest User";

        if (identityCookie) {
            try {
                const identity = JSON.parse(identityCookie);
                // Smart Name > Supabase Email > Smart Sub > Guest
                if (identity.name && identity.name.trim() !== "") {
                    displayName = identity.name;
                } else if (identity.sub && (!user || !user.email)) {
                    // Start of fallback: Only show ID if we have NO email
                    displayName = `User: ${identity.sub}`;
                }
            } catch (e) {
                // ignore parse error
            }
        }

        // Fetch KPI Summary (Small table, used for filter lists)
        const { data: kpiDataRaw } = await supabase.from("KPI").select("*");

        // Fetch Pinned Indicators
        const { data: pinnedDefs } = await supabase
            .from("kpi_definitions")
            .select("name, numerator_name, denominator_name")
            .eq("is_pinned", true)
            .order("name", { ascending: true });

        // Fetch ALL definitions for target lookup
        const { data: allDefs } = await supabase
            .from("kpi_definitions")
            .select("name, target_value, target_operator");

        const targetMap = new Map(allDefs?.map(d => [d.name, { val: d.target_value, op: d.target_operator }]));

        let pinnedNames = pinnedDefs?.map(d => d.name) || [];
        let primaryIndicatorName = "";
        let numeratorLabel = "分子(術後 48 小時死亡人次)";
        let denominatorLabel = "分母(手術人次)";

        // 1. Determine Primary Indicator & Labels
        if (pinnedNames.length > 0) {
            // Pinned: Default to first, allow override by URL param
            primaryIndicatorName = pinnedNames[0];
            let activeDef = pinnedDefs![0];

            if (kpiParam && pinnedNames.includes(decodeURIComponent(kpiParam))) {
                primaryIndicatorName = decodeURIComponent(kpiParam);
                activeDef = pinnedDefs?.find(d => d.name === primaryIndicatorName) || activeDef;
            }

            numeratorLabel = activeDef.numerator_name || "分子";
            denominatorLabel = activeDef.denominator_name || "分母";
        } else {
            // Not Pinned: Fallback to first alphabetical in DB
            const { data: firstDef } = await supabase
                .from("kpi_definitions")
                .select("name, numerator_name, denominator_name")
                .order("name", { ascending: true })
                .limit(1)
                .single();

            if (firstDef) {
                primaryIndicatorName = firstDef.name;
                numeratorLabel = firstDef.numerator_name || "分子";
                denominatorLabel = firstDef.denominator_name || "分母";
            } else {
                primaryIndicatorName = "手術後 48 小時內死亡率"; // Ultimate fallback
            }

            // If URL param exists (even if not pinned), try to honor it (simple override)
            if (kpiParam) {
                primaryIndicatorName = decodeURIComponent(kpiParam);
            }
        }

        // Fetch KPI Details - Filtered SERVER SIDE by Primary Indicator to avoid 1000 row limit
        // We trim the primary indicator name just in case, but usually DB match is exact. 
        // If DB has whitespace issues, we might need ILIKE or similar, but exact match is standard.
        // Assuming 'primaryIndicatorName' comes primarily from DB 'pinnedDefs' or 'firstDef', it should match accurately.
        const { data: detailDataRaw } = await supabase
            .from("KPI_Detail")
            .select("*")
            .eq("indicator_name", primaryIndicatorName)
            .order('report_date', { ascending: false })
            .limit(5000); // 5000 limit for robustness

        let kpiItems: KPIItem[] = kpiDataRaw || [];
        let kpiDetails: KPIDetail[] = detailDataRaw || [];

        // Filter Summary (Items) by Pinned if any exist (for Dropdowns)
        if (pinnedNames.length > 0) {
            const safePinned = pinnedNames.map(n => n.trim());
            kpiItems = kpiItems.filter(item => item.indicator_name && safePinned.includes(item.indicator_name.trim()));
        }

        // kpiDetails is already strictly filtered to primaryIndicatorName. 
        // We can just proceed with it.

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

        // kpiRawData used for metrics calculation - already specific to Primary Indicator
        const kpiRawData = filteredDetails;

        // DRILL DOWN LOGIC
        const isDrillDown = deptFilters.length > 0;

        const kpiAggMap = new Map<string, {
            dept: string;
            doctor: string;
            indicator: string;
            num: number;
            den: number;
            unit: string;
        }>();

        kpiRawData.forEach(item => {
            const groupKey = isDrillDown ? item.doctor : item.department;
            const key = `${groupKey}|${item.indicator_name}`;

            const current = kpiAggMap.get(key) || {
                dept: item.department,
                doctor: item.doctor,
                indicator: item.indicator_name,
                num: 0,
                den: 0,
                unit: item.unit || "%"
            };
            kpiAggMap.set(key, {
                ...current,
                num: current.num + (Number(item.numerator) || 0),
                den: current.den + (Number(item.denominator) || 0)
            });
        });

        const latestMetrics: KPIDetail[] = Array.from(kpiAggMap.values()).map(agg => {
            const val = agg.den > 0 ? parseFloat(((agg.num / agg.den) * 100).toFixed(2)) : 0;

            // Determine Status based on Target
            const target = targetMap.get(agg.indicator);
            let status = "正常";

            if (target && target.val !== undefined && target.val !== null) {
                const tVal = Number(target.val);
                const op = target.op || ">=";

                let isNormal = true;
                switch (op) {
                    case "<=": isNormal = val <= tVal; break;
                    case ">=": isNormal = val >= tVal; break;
                    case "<": isNormal = val < tVal; break;
                    case ">": isNormal = val > tVal; break;
                    case "=": isNormal = val === tVal; break;
                    default: isNormal = val >= tVal;
                }

                if (!isNormal) status = "異常";

            } else {
                if (val > 0) status = "異常";
            }

            return {
                id: "-1",
                created_at: "",
                department: agg.dept,
                doctor: agg.doctor,
                indicator_name: agg.indicator,
                indicator_def: "",
                numerator: agg.num,
                denominator: agg.den,
                value: val,
                unit: agg.unit,
                status,
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
        }).sort((a, b) => b.value - a.value);

        // 7. Trend Chart Data
        const trendMap = new Map<string, { sum: number; count: number }>();
        const trendRelevantDetails = filteredDetails; // Already filtered

        trendRelevantDetails.forEach((item) => {
            if (item.report_date) {
                const key = item.report_date.substring(0, 7);
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

        // 8. Bar Chart Data
        const barRawData = filteredDetails; // Already filtered

        const deptBarMap = new Map<string, { num: number; den: number }>();
        barRawData.forEach(item => {
            const key = isDrillDown ? item.doctor : item.department;
            const current = deptBarMap.get(key) || { num: 0, den: 0 };
            deptBarMap.set(key, {
                num: current.num + (Number(item.numerator) || 0),
                den: current.den + (Number(item.denominator) || 0)
            });
        });

        const barChartData = Array.from(deptBarMap.entries())
            .map(([key, { num, den }]) => ({
                department: key,
                value: den > 0 ? parseFloat(((num / den) * 100).toFixed(2)) : 0
            }))
            .sort((a, b) => b.value - a.value);

        // 9. Abnormal Items
        const primaryIndicatorItems = kpiDetails; // Already filtered

        const primaryDates = primaryIndicatorItems
            .map(d => d.report_date ? new Date(d.report_date).getTime() : 0)
            .filter(d => d > 0);
        const primaryMaxDateTs = primaryDates.length > 0 ? Math.max(...primaryDates) : 0;
        const primaryMaxDateStr = primaryMaxDateTs > 0 ? new Date(primaryMaxDateTs).toISOString().split('T')[0] : "";

        const targetAbnormalMonth = endDate ? endDate.substring(0, 7) : primaryMaxDateStr.substring(0, 7);

        const abnormalItems = primaryIndicatorItems
            .filter((item) => {
                if (!item.report_date) return false;
                return item.status === "異常" && item.report_date.startsWith(targetAbnormalMonth);
            })
            .sort((a, b) => {
                if (a.report_date && b.report_date) return new Date(b.report_date).getTime() - new Date(a.report_date).getTime();
                return 0;
            });



        return (
            <div className="flex-1 space-y-4 p-6 md:p-12">
                <div className="space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between space-y-2 md:space-y-0">
                        <h2 className="text-2xl font-bold tracking-tight">KPIM Dashboard</h2>
                        <div className="flex items-center space-x-2">
                            <div className="flex flex-col items-end">
                                <span className="text-sm text-muted-foreground mr-2 hidden md:inline-block">{displayName}</span>
                                <span className="text-[10px] text-gray-300 mr-2">{identityCookie ? "SMART Connected" : "No Identity"}</span>
                            </div>
                            <SignOutButton />
                        </div>
                    </div>
                    <DashboardTabs pinnedIndicators={pinnedNames} currentIndicator={primaryIndicatorName} />
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
                    <div className="space-y-4">
                        <KPITable
                            items={latestMetrics}
                            title={`[指標監控] ${primaryIndicatorName} - 區間累計 (${startDate || globalMinDateStr} ~ ${endDate || globalMaxDateStr})`}
                            viewType={isDrillDown ? "doctor" : "department"}
                            numeratorLabel={numeratorLabel}
                            denominatorLabel={denominatorLabel}
                        />
                    </div>

                    <div>
                        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-7">
                            <div className="col-span-1 md:col-span-2 lg:col-span-4">
                                <TrendChart data={trendData} title={`${primaryIndicatorName} 趨勢 (月統計)`} />
                            </div>

                            <div className="col-span-1 md:col-span-2 lg:col-span-3">
                                <DepartmentChart
                                    data={barChartData}
                                    title={isDrillDown ? `依醫師 ${primaryIndicatorName}` : `最近一月依科別 ${primaryIndicatorName}`}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <AbnormalTable items={abnormalItems} title={`${primaryIndicatorName} (${targetAbnormalMonth || '無資料'}) 異常詳細清單`} />
                    </div>


                </div>

                <div className="mt-8 border-t pt-4">
                    <details className="text-xs text-gray-500">
                        <summary className="cursor-pointer font-bold mb-2">🔧 Developer Debug Info (v2026.01.16-CookieFix)</summary>
                        <div className="space-y-2 bg-slate-50 p-4 rounded overflow-auto">
                            <p><strong>Identity Cookie:</strong> {identityCookie || "null"}</p>
                            <p><strong>Display Name:</strong> {displayName}</p>
                            <p><strong>User Email:</strong> {user?.email}</p>
                            <p><strong>Timestamp:</strong> {new Date().toISOString()}</p>
                        </div>
                    </details>
                </div>
            </div>
        );

    } catch (error) {
        if (error instanceof Error && error.message === "NEXT_REDIRECT") {
            throw error;
        }
        if ((error as any)?.digest?.startsWith?.('NEXT_REDIRECT')) {
            throw error;
        }

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
