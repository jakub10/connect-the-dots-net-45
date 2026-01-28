import { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import { cs } from 'date-fns/locale';

interface Story {
  id: string;
  user_id: string;
  image_url: string;
  created_at: string;
  expires_at: string;
  profile?: {
    username: string;
    full_name: string;
    avatar_url: string | null;
  };
}

interface StoryViewerProps {
  stories: Story[];
  initialIndex: number;
  onClose: () => void;
}

export function StoryViewer({ stories, initialIndex, onClose }: StoryViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const { user } = useAuth();
  
  const currentStory = stories[currentIndex];
  const STORY_DURATION = 5000; // 5 seconds per story

  const markAsViewed = useCallback(async (storyId: string) => {
    if (!user) return;
    
    try {
      await supabase
        .from('story_views')
        .upsert({
          story_id: storyId,
          user_id: user.id,
        }, { onConflict: 'story_id,user_id' });
    } catch (error) {
      // Ignore errors for view tracking
    }
  }, [user]);

  const goToNext = useCallback(() => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setProgress(0);
    } else {
      onClose();
    }
  }, [currentIndex, stories.length, onClose]);

  const goToPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setProgress(0);
    }
  }, [currentIndex]);

  // Mark story as viewed when it loads
  useEffect(() => {
    if (currentStory && user) {
      markAsViewed(currentStory.id);
    }
  }, [currentStory, user, markAsViewed]);

  // Progress timer
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setProgress(prev => {
        const next = prev + (100 / (STORY_DURATION / 100));
        if (next >= 100) {
          goToNext();
          return 0;
        }
        return next;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isPaused, goToNext]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goToNext();
      if (e.key === 'ArrowLeft') goToPrev();
      if (e.key === 'Escape') onClose();
      if (e.key === ' ') {
        e.preventDefault();
        setIsPaused(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNext, goToPrev, onClose]);

  if (!currentStory) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      {/* Close button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 text-white hover:bg-white/20 z-50"
        onClick={onClose}
      >
        <X className="h-6 w-6" />
      </Button>

      {/* Navigation arrows */}
      {currentIndex > 0 && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 z-50"
          onClick={goToPrev}
        >
          <ChevronLeft className="h-8 w-8" />
        </Button>
      )}
      
      {currentIndex < stories.length - 1 && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 z-50"
          onClick={goToNext}
        >
          <ChevronRight className="h-8 w-8" />
        </Button>
      )}

      {/* Story content */}
      <div className="relative w-full max-w-lg h-full max-h-[90vh] flex flex-col">
        {/* Progress bars */}
        <div className="absolute top-0 left-0 right-0 p-2 flex gap-1 z-40">
          {stories.map((_, idx) => (
            <div key={idx} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-100"
                style={{
                  width: idx < currentIndex ? '100%' : idx === currentIndex ? `${progress}%` : '0%',
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-6 left-0 right-0 p-4 flex items-center gap-3 z-40">
          <Avatar className="h-10 w-10 border-2 border-white">
            <AvatarImage src={currentStory.profile?.avatar_url || ''} />
            <AvatarFallback>{currentStory.profile?.username?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="text-white font-medium">{currentStory.profile?.full_name || currentStory.profile?.username}</p>
            <p className="text-white/70 text-sm">
              {formatDistanceToNow(new Date(currentStory.created_at), { addSuffix: true, locale: cs })}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={() => setIsPaused(prev => !prev)}
          >
            {isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
          </Button>
        </div>

        {/* Image */}
        <div 
          className="flex-1 flex items-center justify-center cursor-pointer"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            if (x < rect.width / 3) {
              goToPrev();
            } else if (x > (rect.width * 2) / 3) {
              goToNext();
            } else {
              setIsPaused(prev => !prev);
            }
          }}
        >
          <img
            src={currentStory.image_url}
            alt="Story"
            className="max-w-full max-h-full object-contain"
          />
        </div>
      </div>
    </div>
  );
}
