export interface LocalMeasure {
    id: string;
    title: string;
    version?: string;
    status: 'active' | 'draft';
    denominator: {
        resourceTypes: string[]; // e.g. ['Procedure', 'Encounter']
    };
    numerator: {
        resourceTypes: string[]; // e.g. ['MedicationAdministration']
    };
}

export interface CalculationResult {
    totalDenominator: number;
    totalNumerator: number;
    score: number; // percentage
    patients: {
        id: string;
        inDenominator: boolean;
        inNumerator: boolean;
        details?: any;
    }[];
    log: string[];
}
