import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShoppingCart, Sparkles, Palette, Crown, Check, Lock, Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { VIP_BACKGROUNDS, VIP_CUSTOM_EMOJIS } from '@/components/social/VIPPostFeatures';
import { cn } from '@/lib/utils';

interface UserShopData {
  total_points: number;
  unlocked_items: string[];
}

export function VIPShop() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [userData, setUserData] = useState<UserShopData>({ total_points: 0, unlocked_items: [] });
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;
      
      const { data: stats } = await supabase
        .from('user_stats')
        .select('total_points')
        .eq('user_id', user.id)
        .maybeSingle();

      // For now, store unlocked items in local state
      // In production, this would be in a separate table
      const savedItems = localStorage.getItem(`vip_unlocked_${user.id}`);
      const unlockedItems = savedItems ? JSON.parse(savedItems) : [];

      setUserData({
        total_points: stats?.total_points || 0,
        unlocked_items: unlockedItems,
      });
      setLoading(false);
    };

    fetchUserData();
  }, [user]);

  const purchaseItem = async (itemId: string, cost: number, type: 'background' | 'emoji') => {
    if (!user) return;
    if (userData.total_points < cost) {
      toast({
        title: 'Nedostatek bodů',
        description: `Potřebuješ ${cost} bodů, ale máš jen ${userData.total_points}.`,
        variant: 'destructive',
      });
      return;
    }

    setPurchasing(itemId);
    
    try {
      // Deduct points
      const newPoints = userData.total_points - cost;
      const { error } = await supabase
        .from('user_stats')
        .update({ total_points: newPoints })
        .eq('user_id', user.id);

      if (error) throw error;

      // Save unlocked item
      const newUnlocked = [...userData.unlocked_items, itemId];
      localStorage.setItem(`vip_unlocked_${user.id}`, JSON.stringify(newUnlocked));

      setUserData({
        total_points: newPoints,
        unlocked_items: newUnlocked,
      });

      toast({
        title: '🎉 Zakoupeno!',
        description: `Úspěšně jsi odemkl(a) novou položku za ${cost} bodů.`,
      });
    } catch (error) {
      toast({
        title: 'Chyba',
        description: 'Nepodařilo se zakoupit položku.',
        variant: 'destructive',
      });
    } finally {
      setPurchasing(null);
    }
  };

  const isOwned = (itemId: string) => userData.unlocked_items.includes(itemId);

  const premiumBackgrounds = VIP_BACKGROUNDS.filter(bg => bg.cost && bg.cost > 0);
  const premiumEmojis = VIP_CUSTOM_EMOJIS.filter(e => e.cost > 0);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-orange-500/5">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-amber-500" />
              VIP Obchod
            </CardTitle>
            <CardDescription>
              Odemkni exkluzivní pozadí a emoji za body z achievementů
            </CardDescription>
          </div>
          <Badge variant="secondary" className="text-lg px-4 py-2 bg-amber-500/10 text-amber-500 border-amber-500/30">
            <Crown className="h-4 w-4 mr-2" />
            {userData.total_points} bodů
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="backgrounds">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="backgrounds" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Pozadí
            </TabsTrigger>
            <TabsTrigger value="emojis" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Emoji
            </TabsTrigger>
          </TabsList>

          <TabsContent value="backgrounds" className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {premiumBackgrounds.map((bg) => {
                const owned = isOwned(bg.id || '');
                const canAfford = userData.total_points >= (bg.cost || 0);
                
                return (
                  <div
                    key={bg.id}
                    className={cn(
                      "relative rounded-xl border-2 p-4 transition-all",
                      owned ? "border-green-500/50 bg-green-500/5" : "border-border",
                      !owned && canAfford && "hover:border-amber-500/50"
                    )}
                  >
                    {/* Preview */}
                    <div className={cn(
                      "h-24 rounded-lg mb-3 flex items-center justify-center",
                      bg.className
                    )}>
                      {bg.animated && (
                        <div className="flex items-center gap-2 text-sm text-amber-500">
                          <Sparkles className="h-4 w-4 animate-pulse" />
                          Animované
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{bg.name}</h4>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Star className="h-3 w-3 text-amber-500" />
                          {bg.cost} bodů
                        </div>
                      </div>
                      
                      {owned ? (
                        <Badge variant="secondary" className="bg-green-500/20 text-green-500 border-green-500/30">
                          <Check className="h-3 w-3 mr-1" />
                          Vlastníš
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          disabled={!canAfford || purchasing === bg.id}
                          onClick={() => purchaseItem(bg.id || '', bg.cost || 0, 'background')}
                          className={cn(
                            canAfford 
                              ? "bg-amber-500 hover:bg-amber-600" 
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {purchasing === bg.id ? (
                            <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : !canAfford ? (
                            <>
                              <Lock className="h-3 w-3 mr-1" />
                              Málo bodů
                            </>
                          ) : (
                            'Koupit'
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="emojis" className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {premiumEmojis.map((emoji) => {
                const owned = isOwned(emoji.id);
                const canAfford = userData.total_points >= emoji.cost;
                
                return (
                  <div
                    key={emoji.id}
                    className={cn(
                      "relative rounded-xl border-2 p-4 transition-all text-center",
                      owned ? "border-green-500/50 bg-green-500/5" : "border-border",
                      !owned && canAfford && "hover:border-amber-500/50"
                    )}
                  >
                    {/* Emoji preview */}
                    <div className="h-16 w-16 mx-auto mb-3 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-2xl font-bold">
                      {emoji.name.charAt(4)}
                    </div>
                    
                    <h4 className="font-medium text-sm mb-1 truncate">{emoji.name}</h4>
                    <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-3">
                      <Star className="h-3 w-3 text-amber-500" />
                      {emoji.cost} bodů
                    </div>
                    
                    {owned ? (
                      <Badge variant="secondary" className="bg-green-500/20 text-green-500 border-green-500/30 text-xs">
                        <Check className="h-3 w-3 mr-1" />
                        Vlastníš
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        className="w-full text-xs"
                        disabled={!canAfford || purchasing === emoji.id}
                        onClick={() => purchaseItem(emoji.id, emoji.cost, 'emoji')}
                        variant={canAfford ? "default" : "secondary"}
                      >
                        {purchasing === emoji.id ? (
                          <div className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : !canAfford ? (
                          <Lock className="h-3 w-3" />
                        ) : (
                          'Koupit'
                        )}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>

        {/* Info */}
        <div className="mt-6 p-4 rounded-lg bg-muted/30 border border-border">
          <h4 className="font-medium flex items-center gap-2 mb-2">
            <Crown className="h-4 w-4 text-amber-500" />
            Jak získat body?
          </h4>
          <p className="text-sm text-muted-foreground">
            Body získáváš plněním achievementů - přidávej příspěvky, lajkuj, komentuj a získávej přátele. 
            Každý achievement ti dá body, které můžeš utratit v obchodě.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
