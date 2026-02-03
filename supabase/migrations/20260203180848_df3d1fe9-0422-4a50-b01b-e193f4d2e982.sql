-- Create security definer function to check group membership
CREATE OR REPLACE FUNCTION public.is_group_member(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members
    WHERE user_id = _user_id
      AND group_id = _group_id
  )
$$;

-- Create function to check if group is public
CREATE OR REPLACE FUNCTION public.is_group_public(_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.groups
    WHERE id = _group_id
      AND NOT is_private
  )
$$;

-- Fix the groups SELECT policy
DROP POLICY IF EXISTS "Anyone can view public groups" ON public.groups;

CREATE POLICY "Anyone can view public groups" 
ON public.groups 
FOR SELECT 
USING (
  (NOT is_private) 
  OR (auth.uid() = owner_id) 
  OR public.is_group_member(auth.uid(), id)
);

-- Fix the group_members SELECT policy - remove recursion
DROP POLICY IF EXISTS "Members can view group members" ON public.group_members;

CREATE POLICY "Members can view group members" 
ON public.group_members 
FOR SELECT 
USING (
  public.is_group_member(auth.uid(), group_id)
  OR public.is_group_public(group_id)
);

-- Fix the group_messages SELECT policy
DROP POLICY IF EXISTS "Members can view group messages" ON public.group_messages;

CREATE POLICY "Members can view group messages" 
ON public.group_messages 
FOR SELECT 
USING (public.is_group_member(auth.uid(), group_id));

-- Fix the group_messages INSERT policy
DROP POLICY IF EXISTS "Members can send group messages" ON public.group_messages;

CREATE POLICY "Members can send group messages" 
ON public.group_messages 
FOR INSERT 
WITH CHECK (
  auth.uid() = sender_id 
  AND public.is_group_member(auth.uid(), group_id)
);