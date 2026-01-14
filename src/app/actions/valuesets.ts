'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

// Initialize Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export interface ValueSetItem {
    id: number;
    set_id: string;
    set_name?: string;
    code: string;
    display: string;
    system?: string;
    resource_path?: string;
    hospital_code?: string;
}

export interface ValueSetGroup {
    set_id: string;
    set_name?: string;
    total_codes: number;
    last_updated: string;
    description?: string; // resource_path
}

export async function getValueSets(): Promise<ValueSetGroup[]> {
    const { data, error } = await supabase
        .from('fhir_set_values')
        .select('set_id, set_name, created_at, resource_path'); // Select set_name and resource_path to group

    if (error) {
        console.error("Error fetching ValueSets:", error);
        return [];
    }

    // Group by set_id
    const groups: Record<string, ValueSetGroup> = {};
    data.forEach(item => {
        if (!groups[item.set_id]) {
            groups[item.set_id] = {
                set_id: item.set_id,
                set_name: item.set_name,
                total_codes: 0,
                last_updated: item.created_at,
                description: item.resource_path
            };
        }
        groups[item.set_id].total_codes++;
        // Keep the latest name/desc if multiple rows differ (naive)
        if (item.set_name) groups[item.set_id].set_name = item.set_name;
        if (item.resource_path) groups[item.set_id].description = item.resource_path;

        if (item.created_at > groups[item.set_id].last_updated) {
            groups[item.set_id].last_updated = item.created_at;
        }
    });

    return Object.values(groups);
}

export async function getValueSetCodes(setId: string): Promise<ValueSetItem[]> {
    const { data, error } = await supabase
        .from('fhir_set_values')
        .select('*')
        .eq('set_id', setId)
        .order('code', { ascending: true });

    if (error) {
        console.error(`Error fetching codes for ${setId}:`, error);
        return [];
    }
    return data as ValueSetItem[];
}

export async function addValueSetCode(item: Omit<ValueSetItem, 'id'>) {
    const { error } = await supabase
        .from('fhir_set_values')
        .insert([item]);

    if (error) {
        console.error("Error adding code:", error);
        return { success: false, message: error.message };
    }
    revalidatePath('/settings/valuesets');
    return { success: true };
}

export async function removeValueSetCode(id: number) {
    const { error } = await supabase
        .from('fhir_set_values')
        .delete()
        .eq('id', id);

    if (error) {
        console.error("Error removing code:", error);
        return { success: false, message: error.message };
    }
    revalidatePath('/settings/valuesets');
    return { success: true };
}

export async function createValueSet(setId: string, resourcePath: string) {
    // Just a placeholder insert to create the "Group", since we rely on rows existing.
    // We can insert a dummy row or just handle it on the first code add.
    // For now, checks if exists is implicit.
    // We'll just return success as the frontend will call addValueSetCode next.
    return { success: true };
}

export async function updateValueSetDetails(setId: string, newName: string, newResourcePath?: string) {
    const updates: any = {};
    if (newName !== undefined) updates.set_name = newName;
    if (newResourcePath !== undefined) updates.resource_path = newResourcePath;

    if (Object.keys(updates).length === 0) return { success: true };

    const { error } = await supabase
        .from('fhir_set_values')
        .update(updates)
        .eq('set_id', setId);

    if (error) {
        console.error("Error updating ValueSet details:", error);
        return { success: false, message: error.message };
    }
    revalidatePath('/settings/valuesets');
    return { success: true };
}

export async function updateValueSetCode(id: number, updates: Partial<ValueSetItem>) {
    // Filter out unsafe fields if any (though types protect us mostly)
    const { id: _, set_id: __, ...safeUpdates } = updates as any;

    if (Object.keys(safeUpdates).length === 0) return { success: true };

    const { error } = await supabase
        .from('fhir_set_values')
        .update(safeUpdates)
        .eq('id', id);

    if (error) {
        console.error("Error updating ValueSet Code:", error);
        return { success: false, message: error.message };
    }
    revalidatePath('/settings/valuesets');
    return { success: true };
}
