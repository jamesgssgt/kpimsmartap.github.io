-- Add Surgery Time columns to KPI_Detail table
ALTER TABLE "KPI_Detail" ADD COLUMN IF NOT EXISTS "op_start" timestamp with time zone;
ALTER TABLE "KPI_Detail" ADD COLUMN IF NOT EXISTS "op_end" timestamp with time zone;
