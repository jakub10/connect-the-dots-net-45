-- Add new role to enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'vip_pro_max';

-- Update purchase function so vip_pro_max gets everything free
CREATE OR REPLACE FUNCTION public.purchase_vip_item(_item_id text, _item_type text, _cost integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  SELECT price, item_type INTO _price, _row_type
  FROM public.vip_items
  WHERE item_id = _item_id;

  IF _price IS NULL THEN
    RAISE EXCEPTION 'Unknown item';
  END IF;
  IF _row_type <> _item_type THEN
    RAISE EXCEPTION 'Item type mismatch';
  END IF;

  -- VIP Pro Max: free
  IF public.has_role(_uid, 'vip_pro_max') THEN
    _price := 0;
  -- VIP: 50% discount
  ELSIF public.has_role(_uid, 'vip') THEN
    _price := (_price + 1) / 2;
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_unlocked_items WHERE user_id = _uid AND item_id = _item_id) THEN
    RETURN jsonb_build_object('ok', true, 'already_owned', true);
  END IF;

  IF _price > 0 THEN
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
  ELSE
    SELECT total_points INTO _balance FROM public.user_stats WHERE user_id = _uid;
    _balance := COALESCE(_balance, 0) + _price;
  END IF;

  INSERT INTO public.user_unlocked_items (user_id, item_id, item_type)
  VALUES (_uid, _item_id, _item_type);

  RETURN jsonb_build_object('ok', true, 'new_balance', _balance - _price, 'charged', _price);
END;
$function$;

-- Update privileged role check
CREATE OR REPLACE FUNCTION public.prevent_privileged_role_self_assign()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.role IN ('vip', 'creator', 'vip_pro_max') AND auth.uid() IS NOT NULL THEN
    IF current_setting('request.jwt.claim.role', true) = 'authenticated' THEN
      RAISE EXCEPTION 'Privileged role assignment must go through the activation function';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;