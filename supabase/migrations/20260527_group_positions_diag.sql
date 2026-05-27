-- 1. Check if the table actually exists
SELECT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' AND tablename = 'user_group_positions'
) AS table_exists;

-- 2. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- 3. Verify the columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'user_group_positions'
AND table_schema = 'public';
