"use server";

import { createClient } from "@/utils/supabase/server";
import { QualityIndicator, CalculationStep } from "@/components/indicator/types";

export async function saveIndicator(indicator: QualityIndicator) {
    const supabase = await createClient();

    try {
        // 1. Upsert kpi_definitions
        const definitionData = {
            name: indicator.name,
            formula: indicator.description, // Mapping description to formula as per plan
            category: "General", // Default or derived if we had it
            numerator_name: indicator.numeratorName,
            denominator_name: indicator.denominatorName,
            numerator_c: indicator.numeratorCalculationMethod,
            denominator_c: indicator.denominatorCalculationMethod,
            frequency: indicator.frequency,
            target_value: indicator.targetValue,
            target_operator: indicator.targetOperator,
            kpiid: indicator.id
        };

        // If ID starts with 'ind-' or 'new', it might be a client-side temp ID. 
        // Ideally we should let DB generate UUID if it's new, but our types use string ID.
        // Let's rely on upsert. If it matches a UUID format, great. If not (like 'ind-001'), we might have issues if column is UUID.
        // The SQL defined kpiid as UUID. 'ind-001' will fail.
        // We need to check if the ID is a valid UUID. If not, we should probably let Supabase generate one (insert) 
        // or generate one here if we want to explicitly set it.
        // For simplicity, let's assume we clean up the ID or generate a new UUID if it doesn't look like one.

        let kpiIdToUse = indicator.id;
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(indicator.id);

        if (!isUuid) {
            // If not UUID, treat as new insert (remove id from payload to let default gen_random_uuid work) 
            // OR generate one here. 
            // Ideally we want to return the new ID.
            // Let's modify the payload.
            delete (definitionData as any).kpiid;
        }

        const { data: savedDef, error: defError } = await supabase
            .from("kpi_definitions")
            .upsert(
                isUuid ? definitionData : definitionData,
                { onConflict: "kpiid" }
            ) // If we deleted kpiid from object, upsert works as insert if no conflict? 
            // Wait, upsert needs a constraint. If we don't provide ID, it's an insert.
            .select()
            .single();

        if (defError) {
            // If it was an invalid UUID error, we might want to try insert without ID?
            // If we removed kpiid, it's just an insert.
            console.error("Error saving definition:", defError);
            throw new Error(`Failed to save definition: ${defError.message}`);
        }

        const realKpiId = savedDef.kpiid;

        // 2. Clear existing details
        const { error: delError } = await supabase
            .from("kpi_dl")
            .delete()
            .eq("kpiid", realKpiId);

        if (delError) {
            throw new Error(`Failed to clear details: ${delError.message}`);
        }

        // 3. Prepare new details
        const detailsToInsert: any[] = [];

        const addSteps = (steps: CalculationStep[], type: number, typeName: string) => {
            steps.forEach((step, index) => {
                let sourceType = null;
                if (step.valueType === 'fhir_filter') sourceType = '1';
                else if (step.valueType === 'indicator_result' && step.value === 'CURRENT_DENOMINATOR') sourceType = '2';

                detailsToInsert.push({
                    kpiid: realKpiId,
                    kpi_dl_type: type,
                    kpi_dl_name: typeName, // Or step name? prompt said "kpi_dl_name 名稱 varchar(100)". Maybe "Numerator", "Denominator"?
                    // kpi_dl_condition_id: index + 1, // generated identity
                    kpi_id_fhir_resource: step.resourceType || null,
                    source_type: sourceType,
                    seq: index + 1,
                    kpi_dl_condition_value: JSON.stringify({
                        path: step.path,
                        operator: step.operator,
                        value: step.value,
                        action: step.action,
                        valueType: step.valueType
                    }),
                    kpi_dl_notes: step.notes || '',
                    kpi_dl_create_user: "system" // or get user from session
                });
            });
        };

        // 1: Denominator, 2: Numerator
        addSteps(indicator.denominatorSteps, 1, indicator.denominatorName || "Denominator");
        addSteps(indicator.numeratorSteps, 2, indicator.numeratorName || "Numerator");

        // 3: Exclusion (Optional in prompt, but good to have)
        if (indicator.exclusionSteps?.length) {
            addSteps(indicator.exclusionSteps, 3, "Exclusion");
        }

        if (detailsToInsert.length > 0) {
            const { error: dlError } = await supabase
                .from("kpi_dl")
                .insert(detailsToInsert);

            if (dlError) throw new Error(`Failed to save details: ${dlError.message}`);
        }

        // 4. Sync Feature Definitions (kpi_ft_detail_inf)
        // Clear existing feature definitions first
        const { error: delFtError } = await supabase
            .from("kpi_ft_detail_inf")
            .delete()
            .eq("kpi_id", realKpiId);

        if (delFtError) {
            console.error("Failed to clear feature definitions:", delFtError);
        }

        let featureInserts: any[] = [];

        if (indicator.featureColumns && indicator.featureColumns.length > 0) {
            // Use manual definitions from UI
            featureInserts = indicator.featureColumns.map(c => ({
                kpi_id: realKpiId,
                column_slot: c.slot,
                display_name: c.displayName,
                fhir_source: c.fhirSource,
                seq: c.seq
            }));
        } else {
            // Auto-extract from steps (Fallback)
            // Extract unique fields from steps to map to generic columns
            const uniqueFeatures = new Map<string, { resource: string; path: string }>();

            const extractFeatures = (steps: CalculationStep[]) => {
                steps.forEach(step => {
                    // Only sync FHIR filters that have a resource and path
                    if (step.valueType === 'fhir_filter' && step.resourceType && step.path) {
                        const key = `${step.resourceType}.${step.path}`;
                        if (!uniqueFeatures.has(key)) {
                            uniqueFeatures.set(key, { resource: step.resourceType, path: step.path });
                        }
                    }
                });
            };

            extractFeatures(indicator.numeratorSteps);
            extractFeatures(indicator.denominatorSteps);
            if (indicator.exclusionSteps) extractFeatures(indicator.exclusionSteps);

            // Helper for Chinese display names
            const getDisplayName = (resource: string, path: string) => {
                const key = `${resource}.${path}`;
                const map: Record<string, string> = {
                    'Patient.id': '病患代碼',
                    'Patient.identifier.value': '病歷號',
                    'Patient.gender': '性別',
                    'Patient.birthDate': '出生日期',
                    'Patient.deceasedDateTime': '死亡時間',
                    'Observation.code': '觀察項目代碼',
                    'Observation.valueQuantity.value': '數值',
                    'Procedure.code': '處置代碼',
                    'Procedure.status': '狀態',
                    'Encounter.class': '就醫類別',
                    'Encounter.hospitalization.dischargeDisposition': '出院狀況',
                    'Location.type': '地點類型',
                    'Practitioner.qualification': '人員資格'
                };
                return map[key] || `${resource} : ${path}`;
            };

            featureInserts = Array.from(uniqueFeatures.values()).slice(0, 20).map((f, i) => ({
                kpi_id: realKpiId,
                column_slot: `column${i + 1}`,
                display_name: getDisplayName(f.resource, f.path),
                fhir_source: `${f.resource}.${f.path}`,
                seq: i + 1
            }));
        }

        if (featureInserts.length > 0) {
            const { error: ftError } = await supabase
                .from("kpi_ft_detail_inf")
                .insert(featureInserts);

            if (ftError) {
                console.error("Failed to save feature definitions:", ftError);
                throw new Error(`Failed to save feature definitions: ${ftError.message}`);
            }
        }

        return { success: true, kpiid: realKpiId };

    } catch (error: any) {
        console.error("Save Indicator Error:", error);
        return { success: false, message: error.message };
    }
}
