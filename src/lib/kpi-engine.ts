import { createClient } from "@/utils/supabase/server";

// Types
export interface KPIContext {
    kpiId: string;
    start: string; // YYYY-MM-DD
    end: string;
    hospitalId?: string;
    fhirBaseUrl: string;
}

interface KPIRule {
    type: number; // 1=Denom, 2=Num, 3=Excl
    seq: number;
    resource: string; // e.g. 'Patient'
    action: string; // 'BASE', 'AND', 'OR'
    path?: string; // FHIR path e.g. 'status'
    operator?: string; // '=', 'in'
    value?: string;
    parentStep?: number;
}

interface KPIFeatureDef {
    col: string; // column1
    source: string; // Patient.gender
}

// ----------------------------------------------------------------------
// 1. Helper: FHIR Operations
// ----------------------------------------------------------------------

async function fhirFetch(baseUrl: string, resourceType: string, params: URLSearchParams) {
    const url = `${baseUrl}/${resourceType}?${params.toString()}`;
    console.log(`[KPI Engine] Fetching: ${url}`);

    try {
        const res = await fetch(url, {
            headers: { 'Accept': 'application/fhir+json, application/json' },
            cache: 'no-store'
        });
        if (!res.ok) throw new Error(`FHIR ${res.status}: ${res.statusText}`);
        return await res.json();
    } catch (e) {
        console.error(`FHIR Fetch Error: ${e}`);
        return { entry: [] }; // Return empty bundle on fail to prevent crash
    }
}

// Helper to extract nested values (e.g. 'hospitalization.dischargeDisposition')
function extractValue(resource: any, path: string): string | null {
    if (!path || !resource) return null;
    const parts = path.split('.');
    let current = resource;

    for (const part of parts) {
        if (current === null || current === undefined) return null;
        // Handle array (take first) - naive implementation
        if (Array.isArray(current)) {
            current = current[0];
        }
        current = current[part];
    }

    // Primitive conversion
    if (typeof current === 'object') {
        // If it's a Coding/CodeableConcept, try to find code or text
        if (current.coding && current.coding[0]?.code) return current.coding[0].code;
        if (current.text) return current.text;
        return JSON.stringify(current); // Fallback
    }

    return current ? String(current) : null;
}

// ----------------------------------------------------------------------
// 2. Core Engine
// ----------------------------------------------------------------------

