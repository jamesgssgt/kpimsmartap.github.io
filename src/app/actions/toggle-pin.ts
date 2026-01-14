"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function togglePinIndicator(id: string, isPinned: boolean) {
    const supabase = await createClient();

    try {
        const { error } = await supabase
            .from("kpi_definitions")
            .update({ is_pinned: isPinned })
            .eq("kpiid", id);

        if (error) throw error;

        revalidatePath("/indicators");
        revalidatePath("/dashboard"); // Also revalidate dashboard as content changes

        return { success: true };
    } catch (e: any) {
        console.error("Toggle Pin Error:", e);
        return { success: false, message: e.message };
    }
}
