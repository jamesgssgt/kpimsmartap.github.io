export interface KPIItem {
    id: string;
    department: string;
    doctor: string;
    indicator_name: string;
    indicator_def: string;
    value: number;
    numerator: number;
    denominator: number;
    unit: string;
}

export interface KPIDetail {
    id: string;
    department: string;
    doctor: string;
    indicator_name: string;
    value: number;
    numerator: number;
    denominator: number;
    unit: string;
    status: string;
    patient_id: string;
    report_date: string;
    admission_date?: string;
    discharge_date?: string;
    abnormal_reason?: string;
    patient_gender?: string;
    patient_birthday?: string;
    patient_age?: number;
}
