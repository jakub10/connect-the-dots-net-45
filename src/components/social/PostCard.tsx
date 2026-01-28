import { useState } from 'react';
import { Heart, MessageCircle, Share2, Bookmark, MoreHorizontal, Send, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { cs } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PostCardProps {
  post: {
    id: string;
    content: string;
    image_url: string | null;
    created_at: string;
    user_id: string;
    profile?: {
      username: string;
      full_name: string;
      avatar_url: string | null;
    };
    likes_count?: number;
    comments_count?: number;
    is_liked?: boolean;
  };
  onLikeChange?: () => void;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profile?: {
    username: string;
    full_name: string;
    avatar_url: string | null;
  };
}

export function PostCard({ post, onLikeChange }: PostCardProps) {
  const [isLiked, setIsLiked] = useState(post.is_liked || false);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentsCount, setCommentsCount] = useState(post.comments_count || 0);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleLike = async () => {
    if (!user) {
      toast({
        title: 'Přihlášení vyžadováno',
        description: 'Pro lajkování se musíš přihlásit.',
        variant: 'destructive',
      });
      return;
    }

    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 600);

    if (isLiked) {
      setIsLiked(false);
      setLikesCount((prev) => prev - 1);
      await supabase
        .from('likes')
        .delete()
        .eq('post_id', post.id)
        .eq('user_id', user.id);
    } else {
      setIsLiked(true);
      setLikesCount((prev) => prev + 1);
      await supabase
        .from('likes')
        .insert({ post_id: post.id, user_id: user.id });
    }
    onLikeChange?.();
  };

  const handleSave = async () => {
    if (!user) {
      toast({
        title: 'Přihlášení vyžadováno',
        description: 'Pro ukládání příspěvků se musíš přihlásit.',
        variant: 'destructive',
      });
      return;
    }

    if (isSaved) {
      setIsSaved(false);
      await supabase
        .from('saved_posts')
        .delete()
        .eq('post_id', post.id)
        .eq('user_id', user.id);
      toast({
        title: 'Odebráno',
        description: 'Příspěvek byl odebrán z uložených.',
      });
    } else {
      setIsSaved(true);
      await supabase
        .from('saved_posts')
        .insert({ post_id: post.id, user_id: user.id });
      toast({
        title: 'Uloženo',
        description: 'Příspěvek byl uložen do záložek.',
      });
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin + `/post/${post.id}`);
      toast({
        title: 'Odkaz zkopírován',
        description: 'Odkaz na příspěvek byl zkopírován do schránky.',
      });
    } catch {
      toast({
        title: 'Chyba',
        description: 'Nepodařilo se zkopírovat odkaz.',
        variant: 'destructive',
      });
    }
  };

  const fetchComments = async () => {
    setLoadingComments(true);
    const { data: commentsData, error } = await supabase
      .from('comments')
      .select('*')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true });

    if (error || !commentsData) {
      setComments([]);
      setLoadingComments(false);
      return;
    }

    // Fetch profiles for comments
    const userIds = [...new Set(commentsData.map(c => c.user_id))];
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('user_id, username, full_name, avatar_url')
      .in('user_id', userIds);

    const profilesMap = new Map(
      profilesData?.map(p => [p.user_id, p]) || []
    );

    const enrichedComments = commentsData.map(comment => ({
      ...comment,
      profile: profilesMap.get(comment.user_id),
    }));

    setComments(enrichedComments);
    setLoadingComments(false);
  };

  const openComments = () => {
    setShowComments(true);
    fetchComments();
  };

  const submitComment = async () => {
    if (!newComment.trim() || !user) return;

    const { data, error } = await supabase
      .from('comments')
      .insert({
        post_id: post.id,
        user_id: user.id,
        content: newComment.trim(),
      })
      .select()
      .single();

    if (!error && data) {
      // Fetch the profile for the new comment
      const { data: profileData } = await supabase
        .from('profiles')
        .select('user_id, username, full_name, avatar_url')
        .eq('user_id', user.id)
        .single();

      setComments(prev => [...prev, { ...data, profile: profileData }]);
      setCommentsCount(prev => prev + 1);
      setNewComment('');
      toast({
        title: 'Komentář přidán',
        description: 'Tvůj komentář byl publikován.',
      });
    }
  };

  const timeAgo = formatDistanceToNow(new Date(post.created_at), {
    addSuffix: true,
    locale: cs,
  });

  // Check if post is saved on mount
  useState(() => {
    const checkSaved = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('saved_posts')
        .select('id')
        .eq('post_id', post.id)
        .eq('user_id', user.id)
        .maybeSingle();
      setIsSaved(!!data);
    };
    checkSaved();
  });

  return (
    <>
      <article className="bg-card rounded-xl border border-border p-4 post-card animate-fadeIn">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <Link to={`/profile/${post.user_id}`} className="flex items-center gap-3 hover:opacity-80">
            <Avatar className="h-10 w-10">
              <AvatarImage src={post.profile?.avatar_url || ''} />
              <AvatarFallback>{post.profile?.full_name?.[0] || 'U'}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">{post.profile?.full_name || 'Uživatel'}</p>
              <p className="text-sm text-muted-foreground">
                @{post.profile?.username || 'user'} · {timeAgo}
              </p>
            </div>
          </Link>
          <Button variant="ghost" size="icon" className="text-muted-foreground">
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <p className="text-foreground mb-3 whitespace-pre-wrap">{post.content}</p>

        {/* Image */}
        {post.image_url && (
          <div className="rounded-xl overflow-hidden mb-3">
            <img
              src={post.image_url}
              alt="Post image"
              className="w-full h-auto object-cover"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLike}
              className={`gap-2 like-button ${isLiked ? 'liked' : 'text-muted-foreground'} ${isAnimating ? 'animate-heartBeat' : ''}`}
            >
              <Heart className={`h-5 w-5 ${isLiked ? 'fill-current' : ''}`} />
              <span>{likesCount}</span>
            </Button>
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={openComments}>
              <MessageCircle className="h-5 w-5" />
              <span>{commentsCount}</span>
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={handleShare}>
              <Share2 className="h-5 w-5" />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className={isSaved ? 'text-primary' : 'text-muted-foreground'}
            onClick={handleSave}
          >
            <Bookmark className={`h-5 w-5 ${isSaved ? 'fill-current' : ''}`} />
          </Button>
        </div>
      </article>

      {/* Comments Dialog */}
      <Dialog open={showComments} onOpenChange={setShowComments}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Komentáře</DialogTitle>
            <DialogDescription>
              {commentsCount} komentářů k tomuto příspěvku
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-4 py-4">
              {loadingComments ? (
                <p className="text-center text-muted-foreground">Načítání...</p>
              ) : comments.length === 0 ? (
                <p className="text-center text-muted-foreground">Zatím žádné komentáře</p>
              ) : (
                comments.map(comment => (
                  <div key={comment.id} className="flex gap-3">
                    <Link to={`/profile/${comment.user_id}`}>
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={comment.profile?.avatar_url || ''} />
                        <AvatarFallback>{comment.profile?.full_name?.[0] || 'U'}</AvatarFallback>
                      </Avatar>
                    </Link>
                    <div className="flex-1">
                      <div className="bg-muted rounded-lg p-3">
                        <Link to={`/profile/${comment.user_id}`} className="font-medium hover:underline">
                          {comment.profile?.full_name || 'Uživatel'}
                        </Link>
                        <p className="text-sm mt-1">{comment.content}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: cs })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {user && (
            <div className="flex gap-2 pt-4 border-t border-border">
              <Input
                placeholder="Napiš komentář..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && submitComment()}
              />
              <Button onClick={submitComment} disabled={!newComment.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
