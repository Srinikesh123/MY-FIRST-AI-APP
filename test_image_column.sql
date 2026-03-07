-- Test if image_data column exists in messages table
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'messages' AND table_schema = 'public' 
ORDER BY ordinal_position;
