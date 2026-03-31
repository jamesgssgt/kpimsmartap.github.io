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

async function createInfrastructure(pushToFhir = true, fhirBundleBuffer: any[] = []) {
    const infra: Record<string, InfraData> = {};

    for (const hosp of HOSPITALS) {
        const h_code = hosp.code;
        infra[h_code] = { risk: hosp.risk, depts: [] };

        // Hosp Org
        const hosp_org_id = `org-${hosp.code.toLowerCase()}`;
        if (pushToFhir) {
            fhirBundleBuffer.push({
                resourceType: "Organization",
                id: hosp_org_id,
                name: hosp.name,
                type: [{ text: "Hospital" }],
            });
        }

        for (const [d_code, d_info] of Object.entries(DEPT_TEMPLATE)) {
            const dept_org_id = `org-${hosp.code.toLowerCase()}-${d_code.toLowerCase()}`;
            const full_dept_name = d_info.name;

            if (pushToFhir) {
                fhirBundleBuffer.push({
                    resourceType: "Organization",
                    id: dept_org_id,
                    name: full_dept_name,
                    partOf: { reference: `Organization/${hosp_org_id}` }
                });
            }

            const dept_docs: string[] = [];
            const doc_names: Record<string, string> = {};

            for (let i = 0; i < d_info.docs.length; i++) {
                const surname = d_info.docs[i];
                const doc_id = `doc-${hosp.code.toLowerCase()}-${d_code.toLowerCase()}-${i}`;
                const doc_name_short = surname;
                const full_name = surname;

                if (pushToFhir) {
                    fhirBundleBuffer.push({
                        resourceType: "Practitioner",
                        id: doc_id,
                        name: [{ text: full_name }]
                    });

                    fhirBundleBuffer.push({
                        resourceType: "PractitionerRole",
                        id: `pr-${doc_id}`,
                        practitioner: { reference: `Practitioner/${doc_id}` },
                        organization: { reference: `Organization/${hosp_org_id}` }
                    });
                }

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


// Force renamed to bypass Next.js Server Action cache hash clinging to old Date.now() logic
export async function generateDataV2(mode: 'mortality' | 'antibiotic', batchIndex = 0, totalBatches = 1) {
    try {
        const fhirBundleBuffer: any[] = [];
        const { createClient } = await import("@/utils/supabase/server");
        const supabase = await createClient();

        const indicatorName = mode === 'mortality' ? '手術後 48 小時內死亡率' : '預防性抗生素在手術劃刀前1小時內給予比率';

        const { data: kpi } = await supabase.from("kpi_definitions").select("*").eq("name", indicatorName).single();
        if (!kpi) throw new Error("Indicator definition not found: " + indicatorName);

        if (batchIndex === 0) {
            await supabase.from("KPI").delete().eq("indicator_name", indicatorName);
            await supabase.from("kpi_detail").delete().eq("kpi_id", kpi.kpiid);
        }

        const pushInfra = batchIndex === 0;
        const infra = await createInfrastructure(pushInfra, fhirBundleBuffer);


        // Flatten depts
        const allDepts: { hospCode: string; deptInfo: any }[] = [];
        for (const [hCode, hData] of Object.entries(infra)) {
            for (const d of hData.depts) {
                allDepts.push({ hospCode: hCode, deptInfo: d });
            }
        }

        const daysPerBatch = Math.ceil(DAYS_BACK / totalBatches);
        const startDay = batchIndex * daysPerBatch;
        const endDay = Math.min(startDay + daysPerBatch, DAYS_BACK);

        let genCounter = startDay * allDepts.length;

        // Helper to generate a single case
        const createCase = async (dayIndex: number, specificDept?: any, forceAbnormal?: boolean) => {
            genCounter++;
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
                    isAntibioticSuccess = false; 
                } else {
                    isAntibioticSuccess = Math.random() > baseProb; 
                }
            } else {
                isAntibioticSuccess = Math.random() > 0.05;
            }

            const antibioticNum = isAntibioticSuccess ? 1 : 0;

            const deptName = DEPT_TEMPLATE[chosenDeptObj.dept_code as keyof typeof DEPT_TEMPLATE].name;
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

            const hospNameRaw = hCode ? HOSPITALS.find(h => h.code === hCode)?.name || "台北綜合醫院" : "台北綜合醫院";
            const hosp_org_id = hCode ? `org-${hCode.toLowerCase()}` : "org-tp-gen";

            fhirBundleBuffer.push({
                resourceType: "Patient",
                id: patId,
                meta: { tag: [{ system: "http://kpim.tw", code: "kpim_test_data" }] },
                gender: gender,
                birthDate: birthDateStr,
                deceasedDateTime: isDeceased && deathTime ? deathTime.toISOString() : undefined,
                managingOrganization: { reference: `Organization/${hosp_org_id}` }
            });

            const encId = `enc-${mode}-${genCounter}`;
            fhirBundleBuffer.push({
                resourceType: "Encounter",
                id: encId,
                meta: { tag: [{ system: "http://kpim.tw", code: "kpim_test_data" }] },
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
                meta: { tag: [{ system: "http://kpim.tw", code: "kpim_test_data" }] },
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

            const reportDate = opEnd.toISOString();
            const results = [];

            if (mode === 'mortality') {
                results.push({
                    kpi_id: kpi.kpiid,
                    data_date: reportDate.split('T')[0],
                    department: deptName,
                    doctor_id: docId,
                    doctor_name: docName,
                    hospital_id: hospNameRaw,
                    patient_id: patId,
                    patient_gender: gender,
                    patient_birth_date: birthDateStr,
                    numerator_value: isMortalityNum ? 1 : 0,
                    denominator_value: 1,
                    kpi_value: isMortalityNum ? 1 : 0,
                    monthKey: opStart.toISOString().substring(0, 7)
                });
            }

            if (mode === 'antibiotic') {
                results.push({
                    kpi_id: kpi.kpiid,
                    data_date: reportDate.split('T')[0],
                    department: deptName,
                    doctor_id: docId,
                    doctor_name: docName,
                    hospital_id: hospNameRaw,
                    patient_id: patId,
                    patient_gender: gender,
                    patient_birth_date: birthDateStr,
                    numerator_value: antibioticNum,
                    denominator_value: 1,
                    kpi_value: antibioticNum,
                    monthKey: opStart.toISOString().substring(0, 7)
                });
            }

            return results;
        };

        const coveragePromises = [];
        for (let d = startDay; d < endDay; d++) {
            for (const deptItem of allDepts) {
                coveragePromises.push(() => createCase(d, deptItem.deptInfo, false));
            }
        }

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
        const kpiDetailsBuffer = [...coverageResults];

        const cleanDetails = kpiDetailsBuffer.map(({ monthKey, ...rest }) => rest);
        const { error: detailError } = await supabase.from("kpi_detail").insert(cleanDetails);
        if (detailError) {
            console.error("Error saving KPI Details:", detailError);
            return { success: false, message: "生成過程中發生資料庫錯誤: " + detailError.message };
        }

        if (batchIndex === totalBatches - 1) {
            console.log(`Final batch reached. Calculating KPI summary...`);
            const { data: allDetails, error: fetchErr } = await supabase.from("kpi_detail").select("*").eq("kpi_id", kpi.kpiid);
            if (!fetchErr && allDetails) {
                const summaryMap = new Map<string, any>();
                for (const d of allDetails) {
                    const key = `${d.department}|${d.doctor_name}|${indicatorName}`;
                    if (!summaryMap.has(key)) {
                        summaryMap.set(key, {
                            department: d.department,
                            doctor: d.doctor_name,
                            indicator_name: indicatorName,
                            indicator_def: kpi.formula || "",
                            numerator: 0,
                            denominator: 0,
                            unit: "%"
                        });
                    }
                    const item = summaryMap.get(key);
                    item.numerator += d.numerator_value || 0;
                    item.denominator += d.denominator_value || 0;
                }

                const kpiSummaryList = Array.from(summaryMap.values()).map(item => ({
                    ...item,
                    value: item.denominator > 0 ? parseFloat(((item.numerator / item.denominator) * 100).toFixed(2)) : 0
                }));

                const { error: kpiError } = await supabase.from("KPI").upsert(kpiSummaryList, { onConflict: "department, doctor, indicator_name" });
                if (kpiError) console.error("Error saving KPI Summary:", kpiError);
            }
        }

        console.log(`Sending ${fhirBundleBuffer.length} FHIR resources in batches of 150...`);
        const chunkSize = 150;
        const { data: sysData } = await supabase.from("system").select("SysValue").eq("SysCode", "FHIR_SERVER").single();
        let fhirBaseUrl = sysData?.SysValue || FHIR_SERVER_URL;
        if (fhirBaseUrl.endsWith('/')) fhirBaseUrl = fhirBaseUrl.slice(0, -1);
        
        const { getBackendAccessToken } = await import("@/utils/backend-auth");
        let accessToken: string | null = null;
        try {
            accessToken = await getBackendAccessToken(fhirBaseUrl);
        } catch (authErr) {
            console.error("Backend Auth Failed during generation (Proceeding without token): ", authErr);
        }

        let bundleSuccess = 0;
        let isReadOnly = false;

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
                const headers: Record<string, string> = { "Content-Type": "application/json" };
                if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

                const bRes = await fetch(fhirBaseUrl, {
                    method: "POST",
                    headers,
                    body: JSON.stringify(bundle),
                    cache: 'no-store'
                });

                if (!bRes.ok) {
                    if (bRes.status === 403 || bRes.status === 405) {
                        isReadOnly = true;
                    }
                    console.error(`FHIR Bundle push failed for chunk ${i / chunkSize}: ${bRes.status}`);
                } else {
                    bundleSuccess += chunk.length;
                }
            } catch (e) {
                console.error(`FHIR Bundle network error chunks ${i}: `, e);
            }
        }

        return { 
            success: true, 
            message: `批次 ${batchIndex + 1}/${totalBatches} 完成: 生成 ${coverageResults.length} 筆資料 (FHIR 上傳 ${bundleSuccess}/${fhirBundleBuffer.length} 成功)` 
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
            const { error: e1 } = await supabase.from("KPI").delete().neq('id', '00000000-0000-0000-0000-000000000000'); 
            const { error: e2 } = await supabase.from("kpi_detail").delete().neq('id', '00000000-0000-0000-0000-000000000000'); 
            const { error: e3 } = await supabase.from("kpi_ft_detail").delete().neq('id', '00000000-0000-0000-0000-000000000000');

            if (e1) throw new Error("Error clearing KPI: " + e1.message);
            if (e2) throw new Error("Error clearing kpi_detail: " + e2.message);
            if (e3) throw new Error("Error clearing kpi_ft_detail: " + e3.message);
        } else {
            const indicatorName = mode === 'mortality' ? '手術後 48 小時內死亡率' : '預防性抗生素在手術劃刀前1小時內給予比率';
            const { data: kpi } = await supabase.from("kpi_definitions").select("kpiid").eq("name", indicatorName).single();
            
            const { error: e1 } = await supabase.from("KPI").delete().eq("indicator_name", indicatorName);
            const { error: e2 } = await supabase.from("kpi_detail").delete().eq("kpi_id", kpi?.kpiid);

            if (e1) throw new Error("Error clearing KPI: " + e1.message);
            if (e2) throw new Error("Error clearing kpi_detail: " + e2.message);
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

        const { createClient } = await import("@supabase/supabase-js");
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const supabase = createClient(supabaseUrl, serviceRoleKey);

        const demoDocId = "dr-smart-demo";
        const demoDocName = "林智明 (示範登入)";
        
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
        const { data: usersData } = await supabase.auth.admin.listUsers();
        let matchedUser = usersData?.users?.find(u => u.email === dummyEmail || u.user_metadata?.fhir_id === `Practitioner/${demoDocId}`);
        
        if (!matchedUser) {
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

        await supabase.from("KPI").delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from("kpi_detail").delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from("kpi_ft_detail").delete().neq('id', '00000000-0000-0000-0000-000000000000');

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

        for (const indicator of indicators) {
            const { data: kpiDef } = await supabase.from("kpi_definitions").select("kpiid").eq("name", indicator.name).single();
            const { data: ftInf } = await supabase.from("kpi_ft_detail_inf").select("*").eq("kpi_id", kpiDef?.kpiid).order('seq');
            
            const ftDataBuffer: any[] = [];
            
            for (let i = 0; i < TARGET_PER_INDICATOR; i++) {
                globalCounter++;
                const dept = departments[globalCounter % departments.length];
                const doc = dept.docs[(globalCounter + i) % dept.docs.length]; 

                const patId = `pat-sim-${globalCounter}`;
                const gender = globalCounter % 2 === 0 ? "male" : "female";
                const age = 30 + (globalCounter % 60);

                const opStartMs = startDate + (Math.random() * dateRangeMs);
                const opStart = new Date(opStartMs);
                const opEndMs = opStartMs + (1 + Math.random() * 3) * 60 * 60 * 1000;
                const opEnd = new Date(opEndMs);
                const admissionDate = new Date(opStartMs - (1 + Math.random() * 3) * 24 * 60 * 60 * 1000);

                let isBad = false;
                let deathTime = null;
                let isDeceased = false;
                let dischargeCode = "home";
                let abnormalReason = null;
                let numerator = 0;
                let value = 0;

                if (indicator.id === "mortality") {
                    const baseProb = ["dept-cardio", "dept-neuro"].includes(dept.id) ? 0.05 : 0.01;
                    if (Math.random() < baseProb) { 
                        isBad = true;
                        numerator = 1; value = 1;
                        isDeceased = true;
                        deathTime = new Date(opEndMs + (Math.random() * 40 + 2) * 60 * 60 * 1000);
                        dischargeCode = "exp";
                    }
                } else if (indicator.id === "antibiotic") {
                    const baseProb = ["dept-ortho", "dept-ent"].includes(dept.id) ? 0.15 : 0.03;
                    if (Math.random() < baseProb) { 
                        isBad = true;
                        numerator = 0; value = 0; 
                    } else {
                        numerator = 1; value = 1; 
                    }
                }

                const dischargeDate = deathTime || new Date(opEndMs + (3 + Math.random() * 7) * 24 * 60 * 60 * 1000);
                const birthStr = new Date(opStartMs - age * 365.25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

                addResource({
                    resourceType: "Patient",
                    id: patId,
                    meta: { tag: [{ system: "http://kpim.tw", code: "kpim_test_data" }] },
                    gender: gender,
                    birthDate: birthStr,
                    deceasedDateTime: isDeceased && deathTime ? deathTime.toISOString() : undefined,
                    managingOrganization: { reference: `urn:uuid:org-tp-gen` }
                });

                const encId = `enc-sim-${globalCounter}`;
                addResource({
                    resourceType: "Encounter",
                    id: encId,
                    meta: { tag: [{ system: "http://kpim.tw", code: "kpim_test_data" }] },
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

                const detailRow = {
                    kpi_id: kpiDef?.kpiid,
                    data_date: opEnd.toISOString().split('T')[0],
                    department: dept.name,
                    doctor_id: doc.id,
                    doctor_name: doc.name,
                    hospital_id: hospName,
                    patient_id: patId,
                    patient_gender: gender,
                    patient_birth_date: birthStr,
                    numerator_value: numerator,
                    denominator_value: 1,
                    kpi_value: value
                };
                kpiDetailsBuffer.push(detailRow);

                // 生成 FT 鑽取資料
                if (ftInf && ftInf.length > 0) {
                    const ftRow: any = { _patient_id: patId }; // 臨時關聯鍵
                    ftInf.forEach(f => {
                        const path = f.fhir_source || '';
                        let val = "";
                        if (path.includes("Patient.identifier")) val = patId.replace('pat-sim-', 'P');
                        else if (path.includes("Patient.name")) val = `模擬病患 ${globalCounter}`;
                        else if (path.includes("Procedure.code")) val = indicator.id === 'mortality' ? "OP-001" : "AB-101";
                        else if (path.includes("Practitioner.name") || path.includes("performer")) val = doc.name;
                        else if (path.includes("Organization") || path.includes("serviceType")) val = dept.name;
                        else if (path.includes("start")) val = opStart.toLocaleString();
                        else if (path.includes("end")) val = opEnd.toLocaleString();
                        else val = "N/A";

                        if (f.column_slot) ftRow[f.column_slot] = val;
                    });
                    ftDataBuffer.push(ftRow);
                }
            }

            // --- 寫入此指標的資料 ---
            for (let j = 0; j < kpiDetailsBuffer.length; j += 500) {
                const batch = kpiDetailsBuffer.slice(j, j + 500);
                const { data: inserted, error: insErr } = await supabase
                    .from("kpi_detail")
                    .insert(batch)
                    .select("id, patient_id");

                if (!insErr && inserted && ftDataBuffer.length > 0) {
                    const insMap = new Map(inserted.map(row => [row.patient_id, row.id]));
                    const ftToInsert = ftDataBuffer
                        .filter(fd => insMap.has(fd._patient_id))
                        .map(fd => {
                            const { _patient_id, ...rest } = fd;
                            return { kpi_detail_id: insMap.get(_patient_id), ...rest };
                        });
                    
                    if (ftToInsert.length > 0) {
                        for (let k = 0; k < ftToInsert.length; k += 500) {
                            await supabase.from("kpi_ft_detail").insert(ftToInsert.slice(k, k + 500));
                        }
                    }
                }
            }
            
            // --- 更新 KPI 總表 (Summary) ---
            if (kpiDetailsBuffer.length > 0) {
                const summaryMap = new Map<string, any>();
                for (const d of kpiDetailsBuffer) {
                    const key = `${d.department}|${d.doctor_name}|${indicator.name}`;
                    if (!summaryMap.has(key)) {
                        summaryMap.set(key, {
                            department: d.department,
                            doctor: d.doctor_name,
                            doctor_id: d.doctor_id,
                            indicator_name: indicator.name,
                            indicator_def: indicator.def,
                            numerator: 0,
                            denominator: 0,
                            unit: "%"
                        });
                    }
                    const sum = summaryMap.get(key);
                    sum.numerator += d.numerator_value;
                    sum.denominator += d.denominator_value;
                }

                const summaryToUpsert = Array.from(summaryMap.values()).map(s => ({
                    ...s,
                    value: s.denominator > 0 ? parseFloat(((s.numerator / s.denominator) * 100).toFixed(2)) : 0
                }));
                
                await supabase.from("KPI").upsert(summaryToUpsert, { onConflict: "department, doctor, indicator_name" });
            }

            // 清空 buffer 以處理下一個指標
            kpiDetailsBuffer.length = 0;
            ftDataBuffer.length = 0;
        }

        return { success: true, message: "Export and Sync successful.", data: bundle };
    } catch (err) {
        console.error(err);
        return { success: false, message: "Export failed: " + String(err) };
    }
}
