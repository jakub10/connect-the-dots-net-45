-- Add background_style column for VIP users to customize their posts
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS background_style text DEFAULT NULL;

-- Update RLS policy for posts to allow creator to delete any post
DROP POLICY IF EXISTS "Users can delete their own posts" ON public.posts;

CREATE POLICY "Users can delete their own posts or creator" 
ON public.posts 
FOR DELETE 
USING (
  auth.uid() = user_id 
  OR public.has_role(auth.uid(), 'creator')
);

-- Create function for creator to delete any post
CREATE OR REPLACE FUNCTION public.creator_delete_post(_post_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _image_url text;
BEGIN
  -- Check if caller is creator
  IF NOT public.has_role(auth.uid(), 'creator') THEN
    RAISE EXCEPTION 'Only creators can use this function';
  END IF;
  
  -- Get image URL before deleting
  SELECT image_url INTO _image_url FROM public.posts WHERE id = _post_id;
  
  -- Delete the post
  DELETE FROM public.posts WHERE id = _post_id;
  
  RETURN FOUND;
END;
$$;

-- Create function for creator to ban user (insert into banned_users table)
CREATE TABLE IF NOT EXISTS public.banned_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  banned_by uuid NOT NULL,
  reason text,
  banned_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.banned_users ENABLE ROW LEVEL SECURITY;

-- Only creators can view banned users
CREATE POLICY "Only creators can view banned users" 
ON public.banned_users 
FOR SELECT 
USING (public.has_role(auth.uid(), 'creator'));

-- Only creators can ban users
CREATE POLICY "Only creators can ban users" 
ON public.banned_users 
FOR INSERT 
WITH CHECK (public.has_role(auth.uid(), 'creator'));

-- Only creators can unban
CREATE POLICY "Only creators can unban users" 
ON public.banned_users 
FOR DELETE 
USING (public.has_role(auth.uid(), 'creator'));

-- Function for creator to ban a user
CREATE OR REPLACE FUNCTION public.creator_ban_user(_user_id uuid, _reason text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if caller is creator
  IF NOT public.has_role(auth.uid(), 'creator') THEN
    RAISE EXCEPTION 'Only creators can ban users';
  END IF;
  
  -- Don't allow banning yourself or other creators
  IF _user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot ban yourself';
  END IF;
  
  IF public.has_role(_user_id, 'creator') THEN
    RAISE EXCEPTION 'Cannot ban another creator';
  END IF;
  
  -- Insert into banned_users
  INSERT INTO public.banned_users (user_id, banned_by, reason)
  VALUES (_user_id, auth.uid(), _reason)
  ON CONFLICT (user_id) DO UPDATE SET 
    banned_by = auth.uid(),
    reason = COALESCE(_reason, banned_users.reason),
    banned_at = now();
  
  RETURN true;
END;
$$;

-- Function to check if user is banned
CREATE OR REPLACE FUNCTION public.is_user_banned(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.banned_users WHERE user_id = _user_id
  )
$$;