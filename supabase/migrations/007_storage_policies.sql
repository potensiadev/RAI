-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- RAI Storage Policies
-- Bucket: resumes
-- Path: uploads/{user_id}/{filename}
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Create the resumes bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', false)
ON CONFLICT (id) DO NOTHING;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Storage Policies for 'resumes' bucket
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Policy: Users can upload files to their own folder
-- Path pattern: uploads/{user_id}/*
CREATE POLICY "Users can upload to own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'resumes'
    AND (storage.foldername(name))[1] = 'uploads'
    AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Policy: Users can view their own files
CREATE POLICY "Users can view own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'resumes'
    AND (storage.foldername(name))[1] = 'uploads'
    AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Policy: Users can update their own files
CREATE POLICY "Users can update own files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'resumes'
    AND (storage.foldername(name))[1] = 'uploads'
    AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Policy: Users can delete their own files
CREATE POLICY "Users can delete own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'resumes'
    AND (storage.foldername(name))[1] = 'uploads'
    AND (storage.foldername(name))[2] = auth.uid()::text
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Service Role Access (for Worker)
-- Worker uses service_role key which bypasses RLS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

COMMENT ON POLICY "Users can upload to own folder" ON storage.objects IS
'Allows authenticated users to upload resumes to uploads/{user_id}/ folder';
