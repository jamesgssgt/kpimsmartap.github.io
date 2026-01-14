'use server';

import { LocalMeasure, CalculationResult } from '@/types/measure';

// Helper to reliably interact with FHIR
async function fhirFetch(baseUrl: string, resource: string, params: Record<string, string | string[]>) {
    const url = new URL(`${baseUrl}/${resource}`);
    Object.entries(params).forEach(([k, v]) => {
        if (Array.isArray(v)) {
            v.forEach(val => val && url.searchParams.append(k, val));
        } else if (v) {
            url.searchParams.append(k, v);
        }
    });

    console.log(`[LocalCalc] Fetching: ${url.toString()}`);
    const res = await fetch(url.toString(), {
        headers: { 'Accept': 'application/fhir+json, application/json' },
        cache: 'no-store'
    });

    if (!res.ok) throw new Error(`FHIR Error ${res.status} on ${resource}`);
    return res.json();
}

export async function calculateMeasureLocal(
    measure: LocalMeasure,
    fhirUrl: string,
    periodStart: string,
    periodEnd: string
): Promise<CalculationResult> {
    const logs: string[] = [];
    const log = (msg: string) => logs.push(msg);

    const baseUrl = fhirUrl.trim().replace(/\/$/, '');

    try {
        log(`Starting Local Calculation for: ${measure.title}`);
        log(`Target Server: ${baseUrl}`);
        log(`Period: ${periodStart} to ${periodEnd}`);

        // --- Step 1: Evaluate Denominator ---
        // Strategy: Fetch all resources of the specified types in the time period
        // and extract unique Patients.
        const denominatorPatientIds = new Set<string>();

        for (const resourceType of measure.denominator.resourceTypes) {
            log(`Querying Denominator Candidate: ${resourceType}...`);
            // Note: 'date' is a common parameter, but some resources use 'effective' or 'period'.
            // For simplicity in this naive engine, we try 'date' first which covers many (Procedure, Encounter, Observation).
            // For MedicationAdministration, it is 'effective-time'.
            // We'll try a generic query. Ideally this needs a mapping.

            let queryParams: Record<string, string | string[]> = {};

            // Heuristic for date params
            if (['MedicationAdministration', 'MedicationRequest'].includes(resourceType)) {
                // These often use specific date params or might not support generic 'date' on all servers
                // Let's try to fetch without date filter if volume is low, OR assume 'date' works (standard R4 often supports it as composite)
                // Safest for standard resources is often just `_count=100` and client filter, but let's try server param.
            }
            // For now, simply assuming the server supports standard date search for the resource
            // We append standard date range
            queryParams['date'] = [`ge${periodStart}`, `le${periodEnd}`];
            queryParams['_count'] = '500'; // Limit to avoid blowing up

            try {
                const bundle = await fhirFetch(baseUrl, resourceType, queryParams);
                if (bundle.entry) {
                    log(`  Found ${bundle.entry.length} ${resourceType} records`);
                    bundle.entry.forEach((e: any) => {
                        const r = e.resource;
                        // Extract Patient Reference
                        // usually keys: 'subject', 'patient', 'beneficiary'
                        const ref = r.subject?.reference || r.patient?.reference || r.beneficiary?.reference;
                        if (ref) {
                            const pid = ref.replace('Patient/', '');
                            denominatorPatientIds.add(pid);
                        }
                    });
                } else {
                    log(`  No ${resourceType} found in period`);
                }
            } catch (e) {
                log(`  Error querying ${resourceType}: ${e}`);
            }
        }

        const denomList = Array.from(denominatorPatientIds);
        log(`Total Unique Denominator Patients: ${denomList.length}`);

        // --- Step 2: Evaluate Numerator ---
        // For each patient in Denominator, check if they match Numerator criteria
        const patientResults = [];
        let numeratorCount = 0;

        for (const pid of denomList) {
            let inNumerator = false;

            // Check each numerator resource type
            for (const numResType of measure.numerator.resourceTypes) {
                // Check if patient has this resource in period
                // e.g. GET /MedicationAdministration?patient=PID&date=...
                // TODO: Implement ValueSet / Criteria filtering here. 
                // Currently fetching ALL records of type.
                try {
                    const numQueryParams = {
                        'patient': pid,
                        'date': [`ge${periodStart}`, `le${periodEnd}`],
                        '_count': '1' // We just need existence
                    };

                    const bundle = await fhirFetch(baseUrl, numResType, numQueryParams);
                    if (bundle.total > 0 || (bundle.entry && bundle.entry.length > 0)) {
                        inNumerator = true;
                        break; // Found evidence, patient is in numerator
                    }
                } catch (e) {
                    // log(`Error checking numerator for ${pid}: ${e}`);
                }
            }

            if (inNumerator) numeratorCount++;

            patientResults.push({
                id: pid,
                inDenominator: true,
                inNumerator: inNumerator
            });
        }

        log(`Calculation Complete.`);
        log(`Numerator: ${numeratorCount} / Denominator: ${denomList.length}`);

        return {
            totalDenominator: denomList.length,
            totalNumerator: numeratorCount,
            score: denomList.length > 0 ? (numeratorCount / denomList.length) * 100 : 0,
            patients: patientResults,
            log: logs
        };

    } catch (error: any) {
        log(`CRITICAL ERROR: ${error.message}`);
        throw new Error(JSON.stringify(logs));
    }
}
