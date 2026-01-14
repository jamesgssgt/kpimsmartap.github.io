-- Fix logic for '手術後 48 小時內死亡率' based on MOHW definition
-- Denominator: Inpatient Surgeries (Anesthesia T0)
-- Numerator: Death within 48h OR Critical AAD

DO $$
DECLARE
    v_kpi_id uuid;
    v_num_name text := '術後48小時內死亡人次(含病危自動出院)';
    v_den_name text := '手術人次';
BEGIN
    -- 1. Find or Insert the KPI Definition
    SELECT kpiid INTO v_kpi_id FROM kpi_definitions WHERE name = '手術後 48 小時內死亡率' LIMIT 1;

    IF v_kpi_id IS NULL THEN
        INSERT INTO kpi_definitions (name, definition_text, numerator_name, denominator_name, target_value, target_operator, range_lower, range_higher, numerator_c, denominator_c)
        VALUES (
            '手術後 48 小時內死亡率',
            '監測住院手術病患在術後48小時內的死亡情況（含病危自動出院），以評估手術與麻醉安全性。T0=麻醉開始時間。',
            v_num_name,
            v_den_name,
            1.5,
            '<',
            NULL,
            NULL,
            'distcount',
            'distcount'
        ) RETURNING kpiid INTO v_kpi_id;
    ELSE
        UPDATE kpi_definitions
        SET definition_text = '監測住院手術病患在術後48小時內的死亡情況（含病危自動出院），以評估手術與麻醉安全性。T0=麻醉開始時間。',
            numerator_name = v_num_name,
            denominator_name = v_den_name,
            target_value = 1.5,
            target_operator = '<',
            range_lower = NULL,
            range_higher = NULL,
            numerator_c = 'distcount',
            denominator_c = 'distcount'
        WHERE kpiid = v_kpi_id;
    END IF;

    -- 2. Clear existing DL steps
    DELETE FROM kpi_dl WHERE kpiid = v_kpi_id;

    -- 3. Insert DENOMINATOR Steps (kpi_dl_type = 1)
    
    -- Step 1: Patient ID (Primary Key)
    INSERT INTO kpi_dl (kpiid, kpi_dl_type, seq, kpi_dl_condition_value, kpi_id_fhir_resource)
    VALUES (
        v_kpi_id, 1, 1,
        '{"action": "BASE", "resourceType": "Patient", "valueType": "fhir_filter", "path": "id", "operator": "exists", "value": "true", "notes": "分母與分子之共同主鍵 (Patient.id)"}',
        'Patient'
    );

    -- Step 2: Base Procedure (Core Surgery)
    INSERT INTO kpi_dl (kpiid, kpi_dl_type, seq, kpi_dl_condition_value, kpi_id_fhir_resource)
    VALUES (
        v_kpi_id, 1, 2,
        '{"action": "AND", "resourceType": "Procedure", "valueType": "fhir_filter", "path": "code", "operator": "in", "value": "TW_Core_Surgery_VS", "notes": "手術代碼 (ICD-10-PCS ValueSet)"}',
        'Procedure'
    );

    -- Step 3: Status Completed
    INSERT INTO kpi_dl (kpiid, kpi_dl_type, seq, kpi_dl_condition_value, kpi_id_fhir_resource)
    VALUES (
        v_kpi_id, 1, 3,
        '{"action": "AND", "resourceType": "Procedure", "valueType": "fhir_filter", "path": "status", "operator": "=", "value": "completed", "notes": "執行狀態=完成"}',
        'Procedure'
    );

    -- Step 4: Inpatient Encounter
    INSERT INTO kpi_dl (kpiid, kpi_dl_type, seq, kpi_dl_condition_value, kpi_id_fhir_resource)
    VALUES (
        v_kpi_id, 1, 4,
        '{"action": "AND", "resourceType": "Encounter", "valueType": "fhir_filter", "path": "class", "operator": "=", "value": "IMP", "notes": "住院案件 (code=IMP)"}',
        'Encounter'
    );

    -- Step 5: ASA Class (Observation)
    INSERT INTO kpi_dl (kpiid, kpi_dl_type, seq, kpi_dl_condition_value, kpi_id_fhir_resource)
    VALUES (
        v_kpi_id, 1, 5,
        '{"action": "AND", "resourceType": "Observation", "valueType": "fhir_filter", "path": "code", "operator": "in", "value": "11368-0", "notes": "麻醉風險 (ASA 分級紀錄)"}',
        'Observation'
    );

    -- Step 6: Location (OR/ORC/CATH)
    INSERT INTO kpi_dl (kpiid, kpi_dl_type, seq, kpi_dl_condition_value, kpi_id_fhir_resource)
    VALUES (
        v_kpi_id, 1, 6,
        '{"action": "AND", "resourceType": "Location", "valueType": "fhir_filter", "path": "type", "operator": "in", "value": "OR,CATH", "notes": "手術地點 (OR, 心導管室)"}',
        'Location'
    );

    -- Step 7: Practitioner (Anesthetist)
    INSERT INTO kpi_dl (kpiid, kpi_dl_type, seq, kpi_dl_condition_value, kpi_id_fhir_resource)
    VALUES (
        v_kpi_id, 1, 7,
        '{"action": "AND", "resourceType": "Practitioner", "valueType": "fhir_filter", "path": "qualification", "operator": "=", "value": "Anesthetist", "notes": "麻醉執行者 (需具備資格)"}',
        'Practitioner'
    );

    -- 4. Insert EXCLUSION Steps (kpi_dl_type = 3) works as "Exclude Check"
    -- Shared Exclusion: Organ Harvest
    INSERT INTO kpi_dl (kpiid, kpi_dl_type, seq, kpi_dl_condition_value, kpi_id_fhir_resource)
    VALUES (
        v_kpi_id, 3, 1,
        '{"action": "BASE", "resourceType": "Procedure", "valueType": "fhir_filter", "path": "code", "operator": "in", "value": "Organ_Harvest_VS", "notes": "排除：腦死器官摘除手術"}',
        'Procedure'
    );


    -- 5. Insert NUMERATOR Steps (kpi_dl_type = 2)
    -- Step 1: Patient ID (Base)
    INSERT INTO kpi_dl (kpiid, kpi_dl_type, seq, kpi_dl_condition_value, kpi_id_fhir_resource)
    VALUES (
        v_kpi_id, 2, 1,
        '{"action": "BASE", "resourceType": "Patient", "valueType": "fhir_filter", "path": "id", "operator": "exists", "value": "true", "notes": "分子計算對象 (Patient.id)"}',
        'Patient'
    );

    -- Step 2: Patient Deceased within 48h (Same Hospital)
    INSERT INTO kpi_dl (kpiid, kpi_dl_type, seq, kpi_dl_condition_value, kpi_id_fhir_resource)
    VALUES (
        v_kpi_id, 2, 2,
        '{"action": "AND", "resourceType": "Patient", "valueType": "fhir_filter", "path": "deceasedDateTime", "operator": "exists", "value": "true", "notes": "死亡時間-麻醉時間<=48h; 同一醫院(serviceProvider)"}',
        'Patient'
    );

    -- Step 3: Encounter AAD/Exp within 48h (Critical)
    INSERT INTO kpi_dl (kpiid, kpi_dl_type, seq, kpi_dl_condition_value, kpi_id_fhir_resource)
    VALUES (
        v_kpi_id, 2, 3,
        '{"action": "OR", "resourceType": "Encounter", "valueType": "fhir_filter", "path": "hospitalization.dischargeDisposition", "operator": "in", "value": "aadvice,exp", "notes": "出院時間-麻醉時間<=48h; AAD/Exp; Condition:Critical/Terminal"}',
        'Encounter'
    );

    -- 6. Sync Feature Definitions (kpi_ft_detail_inf)
    -- Clear existing
    DELETE FROM kpi_ft_detail_inf WHERE kpi_id = v_kpi_id;
    
    -- Insert Feature Map (Mapping relevant fields to generic columns)
    -- Column 1: Patient ID
    INSERT INTO kpi_ft_detail_inf (kpi_id, column_slot, display_name, fhir_source, seq) VALUES (v_kpi_id, 'column1', '病患代碼', 'Patient.id', 1);
    
    -- Column 2: Procedure Code
    INSERT INTO kpi_ft_detail_inf (kpi_id, column_slot, display_name, fhir_source, seq) VALUES (v_kpi_id, 'column2', '手術代碼', 'Procedure.code', 2);
    
    -- Column 3: Procedure Status
    INSERT INTO kpi_ft_detail_inf (kpi_id, column_slot, display_name, fhir_source, seq) VALUES (v_kpi_id, 'column3', '手術狀態', 'Procedure.status', 3);
    
    -- Column 4: Encounter Class
    INSERT INTO kpi_ft_detail_inf (kpi_id, column_slot, display_name, fhir_source, seq) VALUES (v_kpi_id, 'column4', '就醫類別', 'Encounter.class', 4);
    
    -- Column 5: Observation Code (ASA)
    INSERT INTO kpi_ft_detail_inf (kpi_id, column_slot, display_name, fhir_source, seq) VALUES (v_kpi_id, 'column5', 'ASA分級代碼', 'Observation.code', 5);
    
    -- Column 6: Location Type
    INSERT INTO kpi_ft_detail_inf (kpi_id, column_slot, display_name, fhir_source, seq) VALUES (v_kpi_id, 'column6', '手術地點', 'Location.type', 6);
    
    -- Column 7: Practitioner Qualification
    INSERT INTO kpi_ft_detail_inf (kpi_id, column_slot, display_name, fhir_source, seq) VALUES (v_kpi_id, 'column7', '人員資格', 'Practitioner.qualification', 7);
    
    -- Column 8: Patient Deceased
    INSERT INTO kpi_ft_detail_inf (kpi_id, column_slot, display_name, fhir_source, seq) VALUES (v_kpi_id, 'column8', '死亡時間', 'Patient.deceasedDateTime', 8);
    
    -- Column 9: Discharge Disposition
    INSERT INTO kpi_ft_detail_inf (kpi_id, column_slot, display_name, fhir_source, seq) VALUES (v_kpi_id, 'column9', '出院狀況', 'Encounter.hospitalization.dischargeDisposition', 9);

END $$;
