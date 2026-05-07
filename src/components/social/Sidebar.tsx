import { Home, Search, Bell, MessageCircle, Bookmark, User, Settings, LogOut, Users } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import logo from '@/assets/logo.jpg';

interface SidebarProps {
  currentProfile?: {
    username: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
}

export function Sidebar({ currentProfile }: SidebarProps) {
  const { signOut } = useAuth();
  const location = useLocation();
  const { t } = useTranslation();

  const navItems = [
    { icon: Home, label: t('nav.home'), path: '/' },
    { icon: Search, label: t('nav.search'), path: '/search' },
    { icon: Bell, label: t('nav.notifications'), path: '/notifications' },
    { icon: MessageCircle, label: t('nav.messages'), path: '/messages' },
    { icon: Users, label: t('nav.groups'), path: '/groups' },
    { icon: Bookmark, label: t('nav.saved'), path: '/saved' },
    { icon: User, label: t('nav.profile'), path: '/profile' },
    { icon: Settings, label: t('nav.settings'), path: '/settings' },
  ];

  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-screen w-64 bg-card border-r border-border flex-col">
      <div className="p-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <img src={logo} alt="Kamosféra" className="h-10 w-10 rounded-xl" />
          <h1 className="text-xl font-bold gradient-text">Kamosféra</h1>
        </Link>
        <LanguageSwitcher />
      </div>

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
            <Button variant="ghost" size="icon" onClick={signOut} title={t('nav.logout')}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </aside>
  );
}
