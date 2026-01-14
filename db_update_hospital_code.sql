-- Add hospital_code column to fhir_set_values
ALTER TABLE "fhir_set_values" 
ADD COLUMN IF NOT EXISTS "hospital_code" text;

-- Add a comment/description if supported by the dialect, but simpler is safer.
-- This column maps the standard code (e.g. 81001C) to the hospital's internal legacy code.
