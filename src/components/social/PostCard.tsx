import { useState, forwardRef } from 'react';
import { Heart, MessageCircle, Share2, Bookmark, MoreHorizontal } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import { cs } from 'date-fns/locale';

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

export const PostCard = forwardRef<HTMLDivElement, PostCardProps>(
  function PostCard({ post, onLikeChange }, ref) {
    const [isLiked, setIsLiked] = useState(post.is_liked || false);
    const [likesCount, setLikesCount] = useState(post.likes_count || 0);
    const [isAnimating, setIsAnimating] = useState(false);
    const { user } = useAuth();

    const handleLike = async () => {
      if (!user) return;

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

    const timeAgo = formatDistanceToNow(new Date(post.created_at), {
      addSuffix: true,
      locale: cs,
    });

    return (
      <div ref={ref} className="bg-card rounded-xl border border-border p-4 post-card animate-fadeIn">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
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
          </div>
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
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
              <MessageCircle className="h-5 w-5" />
              <span>{post.comments_count || 0}</span>
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <Share2 className="h-5 w-5" />
            </Button>
          </div>
          <Button variant="ghost" size="icon" className="text-muted-foreground">
            <Bookmark className="h-5 w-5" />
          </Button>
        </div>
      </div>
    );
  }
);
