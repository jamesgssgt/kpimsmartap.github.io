'use server'

import { createClient } from '@/utils/supabase/server';
import { Factor, CalculationAction, ValueType, FhirResource } from '@/components/indicator/types';
import { revalidatePath } from 'next/cache';

// Renaming mapping:
// Factor -> kift_definitions
// Factor.id -> kift_definitions.kiftid
// Factor.steps -> kift_steps (kift_id)

export async function getFactors(): Promise<Factor[]> {
    const supabase = await createClient();

    // Fetch kift_definitions
    const { data: kiftData, error: kiftError } = await supabase
        .from('kift_definitions')
        .select('*')
        .order('created_at', { ascending: false });

    if (kiftError) throw new Error(kiftError.message);

    // Fetch steps for all fetched kifts
    if (!kiftData || kiftData.length === 0) return [];

    const kiftIds = kiftData.map((f: any) => f.kiftid);
    const { data: stepsData, error: stepsError } = await supabase
        .from('kift_steps')
        .select('*')
        .in('kift_id', kiftIds)
        .order('step_order', { ascending: true });

    if (stepsError) {
        console.error("GET Factors Steps Error:", stepsError);
        // Throwing here crashes the UI. Return empty steps or handle gracefully? 
        // If critical, maybe we return what we have? 
        // For now, let's log and throw, but maybe wrapping the whole function is better.
        // Actually, let's just Log and continue with empty steps map if query fails, 
        // so at least definitions show up?
        // But if steps are missing, factors are incomplete.
        // User saw "invalid input syntax for type uuid", so maybe one of the IDs in `kiftIds` is bad?
        // Let's log the IDs too.
        console.error("Kift IDs causing error:", kiftIds);
        throw new Error(`Steps Fetch Error: ${stepsError.message} (Check Server Console)`);
    }

    // Fetch usage stats from kpi_definitions
    const { data: kpiUsage, error: kpiUsageError } = await supabase
        .from('kpi_definitions')
        .select('kpiid, name, numerator_kift_id, denominator_kift_id');

    // Map: kiftId -> Array of {id, name}
    const usageMap = new Map<string, { id: string; name: string }[]>();

    if (kpiUsage) {
        kpiUsage.forEach((k: any) => {
            const indInfo = { id: k.kpiid, name: k.name };

            if (k.numerator_kift_id) {
                const list = usageMap.get(k.numerator_kift_id) || [];
                list.push(indInfo);
                usageMap.set(k.numerator_kift_id, list);
            }
            if (k.denominator_kift_id) {
                const list = usageMap.get(k.denominator_kift_id) || [];
                list.push(indInfo);
                usageMap.set(k.denominator_kift_id, list);
            }
        });
    }

    // Combine data
    const factors: Factor[] = kiftData.map((f: any) => {
        const usageList = usageMap.get(f.kiftid) || [];
        return {
            id: f.kiftid, // Map kiftid to id for frontend compatibility
            name: f.name,
            description: f.description || '',
            method: f.method as 'sum' | 'count' | 'distcount',
            sourceType: f.source_type as 'FHIR' | 'Manual',
            updatedAt: f.updated_at,
            usageCount: usageList.length,
            usedBy: usageList,
            steps: stepsData
                ?.filter((s: any) => s.kift_id === f.kiftid)
                .map((s: any) => ({
                    id: s.id,
                    action: s.action as CalculationAction,
                    valueType: s.value_type as ValueType,
                    resourceType: s.resource_type as FhirResource,
                    path: s.path,
                    operator: s.operator,
                    value: s.value,
                    notes: s.notes
                })) || []
        };
    });

    return factors;
}

export async function getFactorById(id: string): Promise<Factor | null> {
    const supabase = await createClient();

    const { data: kiftData, error: kiftError } = await supabase
        .from('kift_definitions')
        .select('*')
        .eq('kiftid', id)
        .single();

    if (kiftError) return null;

    const { data: stepsData, error: stepsError } = await supabase
        .from('kift_steps')
        .select('*')
        .eq('kift_id', id)
        .order('step_order', { ascending: true });

    if (stepsError) throw new Error(stepsError.message);

    return {
        id: kiftData.kiftid,
        name: kiftData.name,
        description: kiftData.description || '',
        method: kiftData.method as 'sum' | 'count' | 'distcount',
        sourceType: kiftData.source_type as 'FHIR' | 'Manual',
        updatedAt: kiftData.updated_at,
        steps: stepsData?.map((s: any) => ({
            id: s.id,
            action: s.action as CalculationAction,
            valueType: s.value_type as ValueType,
            resourceType: s.resource_type as FhirResource,
            path: s.path,
            operator: s.operator,
            value: s.value,
            notes: s.notes
        })) || []
    };
}

export async function saveFactor(factor: Factor) {
    const supabase = await createClient();

    // 1. Upsert KIFT Definition
    const { data: savedKift, error: kiftError } = await supabase
        .from('kift_definitions')
        .upsert({
            kiftid: factor.id.length < 10 ? undefined : factor.id,
            name: factor.name,
            description: factor.description,
            method: factor.method,
            source_type: factor.sourceType,
            updated_at: new Date().toISOString()
        })
        .select()
        .single();

    if (kiftError) throw new Error(kiftError.message);

    const kiftId = savedKift.kiftid;

    // 2. Delete existing steps
    await supabase.from('kift_steps').delete().eq('kift_id', kiftId);

    // 3. Insert new steps
    if (factor.steps.length > 0) {
        const stepsToInsert = factor.steps.map((s, index) => ({
            kift_id: kiftId,
            step_order: index,
            action: s.action,
            value_type: s.valueType,
            resource_type: s.resourceType,
            path: s.path,
            operator: s.operator,
            value: s.value,
            notes: s.notes
        }));

        const { error: stepsError } = await supabase.from('kift_steps').insert(stepsToInsert);
        if (stepsError) throw new Error(stepsError.message);
    }

    revalidatePath('/elements');
    return kiftId;
}

export async function deleteFactor(id: string) {
    const supabase = await createClient();
    const { error } = await supabase.from('kift_definitions').delete().eq('kiftid', id);
    if (error) throw new Error(error.message);
    revalidatePath('/elements');
}
