CREATE OR REPLACE FUNCTION public.check_user_achievements(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stats_row public.user_stats%ROWTYPE;
  new_points integer;
BEGIN
  IF _user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO stats_row
  FROM public.user_stats
  WHERE user_id = _user_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  INSERT INTO public.user_achievements (user_id, achievement_id)
  SELECT _user_id, a.id
  FROM public.achievements a
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.user_achievements ua
    WHERE ua.user_id = _user_id
      AND ua.achievement_id = a.id
  )
  AND CASE a.category
    WHEN 'posts' THEN stats_row.posts_count >= a.threshold
    WHEN 'likes' THEN stats_row.likes_given >= a.threshold
    WHEN 'comments' THEN stats_row.comments_count >= a.threshold
    WHEN 'friends' THEN stats_row.friends_count >= a.threshold
    WHEN 'messages' THEN stats_row.messages_sent >= a.threshold
    ELSE false
  END
  ON CONFLICT (user_id, achievement_id) DO NOTHING;

  SELECT COALESCE(sum(a.points), 0)::integer INTO new_points
  FROM public.user_achievements ua
  JOIN public.achievements a ON a.id = ua.achievement_id
  WHERE ua.user_id = _user_id;

  IF COALESCE(stats_row.total_points, 0) <> new_points THEN
    UPDATE public.user_stats
    SET total_points = new_points,
        updated_at = now()
    WHERE user_id = _user_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_achievements_on_stats_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.check_user_achievements(NEW.user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_user_stats_changed_check_achievements ON public.user_stats;
CREATE TRIGGER on_user_stats_changed_check_achievements
  AFTER INSERT OR UPDATE OF posts_count, likes_given, comments_count, friends_count, messages_sent ON public.user_stats
  FOR EACH ROW EXECUTE FUNCTION public.check_achievements_on_stats_change();

DO $$
DECLARE
  stats_user uuid;
BEGIN
  FOR stats_user IN SELECT user_id FROM public.user_stats LOOP
    PERFORM public.check_user_achievements(stats_user);
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_user_stats_on_post() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_user_stats_on_like() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_user_stats_on_comment() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_user_stats_on_message() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_user_stats_on_friendship_accepted() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.check_user_achievements(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.check_achievements_on_stats_change() FROM PUBLIC, anon;