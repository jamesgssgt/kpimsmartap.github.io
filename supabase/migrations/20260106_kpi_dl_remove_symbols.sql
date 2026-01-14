-- Drop symbols column from kpi_dl
ALTER TABLE public.kpi_dl 
DROP COLUMN IF EXISTS symbols;
