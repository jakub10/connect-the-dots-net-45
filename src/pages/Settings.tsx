import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Sidebar } from '@/components/social/Sidebar';
import { RightSidebar } from '@/components/social/RightSidebar';
import { MobileNav } from '@/components/social/MobileNav';
import { MobileHeader } from '@/components/social/MobileHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Bell, Moon, Shield, LogOut, Lock, Bot } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { AvatarBuilder } from '@/components/profile/AvatarBuilder';

interface Profile {
  username: string;
  full_name: string;
  avatar_url: string | null;
}

const Settings = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [notifications, setNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return false;
  });
  const [privateAccount, setPrivateAccount] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [chatbotApiKey, setChatbotApiKey] = useState('');
  const [savingApiKey, setSavingApiKey] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('username, full_name, avatar_url')
        .eq('user_id', user.id)
        .maybeSingle();
      setCurrentProfile(data);
    };
    fetchProfile();
  }, [user]);

  // Handle dark mode toggle
  const handleDarkModeChange = (enabled: boolean) => {
    setDarkMode(enabled);
    if (enabled) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  // Initialize dark mode from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
      setDarkMode(true);
    } else if (savedTheme === 'light') {
      document.documentElement.classList.remove('dark');
      setDarkMode(false);
    }
  }, []);

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: 'Odhlášeno',
      description: 'Byl jsi úspěšně odhlášen.',
    });
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: 'Chyba',
        description: 'Hesla se neshodují.',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: 'Chyba',
        description: 'Heslo musí mít alespoň 6 znaků.',
        variant: 'destructive',
      });
      return;
    }

    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    
    if (error) {
      toast({
        title: 'Chyba',
        description: 'Nepodařilo se změnit heslo.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Úspěch',
        description: 'Heslo bylo změněno.',
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
    setChangingPassword(false);
  };

  const handleSaveApiKey = async () => {
    if (!chatbotApiKey.trim()) {
      toast({
        title: 'Chyba',
        description: 'API klíč nemůže být prázdný.',
        variant: 'destructive',
      });
      return;
    }

    setSavingApiKey(true);
    // Uložíme API klíč do localStorage (v budoucnu lze přesunout do Supabase)
    localStorage.setItem('chatbot_api_key', chatbotApiKey);
    
    toast({
      title: 'Úspěch',
      description: 'API klíč chatbota byl uložen.',
    });
    setSavingApiKey(false);
  };

  // Načtení API klíče při startu
  useEffect(() => {
    const savedApiKey = localStorage.getItem('chatbot_api_key');
    if (savedApiKey) {
      setChatbotApiKey(savedApiKey);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader currentProfile={currentProfile} />
      <Sidebar currentProfile={currentProfile} />
      
      <main className="pt-16 pb-20 md:pt-6 md:pb-6 md:ml-64 lg:mr-80 px-4 md:px-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <h1 className="text-3xl font-bold">Nastavení</h1>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Oznámení
              </CardTitle>
              <CardDescription>Spravuj své preference oznámení</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="push-notifications">Push oznámení</Label>
                  <p className="text-sm text-muted-foreground">Dostávat oznámení na telefon</p>
                </div>
                <Switch
                  id="push-notifications"
                  checked={notifications}
                  onCheckedChange={setNotifications}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="email-notifications">E-mailová oznámení</Label>
                  <p className="text-sm text-muted-foreground">Dostávat oznámení na e-mail</p>
                </div>
                <Switch
                  id="email-notifications"
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                />
              </div>
            </CardContent>
          </Card>

          {/* Avatar Builder */}
          <AvatarBuilder />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Moon className="h-5 w-5" />
                Vzhled
              </CardTitle>
              <CardDescription>Přizpůsob si vzhled aplikace</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="dark-mode">Tmavý režim</Label>
                <Switch
                  id="dark-mode"
                  checked={darkMode}
                  onCheckedChange={handleDarkModeChange}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Soukromí
              </CardTitle>
              <CardDescription>Nastav si úroveň soukromí</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="private-account">Soukromý účet</Label>
                <Switch
                  id="private-account"
                  checked={privateAccount}
                  onCheckedChange={setPrivateAccount}
                />
              </div>
            </CardContent>
          </Card>

          {/* Password Change */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Změna hesla
              </CardTitle>
              <CardDescription>Aktualizuj své přístupové heslo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">Nové heslo</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Zadej nové heslo"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Potvrzení hesla</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Zopakuj nové heslo"
                />
              </div>
              <Button 
                onClick={handleChangePassword} 
                disabled={changingPassword || !newPassword || !confirmPassword}
              >
                {changingPassword ? 'Měním heslo...' : 'Změnit heslo'}
              </Button>
            </CardContent>
          </Card>

          {/* Chatbot API */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                Chatbot API
              </CardTitle>
              <CardDescription>Nastav API klíč pro chatbota</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="chatbot-api">API klíč</Label>
                <Input
                  id="chatbot-api"
                  type="password"
                  value={chatbotApiKey}
                  onChange={(e) => setChatbotApiKey(e.target.value)}
                  placeholder="Zadej API klíč chatbota"
                />
                <p className="text-xs text-muted-foreground">
                  Zadej API klíč pro aktivaci chatbota v aplikaci
                </p>
              </div>
              <Button 
                onClick={handleSaveApiKey} 
                disabled={savingApiKey || !chatbotApiKey.trim()}
              >
                {savingApiKey ? 'Ukládám...' : 'Uložit API klíč'}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <LogOut className="h-5 w-5" />
                Odhlášení
              </CardTitle>
              <CardDescription>Odhlásit se z účtu</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Odhlásit se
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>

      <RightSidebar />
      <MobileNav />
    </div>
  );
};

export default Settings;
