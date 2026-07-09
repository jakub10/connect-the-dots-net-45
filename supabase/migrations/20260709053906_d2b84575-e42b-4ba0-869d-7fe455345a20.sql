REVOKE ALL ON FUNCTION public.create_activation_code(public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_activation_code(public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_activation_code(public.app_role) TO authenticated;