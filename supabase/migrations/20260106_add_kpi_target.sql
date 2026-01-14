-- Add target_value and target_operator to kpi_definitions table
ALTER TABLE public.kpi_definitions
ADD COLUMN IF NOT EXISTS target_value NUMERIC,
ADD COLUMN IF NOT EXISTS target_operator VARCHAR(5); -- '>=', '<=', '>', '<', '='

-- Comment on columns
COMMENT ON COLUMN public.kpi_definitions.target_value IS 'KPI Target Value (e.g. 80)';
COMMENT ON COLUMN public.kpi_definitions.target_operator IS 'Comparison operator for target (e.g. >=)';
