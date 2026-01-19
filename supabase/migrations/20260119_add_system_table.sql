
-- Create System table
CREATE TABLE IF NOT EXISTS public."system" (
    "SysCode" character varying(20) NOT NULL,
    "SysName" character varying(100),
    "SysType" integer,
    "SysValue" character varying(300),
    "Createddate" timestamp without time zone DEFAULT now(),
    "Modifieddate" timestamp without time zone DEFAULT now(),
    CONSTRAINT system_pkey PRIMARY KEY ("SysCode")
);

-- Add comment to table
COMMENT ON TABLE public."system" IS 'System configuration and settings table';

-- Grant access to authenticated users (adjust as needed for your security model)
ALTER TABLE public."system" ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated users
CREATE POLICY "Enable read access for authenticated users" ON public."system"
    FOR SELECT TO authenticated USING (true);

-- Allow all access for authenticated users (TEMPORARY: refinement needed based on roles)
-- Ideally only admins should be able to write
CREATE POLICY "Enable insert for authenticated users" ON public."system"
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON public."system"
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Enable delete for authenticated users" ON public."system"
    FOR DELETE TO authenticated USING (true);
