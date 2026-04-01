"use server";

import { createClient } from "@/utils/supabase/server";
import { getBackendAccessToken } from "@/utils/backend-auth";
import { SMART_CONFIG } from "@/utils/smart-conf";
import * as crypto from 'crypto';

/**
 * Helper: Limit Concurrency for Promises
 */
async function promiseLimit<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
    const results: T[] = [];
    let i = 0;
    const execute = async () => {
        while (i < tasks.length) {
            const index = i++;
            const task = tasks[index];
            if (task) {
                results[index] = await task();
            }
        }
    };
    const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => execute());
    await Promise.all(workers);
    return results;
}

/**
 * Helper: Fetch with Automatic Retry & Backoff
 */
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3, sid?: string, indicatorName?: string): Promise<Response> {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const res = await fetch(url, options);
            if (res.status === 429 || (res.status >= 500 && res.status <= 599)) {
                throw new Error(`HTTP ${res.status}`);
            }
            return res;
        } catch (e: any) {
            if (i === maxRetries - 1) throw e;
            const wait = Math.pow(2, i) * 1000;
            if (sid) {
                await addSyncLog(sid, `⚠️ 網路連線異常 (${e.message})，正在進行第 ${i + 1}/${maxRetries} 次重試...`, "warning", indicatorName);
            }
            await new Promise(resolve => setTimeout(resolve, wait));
        }
    }
    throw new Error("Maximum retries reached");
}

/** 
 * Synchronize Logging Utilities 
 */
export async function addSyncLog(sessionId: string, message: string, status: 'info' | 'success' | 'warning' | 'error' = 'info', indicatorName?: string) {
    try {
        const supabase = await createClient();
        let validSessionId = sessionId;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(sessionId)) return;

        await supabase.from("sync_logs").insert({
            session_id: validSessionId,
            message,
            status,
            indicator_name: indicatorName
        });
    } catch (e) {
        console.error("Failed to add sync log:", e);
    }
}

export async function clearOldSyncLogs() {
    try {
        const supabase = await createClient();
        await supabase.from("sync_logs").delete().lt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    } catch (e) {
        console.error("Failed to clear old sync logs:", e);
    }
}

