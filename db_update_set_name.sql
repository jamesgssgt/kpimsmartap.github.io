-- Add set_name column to fhir_set_values for user-friendly display name of the ValueSet
ALTER TABLE "fhir_set_values" 
ADD COLUMN IF NOT EXISTS "set_name" text;
