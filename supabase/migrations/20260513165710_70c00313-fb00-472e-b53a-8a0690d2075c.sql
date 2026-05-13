CREATE POLICY "Users can update their own posts files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'posts' AND (auth.uid())::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'posts' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own avatar files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1]);