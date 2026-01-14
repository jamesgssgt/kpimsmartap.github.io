'use server';

import { calculateKPI, KPIContext } from "@/lib/kpi-engine";

export async function runKPICalculation(kpiId: string, start: string, end: string, fhirUrl: string) {
    try {
        console.log(`[Action] Triggering KPI Calculation: ${kpiId}`);

        const ctx: KPIContext = {
            kpiId,
            start,
            end,
            fhirBaseUrl: fhirUrl
        };

        const result = await calculateKPI(ctx);

        return {
            success: true,
            message: `Calculation Success. Denom: ${result.denominator}, Num: ${result.numerator}`,
            data: result
        };

    } catch (error: any) {
        console.error("KPI Calculation Error:", error);
        return { success: false, message: error.message };
    }
}
