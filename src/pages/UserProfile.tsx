import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Sidebar } from '@/components/social/Sidebar';
import { RightSidebar } from '@/components/social/RightSidebar';
import { PostCard } from '@/components/social/PostCard';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Loader2, MapPin, Link as LinkIcon, Calendar, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface Profile {
  user_id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  created_at: string;
}

interface Post {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  profile?: {
    username: string;
    full_name: string;
    avatar_url: string | null;
  };
  likes_count?: number;
  comments_count?: number;
  is_liked?: boolean;
}

const UserProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);

  useEffect(() => {
    fetchProfile();
    fetchCurrentProfile();
  }, [userId]);

  const fetchCurrentProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('user_id, username, full_name, avatar_url, bio, location, website, created_at')
      .eq('user_id', user.id)
      .maybeSingle();
    setCurrentProfile(data);
  };

  const fetchProfile = async () => {
    if (!userId) return;

    const { data: profileData, error } = await supabase
      .from('profiles')
      .select('user_id, username, full_name, avatar_url, bio, location, website, created_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !profileData) {
      setLoading(false);
      return;
    }

    setProfile(profileData);

    // Fetch user's posts
    const { data: postsData } = await supabase
      .from('posts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (postsData && postsData.length > 0) {
      const postIds = postsData.map(p => p.id);

      // Fetch likes counts
      const { data: likesData } = await supabase
        .from('likes')
        .select('post_id')
        .in('post_id', postIds);

      const likesCountMap = new Map<string, number>();
      likesData?.forEach(like => {
        likesCountMap.set(like.post_id, (likesCountMap.get(like.post_id) || 0) + 1);
      });

      // Check user likes
      let userLikesSet = new Set<string>();
      if (user) {
        const { data: userLikes } = await supabase
          .from('likes')
          .select('post_id')
          .eq('user_id', user.id);
        userLikesSet = new Set(userLikes?.map(l => l.post_id) || []);
      }

      // Fetch comments counts
      const { data: commentsData } = await supabase
        .from('comments')
        .select('post_id')
        .in('post_id', postIds);

      const commentsCountMap = new Map<string, number>();
      commentsData?.forEach(comment => {
        commentsCountMap.set(comment.post_id, (commentsCountMap.get(comment.post_id) || 0) + 1);
      });

      const enrichedPosts: Post[] = postsData.map(post => ({
        ...post,
        profile: {
          username: profileData.username,
          full_name: profileData.full_name,
          avatar_url: profileData.avatar_url,
        },
        likes_count: likesCountMap.get(post.id) || 0,
        comments_count: commentsCountMap.get(post.id) || 0,
        is_liked: userLikesSet.has(post.id),
      }));

      setPosts(enrichedPosts);
    }

    setLoading(false);
  };

  const startConversation = async () => {
    if (!user || !profile) return;

    // Check if conversation exists
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .or(`and(participant_1.eq.${user.id},participant_2.eq.${profile.user_id}),and(participant_1.eq.${profile.user_id},participant_2.eq.${user.id})`)
      .maybeSingle();

    if (existing) {
      navigate('/messages');
    } else {
      // Create new conversation
      await supabase
        .from('conversations')
        .insert({
          participant_1: user.id,
          participant_2: profile.user_id,
        });
      navigate('/messages');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Sidebar currentProfile={currentProfile} />
        <main className="ml-64 mr-80 py-6 px-8">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </main>
        <RightSidebar />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background">
        <Sidebar currentProfile={currentProfile} />
        <main className="ml-64 mr-80 py-6 px-8">
          <div className="max-w-2xl mx-auto text-center py-12">
            <p className="text-muted-foreground">Uživatel nenalezen</p>
          </div>
        </main>
        <RightSidebar />
      </div>
    );
  }

  const isOwnProfile = user?.id === profile.user_id;

  return (
    <div className="min-h-screen bg-background">
      <Sidebar currentProfile={currentProfile} />
      
      <main className="ml-64 mr-80 py-6 px-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={profile.avatar_url || ''} />
                <AvatarFallback className="text-2xl">{profile.full_name[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h1 className="text-2xl font-bold">{profile.full_name}</h1>
                <p className="text-muted-foreground">@{profile.username}</p>
              </div>
              {!isOwnProfile && user && (
                <Button onClick={startConversation}>
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Zpráva
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {profile.bio && (
                <p className="text-foreground">{profile.bio}</p>
              )}
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {profile.location && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {profile.location}
                  </div>
                )}
                {profile.website && (
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
                {profile.created_at && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Členem od {format(new Date(profile.created_at), 'MMMM yyyy', { locale: cs })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <h2 className="text-xl font-semibold">Příspěvky</h2>
          
          {posts.length === 0 ? (
            <div className="bg-card rounded-xl border border-border p-8 text-center">
              <p className="text-muted-foreground">
                Tento uživatel zatím nemá žádné příspěvky.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map(post => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>
      </main>

      <RightSidebar />
    </div>
  );
};

export default UserProfile;
