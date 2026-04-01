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

/**
 * Helper: Extract the most relevant date from various FHIR resources
 */
function extractResourceDate(res: any): string {
    // Priority 1: Clinical event time
    const clinicalDate = res.performedDateTime || 
                         res.performedPeriod?.end || 
                         res.performedPeriod?.start ||
                         res.period?.end || 
                         res.period?.start ||
                         res.occurrenceDateTime || 
                         res.effectiveDateTime ||
                         res.authoredOn;
    
    if (clinicalDate) return String(clinicalDate).split('T')[0];
    
    // Priority 2: Meta last updated (as fallback for "when this happened")
    if (res.meta?.lastUpdated) return String(res.meta.lastUpdated).split('T')[0];

    return "1970-01-01"; // Generic fallback to identify records with missing dates
}

async function fetchFhirAll(url: string, timeoutMs: number, accessToken: string, sessionId: string, indicatorName: string) {
    const results: any[] = [];
    let nextUrl = url;
    let pageCount = 0;
    const MAX_PAGES = 50; // Safety cap: 50 pages to prevent Action Timeout (approx 5000 records)

    while (nextUrl && pageCount < MAX_PAGES) {
        try {
            const res = await fetch(nextUrl, {
                headers: accessToken ? { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/fhir+json' } : { 'Accept': 'application/fhir+json' },
                cache: 'no-store',
                signal: AbortSignal.timeout(timeoutMs)
            });

            if (!res.ok) {
                await addSyncLog(sessionId, `FHIR Server Error: ${res.status}`, "error", indicatorName);
                break;
            }

            const bundle = await res.json();
            if (bundle.entry) bundle.entry.forEach((e: any) => results.push(e.resource));

            nextUrl = bundle.link?.find((l: any) => l.relation === 'next')?.url || null;
            pageCount++;
            
            if (pageCount % 10 === 0) {
                console.log(`[Sync] ${indicatorName} fetched ${results.length} resources...`);
            }
        } catch (e: any) {
            await addSyncLog(sessionId, `Fetch interrupted: ${e.message}`, "warning", indicatorName);
            break;
        }
    }
    return results;
}

async function fetchByIds(baseUrl: string, resourceType: string, ids: string[], accessToken: string, sessionId: string, indicatorName: string) {
    if (ids.length === 0) return [];
    const uniqueIds = Array.from(new Set(ids));
    const results: any[] = [];
    const CHUNK_SIZE = 40; 
    
    const batches = [];
    for (let i = 0; i < uniqueIds.length; i += CHUNK_SIZE) {
        batches.push(uniqueIds.slice(i, i + CHUNK_SIZE));
    }

    for (const chunk of batches) {
        const url = `${baseUrl}/${resourceType}?_id=${chunk.join(',')}`;
        try {
            const res = await fetch(url, {
                headers: accessToken ? { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/fhir+json' } : { 'Accept': 'application/fhir+json' },
                cache: 'no-store',
                signal: AbortSignal.timeout(30000)
            });
            if (res.ok) {
                const bundle = await res.json();
                if (bundle.entry) bundle.entry.forEach((e: any) => results.push(e.resource));
            }
        } catch (e) {
            console.error(`Batch fetch failed for ${resourceType}:`, e);
        }
    }
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
            current = current.map(c => c[part]).flat().filter(id => id !== undefined && id !== null);
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

interface SyncResult {
    success: boolean;
    count?: number;
    message?: string;
    error?: string;
}

/**
 * Helper: Recalculate and Update KPI Summary from Details
 */
async function updateKPISummary(indicatorName: string, kpiid: string, formula: string) {
    const supabase = await createClient();
    
    // Aggregate data from kpi_detail
    const { data: summary } = await supabase.rpc('get_kpi_summary_by_indicator', { 
        target_indicator_name: indicatorName 
    });
    
    if (summary && summary.length > 0) {
        for (const s of summary) {
            await supabase.from("KPI").upsert({
                department: s.department,
                doctor: s.doctor_name,
                indicator_name: indicatorName,
                numerator: s.n,
                denominator: s.d,
                value: s.d > 0 ? parseFloat(((s.n / s.d) * 100).toFixed(2)) : 0,
                indicator_def: formula,
                unit: "%",
                report_date: s.latest_date
            }, { onConflict: "department, doctor, indicator_name" });
        }
    }
}

/**
 * Manual Data Cleanup - User controlled
 */
export async function clearAllSyncData() {
    try {
        const supabase = await createClient();
        await supabase.from("KPI").delete().neq("id", 0);
        await supabase.from("kpi_detail").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        return { success: true };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

export async function syncFhirIndicatorBatch(indicatorName: string, sessionId?: string, stepInfo?: string): Promise<SyncResult> {
    const sid = sessionId || crypto.randomUUID();
    const TIMEOUT_MS = 600000; // 10 minutes for large streaming
    
    const syncLogic = async () => {
        const supabase = await createClient();
        const START_DATE = getStartDate();
        const stepPrefix = stepInfo ? `[STEP] ${stepInfo} ` : "";
        await addSyncLog(sid, `${stepPrefix}🚀 流式同步啟動：「${indicatorName}」 (V12 增量存檔版)`, "info", indicatorName);
        
        const { data: sysData } = await supabase.from("system").select("SysValue").eq("SysCode", "FHIR_SERVER").single();
        const activeFhirUrl = sysData?.SysValue || FHIR_SERVER_URL;
        const { data: kpiDef } = await supabase.from("kpi_definitions").select("*").eq("name", indicatorName).single();
        if (!kpiDef) throw new Error("指標定義不存在");

        const [{ data: kpiDlls }, { data: ftInf }] = await Promise.all([
            supabase.from("kpi_dl").select("*").eq("kpiid", kpiDef.kpiid).order('seq'),
            supabase.from("kpi_ft_detail_inf").select("*").eq("kpi_id", kpiDef.kpiid).order('seq')
        ]);
        
        let accessToken = "";
        try { accessToken = await getBackendAccessToken(activeFhirUrl) || ""; } catch (e: any) {}

        const denoms = kpiDlls?.filter(d => d.kpi_dl_type === 1) || [];
        let baseResource = denoms[0]?.kpi_id_fhir_resource || (indicatorName.includes("手術") ? "Procedure" : "Encounter");
        
        // STREAMING START: V12.1 - Shrink batch to 100 for extreme stability
        let nextUrl: string | null = `${activeFhirUrl}/${baseResource}?date=ge${START_DATE}&_count=100`;
        let totalProcessed = 0;
        let pageIdx = 0;

        while (nextUrl) {
            pageIdx++;
            const bundle = await fetchFhir(nextUrl, accessToken, sid, indicatorName);
            const chunk = bundle.entry?.map((e: any) => e.resource) || [];
            if (chunk.length === 0) break;

            // PAGE PROCESSING
            const patIds = chunk.map((r: any) => r.subject?.reference?.split('/').pop()).filter(Boolean);
            const encIds = chunk.map((r: any) => (baseResource === 'Encounter' ? r.id : r.encounter?.reference?.split('/').pop())).filter(Boolean);
            const pracIds = chunk.map((r: any) => r.performer?.[0]?.actor?.reference?.split(/[:\/]/).pop()).filter(Boolean);
            
            const [pats, encs, pracs] = await Promise.all([
                fetchByIds(activeFhirUrl, "Patient", patIds, accessToken, sid, indicatorName),
                fetchByIds(activeFhirUrl, "Encounter", encIds, accessToken, sid, indicatorName),
                fetchByIds(activeFhirUrl, "Practitioner", pracIds, accessToken, sid, indicatorName)
            ]);

            const patMap = new Map(pats.map((p: any) => [p.id, p]));
            const pracMap = new Map(pracs.map((p: any) => [p.id, p]));
            const encMap = new Map(encs.map((e: any) => [e.id, e]));

            const batchDetails: any[] = [];
            const batchFtDetails: any[] = [];

            for (const res of chunk) {
                const pId = res.subject?.reference?.split('/').pop();
                const eId = baseResource === 'Encounter' ? res.id : res.encounter?.reference?.split('/').pop();
                const patient = patMap.get(pId) as any;
                const encounter = encMap.get(eId) as any;
                if (!patient) continue;

                const nums = kpiDlls?.filter(d => d.kpi_dl_type === 2) || [];
                let isNumerator = false;
                if (indicatorName.includes("死亡率")) {
                    const disp = encounter?.hospitalization?.dischargeDisposition?.coding?.[0]?.code;
                    if (['aadvice', 'exp'].includes(disp)) isNumerator = true;
                    else if (res.performedPeriod?.end && patient.deceasedDateTime) {
                        const diff = (new Date(patient.deceasedDateTime).getTime() - new Date(res.performedPeriod.end).getTime()) / 3600000;
                        if (diff > 0 && diff <= 48) isNumerator = true;
                    }
                } else if (indicatorName.includes("抗生素")) {
                    isNumerator = res.note?.some((n: any) => n.text?.includes("given: true")) || false;
                } else {
                    isNumerator = nums.some(s => evaluateCondition(res, JSON.parse(s.kpi_dl_condition_value || '{}')));
                }

                const dId = res.performer?.[0]?.actor?.reference?.split(/[:\/]/).pop() || "unknown";
                const practitioner = pracMap.get(dId) as any;
                const dName = practitioner?.name?.[0]?.text || practitioner?.name?.[0]?.family || dId;
                const dept = encounter?.serviceProvider?.display || "一般外科";
                const dDate = extractResourceDate(res);

                const detailId = crypto.randomUUID();
                batchDetails.push({
                    fhir_id: res.id, // V12: Logic link via FHIR ID
                    kpi_id: kpiDef.kpiid, 
                    indicator_name: indicatorName, // Crucial for aggregation
                    data_date: dDate,
                    department: dept, 
                    doctor_id: dId, 
                    doctor_name: dName,
                    hospital_id: "台北綜合醫院", 
                    patient_id: pId, 
                    patient_gender: patient.gender,
                    patient_birth_date: patient.birthDate, 
                    numerator_value: isNumerator ? 1 : 0,
                    denominator_value: 1, 
                    kpi_value: isNumerator ? 1 : 0
                });

                if (ftInf && ftInf.length > 0) {
                    const ftRow: any = { fhir_id: res.id }; // Linkable
                    for (const f of ftInf) {
                        let val = getValueByPath(res, f.fhir_source) || getValueByPath(patient, f.fhir_source) || getValueByPath(encounter, f.fhir_source);
                        if (f.column_slot) ftRow[f.column_slot] = String(val || "-");
                    }
                    batchFtDetails.push(ftRow);
                }
            }

            // REAL-TIME SAVE
            if (batchDetails.length > 0) {
                // Upsert Details (prevent dups via fhir_id)
                await supabase.from("kpi_detail").upsert(batchDetails, { onConflict: "fhir_id" });
                
                // Update FT details (join via detail_id found from fhir_id)
                if (batchFtDetails.length > 0) {
                    const { data: savedDetails } = await supabase.from("kpi_detail").select("id, fhir_id").in("fhir_id", batchFtDetails.map(f => f.fhir_id));
                    const fhirToUuid = new Map(savedDetails?.map(d => [d.fhir_id, d.id]) || []);
                    const ftToSave = batchFtDetails.map(f => ({
                        ...f,
                        kpi_detail_id: fhirToUuid.get(f.fhir_id),
                        fhir_id: undefined // remove temp field
                    })).filter(f => f.kpi_detail_id);
                    await supabase.from("kpi_ft_detail").upsert(ftToSave, { onConflict: "kpi_detail_id" });
                }
            }

            totalProcessed += chunk.length;
            await addSyncLog(sid, `✅ 進度：${totalProcessed} 筆已完成 (Page ${pageIdx})...`, "info", indicatorName);
            
            // Recalculate summary every 5 pages or at the end to balance performance
            if (pageIdx % 5 === 0 || !bundle.link?.find((l: any) => l.relation === 'next')?.url) {
                await updateKPISummary(indicatorName, kpiDef.kpiid, kpiDef.formula);
            }

            nextUrl = bundle.link?.find((l: any) => l.relation === 'next')?.url || null;
            // Stop if excessive (safety) but user has 25k so let's allow up to 500 small pages
            if (pageIdx >= 500) {
                await addSyncLog(sid, "⚠️ 已達單次採集上限 (10萬筆)，終止當前任務。", "warning", indicatorName);
                break;
            }
        }

        await addSyncLog(sid, `🎉 指標「${indicatorName}」串流同步結束！總計處理：${totalProcessed} 筆`, "success", indicatorName);
        return { success: true, count: totalProcessed };
    };

    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("SYNC_TIMEOUT")), TIMEOUT_MS));
    try {
        return await Promise.race([syncLogic(), timeoutPromise]) as SyncResult;
    } catch (e: any) {
        await addSyncLog(sid, `⚠️ 中斷：${e.message}`, "warning", indicatorName);
        return { success: false, message: e.message };
    }
}

export async function syncFhirData(sessionId?: string) {
    const supabase = await createClient();
    const sid = sessionId || crypto.randomUUID();
    
    const { data: lock } = await supabase.from("system").select("SysValue, Modifieddate").eq("SysCode", "SYNC_LOCK").single();
    if (lock?.SysValue === "TRUE") {
        const lastMod = lock.Modifieddate ? new Date(lock.Modifieddate).getTime() : 0;
        const now = new Date().getTime();
        const diffMinutes = (now - lastMod) / 60000;
        
        // If the lock is newer than 10 minutes, prevent concurrent sync
        if (diffMinutes < 10) {
            await addSyncLog(sid, "❌ 同步衝突：偵測到另一個同步進程正在運行(10分內)。", "error");
            return { success: false, message: "⚠️ 同步作業正在進行中，或前次任務尚未逾時，請稍候。" };
        }
        // Else, it's stale, allow it
        await addSyncLog(sid, "⚠️ 偵測到過時同步鎖 (已逾10分)，自動解除鎖定並開始新任務。", "warning");
    }
    
    await supabase.from("system").upsert({ SysCode: "SYNC_LOCK", SysValue: "TRUE", Modifieddate: new Date().toISOString() });
    await addSyncLog(sid, "🚀 啟動全指標自動同步 (V10 伺服器主控版)...", "info");
    
    try {
        const { data: indicators } = await getSyncIndicators();
        if (!indicators || indicators.length === 0) throw new Error("查無指標定義");
        
        let totalSuccess = 0;
        for (let i = 0; i < indicators.length; i++) {
            const name = indicators[i];
            const stepInfo = `${i + 1}/${indicators.length}`;
            const res = await syncFhirIndicatorBatch(name, sid, stepInfo);
            if (res.success) totalSuccess++;
            else break; 
        }
        
        await addSyncLog(sid, `🎊 同步作業全數結束！成功 ${totalSuccess}/${indicators.length} 項指標。`, "success");
        return { success: true, message: `成功完成 ${totalSuccess} 項指標。` };
    } catch (e: any) {
        await addSyncLog(sid, `🚨 主程序崩潰: ${e.message}`, "error");
        return { success: false, message: e.message };
    } finally {
        await supabase.from("system").upsert({ SysCode: "SYNC_LOCK", SysValue: "FALSE" });
    }
}
