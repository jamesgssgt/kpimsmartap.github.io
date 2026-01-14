-- 1. Create Main kpi_detail Table (Merged Result & Case Info)
CREATE TABLE IF NOT EXISTS public.kpi_detail (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kpi_id UUID REFERENCES public.kpi_definitions(kpiid),
    data_date DATE,
    department TEXT,
    doctor_id TEXT,
    doctor_name TEXT,
    hospital_id TEXT,
    patient_id TEXT,
    patient_gender TEXT,
    patient_birth_date DATE,
    numerator_value FLOAT DEFAULT 0,
    denominator_value FLOAT DEFAULT 0,
    kpi_value FLOAT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure all columns exist (in case table existed from previous version)
DO $$
BEGIN
    BEGIN
        ALTER TABLE public.kpi_detail ADD COLUMN data_date DATE;
    EXCEPTION WHEN duplicate_column THEN END;
    
    BEGIN
        ALTER TABLE public.kpi_detail ADD COLUMN department TEXT;
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.kpi_detail ADD COLUMN doctor_id TEXT;
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.kpi_detail ADD COLUMN doctor_name TEXT;
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.kpi_detail ADD COLUMN hospital_id TEXT;
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.kpi_detail ADD COLUMN patient_id TEXT;
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.kpi_detail ADD COLUMN patient_gender TEXT;
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.kpi_detail ADD COLUMN patient_birth_date DATE;
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.kpi_detail ADD COLUMN numerator_value FLOAT DEFAULT 0;
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.kpi_detail ADD COLUMN denominator_value FLOAT DEFAULT 0;
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.kpi_detail ADD COLUMN kpi_value FLOAT;
    EXCEPTION WHEN duplicate_column THEN END;
END $$;

-- 2. Create kpi_ft_detail_inf (Metadata for Flexible Columns)
CREATE TABLE IF NOT EXISTS public.kpi_ft_detail_inf (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kpi_id UUID REFERENCES public.kpi_definitions(kpiid) ON DELETE CASCADE,
    column_slot VARCHAR(20), -- e.g. 'column1'
    display_name VARCHAR(100),
    fhir_source VARCHAR(200),
    seq INT DEFAULT 0
);

-- 3. Create kpi_ft_detail (Flexible Data linked to kpi_detail)
CREATE TABLE IF NOT EXISTS public.kpi_ft_detail (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kpi_detail_id UUID REFERENCES public.kpi_detail(id) ON DELETE CASCADE,
    ft_detail_inf_id UUID REFERENCES public.kpi_ft_detail_inf(id),
    column1 TEXT,
    column2 TEXT,
    column3 TEXT,
    column4 TEXT,
    column5 TEXT,
    column6 TEXT,
    column7 TEXT,
    column8 TEXT,
    column9 TEXT,
    column10 TEXT,
    column11 TEXT,
    column12 TEXT,
    column13 TEXT,
    column14 TEXT,
    column15 TEXT,
    column16 TEXT,
    column17 TEXT,
    column18 TEXT,
    column19 TEXT,
    column20 TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.kpi_detail ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_ft_detail_inf ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_ft_detail ENABLE ROW LEVEL SECURITY;

-- Policies (Allow all for auth users)
DROP POLICY IF EXISTS "Auth Access detail" ON public.kpi_detail;
CREATE POLICY "Auth Access detail" ON public.kpi_detail FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Auth Access ft_inf" ON public.kpi_ft_detail_inf;
CREATE POLICY "Auth Access ft_inf" ON public.kpi_ft_detail_inf FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Auth Access ft_dat" ON public.kpi_ft_detail;
CREATE POLICY "Auth Access ft_dat" ON public.kpi_ft_detail FOR ALL TO authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
