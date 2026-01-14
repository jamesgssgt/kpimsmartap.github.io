-- Add range_lower and range_higher to kpi_definitions
ALTER TABLE public.kpi_definitions
ADD COLUMN IF NOT EXISTS range_lower NUMERIC,
ADD COLUMN IF NOT EXISTS range_higher NUMERIC;

COMMENT ON COLUMN public.kpi_definitions.range_lower IS 'Normal Range Lower Bound';
COMMENT ON COLUMN public.kpi_definitions.range_higher IS 'Normal Range Upper Bound';

NOTIFY pgrst, 'reload schema';
