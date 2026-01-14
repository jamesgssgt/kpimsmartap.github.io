-- Update set_name for existing C_Section_Exclusion_VS data
UPDATE "fhir_set_values"
SET "set_name" = '剖腹產排除值集'
WHERE "set_id" = 'C_Section_Exclusion_VS';

-- Update set_name for Vanco (if it exists)
UPDATE "fhir_set_values"
SET "set_name" = '萬古黴素值集'
WHERE "set_id" = 'Vanco_Fluoro_VS';
