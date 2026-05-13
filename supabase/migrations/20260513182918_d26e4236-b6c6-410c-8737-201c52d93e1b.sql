
-- Posts
DROP POLICY IF EXISTS "Authenticated users can create posts" ON public.posts;
CREATE POLICY "Authenticated users can create posts" ON public.posts
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT public.is_user_banned(auth.uid()));

-- Comments
DROP POLICY IF EXISTS "Authenticated users can comment" ON public.comments;
CREATE POLICY "Authenticated users can comment" ON public.comments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT public.is_user_banned(auth.uid()));

-- Likes
DROP POLICY IF EXISTS "Authenticated users can like posts" ON public.likes;
CREATE POLICY "Authenticated users can like posts" ON public.likes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT public.is_user_banned(auth.uid()));

-- Stories
DROP POLICY IF EXISTS "Authenticated users can create stories" ON public.stories;
CREATE POLICY "Authenticated users can create stories" ON public.stories
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT public.is_user_banned(auth.uid()));

-- Direct messages
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
CREATE POLICY "Users can send messages" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND NOT public.is_user_banned(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
    )
  );

-- Group messages
DROP POLICY IF EXISTS "Members can send group messages" ON public.group_messages;
CREATE POLICY "Members can send group messages" ON public.group_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND NOT public.is_user_banned(auth.uid())
    AND public.is_group_member(auth.uid(), group_id)
  );
