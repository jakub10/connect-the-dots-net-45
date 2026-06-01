-- 1) Length limits on user content
ALTER TABLE public.posts ADD CONSTRAINT posts_content_length CHECK (char_length(content) <= 5000);
ALTER TABLE public.comments ADD CONSTRAINT comments_content_length CHECK (char_length(content) <= 2000);
ALTER TABLE public.messages ADD CONSTRAINT messages_content_length CHECK (char_length(content) <= 4000);
ALTER TABLE public.group_messages ADD CONSTRAINT group_messages_content_length CHECK (char_length(content) <= 4000);

-- 2) Notifications: prevent fake moderation/achievement spam
DROP POLICY IF EXISTS "Users can create valid notifications" ON public.notifications;
CREATE POLICY "Users can create valid notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  (auth.uid() = from_user_id)
  AND (type = ANY (ARRAY['like','comment','friend_request','friend_accepted','message','mention','story_view']))
  AND (user_id <> from_user_id)
  AND (
    ((type = ANY (ARRAY['like','comment','mention'])) AND post_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.posts p WHERE p.id = notifications.post_id AND p.user_id = notifications.user_id
    ))
    OR ((type = ANY (ARRAY['friend_request','friend_accepted'])) AND EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE ((f.requester_id = auth.uid() AND f.addressee_id = notifications.user_id)
          OR (f.addressee_id = auth.uid() AND f.requester_id = notifications.user_id))
    ))
    OR ((type = 'message') AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE ((c.participant_1 = auth.uid() AND c.participant_2 = notifications.user_id)
          OR (c.participant_2 = auth.uid() AND c.participant_1 = notifications.user_id))
    ))
    OR ((type = 'story_view') AND EXISTS (
      SELECT 1 FROM public.story_views sv
      JOIN public.stories s ON s.id = sv.story_id
      WHERE sv.user_id = auth.uid() AND s.user_id = notifications.user_id
    ))
  )
);

-- 3) Groups: explicit authenticated role
DROP POLICY IF EXISTS "Authenticated users can create groups" ON public.groups;
CREATE POLICY "Authenticated users can create groups"
ON public.groups FOR INSERT TO authenticated
WITH CHECK (auth.uid() = owner_id);

-- 4) group_members: only join public groups; owners can add to any group
DROP POLICY IF EXISTS "Users can join groups" ON public.group_members;
CREATE POLICY "Users can join public groups"
ON public.group_members FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    public.is_group_public(group_id)
    OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.owner_id = auth.uid())
  )
);

-- 5) Remove ability to self-award achievements directly
DROP POLICY IF EXISTS "System can insert user achievements" ON public.user_achievements;

-- 6) Lock down anon EXECUTE on all SECURITY DEFINER functions
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon, public', r.proname, r.args);
  END LOOP;
END$$;