
-- 1. Unlocked items table
CREATE TABLE public.user_unlocked_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  item_id text NOT NULL,
  item_type text NOT NULL,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_id)
);

ALTER TABLE public.user_unlocked_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their unlocked items"
  ON public.user_unlocked_items FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies - only the SECURITY DEFINER RPC can write.

-- 2. Restrict user_stats writes - remove user-driven UPDATE policy
-- Stats are only mutated via SECURITY DEFINER triggers (post/like/comment/etc.) and the purchase RPC below.
DROP POLICY IF EXISTS "Users can update their stats" ON public.user_stats;
DROP POLICY IF EXISTS "Users can insert their stats" ON public.user_stats;

-- Add safety check: total_points must be non-negative
ALTER TABLE public.user_stats
  ADD CONSTRAINT user_stats_total_points_nonneg CHECK (total_points >= 0);

-- 3. Atomic purchase RPC
CREATE OR REPLACE FUNCTION public.purchase_vip_item(
  _item_id text,
  _item_type text,
  _cost integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _balance integer;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _cost IS NULL OR _cost < 0 THEN
    RAISE EXCEPTION 'Invalid cost';
  END IF;
  IF _item_id IS NULL OR length(_item_id) = 0 OR length(_item_id) > 200 THEN
    RAISE EXCEPTION 'Invalid item';
  END IF;
  IF _item_type NOT IN ('background', 'emoji') THEN
    RAISE EXCEPTION 'Invalid item type';
  END IF;

  -- Already owned?
  IF EXISTS (SELECT 1 FROM public.user_unlocked_items WHERE user_id = _uid AND item_id = _item_id) THEN
    RETURN jsonb_build_object('ok', true, 'already_owned', true);
  END IF;

  -- Lock stats row, check + deduct atomically
  SELECT total_points INTO _balance
  FROM public.user_stats
  WHERE user_id = _uid
  FOR UPDATE;

  IF _balance IS NULL THEN
    RAISE EXCEPTION 'No stats record';
  END IF;
  IF _balance < _cost THEN
    RAISE EXCEPTION 'Insufficient points';
  END IF;

  UPDATE public.user_stats
  SET total_points = total_points - _cost,
      updated_at = now()
  WHERE user_id = _uid;

  INSERT INTO public.user_unlocked_items (user_id, item_id, item_type)
  VALUES (_uid, _item_id, _item_type);

  RETURN jsonb_build_object('ok', true, 'new_balance', _balance - _cost);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purchase_vip_item(text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_vip_item(text, text, integer) TO authenticated;
