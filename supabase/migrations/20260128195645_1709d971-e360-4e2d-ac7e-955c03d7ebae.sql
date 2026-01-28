-- Fix security issue: Likes should only be viewable by authenticated users
DROP POLICY IF EXISTS "Likes are viewable by everyone" ON public.likes;

CREATE POLICY "Likes are viewable by authenticated users"
ON public.likes
FOR SELECT
TO authenticated
USING (true);

-- Add missing DELETE policy for conversations
CREATE POLICY "Users can delete their conversations"
ON public.conversations
FOR DELETE
TO authenticated
USING ((auth.uid() = participant_1) OR (auth.uid() = participant_2));