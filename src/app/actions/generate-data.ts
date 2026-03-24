"use server";

import { createClient } from "@/utils/supabase/server";

const FHIR_SERVER_URL = process.env.NEXT_PUBLIC_FHIR_BASE_URL || "http://172.16.7.78:8082/fhir";
const TOTAL_CASES = 300;


interface Hospital {
    code: string;
    name: string;
    risk: number;
}

const HOSPITALS: Hospital[] = [
    { code: "TP-GEN", name: "台北綜合醫院", risk: 1.0 }
];

const DEPT_TEMPLATE = {
    SURG: { name: "一般外科", docs: ["林建國", "張志豪", "王大明", "徐世鈞", "楊志強"] },
    CARDIO: { name: "心臟外科", docs: ["陳明輝", "王家銘", "劉文正", "邱建宏"] },
    ORTHO: { name: "骨科", docs: ["吳文彬", "李宗翰", "郭台倫", "林俊宏", "陳信宏"] },
    NEURO: { name: "神經外科", docs: ["黃志祥", "劉俊宏", "吳宗剛", "許家豪"] },
    GASTRO: { name: "消化外科", docs: ["蔡仁傑", "楊智捷", "張瑞平", "周文彬", "王志偉"] },
    CHEST: { name: "胸腔外科", docs: ["趙子龍", "周建平", "林偉哲", "黃柏鈞"] },
    URO: { name: "泌尿外科", docs: ["鄭建銘", "陳國華", "李宇明", "張家銘", "蔡秉宏"] },
    PED: { name: "小兒外科", docs: ["李宇軒", "林俊希", "王文華", "陳冠宇"] },
    OBS: { name: "婦產科", docs: ["陳玉婷", "黃依珊", "林雅雯", "李佳玲", "張美惠"] },
    ENT: { name: "耳鼻喉科", docs: ["吳浩宇", "林柏宏", "陳柏翰", "黃建宇"] },
    PLASTIC: { name: "整形外科", docs: ["張家豪", "陳品睿", "吳佳融", "林子揚", "楊承翰"] }
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
        const hosp_org_id = `org-${hosp.code.toLowerCase()}`;
        await fhirSave("Organization", {
            resourceType: "Organization",
            id: hosp_org_id,
            name: hosp.name,
            type: [{ text: "Hospital" }],
        });

        for (const [d_code, d_info] of Object.entries(DEPT_TEMPLATE)) {
            const dept_org_id = `org-${hosp.code.toLowerCase()}-${d_code.toLowerCase()}`;
            const full_dept_name = `【${hosp.name}】${d_info.name}`;

            await fhirSave("Organization", {
                resourceType: "Organization",
                id: dept_org_id,
                name: full_dept_name,
                partOf: { reference: `Organization/${hosp_org_id}` }
            });

            const dept_docs: string[] = [];
            const doc_names: Record<string, string> = {};

            for (let i = 0; i < d_info.docs.length; i++) {
                const surname = d_info.docs[i];
                const doc_id = `doc-${hosp.code.toLowerCase()}-${d_code.toLowerCase()}-${i}`;
                const doc_name_short = surname;
                const full_name = `${doc_name_short} (${hosp.name.slice(0, 2)})`;

                await fhirSave("Practitioner", {
                    resourceType: "Practitioner",
                    id: doc_id,
                    name: [{ text: full_name }]
                });

                await fhirSave("PractitionerRole", {
                    resourceType: "PractitionerRole",
                    id: `pr-${doc_id}`,
                    practitioner: { reference: `Practitioner/${doc_id}` },
                    organization: { reference: `Organization/${hosp_org_id}` }
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

const START_DATE = new Date("2025-06-01T00:00:00+08:00");
const END_DATE = new Date("2026-02-28T23:59:59+08:00");
const DAYS_BACK = Math.ceil((END_DATE.getTime() - START_DATE.getTime()) / (1000 * 60 * 60 * 24));

// ... (Hospital/Dept/Infra logic remains same)

// Force renamed to bypass Next.js Server Action cache hash clinging to old Date.now() logic
export async function generateDataV2(mode: 'mortality' | 'antibiotic') {
    try {
        const fhirBundleBuffer: any[] = [];
        const { createClient } = await import("@/utils/supabase/server");
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

        let genCounter = 0;

        // Helper to generate a single case
        const createCase = async (dayIndex: number, specificDept?: any, forceAbnormal?: boolean) => {
            genCounter++;
            // ... (Date/Dept logic same)
            const now = END_DATE;
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

            // 1. Mortality Logic
            let isMortalityNum = false;
            let isDeceased = false;
            let mortalityReason = null;
            let deathTime = null;
            let dischargeDispositionCode = "home";
            let isBad = false;

            if (mode === 'mortality') {
                const isAAD = Math.random() < 0.3;
                const baseProb = ["CARDIO", "NEURO"].includes(chosenDeptObj.dept_code) ? 0.05 : 0.01;
                isBad = forceAbnormal || Math.random() < baseProb;

                if (isBad) {
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
            }

            // 2. Antibiotic Logic
            let isAntibioticSuccess = true;

            if (mode === 'antibiotic') {
                const baseProb = ["ORTHO", "ENT"].includes(chosenDeptObj.dept_code) ? 0.15 : 0.03;
                if (forceAbnormal) {
                    isAntibioticSuccess = false; // Force fail
                } else {
                    isAntibioticSuccess = Math.random() > baseProb; 
                }
            } else {
                // If generating mortality, just random normal-ish antibiotic
                isAntibioticSuccess = Math.random() > 0.05;
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
            const patId = `pat-${mode}-${genCounter}`;
            const gender = randomChoice(["male", "female"]);
            const age = randomInt(20, 90);
            const birthDate = new Date(now);
            birthDate.setFullYear(birthDate.getFullYear() - age);
            birthDate.setMonth(randomInt(0, 11));
            birthDate.setDate(randomInt(1, 28));
            const birthDateStr = birthDate.toISOString().split('T')[0];

            const hospNameRaw = chosenDeptObj.org_name.match(/【(.*?)】/)?.[1] || "Unknown Hospital";
            const hosp_org_id = hCode ? `org-${hCode.toLowerCase()}` : "org-tp-gen";

            fhirBundleBuffer.push({
                resourceType: "Patient",
                id: patId,
                gender: gender,
                birthDate: birthDateStr,
                deceasedDateTime: isDeceased && deathTime ? deathTime.toISOString() : undefined,
                managingOrganization: { reference: `Organization/${hosp_org_id}` }
            });

            const encId = `enc-${mode}-${genCounter}`;
            fhirBundleBuffer.push({
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

            const procId = `proc-${mode}-${genCounter}`;
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

            fhirBundleBuffer.push({
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
            const now = END_DATE;
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

        // Upload FHIR Resources in Transaction Bundles (Chunk size 150)
        console.log(`Sending ${fhirBundleBuffer.length} FHIR resources in batches of 150...`);
        const chunkSize = 150;
        let fhirBaseUrl = FHIR_SERVER_URL;
        if (fhirBaseUrl.endsWith('/')) fhirBaseUrl = fhirBaseUrl.slice(0, -1);
        
        let bundleSuccess = 0;
        for (let i = 0; i < fhirBundleBuffer.length; i += chunkSize) {
            const chunk = fhirBundleBuffer.slice(i, i + chunkSize);
            const bundle = {
                resourceType: "Bundle",
                type: "transaction",
                entry: chunk.map(res => ({
                    fullUrl: `${res.resourceType}/${res.id}`,
                    resource: res,
                    request: { method: "PUT", url: `${res.resourceType}/${res.id}` }
                }))
            };
            try {
                const bRes = await fetch(fhirBaseUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(bundle)
                });
                if (!bRes.ok) {
                    console.error(`FHIR Bundle push failed for chunk ${i / chunkSize}: ` + bRes.status);
                    const errText = await bRes.text();
                    console.error(errText);
                } else {
                    bundleSuccess += chunk.length;
                }
            } catch (e) {
                console.error(`FHIR Bundle network error chunks ${i}: `, e);
            }
        }
        console.log(`Finished sending FHIR. ${bundleSuccess}/${fhirBundleBuffer.length} succeeded.`);

        // Trigger Next.js Dev Server Recompile to bust the old logic cache
        return { 
            success: true, 
            message: `成功生成「${indicatorName}」共 ${generatedItems.length} 筆範例資料！\n時間範圍：2025/06/01 ~ 2026/02/28` 
        };
    } catch (err) {
        console.error(err);
        return { success: false, message: "生成失敗: " + String(err) };
    }
}

export async function clearGeneratedData(mode: 'all' | 'mortality' | 'antibiotic' = 'all') {
    try {
        const { createClient } = await import("@/utils/supabase/server");
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

// 新增: 產生 FHIR 測試案例 JSON (直接匯出，並寫入 DB 同步)
export async function exportFHIRTestCases() {
    try {
        console.log("Starting massive export & DB sync (4000 cases)...");
        const bundle = {
            resourceType: "Bundle",
            type: "transaction",
            entry: [] as any[]
        };

        const addResource = (res: any) => {
            bundle.entry.push({
                fullUrl: `urn:uuid:${res.id}`,
                resource: res,
                request: {
                    method: "PUT",
                    url: `${res.resourceType}/${res.id}`
                }
            });
        };

        // 1. Setup Supabase Admin (Fallback to Anon if missing)
        const { createClient } = await import("@supabase/supabase-js");
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const supabase = createClient(supabaseUrl, serviceRoleKey);

        // 2. Provision the loggable Practitioner (dr-smart-demo)
        const demoDocId = "dr-smart-demo";
        const demoDocName = "林智明 (示範登入)";
        
        // Push to FHIR Bundle
        addResource({
            resourceType: "Practitioner",
            id: demoDocId,
            name: [{ text: demoDocName }]
        });

        addResource({
            resourceType: "PractitionerRole",
            id: `pr-${demoDocId}`,
            practitioner: { reference: `urn:uuid:${demoDocId}` },
            organization: { reference: `urn:uuid:org-tp-gen` }
        });

        const dummyEmail = `demodoc_${demoDocId}@smart.local`.toLowerCase();
        console.log("Checking for Sandbox practitioner account...");
        const { data: usersData } = await supabase.auth.admin.listUsers();
        let matchedUser = usersData?.users?.find(u => u.email === dummyEmail || u.user_metadata?.fhir_id === `Practitioner/${demoDocId}`);
        
        if (!matchedUser) {
            console.log("Creating Sandbox practitioner account:", demoDocName);
            await supabase.auth.admin.createUser({
                email: dummyEmail,
                password: crypto.randomUUID(),
                email_confirm: true,
                user_metadata: {
                    full_name: demoDocName,
                    fhir_id: `Practitioner/${demoDocId}`
                }
            });
        }

        // 3. Clear existing KPI Data to make room for big test data
        await supabase.from("KPI").delete().neq('id', -1);
        await supabase.from("KPI_Detail").delete().neq('id', -1);

        // 4. Setup Hospitals and Departments
        const hospId = "org-tp-gen";
        const hospName = "台北綜合醫院";
        addResource({
            resourceType: "Organization",
            id: hospId,
            name: hospName,
            type: [{ text: "Hospital" }]
        });

        const departments = Object.entries(DEPT_TEMPLATE).map(([key, info]) => ({
            id: `dept-${key.toLowerCase()}`,
            name: info.name,
            docs: info.docs.map((d, i) => ({ id: `doc-${key.toLowerCase()}-${i}`, name: d }))
        }));
        // Ensure demo doc is in the first dept
        departments[0].docs.unshift({ id: demoDocId, name: demoDocName });

        departments.forEach(dept => {
            addResource({
                resourceType: "Organization",
                id: dept.id,
                name: dept.name,
                partOf: { reference: `urn:uuid:${hospId}` }
            });
            dept.docs.forEach((doc) => {
                if(doc.id !== demoDocId) {
                    addResource({
                        resourceType: "Practitioner",
                        id: doc.id,
                        name: [{ text: doc.name }]
                    });
                    addResource({
                        resourceType: "PractitionerRole",
                        id: `pr-${doc.id}`,
                        practitioner: { reference: `urn:uuid:${doc.id}` },
                        organization: { reference: `urn:uuid:org-tp-gen` }
                    });
                }
            });
        });

        // 5. Generate exactly 3500 cases each
        const kpiDetailsBuffer: any[] = [];
        const TARGET_PER_INDICATOR = 3500;
        const indicators = [
            { id: "mortality", name: "手術後 48 小時內死亡率", def: "麻醉開始後48小時內死亡(含AAD)" },
            { id: "antibiotic", name: "預防性抗生素在手術劃刀前1小時內給予比率", def: "手術劃刀前1小時內給予預防性抗生素人次 / 手術人次 * 100%" }
        ];

        const startDate = new Date("2025-06-01T00:00:00+08:00").getTime();
        const endDate = new Date("2026-02-28T23:59:59+08:00").getTime();
        const dateRangeMs = endDate - startDate;

        let globalCounter = 0;

        indicators.forEach(indicator => {
            for (let i = 0; i < TARGET_PER_INDICATOR; i++) {
                globalCounter++;
                const dept = departments[globalCounter % departments.length];
                const doc = dept.docs[(globalCounter + i) % dept.docs.length]; // Distribute

                const patId = `pat-sim-${globalCounter}`;
                const gender = globalCounter % 2 === 0 ? "male" : "female";
                const age = 30 + (globalCounter % 60);

                const opStartMs = startDate + (Math.random() * dateRangeMs);
                const opStart = new Date(opStartMs);
                const opEndMs = opStartMs + (1 + Math.random() * 3) * 60 * 60 * 1000;
                const opEnd = new Date(opEndMs);
                const admissionDate = new Date(opStartMs - (1 + Math.random() * 3) * 24 * 60 * 60 * 1000);

                // Indicator Logic
                let isBad = false;
                let deathTime = null;
                let isDeceased = false;
                let dischargeCode = "home";
                let abnormalReason = null;
                let numerator = 0;
                let denominator = 1;
                let value = 0;

                if (indicator.id === "mortality") {
                    // Mortality definition: abnormal if death occurs within 48h
                    // Pattern: Cardio and Neuro have higher mortality
                    const baseProb = ["dept-cardio", "dept-neuro"].includes(dept.id) ? 0.05 : 0.01;
                    if (Math.random() < baseProb) { // Probability-based
                        isBad = true;
                        numerator = 1; value = 1;
                        isDeceased = true;
                        deathTime = new Date(opEndMs + (Math.random() * 40 + 2) * 60 * 60 * 1000);
                        dischargeCode = "exp";
                        abnormalReason = "術後48小時內院內死亡";
                    }
                } else if (indicator.id === "antibiotic") {
                    // Antibiotic definition: abnormal if NOT given (numerator 0)
                    // Pattern: Ortho and ENT have higher miss rate
                    const baseProb = ["dept-ortho", "dept-ent"].includes(dept.id) ? 0.15 : 0.03;
                    if (Math.random() < baseProb) { // Probability-based
                        isBad = true;
                        numerator = 0; value = 0; // Failed to give
                        abnormalReason = "未在劃刀前1小時內給藥";
                    } else {
                        numerator = 1; value = 1; // Successfully given
                    }
                }

                const dischargeDate = deathTime || new Date(opEndMs + (3 + Math.random() * 7) * 24 * 60 * 60 * 1000);
                const birthStr = new Date(opStartMs - age * 365.25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

                // Add FHIR Data
                addResource({
                    resourceType: "Patient",
                    id: patId,
                    gender: gender,
                    birthDate: birthStr,
                    deceasedDateTime: isDeceased && deathTime ? deathTime.toISOString() : undefined,
                    managingOrganization: { reference: `urn:uuid:org-tp-gen` }
                });

                const encId = `enc-sim-${globalCounter}`;
                addResource({
                    resourceType: "Encounter",
                    id: encId,
                    status: "finished",
                    class: { code: "IMP" },
                    subject: { reference: `urn:uuid:${patId}` },
                    serviceProvider: { reference: `urn:uuid:${dept.id}`, display: dept.name },
                    hospitalization: { dischargeDisposition: { coding: [{ code: dischargeCode }] } },
                    period: {
                        start: admissionDate.toISOString(),
                        end: dischargeDate.toISOString()
                    }
                });

                const procId = `proc-sim-${globalCounter}`;
                // Inject semantic note for external FHIR parsers (like sync-data.ts)
                const isAntibioticSuccess = (indicator.id === "antibiotic" && value === 1);
                const isAntibioticFail = (indicator.id === "antibiotic" && value === 0);
                
                const procedureNotes = [];
                if (indicator.id === "antibiotic") {
                    procedureNotes.push({ text: `Antibiotic given: ${isAntibioticSuccess ? 'true' : 'false'}` });
                }

                addResource({
                    resourceType: "Procedure",
                    id: procId,
                    status: "completed",
                    subject: { reference: `urn:uuid:${patId}` },
                    encounter: { reference: `urn:uuid:${encId}` },
                    performedPeriod: { start: opStart.toISOString(), end: opEnd.toISOString() },
                    code: {
                        coding: [{
                            system: "http://hl7.org/fhir/sid/icd-10-pcs",
                            code: "0DTJ0ZZ",
                            display: "Resection of Appendix"
                        }]
                    },
                    performer: [{ actor: { reference: `urn:uuid:${doc.id}` } }],
                    ...(procedureNotes.length > 0 && { note: procedureNotes })
                });

                // Add to DB Buffer
                kpiDetailsBuffer.push({
                    department: dept.name,
                    doctor: doc.name,
                    indicator_name: indicator.name,
                    indicator_def: indicator.def,
                    numerator: numerator,
                    denominator: denominator,
                    value: value,
                    patient_id: patId,
                    patient_gender: gender,
                    patient_birthday: birthStr,
                    patient_age: age,
                    status: isBad ? "異常" : "正常",
                    unit: "%",
                    report_date: opEnd.toISOString(),
                    admission_date: admissionDate.toISOString(),
                    discharge_date: dischargeDate.toISOString(),
                    op_start: opStart.toISOString(),
                    op_end: opEnd.toISOString(),
                    abnormal_reason: abnormalReason,
                    hospital_name: hospName,
                    doctor_id: doc.id
                });
            }
        });

        // 6. DB Insertion
        console.log(`Prepared ${kpiDetailsBuffer.length} KPI entries. Starting DB Batches...`);
        const BATCH_SIZE = 1000;
        for (let i = 0; i < kpiDetailsBuffer.length; i += BATCH_SIZE) {
            const batch = kpiDetailsBuffer.slice(i, i + BATCH_SIZE);
            const { error: detailError } = await supabase.from("KPI_Detail").insert(batch);
            if (detailError) throw new Error("Batch insert error: " + detailError.message);
        }

        // 7. Summary Calculation for 'KPI' table
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
        if (kpiError) throw new Error("KPI sum error: " + kpiError.message);

        console.log(`Successfully generated and synced 7000 patient/encounter records and ${kpiDetailsBuffer.length} details!`);
        return { success: true, data: bundle, count: 7000, message: `成功匯出 7000 筆病患就診記錄資料，並同步寫入 ${kpiDetailsBuffer.length} 筆指標明細預設資料！` };
    } catch (err) {
        console.error("Export FHIR & Sync Error:", err);
        return { success: false, message: "資料生成失敗: " + String(err) };
    }
}

