
import { QualityIndicator, IndicatorResult } from "@/components/indicator/types";

// Mock data generation for demo purposes
export const fetchFhirValues = async (resourceType: string, path: string, search?: string): Promise<string[]> => {
    // In a real app, this would hit a FHIR endpoint (e.g., /Observation?_summary=count&_group=code)
    await new Promise(resolve => setTimeout(resolve, 600)); // Simulate latency

    const MOCK_VALUES: Record<string, Record<string, string[]>> = {
        'Observation': {
            'code.coding.code': ['8867-4', '8302-2', '8480-6', '8462-4', '29463-7'],
            'status': ['final', 'preliminary', 'amended', 'corrected', 'cancelled'],
            'category.coding.code': ['laboratory', 'vital-signs', 'imaging', 'exam']
        },
        'Condition': {
            'code.coding.code': ['E11.9', 'I10', 'E11.65', 'N18.9', 'J44.9'],
            'clinicalStatus.coding.code': ['active', 'relapse', 'remission', 'resolved'],
            'verificationStatus.coding.code': ['confirmed', 'provisional', 'differential']
        },
        'Patient': {
            'gender': ['male', 'female', 'other', 'unknown'],
            'deceasedBoolean': ['true', 'false']
        },
        'Encounter': {
            'class.code': ['AMB', 'IMP', 'EMER', 'VR', 'HH'],
            'status': ['planned', 'arrived', 'triaged', 'in-progress', 'onleave', 'finished', 'cancelled']
        },
        'Procedure': {
            'status': ['preparation', 'in-progress', 'not-done', 'on-hold', 'stopped', 'completed', 'entered-in-error', 'unknown']
        },
        'MedicationRequest': {
            'status': ['active', 'on-hold', 'cancelled', 'completed', 'entered-in-error', 'stopped', 'draft', 'unknown']
        }
    };

    const resourceValues = MOCK_VALUES[resourceType] || {};
    // Fuzzy match the path if exact match not found (simplify for demo)
    const exactMatch = resourceValues[path];

    let result = ['Example Value 1', 'Example Value 2', 'Example Value 3'];

    if (exactMatch) result = exactMatch;
    else if (path.includes('status')) result = ['active', 'completed', 'cancelled', 'entered-in-error'];
    else if (path.includes('gender')) result = ['male', 'female', 'other', 'unknown'];
    else if (path.includes('code')) result = ['CODE-001', 'CODE-002', 'CODE-003'];

    // Apply search filter if present
    if (search && search.trim()) {
        const lowerSearch = search.toLowerCase();
        result = result.filter(v => v.toLowerCase().includes(lowerSearch));
    }

    return result;
};

export const fetchIndicatorResults = async (indicator: QualityIndicator): Promise<IndicatorResult[]> => {
    // In a real app, this would hit a FHIR endpoint (e.g., /Observation, /Patient)
    // and apply filters based on the indicator's numerator/denominator criteria.

    await new Promise(resolve => setTimeout(resolve, 800)); // Simulate network latency

    const results: IndicatorResult[] = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(now.getMonth() - i);

        // Random but plausible data
        const den = 100 + Math.floor(Math.random() * 200);
        const num = Math.floor(den * (0.6 + Math.random() * 0.3));

        results.push({
            indicatorId: indicator.id,
            timestamp: date.toLocaleString('default', { month: 'short', year: 'numeric' }),
            denominatorCount: den,
            numeratorCount: num,
            rate: parseFloat(((num / den) * 100).toFixed(2)),
        });
    }

    return results;
};
