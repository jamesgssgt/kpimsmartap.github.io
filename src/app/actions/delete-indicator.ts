"use server";

import { createClient } from "@/utils/supabase/server";

export async function deleteIndicator(id: string) {
    const supabase = await createClient();

    try {
        const { error } = await supabase
            .from("kpi_definitions")
            .delete()
            .eq("kpiid", id); // Assuming kpiid is the PK

        if (error) {
            console.error("Error deleting indicator:", error);
            return { success: false, message: error.message };
        }

        return { success: true };
    } catch (error: any) {
        console.error("Delete Indicator Error:", error);
        return { success: false, message: error.message };
    }
}
