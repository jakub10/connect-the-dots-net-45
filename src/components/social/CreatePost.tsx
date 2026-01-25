import { useState } from 'react';
import { Image, Smile, MapPin, Send } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface CreatePostProps {
  onPostCreated?: () => void;
  currentProfile?: {
    avatar_url: string | null;
    full_name: string;
  } | null;
}

export function CreatePost({ onPostCreated, currentProfile }: CreatePostProps) {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!content.trim() || !user) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          content: content.trim(),
        });

      if (error) throw error;

      setContent('');
      toast({
        title: 'Úspěch!',
        description: 'Příspěvek byl publikován.',
      });
      onPostCreated?.();
    } catch (error) {
      toast({
        title: 'Chyba',
        description: 'Nepodařilo se publikovat příspěvek.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border p-4 mb-4 animate-fadeIn">
      <div className="flex gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={currentProfile?.avatar_url || ''} />
          <AvatarFallback>{currentProfile?.full_name?.[0] || 'U'}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <Textarea
            placeholder="Co máš na mysli?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[80px] resize-none border-0 bg-transparent focus-visible:ring-0 text-base placeholder:text-muted-foreground"
          />
          <div className="flex items-center justify-between pt-3 border-t border-border">
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary">
                <Image className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary">
                <Smile className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary">
                <MapPin className="h-5 w-5" />
              </Button>
            </div>
            <Button
              onClick={handleSubmit}
              disabled={!content.trim() || isSubmitting}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              Publikovat
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
