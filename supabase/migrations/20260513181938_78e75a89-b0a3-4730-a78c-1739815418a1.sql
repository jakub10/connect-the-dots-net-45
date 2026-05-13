
-- 1) Restrict posts/comments SELECT to authenticated users
DROP POLICY IF EXISTS "Posts are viewable by everyone" ON public.posts;
CREATE POLICY "Posts are viewable by authenticated users"
  ON public.posts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Comments are viewable by everyone" ON public.comments;
CREATE POLICY "Comments are viewable by authenticated users"
  ON public.comments FOR SELECT TO authenticated USING (true);

-- 2) Tighten story_view notification check: require a matching story_views row
DROP POLICY IF EXISTS "Users can create valid notifications" ON public.notifications;
CREATE POLICY "Users can create valid notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    ((auth.uid() = from_user_id) OR (from_user_id IS NULL))
    AND (type = ANY (ARRAY['like','comment','friend_request','friend_accepted','message','mention','moderation','achievement','story_view']))
    AND (user_id <> COALESCE(from_user_id, '00000000-0000-0000-0000-000000000000'::uuid))
    AND (
      ((type = ANY (ARRAY['like','comment','mention'])) AND post_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.posts p WHERE p.id = notifications.post_id AND p.user_id = notifications.user_id
      ))
      OR ((type = ANY (ARRAY['friend_request','friend_accepted'])) AND EXISTS (
        SELECT 1 FROM public.friendships f
        WHERE (f.requester_id = auth.uid() AND f.addressee_id = notifications.user_id)
           OR (f.addressee_id = auth.uid() AND f.requester_id = notifications.user_id)
      ))
      OR (type = 'message' AND EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE (c.participant_1 = auth.uid() AND c.participant_2 = notifications.user_id)
           OR (c.participant_2 = auth.uid() AND c.participant_1 = notifications.user_id)
      ))
      OR (type = 'story_view' AND EXISTS (
        SELECT 1 FROM public.story_views sv
        JOIN public.stories s ON s.id = sv.story_id
        WHERE sv.user_id = auth.uid()
          AND s.user_id = notifications.user_id
      ))
      OR (from_user_id IS NULL AND type = ANY (ARRAY['moderation','achievement']))
    )
  );

-- 3) Storage path namespacing: drop overlapping DELETE policies and recreate with mutually exclusive paths
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND cmd='DELETE'
      AND (qual ILIKE '%posts%' OR policyname ILIKE '%post%' OR policyname ILIKE '%stor%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', p.policyname);
  END LOOP;
END $$;

-- Posts bucket: user can delete their own files at <uid>/... but NOT under stories/
CREATE POLICY "Users can delete own post files (non-stories)"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'posts'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND COALESCE((storage.foldername(name))[1],'') <> 'stories'
  );

-- Stories live under stories/<uid>/...
CREATE POLICY "Users can delete own story files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'posts'
    AND (storage.foldername(name))[1] = 'stories'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- 4) realtime_ws_tickets: deny all direct client access (only SECURITY DEFINER RPC writes)
CREATE POLICY "No direct access to ws tickets"
  ON public.realtime_ws_tickets FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);
