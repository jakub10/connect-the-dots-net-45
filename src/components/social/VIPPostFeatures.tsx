import { useState } from 'react';
import { Sparkles, Palette, Check, ShoppingCart, Lock, Crown } from 'lucide-react';
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
  | 'gradient-galaxy'
  | 'gradient-aurora'
  | 'pattern-dots'
  | 'pattern-stars'
  | 'pattern-hearts'
  | 'animated-gradient'
  | 'animated-pulse'
  | 'animated-shimmer'
  | 'animated-rainbow'
  | 'animated-wave'
  | null;

// Base backgrounds (free for VIP)
export const VIP_BACKGROUNDS: { id: PostBackgroundStyle; name: string; className: string; animated?: boolean; cost?: number }[] = [
  { id: null, name: 'Žádné', className: 'bg-card', cost: 0 },
  { id: 'gradient-purple', name: 'Fialový gradient', className: 'bg-gradient-to-br from-purple-500/20 via-pink-500/20 to-purple-600/20', cost: 0 },
  { id: 'gradient-blue', name: 'Modrý gradient', className: 'bg-gradient-to-br from-blue-500/20 via-cyan-500/20 to-blue-600/20', cost: 0 },
  { id: 'gradient-sunset', name: 'Západ slunce', className: 'bg-gradient-to-br from-orange-500/20 via-red-500/20 to-pink-500/20', cost: 0 },
  { id: 'gradient-ocean', name: 'Oceán', className: 'bg-gradient-to-br from-cyan-500/20 via-teal-500/20 to-emerald-500/20', cost: 0 },
  { id: 'gradient-forest', name: 'Les', className: 'bg-gradient-to-br from-green-500/20 via-emerald-500/20 to-teal-500/20', cost: 0 },
  { id: 'gradient-fire', name: 'Oheň', className: 'bg-gradient-to-br from-red-500/20 via-orange-500/20 to-yellow-500/20', cost: 0 },
  { id: 'gradient-galaxy', name: 'Galaxie', className: 'bg-gradient-to-br from-indigo-600/25 via-purple-600/20 to-pink-500/25', cost: 50 },
  { id: 'gradient-aurora', name: 'Polární záře', className: 'bg-gradient-to-br from-green-400/20 via-blue-500/20 to-purple-600/20', cost: 50 },
  { id: 'pattern-dots', name: 'Tečky', className: 'bg-card bg-[radial-gradient(circle,hsl(var(--primary)/0.1)_1px,transparent_1px)] bg-[size:12px_12px]', cost: 0 },
  { id: 'pattern-stars', name: 'Hvězdy', className: 'bg-card bg-[radial-gradient(2px_2px_at_20px_30px,hsl(var(--primary)/0.3),transparent),radial-gradient(2px_2px_at_40px_70px,hsl(var(--primary)/0.2),transparent),radial-gradient(1px_1px_at_90px_40px,hsl(var(--primary)/0.3),transparent),radial-gradient(2px_2px_at_130px_80px,hsl(var(--primary)/0.2),transparent)]', cost: 0 },
  { id: 'pattern-hearts', name: 'Srdíčka', className: 'bg-card', cost: 25 },
  // Animated backgrounds (premium)
  { id: 'animated-gradient', name: '✨ Živý gradient', className: 'vip-animated-gradient', animated: true, cost: 100 },
  { id: 'animated-pulse', name: '💫 Pulzující', className: 'vip-animated-pulse', animated: true, cost: 100 },
  { id: 'animated-shimmer', name: '🌟 Třpytivý', className: 'vip-animated-shimmer', animated: true, cost: 150 },
  { id: 'animated-rainbow', name: '🌈 Duhový', className: 'vip-animated-rainbow', animated: true, cost: 200 },
  { id: 'animated-wave', name: '🌊 Vlnový', className: 'vip-animated-wave', animated: true, cost: 150 },
];

// VIP exclusive emojis (regular)
export const VIP_EMOJIS = [
  '👑', '💎', '🌟', '✨', '🔮', '🦋', '🌈', '💫', '🎭', '🎪',
  '🏆', '💖', '🌸', '🍾', '🎉', '🪐', '🌙', '⭐', '🌺', '🦄',
  '🔥', '💅', '👸', '🤴', '🎀', '💝', '🌹', '🪷', '🧿', '🪬',
];

// Custom VIP emoji images (unique to this platform)
export const VIP_CUSTOM_EMOJIS: { id: string; name: string; src: string; cost: number }[] = [
  { id: 'vip-crown', name: 'VIP Koruna', src: '/placeholder.svg', cost: 0 },
  { id: 'vip-diamond', name: 'VIP Diamant', src: '/placeholder.svg', cost: 25 },
  { id: 'vip-fire', name: 'VIP Oheň', src: '/placeholder.svg', cost: 25 },
  { id: 'vip-star', name: 'VIP Hvězda', src: '/placeholder.svg', cost: 50 },
  { id: 'vip-heart', name: 'VIP Srdce', src: '/placeholder.svg', cost: 50 },
  { id: 'vip-rocket', name: 'VIP Raketa', src: '/placeholder.svg', cost: 75 },
  { id: 'vip-unicorn', name: 'VIP Jednorožec', src: '/placeholder.svg', cost: 100 },
  { id: 'vip-rainbow', name: 'VIP Duha', src: '/placeholder.svg', cost: 100 },
  { id: 'vip-galaxy', name: 'VIP Galaxie', src: '/placeholder.svg', cost: 150 },
  { id: 'vip-legendary', name: 'VIP Legendární', src: '/placeholder.svg', cost: 200 },
];

