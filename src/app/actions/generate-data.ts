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
function randomChoice<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
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
                doc_names[doc_id] = surname;
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

export async function generateDataV2(mode: 'mortality' | 'antibiotic', batchIndex = 0, totalBatches = 1) {
    try {
        const fhirBundleBuffer: any[] = [];
        const supabase = await createClient();

        const indicatorName = mode === 'mortality' ? '手術後 48 小時內死亡率' : '預防性抗生素在手術劃刀前1小時內給予比率';
        const { data: kpiDef } = await supabase.from("kpi_definitions").select("*").eq("name", indicatorName).single();
        if (!kpiDef) throw new Error("Indicator definition not found: " + indicatorName);

        // Fetch FT Definitions
        const { data: allFtInf } = await supabase.from("kpi_ft_detail_inf").select("*").eq("kpi_id", kpiDef.kpiid).order('seq');
        const ftInf = allFtInf || [];

        const ftDataBuffer: any[] = [];

        if (batchIndex === 0) {
            await supabase.from("KPI").delete().eq("indicator_name", indicatorName);
            await supabase.from("kpi_detail").delete().eq("kpi_id", kpiDef.kpiid);
        }

        const infra = await createInfrastructure(batchIndex === 0, fhirBundleBuffer);

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

        const createCase = async (dayIndex: number, specificDept: any) => {
            genCounter++;
            const results: any[] = [];
            const ftResults: any[] = [];

            const opStart = new Date(END_DATE.getTime() - dayIndex * 24 * 60 * 60 * 1000);
            opStart.setHours(randomInt(8, 16));
            opStart.setMinutes(randomInt(0, 59));
            const anesthesiaStart = new Date(opStart.getTime() - 30 * 60 * 1000);
            const opEnd = new Date(opStart.getTime() + randomInt(60, 240) * 60 * 1000);
            const admissionDate = new Date(opStart.getTime() - randomInt(1, 2) * 24 * 60 * 60 * 1000);
            const dischargeDate = new Date(opEnd.getTime() + randomInt(2, 10) * 24 * 60 * 60 * 1000);

            let isNumerator = false;
            let dischargeDispositionCode = "home";
            let deathTime: Date | null = null;
            let isDeceased = false;

            if (mode === 'mortality') {
                const isBad = Math.random() < (["CARDIO", "NEURO"].includes(specificDept.dept_code) ? 0.05 : 0.01);
                if (isBad) {
                    const eventTime = new Date(anesthesiaStart.getTime() + randomInt(2, 46) * 60 * 60 * 1000);
                    dischargeDate.setTime(eventTime.getTime());
                    isNumerator = true;
                    if (Math.random() < 0.3) {
                        dischargeDispositionCode = "aadvice";
                    } else {
                        isDeceased = true;
                        deathTime = eventTime;
                        dischargeDispositionCode = "exp";
                    }
                }
            } else if (mode === 'antibiotic') {
                const isSuccess = Math.random() > (["ORTHO", "ENT"].includes(specificDept.dept_code) ? 0.15 : 0.03);
                isNumerator = isSuccess;
            }

            const patId = `pat-${mode}-${genCounter}`;
            const gender = randomChoice(["male", "female"]);
            const birthDate = new Date(opStart);
            birthDate.setFullYear(birthDate.getFullYear() - randomInt(20, 90));
            const birthDateStr = birthDate.toISOString().split('T')[0];

            const docId = randomChoice(specificDept.doctors as string[]);
            const doctorName = specificDept.doc_names[docId];

            // FHIR resources
            fhirBundleBuffer.push({
                resourceType: "Patient",
                id: patId,
                gender,
                birthDate: birthDateStr,
                deceasedDateTime: isDeceased && deathTime ? deathTime.toISOString() : undefined,
                managingOrganization: { reference: `Organization/org-tp-gen` }
            });

            const encId = `enc-${mode}-${genCounter}`;
            fhirBundleBuffer.push({
                resourceType: "Encounter",
                id: encId,
                status: "finished",
                subject: { reference: `Patient/${patId}` },
                serviceProvider: { reference: `Organization/${specificDept.org_id}`, display: specificDept.org_name },
                hospitalization: { dischargeDisposition: { coding: [{ code: dischargeDispositionCode }] } },
                period: { start: admissionDate.toISOString(), end: dischargeDate.toISOString() }
            });

            const procId = `proc-${mode}-${genCounter}`;
            fhirBundleBuffer.push({
                resourceType: "Procedure",
                id: procId,
                status: "completed",
                subject: { reference: `Patient/${patId}` },
                encounter: { reference: `Encounter/${encId}` },
                performedPeriod: { start: opStart.toISOString(), end: opEnd.toISOString() },
                performer: [{ actor: { reference: `Practitioner/${docId}` } }]
            });

            const kpiRow = {
                kpi_id: kpiDef.kpiid,
                data_date: opEnd.toISOString().split('T')[0],
                department: specificDept.org_name,
                doctor_id: docId,
                doctor_name: doctorName,
                hospital_id: "台北綜合醫院",
                patient_id: patId,
                patient_gender: gender,
                patient_birth_date: birthDateStr,
                numerator_value: isNumerator ? 1 : 0,
                denominator_value: 1,
                kpi_value: isNumerator ? 1 : 0,
                monthKey: opStart.toISOString().substring(0, 7)
            };
            results.push(kpiRow);

            if (ftInf.length > 0) {
                const ftRow: any = { _patient_id: patId };
                ftInf.forEach((f: any) => {
                    const path = f.fhir_source || '';
                    let val = "N/A";
                    if (path.includes("Patient.identifier")) val = patId.replace('pat-', 'P');
                    else if (path.includes("Patient.name")) val = `模擬病患 ${genCounter}`;
                    else if (path.includes("Procedure.code")) val = mode === 'mortality' ? "OP-001" : "AB-101";
                    else if (path.includes("Practitioner.name") || path.includes("performer")) val = doctorName;
                    else if (path.includes("Organization") || path.includes("serviceType")) val = specificDept.org_name;
                    else if (path.includes("start")) val = opStart.toLocaleString();
                    else if (path.includes("end")) val = opEnd.toLocaleString();
                    else if (path.includes("status")) val = "finished";
                    if (f.column_slot) ftRow[f.column_slot] = val;
                });
                ftResults.push(ftRow);
            }

            return { kpiRows: results, ftRows: ftResults };
        };

        const coveragePromises = [];
        for (let d = startDay; d < endDay; d++) {
            for (const deptItem of allDepts) {
                coveragePromises.push(() => createCase(d, deptItem.deptInfo));
            }
        }

        const kpiOut: any[] = [];
        const ftOut: any[] = [];
        const batchSize = 50;
        for (let i = 0; i < coveragePromises.length; i += batchSize) {
            const batch = coveragePromises.slice(i, i + batchSize);
            const batchResults = await Promise.all(batch.map(f => f()));
            batchResults.forEach(r => {
                kpiOut.push(...r.kpiRows);
                ftOut.push(...r.ftRows);
            });
        }

        const cleanDetails = kpiOut.map(({ monthKey, ...rest }) => rest);
        const { data: insertedDetails, error: detailError } = await supabase
            .from("kpi_detail")
            .insert(cleanDetails)
            .select("id, patient_id");

        if (detailError) throw detailError;

        if (insertedDetails && insertedDetails.length > 0 && ftOut.length > 0) {
            const idMap = new Map(insertedDetails.map(row => [row.patient_id, row.id]));
            const ftToInsert = ftOut
                .filter(fd => idMap.has(fd._patient_id))
                .map(fd => {
                    const { _patient_id, ...rest } = fd;
                    return { kpi_detail_id: idMap.get(_patient_id), ...rest };
                });
            if (ftToInsert.length > 0) {
                for (let i = 0; i < ftToInsert.length; i += 500) {
                    await supabase.from("kpi_ft_detail").insert(ftToInsert.slice(i, i + 500));
                }
            }
        }

        // Summary calculation on final batch
        if (batchIndex === totalBatches - 1) {
            const { data: allDetails } = await supabase.from("kpi_detail").select("*").eq("kpi_id", kpiDef.kpiid);
            if (allDetails) {
                const summaryMap = new Map<string, any>();
                allDetails.forEach(d => {
                    const key = `${d.department}|${d.doctor_name}|${indicatorName}`;
                    if (!summaryMap.has(key)) {
                        summaryMap.set(key, {
                            department: d.department, doctor: d.doctor_name, indicator_name: indicatorName,
                            indicator_def: kpiDef.formula || "", numerator: 0, denominator: 0, unit: "%"
                        });
                    }
                    const item = summaryMap.get(key);
                    item.numerator += (d.numerator_value || 0);
                    item.denominator += (d.denominator_value || 0);
                });
                const summaryList = Array.from(summaryMap.values()).map(item => ({
                    ...item,
                    value: item.denominator > 0 ? parseFloat(((item.numerator / item.denominator) * 100).toFixed(2)) : 0
                }));
                await supabase.from("KPI").upsert(summaryList, { onConflict: "department, doctor, indicator_name" });
            }
        }

        // FHIR Upload
        const uploadSize = 100;
        const { data: sysData } = await supabase.from("system").select("SysValue").eq("SysCode", "FHIR_SERVER").single();
        let fhirBaseUrl = sysData?.SysValue || FHIR_SERVER_URL;
        if (fhirBaseUrl.endsWith('/')) fhirBaseUrl = fhirBaseUrl.slice(0, -1);
        
        const { getBackendAccessToken } = await import("@/utils/backend-auth");
        let accessToken: string | null = null;
        try { accessToken = await getBackendAccessToken(fhirBaseUrl); } catch (e) {}

        let uploadCount = 0;
        for (let i = 0; i < fhirBundleBuffer.length; i += uploadSize) {
            const chunk = fhirBundleBuffer.slice(i, i + uploadSize);
            const bundle = {
                resourceType: "Bundle", type: "transaction",
                entry: chunk.map(res => ({
                    fullUrl: `${res.resourceType}/${res.id}`, resource: res,
                    request: { method: "PUT", url: `${res.resourceType}/${res.id}` }
                }))
            };
            const headers: any = { "Content-Type": "application/json" };
            if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
            try {
                const bRes = await fetch(fhirBaseUrl, { method: "POST", headers, body: JSON.stringify(bundle) });
                if (bRes.ok) uploadCount += chunk.length;
            } catch (e) {}
        }

        return { success: true, message: `批次 ${batchIndex + 1}/${totalBatches} 完成: 生成 ${kpiOut.length} 筆資料 (FHIR 上傳 ${uploadCount}/${fhirBundleBuffer.length} 成功)` };
    } catch (err) {
        console.error(err);
        return { success: false, message: "生成失敗: " + String(err) };
    }
}

