import { Home, Search, Bell, MessageCircle, Bookmark, User, Settings, LogOut } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
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
  const location = useLocation();

  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-screen w-64 bg-card border-r border-border flex-col">
      {/* Logo */}
      <div className="p-6">
        <Link to="/">
          <h1 className="text-2xl font-bold gradient-text">SocialConnect</h1>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path}>
              <Button
                variant={isActive ? "secondary" : "ghost"}
                className={`w-full justify-start gap-4 mb-1 text-base font-medium hover:bg-accent ${
                  isActive ? 'bg-accent text-primary' : ''
                }`}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Button>
            </Link>
          );
        })}
      </nav>

      {/* User Profile */}
      {currentProfile && (
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3">
            <Link to="/profile">
              <Avatar className="h-10 w-10">
                <AvatarImage src={currentProfile.avatar_url || ''} />
                <AvatarFallback>{currentProfile.full_name[0]}</AvatarFallback>
              </Avatar>
            </Link>
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
