-- Add is_pinned to kpi_definitions
ALTER TABLE public.kpi_definitions
ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.kpi_definitions.is_pinned IS 'Whether this indicator is pinned to the dashboard';

-- Notify PostgREST to reload the schema cache
NOTIFY pgrst, 'reload schema';
