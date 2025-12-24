import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { KPITable } from "@/components/dashboard/KPITable";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { AbnormalTable } from "@/components/dashboard/AbnormalTable";
import { DataGenerator } from "@/components/DataGenerator";
import { DashboardFilters } from "@/components/DashboardFilters";
import { SignOutButton } from "@/components/SignOutButton";
import { KPIItem, KPIDetail } from "@/types/dashboard";

export default async function Dashboard(props: {
  searchParams: Promise<{ dept?: string }>;
}) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();

  // Next.js 15+ searchParams is a promise
  const deptFilter = searchParams?.dept;

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
    .select("*"); // Removed order for now to let JS handle sort if needed, or re-add
  // .order("report_date", { ascending: true }); // Keeping original order if possible

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

  // Extract Unique Departments for Filter
  const departments = Array.from(new Set(kpiItems.map(item => item.department).filter(Boolean)));

  // Apply Filter
  if (deptFilter && deptFilter !== "all") {
    kpiItems = kpiItems.filter(item => item.department === deptFilter);
    kpiDetails = kpiDetails.filter(item => item.department === deptFilter);
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
    <div className="flex-1 space-y-8 p-8 pt-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between space-y-2 md:space-y-0">
        <h2 className="text-3xl font-bold tracking-tight">KPIM Dashboard</h2>
        <div className="flex items-center space-x-4">
          <DashboardFilters departments={departments} doctors={[]} />
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground mr-2 hidden md:inline-block">Welcome, {user.email}</span>
            <DataGenerator />
            <SignOutButton />
          </div>
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
}
