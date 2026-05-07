import { Home, Search, MessageCircle, User, Users } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export function MobileNav() {
  const location = useLocation();
  const { t } = useTranslation();

  const navItems = [
    { icon: Home, label: t('nav.home'), path: '/' },
    { icon: Search, label: t('nav.search'), path: '/search' },
    { icon: Users, label: t('nav.groups'), path: '/groups' },
    { icon: MessageCircle, label: t('nav.messages'), path: '/messages' },
    { icon: User, label: t('nav.profile'), path: '/profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-sm border-t border-border md:hidden safe-area-bottom">
      <div className="flex justify-around items-center h-16 pb-safe">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full gap-1 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-xs">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
