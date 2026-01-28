import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export function useAchievements() {
  const { user } = useAuth();
  const { toast } = useToast();

  const checkAndUnlockAchievements = async () => {
    if (!user) return;

    try {
      // Get user stats
      const { data: stats } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!stats) return;

      // Get all achievements
      const { data: achievements } = await supabase
        .from('achievements')
        .select('*');

      if (!achievements) return;

      // Get already unlocked achievements
      const { data: unlockedAchievements } = await supabase
        .from('user_achievements')
        .select('achievement_id')
        .eq('user_id', user.id);

      const unlockedIds = new Set(unlockedAchievements?.map(ua => ua.achievement_id) || []);

      // Check each achievement
      for (const achievement of achievements) {
        if (unlockedIds.has(achievement.id)) continue;

        let currentProgress = 0;
        switch (achievement.category) {
          case 'posts':
            currentProgress = stats.posts_count;
            break;
          case 'likes':
            currentProgress = stats.likes_given;
            break;
          case 'comments':
            currentProgress = stats.comments_count;
            break;
          case 'friends':
            currentProgress = stats.friends_count;
            break;
          case 'messages':
            currentProgress = stats.messages_sent;
            break;
        }

        if (currentProgress >= achievement.threshold) {
          // Unlock achievement
          const { error } = await supabase
            .from('user_achievements')
            .insert({
              user_id: user.id,
              achievement_id: achievement.id,
            });

          if (!error) {
            // Show toast notification
            toast({
              title: `🎉 Achievement odemčen!`,
              description: `${achievement.icon} ${achievement.name} - +${achievement.points} bodů`,
            });

            // Update total points
            await supabase
              .from('user_stats')
              .update({ 
                total_points: stats.total_points + achievement.points 
              })
              .eq('user_id', user.id);
          }
        }
      }
    } catch (error) {
      console.error('Error checking achievements:', error);
    }
  };

  useEffect(() => {
    if (!user) return;

    // Check achievements on mount
    checkAndUnlockAchievements();

    // Subscribe to user_stats changes
    const channel = supabase
      .channel('user_stats_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_stats',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          checkAndUnlockAchievements();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return { checkAndUnlockAchievements };
}
