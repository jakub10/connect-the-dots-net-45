import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Shuffle } from 'lucide-react';

interface AvatarConfig {
  seed: string;
  hair: string;
  hairColor: string;
  skinColor: string;
  eyes: string;
  mouth: string;
  clothing: string;
  clothingColor: string;
  accessories?: string;
  accessoriesColor?: string;
}

const HAIR_STYLES = [
  { id: 'short01', name: 'Krátké 1' },
  { id: 'short02', name: 'Krátké 2' },
  { id: 'short03', name: 'Krátké 3' },
  { id: 'short04', name: 'Krátké 4' },
  { id: 'short05', name: 'Krátké 5' },
  { id: 'long01', name: 'Dlouhé 1' },
  { id: 'long02', name: 'Dlouhé 2' },
  { id: 'long03', name: 'Dlouhé 3' },
  { id: 'long04', name: 'Dlouhé 4' },
  { id: 'long05', name: 'Dlouhé 5' },
  { id: 'long06', name: 'Dlouhé 6' },
  { id: 'long07', name: 'Dlouhé 7' },
  { id: 'long08', name: 'Dlouhé 8' },
  { id: 'long09', name: 'Dlouhé 9' },
  { id: 'long10', name: 'Dlouhé 10' },
  { id: 'long11', name: 'Dlouhé 11' },
];

const HAIR_COLORS = [
  { id: '2c1b18', name: 'Černé' },
  { id: '6c4545', name: 'Hnědé' },
  { id: 'b58143', name: 'Světle hnědé' },
  { id: 'e8e1e1', name: 'Blond' },
  { id: 'f59797', name: 'Růžové' },
  { id: 'd64a3b', name: 'Červené' },
  { id: '4a90d9', name: 'Modré' },
  { id: '77311d', name: 'Zrzavé' },
];

const SKIN_COLORS = [
  { id: 'f2d3b1', name: 'Světlá' },
  { id: 'edb98a', name: 'Střední' },
  { id: 'd08b5b', name: 'Opálená' },
  { id: 'ae5d29', name: 'Tmavší' },
  { id: '614335', name: 'Tmavá' },
];

const EYES = [
  { id: 'variant01', name: 'Normální' },
  { id: 'variant02', name: 'Šťastné' },
  { id: 'variant03', name: 'Překvapené' },
  { id: 'variant04', name: 'Smutné' },
  { id: 'variant05', name: 'Mrkající' },
  { id: 'variant06', name: 'Uzavřené' },
  { id: 'variant07', name: 'Srdíčka' },
  { id: 'variant08', name: 'Hvězdy' },
];

const MOUTHS = [
  { id: 'happy01', name: 'Šťastný' },
  { id: 'happy02', name: 'Úsměv' },
  { id: 'happy03', name: 'Široký úsměv' },
  { id: 'happy04', name: 'Smích' },
  { id: 'happy05', name: 'Zuby' },
  { id: 'happy06', name: 'Jazyk' },
  { id: 'happy07', name: 'Polibek' },
  { id: 'sad01', name: 'Neutrální' },
  { id: 'sad02', name: 'Zamračený' },
  { id: 'sad03', name: 'Překvapený' },
];

const CLOTHING = [
  { id: 'shirt01', name: 'Tričko' },
  { id: 'shirt02', name: 'Košile' },
  { id: 'shirt03', name: 'Mikina' },
  { id: 'dress01', name: 'Šaty 1' },
  { id: 'dress02', name: 'Šaty 2' },
];

const CLOTHING_COLORS = [
  { id: '6dbb58', name: 'Zelená' },
  { id: '5199e4', name: 'Modrá' },
  { id: 'e24b4b', name: 'Červená' },
  { id: 'f3c63a', name: 'Žlutá' },
  { id: 'a55eea', name: 'Fialová' },
  { id: 'fc5c9c', name: 'Růžová' },
  { id: '26de81', name: 'Mint' },
  { id: 'fd9644', name: 'Oranžová' },
  { id: '4b4b4b', name: 'Černá' },
  { id: 'ffffff', name: 'Bílá' },
];

