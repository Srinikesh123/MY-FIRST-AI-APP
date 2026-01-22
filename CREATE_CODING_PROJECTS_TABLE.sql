-- ============================================
-- CODING AGENT PROJECTS TABLE
-- Run this in Supabase SQL Editor
-- ============================================

-- Create the coding_projects table
CREATE TABLE IF NOT EXISTS coding_projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'my-project',
    files JSONB DEFAULT '{}'::jsonb,
    conversation JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster user lookups
CREATE INDEX IF NOT EXISTS idx_coding_projects_user_id ON coding_projects(user_id);

-- Enable Row Level Security
ALTER TABLE coding_projects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own projects" ON coding_projects;
DROP POLICY IF EXISTS "Users can create own projects" ON coding_projects;
DROP POLICY IF EXISTS "Users can update own projects" ON coding_projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON coding_projects;

-- Create RLS policies
CREATE POLICY "Users can view own projects" ON coding_projects
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own projects" ON coding_projects
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects" ON coding_projects
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects" ON coding_projects
    FOR DELETE USING (auth.uid() = user_id);

-- Add comment for documentation
COMMENT ON TABLE coding_projects IS 'Stores coding agent projects with files and conversation history';

-- Success message
SELECT 'Coding projects table created successfully!' AS status;