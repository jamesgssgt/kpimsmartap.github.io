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

        // Generate Cases
        // To avoid timeout, we'll process in chunks, but for 300, 
        // we might need to be careful. limiting concurrency to 50.
        const chunks = [];
        for (let i = 0; i < TOTAL_CASES; i += 50) {
            chunks.push(i);
        }

        for (const chunkStart of chunks) {
            const promises = [];
            const limit = Math.min(chunkStart + 50, TOTAL_CASES);

            for (let i = chunkStart; i < limit; i++) {
                promises.push((async () => {
                    const dayIndex = randomInt(0, DAYS_BACK);
                    const hospCode = randomChoice(Object.keys(infra));
                    const hData = infra[hospCode];
                    const hospName = HOSPITALS.find(h => h.code === hospCode)?.name || "";

                    const dept = randomChoice(hData.depts);
                    // @ts-ignore
                    const deptName = DEPT_TEMPLATE[dept.dept_code].name;

                    const docId = randomChoice(dept.doctors);
                    const docName = dept.doc_names[docId];

                    // Dates
                    const now = new Date();
                    const opStart = new Date(now.getTime() - dayIndex * 24 * 60 * 60 * 1000);
                    opStart.setHours(randomInt(8, 16));
                    const opEnd = new Date(opStart.getTime() + randomInt(60, 240) * 60 * 1000);

                    const admissionDate = new Date(opStart.getTime() - randomInt(1, 2) * 24 * 60 * 60 * 1000);
                    const dischargeDate = new Date(opEnd.getTime() + randomInt(2, 10) * 24 * 60 * 60 * 1000);

                    // Risk
                    let risk = 0.015 * hData.risk;
                    if (dayIndex > 60 && dayIndex < 90) risk += 0.08;
                    const isBad = Math.random() < risk;

                    let isDeceased = false;
                    let abnormalReason = null;
                    let deathTime = null;

                    if (isBad) {
                        deathTime = new Date(opEnd.getTime() + randomInt(2, 46) * 60 * 60 * 1000);
                        isDeceased = true;
                        abnormalReason = "術後48小時內死亡";
                    }

                    // FHIR Resources
                    const patId = getLongId();
                    const gender = randomChoice(["male", "female"]);
                    const age = randomInt(20, 90);
                    const birthDate = new Date();
                    birthDate.setFullYear(birthDate.getFullYear() - age);
                    birthDate.setMonth(randomInt(0, 11));
                    birthDate.setDate(randomInt(1, 28));
                    const birthDateStr = birthDate.toISOString().split('T')[0]; // YYYY-MM-DD

                    const patResource: any = {
                        resourceType: "Patient",
                        id: patId,
                        gender: gender,
                        birthDate: birthDateStr
                    };
                    if (isDeceased && deathTime) {
                        patResource.deceasedDateTime = deathTime.toISOString();
                    }
                    await fhirSave("Patient", patResource);

                    const encId = getLongId();
                    const encResource: any = {
                        resourceType: "Encounter",
                        id: encId,
                        status: "finished",
                        class: { code: "IMP" },
                        subject: { reference: `Patient/${patId}` },
                        serviceProvider: { reference: `Organization/${dept.org_id}`, display: dept.org_name }
                    };
                    if (isBad) {
                        encResource.hospitalization = { dischargeDisposition: { coding: [{ code: "exp" }] } };
                    }
                    await fhirSave("Encounter", encResource);

                    const procId = getLongId();
                    const procResource: any = {
                        resourceType: "Procedure",
                        id: procId,
                        status: "completed",
                        subject: { reference: `Patient/${patId}` },
                        encounter: { reference: `Encounter/${encId}` },
                        performedPeriod: { end: opEnd.toISOString() },
                        code: { coding: [{ display: "Surgery" }] },
                        performer: [{ actor: { reference: `Practitioner/${docId}` } }]
                    };
                    await fhirSave("Procedure", procResource);

                    // Collect Data
                    return {
                        // hospital: hospName, // DB doesn't have hospital column currently
                        department: deptName,
                        doctor: docName,
                        indicator_name: "術後48小時死亡率",
                        indicator_def: "手術後死亡人數 / 手術總次數",
                        numerator: isDeceased ? 1 : 0,
                        denominator: 1,
                        value: isDeceased ? 1 : 0,
                        patient_id: patId,
                        patient_gender: gender, // Match DB column
                        patient_birthday: birthDateStr,
                        status: isDeceased ? "異常" : "正常",
                        unit: "%",
                        report_date: opStart.toISOString(),
                        admission_date: admissionDate.toISOString(),
                        discharge_date: dischargeDate.toISOString(),
                        abnormal_reason: abnormalReason
                    };
                })());
            } // end loop 
            const results = await Promise.all(promises);
            kpiDetailsBuffer.push(...results);
        } // end chunks

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
        const { error: detailError } = await supabase.from("KPI_Detail").insert(kpiDetailsBuffer);
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
