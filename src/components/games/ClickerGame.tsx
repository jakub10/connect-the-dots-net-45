import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { X, Trophy, Zap, Clock, Sparkles, Rocket, Star, Gem } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ClickerGameProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Upgrade {
  id: string;
  name: string;
  description: string;
  baseCost: number;
  multiplier: number;
  icon: typeof Zap;
  type: 'click' | 'auto' | 'multiplier';
  effect: number;
}

const UPGRADES: Upgrade[] = [
  { id: 'double', name: 'Dvojklik', description: '+1 za klik', baseCost: 50, multiplier: 1.8, icon: Zap, type: 'click', effect: 1 },
  { id: 'auto1', name: 'Robot', description: '+1/s automaticky', baseCost: 100, multiplier: 1.5, icon: Clock, type: 'auto', effect: 1 },
  { id: 'triple', name: 'Trojklik', description: '+2 za klik', baseCost: 300, multiplier: 2, icon: Sparkles, type: 'click', effect: 2 },
  { id: 'auto2', name: 'Továrna', description: '+5/s automaticky', baseCost: 500, multiplier: 1.6, icon: Rocket, type: 'auto', effect: 5 },
  { id: 'multi', name: 'Násobič', description: 'x2 všechny body', baseCost: 1000, multiplier: 2.5, icon: Star, type: 'multiplier', effect: 2 },
  { id: 'mega', name: 'Mega klik', description: '+10 za klik', baseCost: 2500, multiplier: 2, icon: Gem, type: 'click', effect: 10 },
  { id: 'auto3', name: 'Impérium', description: '+25/s automaticky', baseCost: 5000, multiplier: 1.8, icon: Rocket, type: 'auto', effect: 25 },
  { id: 'ultra', name: 'Ultra násobič', description: 'x3 všechny body', baseCost: 15000, multiplier: 3, icon: Gem, type: 'multiplier', effect: 3 },
];

