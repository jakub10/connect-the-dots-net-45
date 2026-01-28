-- Create achievements definition table
CREATE TABLE public.achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL,
  category text NOT NULL, -- 'posts', 'likes', 'comments', 'friends', 'messages'
  threshold integer NOT NULL,
  points integer NOT NULL DEFAULT 10,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create user achievements table
CREATE TABLE public.user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  achievement_id uuid NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);

-- Create user stats table for tracking progress
CREATE TABLE public.user_stats (
  user_id uuid PRIMARY KEY,
  posts_count integer NOT NULL DEFAULT 0,
  likes_received integer NOT NULL DEFAULT 0,
  likes_given integer NOT NULL DEFAULT 0,
  comments_count integer NOT NULL DEFAULT 0,
  friends_count integer NOT NULL DEFAULT 0,
  messages_sent integer NOT NULL DEFAULT 0,
  total_points integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add avatar customization to profiles
ALTER TABLE public.profiles 
ADD COLUMN avatar_config jsonb DEFAULT '{"seed": "", "hair": "short01", "hairColor": "6c4545", "skinColor": "f2d3b1", "eyes": "variant01", "mouth": "happy01", "clothing": "shirt01", "clothingColor": "6dbb58"}';

-- Enable RLS
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

-- Achievements are viewable by everyone
CREATE POLICY "Achievements are viewable by everyone" 
ON public.achievements FOR SELECT USING (true);

-- User achievements policies
CREATE POLICY "User achievements are viewable by everyone" 
ON public.user_achievements FOR SELECT USING (true);

CREATE POLICY "System can insert user achievements" 
ON public.user_achievements FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- User stats policies
CREATE POLICY "User stats are viewable by everyone" 
ON public.user_stats FOR SELECT USING (true);

CREATE POLICY "Users can insert their stats" 
ON public.user_stats FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their stats" 
ON public.user_stats FOR UPDATE 
USING (auth.uid() = user_id);

-- Insert default achievements
INSERT INTO public.achievements (name, description, icon, category, threshold, points) VALUES
-- Posts achievements
('První příspěvek', 'Publikoval jsi svůj první příspěvek!', '📝', 'posts', 1, 10),
('Aktivní pisatel', 'Publikoval jsi 10 příspěvků', '✍️', 'posts', 10, 25),
('Blogger', 'Publikoval jsi 50 příspěvků', '📰', 'posts', 50, 50),
('Influencer', 'Publikoval jsi 100 příspěvků', '🌟', 'posts', 100, 100),
('Legenda', 'Publikoval jsi 500 příspěvků', '👑', 'posts', 500, 250),

-- Likes given achievements
('První like', 'Dal jsi svůj první like', '👍', 'likes', 1, 5),
('Podporovatel', 'Dal jsi 50 liků', '❤️', 'likes', 50, 25),
('Fanoušek', 'Dal jsi 200 liků', '💕', 'likes', 200, 50),

-- Comments achievements
('První komentář', 'Napsal jsi svůj první komentář', '💬', 'comments', 1, 10),
('Diskutér', 'Napsal jsi 25 komentářů', '🗣️', 'comments', 25, 25),
('Komunikátor', 'Napsal jsi 100 komentářů', '📢', 'comments', 100, 75),

-- Friends achievements
('První přítel', 'Získal jsi prvního přítele', '🤝', 'friends', 1, 15),
('Společenský', 'Máš 10 přátel', '👥', 'friends', 10, 30),
('Populární', 'Máš 50 přátel', '🎉', 'friends', 50, 75),
('Celebrita', 'Máš 100 přátel', '⭐', 'friends', 100, 150),

-- Messages achievements
('První zpráva', 'Poslal jsi svou první zprávu', '✉️', 'messages', 1, 5),
('Konverzační', 'Poslal jsi 50 zpráv', '💌', 'messages', 50, 25),
('Chatovač', 'Poslal jsi 500 zpráv', '📱', 'messages', 500, 75);

-- Function to update user stats and check achievements
CREATE OR REPLACE FUNCTION public.update_user_stats_on_post()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_stats (user_id, posts_count)
  VALUES (NEW.user_id, 1)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    posts_count = user_stats.posts_count + 1,
    updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_user_stats_on_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update likes_given for the user who liked
  INSERT INTO public.user_stats (user_id, likes_given)
  VALUES (NEW.user_id, 1)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    likes_given = user_stats.likes_given + 1,
    updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_user_stats_on_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_stats (user_id, comments_count)
  VALUES (NEW.user_id, 1)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    comments_count = user_stats.comments_count + 1,
    updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_user_stats_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_stats (user_id, messages_sent)
  VALUES (NEW.sender_id, 1)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    messages_sent = user_stats.messages_sent + 1,
    updated_at = now();
  RETURN NEW;
END;
$$;

-- Create triggers
CREATE TRIGGER on_post_created
  AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.update_user_stats_on_post();

CREATE TRIGGER on_like_created
  AFTER INSERT ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.update_user_stats_on_like();

CREATE TRIGGER on_comment_created
  AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.update_user_stats_on_comment();

CREATE TRIGGER on_message_sent
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.update_user_stats_on_message();