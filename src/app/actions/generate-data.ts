"use server";

import { createClient } from "@/utils/supabase/server";

const FHIR_SERVER_URL = "https://launch.smarthealthit.org/v/r4/fhir";
const TOTAL_CASES = 300;
const DAYS_BACK = 180;

interface Hospital {
    code: string;
    name: string;
    risk: number;
}

const HOSPITALS: Hospital[] = [
    { code: "TP_GEN", name: "台北綜合醫院", risk: 1.0 },
    { code: "NAT_MED", name: "國立醫學中心", risk: 1.2 },
    { code: "CITY_UN", name: "市立聯合醫院", risk: 0.8 },
];

const DEPT_TEMPLATE = {
    SURG: { name: "外科", docs: ["劉", "張"] },
    CARDIO: { name: "心臟科", docs: ["吳", "蔡"] },
    ORTHO: { name: "骨科", docs: ["王", "李"] },
};

// Utils
function getLongId() {
    const prefix = ["A", "B", "H", "M"][Math.floor(Math.random() * 4)];
    const ts = Date.now().toString().slice(-7);
    const rand = Math.floor(1000 + Math.random() * 9000).toString();
    return `${prefix}${ts}${rand}`;
}

function randomChoice<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function fhirSave(resourceType: string, data: any) {
    const url = `${FHIR_SERVER_URL}/${resourceType}/${data.id}`;
    try {
        const res = await fetch(url, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        if (!res.ok) {
            console.error(`Failed to save FHIR ${resourceType}/${data.id}: ${res.status}`);
        }
    } catch (e) {
        console.error(`Error saving FHIR ${resourceType}:`, e);
    }
}

interface InfraData {
    risk: number;
    depts: {
        org_id: string;
        org_name: string;
        dept_code: string;
        doctors: string[];
        doc_names: Record<string, string>;
    }[];
}

async function createInfrastructure() {
    const infra: Record<string, InfraData> = {};

    for (const hosp of HOSPITALS) {
        const h_code = hosp.code;
        infra[h_code] = { risk: hosp.risk, depts: [] };

        // Hosp Org
        const hosp_org_id = getLongId();
        await fhirSave("Organization", {
            resourceType: "Organization",
            id: hosp_org_id,
            name: hosp.name,
            type: [{ text: "Hospital" }],
        });

        for (const [d_code, d_info] of Object.entries(DEPT_TEMPLATE)) {
            const dept_org_id = getLongId();
            const full_dept_name = `【${hosp.name}】${d_info.name}`;

            await fhirSave("Organization", {
                resourceType: "Organization",
                id: dept_org_id,
                name: full_dept_name,
                partOf: { reference: `Organization/${hosp_org_id}` }
            });

            const dept_docs: string[] = [];
            const doc_names: Record<string, string> = {};

            for (const surname of d_info.docs) {
                const doc_id = getLongId();
                const doc_name_short = `${surname}醫師`;
                const full_name = `${doc_name_short} (${hosp.name.slice(0, 2)})`;

                await fhirSave("Practitioner", {
                    resourceType: "Practitioner",
                    id: doc_id,
                    name: [{ text: full_name }]
                });

                dept_docs.push(doc_id);
                doc_names[doc_id] = doc_name_short;
            }

            infra[h_code].depts.push({
                org_id: dept_org_id,
                org_name: full_dept_name,
                dept_code: d_code,
                doctors: dept_docs,
                doc_names: doc_names
            });
        }
    }
    return infra;
}

export async function generateData() {
    try {
        const supabase = await createClient();

        // Clear existing data
        await supabase.from("KPI").delete().neq("id", -1);
        await supabase.from("KPI_Detail").delete().neq("id", -1);

        const infra = await createInfrastructure();
        const kpiDetailsBuffer = [];

        // Revised Logic:
        // 1. Coverage: Each Dept, Each Day -> 1 case.
        // 2. Abnormals: At least 10 per month.
        // 3. Total: Fill up to 1000.

        // Config
        const targetTotal = 1000;
        const daysBack = 100; // 100 days fits nicely into ~1000 cases with 9 depts (900 cases)

        // Flatten depts for easy iteration
        const allDepts: { hospCode: string; deptInfo: any }[] = [];
        for (const [hCode, hData] of Object.entries(infra)) {
            for (const d of hData.depts) {
                allDepts.push({ hospCode: hCode, deptInfo: d });
            }
        }

        // Helper to generate a single case
        const createCase = async (dayIndex: number, specificDept?: any, forceAbnormal?: boolean) => {
            // Dates - Fixed Anchor to 2025-11-20
            const now = new Date("2025-11-20T23:59:59");
            const opStart = new Date(now.getTime() - dayIndex * 24 * 60 * 60 * 1000);
            opStart.setHours(randomInt(8, 16));
            opStart.setMinutes(randomInt(0, 59));

            const opEnd = new Date(opStart.getTime() + randomInt(60, 240) * 60 * 1000);
            const admissionDate = new Date(opStart.getTime() - randomInt(1, 2) * 24 * 60 * 60 * 1000);
            const dischargeDate = new Date(opEnd.getTime() + randomInt(2, 10) * 24 * 60 * 60 * 1000);

            // Select Dept
            let chosenDeptObj = specificDept;
            let hCode = "";

            if (!chosenDeptObj) {
                const randomSel = randomChoice(allDepts);
                chosenDeptObj = randomSel.deptInfo;
                hCode = randomSel.hospCode;
            } else {
                // Find hosp code for specific dept? (Not strictly needed for logic below if we have the object)
                // We need hCode for risk calculation if we want to follow original logic, 
                // but simpler is to just use the object.
                // Let's assume specificDept passed is from allDepts structure if possible, 
                // or we just look it up.
                // For the loop 'allDepts', we have hCode.
            }

            // Re-find hData if needed for risk - simplifying risk for this forced generation
            // Risk logic
            let isBad = false;
            if (forceAbnormal) {
                isBad = true;
            } else {
                // Low random chance for normal coverage
                isBad = Math.random() < 0.02;
            }

            let isDeceased = false;
            let abnormalReason = null;
            let deathTime = null;

            if (isBad) {
                deathTime = new Date(opEnd.getTime() + randomInt(2, 46) * 60 * 60 * 1000);
                isDeceased = true;
                abnormalReason = "術後48小時內死亡";
                // FIX: If deceased, Discharge Date is Death Time
                dischargeDate.setTime(deathTime.getTime());
            }

            // Decorate Data
            // @ts-ignore
            const deptName = DEPT_TEMPLATE[chosenDeptObj.dept_code].name;
            const docId = randomChoice(chosenDeptObj.doctors as string[]);
            const docName = chosenDeptObj.doc_names[docId];

            // FHIR Resources
            const patId = getLongId();
            const gender = randomChoice(["male", "female"]);
            const age = randomInt(20, 90);
            const birthDate = new Date(now);
            birthDate.setFullYear(birthDate.getFullYear() - age);
            birthDate.setMonth(randomInt(0, 11));
            birthDate.setDate(randomInt(1, 28));
            const birthDateStr = birthDate.toISOString().split('T')[0];

            // ... Saving FHIR resources
            await fhirSave("Patient", {
                resourceType: "Patient",
                id: patId,
                gender: gender,
                birthDate: birthDateStr,
                deceasedDateTime: isDeceased && deathTime ? deathTime.toISOString() : undefined
            });

            const encId = getLongId();
            await fhirSave("Encounter", {
                resourceType: "Encounter",
                id: encId,
                status: "finished",
                class: { code: "IMP" },
                subject: { reference: `Patient/${patId}` },
                serviceProvider: { reference: `Organization/${chosenDeptObj.org_id}`, display: chosenDeptObj.org_name },
                hospitalization: isBad ? { dischargeDisposition: { coding: [{ code: "exp" }] } } : undefined
            });

            const procId = getLongId();
            await fhirSave("Procedure", {
                resourceType: "Procedure",
                id: procId,
                status: "completed",
                subject: { reference: `Patient/${patId}` },
                encounter: { reference: `Encounter/${encId}` },
                performedPeriod: { end: opEnd.toISOString() },
                code: { coding: [{ display: "Surgery" }] },
                performer: [{ actor: { reference: `Practitioner/${docId}` } }]
            });

            // Report Date Logic: 
            // If Death -> Death Date (which is now dischargeDate)
            // If Alive -> Discharge Date
            const reportDate = dischargeDate.toISOString();

            return {
                department: deptName,
                doctor: docName,
                indicator_name: "術後48小時死亡率",
                indicator_def: "手術後死亡人數 / 手術總次數",
                numerator: isDeceased ? 1 : 0,
                denominator: 1,
                value: isDeceased ? 1 : 0,
                patient_id: patId,
                patient_gender: gender,
                patient_birthday: birthDateStr,
                status: isDeceased ? "異常" : "正常",
                unit: "%",
                report_date: reportDate,
                admission_date: admissionDate.toISOString(),
                discharge_date: dischargeDate.toISOString(),
                abnormal_reason: abnormalReason,
                monthKey: opStart.toISOString().substring(0, 7) // for tracking
            };
        };

        // 1. Coverage Loop
        // Generate promises in chunks to prevent overwhelming
        const coveragePromises = [];

        for (let d = 0; d < daysBack; d++) {
            for (const deptItem of allDepts) {
                coveragePromises.push(() => createCase(d, deptItem.deptInfo, false));
            }
        }

        // Execute Coverage
        // Process in chunks of 50
        const generatedItems = [];
        const abnormalCounts: Record<string, number> = {};

        const processBatch = async (taskFactories: (() => Promise<any>)[]) => {
            const results = [];
            for (let i = 0; i < taskFactories.length; i += 50) {
                const batch = taskFactories.slice(i, i + 50);
                const batchRes = await Promise.all(batch.map(f => f()));
                results.push(...batchRes);
            }
            return results;
        };

        const coverageResults = await processBatch(coveragePromises);
        generatedItems.push(...coverageResults);

        // Count Abnormals
        coverageResults.forEach(item => {
            if (item.numerator > 0) {
                abnormalCounts[item.monthKey] = (abnormalCounts[item.monthKey] || 0) + 1;
            }
        });

        // 2. Abnormal Filling
        const abnormalPromises = [];
        // Identify months we covered
        const coveredMonths = new Set(generatedItems.map(i => i.monthKey));

        for (const m of Array.from(coveredMonths)) {
            const currentCount = abnormalCounts[m] || 0;
            if (currentCount < 10) {
                const needed = 10 - currentCount;
                for (let k = 0; k < needed; k++) {
                    // Find a random day in this month?
                    // Simplified: just pick a random dayIndex that maps to this month?
                    // Easier: Iterative check or just pick random days until we hit the month.
                    // Or reuse createCase with a specific dayIndex?
                    // We need to reverse map Month -> DayIndex ranges.
                    // Since dayIndex 0 = Nov 20, DayIndex inc = Date dec.
                    // We can just pick a random dayIndex roughly.
                    // OR: simpler, just pass a flag to createCase to "pick a day in this month".
                    // But createCase takes dayIndex.
                    // Let's just generate random dayIndices (0..100) until we find appropriate month?

                    // Actually, let's just create a new helper or pick a valid dayIndex.
                    // Month M (e.g. 2025-11).
                    // We iterate 0..100. Calculate month. If match, use it.
                    // Optimization: Pre-map dayIndex to Month.
                }
            }
        }

        // Refined Abnormal Filling Strategy:
        // We know dayIndex 0 is Nov 20. 
        // We can just iterate available dayIndices, group by Month.
        const daysByMonth: Record<string, number[]> = {};
        for (let d = 0; d < daysBack; d++) {
            const now = new Date("2025-11-20T23:59:59");
            const date = new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
            const mKey = date.toISOString().substring(0, 7);
            if (!daysByMonth[mKey]) daysByMonth[mKey] = [];
            daysByMonth[mKey].push(d);
        }

        for (const [mKey, days] of Object.entries(daysByMonth)) {
            const currentCount = abnormalCounts[mKey] || 0;
            const needed = 10 - currentCount;
            if (needed > 0) {
                for (let k = 0; k < needed; k++) {
                    const dIndex = randomChoice(days);
                    abnormalPromises.push(() => createCase(dIndex, undefined, true));
                }
            }
        }

        const abnormalResults = await processBatch(abnormalPromises);
        generatedItems.push(...abnormalResults);

        // 3. Fill Remainder to Target
        let currentTotal = generatedItems.length;
        const fillPromises = [];
        while (currentTotal < targetTotal) {
            const dIndex = randomInt(0, daysBack - 1);
            fillPromises.push(() => createCase(dIndex, undefined, false));
            currentTotal++;
        }

        const fillResults = await processBatch(fillPromises);
        generatedItems.push(...fillResults);

        kpiDetailsBuffer.push(...generatedItems);

        // Aggregate KPI in memory
        const summaryMap = new Map<string, any>();

        for (const d of kpiDetailsBuffer) {
            // Key: hospital|dept|doctor|indicator
            // Note: hospital is not in d anymore, but we need it for unique key if we want to distinguish? 
            // Actually, the previous logic used it. Let's rely on department as it is unique enough or include hospital in the object but remove for DB.
            // A better approach: The 'department' name already includes hospital name "【Hospital】Dept".
            // So we can just use department.
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

        // Save to Supabase

        // 1. KPI
        const { error: kpiError } = await supabase.from("KPI").upsert(kpiSummaryList, { onConflict: "department, doctor, indicator_name" }); // Assuming conflict strategy or just insert
        // Note: The python script uses 'resolution=merge-duplicates' which is upsert. 
        // Better to ensure table has constraints or just insert. For now using upsert if PK exists, or insert.
        // If no PK, we might duplicate. Python script implies standard bulk insert.
        // Let's assume standard Insert for simplicity unless constraints are known.
        // But `upsert` is safer if run multiple times.
        if (kpiError) console.error("Error saving KPI Summary:", kpiError);

        // 2. KPI Details
        // Remove 'monthKey' which is for internal logic only
        const cleanDetails = kpiDetailsBuffer.map(({ monthKey, ...rest }) => rest);
        const { error: detailError } = await supabase.from("KPI_Detail").insert(cleanDetails);
        if (detailError) console.error("Error saving KPI Details:", detailError);

        if (kpiError || detailError) {
            return { success: false, message: "生成過程中發生資料庫錯誤" };
        }

        return { success: true, message: "資料生成完成" };

    } catch (err) {
        console.error(err);
        return { success: false, message: "生成失敗: " + String(err) };
    }
}
