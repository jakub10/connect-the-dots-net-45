import { useState, useRef } from 'react';
import { Image, Smile, MapPin, Send, X, Loader2, Sparkles } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useUserRole } from '@/hooks/useUserRole';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { 
  VIPBackgroundPicker, 
  VIPEmojiPicker, 
  PostBackgroundStyle, 
  getBackgroundClass,
  VIPBadge 
} from './VIPPostFeatures';
import { cn } from '@/lib/utils';

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
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [backgroundStyle, setBackgroundStyle] = useState<PostBackgroundStyle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const { isVIP } = useUserRole();

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Chyba',
        description: 'Vyber prosím obrázek.',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'Chyba',
        description: 'Obrázek je příliš velký. Maximum je 10MB.',
        variant: 'destructive',
      });
      return;
    }

    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleEmojiSelect = (emoji: { native: string }) => {
    setContent(prev => prev + emoji.native);
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!selectedImage || !user) return null;

    setUploadingImage(true);
    try {
      const fileExt = selectedImage.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('posts')
        .upload(fileName, selectedImage);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('posts')
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async () => {
    if ((!content.trim() && !selectedImage) || !user) return;

    setIsSubmitting(true);
    try {
      let imageUrl: string | null = null;
      
      if (selectedImage) {
        imageUrl = await uploadImage();
        if (!imageUrl && selectedImage) {
          throw new Error('Failed to upload image');
        }
      }

      const { error } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          content: content.trim(),
          image_url: imageUrl,
          background_style: isVIP ? backgroundStyle : null,
        });

      if (error) throw error;

      setContent('');
      setBackgroundStyle(null);
      removeImage();
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

  // Preview background style
  const previewBgClass = isVIP && backgroundStyle ? getBackgroundClass(backgroundStyle) : 'bg-card';

  return (
    <div className={cn("rounded-xl border border-border p-4 mb-4 animate-fadeIn", previewBgClass)}>
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
          
          {/* Image preview */}
          {imagePreview && (
            <div className="relative mt-3 rounded-xl overflow-hidden border border-border">
              <img
                src={imagePreview}
                alt="Preview"
                className="w-full max-h-80 object-cover"
              />
              <Button
                variant="secondary"
                size="icon"
                className="absolute top-2 right-2 rounded-full"
                onClick={removeImage}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-border mt-3">
            <div className="flex gap-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-primary"
                onClick={() => fileInputRef.current?.click()}
              >
                <Image className="h-5 w-5" />
              </Button>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary">
                    <Smile className="h-5 w-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 border-0" align="start">
                  <Picker
                    data={data}
                    onEmojiSelect={handleEmojiSelect}
                    theme="auto"
                    locale="cs"
                    previewPosition="none"
                    skinTonePosition="none"
                  />
                </PopoverContent>
              </Popover>
              
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary">
                <MapPin className="h-5 w-5" />
              </Button>
              
              {/* VIP Features */}
              {isVIP && (
                <>
                  <VIPBackgroundPicker 
                    selectedBackground={backgroundStyle} 
                    onSelect={setBackgroundStyle} 
                  />
                  <VIPEmojiPicker 
                    onEmojiSelect={(emoji) => setContent(prev => prev + emoji)} 
                  />
                </>
              )}
            </div>
            <Button
              onClick={handleSubmit}
              disabled={(!content.trim() && !selectedImage) || isSubmitting}
              className="gap-2"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Publikovat
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
