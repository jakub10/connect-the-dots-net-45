-- Fix the groups SELECT policy - there was a typo in the condition
DROP POLICY IF EXISTS "Anyone can view public groups" ON public.groups;

CREATE POLICY "Anyone can view public groups" 
ON public.groups 
FOR SELECT 
USING (
  (NOT is_private) 
  OR (auth.uid() = owner_id) 
  OR (EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = groups.id AND gm.user_id = auth.uid()
  ))
);