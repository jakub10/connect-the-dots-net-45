-- Add storage policies for stories folder in posts bucket
-- Allow authenticated users to upload their own stories
CREATE POLICY "Users can upload their own stories"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'posts' AND 
  (storage.foldername(name))[1] = 'stories' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- Allow everyone to view stories (they're public)
CREATE POLICY "Stories are publicly viewable"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'posts' AND 
  (storage.foldername(name))[1] = 'stories'
);

-- Allow users to delete their own stories
CREATE POLICY "Users can delete their own stories"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'posts' AND 
  (storage.foldername(name))[1] = 'stories' AND
  (storage.foldername(name))[2] = auth.uid()::text
);