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
        '手術後 48 小時內死亡率',
        '死亡人數',
        '手術人數', 
        '分母：
1. 住院 Encounter (class=IMP)
2. 手術 Procedure (category=surgical, code in VS)
3. 手術室 Location (type=OR/CATH/SECT)
4. 麻醉 Procedure (category=anesthesia)
5. ASA Observation (code=asa-physical-status)

排除：
1. 腦死接受器官摘除手術

分子 (已在分母中)：
1. 術後 48h 內死亡 (Patient.deceased=true)
2. 或 病危/AAD 出院 (dischargeDisposition=terminal/left-against-medical-advice)

歸戶：病歷號',
        'distcount', 
        'distcount', 
        '每月',
        'Surgery',
        10,
        '<=',
        now()
    );

    -- 2. Insert Denominator Steps (kpi_dl_type = 1)
    
    -- Step 1: Encounter (Inpatient)
    INSERT INTO public.kpi_dl (kpiid, kpi_dl_type, kpi_dl_name, kpi_id_fhir_resource, source_type, seq, kpi_dl_condition_value, kpi_dl_notes, kpi_dl_create_user) 
    VALUES (new_kpi_id, 1, '手術人數', 'Encounter', '1', 1, '{"path": "class", "operator": "matchesCode", "value": "IMP", "action": "BASE", "valueType": "fhir_filter"}', 'Step 1: 住院案件', 'system');

    -- Step 2: Main Surgery Procedure
    INSERT INTO public.kpi_dl (kpiid, kpi_dl_type, kpi_dl_name, kpi_id_fhir_resource, source_type, seq, kpi_dl_condition_value, kpi_dl_notes, kpi_dl_create_user) 
    VALUES (new_kpi_id, 1, '手術人數', 'Procedure', '1', 2, '{"path": "category", "operator": "matchesCode", "value": "surgical", "action": "AND", "valueType": "fhir_filter"}', 'Step 2: 手術處置 (surgical)', 'system');
    
    INSERT INTO public.kpi_dl (kpiid, kpi_dl_type, kpi_dl_name, kpi_id_fhir_resource, source_type, seq, kpi_dl_condition_value, kpi_dl_notes, kpi_dl_create_user) 
    VALUES (new_kpi_id, 1, '手術人數', 'Procedure', '1', 3, '{"path": "status", "operator": "equals", "value": "completed", "action": "AND", "valueType": "fhir_filter"}', 'Step 2: 已完成', 'system');
    
    INSERT INTO public.kpi_dl (kpiid, kpi_dl_type, kpi_dl_name, kpi_id_fhir_resource, source_type, seq, kpi_dl_condition_value, kpi_dl_notes, kpi_dl_create_user) 
    VALUES (new_kpi_id, 1, '手術人數', 'Procedure', '1', 4, '{"path": "code", "operator": "matchesCode", "value": "ICD-10-PCS,NHI", "action": "AND", "valueType": "fhir_filter"}', 'Step 2: 合格手術碼 (ICD/NHI)', 'system');

    -- Step 3: Location (Linked to Procedure via reference or location resource check)
    -- Using specific Location Resource check as intersection
    INSERT INTO public.kpi_dl (kpiid, kpi_dl_type, kpi_dl_name, kpi_id_fhir_resource, source_type, seq, kpi_dl_condition_value, kpi_dl_notes, kpi_dl_create_user) 
    VALUES (new_kpi_id, 1, '手術人數', 'Location', '1', 5, '{"path": "type", "operator": "matchesCode", "value": "OR,CATH,SECT", "action": "AND", "valueType": "fhir_filter"}', 'Step 3: 合格手術室 (OR/CATH)', 'system');

    -- Step 4: Anesthesia Procedure
    INSERT INTO public.kpi_dl (kpiid, kpi_dl_type, kpi_dl_name, kpi_id_fhir_resource, source_type, seq, kpi_dl_condition_value, kpi_dl_notes, kpi_dl_create_user) 
    VALUES (new_kpi_id, 1, '手術人數', 'Procedure', '1', 6, '{"path": "category", "operator": "matchesCode", "value": "anesthesia", "action": "AND", "valueType": "fhir_filter"}', 'Step 4: 麻醉處置 (anesthesia)', 'system');
    
    INSERT INTO public.kpi_dl (kpiid, kpi_dl_type, kpi_dl_name, kpi_id_fhir_resource, source_type, seq, kpi_dl_condition_value, kpi_dl_notes, kpi_dl_create_user) 
    VALUES (new_kpi_id, 1, '手術人數', 'Practitioner', '1', 7, '{"path": "role", "operator": "matchesCode", "value": "anesthesiologist", "action": "AND", "valueType": "fhir_filter"}', 'Step 6: 麻醉醫師 (role)', 'system');

    -- Step 5: ASA Observation
    INSERT INTO public.kpi_dl (kpiid, kpi_dl_type, kpi_dl_name, kpi_id_fhir_resource, source_type, seq, kpi_dl_condition_value, kpi_dl_notes, kpi_dl_create_user) 
    VALUES (new_kpi_id, 1, '手術人數', 'Observation', '1', 8, '{"path": "code", "operator": "matchesCode", "value": "11368-0", "action": "AND", "valueType": "fhir_filter"}', 'Step 5: ASA 評估 (11368-0)', 'system');

    -- 3. Numerator Steps (Death)
    INSERT INTO public.kpi_dl (kpiid, kpi_dl_type, kpi_dl_name, kpi_id_fhir_resource, source_type, seq, kpi_dl_condition_value, kpi_dl_notes, kpi_dl_create_user) 
    VALUES (new_kpi_id, 2, '死亡人數', 'Patient', '1', 1, '{"path": "deceasedDateTime", "operator": "exists", "value": "true", "action": "BASE", "valueType": "fhir_filter"}', 'Step 6: 術後死亡 (Patient.deceased)', 'system');

    INSERT INTO public.kpi_dl (kpiid, kpi_dl_type, kpi_dl_name, kpi_id_fhir_resource, source_type, seq, kpi_dl_condition_value, kpi_dl_notes, kpi_dl_create_user) 
    VALUES (new_kpi_id, 2, '死亡人數', 'Patient', '1', 2, '{"path": "deceasedDateTime", "operator": "timing-window", "value": "0-48h-after-surgery-end", "action": "AND", "valueType": "fhir_filter"}', 'Step 7: 48小時內', 'system');

    -- Alternative path: Encounter dischargeDisposition = exp (expired)
    INSERT INTO public.kpi_dl (kpiid, kpi_dl_type, kpi_dl_name, kpi_id_fhir_resource, source_type, seq, kpi_dl_condition_value, kpi_dl_notes, kpi_dl_create_user) 
    VALUES (new_kpi_id, 2, '死亡人數', 'Encounter', '1', 3, '{"path": "hospitalization.dischargeDisposition", "operator": "matchesCode", "value": "exp", "action": "OR", "valueType": "fhir_filter"}', 'Step 8: 院內死亡 (Encounter.discharge)', 'system');

    INSERT INTO public.kpi_dl (kpiid, kpi_dl_type, kpi_dl_name, kpi_id_fhir_resource, source_type, seq, kpi_dl_condition_value, kpi_dl_notes, kpi_dl_create_user) 
    VALUES (new_kpi_id, 2, '死亡人數', 'Encounter', '1', 4, '{"path": "hospitalization.dischargeDisposition", "operator": "matchesCode", "value": "terminal,left-against-medical-advice", "action": "OR", "valueType": "fhir_filter"}', 'Step 8: 自動出院/病危 (AAD)', 'system');

    -- 4. Exclusion Steps (kpi_dl_type = 3)
    -- Brain Death Organ Donation
    INSERT INTO public.kpi_dl (kpiid, kpi_dl_type, kpi_dl_name, kpi_id_fhir_resource, source_type, seq, kpi_dl_condition_value, kpi_dl_notes, kpi_dl_create_user) 
    VALUES (new_kpi_id, 3, 'Exclusion', 'Procedure', '1', 1, '{"path": "code", "operator": "matchesCode", "value": "Organ_Harvest_VS", "action": "EXCLUDE", "valueType": "fhir_filter"}', '排除腦死捐贈', 'system');


    -- 4. Feature Columns
    INSERT INTO public.kpi_ft_detail_inf (kpi_id, column_slot, display_name, fhir_source, seq) VALUES 
    (new_kpi_id, 'column1', '病歷號', 'subject.identifier.value', 1),
    (new_kpi_id, 'column2', '姓名', 'subject.name.text', 2),
    (new_kpi_id, 'column3', '科別', 'encounter.serviceType', 3),
    (new_kpi_id, 'column4', '手術名稱', 'code.text', 4),
    (new_kpi_id, 'column5', '手術時間 (T0)', 'performedDateTime', 5),
    (new_kpi_id, 'column6', '麻醉時間', 'performedPeriod.start', 6),
    (new_kpi_id, 'column7', '死亡/出院時間', 'subject.deceasedDateTime', 7);

END $$;
