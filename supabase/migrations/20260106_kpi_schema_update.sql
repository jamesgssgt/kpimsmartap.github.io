-- Add calculation methods to kpi_definitions
ALTER TABLE public.kpi_definitions 
ADD COLUMN IF NOT EXISTS numerator_c VARCHAR(10),
ADD COLUMN IF NOT EXISTS denominator_c VARCHAR(10);

-- Add source_type to kpi_dl
ALTER TABLE public.kpi_dl 
ADD COLUMN IF NOT EXISTS source_type VARCHAR(10);
