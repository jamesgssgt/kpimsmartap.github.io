-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.kpi_definitions;
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.kpi_dl;

-- Enable RLS (ensure it is on)
ALTER TABLE public.kpi_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_dl ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for kpi_definitions
CREATE POLICY "Allow all access for kpi_definitions"
ON public.kpi_definitions
FOR ALL
USING (true)
WITH CHECK (true);

-- Create permissive policies for kpi_dl
CREATE POLICY "Allow all access for kpi_dl"
ON public.kpi_dl
FOR ALL
USING (true)
WITH CHECK (true);

-- Notify PostgREST to reload the schema cache
NOTIFY pgrst, 'reload schema';
