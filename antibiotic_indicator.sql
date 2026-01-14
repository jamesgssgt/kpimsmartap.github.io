-- Variable for the new KPI ID
DO $$
DECLARE
    new_kpi_id UUID := gen_random_uuid();
BEGIN

    -- 1. Insert into kpi_definitions
    INSERT INTO public.kpi_definitions (
        kpiid,
        name,
        numerator_name,
        denominator_name,
        formula,
        numerator_c,
        denominator_c,
        frequency,
        category,
        target_value,
        target_operator,
        created_at
    ) VALUES (
        new_kpi_id,
        '預防性抗生素在手術劃刀前1小時內給予比率',
        '給藥符合時效人數',
        '手術人數', 
        '分母：
1. 住院案件 (Encounter class=IMP)
2. 手術代碼 (Procedure code in 00.30-86.99)
3. 手術室執行 (Location type in OR, CATH, SECT)
4. 麻醉風險 (ASA) 必備 (11368-0)
5. 劃刀時間 (T_Inc)

排除 (共同排除)：
1. 剖腹產手術 (Code in C_Section_VS)
2. 特殊抗生素排除 (Vanco/Fluoro)
3. 術前治療抗生素 (已感染/治療性給藥: reason=treatment & time < T_Inc)

分子：
1. 給藥時間 (T_Admin): reason=prophylaxis
2. 給藥途徑驗證 (排除 PO, 除非 Colorectal Bowel Prep)
3. 時效判定: 0 < (T_Inc - T_Admin) <= 60 mins',
        'distcount', 
        'distcount', 
        '每月',
        'Surgery',
        100,
        '>=',
        now()
    );

    -- 2. Insert Denominator Steps (kpi_dl_type = 1)
    
    -- Step 1: Encounter (Inpatient)
    INSERT INTO public.kpi_dl (kpiid, kpi_dl_type, kpi_dl_name, kpi_id_fhir_resource, source_type, seq, kpi_dl_condition_value, kpi_dl_notes, kpi_dl_create_user) 
    VALUES (new_kpi_id, 1, '手術人數', 'Encounter', '1', 1, '{"path": "class", "operator": "matchesCode", "value": "IMP", "action": "BASE", "valueType": "fhir_filter"}', '分母: 住院案件', 'system');

    -- Step 2: Main Surgery Procedure (PCS)
    INSERT INTO public.kpi_dl (kpiid, kpi_dl_type, kpi_dl_name, kpi_id_fhir_resource, source_type, seq, kpi_dl_condition_value, kpi_dl_notes, kpi_dl_create_user) 
    VALUES (new_kpi_id, 1, '手術人數', 'Procedure', '1', 2, '{"path": "code", "operator": "matchesCode", "value": "PCS_Surgery_VS", "action": "AND", "valueType": "fhir_filter"}', '分母: 手術代碼 (00.30-86.99)', 'system');
    
    -- Step 3: Location (OR/CATH/SECT)
    INSERT INTO public.kpi_dl (kpiid, kpi_dl_type, kpi_dl_name, kpi_id_fhir_resource, source_type, seq, kpi_dl_condition_value, kpi_dl_notes, kpi_dl_create_user) 
    VALUES (new_kpi_id, 1, '手術人數', 'Location', '1', 3, '{"path": "type", "operator": "matchesCode", "value": "OR,CATH,SECT", "action": "AND", "valueType": "fhir_filter"}', '分母: 手術室執行', 'system');

    -- Step 4: ASA Observation
    INSERT INTO public.kpi_dl (kpiid, kpi_dl_type, kpi_dl_name, kpi_id_fhir_resource, source_type, seq, kpi_dl_condition_value, kpi_dl_notes, kpi_dl_create_user) 
    VALUES (new_kpi_id, 1, '手術人數', 'Observation', '1', 4, '{"path": "code", "operator": "matchesCode", "value": "11368-0", "action": "AND", "valueType": "fhir_filter"}', '分母: 麻醉風險 (ASA)', 'system');


    -- 3. Exclusion Steps (kpi_dl_type = 3)
    
    -- Excl 1: C-Section
    INSERT INTO public.kpi_dl (kpiid, kpi_dl_type, kpi_dl_name, kpi_id_fhir_resource, source_type, seq, kpi_dl_condition_value, kpi_dl_notes, kpi_dl_create_user) 
    VALUES (new_kpi_id, 3, 'Exclusion', 'Procedure', '1', 1, '{"path": "code", "operator": "matchesCode", "value": "C_Section_VS", "action": "EXCLUDE", "valueType": "fhir_filter"}', '排除: 剖腹產', 'system');

    -- Excl 2: Special Meds (Vanco/Fluoro)
    INSERT INTO public.kpi_dl (kpiid, kpi_dl_type, kpi_dl_name, kpi_id_fhir_resource, source_type, seq, kpi_dl_condition_value, kpi_dl_notes, kpi_dl_create_user) 
    VALUES (new_kpi_id, 3, 'Exclusion', 'Medication', '1', 2, '{"path": "code", "operator": "matchesCode", "value": "Vanco_Fluoro_VS", "action": "EXCLUDE", "valueType": "fhir_filter"}', '排除: 特殊抗生素', 'system');

    -- Excl 3: Pre-op Therapeutic Meds (Reason=treatment before T_Inc)
    INSERT INTO public.kpi_dl (kpiid, kpi_dl_type, kpi_dl_name, kpi_id_fhir_resource, source_type, seq, kpi_dl_condition_value, kpi_dl_notes, kpi_dl_create_user) 
    VALUES (new_kpi_id, 3, 'Exclusion', 'MedicationAdministration', '1', 3, '{"path": "reasonCode", "operator": "matchesCode", "value": "treatment", "action": "EXCLUDE-IF-BEFORE-INCISION", "valueType": "fhir_filter"}', '排除: 術前治療性給藥 (已感染)', 'system');

    -- 4. Numerator Steps (kpi_dl_type = 2)

    -- Num 1: Timing Check (0 < T_Inc - T_Admin <= 60) - Base Definition of Prophylactic
    INSERT INTO public.kpi_dl (kpiid, kpi_dl_type, kpi_dl_name, kpi_id_fhir_resource, source_type, seq, kpi_dl_condition_value, kpi_dl_notes, kpi_dl_create_user) 
    VALUES (new_kpi_id, 2, '給藥符合時效人數', 'MedicationAdministration', '1', 1, '{"path": "effectiveDateTime", "operator": "timing-window", "value": "0-60min-before-incision", "action": "BASE", "valueType": "fhir_filter"}', '分子: 術前60分鐘內給藥', 'system');

    -- Num 2: Status Check
    INSERT INTO public.kpi_dl (kpiid, kpi_dl_type, kpi_dl_name, kpi_id_fhir_resource, source_type, seq, kpi_dl_condition_value, kpi_dl_notes, kpi_dl_create_user) 
    VALUES (new_kpi_id, 2, '給藥符合時效人數', 'MedicationAdministration', '1', 2, '{"path": "status", "operator": "matchesCode", "value": "completed,in-progress", "action": "AND", "valueType": "fhir_filter"}', '分子: 給藥狀態確認', 'system');

    -- Num 3: Route Check (Exclude PO unless Bowel Prep)
    INSERT INTO public.kpi_dl (kpiid, kpi_dl_type, kpi_dl_name, kpi_id_fhir_resource, source_type, seq, kpi_dl_condition_value, kpi_dl_notes, kpi_dl_create_user) 
    VALUES (new_kpi_id, 2, '給藥符合時效人數', 'MedicationAdministration', '1', 3, '{"path": "dosage.route", "operator": "notMatchesCode", "value": "PO", "action": "AND", "valueType": "fhir_filter"}', '分子: 給藥途徑驗證 (非口服)', 'system');

    -- 5. Feature Columns
    INSERT INTO public.kpi_ft_detail_inf (kpi_id, column_slot, display_name, fhir_source, seq) VALUES 
    (new_kpi_id, 'column1', '病歷號', 'subject.identifier.value', 1),
    (new_kpi_id, 'column2', '姓名', 'subject.name.text', 2),
    (new_kpi_id, 'column3', '科別', 'encounter.serviceType', 3),
    (new_kpi_id, 'column4', '醫師', 'procedure.performer.actor.name', 4),
    (new_kpi_id, 'column5', '手術時間 (T_Inc)', 'Procedure.performedPeriod.start', 5),
    (new_kpi_id, 'column6', '給藥時間 (T_Admin)', 'MedicationAdministration.effectiveDateTime', 6),
    (new_kpi_id, 'column7', '抗生素', 'MedicationAdministration.medicationCodeableConcept.text', 7);

END $$;