export async function calculateKPI(ctx: KPIContext) {
    const supabase = await createClient();
    const { kpiId, start, end, fhirBaseUrl } = ctx;

    console.log(`[KPI Engine] Starting calculation for ${kpiId} (${start} ~ ${end})`);

    // A. Fetch Definitions
    const { data: dlRows } = await supabase
        .from('kpi_dl')
        .select('*')
        .eq('kpiid', kpiId)
        .order('seq');

    const { data: ftRows } = await supabase
        .from('kpi_ft_detail_inf')
        .select('*')
        .eq('kpi_id', kpiId)
        .order('seq');

    if (!dlRows || dlRows.length === 0) {
        throw new Error("No KPI Rules found (kpi_dl empty)");
    }

    // Parse Rules
    const rules: KPIRule[] = dlRows.map((r: any) => {
        let condition: any = {};
        try { condition = JSON.parse(r.kpi_dl_condition_value); } catch (e) { }

        return {
            type: r.kpi_dl_type, // 1=Den, 2=Num, 3=Excl
            seq: r.seq,
            resource: r.kpi_id_fhir_resource || condition.resourceType || 'Patient',
            action: condition.action || 'BASE',
            path: condition.path,
            operator: condition.operator,
            value: condition.value
        };
    });

    const featureDefs: KPIFeatureDef[] = (ftRows || []).map((f: any) => ({
        col: f.column_slot,
        source: f.fhir_source
    }));

    // B. Execute Denominator (Type 1)
    console.log("[KPI Engine] Executing Denominator...");
    const denomResources = await executeRules(rules.filter(r => r.type === 1), fhirBaseUrl, start, end);
    console.log(`[KPI Engine] Denominator Count: ${denomResources.length}`);

    // C. Execute Numerator (Type 2)
    // For simpler KPIs, Numerator is often a subset of Denominator (e.g. "Of those patients, who died?")
    // But we need to check if the logic implies "AND" (Filtering Denom) or "BASE" (New Query).
    // Usually, Numerator Step 1 is "BASE" (e.g. Patient) which matches Denom Patient.
    // We will implementing a "Filter Denominator" strategy for efficiency if Step 1 matches Denom Resource.
    console.log("[KPI Engine] Executing Numerator...");
    const numRules = rules.filter(r => r.type === 2);

    // Naive Implementation:
    // If Numerator rules exist, we filter the Denominator list.
    // If we need to fetch NEW data (e.g. Observation), we do it per Denom item.
    let numResources: any[] = [];

    if (numRules.length > 0) {
        numResources = await filterValidResources(denomResources, numRules, fhirBaseUrl, start, end);
    }
    console.log(`[KPI Engine] Numerator Count: ${numResources.length}`);


    // D. Extract & Save Details
    // We iterate Denominator list (Total Cohort).
    // Mark if they are in Numerator.
    // Extract Features.

    const resultsToInsert: any[] = [];
    const featuresToInsert: any[] = []; // We need to insert parent first to get ID

    // We can't do bulk feature insert easily if we rely on DB generated IDs for details.
    // Strategy: Insert Detail -> Get ID -> Insert Feature.
    // Or generated UUIDs here.

    for (const res of denomResources) {
        const isNumerator = numResources.some(n => n.id === res.id); // Assuming ID match

        // Generate UUID
        const detailId = crypto.randomUUID();

        // Extract common fields
        const patientId = extractValue(res, 'subject.reference')?.replace('Patient/', '') || res.id; // Fallback

        resultsToInsert.push({
            id: detailId,
            kpi_id: kpiId,
            data_date: start, // Use period start or resource date
            patient_id: patientId,
            numerator_value: isNumerator ? 1 : 0,
            denominator_value: 1,
            kpi_value: isNumerator ? 1 : 0
        });

        // Extract Features
        const ftData: any = {
            id: crypto.randomUUID(),
            kpi_detail_id: detailId,
            // ft_detail_inf_id: ... assign via logic or skip? 
            // The table kpi_ft_detail columns are column1..20
        };

        featureDefs.forEach(def => {
            const val = extractFromSource(res, def.source);
            // Warning: If source is 'Procedure.code', but simple loop 'res' is Patient?
            // "Drill down" usually implies we kept the source resource (e.g. The Procedure).
            // Yes, denomResources should be the "Primary Resource" (e.g. Procedure, Encounter).
            if (val) ftData[def.col] = val;
        });

        featuresToInsert.push(ftData);
    }

    // E. Batch Insert
    // 1. Clear Old Data
    await supabase.from('kpi_detail').delete().eq('kpi_id', kpiId).eq('data_date', start); // Simple purge

    // 2. Insert Details
    if (resultsToInsert.length > 0) {
        const { error: err1 } = await supabase.from('kpi_detail').insert(resultsToInsert);
        if (err1) console.error("Error inserting details:", err1);

        // 3. Insert Features
        if (!err1 && featuresToInsert.length > 0) {
            const { error: err2 } = await supabase.from('kpi_ft_detail').insert(featuresToInsert);
            if (err2) console.error("Error inserting features:", err2);
        }
    }

    return {
        denominator: denomResources.length,
        numerator: numResources.length
    };
}


// ----------------------------------------------------------------------
// 3. Rule Execution Logic
// ----------------------------------------------------------------------

