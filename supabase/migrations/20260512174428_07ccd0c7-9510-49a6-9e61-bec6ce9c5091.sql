CREATE OR REPLACE FUNCTION public.update_user_stats_on_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_stats (user_id, posts_count)
  VALUES (NEW.user_id, 1)
  ON CONFLICT (user_id)
  DO UPDATE SET
    posts_count = public.user_stats.posts_count + 1,
    updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_user_stats_on_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_owner uuid;
BEGIN
  INSERT INTO public.user_stats (user_id, likes_given)
  VALUES (NEW.user_id, 1)
  ON CONFLICT (user_id)
  DO UPDATE SET
    likes_given = public.user_stats.likes_given + 1,
    updated_at = now();

  SELECT user_id INTO post_owner
  FROM public.posts
  WHERE id = NEW.post_id;

  IF post_owner IS NOT NULL AND post_owner <> NEW.user_id THEN
    INSERT INTO public.user_stats (user_id, likes_received)
    VALUES (post_owner, 1)
    ON CONFLICT (user_id)
    DO UPDATE SET
      likes_received = public.user_stats.likes_received + 1,
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_user_stats_on_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_stats (user_id, comments_count)
  VALUES (NEW.user_id, 1)
  ON CONFLICT (user_id)
  DO UPDATE SET
    comments_count = public.user_stats.comments_count + 1,
    updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_user_stats_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_stats (user_id, messages_sent)
  VALUES (NEW.sender_id, 1)
  ON CONFLICT (user_id)
  DO UPDATE SET
    messages_sent = public.user_stats.messages_sent + 1,
    updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_user_stats_on_friendship_accepted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status <> 'accepted' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'accepted' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.user_stats (user_id, friends_count)
  VALUES (NEW.requester_id, 1)
  ON CONFLICT (user_id)
  DO UPDATE SET
    friends_count = public.user_stats.friends_count + 1,
    updated_at = now();

  INSERT INTO public.user_stats (user_id, friends_count)
  VALUES (NEW.addressee_id, 1)
  ON CONFLICT (user_id)
  DO UPDATE SET
    friends_count = public.user_stats.friends_count + 1,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_post_created ON public.posts;
CREATE TRIGGER on_post_created
  AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.update_user_stats_on_post();

DROP TRIGGER IF EXISTS on_like_created ON public.likes;
CREATE TRIGGER on_like_created
  AFTER INSERT ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.update_user_stats_on_like();

DROP TRIGGER IF EXISTS on_comment_created ON public.comments;
CREATE TRIGGER on_comment_created
  AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.update_user_stats_on_comment();

DROP TRIGGER IF EXISTS on_message_sent ON public.messages;
CREATE TRIGGER on_message_sent
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.update_user_stats_on_message();

DROP TRIGGER IF EXISTS on_friendship_accepted ON public.friendships;
CREATE TRIGGER on_friendship_accepted
  AFTER INSERT OR UPDATE OF status ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.update_user_stats_on_friendship_accepted();

WITH all_users AS (
  SELECT user_id FROM public.profiles
  UNION SELECT user_id FROM public.posts
  UNION SELECT user_id FROM public.likes
  UNION SELECT user_id FROM public.comments
  UNION SELECT sender_id AS user_id FROM public.messages
  UNION SELECT requester_id AS user_id FROM public.friendships
  UNION SELECT addressee_id AS user_id FROM public.friendships
), calculated AS (
  SELECT
    u.user_id,
    COALESCE((SELECT count(*) FROM public.posts p WHERE p.user_id = u.user_id), 0)::integer AS posts_count,
    COALESCE((SELECT count(*) FROM public.likes l WHERE l.user_id = u.user_id), 0)::integer AS likes_given,
    COALESCE((
      SELECT count(*)
      FROM public.likes l
      JOIN public.posts p ON p.id = l.post_id
      WHERE p.user_id = u.user_id AND l.user_id <> u.user_id
    ), 0)::integer AS likes_received,
    COALESCE((SELECT count(*) FROM public.comments c WHERE c.user_id = u.user_id), 0)::integer AS comments_count,
    COALESCE((SELECT count(*) FROM public.messages m WHERE m.sender_id = u.user_id), 0)::integer AS messages_sent,
    COALESCE((
      SELECT count(*)
      FROM public.friendships f
      WHERE f.status = 'accepted'
        AND (f.requester_id = u.user_id OR f.addressee_id = u.user_id)
    ), 0)::integer AS friends_count
  FROM all_users u
)
INSERT INTO public.user_stats (
  user_id,
  posts_count,
  likes_received,
  likes_given,
  comments_count,
  friends_count,
  messages_sent,
  total_points,
  updated_at
)
SELECT
  user_id,
  posts_count,
  likes_received,
  likes_given,
  comments_count,
  friends_count,
  messages_sent,
  0,
  now()
FROM calculated
ON CONFLICT (user_id)
DO UPDATE SET
  posts_count = EXCLUDED.posts_count,
  likes_received = EXCLUDED.likes_received,
  likes_given = EXCLUDED.likes_given,
  comments_count = EXCLUDED.comments_count,
  friends_count = EXCLUDED.friends_count,
  messages_sent = EXCLUDED.messages_sent,
  updated_at = now();