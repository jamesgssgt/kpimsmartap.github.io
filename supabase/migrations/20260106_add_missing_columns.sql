-- Add frequency column if it doesn't exist
ALTER TABLE public.kpi_definitions 
ADD COLUMN IF NOT EXISTS frequency VARCHAR(20) DEFAULT '每月';

-- Add numerator_name and denominator_name columns if they don't exist
ALTER TABLE public.kpi_definitions 
ADD COLUMN IF NOT EXISTS numerator_name TEXT,
ADD COLUMN IF NOT EXISTS denominator_name TEXT;

-- Notify PostgREST to reload the schema cache
NOTIFY pgrst, 'reload schema';
