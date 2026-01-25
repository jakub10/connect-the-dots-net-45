import { Plus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

interface Story {
  id: string;
  username: string;
  avatar_url: string;
  hasUnseenStory?: boolean;
}

const mockStories: Story[] = [
  { id: '1', username: 'anna_k', avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=anna', hasUnseenStory: true },
  { id: '2', username: 'martin', avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=martin', hasUnseenStory: true },
  { id: '3', username: 'petra', avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=petra', hasUnseenStory: true },
  { id: '4', username: 'jan_novak', avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=jan', hasUnseenStory: false },
  { id: '5', username: 'eva_h', avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=eva', hasUnseenStory: true },
  { id: '6', username: 'tomas', avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=tomas', hasUnseenStory: false },
];

export function Stories() {
  return (
    <div className="bg-card rounded-xl border border-border p-4 mb-4">
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-4">
          {/* Add story button */}
          <div className="flex flex-col items-center gap-1">
            <button className="relative w-16 h-16 rounded-full bg-accent flex items-center justify-center hover:bg-accent/80 transition-colors">
              <Plus className="h-6 w-6 text-primary" />
            </button>
            <span className="text-xs text-muted-foreground">Přidat</span>
          </div>

          {/* Stories */}
          {mockStories.map((story) => (
            <div key={story.id} className="flex flex-col items-center gap-1 cursor-pointer">
              <div className={story.hasUnseenStory ? 'story-ring' : 'story-ring-seen'}>
                <Avatar className="h-14 w-14 border-2 border-card">
                  <AvatarImage src={story.avatar_url} />
                  <AvatarFallback>{story.username[0].toUpperCase()}</AvatarFallback>
                </Avatar>
              </div>
              <span className="text-xs text-muted-foreground truncate max-w-16">{story.username}</span>
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
