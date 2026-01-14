import { FhirResource } from '@/components/indicator/types';
import {
    Database, Activity, Zap, Settings2, Layers, Sparkles, MessageSquare, Users
} from 'lucide-react';

export const RESOURCE_CONFIG: Record<FhirResource, { color: string; icon: any; label: string; paths: { value: string; label: string }[] }> = {
    Patient: {
        color: 'bg-emerald-500', icon: Database, label: '病人資料 (Patient)',
        paths: [
            { value: 'identifier.value', label: '病歷號 (Medical Record Number - MR)' },
            { value: 'identifier.nId', label: '身分證字號 (National Person Identifier - NNxxx)' },
            { value: 'name.text', label: '姓名 (name.text)' },
            { value: 'gender', label: '性別 (gender)' },
            { value: 'birthDate', label: '出生日期 (birthDate)' },
            { value: 'deceasedBoolean', label: '死亡狀態 (deceasedBoolean)' },
            { value: 'deceasedDateTime', label: '死亡時間 (deceasedDateTime)' },
            { value: 'telecom', label: '聯絡電話 (telecom)' },
            { value: 'address', label: '地址 (address)' },
            { value: 'maritalStatus', label: '婚姻狀況 (maritalStatus)' }
        ]
    },
    Observation: {
        color: 'bg-blue-500', icon: Activity, label: '檢驗檢查 (Observation)',
        paths: [
            { value: 'code', label: '檢驗項目 (code)' },
            { value: 'code.text', label: '檢驗項目名稱 (code.text)' },
            { value: 'valueQuantity.value', label: '檢驗數值結果 (valueQuantity.value)' },
            { value: 'valueString', label: '檢驗文字結果 (valueString)' },
            { value: 'valueCodeableConcept', label: '檢驗代碼結果 (valueCodeableConcept)' },
            { value: 'valueCodeableConcept.text', label: '檢驗代碼結果名稱 (valueCodeableConcept.text)' },
            { value: 'status', label: '報告狀態 (status)' },
            { value: 'effectiveDateTime', label: '執行時間 (effectiveDateTime)' },
            { value: 'issued', label: '報告發布時間 (issued)' },
            { value: 'interpretation', label: '結果判讀 H/L (interpretation)' },
            { value: 'referenceRange', label: '參考值範圍 (referenceRange)' },
            { value: 'bodySite', label: '檢驗部位 (bodySite)' }
        ]
    },
    Condition: {
        color: 'bg-amber-500', icon: Zap, label: '診斷疾病 (Condition)',
        paths: [
            { value: 'code', label: '診斷代碼 (code)' },
            { value: 'code.text', label: '診斷名稱 (code.text)' },
            { value: 'clinicalStatus.coding.code', label: '臨床狀態 (clinicalStatus)' },
            { value: 'verificationStatus', label: '確診狀態 (verificationStatus)' },
            { value: 'category', label: '診斷類別 (category)' },
            { value: 'severity', label: '嚴重程度 (severity)' },
            { value: 'onsetDateTime', label: '發病時間 (onsetDateTime)' },
            { value: 'abatementDateTime', label: '疾病緩解時間 (abatementDateTime)' }
        ]
    },
    Procedure: {
        color: 'bg-indigo-500', icon: Settings2, label: '醫療處置 (Procedure)',
        paths: [
            { value: 'category', label: '處置類別 (category)' },
            { value: 'code', label: '處置代碼 (code)' },
            { value: 'code.text', label: '手術/處置名稱 (code.text)' },
            { value: 'status', label: '執行狀態 (status)' },
            { value: 'performedDateTime', label: '執行時間 (performedDateTime)' },
            { value: 'performedPeriod.start', label: '執行開始時間 (performedPeriod.start)' },
            { value: 'performedPeriod.end', label: '執行結束時間 (performedPeriod.end)' },
            { value: 'location', label: '執行地點 (location)' },
            { value: 'performer.actor', label: '執行人員 (performer.actor)' },
            { value: 'performer.role', label: '執行人員角色 (performer.role)' },
            { value: 'bodySite', label: '處置部位 (bodySite)' },
            { value: 'outcome', label: '處置結果 (outcome)' },
            { value: 'outcome.text', label: '處置結果描述 (outcome.text)' },
            { value: 'followUp', label: '追蹤說明 (followUp)' },
            { value: 'subject.deceasedBoolean', label: '病人死亡狀態 (subject.deceasedBoolean)' },
            { value: 'subject.deceasedDateTime', label: '病人死亡時間 (subject.deceasedDateTime)' }
        ]
    },
    Composition: {
        color: 'bg-slate-500', icon: Layers, label: '臨床文件/手術報告 (Composition)',
        paths: [
            { value: 'type.coding.code', label: '文件類型代碼 (type.coding.code)' },
            { value: 'category.coding.code', label: '文件分類代碼 (category.coding.code)' },
            { value: 'title', label: '標題 (title)' },
            { value: 'date', label: '報告日期/編輯時間 (date)' },
            { value: 'status', label: '文件狀態 (status)' },
            { value: 'event.code.coding.code', label: '事件代碼 (event.code)' },
            { value: 'event.period.start', label: '事件開始時間 (event.period.start)' },
            { value: 'event.period.end', label: '事件結束時間 (event.period.end)' }
        ]
    },
    DiagnosticReport: {
        color: 'bg-indigo-400', icon: Activity, label: '診斷報告 (DiagnosticReport)',
        paths: [
            { value: 'code', label: '報告名稱代碼 (code)' },
            { value: 'code.text', label: '報告名稱 (code.text)' },
            { value: 'status', label: '報告狀態 (status)' },
            { value: 'issued', label: '報告發布時間 (issued)' },
            { value: 'conclusion', label: '報告結論 (conclusion)' },
            { value: 'result', label: '檢驗檢查結果 (result)' }
        ]
    },
    Organization: {
        color: 'bg-slate-600', icon: Database, label: '機構/部門 (Organization)',
        paths: [
            { value: 'identifier', label: '機構代碼/統一編號 (identifier)' },
            { value: 'name', label: '機構名稱 (name)' },
            { value: 'type', label: '機構類型 (type)' }
        ]
    },
    Encounter: {
        color: 'bg-rose-500', icon: MessageSquare, label: '就醫事件 (Encounter)',
        paths: [
            { value: 'class', label: '就醫類別 (class)' },
            { value: 'class.code', label: '就醫類別代碼 (class.code)' },
            { value: 'status', label: '就醫狀態 (status)' },
            { value: 'type', label: '就醫科別/類型 (type)' },
            { value: 'serviceType', label: '服務類型 (serviceType)' },
            { value: 'period.start', label: '入院/就醫開始時間 (period.start)' },
            { value: 'period.end', label: '出院/就醫結束時間 (period.end)' },
            { value: 'reasonCode', label: '就醫原因 (reasonCode)' },
            { value: 'hospitalization.dischargeDisposition', label: '出院動向 (dischargeDisposition)' }
        ]
    },
    MedicationRequest: {
        color: 'bg-purple-500', icon: Sparkles, label: '用藥處方 (MedicationRequest)',
        paths: [
            { value: 'medicationCodeableConcept.text', label: '處方藥品名稱 (medicationCodeableConcept.text)' },
            { value: 'status', label: '處方狀態 (status)' },
            { value: 'intent', label: '處方意圖 (intent)' },
            { value: 'priority', label: '處方優先級 (priority)' },
            { value: 'authoredOn', label: '開立時間 (authoredOn)' },
            { value: 'dosageInstruction.text', label: '用藥指示 (dosageInstruction)' }
        ]
    },
    Location: {
        color: 'bg-orange-500', icon: Database, label: '地點 (Location)',
        paths: [
            { value: 'type', label: '地點類型 (type)' },
            { value: 'name', label: '地點名稱 (name)' },
            { value: 'status', label: '地點狀態 (status)' },
            { value: 'physicalType', label: '實體類型: 建築/樓層/房間 (physicalType)' }
        ]
    },
    Practitioner: {
        color: 'bg-teal-500', icon: Users, label: '醫護人員 (Practitioner)',
        paths: [
            { value: 'identifier', label: '員工代號/醫師代號 (identifier)' },
            { value: 'role', label: '角色 (role)' },
            { value: 'qualification', label: '資格/職類 (qualification)' },
            { value: 'name.text', label: '姓名 (name)' },
            { value: 'gender', label: '性別 (gender)' },
            { value: 'active', label: '在職狀態 (active)' }
        ]
    },
    Medication: {
        color: 'bg-pink-500', icon: Sparkles, label: '藥物 (Medication)',
        paths: [
            { value: 'code', label: '藥物代碼 (code)' },
            { value: 'code.text', label: '藥物名稱 (code.text)' },
            { value: 'status', label: '狀態 (status)' },
            { value: 'form', label: '劑型 (form)' },
            { value: 'ingredient', label: '成分 (ingredient)' }
        ]
    },
    MedicationAdministration: {
        color: 'bg-fuchsia-500', icon: Sparkles, label: '給藥紀錄 (MedicationAdministration)',
        paths: [
            { value: 'status', label: '給藥狀態 (status)' },
            { value: 'medicationCodeableConcept', label: '藥物代碼 (medicationCodeableConcept)' },
            { value: 'medicationCodeableConcept.text', label: '藥物名稱 (text)' },
            { value: 'reasonCode', label: '給藥原因 (reasonCode)' },
            { value: 'effectiveDateTime', label: '給藥時間 (effectiveDateTime)' },
            { value: 'dosage.route', label: '給藥途徑 (dosage.route)' },
            { value: 'subject', label: '病人 (subject)' },
            { value: 'context', label: '就醫事件 (context)' }
        ]
    },
};