export function ClickerGame({ isOpen, onClose }: ClickerGameProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [points, setPoints] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [clickPower, setClickPower] = useState(1);
  const [autoPoints, setAutoPoints] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [purchasedUpgrades, setPurchasedUpgrades] = useState<Record<string, number>>({});
  const [clickEffects, setClickEffects] = useState<{ id: number; x: number; y: number; value: number }[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) fetchHighScore();
  }, [isOpen, user]);

  const fetchHighScore = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_game_stats')
      .select('clicker_best')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) setHighScore(data.clicker_best);
  };

  const saveScore = useCallback(async (newTotal: number) => {
    if (!user || newTotal <= highScore) return;
    
    await supabase.rpc('submit_game_score', { _game_type: 'clicker', _score: Math.floor(newTotal) });

    setHighScore(newTotal);
    toast({
      title: '🏆 Nové nejvyšší skóre!',
      description: `Clicker: ${newTotal.toLocaleString()} bodů`,
    });
  }, [user, highScore, toast]);

  useEffect(() => {
    if (!isOpen || autoPoints === 0) return;
    
    const interval = setInterval(() => {
      const gain = autoPoints * multiplier;
      setPoints(p => p + gain);
      setTotalPoints(t => {
        const newTotal = t + gain;
        if (newTotal > highScore) saveScore(newTotal);
        return newTotal;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isOpen, autoPoints, multiplier, highScore, saveScore]);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const gain = clickPower * multiplier;
    setPoints(p => p + gain);
    setTotalPoints(t => {
      const newTotal = t + gain;
      if (newTotal > highScore) saveScore(newTotal);
      return newTotal;
    });

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const effectId = Date.now();
    setClickEffects(prev => [...prev, { id: effectId, x, y, value: gain }]);
    setTimeout(() => {
      setClickEffects(prev => prev.filter(ef => ef.id !== effectId));
    }, 800);

    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 100);
  };

  const getUpgradeCost = (upgrade: Upgrade): number => {
    const level = purchasedUpgrades[upgrade.id] || 0;
    return Math.floor(upgrade.baseCost * Math.pow(upgrade.multiplier, level));
  };

  const purchaseUpgrade = (upgrade: Upgrade) => {
    const cost = getUpgradeCost(upgrade);
    if (points < cost) return;

    setPoints(p => p - cost);
    setPurchasedUpgrades(prev => ({
      ...prev,
      [upgrade.id]: (prev[upgrade.id] || 0) + 1,
    }));

    switch (upgrade.type) {
      case 'click':
        setClickPower(p => p + upgrade.effect);
        break;
      case 'auto':
        setAutoPoints(a => a + upgrade.effect);
        break;
      case 'multiplier':
        setMultiplier(m => m * upgrade.effect);
        break;
    }
  };

  const resetGame = () => {
    setPoints(0);
    setTotalPoints(0);
    setClickPower(1);
    setAutoPoints(0);
    setMultiplier(1);
    setPurchasedUpgrades({});
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-3 border-b border-border bg-gradient-to-r from-yellow-500/10 to-orange-500/10">
          <h3 className="font-semibold">🖱️ Clicker</h3>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-sm">
              <Trophy className="h-4 w-4 text-yellow-500" />
              {highScore.toLocaleString()}
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="p-3 bg-secondary/30 grid grid-cols-3 gap-2 text-center text-sm">
          <div>
            <div className="text-muted-foreground text-xs">Body</div>
            <div className="font-bold text-lg">{Math.floor(points).toLocaleString()}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Za klik</div>
            <div className="font-bold text-yellow-400">{(clickPower * multiplier).toFixed(0)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Za sekundu</div>
            <div className="font-bold text-green-400">{(autoPoints * multiplier).toFixed(0)}</div>
          </div>
        </div>

        <div className="p-6 flex justify-center">
          <button
            onClick={handleClick}
            className={`relative w-32 h-32 rounded-full bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 shadow-lg transition-transform hover:scale-105 active:scale-95 ${
              isAnimating ? 'scale-110' : ''
            }`}
          >
            <span className="text-5xl">🎯</span>
            
            {clickEffects.map(effect => (
              <span
                key={effect.id}
                className="absolute text-yellow-300 font-bold text-lg pointer-events-none animate-float-up"
                style={{ left: effect.x, top: effect.y }}
              >
                +{effect.value}
              </span>
            ))}
          </button>
        </div>

        {multiplier > 1 && (
          <div className="text-center pb-2">
            <span className="bg-purple-500/20 text-purple-400 px-3 py-1 rounded-full text-sm">
              ✨ {multiplier}x násobič aktivní
            </span>
          </div>
        )}

        <div className="p-3 border-t border-border">
          <h4 className="text-sm font-semibold mb-2">Vylepšení</h4>
          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
            {UPGRADES.map(upgrade => {
              const cost = getUpgradeCost(upgrade);
              const canAfford = points >= cost;
              const level = purchasedUpgrades[upgrade.id] || 0;
              const Icon = upgrade.icon;

              return (
                <button
                  key={upgrade.id}
                  onClick={() => purchaseUpgrade(upgrade)}
                  disabled={!canAfford}
                  className={`p-2 rounded-lg text-left transition-all ${
                    canAfford 
                      ? 'bg-primary/10 hover:bg-primary/20 border border-primary/30' 
                      : 'bg-muted/30 opacity-60 cursor-not-allowed border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      upgrade.type === 'click' ? 'bg-yellow-500/20 text-yellow-400' :
                      upgrade.type === 'auto' ? 'bg-green-500/20 text-green-400' :
                      'bg-purple-500/20 text-purple-400'
                    }`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">
                        {upgrade.name} {level > 0 && <span className="text-muted-foreground">({level})</span>}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{upgrade.description}</div>
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-right text-yellow-400 font-medium">
                    {cost.toLocaleString()} 💰
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-3 border-t border-border flex gap-2">
          <div className="flex-1 text-xs text-muted-foreground">
            Celkem: {totalPoints.toLocaleString()} bodů
          </div>
          <Button variant="outline" size="sm" onClick={resetGame}>
            Reset
          </Button>
        </div>
      </div>

      <style>{`
        @keyframes float-up {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-50px) scale(1.5); }
        }
        .animate-float-up {
          animation: float-up 0.8s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