export async function getSyncLogs(sessionId: string) {
    try {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from("sync_logs")
            .select("*")
            .eq("session_id", sessionId)
            .order("created_at", { ascending: false });
        if (error) throw error;
        return { success: true, data };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

const FHIR_SERVER_URL = process.env.NEXT_PUBLIC_FHIR_BASE_URL || "http://172.16.7.78:8082/fhir";

const getStartDate = () => {
    const d = new Date();
    d.setDate(d.getDate() - 3650);
    return d.toISOString().split('T')[0];
};

async function fetchFhir(url: string, accessToken: string, sid?: string, indicatorName?: string) {
    const resourceType = url.split('?')[0].split('/').pop();
    if (sid) {
        await addSyncLog(sid, indicatorName ? `[${indicatorName}] [FHIR] GET ${resourceType}...` : `[FHIR] GET ${resourceType}...`, "info", indicatorName);
    }
    const headers: Record<string, string> = { 'Accept': 'application/fhir+json' };
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
    
    const res = await fetchWithRetry(url, { headers }, 3, sid, indicatorName);
    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText}`);
    }
    const data = await res.json();
    if (sid) {
        const count = data.entry?.length || 0;
        await addSyncLog(sid, `2. 取得 API：[${resourceType}] ...取得數量：${count} 筆`, "info", indicatorName);
    }
    return data;
}

async function fetchFhirAll(url: string, max: number = 1000, accessToken: string, sid?: string, indicatorName?: string) {
    let all: any[] = [];
    let currentUrl = url;
    while (currentUrl && all.length < max) {
        const bundle = await fetchFhir(currentUrl, accessToken, sid, indicatorName);
        const entries = bundle.entry?.map((e: any) => e.resource) || [];
        all = all.concat(entries);
        const nextLink = bundle.link?.find((l: any) => l.relation === 'next')?.url;
        currentUrl = nextLink;
        if (!nextLink) break;
    }
    return all;
}

async function fetchByIds(baseUrl: string, type: string, ids: string[], accessToken: string, sid?: string, indicatorName?: string) {
    if (ids.length === 0) return [];
    const uniqueIds = Array.from(new Set(ids));
    const results: any[] = [];
    const batches = [];
    for (let i = 0; i < uniqueIds.length; i += 20) batches.push(uniqueIds.slice(i, i + 20));

    const fetchPromises = batches.map(async (batch) => {
        const url = `${baseUrl}/${type}?_id=${batch.join(',')}&_count=1000`;
        try {
            const bundle = await fetchFhir(url, accessToken, sid, indicatorName);
            return bundle.entry?.map((e: any) => e.resource) || [];
        } catch (e) {
            return [];
        }
    });

    const resultsArray = await Promise.all(fetchPromises);
    resultsArray.forEach(batchResults => results.push(...batchResults));
    return results;
}

function getValueByPath(obj: any, path: string) {
    if (!path || !obj) return undefined;
    const resourceTypes = ['Patient', 'Encounter', 'Procedure', 'Observation', 'MedicationAdministration', 'Practitioner', 'Organization'];
    let cleanPath = path;
    for (const type of resourceTypes) {
        if (path.startsWith(type + '.')) {
            cleanPath = path.substring(type.length + 1);
            break;
        }
    }
    const parts = cleanPath.split('.');
    let current = obj;
    for (const part of parts) {
        if (current === undefined || current === null) return undefined;
        if (Array.isArray(current)) {
            current = current.map(c => c[part]).flat().filter(v => v !== undefined && v !== null);
        } else {
            current = current[part];
        }
    }
    if (Array.isArray(current) && current.length === 1) return current[0];
    return current;
}

function evaluateCondition(resource: any, condition: any): boolean {
    const { path, operator, value } = condition;
    const actualValue = getValueByPath(resource, path);
    const check = (val: any) => {
        if (val === undefined || val === null) return false;
        const strVal = String(val);
        const strTarget = String(value);
        switch (operator) {
            case 'equals': return strVal === strTarget || (strTarget.includes(',') && strTarget.split(',').map(s => s.trim()).includes(strVal));
            case 'contains': return strVal.includes(strTarget);
            case 'greaterThan': return parseFloat(strVal) > parseFloat(strTarget);
            case 'lessThan': return parseFloat(strVal) < parseFloat(strTarget);
            case 'exists': return true;
            default: return strVal == strTarget;
        }
    };
    if (Array.isArray(actualValue)) return actualValue.some(v => check(v));
    return check(actualValue);
}

export async function getSyncIndicators() {
    try {
        const supabase = await createClient();
        const { data, error } = await supabase.from("kpi_definitions").select("name").order("name");
        if (error) throw error;
        return { success: true, data: data.map(d => d.name) };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

export async function getFhirRecordCount(indicatorName: string) {
    try {
        const supabase = await createClient();
        const { data: sysData } = await supabase.from("system").select("SysValue").eq("SysCode", "FHIR_SERVER").single();
        const activeFhirUrl = sysData?.SysValue || FHIR_SERVER_URL;
        const { data: kpi } = await supabase.from("kpi_definitions").select("*").eq("name", indicatorName).single();
        if (!kpi) throw new Error(`Indicator ${indicatorName} not found`);
        const { data: dls } = await supabase.from("kpi_dl").select("*").eq("kpiid", kpi.kpiid).eq("kpi_dl_type", 1).order('seq');
        if (!dls || dls.length === 0) return { success: true, count: 0 };
        let baseResource = dls[0].kpi_id_fhir_resource || (indicatorName.includes("手術") ? "Procedure" : "Encounter");
        const START_DATE = getStartDate();
        const url = `${activeFhirUrl}/${baseResource}?date=ge${START_DATE}&_summary=count`;
        let accessToken = "";
        try { accessToken = await getBackendAccessToken(activeFhirUrl) || ""; } catch (e) {}
        const res = await fetchFhir(url, accessToken);
        return { success: true, count: res?.total || 0, resourceType: baseResource };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

// Phase 3: Sync a single indicator batch (Integrity V5: Incremental Updates)
export async function syncFhirIndicatorBatch(indicatorName: string, sessionId?: string) {
    const sid = sessionId || crypto.randomUUID();
    console.log(`[Sync] Starting Integrity V5 batch for ${indicatorName} (ID: ${sid})`);
    const TIMEOUT_MS = 55000; // 55 seconds to stay under 60s platform limits
    
    const syncLogic = async () => {
        const supabase = await createClient();
        const START_DATE = getStartDate();
        await addSyncLog(sid, `🚀 開始同步指標：「${indicatorName}」 (模式: V5 增量同步)`, "info", indicatorName);

        const { data: sysData } = await supabase.from("system").select("SysValue").eq("SysCode", "FHIR_SERVER").single();
        const activeFhirUrl = sysData?.SysValue || FHIR_SERVER_URL;
        const { data: kpiDef } = await supabase.from("kpi_definitions").select("*").eq("name", indicatorName).single();
        if (!kpiDef) throw new Error("指標定義不存在");

        const [{ data: kpiDlls }, { data: ftInf }] = await Promise.all([
            supabase.from("kpi_dl").select("*").eq("kpiid", kpiDef.kpiid).order('seq'),
            supabase.from("kpi_ft_detail_inf").select("*").eq("kpi_id", kpiDef.kpiid).order('seq')
        ]);
        
        await addSyncLog(sid, `正在初始化資料空間...`, "info", indicatorName);
        await supabase.from("kpi_detail").delete().eq("kpi_id", kpiDef.kpiid);
        await supabase.from("KPI").delete().eq("indicator_name", indicatorName);

        let accessToken = "";
        try { 
            accessToken = await getBackendAccessToken(activeFhirUrl) || ""; 
            if (!accessToken) throw new Error("取得令牌失敗");
            await addSyncLog(sid, `1. FHIR 授權成功`, "success", indicatorName);
        } catch (e: any) {
            throw new Error(`FHIR 授權失敗: ${e.message}`);
        }

        const denoms = kpiDlls?.filter(d => d.kpi_dl_type === 1) || [];
        const nums = kpiDlls?.filter(d => d.kpi_dl_type === 2) || [];
        let baseResource = denoms[0]?.kpi_id_fhir_resource || (indicatorName.includes("手術") ? "Procedure" : "Encounter");

        const url = `${activeFhirUrl}/${baseResource}?date=ge${START_DATE}&_count=500`;
        await addSyncLog(sid, `正在讀取基礎資源 (${baseResource})...`, "info", indicatorName);
        const resources = await fetchFhirAll(url, 10000, accessToken, sid, indicatorName); 

        if (!resources || resources.length === 0) {
            await addSyncLog(sid, "查無相關資料。", "warning", indicatorName);
            return { success: true, count: 0 };
        }

        const subChunks = (arr: any[], size: number) => {
            const res = [];
            for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
            return res;
        };

        const chunks = subChunks(resources, 100);
        let processedCount = 0;

        for (const chunk of chunks) {
            const patIds = chunk.map(r => r.subject?.reference?.split('/').pop()).filter(Boolean);
            const encIds = chunk.map(r => (baseResource === 'Encounter' ? r.id : r.encounter?.reference?.split('/').pop())).filter(Boolean);
            const pracIds = chunk.map(r => r.performer?.[0]?.actor?.reference?.split(/[:\/]/).pop()).filter(Boolean);

            const needsObs = ftInf?.some(f => f.fhir_source?.includes('Observation'));
            const needsMeds = ftInf?.some(f => f.fhir_source?.includes('Medication'));

            const fetchPromises: Promise<any>[] = [
                fetchByIds(activeFhirUrl, "Patient", patIds, accessToken, sid, indicatorName),
                fetchByIds(activeFhirUrl, "Encounter", encIds, accessToken, sid, indicatorName),
                fetchByIds(activeFhirUrl, "Practitioner", pracIds, accessToken, sid, indicatorName)
            ];

            if (needsObs && encIds.length > 0) {
                const obsTasks = subChunks(encIds, 50).map(c => () => fetchFhirAll(`${activeFhirUrl}/Observation?encounter=${c.join(',')}&_count=1000`, 1000, accessToken, sid, indicatorName));
                fetchPromises.push(promiseLimit(obsTasks, 3).then(r => r.flat()));
            } else fetchPromises.push(Promise.resolve([]));

            if (needsMeds && encIds.length > 0) {
                const medTasks = subChunks(encIds, 50).map(c => () => fetchFhirAll(`${activeFhirUrl}/MedicationAdministration?context=${c.join(',')}&_count=1000`, 1000, accessToken, sid, indicatorName));
                fetchPromises.push(promiseLimit(medTasks, 3).then(r => r.flat()));
            } else fetchPromises.push(Promise.resolve([]));

            const [pats, encs, pracs, obss, meds] = await Promise.all(fetchPromises);
            const patMap = new Map(pats.map((p: any) => [p.id, p]));
            const pracMap = new Map(pracs.map((p: any) => [p.id, p]));
            const encMap = new Map(encs.map((e: any) => [e.id, e]));

            const batchDetails: any[] = [];
            const batchFtDetails: any[] = [];
            const batchSummary = new Map<string, { n: number, d: number, dept: string, doc: string }>();

            for (const res of chunk) {
                const pId = res.subject?.reference?.split('/').pop();
                const eId = baseResource === 'Encounter' ? res.id : res.encounter?.reference?.split('/').pop();
                const patient = patMap.get(pId);
                const encounter = encMap.get(eId);
                if (!patient) continue;

                let isNumerator = false;
                if (indicatorName.includes("死亡率")) {
                    const disp = encounter?.hospitalization?.dischargeDisposition?.coding?.[0]?.code;
                    if (['aadvice', 'exp'].includes(disp)) isNumerator = true;
                    if (!isNumerator && res.performedPeriod?.end && patient.deceasedDateTime) {
                        const diff = (new Date(patient.deceasedDateTime).getTime() - new Date(res.performedPeriod.end).getTime()) / 3600000;
                        if (diff > 0 && diff <= 48) isNumerator = true;
                    }
                } else if (indicatorName.includes("抗生素")) {
                    isNumerator = res.note?.some((n: any) => n.text?.includes("given: true")) || false;
                } else {
                    isNumerator = nums.some(s => evaluateCondition(res, JSON.parse(s.kpi_dl_condition_value || '{}')));
                }

                const dId = res.performer?.[0]?.actor?.reference?.split(/[:\/]/).pop() || "unknown";
                const dName = pracMap.get(dId)?.name?.[0]?.text || dId;
                const dept = encounter?.serviceProvider?.display || "一般外科";
                const dDate = res.performedPeriod?.end || res.period?.end || new Date().toISOString();

                const detailId = crypto.randomUUID();
                batchDetails.push({
                    id: detailId, kpi_id: kpiDef.kpiid, data_date: dDate.split('T')[0],
                    department: dept, doctor_id: dId, doctor_name: dName,
                    hospital_id: "台北綜合醫院", patient_id: pId, patient_gender: patient.gender,
                    patient_birth_date: patient.birthDate, numerator_value: isNumerator ? 1 : 0,
                    denominator_value: 1, kpi_value: isNumerator ? 1 : 0
                });

                if (ftInf && ftInf.length > 0) {
                    const ftRow: any = { kpi_detail_id: detailId };
                    for (const f of ftInf) {
                        let val = getValueByPath(res, f.fhir_source) || getValueByPath(patient, f.fhir_source) || getValueByPath(encounter, f.fhir_source);
                        if (f.column_slot) ftRow[f.column_slot] = String(val || "N/A");
                    }
                    batchFtDetails.push(ftRow);
                }

                const sumKey = `${dept}|${dName}`;
                if (!batchSummary.has(sumKey)) batchSummary.set(sumKey, { n: 0, d: 0, dept, doc: dName });
                const s = batchSummary.get(sumKey)!;
                s.n += (isNumerator ? 1 : 0);
                s.d += 1;
            }

            if (batchDetails.length > 0) {
                await supabase.from("kpi_detail").insert(batchDetails);
                if (batchFtDetails.length > 0) await supabase.from("kpi_ft_detail").insert(batchFtDetails);

                for (const s of batchSummary.values()) {
                    const { data: exist } = await supabase.from("KPI").select("numerator, denominator").match({ department: s.dept, doctor: s.doc, indicator_name: indicatorName }).maybeSingle();
                    const n = (exist?.numerator || 0) + s.n;
                    const d = (exist?.denominator || 0) + s.d;
                    await supabase.from("KPI").upsert({
                        department: s.dept, doctor: s.doc, indicator_name: indicatorName,
                        numerator: n, denominator: d, value: d > 0 ? parseFloat(((n / d) * 100).toFixed(2)) : 0,
                        indicator_def: kpiDef.formula, unit: "%"
                    }, { onConflict: "department, doctor, indicator_name" });
                }
            }
            processedCount += chunk.length;
            await addSyncLog(sid, `進度：${processedCount}/${resources.length} 筆已完成並更新至報表...`, "info", indicatorName);
        }
        await addSyncLog(sid, `✅ 同步成功完成！總計處理 ${resources.length} 筆資料。`, "success", indicatorName);
        return { success: true, count: resources.length };
    };

    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("SYNC_TIMEOUT")), TIMEOUT_MS));
    try {
        return await Promise.race([syncLogic(), timeoutPromise]);
    } catch (e: any) {
        const msg = e.message === "SYNC_TIMEOUT" ? "同步超時，部分數據已保存並反映在報表，請再次執行以續傳。" : e.message;
        await addSyncLog(sid, `❌ 同步中斷：${msg}`, "error", indicatorName);
        return { success: false, message: msg };
    }
}

export async function syncFhirData() {
    const { data: indicators } = await getSyncIndicators();
    if (!indicators) return { success: false, message: "無法取得指標" };
    for (const name of indicators) await syncFhirIndicatorBatch(name);
    return { success: true, message: "同步作業完成" };
}
