
-- Fix overly permissive messages SELECT
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;
CREATE POLICY "Users can view messages in their conversations"
ON public.messages FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.conversations c
  WHERE c.id = messages.conversation_id
    AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
));

-- Tighten realtime.messages topic policy: drop broad public topics, allow per-user topic
DROP POLICY IF EXISTS "Users can subscribe to their own realtime topics" ON realtime.messages;
CREATE POLICY "Users can subscribe to their own realtime topics"
ON realtime.messages FOR SELECT
TO authenticated
USING (
  realtime.topic() = ('user:' || (SELECT auth.uid())::text)
  OR realtime.topic() = (SELECT auth.uid())::text
  OR EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE ('conversation:' || c.id::text) = realtime.topic()
      AND (c.participant_1 = (SELECT auth.uid()) OR c.participant_2 = (SELECT auth.uid()))
  )
  OR EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE ('group:' || gm.group_id::text) = realtime.topic()
      AND gm.user_id = (SELECT auth.uid())
  )
);

-- Restrict user_stats to owner
DROP POLICY IF EXISTS "Authenticated users can view user stats" ON public.user_stats;
CREATE POLICY "Users can view their own stats"
ON public.user_stats FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Restrict user_game_stats to owner
DROP POLICY IF EXISTS "Authenticated users can view game stats" ON public.user_game_stats;
CREATE POLICY "Users can view their own game stats"
ON public.user_game_stats FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Restrict user_achievements to owner
DROP POLICY IF EXISTS "Authenticated users can view achievements" ON public.user_achievements;
CREATE POLICY "Users can view their own achievements"
ON public.user_achievements FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Restrict user_presence to owner (drops typing_in leak)
DROP POLICY IF EXISTS "Authenticated users can view presence" ON public.user_presence;
CREATE POLICY "Users can view their own presence"
ON public.user_presence FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Revoke EXECUTE on remaining SECURITY DEFINER helpers from authenticated
REVOKE EXECUTE ON FUNCTION public.creator_delete_post(uuid) FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.creator_ban_user(uuid, text) FROM authenticated, anon;
-- Re-grant to authenticated only (these check has_role internally)
GRANT EXECUTE ON FUNCTION public.creator_delete_post(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.creator_ban_user(uuid, text) TO authenticated;
