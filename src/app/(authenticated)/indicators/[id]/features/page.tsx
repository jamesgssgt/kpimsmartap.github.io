import { FeatureDefinitionForm } from '@/components/indicator/FeatureDefinitionForm';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

export default async function FeatureDefinitionPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    // Validate UUID format to prevent Postgres 22P02 error
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    if (!isUuid) {
        return (
            <div className="p-10 flex flex-col items-center justify-center space-y-4">
                <div className="text-2xl font-bold text-slate-400">Invalid KPI ID</div>
                <p className="text-slate-500">The provided ID "{id}" is not valid.</p>
                <a href="/indicators" className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition">Return to List</a>
            </div>
        );
    }

    const supabase = await createClient();

    // Fetch KPI name for context
    const { data: kpi, error } = await supabase
        .from('kpi_definitions')
        .select('name')
        .eq('kpiid', id)
        .single();

    if (error || !kpi) {
        return (
            <div className="p-10 flex flex-col items-center justify-center space-y-4">
                <div className="text-2xl font-bold text-rose-500">Indicator Not Found</div>
                <div className="bg-slate-100 p-4 rounded text-sm font-mono text-slate-600">
                    <p>KPI ID: {id}</p>
                    <p>Error Code: {error?.code}</p>
                    <p>Error Message: {error?.message}</p>
                    <p>Details: {error?.details}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
            <FeatureDefinitionForm kpiId={id} kpiName={kpi.name} />
        </div>
    );
}
