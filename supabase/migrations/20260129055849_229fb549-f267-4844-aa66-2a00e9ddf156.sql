-- Drop the existing public SELECT policy on stories
DROP POLICY IF EXISTS "Stories are viewable by everyone" ON public.stories;

-- Create new SELECT policy that requires authentication
CREATE POLICY "Stories are viewable by authenticated users"
ON public.stories
FOR SELECT
TO authenticated
USING (true);