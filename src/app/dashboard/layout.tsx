import type { Metadata } from "next";
import SmartLoader from "@/components/SmartLoader";
import { SidebarNav } from "@/components/dashboard/SidebarNav";

export const metadata: Metadata = {
    title: "KPIM Dashboard",
    description: "KPI Management Dashboard",
};

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-muted/10">
            <SmartLoader>
                <div className="flex h-screen flex-col md:flex-row md:overflow-hidden">
                    <div className="w-full flex-none md:w-64 bg-card border-r p-4">
                        {/* Sidebar Placeholder */}
                        <h1 className="text-xl font-bold text-primary mb-6">KPIM Smart ON FHIR APP</h1>
                        <SidebarNav />
                    </div>
                    <div className="flex-grow p-6 md:overflow-y-auto md:p-12">
                        {children}
                    </div>
                </div>
            </SmartLoader>
        </div>
    );
}