const ACCESSORIES = [
  { id: '', name: 'Žádné' },
  { id: 'glasses01', name: 'Brýle 1' },
  { id: 'glasses02', name: 'Brýle 2' },
  { id: 'glasses03', name: 'Sluneční brýle' },
];

const defaultConfig: AvatarConfig = {
  seed: '',
  hair: 'short01',
  hairColor: '6c4545',
  skinColor: 'f2d3b1',
  eyes: 'variant01',
  mouth: 'happy01',
  clothing: 'shirt01',
  clothingColor: '6dbb58',
  accessories: '',
  accessoriesColor: '4b4b4b',
};

export function AvatarBuilder() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [config, setConfig] = useState<AvatarConfig>(defaultConfig);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      if (!user) return;
      
      const { data } = await supabase
        .from('profiles')
        .select('avatar_config')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (data?.avatar_config && typeof data.avatar_config === 'object') {
        const configData = data.avatar_config as Record<string, unknown>;
        setConfig({ 
          ...defaultConfig, 
          seed: String(configData.seed || ''),
          hair: String(configData.hair || defaultConfig.hair),
          hairColor: String(configData.hairColor || defaultConfig.hairColor),
          skinColor: String(configData.skinColor || defaultConfig.skinColor),
          eyes: String(configData.eyes || defaultConfig.eyes),
          mouth: String(configData.mouth || defaultConfig.mouth),
          clothing: String(configData.clothing || defaultConfig.clothing),
          clothingColor: String(configData.clothingColor || defaultConfig.clothingColor),
          accessories: String(configData.accessories || ''),
          accessoriesColor: String(configData.accessoriesColor || defaultConfig.accessoriesColor),
        });
      }
      setLoading(false);
    };
    fetchConfig();
  }, [user]);

  const getAvatarUrl = (cfg: AvatarConfig) => {
    const params = new URLSearchParams({
      hair: cfg.hair,
      hairColor: cfg.hairColor,
      skinColor: cfg.skinColor,
      eyes: cfg.eyes,
      mouth: cfg.mouth,
      clothing: cfg.clothing,
      clothingColor: cfg.clothingColor,
    });
    
    if (cfg.accessories) {
      params.set('accessories', cfg.accessories);
      params.set('accessoriesColor', cfg.accessoriesColor || '4b4b4b');
    }
    
    const seed = cfg.seed || user?.id || 'default';
    return `https://api.dicebear.com/7.x/big-smile/svg?seed=${seed}&${params.toString()}`;
  };

  const handleRandomize = () => {
    const randomChoice = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
    
    setConfig({
      seed: Math.random().toString(36).substring(7),
      hair: randomChoice(HAIR_STYLES).id,
      hairColor: randomChoice(HAIR_COLORS).id,
      skinColor: randomChoice(SKIN_COLORS).id,
      eyes: randomChoice(EYES).id,
      mouth: randomChoice(MOUTHS).id,
      clothing: randomChoice(CLOTHING).id,
      clothingColor: randomChoice(CLOTHING_COLORS).id,
      accessories: randomChoice(ACCESSORIES).id,
      accessoriesColor: randomChoice(CLOTHING_COLORS).id,
    });
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    const avatarUrl = getAvatarUrl(config);

    // Convert config to a plain object for JSON storage
    const configForStorage = {
      seed: config.seed,
      hair: config.hair,
      hairColor: config.hairColor,
      skinColor: config.skinColor,
      eyes: config.eyes,
      mouth: config.mouth,
      clothing: config.clothing,
      clothingColor: config.clothingColor,
      accessories: config.accessories,
      accessoriesColor: config.accessoriesColor,
    };

    const { error } = await supabase
      .from('profiles')
      .update({ 
        avatar_config: configForStorage,
        avatar_url: avatarUrl
      })
      .eq('user_id', user.id);

    if (error) {
      toast({
        title: 'Chyba',
        description: 'Nepodařilo se uložit avatar.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Uloženo!',
        description: 'Tvůj avatar byl aktualizován.',
      });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const renderColorPicker = (
    colors: { id: string; name: string }[],
    selected: string,
    onChange: (id: string) => void
  ) => (
    <div className="flex flex-wrap gap-2">
      {colors.map((color) => (
        <button
          key={color.id}
          onClick={() => onChange(color.id)}
          className={`w-8 h-8 rounded-full border-2 transition-all ${
            selected === color.id ? 'border-primary scale-110' : 'border-transparent hover:scale-105'
          }`}
          style={{ backgroundColor: `#${color.id}` }}
          title={color.name}
        />
      ))}
    </div>
  );

  const renderOptionPicker = (
    options: { id: string; name: string }[],
    selected: string,
    onChange: (id: string) => void
  ) => (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.id}
          onClick={() => onChange(option.id)}
          className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
            selected === option.id
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted hover:bg-muted/80'
          }`}
        >
          {option.name}
        </button>
      ))}
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Vytvoř si avatar</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRandomize}>
              <Shuffle className="h-4 w-4 mr-2" />
              Náhodný
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Uložit
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Avatar Preview */}
          <div className="flex flex-col items-center gap-4">
            <div className="w-48 h-48 rounded-full overflow-hidden bg-gradient-to-br from-primary/20 to-accent/20 p-2">
              <img
                src={getAvatarUrl(config)}
                alt="Avatar preview"
                className="w-full h-full rounded-full"
              />
            </div>
            <p className="text-sm text-muted-foreground">Náhled avataru</p>
          </div>

          {/* Customization Options */}
          <Tabs defaultValue="hair" className="w-full">
            <TabsList className="grid grid-cols-4 mb-4">
              <TabsTrigger value="hair">Vlasy</TabsTrigger>
              <TabsTrigger value="face">Obličej</TabsTrigger>
              <TabsTrigger value="clothing">Oblečení</TabsTrigger>
              <TabsTrigger value="accessories">Doplňky</TabsTrigger>
            </TabsList>

            <TabsContent value="hair" className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Styl vlasů</Label>
                {renderOptionPicker(HAIR_STYLES, config.hair, (id) => setConfig({ ...config, hair: id }))}
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Barva vlasů</Label>
                {renderColorPicker(HAIR_COLORS, config.hairColor, (id) => setConfig({ ...config, hairColor: id }))}
              </div>
            </TabsContent>

            <TabsContent value="face" className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Barva pleti</Label>
                {renderColorPicker(SKIN_COLORS, config.skinColor, (id) => setConfig({ ...config, skinColor: id }))}
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Oči</Label>
                {renderOptionPicker(EYES, config.eyes, (id) => setConfig({ ...config, eyes: id }))}
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Ústa</Label>
                {renderOptionPicker(MOUTHS, config.mouth, (id) => setConfig({ ...config, mouth: id }))}
              </div>
            </TabsContent>

            <TabsContent value="clothing" className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Typ oblečení</Label>
                {renderOptionPicker(CLOTHING, config.clothing, (id) => setConfig({ ...config, clothing: id }))}
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Barva oblečení</Label>
                {renderColorPicker(CLOTHING_COLORS, config.clothingColor, (id) => setConfig({ ...config, clothingColor: id }))}
              </div>
            </TabsContent>

            <TabsContent value="accessories" className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Doplňky</Label>
                {renderOptionPicker(ACCESSORIES, config.accessories || '', (id) => setConfig({ ...config, accessories: id }))}
              </div>
              {config.accessories && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Barva doplňků</Label>
                  {renderColorPicker(CLOTHING_COLORS, config.accessoriesColor || '4b4b4b', (id) => setConfig({ ...config, accessoriesColor: id }))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </CardContent>
    </Card>
  );
}