async function executeRules(rules: KPIRule[], baseUrl: string, start: string, end: string): Promise<any[]> {
    if (rules.length === 0) return [];

    let currentCohort: any[] = [];

    // Step 1: Base Query
    const baseRule = rules[0];
    if (baseRule.action === 'BASE' || rules.length === 1) {
        const params = new URLSearchParams();

        // Common Filters
        // If rule has path/value (e.g. status=completed), add it
        if (baseRule.path && baseRule.value) {
            // Need to map internal path 'status' to param 'status' (usually same)
            // But 'class' -> 'class', 'code' -> 'code'
            params.append(baseRule.path, baseRule.value.split(',')[0]); // Take first if CSV
        }

        // Date Filter (Heuristic)
        // If Resource is 'Procedure', 'Encounter', add date
        if (['Procedure', 'Encounter', 'Observation'].includes(baseRule.resource)) {
            params.append('date', `ge${start}`);
            params.append('date', `le${end}`);
        }

        params.append('_count', '100'); // Limit

        const bundle = await fhirFetch(baseUrl, baseRule.resource, params);
        currentCohort = bundle.entry?.map((e: any) => e.resource) || [];
    }

    // Step 2: Apply Filters (AND)
    for (let i = 1; i < rules.length; i++) {
        const rule = rules[i];
        if (rule.action === 'AND') {
            currentCohort = currentCohort.filter(res => checkCondition(res, rule));
        }
    }

    return currentCohort;
}

// Check if a resource matches a rule
function checkCondition(res: any, rule: KPIRule): boolean {
    if (rule.resource !== res.resourceType) return true; // Ignore if resource mismatch (or handle join?)

    // Simple property check
    // path: "status", value: "completed"
    if (rule.path) {
        const val = extractValue(res, rule.path);
        // Operator logic
        if (rule.operator === '=') return val === rule.value;
        if (rule.operator === 'in' && rule.value) {
            return rule.value.split(',').includes(val || '');
        }
    }
    return true;
}

// Special Filter for Numerator (Is Subset of Denom)
async function filterValidResources(cohort: any[], rules: KPIRule[], baseUrl: string, start: string, end: string) {
    const valid: any[] = [];

    // Cache for linked resources (e.g. Patients) to avoid re-fetching
    const resourceCache = new Map<string, any>();

    for (const item of cohort) {
        let isMatch = true;

        for (const rule of rules) {
            let target = item;

            // 1. Resolve Target Resource
            if (rule.resource !== item.resourceType) {
                // Try to resolve link
                if (rule.resource === 'Patient' && (item.resourceType === 'Procedure' || item.resourceType === 'Encounter' || item.resourceType === 'Observation')) {
                    const ref = item.subject?.reference || item.patient?.reference;
                    if (ref) {
                        const pid = ref.replace('Patient/', '');
                        if (resourceCache.has(pid)) {
                            target = resourceCache.get(pid);
                        } else {
                            // Fetch Patient
                            try {
                                // Simple GET /Patient/ID
                                const pRes = await fhirFetch(baseUrl, `Patient/${pid}`, new URLSearchParams());
                                target = pRes;
                                resourceCache.set(pid, pRes);
                            } catch (e) {
                                console.warn(`Failed to fetch linked Patient ${pid}`);
                                target = null;
                            }
                        }
                    }
                }
            }

            // 2. Check Condition
            if (!target || !checkCondition(target, rule)) {
                isMatch = false;
                break;
            }
        }

        if (isMatch) valid.push(item);
    }
    return valid;
}

// Helper for extracting specific string source for Columns
function extractFromSource(res: any, source: string) {
    if (!source) return null;
    const [resType, ...pathParts] = source.split('.');

    if (res.resourceType === resType) {
        return extractValue(res, pathParts.join('.'));
    }
    // If source asks for Patient.id but res is Procedure
    if (resType === 'Patient' && res.resourceType !== 'Patient') {
        // extract reference
        const ref = res.subject?.reference || res.patient?.reference;
        if (pathParts[0] === 'id') return ref?.replace('Patient/', '');
    }

    return null;
}
