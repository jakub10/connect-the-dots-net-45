
CREATE TABLE public.activation_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  role public.app_role NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.activation_codes TO authenticated;
GRANT ALL ON public.activation_codes TO service_role;

ALTER TABLE public.activation_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creators can view codes"
  ON public.activation_codes FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'creator'));

CREATE POLICY "Creators can delete codes"
  ON public.activation_codes FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'creator'));

-- Note: INSERT only via SECURITY DEFINER RPC below; no INSERT policy.

CREATE OR REPLACE FUNCTION public.create_activation_code(_role public.app_role)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- 12-char uppercase alphanumeric, easy to read
  _code := upper(substring(replace(encode(gen_random_bytes(12), 'base64'), '/', '') || replace(encode(gen_random_bytes(6),'base64'),'+',''), 1, 12));

  INSERT INTO public.activation_codes (code, role, created_by)
  VALUES (_code, _role, _uid);

  RETURN _code;
END;
$$;

REVOKE ALL ON FUNCTION public.create_activation_code(public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_activation_code(public.app_role) TO authenticated;
