
-- 1) Validate premium item ownership on posts
CREATE OR REPLACE FUNCTION public.validate_post_premium_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := NEW.user_id;
  _token text;
  _is_premium_bg boolean;
BEGIN
  -- Background style: if it exists in vip_items as a paid background, require ownership
  IF NEW.background_style IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.vip_items
      WHERE item_id = NEW.background_style AND item_type = 'background' AND price > 0
    ) INTO _is_premium_bg;

    IF _is_premium_bg AND NOT EXISTS (
      SELECT 1 FROM public.user_unlocked_items
      WHERE user_id = _uid AND item_id = NEW.background_style
    ) THEN
      RAISE EXCEPTION 'Background not unlocked';
    END IF;
  END IF;

  -- Emoji tokens [img:xxx] in content
  IF NEW.content IS NOT NULL THEN
    FOR _token IN
      SELECT (regexp_matches(NEW.content, '\[img:([a-z0-9-]+)\]', 'g'))[1]
    LOOP
      IF EXISTS (
        SELECT 1 FROM public.vip_items
        WHERE item_id = _token AND item_type = 'emoji' AND price > 0
      ) AND NOT EXISTS (
        SELECT 1 FROM public.user_unlocked_items
        WHERE user_id = _uid AND item_id = _token
      ) THEN
        RAISE EXCEPTION 'Emoji % not unlocked', _token;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_post_premium_items_trg ON public.posts;
CREATE TRIGGER validate_post_premium_items_trg
BEFORE INSERT OR UPDATE ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.validate_post_premium_items();

-- 2) Tighten messages UPDATE policy: prevent sender_id / conversation_id tampering
DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;
CREATE POLICY "Users can update their own messages"
ON public.messages
FOR UPDATE
TO authenticated
USING (auth.uid() = sender_id)
WITH CHECK (
  auth.uid() = sender_id
);

-- Also lock immutable fields via trigger (defense in depth)
CREATE OR REPLACE FUNCTION public.lock_message_immutable_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.sender_id IS DISTINCT FROM OLD.sender_id THEN
    RAISE EXCEPTION 'sender_id is immutable';
  END IF;
  IF NEW.conversation_id IS DISTINCT FROM OLD.conversation_id THEN
    RAISE EXCEPTION 'conversation_id is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lock_message_immutable_fields_trg ON public.messages;
CREATE TRIGGER lock_message_immutable_fields_trg
BEFORE UPDATE ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.lock_message_immutable_fields();
