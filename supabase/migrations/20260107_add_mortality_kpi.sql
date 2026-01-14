-- Create a new KPI for "Mortality within 48 hours after surgery"
DO $$
DECLARE
    new_kpi_id UUID := gen_random_uuid();
    kpi_desc TEXT := '收案方式：
(一) 以事件發生的月份為收案月份
(二) 住院病人手術係指住院後手術與手術後住院，並以手術登記簿或電腦手術系統之人次列計
(三) 「住院病人手術」是指符合以下三項條件的手術：
1. 住院病人在手術室內執行下列 ICD-10-PCS （ICD-9-CMcode00.30-86.99）內之一或多項手術
2. 手術經ASA麻醉風險分類系統分類
3. 由麻醉人員進行麻醉
(四) 分子包含：
1. 病人在住院期間曾接受麻醉，並在病歷上記錄的麻醉開始時間後48小時內於同一家醫院死亡者。只要符合定義及執行細則之規範，均應算入分子計算
2. 住院病人於手術室接受手術，自麻醉時間後48小時內於同一家醫院經醫師判定為病危瀕臨死亡，由病人或病人家屬要求自動辦理出院返家往生人數
(五) 在手術室執行的住院手術次數列計，若病人同時執行多項手術，應以主要手術式計算為一次
(六) 住院病人需經皮膚、粘膜劃下至少 1 個切口（包括腹腔鏡【laparoscopic approach】或顱骨鑽孔術【cranial Burr holes】），或經由之前開刀留下的放手術切口；且必須是在手術室執行
(七) 手術定義不包括切口的縫合方式，所以個案手術傷口不論有無進行縫合，只要接受任1項手術，都可納入監測對象
(八) 手術室的定義，不論新蓋或翻修的都必須符合衛生福利部「醫療機構設置標準」之手術室設施規定及相關設備規範，方屬之；這可包括手術室、剖腹產室、介入放射學室或心導管室';
BEGIN
    -- 1. Insert Definition
    INSERT INTO public.kpi_definitions (
        kpiid,
        name,
        numerator_name,
        denominator_name,
        formula,
        frequency,
        numerator_c,
        denominator_c,
        target_value,
        target_operator,
        is_pinned
    ) VALUES (
        new_kpi_id,
        '手術後48小時內死亡率',
        '住院病人手術術後48小時內死亡人數',
        '住院病人手術數',
        kpi_desc,
        '每月',
        'count',
        'count',
        2.0, -- Example target value
        '<',  -- Lower is better
        true -- Pin it by default for visibility
    );

    -- 2. Insert Logic Steps (kpi_dl)

    -- >>> Denominator Configuration <<<
    -- Step 1: Base - Procedure (手術)
    INSERT INTO public.kpi_dl (kpiid, kpi_dl_type, kpi_dl_name, source_type, seq, kpi_dl_condition_value, kpi_dl_notes, kpi_dl_create_user)
    VALUES (new_kpi_id, 1, '手術處置', '1', 1, 
        '{"action":"BASE","valueType":"fhir_filter","resourceType":"Procedure","path":"","operator":"exists","value":"true","notes":"所有手術處置 (All Procedures)"}', 
        '所有手術處置 (All Procedures)', 'system');

    -- Step 2: AND - Encounter Class = IMP (Inpatient 住院)
    INSERT INTO public.kpi_dl (kpiid, kpi_dl_type, kpi_dl_name, source_type, seq, kpi_dl_condition_value, kpi_dl_notes, kpi_dl_create_user)
    VALUES (new_kpi_id, 1, '住院病人', '1', 2, 
        '{"action":"AND","valueType":"fhir_filter","resourceType":"Encounter","path":"class.code","operator":"equals","value":"IMP","notes":"住院案件 (Inpatient)"}', 
        '住院案件 (Inpatient)', 'system');

    -- Step 3: AND - Procedure Location = Surgery Room (手術室)
    INSERT INTO public.kpi_dl (kpiid, kpi_dl_type, kpi_dl_name, source_type, seq, kpi_dl_condition_value, kpi_dl_notes, kpi_dl_create_user)
    VALUES (new_kpi_id, 1, '手術室執行', '1', 3, 
        '{"action":"AND","valueType":"fhir_filter","resourceType":"Procedure","path":"location.display","operator":"contains","value":"手術室","notes":"地點需為符合標準之手術室"}', 
        '地點需為符合標準之手術室', 'system');

    -- Step 4: AND - ICD-10-PCS Code Match
    INSERT INTO public.kpi_dl (kpiid, kpi_dl_type, kpi_dl_name, source_type, seq, kpi_dl_condition_value, kpi_dl_notes, kpi_dl_create_user)
    VALUES (new_kpi_id, 1, 'ICD-10-PCS代碼', '1', 4, 
        '{"action":"AND","valueType":"fhir_filter","resourceType":"Procedure","path":"code.coding.system","operator":"contains","value":"ICD-10-PCS","notes":"符合 ICD-10-PCS 手術編碼"}', 
        '符合 ICD-10-PCS 手術編碼', 'system');

    -- Step 5: AND - ASA Class Exists (Observation)
    INSERT INTO public.kpi_dl (kpiid, kpi_dl_type, kpi_dl_name, source_type, seq, kpi_dl_condition_value, kpi_dl_notes, kpi_dl_create_user)
    VALUES (new_kpi_id, 1, 'ASA分級', '1', 5, 
        '{"action":"AND","valueType":"fhir_filter","resourceType":"Observation","path":"code.text","operator":"contains","value":"ASA","notes":"需有 ASA 麻醉風險分級記錄 (Observation)"}', 
        '需有 ASA 麻醉風險分級記錄 (Observation)', 'system');

    -- Step 6: AND - Anesthesia Procedure Exists
    INSERT INTO public.kpi_dl (kpiid, kpi_dl_type, kpi_dl_name, source_type, seq, kpi_dl_condition_value, kpi_dl_notes, kpi_dl_create_user)
    VALUES (new_kpi_id, 1, '麻醉執行', '1', 6, 
        '{"action":"AND","valueType":"fhir_filter","resourceType":"Procedure","path":"code.text","operator":"contains","value":"Anesthesia","notes":"需由麻醉人員進行麻醉 (Anesthesia Procedure)"}', 
        '需由麻醉人員進行麻醉 (Anesthesia Procedure)', 'system');


    -- >>> Numerator Configuration <<<
    -- Step 1: Base - Reference Denominator (引用分母)
    INSERT INTO public.kpi_dl (kpiid, kpi_dl_type, kpi_dl_name, source_type, seq, kpi_dl_condition_value, kpi_dl_notes, kpi_dl_create_user)
    VALUES (new_kpi_id, 2, '引用分母', '2', 1, 
        '{"action":"BASE","valueType":"indicator_result","value":"CURRENT_DENOMINATOR","notes":"符合分母條件之個案"}', 
        '符合分母條件之個案', 'system');

    -- Step 2: AND - Patient Deceased (死亡)
    INSERT INTO public.kpi_dl (kpiid, kpi_dl_type, kpi_dl_name, source_type, seq, kpi_dl_condition_value, kpi_dl_notes, kpi_dl_create_user)
    VALUES (new_kpi_id, 2, '術後48小時內死亡', '1', 2, 
        '{"action":"AND","valueType":"fhir_filter","resourceType":"Patient","path":"deceasedBoolean","operator":"equals","value":"true","notes":"於院內死亡或病危自動出院 (判定需結合時間邏輯: 術後48小時內)"}', 
        '於院內死亡或病危自動出院 (判定需結合時間邏輯: 術後48小時內)', 'system');


    -- >>> Exclusion Configuration <<<
    -- Step 1: Exclusion - Organ Harvesting (器官摘除)
    INSERT INTO public.kpi_dl (kpiid, kpi_dl_type, kpi_dl_name, source_type, seq, kpi_dl_condition_value, kpi_dl_notes, kpi_dl_create_user)
    VALUES (new_kpi_id, 3, '排除器官摘除', '1', 1, 
        '{"action":"BASE","valueType":"fhir_filter","resourceType":"Procedure","path":"code.text","operator":"contains","value":"Organ Harvesting","notes":"腦死接受器官摘除手術"}', 
        '腦死接受器官摘除手術', 'system');

    RAISE NOTICE 'Created KPI: 手術後48小時內死亡率 with ID: %', new_kpi_id;
END $$;
