DO $$
DECLARE
    new_kpi_id UUID;
BEGIN
    -- Only insert if it doesn't exist to avoid duplicates on re-run
    IF NOT EXISTS (SELECT 1 FROM public.kpi_definitions WHERE name = '預防性抗生素在手術劃刀前1小時內給予比率') THEN
        
        -- Insert KPI Definition
        INSERT INTO public.kpi_definitions (name, formula, numerator_name, denominator_name, frequency, numerator_c, denominator_c)
        VALUES (
            '預防性抗生素在手術劃刀前1小時內給予比率',
            '手術劃刀前1小時內給予預防性抗生素人次 / 手術人次 * 100%',
            '劃刀前1小時內給予抗生素人次',
            '手術人次',
            '每月',
            'sum',
            'count'
        )
        RETURNING kpiid INTO new_kpi_id;

        -- Insert Denominator Step (All Procedures)
        INSERT INTO public.kpi_dl (kpiid, kpi_dl_type, kpi_dl_name, seq, source_type, kpi_id_fhir_resource, kpi_dl_condition_value, kpi_dl_notes)
        VALUES (
            new_kpi_id,
            1, -- Denominator
            'Denominator',
            1,
            '1', -- FHIR source
            'Procedure',
            '{"path": "category", "operator": "exists", "value": "", "action": "BASE", "valueType": "fhir_filter"}',
            '所有手術'
        );

        -- Insert Numerator Step (MedicationAdministration within 1hr)
        INSERT INTO public.kpi_dl (kpiid, kpi_dl_type, kpi_dl_name, seq, source_type, kpi_id_fhir_resource, kpi_dl_condition_value, kpi_dl_notes)
        VALUES (
            new_kpi_id,
            2, -- Numerator
            'Numerator',
            1,
            '1', -- FHIR source
            'MedicationAdministration',
            '{"path": "effectiveDateTime", "operator": "within_1hr_before", "value": "Procedure.start", "action": "BASE", "valueType": "fhir_filter"}',
            '手術劃刀前1小時內給予'
        );

    END IF;
END $$;