export function getBackgroundClass(style: PostBackgroundStyle): string {
  const bg = VIP_BACKGROUNDS.find(b => b.id === style);
  return bg?.className || 'bg-card';
}

interface VIPBackgroundPickerProps {
  selectedBackground: PostBackgroundStyle;
  onSelect: (style: PostBackgroundStyle) => void;
  userPoints?: number;
  unlockedBackgrounds?: string[];
}

export function VIPBackgroundPicker({ 
  selectedBackground, 
  onSelect, 
  userPoints = 0,
  unlockedBackgrounds = [] 
}: VIPBackgroundPickerProps) {
  const [open, setOpen] = useState(false);

  const isUnlocked = (bg: typeof VIP_BACKGROUNDS[0]) => {
    if (!bg.cost || bg.cost === 0) return true;
    return unlockedBackgrounds.includes(bg.id || '');
  };

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
      <PopoverContent className="w-72 p-3" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-500">
              <Sparkles className="h-4 w-4" />
              VIP Pozadí příspěvku
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Crown className="h-3 w-3 text-amber-500" />
              {userPoints} bodů
            </div>
          </div>
          
          {/* Regular backgrounds */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Základní</p>
            <div className="grid grid-cols-4 gap-2">
              {VIP_BACKGROUNDS.filter(bg => !bg.animated && (!bg.cost || bg.cost === 0)).map((bg) => (
                <button
                  key={bg.id || 'none'}
                  onClick={() => {
                    onSelect(bg.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "relative h-10 rounded-lg border-2 transition-all",
                    bg.className,
                    selectedBackground === bg.id
                      ? "border-amber-500 ring-2 ring-amber-500/30"
                      : "border-border hover:border-amber-500/50"
                  )}
                  title={bg.name}
                >
                  {selectedBackground === bg.id && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Check className="h-3 w-3 text-amber-500" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Premium backgrounds */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Premium (odemkni v obchodě)</p>
            <div className="grid grid-cols-4 gap-2">
              {VIP_BACKGROUNDS.filter(bg => bg.cost && bg.cost > 0).map((bg) => {
                const unlocked = isUnlocked(bg);
                return (
                  <button
                    key={bg.id}
                    onClick={() => {
                      if (unlocked) {
                        onSelect(bg.id);
                        setOpen(false);
                      }
                    }}
                    disabled={!unlocked}
                    className={cn(
                      "relative h-10 rounded-lg border-2 transition-all",
                      bg.className,
                      !unlocked && "opacity-50 cursor-not-allowed",
                      selectedBackground === bg.id
                        ? "border-amber-500 ring-2 ring-amber-500/30"
                        : "border-border hover:border-amber-500/50"
                    )}
                    title={`${bg.name} (${bg.cost} bodů)`}
                  >
                    {!unlocked && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
                        <Lock className="h-3 w-3 text-white" />
                      </div>
                    )}
                    {selectedBackground === bg.id && unlocked && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Check className="h-3 w-3 text-amber-500" />
                      </div>
                    )}
                    {bg.animated && (
                      <div className="absolute -top-1 -right-1">
                        <Sparkles className="h-2.5 w-2.5 text-amber-400" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface VIPEmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  userPoints?: number;
  unlockedEmojis?: string[];
}

export function VIPEmojiPicker({ 
  onEmojiSelect, 
  userPoints = 0,
  unlockedEmojis = [] 
}: VIPEmojiPickerProps) {
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
      <PopoverContent className="w-72 p-3" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-500">
              <Sparkles className="h-4 w-4" />
              VIP Emoji
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Crown className="h-3 w-3 text-amber-500" />
              {userPoints} bodů
            </div>
          </div>
          
          {/* Standard VIP emojis */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Exkluzivní emoji</p>
            <div className="grid grid-cols-6 gap-1.5">
              {VIP_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    onEmojiSelect(emoji);
                    setOpen(false);
                  }}
                  className="h-9 w-9 flex items-center justify-center text-lg rounded-lg hover:bg-amber-500/10 transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Custom VIP emoji images */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Unikátní VIP obrázky</p>
            <div className="grid grid-cols-5 gap-1.5">
              {VIP_CUSTOM_EMOJIS.map((emoji) => {
                const unlocked = emoji.cost === 0 || unlockedEmojis.includes(emoji.id);
                return (
                  <button
                    key={emoji.id}
                    onClick={() => {
                      if (unlocked) {
                        onEmojiSelect(`[${emoji.id}]`);
                        setOpen(false);
                      }
                    }}
                    disabled={!unlocked}
                    className={cn(
                      "relative h-10 w-10 flex items-center justify-center rounded-lg transition-colors border border-transparent",
                      unlocked ? "hover:bg-amber-500/10 hover:border-amber-500/30" : "opacity-50 cursor-not-allowed"
                    )}
                    title={`${emoji.name} (${emoji.cost} bodů)`}
                  >
                    <div className="w-6 h-6 rounded bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-xs font-bold">
                      {emoji.name.charAt(4)}
                    </div>
                    {!unlocked && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-lg">
                        <Lock className="h-2.5 w-2.5 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
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

// Creator badge component
export function CreatorBadge({ className }: { className?: string }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
      "bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-500 border border-purple-500/30",
      className
    )}>
      <Crown className="h-3 w-3" />
      Tvůrce
    </span>
  );
}
