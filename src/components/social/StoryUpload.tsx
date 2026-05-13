import { useState, useRef } from 'react';
import { Plus, X, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface StoryUploadProps {
  onStoryCreated?: () => void;
}

export function StoryUpload({ onStoryCreated }: StoryUploadProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Chyba',
        description: 'Vyber prosím obrázek.',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'Chyba',
        description: 'Obrázek je příliš velký. Maximum je 10MB.',
        variant: 'destructive',
      });
      return;
    }

    setSelectedImage(file);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    if (!selectedImage || !user) return;

    setIsUploading(true);
    try {
      // Upload image to storage - path must match RLS policy: stories/{user_id}/filename
      const fileExt = selectedImage.name.split('.').pop();
      const fileName = `stories/${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('posts')
        .upload(fileName, selectedImage);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('posts')
        .getPublicUrl(fileName);

      // Create story record with 24h expiry
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const { error: insertError } = await supabase
        .from('stories')
        .insert({
          user_id: user.id,
          image_url: urlData.publicUrl,
          expires_at: expiresAt,
        });

      if (insertError) throw insertError;

      toast({
        title: 'Úspěch!',
        description: 'Příběh byl publikován.',
      });

      setIsOpen(false);
      setSelectedImage(null);
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onStoryCreated?.();
    } catch (error) {
      console.error('Error uploading story:', error);
      toast({
        title: 'Chyba',
        description: 'Nepodařilo se nahrát příběh.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setSelectedImage(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <>
      <div className="flex flex-col items-center gap-1">
        <button
          onClick={() => setIsOpen(true)}
          className="relative w-16 h-16 rounded-full bg-accent flex items-center justify-center hover:bg-accent/80 transition-colors"
        >
          <Plus className="h-6 w-6 text-primary" />
        </button>
        <span className="text-xs text-muted-foreground">Přidat</span>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Přidat příběh</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {!imagePreview ? (
              <div
                className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Klikni pro výběr obrázku</p>
                <p className="text-sm text-muted-foreground mt-1">Max. 10MB</p>
              </div>
            ) : (
              <div className="relative rounded-xl overflow-hidden">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full max-h-96 object-contain bg-black"
                />
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute top-2 right-2 rounded-full"
                  onClick={() => {
                    setSelectedImage(null);
                    if (imagePreview) URL.revokeObjectURL(imagePreview);
                    setImagePreview(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />

            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose} className="flex-1">
                Zrušit
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!selectedImage || isUploading}
                className="flex-1"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Nahrávám...
                  </>
                ) : (
                  'Publikovat'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
