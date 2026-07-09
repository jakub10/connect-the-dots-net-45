CREATE OR REPLACE FUNCTION public.create_activation_code(_role public.app_role)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _uid uuid := auth.uid();
  _code text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.has_role(_uid, 'creator') THEN
    RAISE EXCEPTION 'Only creators can generate codes';
  END IF;
  IF _role NOT IN ('vip','vip_pro_max') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  LOOP
    _code := upper(substring(regexp_replace(encode(extensions.gen_random_bytes(18), 'base64'), '[^A-Za-z0-9]', '', 'g'), 1, 12));
    EXIT WHEN length(_code) = 12 AND NOT EXISTS (
      SELECT 1 FROM public.activation_codes WHERE code = _code
    );
  END LOOP;

  INSERT INTO public.activation_codes (code, role, created_by)
  VALUES (_code, _role, _uid);

  RETURN _code;
END;
$$;

REVOKE ALL ON FUNCTION public.create_activation_code(public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_activation_code(public.app_role) TO authenticated;