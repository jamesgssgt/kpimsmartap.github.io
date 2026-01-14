
export type FhirResource = 'Patient' | 'Observation' | 'Condition' | 'Procedure' | 'Encounter' | 'MedicationRequest';

export type CalculationAction = 
  | 'BASE'      // 初始集合/數值
  | 'AND'       // 集合交集 (且)
  | 'OR'        // 集合聯集 (或)
  | 'NOT'       // 集合排除 (非)
  | 'ADD'       // 數值相加 (+)
  | 'SUBTRACT'  // 數值相減 (-)
  | 'MULTIPLY'  // 數值相乘 (*)
  | 'DIVIDE';   // 數值相除 (/)

export type ValueType = 'fhir_filter' | 'indicator_result' | 'constant';

export interface CalculationStep {
  id: string;
  action: CalculationAction;
  valueType: ValueType;
  // 當 valueType 為 fhir_filter 時使用
  resourceType?: FhirResource;
  path?: string;
  operator?: 'equals' | 'contains' | 'greaterThan' | 'lessThan' | 'exists' | 'matchesCode';
  // 共通比對值 / 指標ID / 常數
  value: string; 
  notes?: string; 
}

export interface QualityIndicator {
  id: string;
  name: string;
  description: string;
  numeratorSteps: CalculationStep[];   // 分子運算步驟
  denominatorSteps: CalculationStep[]; // 分母運算步驟
  exclusionSteps: CalculationStep[];   // 排除運算步驟
  frequency: '每日' | '每週' | '每月' | '每季';
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
