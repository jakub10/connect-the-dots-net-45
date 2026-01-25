import { Home, Search, Bell, MessageCircle, Bookmark, User, Settings, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface SidebarProps {
  currentProfile?: {
    username: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
}

const navItems = [
  { icon: Home, label: 'Domů', path: '/' },
  { icon: Search, label: 'Hledat', path: '/search' },
  { icon: Bell, label: 'Oznámení', path: '/notifications' },
  { icon: MessageCircle, label: 'Zprávy', path: '/messages' },
  { icon: Bookmark, label: 'Uloženo', path: '/saved' },
  { icon: User, label: 'Profil', path: '/profile' },
  { icon: Settings, label: 'Nastavení', path: '/settings' },
];

export function Sidebar({ currentProfile }: SidebarProps) {
  const { signOut } = useAuth();

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-card border-r border-border flex flex-col">
      {/* Logo */}
      <div className="p-6">
        <h1 className="text-2xl font-bold gradient-text">SocialConnect</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3">
        {navItems.map((item) => (
          <Button
            key={item.path}
            variant="ghost"
            className="w-full justify-start gap-4 mb-1 text-base font-medium hover:bg-accent"
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </Button>
        ))}
      </nav>

      {/* User Profile */}
      {currentProfile && (
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={currentProfile.avatar_url || ''} />
              <AvatarFallback>{currentProfile.full_name[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{currentProfile.full_name}</p>
              <p className="text-sm text-muted-foreground truncate">@{currentProfile.username}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </aside>
  );
}