import { C_SECTION_EXCLUSION_VS } from './valuesets';

// Predefined values for specific resource paths (e.g. ValueSets)
export const PREDEFINED_VALUES: Record<string, { value: string; label: string; description?: string }[]> = {
    'Procedure.code': [
        {
            value: 'C_Section_Exclusion_VS',
            label: 'C_Section_Exclusion_VS',
            description: `剖腹產排除值集 (${C_SECTION_EXCLUSION_VS.length} codes)`
        },
        {
            value: 'PCS_Surgery_VS',
            label: 'PCS_Surgery_VS',
            description: '手術代碼值集 (00.30-86.99)'
        }
    ],
    'Procedure.status': [
        { value: 'completed', label: 'completed', description: '已完成' },
        { value: 'in-progress', label: 'in-progress', description: '進行中' },
        { value: 'preparation', label: 'preparation', description: '準備中' },
        { value: 'not-done', label: 'not-done', description: '未執行' }
    ],
    'Encounter.status': [
        { value: 'finished', label: 'finished', description: '已結束' },
        { value: 'in-progress', label: 'in-progress', description: '進行中' },
        { value: 'planned', label: 'planned', description: '已計畫' }
    ],
    'Observation.status': [
        { value: 'final', label: 'final', description: '最終報告' },
        { value: 'preliminary', label: 'preliminary', description: '初步報告' }
    ],
    'MedicationAdministration.status': [
        { value: 'completed', label: 'completed', description: '已給藥' },
        { value: 'in-progress', label: 'in-progress', description: '給藥中' },
        { value: 'on-hold', label: 'on-hold', description: '暫停' },
        { value: 'stopped', label: 'stopped', description: '已停止' }
    ],
    'MedicationAdministration.dosage.route': [
        { value: 'PO', label: 'PO', description: '口服 (Per Os)' },
        { value: 'IV', label: 'IV', description: '靜脈注射 (Intravenous)' },
        { value: 'IM', label: 'IM', description: '肌肉注射 (Intramuscular)' },
        { value: 'SC', label: 'SC', description: '皮下注射 (Subcutaneous)' },
        { value: 'TOP', label: 'TOP', description: '局部塗抹 (Topical)' }
    ],
    'Encounter.hospitalization.dischargeDisposition': [
        { value: 'home', label: 'home', description: '一般出院 (Home)' },
        { value: 'left-against-medical-advice', label: 'left-against-medical-advice', description: '自動出院 (AAD)' },
        { value: 'terminal', label: 'terminal', description: '病危自動出院/臨終返家' },
        { value: 'exp', label: 'exp', description: '死亡 (Expired)' },
        { value: 'hosp-trans', label: 'hosp-trans', description: '轉院 (Transfer)' }
    ],
    'Location.type': [
        { value: 'OR', label: 'OR', description: '手術室 (Operating Room)' },
        { value: 'CATH', label: 'CATH', description: '心導管室 (Catheterization Lab)' },
        { value: 'SECT', label: 'SECT', description: '科別/部門 (Section)' },
        { value: 'WARD', label: 'WARD', description: '病房 (Ward)' },
        { value: 'ICU', label: 'ICU', description: '加護病房 (Intensive Care Unit)' },
        { value: 'ER', label: 'ER', description: '急診 (Emergency Room)' }
    ],
    'Practitioner.role': [
        { value: 'Doctor', label: 'Doctor', description: '醫師' },
        { value: 'Nurse', label: 'Nurse', description: '護理師' },
        { value: 'Pharmacist', label: 'Pharmacist', description: '藥師' },
        { value: 'Anesthesiologist', label: 'Anesthesiologist', description: '麻醉醫師' },
        { value: 'Midwife', label: 'Midwife', description: '助產師' }
    ],
    'Procedure.performer.role': [
        { value: 'Primary Surgeon', label: 'Primary Surgeon', description: '主刀醫師' },
        { value: 'Assistant Surgeon', label: 'Assistant Surgeon', description: '助手醫師' },
        { value: 'Anesthesiologist', label: 'Anesthesiologist', description: '麻醉醫師' },
        { value: 'Scrub Nurse', label: 'Scrub Nurse', description: '刷手護理師' },
        { value: 'Circulating Nurse', label: 'Circulating Nurse', description: '流動護理師' }
    ],
    'Procedure.category': [
        { value: '1036-9', label: 'Surgical procedure', description: '外科手術 (Surgical procedure)' },
        { value: '387713003', label: 'Surgical procedure', description: '外科手術 (SNOMED)' },
        { value: '18659-1', label: 'Anesthesia', description: '麻醉 (Anesthesia)' },
        { value: 'anesthesia', label: 'anesthesia', description: '麻醉 (Simple)' }
    ],
    'Procedure.location': [
        { value: 'OR', label: 'OR', description: '手術室 (Operating Room)' },
        { value: 'CATH', label: 'CATH', description: '心導管室 (Catheterization Lab)' },
        { value: 'SECT', label: 'SECT', description: '科別/部門 (Section)' },
        { value: 'WARD', label: 'WARD', description: '病房 (Ward)' },
        { value: 'ICU', label: 'ICU', description: '加護病房 (Intensive Care Unit)' },
        { value: 'ER', label: 'ER', description: '急診 (Emergency Room)' }
    ]
};

