-- Add patient_age to KPI_Detail if it doesn't exist
ALTER TABLE public."KPI_Detail" 
ADD COLUMN IF NOT EXISTS patient_age INT;

-- Notify PostgREST to reload the schema cache
NOTIFY pgrst, 'reload schema';
