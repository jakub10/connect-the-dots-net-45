-- Restrict game_scores: drop overly permissive read policy, add scoped policies
DROP POLICY IF EXISTS "Users can view all game scores" ON public.game_scores;

CREATE POLICY "Users can view their own game scores"
ON public.game_scores
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view top 10 leaderboard scores"
ON public.game_scores
FOR SELECT
USING (
  id IN (
    SELECT id FROM (
      SELECT id,
             row_number() OVER (PARTITION BY game_type ORDER BY score DESC, created_at ASC) AS rn
      FROM public.game_scores
    ) ranked
    WHERE rn <= 10
  )
);

-- Allow users to edit their own group messages
CREATE POLICY "Users can update their own group messages"
ON public.group_messages
FOR UPDATE
USING (auth.uid() = sender_id AND public.is_group_member(auth.uid(), group_id))
WITH CHECK (auth.uid() = sender_id);
