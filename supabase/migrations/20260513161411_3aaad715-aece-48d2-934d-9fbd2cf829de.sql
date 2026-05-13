
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) FROM authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_group_public(uuid) FROM authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_user_banned(uuid) FROM authenticated, public;
REVOKE EXECUTE ON FUNCTION public.creator_delete_post(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.creator_ban_user(uuid, text) FROM anon, public;
