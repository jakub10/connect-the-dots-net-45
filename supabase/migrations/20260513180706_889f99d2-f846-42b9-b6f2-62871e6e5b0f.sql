
-- 1) VIP items price catalog -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vip_items (
  item_id text PRIMARY KEY,
  item_type text NOT NULL CHECK (item_type IN ('background','emoji')),
  price integer NOT NULL CHECK (price >= 0)
);

ALTER TABLE public.vip_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view vip items"
  ON public.vip_items FOR SELECT
  USING (true);

-- Seed paid items (only items with cost > 0). Idempotent.
INSERT INTO public.vip_items(item_id, item_type, price) VALUES
  ('gradient-galaxy','background',50),
  ('gradient-aurora','background',50),
  ('pattern-hearts','background',25),
  ('animated-gradient','background',100),
  ('animated-pulse','background',100),
  ('animated-shimmer','background',150),
  ('animated-rainbow','background',200),
  ('animated-wave','background',150),
  ('rainbow','emoji',25),
  ('unicorn','emoji',25),
  ('butterfly','emoji',25),
  ('heart-fire','emoji',50),
  ('crystal-ball','emoji',50),
  ('shooting-star','emoji',50),
  ('confetti','emoji',25),
  ('trophy','emoji',75),
  ('medal','emoji',75),
  ('nerd','emoji',25),
  ('angel','emoji',50),
  ('alien','emoji',75),
  ('robot','emoji',75),
  ('cat-heart','emoji',50),
  ('dragon','emoji',100),
  ('phoenix','emoji',150),
  ('pizza','emoji',25),
  ('ice-cream','emoji',25),
  ('rainbow-flag','emoji',100)
ON CONFLICT (item_id) DO UPDATE SET price = EXCLUDED.price, item_type = EXCLUDED.item_type;

-- Replace purchase function to use authoritative price + VIP discount
CREATE OR REPLACE FUNCTION public.purchase_vip_item(_item_id text, _item_type text, _cost integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _balance integer;
  _price integer;
  _row_type text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _item_id IS NULL OR length(_item_id) = 0 OR length(_item_id) > 200 THEN
    RAISE EXCEPTION 'Invalid item';
  END IF;
  IF _item_type NOT IN ('background','emoji') THEN
    RAISE EXCEPTION 'Invalid item type';
  END IF;

  -- Authoritative price lookup
  SELECT price, item_type INTO _price, _row_type
  FROM public.vip_items
  WHERE item_id = _item_id;

  IF _price IS NULL THEN
    RAISE EXCEPTION 'Unknown item';
  END IF;
  IF _row_type <> _item_type THEN
    RAISE EXCEPTION 'Item type mismatch';
  END IF;

  -- VIP role gets 50% discount (rounded up)
  IF public.has_role(_uid, 'vip') THEN
    _price := (_price + 1) / 2;
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_unlocked_items WHERE user_id = _uid AND item_id = _item_id) THEN
    RETURN jsonb_build_object('ok', true, 'already_owned', true);
  END IF;

  SELECT total_points INTO _balance
  FROM public.user_stats WHERE user_id = _uid FOR UPDATE;

  IF _balance IS NULL THEN
    RAISE EXCEPTION 'No stats record';
  END IF;
  IF _balance < _price THEN
    RAISE EXCEPTION 'Insufficient points';
  END IF;

  UPDATE public.user_stats
  SET total_points = total_points - _price, updated_at = now()
  WHERE user_id = _uid;

  INSERT INTO public.user_unlocked_items (user_id, item_id, item_type)
  VALUES (_uid, _item_id, _item_type);

  RETURN jsonb_build_object('ok', true, 'new_balance', _balance - _price, 'charged', _price);
END;
$$;

REVOKE ALL ON FUNCTION public.purchase_vip_item(text,text,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_vip_item(text,text,integer) TO authenticated;

-- 2) Server-side game score submission ---------------------------------------
CREATE OR REPLACE FUNCTION public.submit_game_score(_game_type text, _score integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _max integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _score IS NULL OR _score < 0 THEN RAISE EXCEPTION 'Invalid score'; END IF;

  _max := CASE _game_type
    WHEN 'snake' THEN 10000
    WHEN 'memory' THEN 10000
    WHEN 'tower_defense' THEN 1000000
    WHEN 'clicker' THEN 1000000000
    ELSE NULL
  END;
  IF _max IS NULL THEN RAISE EXCEPTION 'Unknown game type'; END IF;
  IF _score > _max THEN RAISE EXCEPTION 'Score exceeds limit'; END IF;

  INSERT INTO public.game_scores (user_id, game_type, score)
  VALUES (_uid, _game_type, _score);

  INSERT INTO public.user_game_stats (user_id, snake_best, memory_best, tower_defense_best, clicker_best)
  VALUES (
    _uid,
    CASE WHEN _game_type='snake' THEN _score ELSE 0 END,
    CASE WHEN _game_type='memory' THEN _score ELSE 0 END,
    CASE WHEN _game_type='tower_defense' THEN _score ELSE 0 END,
    CASE WHEN _game_type='clicker' THEN _score ELSE 0 END
  )
  ON CONFLICT (user_id) DO UPDATE SET
    snake_best = GREATEST(user_game_stats.snake_best, EXCLUDED.snake_best),
    memory_best = GREATEST(user_game_stats.memory_best, EXCLUDED.memory_best),
    tower_defense_best = GREATEST(user_game_stats.tower_defense_best, EXCLUDED.tower_defense_best),
    clicker_best = GREATEST(user_game_stats.clicker_best, EXCLUDED.clicker_best),
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.submit_game_score(text,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_game_score(text,integer) TO authenticated;

-- Lock down direct client writes to scores tables
DROP POLICY IF EXISTS "Users can insert their own scores" ON public.game_scores;
DROP POLICY IF EXISTS "Users can insert their game stats" ON public.user_game_stats;
DROP POLICY IF EXISTS "Users can update their game stats" ON public.user_game_stats;

-- 3) Realtime WS one-time tickets --------------------------------------------
CREATE TABLE IF NOT EXISTS public.realtime_ws_tickets (
  ticket uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '60 seconds'),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.realtime_ws_tickets ENABLE ROW LEVEL SECURITY;
-- No client-facing policies; only SECURITY DEFINER functions / service role touch this.

CREATE OR REPLACE FUNCTION public.create_realtime_ws_ticket()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _ticket uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  -- Cleanup expired
  DELETE FROM public.realtime_ws_tickets WHERE expires_at < now();
  INSERT INTO public.realtime_ws_tickets(user_id) VALUES (_uid)
  RETURNING ticket INTO _ticket;
  RETURN _ticket;
END;
$$;
REVOKE ALL ON FUNCTION public.create_realtime_ws_ticket() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_realtime_ws_ticket() TO authenticated;

-- 4) Storage: drop duplicate public-role UPDATE policy on avatars
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
