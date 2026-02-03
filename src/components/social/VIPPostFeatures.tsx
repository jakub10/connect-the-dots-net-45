import { useState } from 'react';
import { Sparkles, Palette, Image as ImageIcon, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export type PostBackgroundStyle = 
  | 'gradient-purple' 
  | 'gradient-blue' 
  | 'gradient-sunset' 
  | 'gradient-ocean'
  | 'gradient-forest'
  | 'gradient-fire'
  | 'pattern-dots'
  | 'pattern-stars'
  | 'pattern-hearts'
  | null;

export const VIP_BACKGROUNDS: { id: PostBackgroundStyle; name: string; className: string }[] = [
  { id: null, name: 'Žádné', className: 'bg-card' },
  { id: 'gradient-purple', name: 'Fialový gradient', className: 'bg-gradient-to-br from-purple-500/20 via-pink-500/20 to-purple-600/20' },
  { id: 'gradient-blue', name: 'Modrý gradient', className: 'bg-gradient-to-br from-blue-500/20 via-cyan-500/20 to-blue-600/20' },
  { id: 'gradient-sunset', name: 'Západ slunce', className: 'bg-gradient-to-br from-orange-500/20 via-red-500/20 to-pink-500/20' },
  { id: 'gradient-ocean', name: 'Oceán', className: 'bg-gradient-to-br from-cyan-500/20 via-teal-500/20 to-emerald-500/20' },
  { id: 'gradient-forest', name: 'Les', className: 'bg-gradient-to-br from-green-500/20 via-emerald-500/20 to-teal-500/20' },
  { id: 'gradient-fire', name: 'Oheň', className: 'bg-gradient-to-br from-red-500/20 via-orange-500/20 to-yellow-500/20' },
  { id: 'pattern-dots', name: 'Tečky', className: 'bg-card bg-[radial-gradient(circle,hsl(var(--primary)/0.1)_1px,transparent_1px)] bg-[size:12px_12px]' },
  { id: 'pattern-stars', name: 'Hvězdy', className: 'bg-card bg-[radial-gradient(2px_2px_at_20px_30px,hsl(var(--primary)/0.3),transparent),radial-gradient(2px_2px_at_40px_70px,hsl(var(--primary)/0.2),transparent),radial-gradient(1px_1px_at_90px_40px,hsl(var(--primary)/0.3),transparent),radial-gradient(2px_2px_at_130px_80px,hsl(var(--primary)/0.2),transparent)]' },
  { id: 'pattern-hearts', name: 'Srdíčka', className: 'bg-card' },
];

// VIP exclusive emojis (custom unicode combinations and special ones)
export const VIP_EMOJIS = [
  '👑', '💎', '🌟', '✨', '🔮', '🦋', '🌈', '💫', '🎭', '🎪',
  '🏆', '💖', '🌸', '🍾', '🎉', '🪐', '🌙', '⭐', '🌺', '🦄',
  '🔥', '💅', '👸', '🤴', '🎀', '💝', '🌹', '🪷', '🧿', '🪬',
];

export function getBackgroundClass(style: PostBackgroundStyle): string {
  const bg = VIP_BACKGROUNDS.find(b => b.id === style);
  return bg?.className || 'bg-card';
}

interface VIPBackgroundPickerProps {
  selectedBackground: PostBackgroundStyle;
  onSelect: (style: PostBackgroundStyle) => void;
}

export function VIPBackgroundPicker({ selectedBackground, onSelect }: VIPBackgroundPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-amber-500 hover:text-amber-400 hover:bg-amber-500/10"
        >
          <Palette className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-500">
            <Sparkles className="h-4 w-4" />
            VIP Pozadí příspěvku
          </div>
          <div className="grid grid-cols-3 gap-2">
            {VIP_BACKGROUNDS.map((bg) => (
              <button
                key={bg.id || 'none'}
                onClick={() => {
                  onSelect(bg.id);
                  setOpen(false);
                }}
                className={cn(
                  "relative h-12 rounded-lg border-2 transition-all",
                  bg.className,
                  selectedBackground === bg.id
                    ? "border-amber-500 ring-2 ring-amber-500/30"
                    : "border-border hover:border-amber-500/50"
                )}
                title={bg.name}
              >
                {selectedBackground === bg.id && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Check className="h-4 w-4 text-amber-500" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface VIPEmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
}

export function VIPEmojiPicker({ onEmojiSelect }: VIPEmojiPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-amber-500 hover:text-amber-400 hover:bg-amber-500/10"
        >
          <Sparkles className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-500">
            <Sparkles className="h-4 w-4" />
            VIP Emoji
          </div>
          <div className="grid grid-cols-5 gap-2">
            {VIP_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  onEmojiSelect(emoji);
                  setOpen(false);
                }}
                className="h-10 w-10 flex items-center justify-center text-xl rounded-lg hover:bg-amber-500/10 transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// VIP badge component
export function VIPBadge({ className }: { className?: string }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
      "bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-500 border border-amber-500/30",
      className
    )}>
      <Sparkles className="h-3 w-3" />
      VIP
    </span>
  );
}
