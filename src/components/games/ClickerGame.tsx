import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { X, Trophy, Zap } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ClickerGameProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Upgrade {
  id: string;
  name: string;
  cost: number;
  cps: number; // clicks per second (auto)
  multiplier: number;
  owned: number;
}

export function ClickerGame({ isOpen, onClose }: ClickerGameProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [clicks, setClicks] = useState(0);
  const [totalClicks, setTotalClicks] = useState(0);
  const [clickPower, setClickPower] = useState(1);
  const [cps, setCps] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [clickEffects, setClickEffects] = useState<{ id: number; x: number; y: number }[]>([]);
  const effectIdRef = useRef(0);
  const [upgrades, setUpgrades] = useState<Upgrade[]>([
    { id: 'cursor', name: '🖱️ Kurzor', cost: 15, cps: 0.1, multiplier: 1, owned: 0 },
    { id: 'robot', name: '🤖 Robot', cost: 100, cps: 1, multiplier: 1, owned: 0 },
    { id: 'farm', name: '🌾 Farma', cost: 500, cps: 5, multiplier: 1, owned: 0 },
    { id: 'factory', name: '🏭 Továrna', cost: 2000, cps: 20, multiplier: 1, owned: 0 },
    { id: 'power', name: '⚡ Síla kliknutí', cost: 50, cps: 0, multiplier: 2, owned: 0 },
  ]);

  useEffect(() => {
    if (isOpen) fetchHighScore();
  }, [isOpen, user]);

  useEffect(() => {
    // Auto-clicker loop
    if (!isOpen || cps === 0) return;
    
    const interval = setInterval(() => {
      setClicks(c => c + cps / 10);
      setTotalClicks(t => t + cps / 10);
    }, 100);

    return () => clearInterval(interval);
  }, [isOpen, cps]);

  // Save score periodically
  useEffect(() => {
    if (!isOpen || !user) return;
    
    const saveInterval = setInterval(() => {
      if (totalClicks > highScore) {
        saveScore(Math.floor(totalClicks));
      }
    }, 5000);

    return () => clearInterval(saveInterval);
  }, [isOpen, totalClicks, highScore, user]);

  const fetchHighScore = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_game_stats')
      .select('clicker_best')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) {
      setHighScore(data.clicker_best);
      // Resume from high score
      setClicks(data.clicker_best);
      setTotalClicks(data.clicker_best);
    }
  };

  const saveScore = async (newScore: number) => {
    if (!user || newScore <= highScore) return;
    
    await supabase
      .from('user_game_stats')
      .upsert({ 
        user_id: user.id, 
        clicker_best: newScore,
        updated_at: new Date().toISOString()
      });

    setHighScore(newScore);
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setClicks(c => c + clickPower);
    setTotalClicks(t => t + clickPower);

    // Add click effect
    const effectId = effectIdRef.current++;
    setClickEffects(prev => [...prev, { id: effectId, x, y }]);
    
    setTimeout(() => {
      setClickEffects(prev => prev.filter(e => e.id !== effectId));
    }, 500);
  };

  const buyUpgrade = (upgradeId: string) => {
    setUpgrades(prev => prev.map(upgrade => {
      if (upgrade.id !== upgradeId) return upgrade;
      if (clicks < upgrade.cost) return upgrade;

      setClicks(c => c - upgrade.cost);
      
      if (upgrade.cps > 0) {
        setCps(c => c + upgrade.cps);
      }
      if (upgrade.multiplier > 1) {
        setClickPower(p => p * upgrade.multiplier);
      }

      return {
        ...upgrade,
        owned: upgrade.owned + 1,
        cost: Math.floor(upgrade.cost * 1.5),
      };
    }));
  };

  const formatNumber = (n: number) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return Math.floor(n).toString();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-yellow-500/10 to-orange-500/10">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">🍪 Clicker</h3>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm">
              <Trophy className="h-4 w-4 inline mr-1 text-yellow-500" />
              {formatNumber(highScore)}
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="p-4 text-center bg-gradient-to-b from-secondary/30 to-transparent">
          <p className="text-4xl font-bold">{formatNumber(clicks)}</p>
          <p className="text-sm text-muted-foreground">
            +{clickPower} za klik | +{cps.toFixed(1)}/s auto
          </p>
        </div>

        {/* Click Button */}
        <div className="p-6 flex justify-center">
          <button
            onClick={handleClick}
            className="relative w-32 h-32 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 shadow-lg hover:scale-105 active:scale-95 transition-transform text-6xl flex items-center justify-center"
          >
            🍪
            {clickEffects.map(effect => (
              <span
                key={effect.id}
                className="absolute text-lg font-bold text-yellow-300 animate-ping pointer-events-none"
                style={{ left: effect.x, top: effect.y, transform: 'translate(-50%, -50%)' }}
              >
                +{clickPower}
              </span>
            ))}
          </button>
        </div>

        {/* Upgrades */}
        <div className="p-4 border-t border-border max-h-48 overflow-y-auto">
          <h4 className="font-semibold mb-2 text-sm">Vylepšení</h4>
          <div className="space-y-2">
            {upgrades.map(upgrade => (
              <button
                key={upgrade.id}
                onClick={() => buyUpgrade(upgrade.id)}
                disabled={clicks < upgrade.cost}
                className={cn(
                  "w-full flex items-center justify-between p-2 rounded-lg transition-colors",
                  clicks >= upgrade.cost 
                    ? "bg-secondary hover:bg-secondary/80" 
                    : "bg-muted/30 opacity-50"
                )}
              >
                <div className="flex items-center gap-2">
                  <span>{upgrade.name}</span>
                  <span className="text-xs text-muted-foreground">({upgrade.owned})</span>
                </div>
                <span className="text-sm font-medium">{formatNumber(upgrade.cost)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
