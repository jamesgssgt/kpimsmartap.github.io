-- Add seq and symbols columns to kpi_dl
ALTER TABLE public.kpi_dl 
ADD COLUMN IF NOT EXISTS seq INT,
ADD COLUMN IF NOT EXISTS symbols VARCHAR(15);
