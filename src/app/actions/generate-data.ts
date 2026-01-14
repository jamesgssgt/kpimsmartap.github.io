"use server";

import { createClient } from "@/utils/supabase/server";

const FHIR_SERVER_URL = "https://launch.smarthealthit.org/v/r4/fhir";
const TOTAL_CASES = 300;


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

const DAYS_BACK = 180;

// ... (Hospital/Dept/Infra logic remains same)

export async function generateData(mode: 'mortality' | 'antibiotic') {
    try {
        const supabase = await createClient();
        const indicatorName = mode === 'mortality' ? '手術後 48 小時內死亡率' : '預防性抗生素在手術劃刀前1小時內給予比率';

        // Clear existing data FOR THIS INDICATOR only?
        // Or clear all? The user says "Separate into two".
        // If we clear ALL, then running one deletes the other. That is bad.
        // We should only clear data for the target indicator.
        await supabase.from("KPI").delete().eq("indicator_name", indicatorName);
        await supabase.from("KPI_Detail").delete().eq("indicator_name", indicatorName);

        // Also need to clear/reset FHIR? 
        // Realistically, we can't easily "reset" FHIR without wiping everything.
        // For this demo, we can just ADD to FHIR (upsert).
        // But if we re-run, we might duplicate patients if we don't hold state.
        // The current script manages IDs deterministically-ish or just randoms.
        // Let's assume we proceed with generating NEW data or Overwriting based on ID collision.
        // "getLongId" is random.
        // To avoid exploding DB size, maybe we DO want to clear everything if it's a "Demo Generator".
        // But the user asked to split. 
        // Let's compromise: The generator wipes the purely "Transactional" KPI tables for the specific indicator, 
        // but keeps or overwrites FHIR data. 
        // actually, safely we can just append, but `KPI` table (summary) needs recalc.
        // The `KPI` delete above handles the summary.
        // The `KPI_Detail` delete handles the detail.

        const infra = await createInfrastructure();
        const kpiDetailsBuffer = [];

        // Config
        const targetTotal = 1000;

        // Flatten depts
        const allDepts: { hospCode: string; deptInfo: any }[] = [];
        for (const [hCode, hData] of Object.entries(infra)) {
            for (const d of hData.depts) {
                allDepts.push({ hospCode: hCode, deptInfo: d });
            }
        }

        // Helper to generate a single case
        const createCase = async (dayIndex: number, specificDept?: any, forceAbnormal?: boolean) => {
            // ... (Date/Dept logic same)
            const now = new Date();
            const opStart = new Date(now.getTime() - dayIndex * 24 * 60 * 60 * 1000);
            opStart.setHours(randomInt(8, 16));
            opStart.setMinutes(randomInt(0, 59));
            const anesthesiaStart = new Date(opStart.getTime() - 30 * 60 * 1000);
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
            }

            // Risk logic
            let isBad = false;
            if (forceAbnormal) {
                isBad = true;
            } else {
                isBad = Math.random() < 0.02;
            }

            // 1. Mortality Logic
            let isMortalityNum = false;
            let isDeceased = false;
            let mortalityReason = null;
            let deathTime = null;
            let dischargeDispositionCode = "home";

            // Only apply abnormal logic if mode matches or it's random chance?
            // User wants "Generating demo data... split into two".
            // If I click "Mortality", I expect Mortality data to be interesting.
            // I don't necessarily care about Antibiotics data in that click, or I might want it "normal".

            if (mode === 'mortality' && isBad) {
                const isAAD = Math.random() < 0.3;
                // ... (Mortality logic)
                const hoursPostAnes = randomInt(2, 46);
                const eventTime = new Date(anesthesiaStart.getTime() + hoursPostAnes * 60 * 60 * 1000);
                dischargeDate.setTime(eventTime.getTime());
                isMortalityNum = true;
                if (isAAD) {
                    mortalityReason = "病危自動出院(AAD) - 麻醉後48小時內";
                    dischargeDispositionCode = "aadvice";
                } else {
                    isDeceased = true;
                    deathTime = eventTime;
                    mortalityReason = "術後48小時內院內死亡";
                    dischargeDispositionCode = "exp";
                }
            }

            // 2. Antibiotic Logic
            // If mode is antibiotic, we might force bad cases if forceAbnormal is true.
            let isAntibioticSuccess = true;

            if (mode === 'antibiotic') {
                if (forceAbnormal) {
                    isAntibioticSuccess = false; // Force fail
                } else {
                    isAntibioticSuccess = Math.random() > 0.08; // Random fail (92% success rate)
                }
            } else {
                // If generating mortality, just random normal-ish antibiotic
                isAntibioticSuccess = Math.random() > 0.08;
            }

            const antibioticNum = isAntibioticSuccess ? 1 : 0;
            const antibioticReason = isAntibioticSuccess ? null : "未在劃刀前1小時內給藥";

            // ... (FHIR saves same as before)
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
                class: { code: "IMP" }, // Inpatient
                subject: { reference: `Patient/${patId}` },
                serviceProvider: { reference: `Organization/${chosenDeptObj.org_id}`, display: chosenDeptObj.org_name },
                hospitalization: {
                    dischargeDisposition: { coding: [{ code: dischargeDispositionCode }] }
                },
                period: {
                    start: admissionDate.toISOString(),
                    end: dischargeDate.toISOString()
                }
            });

            const procId = getLongId();
            const icdCodes = [
                { code: "0B110Z4", display: "Dilatation of Trachea" },
                { code: "021009W", display: "Bypass Coronary Artery, One Site" },
                { code: "0DTJ0ZZ", display: "Resection of Appendix" },
                { code: "0SRC0J9", display: "Replacement of Right Knee Joint" },
                { code: "0TY00Z0", display: "Transplantation of Right Kidney, Allogeneic" },
                { code: "0FB03ZZ", display: "Excision of Liver, Percutaneous" },
                { code: "0SG10Z1", display: "Fusion of Lumbar Vertebral Joint" },
                { code: "047K04Z", display: "Dilation of Right Femoral Artery" },
                { code: "0HQ9XZZ", display: "Repair of Skin, External" },
                { code: "0W9B3ZZ", display: "Drainage of Right Pleural Cavity" }
            ];
            const selectedIcd = randomChoice(icdCodes);

            await fhirSave("Procedure", {
                resourceType: "Procedure",
                id: procId,
                status: "completed",
                subject: { reference: `Patient/${patId}` },
                encounter: { reference: `Encounter/${encId}` },
                performedPeriod: {
                    start: opStart.toISOString(),
                    end: opEnd.toISOString()
                },
                code: {
                    coding: [{
                        system: "http://hl7.org/fhir/sid/icd-10-pcs",
                        code: selectedIcd.code,
                        display: selectedIcd.display
                    }]
                },
                performer: [{ actor: { reference: `Practitioner/${docId}` } }]
            });

            // Report Date Logic: Surgery Completion Date
            const reportDate = opEnd.toISOString();
            const hospNameRaw = chosenDeptObj.org_name.match(/【(.*?)】/)?.[1] || "Unknown Hospital";

            const results = [];

            // ONLY push the result for the requested mode
            if (mode === 'mortality') {
                results.push({
                    department: deptName,
                    doctor: docName,
                    indicator_name: "手術後 48 小時內死亡率",
                    indicator_def: "麻醉開始後48小時內死亡(含AAD)",
                    numerator: isMortalityNum ? 1 : 0,
                    denominator: 1,
                    value: isMortalityNum ? 1 : 0,
                    patient_id: patId,
                    patient_gender: gender,
                    patient_birthday: birthDateStr,
                    patient_age: age,
                    status: isMortalityNum ? "異常" : "正常",
                    unit: "%",
                    report_date: reportDate,
                    admission_date: admissionDate.toISOString(),
                    discharge_date: dischargeDate.toISOString(),
                    op_start: opStart.toISOString(),
                    op_end: opEnd.toISOString(),
                    abnormal_reason: mortalityReason,
                    monthKey: opStart.toISOString().substring(0, 7),
                    hospital_name: hospNameRaw,
                    doctor_id: docId
                });
            }

            if (mode === 'antibiotic') {
                results.push({
                    department: deptName,
                    doctor: docName,
                    indicator_name: "預防性抗生素在手術劃刀前1小時內給予比率",
                    indicator_def: "手術劃刀前1小時內給予預防性抗生素人次 / 手術人次 * 100%",
                    numerator: antibioticNum,
                    denominator: 1,
                    value: antibioticNum,
                    patient_id: patId,
                    patient_gender: gender,
                    patient_birthday: birthDateStr,
                    patient_age: age,
                    status: !isAntibioticSuccess ? "異常" : "正常",
                    unit: "%",
                    report_date: reportDate,
                    admission_date: admissionDate.toISOString(),
                    discharge_date: dischargeDate.toISOString(),
                    op_start: opStart.toISOString(),
                    op_end: opEnd.toISOString(),
                    abnormal_reason: antibioticReason,
                    monthKey: opStart.toISOString().substring(0, 7),
                    hospital_name: hospNameRaw,
                    doctor_id: docId
                });
            }

            return results;
        };

        // ... (Loop logic adjusted slightly for selective forcing)

        // 1. Coverage Loop
        const coveragePromises = [];

        for (let d = 0; d < DAYS_BACK; d++) {
            for (const deptItem of allDepts) {
                // Generate base coverage (normal or random bad)
                coveragePromises.push(() => createCase(d, deptItem.deptInfo, false));
            }
        }

        // Execute Coverage
        const generatedItems = [];
        const abnormalCounts: Record<string, number> = {};

        const processBatch = async (taskFactories: (() => Promise<any>)[]) => {
            const results = [];
            for (let i = 0; i < taskFactories.length; i += 50) {
                const batch = taskFactories.slice(i, i + 50);
                const batchRes = await Promise.all(batch.map(f => f()));
                results.push(...batchRes.flat());
            }
            return results;
        };

        const coverageResults = await processBatch(coveragePromises);
        generatedItems.push(...coverageResults);

        // Count Abnormals (Only for the active mode's numerator)
        coverageResults.forEach(item => {
            if (item.numerator > 0) { // For mortality, num=1 means bad. For antibiotic, num=0 means bad (logic inverted in code?)
                // Wait, previous code:
                // Mortality: numerator = 1 (Bad)
                // Antibiotic: numerator = 1 (Good), value = 1.
                // Status: !isAntibioticSuccess ? "異常" : "正常"

                // We want to count *rows* that will be 'abnormal' to ensure we have enough 'abnormal' cases for demo.
                // Mortality: Abnormal if numerator == 1.
                // Antibiotic: Abnormal if status == '異常' (which means numerator == 0).

                const isAbnormal = item.status === '異常';
                if (isAbnormal) {
                    abnormalCounts[item.monthKey] = (abnormalCounts[item.monthKey] || 0) + 1;
                }
            }
        });

        // 2. Abnormal Filling
        const abnormalPromises = [];
        const daysByMonth: Record<string, number[]> = {};
        for (let d = 0; d < DAYS_BACK; d++) {
            const now = new Date();
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
        // Increase target if 6 months? 1000 might be thin for 180 days * 9 depts = 1620 min coverage?
        // 180 days * 9 depts = 1620 cases just for 1/day/dept.
        // So target should be higher, maybe 2000? Or just let coverage be the floor.
        // If coverage is ~1600, target 1000 is useless.
        // Let's set target to max(2000, coverage + 100).
        const realTarget = Math.max(2000, generatedItems.length + 50);

        while (currentTotal < realTarget) {
            const dIndex = randomInt(0, DAYS_BACK - 1);
            fillPromises.push(() => createCase(dIndex, undefined, false));
            currentTotal++;
        }

        const fillResults = await processBatch(fillPromises);
        generatedItems.push(...fillResults);

        kpiDetailsBuffer.push(...generatedItems);

        // ... Summary Calculation & Save Logic (Only for the indicatorName we are processing) ...
        const summaryMap = new Map<string, any>();
        for (const d of kpiDetailsBuffer) {
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

        const { error: kpiError } = await supabase.from("KPI").upsert(kpiSummaryList, { onConflict: "department, doctor, indicator_name" });
        if (kpiError) console.error("Error saving KPI Summary:", kpiError);

        const cleanDetails = kpiDetailsBuffer.map(({ monthKey, ...rest }) => rest);
        const { error: detailError } = await supabase.from("KPI_Detail").insert(cleanDetails);
        if (detailError) console.error("Error saving KPI Details:", detailError);

        if (kpiError || detailError) {
            return { success: false, message: "生成過程中發生資料庫錯誤" };
        }

        return { success: true, message: `[${indicatorName}] 生成完成 (共 ${generatedItems.length} 筆)` };

    } catch (err) {
        console.error(err);
        return { success: false, message: "生成失敗: " + String(err) };
    }
}

