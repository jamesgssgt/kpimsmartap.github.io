
export type FhirResource = 'Patient' | 'Observation' | 'Condition' | 'Procedure' | 'Encounter' | 'MedicationRequest' | 'Location' | 'Practitioner' | 'Composition' | 'DiagnosticReport' | 'Organization' | 'Medication' | 'MedicationAdministration';

export type CalculationAction =
    | 'BASE'      // 初始集合/數值
    | 'AND'       // 集合交集 (且)
    | 'OR'        // 集合聯集 (或)
    | 'NOT'       // 集合排除 (非)
    | 'ADD'       // 數值相加 (+)
    | 'SUBTRACT'  // 數值相減 (-)
    | 'MULTIPLY'  // 數值相乘 (*)
    | 'DIVIDE';   // 數值相除 (/)

export type ValueType = 'fhir_filter' | 'indicator_result' | 'constant' | 'factor';

export interface CalculationStep {
    id: string;
    action: CalculationAction;
    valueType: ValueType;
    // 當 valueType 為 fhir_filter 時使用
    resourceType?: FhirResource;
    path?: string;
    operator?: 'equals' | 'contains' | 'greaterThan' | 'lessThan' | 'exists' | 'matchesCode' | 'timing-window';
    // 共通比對值 / 指標ID / 常數
    value: string;
    notes?: string;
}

export interface QualityIndicator {
    id: string;
    name: string;
    description: string;
    numeratorName: string;       // 分子名稱
    denominatorName: string;     // 分母名稱
    numeratorSteps: CalculationStep[];   // 分子運算步驟
    denominatorSteps: CalculationStep[]; // 分母運算步驟
    exclusionSteps: CalculationStep[];   // 排除運算步驟
    numeratorCalculationMethod?: 'sum' | 'count' | 'distcount';
    denominatorCalculationMethod?: 'sum' | 'count' | 'distcount';
    frequency: '每日' | '每週' | '每月' | '每季' | '每半年' | '每年';
    targetValue?: number;
    targetOperator?: '>=' | '<=' | '>' | '<' | '=';
    isPinned?: boolean;
    featureColumns?: {
        slot: string;
        displayName: string;
        fhirSource: string;
        seq: number;
    }[];
}

export interface IndicatorResult {
    indicatorId: string;
    timestamp: string;
    numeratorCount: number;
    denominatorCount: number;
    rate: number;
}

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    thinking?: string;
}

export interface FhirServerConfig {
    baseUrl: string;
    authType: 'none' | 'apiKey' | 'basic' | 'oauth2';
    apiKey?: string;
    username?: string;
    password?: string;
    tokenUrl?: string;
    clientId?: string;
    clientSecret?: string;
    workspaceName: string;
}

export interface Factor {
    id: string;
    name: string;
    description: string;
    method: 'sum' | 'count' | 'distcount';
    sourceType: 'FHIR' | 'Manual';
    steps: CalculationStep[];
    updatedAt?: string;
    usageCount?: number;
    usedBy?: { id: string; name: string }[];
}

export type FactorStep = CalculationStep;
