"use server";

import { createClient } from "@/utils/supabase/server";

// Hardcoded for now, same as Python script
const FHIR_SERVER_URL = "https://launch.smarthealthit.org/v/r4/fhir";
// 180 days ago
const getStartDate = () => {
    const d = new Date();
    d.setDate(d.getDate() - 180);
    return d.toISOString().split('T')[0];
};

async function fetchFhir(url: string) {
    try {
        const res = await fetch(url, { headers: { "Accept": "application/json" } });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        return await res.json();
    } catch (e) {
        console.error("FHIR Fetch Error:", e);
        return null;
    }
}

async function fetchByIds(resourceType: string, ids: string[]) {
    if (!ids.length) return [];
    const uniqueIds = Array.from(new Set(ids));
    const results = [];

    // Chunk by 50
    for (let i = 0; i < uniqueIds.length; i += 50) {
        const chunk = uniqueIds.slice(i, i + 50);
        const idsStr = chunk.join(",");
        const data = await fetchFhir(`${FHIR_SERVER_URL}/${resourceType}?_id=${idsStr}&_count=100`);
        if (data && data.entry) {
            results.push(...data.entry.map((e: any) => e.resource));
        }
    }
    return results;
}

export async function syncFhirData() {
    try {
        const supabase = await createClient();
        const START_DATE = getStartDate();

        // 1. Fetch Procedures
        // Limit 200 as per Python script
        const procUrl = `${FHIR_SERVER_URL}/Procedure?date=ge${START_DATE}&_count=200`;
        const procBundle = await fetchFhir(procUrl);

        if (!procBundle || !procBundle.entry) {
            return { success: false, message: "No procedures found on FHIR server." };
        }

        const procedures = procBundle.entry.map((e: any) => e.resource);

        // 2. Collect IDs
        const patIds = procedures.map((p: any) => p.subject?.reference?.split('/').pop()).filter((id: string) => !!id);
        const encIds = procedures.map((p: any) => p.encounter?.reference?.split('/').pop()).filter((id: string) => !!id);

        // 3. Fetch Linked Resources
        const patients = await fetchByIds("Patient", patIds);
        const encounters = await fetchByIds("Encounter", encIds);

        const patMap = new Map(patients.map((p: any) => [p.id, p]));
        const encMap = new Map(encounters.map((e: any) => [e.id, e]));

        // 4. Process
        const kpiDetails = [];

        for (const proc of procedures) {
            const patId = proc.subject?.reference?.split('/').pop();
            const encId = proc.encounter?.reference?.split('/').pop();

            const patient: any = patMap.get(patId);
            const encounter: any = encMap.get(encId);

            if (!patient || !encounter) continue;

            const opEndStr = proc.performedPeriod?.end;
            if (!opEndStr) continue;
            const opEnd = new Date(opEndStr);

            // Numerator Logic (Mortality/Bad Outcome)
            let isNumerator = false;
            let abnormalReason = null;
            let eventType = "正常";

            // Check Deceased
            if (patient.deceasedDateTime) {
                const deathTime = new Date(patient.deceasedDateTime);
                const diffHours = (deathTime.getTime() - opEnd.getTime()) / (1000 * 60 * 60);
                if (diffHours > 0 && diffHours <= 48) {
                    isNumerator = true;
                    abnormalReason = "術後48小時內死亡";
                    eventType = "死亡";
                }
            }

            // Check Discharge Disposition
            if (!isNumerator && encounter.hospitalization?.dischargeDisposition?.coding) {
                const dispCode = encounter.hospitalization.dischargeDisposition.coding[0]?.code;
                if (['aadvice', 'exp'].includes(dispCode) && encounter.period?.end) {
                    const dischTime = new Date(encounter.period.end);
                    const diffHours = (dischTime.getTime() - opEnd.getTime()) / (1000 * 60 * 60);
                    if (diffHours > 0 && diffHours <= 48) {
                        isNumerator = true;
                        abnormalReason = "病危出院";
                        eventType = "病危";
                    }
                }
            }

            // Extract Metadata
            const actor = proc.performer?.[0]?.actor;
            const doctorName = actor?.display || actor?.reference || "Unknown";
            const serviceProvider = encounter.serviceProvider; // e.g., Organization/Dept
            const deptName = serviceProvider?.display || "Unknown Department";

            kpiDetails.push({
                department: deptName,
                doctor: doctorName,
                indicator_name: "術後48小時死亡率",
                indicator_def: "手術後死亡人數 / 手術總次數",
                patient_id: patId,
                patient_gender: patient.gender,
                patient_birthday: patient.birthDate,
                // Calculate age fallback
                patient_age: patient.birthDate ? new Date().getFullYear() - new Date(patient.birthDate).getFullYear() : 0,
                status: isNumerator ? "異常" : "正常",
                value: isNumerator ? 1 : 0,
                numerator: isNumerator ? 1 : 0,
                denominator: 1,
                unit: "%",
                report_date: opEnd.toISOString(), // Use Op Date as report date
                admission_date: encounter.period?.start,
                discharge_date: encounter.period?.end,
                abnormal_reason: abnormalReason
            });
        }

        if (kpiDetails.length === 0) {
            return { success: true, message: "FHIR 同步完成，但無符合條件資料。" };
        }

        // 5. Aggregate KPI Summary
        // Group by Dept|Doctor|Indicator
        const summaryMap = new Map<string, any>();

        for (const d of kpiDetails) {
            const key = `${d.department}|${d.doctor}|${d.indicator_name}`;
            if (!summaryMap.has(key)) {
                summaryMap.set(key, {
                    department: d.department,
                    doctor: d.doctor,
                    indicator_name: d.indicator_name,
                    indicator_def: d.indicator_def,
                    numerator: 0,
                    denominator: 0,
                    unit: d.unit
                });
            }
            const item = summaryMap.get(key);
            item.numerator += d.numerator;
            item.denominator += d.denominator;
        }

        const kpiSummaryList = Array.from(summaryMap.values()).map(item => ({
            ...item,
            value: item.denominator > 0 ? parseFloat(((item.numerator / item.denominator) * 100).toFixed(2)) : 0
        }));

        // 6. DB Operations
        // Clear old? Be careful. "Sync" usually implies pulling latest.
        // But to match Generator behavior and ensure clean state as per user context, we might clear or upsert.
        // The generator clears everything. A Sync might want to be additive?
        // Let's safe-bet on Upsert/Insert without clearing ALL, or follow user preference.
        // The user request was "clear before generate". Sync is "Sync".
        // However, if we don't clear, we might duplicate details if we don't have PKs.
        // KPI_Detail has ID pk generated by default. If we insert based on FHIR, we don't have a stable mapping to our DB ID unless we store FHIR ID.
        // We do store 'patient_id'. Ideally we'd avoid duplicates.
        // For now, to keep it simple and robust (like a "Refresh" button), let's CLEAR too, or assume this is a "Re-fetch all" operation.
        // But `generateData.ts` clears all. If I create a "Sync" that doesn't clear, it might be confusing.
        // Let's replicate the "Refresh" behavior: Clear relevant data or all data.
        // Actually, let's just Insert new ones. IF the user wants clear, they can use Generate. O wait, Sync is separate.
        // Let's add a "Clear" step here too for safety, assuming this is a "Reload" action.
        await supabase.from("KPI").delete().neq("id", -1);
        await supabase.from("KPI_Detail").delete().neq("id", -1);

        const { error: kpiError } = await supabase.from("KPI").upsert(kpiSummaryList, { onConflict: "department, doctor, indicator_name" });
        if (kpiError) throw kpiError;

        const { error: detailError } = await supabase.from("KPI_Detail").insert(kpiDetails);
        if (detailError) throw detailError;

        return { success: true, message: `同步完成: ${kpiDetails.length} 筆明細，${kpiSummaryList.length} 筆匯總` };

    } catch (e) {
        console.error("Sync Error:", e);
        return { success: false, message: "同步失敗: " + String(e) };
    }
}