export async function clearGeneratedData(mode: 'all' | 'mortality' | 'antibiotic' = 'all') {
    try {
        const supabase = await createClient();

        if (mode === 'all') {
            const { error: e1 } = await supabase.from("KPI").delete().neq('id', -1); // Delete all (assuming bigint id)
            const { error: e2 } = await supabase.from("KPI_Detail").delete().neq('id', -1); // Delete all
            // Note: Supabase delete without where clause might be blocked by safe mode in some clients, 
            // but usually allowed in server-side client if RLS allows or service key used.
            // Using .neq('id', '...') is a trick to delete all if "delete()" without args is blocked.

            if (e1) throw new Error("Error clearing KPI: " + e1.message);
            if (e2) throw new Error("Error clearing KPI_Detail: " + e2.message);
        } else {
            const indicatorName = mode === 'mortality' ? '手術後 48 小時內死亡率' : '預防性抗生素在手術劃刀前1小時內給予比率';
            const { error: e1 } = await supabase.from("KPI").delete().eq("indicator_name", indicatorName);
            const { error: e2 } = await supabase.from("KPI_Detail").delete().eq("indicator_name", indicatorName);

            if (e1) throw new Error("Error clearing KPI: " + e1.message);
            if (e2) throw new Error("Error clearing KPI_Detail: " + e2.message);
        }

        return { success: true, message: "資料已成功清除" };
    } catch (err) {
        console.error("Clear Data Error:", err);
        return { success: false, message: "清除失敗: " + String(err) };
    }
}