export async function clearGeneratedData(mode: 'all' | 'mortality' | 'antibiotic' = 'all') {
    try {
        const supabase = await createClient();
        const dummyUuid = '00000000-0000-0000-0000-000000000000';
        if (mode === 'all') {
            await supabase.from("KPI").delete().neq('id', -1); 
            await supabase.from("kpi_detail").delete().neq('id', dummyUuid); 
            await supabase.from("kpi_ft_detail").delete().neq('id', dummyUuid);
        } else {
            const indicatorName = mode === 'mortality' ? '手術後 48 小時內死亡率' : '預防性抗生素在手術劃刀前1小時內給予比率';
            const { data: kpi } = await supabase.from("kpi_definitions").select("kpiid").eq("name", indicatorName).single();
            await supabase.from("KPI").delete().eq("indicator_name", indicatorName);
            if (kpi) await supabase.from("kpi_detail").delete().eq("kpi_id", kpi.kpiid);
        }
        return { success: true, message: "資料已成功清除" };
    } catch (err) {
        return { success: false, message: "清除失敗: " + String(err) };
    }
}

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

        const supabase = await createClient();

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

        // Skip auth user creation for now to avoid complexity in this trigger
        // Just clear existing data first
        await supabase.from("KPI").delete().neq('id', -1);
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
        const ftDataBuffer: any[] = [];
        const TARGET_PER_INDICATOR = 500;
        
        // Fetch FT Definitions for all indicators beforehand
        const { data: allFtInf } = await supabase.from("kpi_ft_detail_inf").select("*").order('seq');
        const ftInfMap = new Map();
        allFtInf?.forEach(f => {
            if (!ftInfMap.has(f.kpi_id)) ftInfMap.set(f.kpi_id, []);
            ftInfMap.get(f.kpi_id).push(f);
        });

        const indicators = [
            { id: "mortality", name: "手術後 48 小時內死亡率", def: "麻醉開始後48小時內死亡(含AAD)" },
            { id: "antibiotic", name: "預防性抗生素在手術劃刀前1小時內給予比率", def: "手術劃刀前1小時內給予預防性抗生素人次 / 手術人次 * 100%" }
        ];

        let globalCounter = 0;

        for (const indicator of indicators) {
            const { data: kpiDef } = await supabase.from("kpi_definitions").select("kpiid, formula").eq("name", indicator.name).single();
            
            for (let i = 0; i < TARGET_PER_INDICATOR; i++) {
                globalCounter++;
                const dept = departments[globalCounter % departments.length];
                const doc = dept.docs[(globalCounter + i) % dept.docs.length]; 

                const patId = `pat-sim-${globalCounter}`;
                const gender = globalCounter % 2 === 0 ? "male" : "female";
                const age = 30 + (globalCounter % 60);

                const opStart = new Date(END_DATE.getTime() - (globalCounter % DAYS_BACK) * 24 * 60 * 60 * 1000);
                const opEnd = new Date(opStart.getTime() + (1 + Math.random() * 3) * 60 * 60 * 1000);
                const admissionDate = new Date(opStart.getTime() - (1 + Math.random() * 3) * 24 * 60 * 60 * 1000);

                let isNumerator = false;
                let deathTime = null;
                let isDeceased = false;
                let dischargeCode = "home";

                if (indicator.id === "mortality") {
                    const baseProb = ["dept-cardio", "dept-neuro"].includes(dept.id) ? 0.05 : 0.01;
                    if (Math.random() < baseProb) { 
                        isNumerator = true;
                        isDeceased = true;
                        deathTime = new Date(opEnd.getTime() + (Math.random() * 40 + 2) * 60 * 60 * 1000);
                        dischargeCode = "exp";
                    }
                } else if (indicator.id === "antibiotic") {
                    const baseProb = ["dept-ortho", "dept-ent"].includes(dept.id) ? 0.15 : 0.03;
                    isNumerator = Math.random() > baseProb;
                }

                const dischargeDate = deathTime || new Date(opEnd.getTime() + (3 + Math.random() * 7) * 24 * 60 * 60 * 1000);
                const birthStr = new Date(opStart.getTime() - age * 365.25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

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
                    numerator_value: isNumerator ? 1 : 0,
                    denominator_value: 1,
                    kpi_value: isNumerator ? 1 : 0
                };
                kpiDetailsBuffer.push(detailRow);

                // 生成 FT 鑽取資料
                const ftInf = ftInfMap.get(kpiDef?.kpiid);
                if (ftInf && ftInf.length > 0) {
                    const ftRow: any = { _patient_id: patId };
                    ftInf.forEach((f: any) => {
                        const path = f.fhir_source || '';
                        let val = "N/A";
                        if (path.includes("Patient.identifier")) val = patId.replace('pat-sim-', 'P');
                        else if (path.includes("Patient.name")) val = `模擬病患 ${globalCounter}`;
                        else if (path.includes("Procedure.code")) val = indicator.id === 'mortality' ? "OP-001" : "AB-101";
                        else if (path.includes("Practitioner.name") || path.includes("performer")) val = doc.name;
                        else if (path.includes("Organization") || path.includes("serviceType")) val = dept.name;
                        else if (path.includes("start")) val = opStart.toLocaleString();
                        else if (path.includes("end")) val = opEnd.toLocaleString();
                        else if (path.includes("status")) val = "finished";
                        if (f.column_slot) ftRow[f.column_slot] = val;
                    });
                    ftDataBuffer.push(ftRow);
                }
            }
        }

        const { data: insertedDetails, error: detailError } = await supabase
            .from("kpi_detail")
            .insert(kpiDetailsBuffer)
            .select("id, patient_id");

        if (detailError) throw detailError;

        if (insertedDetails && insertedDetails.length > 0 && ftDataBuffer.length > 0) {
            const idMap = new Map(insertedDetails.map(row => [row.patient_id, row.id]));
            const ftToInsert = ftDataBuffer
                .filter(fd => idMap.has(fd._patient_id))
                .map(fd => {
                    const { _patient_id, ...rest } = fd;
                    return { kpi_detail_id: idMap.get(_patient_id), ...rest };
                });
            if (ftToInsert.length > 0) {
                for (let i = 0; i < ftToInsert.length; i += 500) {
                    await supabase.from("kpi_ft_detail").insert(ftToInsert.slice(i, i + 500));
                }
            }
        }

        return { success: true, data: bundle, message: `已匯出並同步 ${globalCounter} 筆數據` };
    } catch (err) {
        console.error(err);
        return { success: false, message: "匯出失敗: " + String(err) };
    }
}
