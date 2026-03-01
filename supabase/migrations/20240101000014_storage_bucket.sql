-- Migration to create the restaurant-assets storage bucket and its security policies

-- 1. Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('restaurant-assets', 'restaurant-assets', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Policy: Allow public read access (everyone can view the images)
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'restaurant-assets' );

-- 4. Policy: Allow authenticated users to upload images
CREATE POLICY "Auth Upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'restaurant-assets' );

-- 5. Policy: Allow users to update their own uploads (optional but useful)
CREATE POLICY "Auth Update"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'restaurant-assets' AND auth.uid() = owner )
WITH CHECK ( bucket_id = 'restaurant-assets' AND auth.uid() = owner );

-- 6. Policy: Allow users to delete their own uploads
CREATE POLICY "Auth Delete"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'restaurant-assets' AND auth.uid() = owner );
