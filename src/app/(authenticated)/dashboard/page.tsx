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

        // Kick out unauthenticated users
        if (!user && !hasActiveSmartSession) {
            return redirect("/login");
        }

        // Kick out users who are using the guest/anonymous fallback but lost their SMART session tokens
        if (user?.is_anonymous && !hasActiveSmartSession) {
            return redirect("/login");
        }

        const identityCookie = hasActiveSmartSession ? cookieStore.get("fhir_user_identity")?.value : null;

        let displayName = user?.email || "Guest User";

        if (identityCookie) {
            try {
                const identity = JSON.parse(identityCookie);
                if (identity.name && identity.name.trim() !== "") {
                    displayName = identity.name;
                } else if (identity.sub && (!user || !user.email)) {
                    displayName = identity.sub;
                    if (displayName === "unknown") {
                        displayName = "未知 Practitioner (請檢視 Token)";
                    }
                }
            } catch (e) {
                // ignore parse error
            }
        }

        // 1. Fetch Basic Metadata
        const { data: pinnedDefs } = await supabase
            .from("kpi_definitions")
            .select("kpiid, name, numerator_name, denominator_name, formula")
            .eq("is_pinned", true)
            .order("name", { ascending: true });

        const { data: allDefs } = await supabase
            .from("kpi_definitions")
            .select("name, target_value, target_operator");

        const targetMap = new Map(allDefs?.map(d => [d.name, { val: d.target_value, op: d.target_operator }]));

        // 2. Resolve Active Indicator
        let pinnedNames = pinnedDefs?.map(d => d.name) || [];
        let primaryIndicatorName = "";
        let numeratorLabel = "分子";
        let denominatorLabel = "分母";
        let activeKpiId = null;
        let activeFormula = "";

        if (kpiParam) {
            primaryIndicatorName = decodeURIComponent(kpiParam);
            const { data: overDef } = await supabase.from("kpi_definitions").select("kpiid, formula, numerator_name, denominator_name").eq("name", primaryIndicatorName).single();
            if (overDef) {
                activeKpiId = overDef.kpiid;
                activeFormula = overDef.formula || "";
                numeratorLabel = overDef.numerator_name || "分子";
                denominatorLabel = overDef.denominator_name || "分母";
            }
        } else if (pinnedNames.length > 0) {
            primaryIndicatorName = pinnedNames[0];
            const activeDef = pinnedDefs![0];
            activeKpiId = activeDef.kpiid;
            activeFormula = activeDef.formula || "";
            numeratorLabel = activeDef.numerator_name || "分子";
            denominatorLabel = activeDef.denominator_name || "分母";
        }

        // 3. PERFORMANCE: Fetch Summary Data for KPITable & DepartmentChart
        // Use pre-aggregated session-level "KPI" table
        const { data: kpiSummaryData } = await supabase
            .from("KPI")
            .select("*")
            .eq("indicator_name", primaryIndicatorName);

        // 4. PERFORMANCE: Fetch Trend Data (Minimal Columns) - NOW FILTERED
        let trendQuery = supabase
            .from("kpi_detail")
            .select("data_date, numerator_value, denominator_value")
            .eq("kpi_id", activeKpiId);

        if (deptFilters.length > 0) trendQuery = trendQuery.in("department", deptFilters);
        if (doctorFilters.length > 0) trendQuery = trendQuery.in("doctor_name", doctorFilters);
        if (startDate) trendQuery = trendQuery.gte("data_date", startDate);
        if (endDate) trendQuery = trendQuery.lte("data_date", endDate);

        const { data: trendDataRaw } = await trendQuery.order("data_date", { ascending: true });

        // 5. DATA COMPLETE: Fetch Abnormal Details with JOIN and Metadata Mapping
        const { data: ftMapping } = await supabase
            .from("kpi_ft_detail_inf")
            .select("*")
            .eq("kpi_id", activeKpiId)
            .order("seq");

        // Construct dynamic join query (or manual join if RPC not available)
        // For simplicity and to avoid RPC setup, we do a join here
        const { data: abnormalDetailsRaw } = await supabase
            .from("kpi_detail")
            .select(`
                *,
                kpi_ft_detail!kpi_ft_detail_kpi_detail_id_fkey (*)
            `)
            .eq("kpi_id", activeKpiId)
            .gt("numerator_value", 0) // Assume 0 is normal for simplicity, refining logic below
            .order("data_date", { ascending: false })
            .limit(1000);

        // 6. Map Filter Options (Based on all indicators to remain flexible)
        const { data: filterMetadata } = await supabase.from("KPI").select("department, doctor");
        const departments = Array.from(new Set(filterMetadata?.map(d => d.department).filter(Boolean)));
        const doctorSet = new Set<string>();
        const doctors: { name: string, dept: string }[] = [];
        filterMetadata?.forEach(d => {
            if (d.doctor && !doctorSet.has(d.doctor)) {
                doctorSet.add(d.doctor);
                doctors.push({ name: d.doctor, dept: d.department });
            }
        });

        // Step 11: Dynamic Date Filter Defaults (Based on Indicator's own KPI Summary dates)
        const todayStr = new Date().toLocaleDateString('en-CA'); // Gets YYYY-MM-DD in local time
        const kpiDates = kpiSummaryData?.map(d => d.report_date).filter(Boolean) as string[] || [];
        
        // Find the LATEST date for THIS indicator in the DB, but NEVER greater than today
        let maxDataDateStr = kpiDates.length > 0 ? kpiDates.sort().reverse()[0] : todayStr;
        if (maxDataDateStr > todayStr) maxDataDateStr = todayStr;
        
        const globalMaxDateStr = maxDataDateStr;
        const globalMinDateStr = `${maxDataDateStr.split('-')[0]}-01-01`; // Jan 1st of the same year
        
        // Use URL param if exists, otherwise use calculated default
        const currentEndDate = endDate || globalMaxDateStr;
        const targetAbnormalMonth = currentEndDate.substring(0, 7);
        const startOfMonth = `${targetAbnormalMonth}-01`;

        // 7. Calculate Latest Metrics (KPITable) - Precise Monthly Accumulation Logic
        const isDrillDown = deptFilters.length > 0;
        
        // Filter: Data must be within the TARGET MONTH and up to the selected END DATE
        const monthFilteredData = kpiSummaryData?.filter(d => 
            d.report_date && 
            d.report_date >= startOfMonth && 
            d.report_date <= currentEndDate
        ) || [];
        
        // Apply Dept/Doctor filter (if any)
        let monitoredPoints = monthFilteredData;
        if (deptFilters.length > 0) monitoredPoints = monitoredPoints.filter(p => deptFilters.includes(p.department));
        if (doctorFilters.length > 0) monitoredPoints = monitoredPoints.filter(p => doctorFilters.includes(p.doctor));

        // GROUP BY logic to prevent duplicate entries and sum up daily snapshots in the range
        const groupedMap = new Map<string, any>();
        monitoredPoints.forEach(agg => {
            const key = isDrillDown ? (agg.doctor || "未知") : (agg.department || "其他");
            const existing = groupedMap.get(key) || { 
                n: 0, d: 0, unit: agg.unit || "%", 
                indicator_name: agg.indicator_name, 
                indicator_def: agg.indicator_def,
                latest_report_date: agg.report_date, // track latest date in this group for label
                department: agg.department,
                doctor: agg.doctor,
                created_at: agg.created_at
            };
            
            // Summing up (Assuming daily records. If snapshots, logic might vary, but user SQL uses sum)
            groupedMap.set(key, {
                ...existing,
                n: existing.n + (agg.numerator || 0),
                d: existing.d + (agg.denominator || 0),
                latest_report_date: agg.report_date > (existing.latest_report_date || "") ? agg.report_date : existing.latest_report_date
            });
        });

        const latestMetrics: KPIDetail[] = Array.from(groupedMap.entries()).map(([key, data]) => {
            const val = data.d > 0 ? parseFloat(((data.n / data.d) * 100).toFixed(2)) : 0;
            const target = targetMap.get(data.indicator_name);
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
                }
                if (!isNormal) status = "異常";
            } else if (val > 0) status = "異常";

            return {
                id: key,
                created_at: data.created_at,
                department: data.department,
                doctor: data.doctor,
                indicator_name: data.indicator_name,
                indicator_def: data.indicator_def,
                numerator: data.n,
                denominator: data.d,
                value: val,
                unit: data.unit,
                status,
                patient_id: "", patient_gender: "", patient_birthday: "",
                report_date: data.latest_report_date || "",
                admission_date: "", discharge_date: "", op_start: "", op_end: "", abnormal_reason: ""
            };
        }).sort((a, b) => b.value - a.value);

        // 8. Calculate Trend Chart Data
        const trendMap = new Map<string, { n: number, d: number }>();
        trendDataRaw?.forEach(r => {
            if (r.data_date) {
                const mo = String(r.data_date).substring(0, 7);
                const curr = trendMap.get(mo) || { n: 0, d: 0 };
                trendMap.set(mo, { n: curr.n + (r.numerator_value || 0), d: curr.d + (r.denominator_value || 0) });
            }
        });
        const trendData = Array.from(trendMap.entries()).map(([date, v]) => ({
            date, value: v.d > 0 ? parseFloat(((v.n / v.d) * 100).toFixed(2)) : 0
        })).sort((a, b) => a.date.localeCompare(b.date));

        // 9. Calculate Bar Chart Data
        const barChartData = latestMetrics.map(m => ({
            department: isDrillDown ? m.doctor : m.department,
            value: m.value
        })).slice(0, 10);

        // 10. Map Abnormal Items (With Detail Logic)
        const abnormalItems: KPIDetail[] = (abnormalDetailsRaw || []).map(d => {
            const ft = (d as any).kpi_ft_detail?.[0] || {};
            const item: KPIDetail = {
                id: d.id,
                created_at: d.created_at,
                department: d.department,
                doctor: d.doctor_name,
                doctor_id: d.doctor_id,
                indicator_name: primaryIndicatorName,
                indicator_def: activeFormula,
                numerator: d.numerator_value,
                denominator: d.denominator_value,
                value: d.kpi_value,
                unit: "%",
                status: "異常",
                patient_id: d.patient_id,
                patient_gender: d.patient_gender,
                patient_birthday: d.patient_birth_date,
                report_date: d.data_date,
                admission_date: "-",
                discharge_date: "-",
                op_start: "-",
                op_end: "-",
                abnormal_reason: d.abnormal_reason || ""
            };

            // Dynamic FT Mapping
            ftMapping?.forEach(m => {
                const val = ft[m.column_slot?.replace('ft_', 'column')] || "-";
                if (m.display_name?.includes("入院")) item.admission_date = val;
                if (m.display_name?.includes("出院")) item.discharge_date = val;
                if (m.display_name?.includes("手術") && m.display_name?.includes("時間")) item.op_end = val;
                if (m.display_name?.includes("開始")) item.op_start = val;
            });

            return item;
        });


        return (
            <div className="flex-1 space-y-4 p-6 md:p-12">
                <div className="space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between space-y-2 md:space-y-0">
                        <div className="space-y-1">
                            <h2 className="text-2xl font-bold tracking-tight text-primary">KPIM Smart Dashboard</h2>
                        </div>
                        <div className="flex items-center space-x-2">
                            <div className="flex flex-col items-end">
                                <span className="text-sm font-medium mr-2">{displayName}</span>
                                {identityCookie && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full mr-2">SMART身份已連接</span>}
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

                <div className="space-y-8 animate-in fade-in duration-500">
                    <div className="space-y-4">
                        <KPITable
                            items={latestMetrics}
                            title={`[指標監控] ${primaryIndicatorName} - 累計報表 (至 ${currentEndDate})`}
                            viewType={isDrillDown ? "doctor" : "department"}
                            numeratorLabel={numeratorLabel}
                            denominatorLabel={denominatorLabel}
                        />
                    </div>

                    <div>
                        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-7">
                            <div className="col-span-1 md:col-span-2 lg:col-span-4">
                                <TrendChart data={trendData} title={`${primaryIndicatorName} 歷月趨勢`} />
                            </div>

                            <div className="col-span-1 md:col-span-2 lg:col-span-3">
                                <DepartmentChart
                                    data={barChartData}
                                    title={isDrillDown ? `醫師排行 (${primaryIndicatorName})` : `科別對比 (${primaryIndicatorName})`}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <AbnormalTable items={abnormalItems.filter(i => i.report_date?.startsWith(targetAbnormalMonth))} title={`${primaryIndicatorName} (${targetAbnormalMonth}) 異常詳細清單`} />
                    </div>
                </div>

                <div className="mt-8 border-t pt-4">
                    <div className="text-[10px] text-gray-300 text-right italic">
                        系統已切換至摘要引擎，明細數據僅在異常表單中按需載入。
                    </div>
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
