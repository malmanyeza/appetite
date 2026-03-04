-- Migrate Storage Bucket for Driver Onboarding Uploads

-- 1. Create the 'driver-documents' bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('driver-documents', 'driver-documents', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Drop existing policies to prevent "already exists" errors
DROP POLICY IF EXISTS "Users can upload their own driver documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can read driver documents and users can read their own" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own driver documents" ON storage.objects;

-- 3. Create RLS Policies for the bucket

-- Allow any authenticated user to upload their own documents
CREATE POLICY "Users can upload their own driver documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'driver-documents'
    AND auth.uid()::text = (string_to_array(name, '/'))[2]
);

-- Allow admins to read all driver documents or users to read their own
CREATE POLICY "Admins can read driver documents and users can read their own"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'driver-documents'
    AND (
        auth.uid()::text = (string_to_array(name, '/'))[2]
        OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
    )
);

-- Allow users to delete their own documents (useful for re-uploads during onboarding)
CREATE POLICY "Users can delete their own driver documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'driver-documents'
    AND auth.uid()::text = (string_to_array(name, '/'))[2]
);
