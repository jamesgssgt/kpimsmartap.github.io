import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { KPITable } from "@/components/dashboard/KPITable";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { AbnormalTable } from "@/components/dashboard/AbnormalTable";
import { DashboardFilters } from "@/components/DashboardFilters";
import { SignOutButton } from "@/components/SignOutButton";
import { KPIItem, KPIDetail } from "@/types/dashboard";

export default async function DashboardPage(props: {
    searchParams: Promise<{ dept?: string; doctor?: string }>;
}) {
    try {
        const searchParams = await props.searchParams;
        const supabase = await createClient();

        // Next.js 15+ searchParams is a promise
        // Handle potential array or string
        const getParam = (val: string | string[] | undefined) => {
            if (Array.isArray(val)) return val[0];
            return val;
        };

        const deptParam = getParam(searchParams?.dept);
        const doctorParam = getParam(searchParams?.doctor);

        // Decode if necessary (though Next usually handles it, explicit decode handles edge cases)
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

        // Fetch KPI Summary
        const { data: kpiDataRaw, error: kpiError } = await supabase
            .from("KPI")
            .select("*");

        if (kpiError) {
            console.error("Error fetching KPI:", kpiError);
        }

        // Fetch KPI Details for Trend and Alerts
        const { data: detailDataRaw, error: detailError } = await supabase
            .from("KPI_Detail")
            .select("*");

        if (detailError) {
            console.error("Error fetching KPI Details:", detailError);
        }

        let kpiItems: KPIItem[] = kpiDataRaw || [];
        let kpiDetails: KPIDetail[] = detailDataRaw || [];

        // Sort details by date
        kpiDetails.sort((a, b) => {
            const dateA = a.report_date ? new Date(a.report_date).getTime() : 0;
            const dateB = b.report_date ? new Date(b.report_date).getTime() : 0;
            return dateA - dateB;
        });

        // Extract Unique Departments and Doctors
        const departments = Array.from(new Set(kpiItems.map(item => item.department).filter(Boolean)));
        // Create a map of doctors to departments
        const doctorsMap = new Map<string, string>();
        kpiItems.forEach(item => {
            if (item.doctor && item.department) {
                doctorsMap.set(item.doctor, item.department);
            }
        });
        // Fallback search in details if needed, but summary usually has them
        const doctors = Array.from(doctorsMap.entries()).map(([name, dept]) => ({ name, dept }));

        // Apply Filters
        if (deptFilters.length > 0) {
            kpiItems = kpiItems.filter(item => deptFilters.includes(item.department));
            kpiDetails = kpiDetails.filter(item => deptFilters.includes(item.department));
        }

        if (doctorFilters.length > 0) {
            kpiItems = kpiItems.filter(item => doctorFilters.includes(item.doctor));
            kpiDetails = kpiDetails.filter(item => doctorFilters.includes(item.doctor));
        }

        // Process Trend Data (Group by Month)
        const trendMap = new Map<string, { sum: number; count: number }>();
        kpiDetails.forEach((item) => {
            if (item.report_date) {
                const date = new Date(item.report_date);
                const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

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
                value: count > 0 ? parseFloat(((sum / count) * 100).toFixed(2)) : 0, // Assuming % based on 0/1 calc from script
            }))
            .sort((a, b) => a.date.localeCompare(b.date));

        // Process Abnormal List
        const abnormalItems = kpiDetails.filter((item) => item.status === "異常");

        return (
            <div className="flex-1 space-y-4 p-4 pt-[5px]">
                <div className="space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between space-y-2 md:space-y-0">
                        <h2 className="text-2xl font-bold tracking-tight">KPIM Dashboard</h2>
                        <div className="flex items-center space-x-2">
                            <span className="text-sm text-muted-foreground mr-2 hidden md:inline-block">{user.email}</span>
                            <SignOutButton />
                        </div>
                    </div>
                    <div className="flex justify-start">
                        <DashboardFilters departments={departments} doctors={doctors} />
                    </div>
                </div>

                <div className="space-y-8">
                    {/* Top: KPI Table */}
                    <KPITable items={kpiItems} />

                    {/* Bottom Section */}
                    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-7">
                        {/* Trend Chart (Left) */}
                        <div className="col-span-1 md:col-span-2 lg:col-span-3">
                            <TrendChart data={trendData} />
                        </div>

                        {/* Abnormal Table (Right) */}
                        <div className="col-span-1 md:col-span-2 lg:col-span-4">
                            <AbnormalTable items={abnormalItems} />
                        </div>
                    </div>
                </div>
            </div>
        );
    } catch (error) {
        console.error("Dashboard Page Error:", error);
        return (
            <div className="p-8 text-center">
                <h2 className="text-xl font-bold text-red-600">載入儀表板時發生錯誤</h2>
                <p className="text-muted-foreground mt-2">請稍後再試或聯繫管理員。</p>
                <div className="mt-4 p-4 bg-slate-100 rounded text-left overflow-auto max-w-2xl mx-auto">
                    <code className="text-xs">{String(error)}</code>
                </div>
            </div>
        );
    }
}

