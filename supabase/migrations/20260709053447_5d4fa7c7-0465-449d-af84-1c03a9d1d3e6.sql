GRANT SELECT, INSERT, DELETE ON public.activation_codes TO authenticated;
GRANT ALL ON public.activation_codes TO service_role;
GRANT EXECUTE ON FUNCTION public.create_activation_code(app_role) TO authenticated;