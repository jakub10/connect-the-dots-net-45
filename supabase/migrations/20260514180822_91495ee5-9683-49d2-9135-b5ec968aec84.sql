ALTER PUBLICATION supabase_realtime ADD TABLE public.user_unlocked_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_stats;
ALTER TABLE public.user_unlocked_items REPLICA IDENTITY FULL;
ALTER TABLE public.user_stats REPLICA IDENTITY FULL;