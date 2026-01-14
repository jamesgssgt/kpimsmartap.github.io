-- Add hospital_name and doctor_id to KPI_Detail
ALTER TABLE public."KPI_Detail" 
ADD COLUMN IF NOT EXISTS hospital_name TEXT,
ADD COLUMN IF NOT EXISTS doctor_id TEXT;

-- Add hospital_name and doctor_id to KPI as well
ALTER TABLE public."KPI" 
ADD COLUMN IF NOT EXISTS hospital_name TEXT,
ADD COLUMN IF NOT EXISTS doctor_id TEXT;

-- Notify PostgREST to reload the schema cache
NOTIFY pgrst, 'reload schema';
