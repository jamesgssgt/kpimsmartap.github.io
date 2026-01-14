-- Add numerator_name and denominator_name columns to kpi_definitions
ALTER TABLE public.kpi_definitions 
ADD COLUMN IF NOT EXISTS numerator_name TEXT,
ADD COLUMN IF NOT EXISTS denominator_name TEXT;

-- Notify PostgREST to reload the schema cache
NOTIFY pgrst, 'reload schema';
