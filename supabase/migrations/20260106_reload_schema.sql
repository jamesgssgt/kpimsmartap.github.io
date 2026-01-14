-- Notify PostgREST to reload the schema cache
-- This is often necessary after adding new columns to existing tables
NOTIFY pgrst, 'reload schema';
