import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Sidebar } from '@/components/social/Sidebar';
import { RightSidebar } from '@/components/social/RightSidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, MapPin, Link as LinkIcon, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';

interface Profile {
  username: string;
  full_name: string;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  created_at: string;
}

const Profile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Edit form state
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [website, setWebsite] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('username, full_name, avatar_url, bio, location, website, created_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        setProfile(data);
        setFullName(data.full_name || '');
        setBio(data.bio || '');
        setLocation(data.location || '');
        setWebsite(data.website || '');
      }
      setLoading(false);
    };

    fetchProfile();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        bio,
        location,
        website,
      })
      .eq('user_id', user.id);

    if (error) {
      toast({
        title: 'Chyba',
        description: 'Nepodařilo se uložit změny.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Uloženo',
        description: 'Profil byl aktualizován.',
      });
      setProfile(prev => prev ? { ...prev, full_name: fullName, bio, location, website } : null);
      setIsEditing(false);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Sidebar currentProfile={profile} />
        <main className="ml-64 mr-80 py-6 px-8">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </main>
        <RightSidebar />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar currentProfile={profile} />
      
      <main className="ml-64 mr-80 py-6 px-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader className="flex flex-row items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={profile?.avatar_url || ''} />
                <AvatarFallback className="text-2xl">{profile?.full_name?.[0] || 'U'}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <CardTitle className="text-2xl">{profile?.full_name}</CardTitle>
                <p className="text-muted-foreground">@{profile?.username}</p>
              </div>
              {!isEditing && (
                <Button onClick={() => setIsEditing(true)}>Upravit profil</Button>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              {isEditing ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Celé jméno</Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea
                      id="bio"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Napiš něco o sobě..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Lokace</Label>
                    <Input
                      id="location"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Praha, Česká republika"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="website">Web</Label>
                    <Input
                      id="website"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://example.com"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSave} disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                      Uložit
                    </Button>
                    <Button variant="outline" onClick={() => setIsEditing(false)}>
                      Zrušit
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {profile?.bio && (
                    <p className="text-foreground">{profile.bio}</p>
                  )}
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    {profile?.location && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {profile.location}
                      </div>
                    )}
                    {profile?.website && (
                      <a
                        href={profile.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        <LinkIcon className="h-4 w-4" />
                        {profile.website}
                      </a>
                    )}
                    {profile?.created_at && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        Členem od {format(new Date(profile.created_at), 'MMMM yyyy', { locale: cs })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <RightSidebar />
    </div>
  );
};

export default Profile;
