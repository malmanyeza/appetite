-- Create a public bucket for restaurant assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('restaurant-assets', 'restaurant-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for restaurant-assets bucket

-- Allow public access to view images
CREATE POLICY "Public Access" ON storage.objects
FOR SELECT USING (bucket_id = 'restaurant-assets');

-- Allow authenticated users with 'restaurant' role to upload images
CREATE POLICY "Restaurant Managers Upload" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'restaurant-assets' AND
  (auth.role() = 'authenticated')
);

-- Allow owners to update/delete their own uploads
CREATE POLICY "Restaurant Managers Manage" ON storage.objects
FOR ALL USING (
  bucket_id = 'restaurant-assets' AND
  (auth.uid()::text = (storage.foldername(name))[1])
);
