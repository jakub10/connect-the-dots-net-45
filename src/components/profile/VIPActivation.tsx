import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Crown, Loader2, Check, Star } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';

export function VIPActivation() {
  const { isVIP, activateVIP, loading } = useUserRole();
  const [code, setCode] = useState('');
  const [activating, setActivating] = useState(false);

  const handleActivate = async () => {
    if (!code.trim()) return;
    setActivating(true);
    await activateVIP(code.trim());
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

  if (isVIP) {
    return (
      <Card className="border-yellow-500/50 bg-gradient-to-br from-yellow-500/5 to-orange-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-500" />
            VIP Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-green-500">
            <Check className="h-5 w-5" />
            <span className="font-medium">VIP je aktivní!</span>
          </div>
          <div className="mt-4 space-y-2">
            <h4 className="font-medium text-sm">Vaše VIP výhody:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li className="flex items-center gap-2">
                <Star className="h-3 w-3 text-yellow-500" /> Speciální VIP odznak
              </li>
              <li className="flex items-center gap-2">
                <Star className="h-3 w-3 text-yellow-500" /> Neomezené příběhy
              </li>
              <li className="flex items-center gap-2">
                <Star className="h-3 w-3 text-yellow-500" /> Vlastní témata
              </li>
              <li className="flex items-center gap-2">
                <Star className="h-3 w-3 text-yellow-500" /> Prioritní podpora
              </li>
              <li className="flex items-center gap-2">
                <Star className="h-3 w-3 text-yellow-500" /> Exkluzivní hry
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-yellow-500" />
          Aktivovat VIP
        </CardTitle>
        <CardDescription>
          Zadejte VIP kód pro aktivaci prémiových funkcí
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Zadejte VIP kód..."
          type="password"
        />
        <Button 
          onClick={handleActivate} 
          disabled={!code.trim() || activating}
          className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
        >
          {activating ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Crown className="h-4 w-4 mr-2" />
          )}
          Aktivovat VIP
        </Button>
      </CardContent>
    </Card>
  );
}