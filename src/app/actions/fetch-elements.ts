"use server";

import { createClient } from "@/utils/supabase/server";

export interface FactorItem {
    id: string; // Indicator ID
    name: string; // "Indicator Name / Factor Name"
    type: 'numerator' | 'denominator';
    source: 'fhir' | 'manual';
    indicatorName: string;
}

export async function fetchElements(): Promise<FactorItem[]> {
    const supabase = await createClient();

    try {
        // 1. Fetch Definitions
        const { data: defs, error: defError } = await supabase
            .from("kpi_definitions")
            .select("kpiid, name, numerator_name, denominator_name")
            .order("created_at", { ascending: false });

        if (defError) throw defError;
        if (!defs || defs.length === 0) return [];

        const kpiIds = defs.map(d => d.kpiid);

        // 2. Fetch Details to determine Source
        // We only care if there are ANY '1' (FHIR) type steps for that section
        const { data: details, error: detError } = await supabase
            .from("kpi_dl")
            .select("kpiid, kpi_dl_type, source_type")
            .in("kpiid", kpiIds);

        if (detError) throw detError;

        const results: FactorItem[] = [];

        defs.forEach(def => {
            // Numerator
            const numSteps = details?.filter(d => d.kpiid === def.kpiid && d.kpi_dl_type === 2) || [];
            const isNumFhir = numSteps.some(s => s.source_type === '1');
            results.push({
                id: def.kpiid,
                name: def.numerator_name || `${def.name} (Numerator)`,
                type: 'numerator',
                source: isNumFhir ? 'fhir' : 'manual',
                indicatorName: def.name
            });

            // Denominator
            const denSteps = details?.filter(d => d.kpiid === def.kpiid && d.kpi_dl_type === 1) || [];
            const isDenFhir = denSteps.some(s => s.source_type === '1');
            results.push({
                id: def.kpiid,
                name: def.denominator_name || `${def.name} (Denominator)`,
                type: 'denominator',
                source: isDenFhir ? 'fhir' : 'manual',
                indicatorName: def.name
            });
        });

        return results;

    } catch (e) {
        console.error("Fetch Elements Error:", e);
        return [];
    }
}
