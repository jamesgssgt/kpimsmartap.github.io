"use server";

import { createClient } from "@/utils/supabase/server";
import { QualityIndicator, CalculationStep, ValueType, CalculationAction, FhirResource } from "@/components/indicator/types";

export async function getIndicators(): Promise<QualityIndicator[]> {
    const supabase = await createClient();

    try {
        // 1. Fetch Definitions
        const { data: defs, error: defError } = await supabase
            .from("kpi_definitions")
            .select("*")
            .order("created_at", { ascending: false });

        if (defError) throw defError;
        if (!defs || defs.length === 0) return [];

        const kpiIds = defs.map(d => d.kpiid);

        // 2. Fetch Details
        const { data: details, error: detError } = await supabase
            .from("kpi_dl")
            .select("*")
            .in("kpiid", kpiIds)
            .order("seq", { ascending: true }); // Order by seq as requested

        if (detError) throw detError;

        // 3. Map to QualityIndicator
        const indicators: QualityIndicator[] = defs.map(def => {
            const myDetails = details?.filter(d => d.kpiid === def.kpiid) || [];

            const mapStep = (row: any): CalculationStep => {
                let parsedValue: any = {};
                try {
                    parsedValue = JSON.parse(row.kpi_dl_condition_value || '{}');
                } catch (e) {
                    console.error("Error parsing JSON:", row.kpi_dl_condition_value);
                }

                // Map source_type back to valueType
                // Prioritize JSON valueType, fallback to source_type legacy mapping
                let valueType: ValueType = parsedValue.valueType;

                if (!valueType) {
                    if (row.source_type === '2') valueType = 'indicator_result';
                    else valueType = 'fhir_filter';
                }

                return {
                    id: row.uuid || Math.random().toString(36).substr(2, 9),
                    action: parsedValue.action || 'AND', // Fallback
                    valueType: valueType,
                    resourceType: row.kpi_id_fhir_resource as FhirResource,
                    path: parsedValue.path || '',
                    operator: parsedValue.operator || 'equals',
                    value: parsedValue.value || '',
                    notes: row.kpi_dl_notes || ''
                };
            };

            // 1: Denominator, 2: Numerator, 3: Exclusion
            const denominatorSteps = myDetails.filter(d => d.kpi_dl_type === 1).map(mapStep);
            const numeratorSteps = myDetails.filter(d => d.kpi_dl_type === 2).map(mapStep);
            const exclusionSteps = myDetails.filter(d => d.kpi_dl_type === 3).map(mapStep);

            return {
                id: def.kpiid,
                name: def.name,
                description: def.formula || '', // formula mapped to description
                numeratorName: def.numerator_name || '',
                denominatorName: def.denominator_name || '',
                numeratorSteps,
                denominatorSteps,
                exclusionSteps,
                frequency: def.frequency || '每月',
                numeratorCalculationMethod: def.numerator_c as any || 'sum',
                denominatorCalculationMethod: def.denominator_c as any || 'sum',
                targetValue: def.target_value ?? undefined,
                targetOperator: def.target_operator as any || '>=',
                isPinned: def.is_pinned || false
            };
        });

        return indicators;

    } catch (e) {
        console.error("Fetch Indicators Error:", e);
        return [];
    }


}

export async function getIndicatorById(id: string): Promise<QualityIndicator | null> {
    const supabase = await createClient();

    try {
        // 1. Fetch Definition
        const { data: def, error: defError } = await supabase
            .from("kpi_definitions")
            .select("*")
            .eq("kpiid", id)
            .single();

        if (defError) return null;
        if (!def) return null;

        // 2. Fetch Details
        const { data: details, error: detError } = await supabase
            .from("kpi_dl")
            .select("*")
            .eq("kpiid", id)
            .order("seq", { ascending: true });

        if (detError) throw detError;

        const myDetails = details || [];

        const mapStep = (row: any): CalculationStep => {
            let parsedValue: any = {};
            try {
                parsedValue = JSON.parse(row.kpi_dl_condition_value || '{}');
            } catch (e) {
                console.error("Error parsing JSON:", row.kpi_dl_condition_value);
            }

            // Map source_type back to valueType
            // Prioritize JSON valueType, fallback to source_type legacy mapping
            let valueType: ValueType = parsedValue.valueType;

            if (!valueType) {
                if (row.source_type === '2') valueType = 'indicator_result';
                else valueType = 'fhir_filter';
            }

            return {
                id: row.uuid || Math.random().toString(36).substr(2, 9),
                action: parsedValue.action || 'AND', // Fallback
                valueType: valueType,
                resourceType: row.kpi_id_fhir_resource as FhirResource,
                path: parsedValue.path || '',
                operator: parsedValue.operator || 'equals',
                value: parsedValue.value || '',
                notes: row.kpi_dl_notes || ''
            };
        };

        // 1: Denominator, 2: Numerator, 3: Exclusion
        const denominatorSteps = myDetails.filter(d => d.kpi_dl_type === 1).map(mapStep);
        const numeratorSteps = myDetails.filter(d => d.kpi_dl_type === 2).map(mapStep);
        const exclusionSteps = myDetails.filter(d => d.kpi_dl_type === 3).map(mapStep);

        return {
            id: def.kpiid,
            name: def.name,
            description: def.formula || '', // formula mapped to description
            numeratorName: def.numerator_name || '',
            denominatorName: def.denominator_name || '',
            numeratorSteps,
            denominatorSteps,
            exclusionSteps,
            frequency: def.frequency || '每月',
            numeratorCalculationMethod: def.numerator_c as any || 'sum',
            denominatorCalculationMethod: def.denominator_c as any || 'sum',
            targetValue: def.target_value ?? undefined,
            targetOperator: def.target_operator as any || '>=',
            isPinned: def.is_pinned || false
        };

    } catch (e) {
        console.error("Fetch Indicator By ID Error:", e);
        return null;
    }
}
