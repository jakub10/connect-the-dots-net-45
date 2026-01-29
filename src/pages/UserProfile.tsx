import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Sidebar } from '@/components/social/Sidebar';
import { RightSidebar } from '@/components/social/RightSidebar';
import { MobileNav } from '@/components/social/MobileNav';
import { MobileHeader } from '@/components/social/MobileHeader';
import { PostCard } from '@/components/social/PostCard';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Loader2, MapPin, Link as LinkIcon, Calendar, MessageCircle, UserPlus, UserCheck } from 'lucide-react';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [friendshipStatus, setFriendshipStatus] = useState<'none' | 'pending' | 'accepted'>('none');
  const [postsCount, setPostsCount] = useState(0);
  const [friendsCount, setFriendsCount] = useState(0);

  useEffect(() => {
    if (userId) {
      fetchProfile();
      fetchCurrentProfile();
      checkFriendship();
    }
  }, [userId, user]);

  const fetchCurrentProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('user_id, username, full_name, avatar_url, bio, location, website, created_at')
      .eq('user_id', user.id)
      .maybeSingle();
    setCurrentProfile(data);
  };

  const checkFriendship = async () => {
    if (!user || !userId || user.id === userId) return;
    
    const { data } = await supabase
      .from('friendships')
      .select('status')
      .or(`and(requester_id.eq.${user.id},addressee_id.eq.${userId}),and(requester_id.eq.${userId},addressee_id.eq.${user.id})`)
      .maybeSingle();
    
    if (data) {
      setFriendshipStatus(data.status as 'pending' | 'accepted');
    } else {
      setFriendshipStatus('none');
    }
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
    const { data: postsData, count } = await supabase
      .from('posts')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    setPostsCount(count || 0);

    // Fetch friends count
    const { count: friendsTotal } = await supabase
      .from('friendships')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'accepted')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

    setFriendsCount(friendsTotal || 0);

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

  const sendFriendRequest = async () => {
    if (!user || !profile) return;

    const { error } = await supabase
      .from('friendships')
      .insert({
        requester_id: user.id,
        addressee_id: profile.user_id,
        status: 'pending',
      });

    if (!error) {
      setFriendshipStatus('pending');
      toast({
        title: 'Žádost odeslána',
        description: `Žádost o přátelství byla odeslána uživateli ${profile.full_name}.`,
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader currentProfile={currentProfile} />
        <Sidebar currentProfile={currentProfile} />
        <main className="pt-16 pb-20 md:pt-6 md:pb-6 md:ml-64 lg:mr-80 px-4 md:px-8">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </main>
        <RightSidebar />
        <MobileNav />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader currentProfile={currentProfile} />
        <Sidebar currentProfile={currentProfile} />
        <main className="pt-16 pb-20 md:pt-6 md:pb-6 md:ml-64 lg:mr-80 px-4 md:px-8">
          <div className="max-w-2xl mx-auto text-center py-12">
            <p className="text-muted-foreground">Uživatel nenalezen</p>
          </div>
        </main>
        <RightSidebar />
        <MobileNav />
      </div>
    );
  }

  const isOwnProfile = user?.id === profile.user_id;

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader currentProfile={currentProfile} />
      <Sidebar currentProfile={currentProfile} />
      
      <main className="pt-16 pb-20 md:pt-6 md:pb-6 md:ml-64 lg:mr-80 px-4 md:px-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Profile Card */}
          <Card className="overflow-hidden">
            {/* Cover Image */}
            <div className="h-32 bg-gradient-to-r from-primary/20 via-primary/10 to-accent/20" />
            
            <CardHeader className="relative pt-0">
              {/* Avatar */}
              <div className="absolute -top-16 left-6">
                <Avatar className="h-32 w-32 border-4 border-background shadow-lg">
                  <AvatarImage src={profile.avatar_url || ''} />
                  <AvatarFallback className="text-4xl bg-primary/10">
                    {profile.full_name[0]}
                  </AvatarFallback>
                </Avatar>
              </div>

              {/* Action buttons */}
              <div className="flex justify-end gap-2 pt-2">
                {!isOwnProfile && user && (
                  <>
                    {friendshipStatus === 'none' && (
                      <Button variant="outline" size="sm" onClick={sendFriendRequest}>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Přidat přítele
                      </Button>
                    )}
                    {friendshipStatus === 'pending' && (
                      <Button variant="outline" size="sm" disabled>
                        <UserCheck className="h-4 w-4 mr-2" />
                        Žádost odeslána
                      </Button>
                    )}
                    {friendshipStatus === 'accepted' && (
                      <Button variant="outline" size="sm" disabled>
                        <UserCheck className="h-4 w-4 mr-2" />
                        Přátelé
                      </Button>
                    )}
                    <Button size="sm" onClick={startConversation}>
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Zpráva
                    </Button>
                  </>
                )}
                {isOwnProfile && (
                  <Button variant="outline" size="sm" onClick={() => navigate('/profile')}>
                    Upravit profil
                  </Button>
                )}
              </div>

              {/* Name and username */}
              <div className="mt-12">
                <h1 className="text-2xl font-bold">{profile.full_name}</h1>
                <p className="text-muted-foreground">@{profile.username}</p>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {profile.bio && (
                <p className="text-foreground leading-relaxed">{profile.bio}</p>
              )}
              
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {profile.location && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    <span>{profile.location}</span>
                  </div>
                )}
                {profile.website && (
                  <a
                    href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-primary hover:underline"
                  >
                    <LinkIcon className="h-4 w-4" />
                    <span>{profile.website.replace(/^https?:\/\//, '')}</span>
                  </a>
                )}
                {profile.created_at && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    <span>Členem od {format(new Date(profile.created_at), 'MMMM yyyy', { locale: cs })}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Stats Card */}
          <Card>
            <CardContent className="py-4">
              <div className="grid grid-cols-3 divide-x divide-border">
                <div className="text-center px-4">
                  <p className="text-2xl font-bold text-foreground">{postsCount}</p>
                  <p className="text-sm text-muted-foreground">Příspěvků</p>
                </div>
                <div className="text-center px-4">
                  <p className="text-2xl font-bold text-foreground">{friendsCount}</p>
                  <p className="text-sm text-muted-foreground">Přátel</p>
                </div>
                <div className="text-center px-4">
                  <p className="text-2xl font-bold text-foreground">0</p>
                  <p className="text-sm text-muted-foreground">Sledujících</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Posts */}
          <h2 className="text-xl font-semibold">Příspěvky</h2>
          
          {posts.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">
                  {isOwnProfile 
                    ? 'Zatím nemáte žádné příspěvky.' 
                    : 'Tento uživatel zatím nemá žádné příspěvky.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {posts.map(post => (
                <PostCard key={post.id} post={post} onLikeChange={fetchProfile} />
              ))}
            </div>
          )}
        </div>
      </main>

      <RightSidebar />
      <MobileNav />
    </div>
  );
};

export default UserProfile;
