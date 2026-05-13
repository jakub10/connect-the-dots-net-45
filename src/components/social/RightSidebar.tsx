import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const suggestedUsers = [
  { id: '1', username: 'emma_wilson', full_name: 'Emma Wilson', avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=emma', mutualFriends: 5 },
  { id: '2', username: 'david_chen', full_name: 'David Chen', avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=david', mutualFriends: 3 },
  { id: '3', username: 'sara_miller', full_name: 'Sara Miller', avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sara', mutualFriends: 8 },
];

const trendingTopics = [
  { id: '1', tag: '#TechNews', posts: '12.5K' },
  { id: '2', tag: '#ReactJS', posts: '8.2K' },
  { id: '3', tag: '#Design', posts: '5.7K' },
  { id: '4', tag: '#Startup', posts: '4.1K' },
];

export function RightSidebar() {
  return (
    <aside className="hidden lg:block fixed right-0 top-0 h-screen w-80 bg-card border-l border-border p-4 overflow-y-auto">
      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Hledat..."
          className="pl-10 bg-secondary border-0"
        />
      </div>

      {/* Suggested Users */}
      <div className="bg-secondary rounded-xl p-4 mb-4">
        <h3 className="font-semibold mb-4">Návrhy přátel</h3>
        <div className="space-y-4">
          {suggestedUsers.map((user) => (
            <div key={user.id} className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={user.avatar_url} />
                <AvatarFallback>{user.full_name?.[0]?.toUpperCase() || "U"}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{user.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  {user.mutualFriends} společných přátel
                </p>
              </div>
              <Button size="sm" variant="outline">
                Sledovat
              </Button>
            </div>
          ))}
        </div>
        <Button variant="ghost" className="w-full mt-4 text-primary">
          Zobrazit více
        </Button>
      </div>

      {/* Trending */}
      <div className="bg-secondary rounded-xl p-4">
        <h3 className="font-semibold mb-4">Populární témata</h3>
        <div className="space-y-3">
          {trendingTopics.map((topic) => (
            <div
              key={topic.id}
              className="flex items-center justify-between cursor-pointer hover:bg-accent/50 -mx-2 px-2 py-2 rounded-lg transition-colors"
            >
              <span className="font-medium text-primary">{topic.tag}</span>
              <span className="text-sm text-muted-foreground">{topic.posts} příspěvků</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 text-xs text-muted-foreground">
        <p>© 2024 Kamosféra</p>
        <p className="mt-1">Podmínky · Soukromí · Cookies</p>
      </div>
    </aside>
  );
}
