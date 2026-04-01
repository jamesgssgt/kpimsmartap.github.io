"use server";

import { createClient } from "@/utils/supabase/server";
import { getBackendAccessToken } from "@/utils/backend-auth";

/** 
 * Synchronize Logging Utilities 
 */
export async function addSyncLog(sessionId: string, message: string, status: 'info' | 'success' | 'warning' | 'error' = 'info', indicatorName?: string) {
    try {
        const supabase = await createClient();
        await supabase.from("sync_logs").insert({
            session_id: sessionId,
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
        const { error } = await supabase.from("sync_logs").delete().lt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
        if (error) throw error;
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

// Fallback to local 172.16.7.78
const FHIR_SERVER_URL = process.env.NEXT_PUBLIC_FHIR_BASE_URL || "http://172.16.7.78:8082/fhir";

const getStartDate = () => {
    const d = new Date();
    d.setDate(d.getDate() - 3650); // 擴展到 10 年，確保所有假資料都被納入
    return d.toISOString().split('T')[0];
};

async function fetchFhir(url: string, accessToken?: string | null) {
    try {
        console.log(`[FHIR Fetch] ${url}`);
        const headers: Record<string, string> = { "Accept": "application/json" };
        if (accessToken) {
            headers["Authorization"] = `Bearer ${accessToken}`;
        }
        const res = await fetch(url, { headers, cache: 'no-store' });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        return await res.json();
    } catch (e) {
        console.error("FHIR Fetch Error:", e);
        return null; 
    }
}

async function fetchFhirAll(url: string, maxItems = 20000, accessToken?: string | null) {
    let results: any[] = [];
    let currentUrl = url;
    try {
        const headers: Record<string, string> = { "Accept": "application/json" };
        if (accessToken) {
            headers["Authorization"] = `Bearer ${accessToken}`;
        }

        while (currentUrl && results.length < maxItems) {
            console.log(`[FHIR FetchAll] Page: ${currentUrl}`);
            const res = await fetch(currentUrl, { headers, cache: 'no-store' });
            if (!res.ok) throw new Error(`Status ${res.status}`);
            const bundle = await res.json();
            if (bundle && bundle.entry) {
                results.push(...bundle.entry.map((e: any) => e.resource));
            }
            
            const nextLink = bundle.link?.find((l: any) => l.relation === "next");
            if (nextLink && nextLink.url) {
                currentUrl = nextLink.url;
            } else {
                break;
            }
        }
    } catch (e) {
        console.error("FHIR FetchAll Error:", e);
    }
    return results;
}

async function fetchByIds(baseUrl: string, resourceType: string, ids: string[], accessToken?: string | null) {
    if (!ids.length) return [];
    const uniqueIds = Array.from(new Set(ids));
    
    // 將 ID 列表拆分為每 50 個一組的 Chunk
    const chunks: string[][] = [];
    for (let i = 0; i < uniqueIds.length; i += 50) {
        chunks.push(uniqueIds.slice(i, i + 50));
    }

    // 使用 Promise.all 並行抓取所有 Chunk，大幅縮短執行時間
    const results = await Promise.all(chunks.map(async (chunk) => {
        const idsStr = chunk.join(",");
        const data = await fetchFhir(`${baseUrl}/${resourceType}?_id=${idsStr}&_count=50`, accessToken);
        return data?.entry?.map((e: any) => e.resource) || [];
    }));

    return results.flat();
}

function getValueByPath(obj: any, path: string) {
    if (!path) return undefined;
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
        if (current === undefined || current === null) return undefined;
        if (Array.isArray(current)) {
            current = current.map(c => c[part]).flat();
        } else {
            current = current[part];
        }
    }
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

    if (Array.isArray(actualValue)) {
        return actualValue.some(v => check(v));
    }
    return check(actualValue);
}

// Phase 1: Get list of indicators
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

// Phase 2: Check record count for an indicator
export async function getFhirRecordCount(indicatorName: string) {
    try {
        const supabase = await createClient();
        const { data: sysData } = await supabase.from("system").select("SysValue").eq("SysCode", "FHIR_SERVER").single();
        const activeFhirUrl = sysData?.SysValue || FHIR_SERVER_URL;
        
        const { data: kpi } = await supabase.from("kpi_definitions").select("*").eq("name", indicatorName).single();
        if (!kpi) throw new Error(`Indicator ${indicatorName} not found`);

        const { data: dls } = await supabase.from("kpi_dl").select("*").eq("kpiid", kpi.kpiid).eq("kpi_dl_type", 1).order('seq', { ascending: true });
        if (!dls || dls.length === 0) return { success: true, count: 0 };

        let baseResource = dls[0].kpi_id_fhir_resource;
        if (!baseResource) {
            if (indicatorName.includes("手術") || indicatorName.includes("抗生素")) baseResource = "Procedure";
            else if (indicatorName.includes("急診") || indicatorName.includes("住院")) baseResource = "Encounter";
            else return { success: true, count: 0 };
        }

        const START_DATE = getStartDate();
        let url = `${activeFhirUrl}/${baseResource}?_summary=count`;
        if (['Procedure', 'Encounter'].includes(baseResource)) {
            url += `&date=ge${START_DATE}`;
        }

        // We don't need backend auth for summary=count on most sandboxes, but let's be safe
        let accessToken = null;
        try { accessToken = await getBackendAccessToken(activeFhirUrl); } catch (e) {}

        const res = await fetchFhir(url, accessToken);
        return { success: true, count: res?.total || 0, resourceType: baseResource };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

// Phase 3: Sync a single indicator batch
export async function syncFhirIndicatorBatch(indicatorName: string, sessionId?: string) {
    const sid = sessionId || "manual-sync";
    try {
        const supabase = await createClient();
        const START_DATE = getStartDate();

        await addSyncLog(sid, `開始處理指標「${indicatorName}」`, "info", indicatorName);

        const { data: sysData } = await supabase.from("system").select("SysValue").eq("SysCode", "FHIR_SERVER").single();
        const activeFhirUrl = sysData?.SysValue || FHIR_SERVER_URL;

        const { data: kpi } = await supabase.from("kpi_definitions").select("*").eq("name", indicatorName).single();
        if (!kpi) throw new Error("指標定義不存在");

        await addSyncLog(sid, `正在讀取指標與動態欄位定義...`, "info", indicatorName);
        const [ { data: kpiDlls }, { data: ftInf } ] = await Promise.all([
            supabase.from("kpi_dl").select("*").eq("kpiid", kpi.kpiid).order('seq', { ascending: true }),
            supabase.from("kpi_ft_detail_inf").select("*").eq("kpi_id", kpi.kpiid).order('seq', { ascending: true })
        ]);
        
        await addSyncLog(sid, `清除舊有計算數據...`, "info", indicatorName);
        await supabase.from("kpi_detail").delete().eq("kpi_id", kpi.kpiid);
        await supabase.from("KPI").delete().eq("indicator_name", indicatorName);

        let accessToken = null;
        try { 
            accessToken = await getBackendAccessToken(activeFhirUrl); 
            if (accessToken) await addSyncLog(sid, "已取得後端存取權限令牌 (JWT)", "info", indicatorName);
        } catch (e) {}

        const denoms = kpiDlls?.filter(d => d.kpi_dl_type === 1) || [];
        const nums = kpiDlls?.filter(d => d.kpi_dl_type === 2) || [];
        if (denoms.length === 0) {
            await addSyncLog(sid, "無任何分母定義，跳過。", "warning", indicatorName);
            return { success: true, message: "無任何分母定義，跳過。" };
        }

        let baseResource = denoms[0].kpi_id_fhir_resource;
        if (!baseResource) {
            if (indicatorName.includes("手術") || indicatorName.includes("抗生素")) baseResource = "Procedure";
            else if (indicatorName.includes("急診") || indicatorName.includes("住院")) baseResource = "Encounter";
            else throw new Error("無法判斷基礎資源類型");
        }

        let url = `${activeFhirUrl}/${baseResource}?_count=500`;
        if (['Procedure', 'Encounter'].includes(baseResource)) {
            url += `&date=ge${START_DATE}`;
        }

        await addSyncLog(sid, `向 FHIR API 請求基礎資料 (${baseResource})...`, "info", indicatorName);
        let resources = await fetchFhirAll(url, 10000, accessToken); 
        if (!resources || resources.length === 0) {
            await addSyncLog(sid, "無符合指標時間範圍的 FHIR 資料。", "warning", indicatorName);
            return { success: true, message: "無符合資料。" };
        }
        await addSyncLog(sid, `取得 ${resources.length} 筆原始資料，開始處理關聯資訊...`, "info", indicatorName);

        const patIds = resources.map((r: any) => r.subject?.reference?.split('/').pop()).filter((id: string) => !!id);
        const encIds = resources.map((r: any) => r.encounter?.reference?.split('/').pop()).filter((id: string) => !!id);
        const pracIds = resources.map((r: any) => {
            if (r.performer?.[0]?.actor?.reference) return r.performer[0].actor.reference.split(/[:\/]/).pop();
            return null;
        }).filter((id: string) => !!id);

        await addSyncLog(sid, `正在抓取關聯資源 (Patient: ${patIds.length}, Encounter: ${encIds.length}, Practitioner: ${pracIds.length})...`, "info", indicatorName);
        const [patData, encData, pracData] = await Promise.all([
            fetchByIds(activeFhirUrl, "Patient", patIds, accessToken),
            fetchByIds(activeFhirUrl, "Encounter", encIds, accessToken),
            fetchByIds(activeFhirUrl, "Practitioner", pracIds, accessToken)
        ]);

        const patMap = new Map(patData.map((p: any) => [p.id, p]));
        const encMap = new Map(encData.map((e: any) => [e.id, e]));
        const pracMap = new Map(pracData.map((p: any) => [p.id, p]));

        await addSyncLog(sid, `關聯資料抓取完畢，開始套用指標公式計算...`, "info", indicatorName);

        let denominatorSet = resources.filter((res: any) => {
            for (const step of denoms) {
                if (step.source_type === 1) {
                    const condition = JSON.parse(step.kpi_dl_condition_value || '{}');
                    if (!evaluateCondition(res, condition)) return false;
                }
            }
            return true;
        });

        const allDetails: any[] = [];
        const allFtDetails: any[] = [];
        const allSummaryMap = new Map<string, any>();

        for (const res of denominatorSet) {
            const patId = res.subject?.reference?.split('/').pop();
            const encId = res.encounter?.reference?.split('/').pop();
            const patient: any = patMap.get(patId);
            const encounter: any = encMap.get(encId);
            if (!patient) continue;

            let isNumerator = false;
            let abnormalReason = null;
            const isMortality = indicatorName.includes("死亡率");
            const isAntibiotic = indicatorName.includes("抗生素");

            if (isMortality) {
                const opEndStr = res.performedPeriod?.end;
                if (opEndStr && patient.deceasedDateTime) {
                    const deathTime = new Date(patient.deceasedDateTime);
                    const opEnd = new Date(opEndStr);
                    const diffHours = (deathTime.getTime() - opEnd.getTime()) / (1000 * 60 * 60);
                    if (diffHours > 0 && diffHours <= 48) {
                        isNumerator = true;
                        abnormalReason = "術後48小時內死亡";
                    }
                }
                if (!isNumerator && encounter?.hospitalization?.dischargeDisposition?.coding) {
                    const dispCode = encounter.hospitalization.dischargeDisposition.coding[0]?.code;
                    if (['aadvice', 'exp'].includes(dispCode)) isNumerator = true;
                }
            } else if (isAntibiotic) {
                const hasGiven = res.note?.some((n: any) => n.text === "Antibiotic given: true");
                const hasNotGiven = res.note?.some((n: any) => n.text === "Antibiotic given: false");
                if (hasGiven) isNumerator = true;
                else if (hasNotGiven) {
                    isNumerator = false;
                    abnormalReason = "未在劃刀前1小時內給藥";
                } else {
                    nums.forEach(step => {
                        const condition = JSON.parse(step.kpi_dl_condition_value || '{}');
                        if (evaluateCondition(res, condition)) {
                            isNumerator = true;
                            abnormalReason = step.kpi_dl_notes || "符合分子條件";
                        }
                    });
                }
            } else {
                nums.forEach(step => {
                    const condition = JSON.parse(step.kpi_dl_condition_value || '{}');
                    if (evaluateCondition(res, condition)) {
                        isNumerator = true;
                        abnormalReason = step.kpi_dl_notes || "符合分子條件";
                    }
                });
            }

            // --- 動態欄位提取 (kpi_ft_detail) ---
            const ftData: Record<string, any> = {};
            if (ftInf && ftInf.length > 0) {
                for (const f of ftInf) {
                    const val = getValueByPath(res, f.fhir_source) || getValueByPath(patient, f.fhir_source) || getValueByPath(encounter, f.fhir_source);
                    if (val !== undefined && val !== null && f.column_slot) {
                        ftData[f.column_slot] = String(val);
                    }
                }
            }

            let deptName = "一般外科";
            if (encounter?.serviceProvider?.display) deptName = encounter.serviceProvider.display;
            else if (encounter?.serviceProvider?.reference) deptName = encounter.serviceProvider.reference.split('/').pop() || "一般外科";

            let doctorName = "王大明";
            let doctorId = "H85585021721";
            if (res.performer?.[0]?.actor?.reference) {
                const refId = res.performer[0].actor.reference.split(/[:\/]/).pop();
                doctorId = refId || doctorId;
                const prac = pracMap.get(refId);
                doctorName = prac?.name?.[0]?.text || refId || doctorName;
            }

            const reportDate = res.performedPeriod?.end || res.effectiveDateTime || new Date().toISOString();
            const isPositiveKPI = indicatorName.includes("給予比率") || indicatorName.includes("達成率");
            let status = isPositiveKPI ? (isNumerator ? "正常" : "異常") : (isNumerator ? "異常" : "正常");

            const detail = {
                kpi_id: kpi.kpiid,
                data_date: reportDate.split('T')[0],
                department: deptName,
                doctor_id: doctorId,
                doctor_name: doctorName,
                hospital_id: "市立聯合醫院",
                patient_id: patId,
                patient_gender: patient?.gender,
                patient_birth_date: patient?.birthDate,
                numerator_value: isNumerator ? 1 : 0,
                denominator_value: 1,
                kpi_value: isNumerator ? 1 : 0,
            };
            allDetails.push(detail);

            const key = `${deptName}|${doctorName}|${indicatorName}`;
            if (!allSummaryMap.has(key)) {
                allSummaryMap.set(key, {
                    department: deptName, doctor: doctorName, indicator_name: indicatorName,
                    indicator_def: kpi.formula, numerator: 0, denominator: 0, unit: "%",
                    hospital_name: "市立聯合醫院", doctor_id: doctorId
                });
            }
            const sum = allSummaryMap.get(key);
            sum.numerator += (isNumerator ? 1 : 0);
            sum.denominator += 1;

            allFtDetails.push(ftData); // Store linked ft data
        }

        if (allDetails.length > 0) {
            await addSyncLog(sid, `計算完成，正在寫入 ${allDetails.length} 筆明細資料 (批次處理)...`, "info", indicatorName);
            
            const kpiSummaryList = Array.from(allSummaryMap.values()).map(item => ({
                ...item,
                value: item.denominator > 0 ? parseFloat(((item.numerator / item.denominator) * 100).toFixed(2)) : 0
            }));
            await supabase.from("KPI").upsert(kpiSummaryList, { onConflict: "department, doctor, indicator_name" });
            
            // 批次寫入 kpi_detail & kpi_ft_detail (優化版本)
            const CHUNK_SIZE = 1000;
            for (let i = 0; i < allDetails.length; i += CHUNK_SIZE) {
                const batchDetails = allDetails.slice(i, i + CHUNK_SIZE);
                const batchFt = allFtDetails.slice(i, i + CHUNK_SIZE);

                // 批次寫入 kpi_detail 並取得生成的 IDs
                const { data: insertedRows, error: insErr } = await supabase
                    .from("kpi_detail")
                    .insert(batchDetails)
                    .select("id");

                if (insErr) {
                    await addSyncLog(sid, `寫入明細失敗: ${insErr.message}`, "error", indicatorName);
                    throw insErr;
                }

                // 準備動態欄位明細
                if (insertedRows && insertedRows.length > 0) {
                    const ftRows: any[] = [];
                    insertedRows.forEach((row: any, idx: number) => {
                        const ftData = batchFt[idx];
                        if (ftData && Object.keys(ftData).length > 0) {
                            const ftRow: any = { kpi_detail_id: row.id };
                            Object.entries(ftData).forEach(([k, v]) => {
                                if (k.startsWith('column')) ftRow[k] = v;
                            });
                            ftRows.push(ftRow);
                        }
                    });

                    if (ftRows.length > 0) {
                        const { error: ftErr } = await supabase.from("kpi_ft_detail").insert(ftRows);
                        if (ftErr) await addSyncLog(sid, `寫入動態欄位失敗: ${ftErr.message}`, "warning", indicatorName);
                    }
                }
            }
        }

        await addSyncLog(sid, `指標「${indicatorName}」同步完成，共 ${allDetails.length} 筆。`, "success", indicatorName);
        return { success: true, message: `已完成: ${allDetails.length} 筆資料` };
    } catch (e: any) {
        await addSyncLog(sid, `指標「${indicatorName}」發生錯誤: ${e.message}`, "error", indicatorName);
        return { success: false, message: e.message };
    }
}

// Legacy wrapper (optional, but keep for fallback)
export async function syncFhirData() {
    const { data: indicators } = await getSyncIndicators();
    if (!indicators) return { success: false, message: "無法取得指標內容" };
    
    // Clear only if needed, but per the updated logic, we now do it per indicator.
    // For legacy single call, we might want to clear all? 
    // Actually, user said skip global reset.
    
    for (const name of indicators) {
        await syncFhirIndicatorBatch(name);
    }
    return { success: true, message: "同步作業已全數完成 (批次處理)" };
}
