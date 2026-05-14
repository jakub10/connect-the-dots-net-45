
-- Fix mutable search_path on trigger function
ALTER FUNCTION public.lock_message_immutable_fields() SET search_path = 'public';

-- Revoke EXECUTE from anon on SECURITY DEFINER functions that should require auth
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_group_public(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_user_banned(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_user_achievements(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.creator_delete_post(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.creator_ban_user(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.submit_game_score(text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_realtime_ws_ticket() FROM anon;
REVOKE EXECUTE ON FUNCTION public.purchase_vip_item(text, text, integer) FROM anon;
