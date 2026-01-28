import { useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { StoryUpload } from './StoryUpload';
import { StoryViewer } from './StoryViewer';

interface Story {
  id: string;
  user_id: string;
  image_url: string;
  created_at: string;
  expires_at: string;
  profile?: {
    username: string;
    full_name: string;
    avatar_url: string | null;
  };
}

interface UserStoryGroup {
  user_id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  stories: Story[];
  hasUnseenStory: boolean;
}

export function Stories() {
  const [storyGroups, setStoryGroups] = useState<UserStoryGroup[]>([]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedStories, setSelectedStories] = useState<Story[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { user } = useAuth();

  const fetchStories = async () => {
    try {
      // Fetch active stories (not expired)
      const { data: storiesData, error: storiesError } = await supabase
        .from('stories')
        .select('*')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (storiesError) throw storiesError;

      if (!storiesData || storiesData.length === 0) {
        setStoryGroups([]);
        return;
      }

      // Get unique user IDs
      const userIds = [...new Set(storiesData.map((s) => s.user_id))];

      // Fetch profiles
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, username, full_name, avatar_url')
        .in('user_id', userIds);

      const profilesMap = new Map(
        profilesData?.map((p) => [p.user_id, p]) || []
      );

      // Fetch viewed stories for current user
      let viewedStoryIds = new Set<string>();
      if (user) {
        const { data: viewsData } = await supabase
          .from('story_views')
          .select('story_id')
          .eq('user_id', user.id);
        viewedStoryIds = new Set(viewsData?.map((v) => v.story_id) || []);
      }

      // Group stories by user
      const groupedStories = new Map<string, UserStoryGroup>();
      
      storiesData.forEach((story) => {
        const profile = profilesMap.get(story.user_id);
        const storyWithProfile: Story = {
          ...story,
          profile: profile ? {
            username: profile.username,
            full_name: profile.full_name,
            avatar_url: profile.avatar_url,
          } : undefined,
        };

        if (!groupedStories.has(story.user_id)) {
          groupedStories.set(story.user_id, {
            user_id: story.user_id,
            username: profile?.username || 'unknown',
            full_name: profile?.full_name || 'Unknown',
            avatar_url: profile?.avatar_url || null,
            stories: [],
            hasUnseenStory: false,
          });
        }

        const group = groupedStories.get(story.user_id)!;
        group.stories.push(storyWithProfile);
        
        if (!viewedStoryIds.has(story.id)) {
          group.hasUnseenStory = true;
        }
      });

      setStoryGroups(Array.from(groupedStories.values()));
    } catch (error) {
      console.error('Error fetching stories:', error);
    }
  };

  useEffect(() => {
    fetchStories();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('stories-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stories' },
        () => {
          fetchStories();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const openStoryViewer = (group: UserStoryGroup) => {
    setSelectedStories(group.stories);
    setSelectedIndex(0);
    setViewerOpen(true);
  };

  return (
    <>
      <div className="bg-card rounded-xl border border-border p-4 mb-4">
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-4">
            {/* Add story button */}
            {user && <StoryUpload onStoryCreated={fetchStories} />}

            {/* User stories */}
            {storyGroups.map((group) => (
              <div
                key={group.user_id}
                className="flex flex-col items-center gap-1 cursor-pointer"
                onClick={() => openStoryViewer(group)}
              >
                <div className={group.hasUnseenStory ? 'story-ring' : 'story-ring-seen'}>
                  <Avatar className="h-14 w-14 border-2 border-card">
                    <AvatarImage src={group.avatar_url || ''} />
                    <AvatarFallback>{group.username[0]?.toUpperCase() || 'U'}</AvatarFallback>
                  </Avatar>
                </div>
                <span className="text-xs text-muted-foreground truncate max-w-16">
                  {group.username}
                </span>
              </div>
            ))}

            {storyGroups.length === 0 && !user && (
              <p className="text-sm text-muted-foreground py-4">
                Přihlaš se pro zobrazení příběhů
              </p>
            )}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* Story viewer modal */}
      {viewerOpen && selectedStories.length > 0 && (
        <StoryViewer
          stories={selectedStories}
          initialIndex={selectedIndex}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </>
  );
}
