-- ============================================
-- Add image support to messages table
-- Run this in Supabase SQL Editor to add image upload functionality
-- ============================================

-- Add image_data column to messages table
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS image_data text;

-- Add comment to document the new column
COMMENT ON COLUMN public.messages.image_data IS 'Base64 encoded image data for uploaded images (nullable)';

-- Update the existing policies to handle the new column
-- No changes needed to RLS policies as they automatically cover new columns

-- Create index for image_data if you expect many images (optional)
-- CREATE INDEX IF NOT EXISTS idx_messages_image_data ON public.messages(image_data) WHERE image_data IS NOT NULL;

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'messages' AND table_schema = 'public' 
ORDER BY ordinal_position;
