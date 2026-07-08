import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Gem, Loader2, Check, Sparkles, Zap, Infinity as InfinityIcon, Trophy } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';

export function VipProMaxActivation() {
  const { isVipProMax, activateVipProMax, loading } = useUserRole();
  const [code, setCode] = useState('');
  const [activating, setActivating] = useState(false);

  const handleActivate = async () => {
    if (!code.trim()) return;
    setActivating(true);
    await activateVipProMax(code.trim());
    setActivating(false);
    setCode('');
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (isVipProMax) {
    return (
      <Card className="relative overflow-hidden border-2 border-fuchsia-500/50 bg-gradient-to-br from-fuchsia-500/10 via-purple-500/10 to-cyan-500/10">
        <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-cyan-500/20 blur-3xl" />
        <CardHeader className="relative">
          <CardTitle className="flex items-center gap-2 bg-gradient-to-r from-fuchsia-500 via-purple-500 to-cyan-500 bg-clip-text text-transparent">
            <Gem className="h-6 w-6 text-fuchsia-500" />
            VIP PRO MAX
          </CardTitle>
          <CardDescription>Nejvyšší úroveň členství je aktivní 💎</CardDescription>
        </CardHeader>
        <CardContent className="relative">
          <div className="flex items-center gap-2 text-green-500 mb-4">
            <Check className="h-5 w-5" />
            <span className="font-bold">PRO MAX status je aktivní!</span>
          </div>
          <div className="space-y-2">
            <h4 className="font-bold text-sm flex items-center gap-1">
              <Sparkles className="h-4 w-4 text-fuchsia-500" />
              MEGA výhody:
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1.5">
              <li className="flex items-center gap-2"><Gem className="h-3 w-3 text-fuchsia-500" /> Exkluzivní PRO MAX odznak s pulzující animací</li>
              <li className="flex items-center gap-2"><InfinityIcon className="h-3 w-3 text-purple-500" /> Všechna pozadí a emoji ZDARMA</li>
              <li className="flex items-center gap-2"><Zap className="h-3 w-3 text-yellow-500" /> Všechny VIP výhody v ceně</li>
              <li className="flex items-center gap-2"><Trophy className="h-3 w-3 text-orange-500" /> Duhový rotující rámeček avataru</li>
              <li className="flex items-center gap-2"><Sparkles className="h-3 w-3 text-cyan-500" /> Plovoucí jiskřičky kolem avataru</li>
              <li className="flex items-center gap-2"><Sparkles className="h-3 w-3 text-fuchsia-500" /> Holografický cover na profilu</li>
              <li className="flex items-center gap-2"><Sparkles className="h-3 w-3 text-purple-500" /> Animovaný duhový rámeček celé profilové karty</li>
              <li className="flex items-center gap-2"><Sparkles className="h-3 w-3 text-cyan-500" /> Záře (glow) kolem profilovky</li>
              <li className="flex items-center gap-2"><Sparkles className="h-3 w-3 text-pink-500" /> Animovaný gradient u jména</li>
              <li className="flex items-center gap-2"><Check className="h-3 w-3 text-green-500" /> Neomezené příběhy & příspěvky</li>
              <li className="flex items-center gap-2"><Check className="h-3 w-3 text-green-500" /> Prioritní AI chatbot</li>
              <li className="flex items-center gap-2"><Check className="h-3 w-3 text-green-500" /> Žádné reklamy & limity</li>
            </ul>

          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden border-2 border-fuchsia-500/30">
      <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/5 via-purple-500/5 to-cyan-500/5" />
      <CardHeader className="relative">
        <CardTitle className="flex items-center gap-2">
          <Gem className="h-6 w-6 text-fuchsia-500" />
          <span className="bg-gradient-to-r from-fuchsia-500 via-purple-500 to-cyan-500 bg-clip-text text-transparent font-extrabold">
            VIP PRO MAX
          </span>
        </CardTitle>
        <CardDescription>
          💎 MEGA upgrade — vše zdarma, exkluzivní odznak, animovaný gradient a další výhody!
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 relative">
        <div className="rounded-lg border border-fuchsia-500/40 bg-gradient-to-r from-fuchsia-500/10 to-cyan-500/10 p-3 text-sm">
          <span className="font-bold bg-gradient-to-r from-fuchsia-500 to-cyan-500 bg-clip-text text-transparent">Cena: 50 Kč</span>
          <p className="text-xs text-muted-foreground mt-1">
            Jednorázový kód získáš od tvůrce po zaplacení.
          </p>
        </div>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li className="flex items-center gap-2"><InfinityIcon className="h-3 w-3 text-purple-500" /> Všechna pozadí & emoji zdarma</li>
          <li className="flex items-center gap-2"><Sparkles className="h-3 w-3 text-fuchsia-500" /> Animovaný gradient u jména</li>
          <li className="flex items-center gap-2"><Trophy className="h-3 w-3 text-orange-500" /> Rotující duhový rámeček avataru + glow</li>
          <li className="flex items-center gap-2"><Sparkles className="h-3 w-3 text-cyan-500" /> Plovoucí jiskřičky kolem profilovky</li>
          <li className="flex items-center gap-2"><Sparkles className="h-3 w-3 text-pink-500" /> Holografický cover & duhový rámeček karty</li>
          <li className="flex items-center gap-2"><Gem className="h-3 w-3 text-fuchsia-500" /> Pulzující PRO MAX odznak</li>
          <li className="flex items-center gap-2"><Zap className="h-3 w-3 text-yellow-500" /> Zahrnuje všechny VIP funkce</li>
        </ul>


        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Zadejte PRO MAX kód..."
          type="password"
        />
        <Button 
          onClick={handleActivate} 
          disabled={!code.trim() || activating}
          className="w-full bg-gradient-to-r from-fuchsia-500 via-purple-500 to-cyan-500 hover:opacity-90 text-white font-bold"
        >
          {activating ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Gem className="h-4 w-4 mr-2" />
          )}
          Aktivovat VIP PRO MAX
        </Button>
      </CardContent>
    </Card>
  );
}
