"use server";

import { createClient } from "@/utils/supabase/server";

export interface FeatureColumnDef {
    slot: string;
    displayName: string;
    fhirSource: string;
    seq: number;
}

export async function saveFeatureDefinitions(kpiId: string, features: FeatureColumnDef[]) {
    const supabase = await createClient();

    try {
        // 1. Clear existing feature definitions
        const { error: delError } = await supabase
            .from("kpi_ft_detail_inf")
            .delete()
            .eq("kpi_id", kpiId);

        if (delError) {
            console.error("Failed to clear feature definitions:", delError);
            throw new Error(delError.message);
        }

        // 2. Insert new definitions
        if (features && features.length > 0) {
            const inserts = features.map(f => ({
                kpi_id: kpiId,
                column_slot: f.slot,
                display_name: f.displayName,
                fhir_source: f.fhirSource,
                seq: f.seq
            }));

            const { error: insError } = await supabase
                .from("kpi_ft_detail_inf")
                .insert(inserts);

            if (insError) {
                console.error("Failed to insert feature definitions:", insError);
                throw new Error(insError.message);
            }
        }

        return { success: true };

    } catch (error: any) {
        console.error("Save Features Error:", error);
        return { success: false, message: error.message };
    }
}

export async function getFeatureDefinitions(kpiId: string) {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("kpi_ft_detail_inf")
        .select("*")
        .eq("kpi_id", kpiId)
        .order("seq", { ascending: true });

    if (error) {
        console.error("Get Features Error:", error);
        return [];
    }

    return data.map((d: any) => ({
        slot: d.column_slot,
        displayName: d.display_name,
        fhirSource: d.fhir_source,
        seq: d.seq
    })) as FeatureColumnDef[];
}
