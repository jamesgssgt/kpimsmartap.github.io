-- Add numerator_kift_id and denominator_kift_id to kpi_definitions
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'kpi_definitions' AND column_name = 'numerator_kift_id') THEN
        ALTER TABLE public.kpi_definitions ADD COLUMN numerator_kift_id UUID REFERENCES public.kift_definitions(kiftid) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'kpi_definitions' AND column_name = 'denominator_kift_id') THEN
        ALTER TABLE public.kpi_definitions ADD COLUMN denominator_kift_id UUID REFERENCES public.kift_definitions(kiftid) ON DELETE SET NULL;
    END IF;
END $$;
