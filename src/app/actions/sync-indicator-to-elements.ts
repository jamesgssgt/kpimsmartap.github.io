'use server'

import { createClient } from '@/utils/supabase/server';
import { QualityIndicator, Factor } from '@/components/indicator/types';
import { revalidatePath } from 'next/cache';

export async function syncIndicatorToElements(indicatorId: string) {
    const supabase = await createClient();

    try {
        // 1. Fetch Indicator with Steps
        const { data: dlRows, error: dlError } = await supabase
            .from('kpi_dl')
            .select('*')
            .eq('kpiid', indicatorId)
            .order('seq');

        if (dlError) throw new Error(dlError.message);

        const { data: kpiDef, error: kpiError } = await supabase
            .from('kpi_definitions')
            .select('*')
            .eq('kpiid', indicatorId)
            .single();

        if (kpiError) throw new Error(kpiError.message);

        // 2. Parse Steps
        // Type 1 = Denom, Type 2 = Num
        const denomSteps = dlRows.filter((r: any) => r.kpi_dl_type === 1).map(parseStep);
        const numSteps = dlRows.filter((r: any) => r.kpi_dl_type === 2).map(parseStep);

        // 3. Sync Denominator Element
        let denKiftId = kpiDef.denominator_kift_id;
        const denName = kpiDef.denominator_name || `${kpiDef.name} (分母)`;
        if (denomSteps.length > 0) {
            denKiftId = await upsertElement(
                supabase,
                denKiftId,
                denName,
                `Auto-synced from Indicator ${kpiDef.name} Denominator`,
                kpiDef.denominator_c || 'count',
                'FHIR',
                denomSteps
            );
        }

        // 4. Sync Numerator Element
        let numKiftId = kpiDef.numerator_kift_id;
        const numName = kpiDef.numerator_name || `${kpiDef.name} (分子)`;
        if (numSteps.length > 0) {
            numKiftId = await upsertElement(
                supabase,
                numKiftId,
                numName,
                `Auto-synced from Indicator ${kpiDef.name} Numerator`,
                kpiDef.numerator_c || 'count',
                'FHIR',
                numSteps
            );
        }

        // 5. Update Indicator with Links
        await supabase
            .from('kpi_definitions')
            .update({
                denominator_kift_id: denKiftId,
                numerator_kift_id: numKiftId
            })
            .eq('kpiid', indicatorId);

        // 6. Replace KPI DL Steps with Factor References
        // A. Denominator
        if (denKiftId && denomSteps.length > 0) {
            // Delete old steps
            await supabase.from('kpi_dl')
                .delete()
                .eq('kpiid', indicatorId)
                .eq('kpi_dl_type', 1);

            // Insert Factor Reference Step
            await supabase.from('kpi_dl').insert({
                kpiid: indicatorId,
                kpi_dl_type: 1,
                kpi_dl_name: `${kpiDef.name} (分母)`,
                kpi_id_fhir_resource: null,
                source_type: '1',
                seq: 1,
                kpi_dl_condition_value: JSON.stringify({
                    valueType: 'factor',
                    value: denName,
                    action: 'BASE'
                }),
                kpi_dl_notes: 'Auto-replaced by Sync'
            });
        }

        // B. Numerator
        if (numKiftId && numSteps.length > 0) {
            // Delete old steps
            await supabase.from('kpi_dl')
                .delete()
                .eq('kpiid', indicatorId)
                .eq('kpi_dl_type', 2);

            // Insert Factor Reference Step
            await supabase.from('kpi_dl').insert({
                kpiid: indicatorId,
                kpi_dl_type: 2,
                kpi_dl_name: `${kpiDef.name} (分子)`,
                kpi_id_fhir_resource: null,
                source_type: '1',
                seq: 1,
                kpi_dl_condition_value: JSON.stringify({
                    valueType: 'factor',
                    value: numName,
                    action: 'BASE'
                }),
                kpi_dl_notes: 'Auto-replaced by Sync'
            });
        }

        // Create the new Factor Reference Steps to return
        // This avoids needing to re-fetch from DB, we construct what we just inserted.
        const newDenomSteps = (denKiftId && denomSteps.length > 0) ? [{
            id: 'sync-den-' + Math.random().toString(36).substr(2, 9), // Temp ID for FE
            action: 'BASE',
            resourceType: null, // explicit null
            path: '',
            operator: 'equals',
            value: denName,
            notes: 'Auto-replaced by Sync',
            valueType: 'factor'
        }] : [];


        const newNumSteps = (numKiftId && numSteps.length > 0) ? [{
            id: 'sync-num-' + Math.random().toString(36).substr(2, 9),
            action: 'BASE',
            valueType: 'factor',
            resourceType: null, // explicit null
            path: '',
            operator: 'equals',
            value: numName,
            notes: 'Auto-replaced by Sync'
        }] : [];

        revalidatePath('/elements');
        revalidatePath('/indicator'); // Revalidate indicator list/edit pages

        return {
            success: true,
            message: 'Elements synced and Indicator updated successfully',
            data: {
                numeratorSteps: newNumSteps,
                denominatorSteps: newDenomSteps,
                numeratorName: numName,
                denominatorName: denName
            }
        };

    } catch (e: any) {
        console.error("Sync Error:", e);
        return { success: false, message: e.message };
    }
}

function parseStep(row: any) {
    let condition: any = {};
    try { condition = JSON.parse(row.kpi_dl_condition_value); } catch (e) { }

    return {
        action: condition.action || 'BASE',
        valueType: condition.valueType || 'fhir_filter',
        resourceType: row.kpi_id_fhir_resource,
        path: condition.path,
        operator: condition.operator,
        value: condition.value,
        notes: row.kpi_dl_notes
    };
}

async function upsertElement(supabase: any, kiftId: string | null, name: string, desc: string, method: string, type: string, steps: any[]) {
    // 1. Create/Update Definition
    let targetId = kiftId;

    if (!targetId) {
        // Check if exists by name to avoid dupes? (Optional, maybe risky if names collision)
        // For now, create new.
        targetId = null; // Let DB gen UUID logic handled by upsert? types kiftid is uuid. 
        // Need insert.
    }

    const payload: any = {
        name,
        description: desc,
        method,
        source_type: type,
        updated_at: new Date().toISOString()
    };
    if (targetId) payload.kiftid = targetId;

    const { data: saved, error } = await supabase
        .from('kift_definitions')
        .upsert(payload)
        .select()
        .single();

    if (error) throw error;
    targetId = saved.kiftid;

    // 2. Replace Steps
    await supabase.from('kift_steps').delete().eq('kift_id', targetId);

    const stepsInsert = steps.map((s, i) => ({
        kift_id: targetId,
        step_order: i,
        action: s.action,
        value_type: s.valueType,
        resource_type: s.resourceType,
        path: s.path,
        operator: s.operator,
        value: s.value,
        notes: s.notes
    }));

    if (stepsInsert.length > 0) {
        await supabase.from('kift_steps').insert(stepsInsert);
    }

    return targetId;
}
