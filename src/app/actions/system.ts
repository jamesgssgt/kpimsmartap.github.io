
"use server";

import { createClient } from "@/utils/supabase/server";
import { SystemSetting } from "@/types/system";

export async function getSystemSettings(type?: number) {
    const supabase = await createClient();
    let query = supabase.from("system").select("*").order("SysCode", { ascending: true });

    if (type !== undefined) {
        query = query.eq("SysType", type);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching system settings:", error);
        return { success: false, error: error.message };
    }

    return { success: true, data: data as SystemSetting[] };
}

export async function saveSystemSetting(setting: SystemSetting) {
    const supabase = await createClient();

    // Check if exists to determine insert or update logic (upsert is easiest)
    const { data, error } = await supabase
        .from("system")
        .upsert({
            SysCode: setting.SysCode,
            SysName: setting.SysName,
            SysType: setting.SysType,
            SysValue: setting.SysValue,
            Modifieddate: new Date().toISOString(),
        })
        .select()
        .single();

    if (error) {
        console.error("Error saving system setting:", error);
        return { success: false, error: error.message };
    }

    return { success: true, data: data as SystemSetting };
}

export async function deleteSystemSetting(sysCode: string) {
    const supabase = await createClient();

    const { error } = await supabase
        .from("system")
        .delete()
        .eq("SysCode", sysCode);

    if (error) {
        console.error("Error deleting system setting:", error);
        return { success: false, error: error.message };
    }

    return { success: true };
}
