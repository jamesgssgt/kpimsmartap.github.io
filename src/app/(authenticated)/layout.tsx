import type { Metadata } from "next";
import SmartLoader from "@/components/SmartLoader";
import { SidebarNav } from "@/components/dashboard/SidebarNav";
import { SettingsProvider } from "@/contexts/SettingsContext";

export const maxDuration = 60;

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
            <SettingsProvider>
                <SmartLoader>
                    <div className="flex h-screen flex-col md:flex-row md:overflow-hidden">
                        <div className="w-full flex-none md:w-64 bg-card border-r p-4">
                            {/* Sidebar Placeholder */}
                            <h1 className="text-xl font-bold text-primary mb-6">KPIM Smart ON FHIR APP</h1>
                            <SidebarNav />
                        </div>
                        <div className="flex-grow md:overflow-y-auto">
                            {children}
                        </div>
                    </div>
                </SmartLoader>
            </SettingsProvider>
        </div>
    );
}
