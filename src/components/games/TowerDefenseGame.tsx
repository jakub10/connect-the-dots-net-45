import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { X, Trophy, Shield, Zap, Flame, Snowflake, Target } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TowerDefenseGameProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Tower {
  id: number;
  x: number;
  y: number;
  type: 'basic' | 'fire' | 'ice' | 'sniper';
  damage: number;
  range: number;
  fireRate: number;
  lastFire: number;
}

interface Enemy {
  id: number;
  x: number;
  hp: number;
  maxHp: number;
  speed: number;
  type: 'normal' | 'fast' | 'tank' | 'boss';
  frozen: number;
  reward: number;
}

const GRID_WIDTH = 12;
const GRID_HEIGHT = 7;
const PATH_Y = 3;

const TOWER_TYPES = {
  basic: { cost: 50, damage: 15, range: 2, fireRate: 500, icon: Shield, color: 'bg-blue-500', name: 'Základní' },
  fire: { cost: 100, damage: 25, range: 1.5, fireRate: 300, icon: Flame, color: 'bg-orange-500', name: 'Ohnivá' },
  ice: { cost: 80, damage: 10, range: 2.5, fireRate: 800, icon: Snowflake, color: 'bg-cyan-400', name: 'Ledová' },
  sniper: { cost: 150, damage: 50, range: 4, fireRate: 1500, icon: Target, color: 'bg-purple-500', name: 'Sniper' },
};

const ENEMY_TYPES = {
  normal: { hp: 50, speed: 0.02, emoji: '👾', reward: 15 },
  fast: { hp: 30, speed: 0.04, emoji: '🦇', reward: 20 },
  tank: { hp: 150, speed: 0.01, emoji: '🤖', reward: 40 },
  boss: { hp: 500, speed: 0.008, emoji: '👹', reward: 200 },
};

export function TowerDefenseGame({ isOpen, onClose }: TowerDefenseGameProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [towers, setTowers] = useState<Tower[]>([]);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [gold, setGold] = useState(150);
  const [lives, setLives] = useState(20);
  const [wave, setWave] = useState(0);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedTower, setSelectedTower] = useState<keyof typeof TOWER_TYPES>('basic');
  const enemyIdRef = useRef(0);
  const towerIdRef = useRef(0);
  const gameTimeRef = useRef(0);

  useEffect(() => {
    if (isOpen) fetchHighScore();
  }, [isOpen, user]);

  const fetchHighScore = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_game_stats')
      .select('tower_defense_best')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) setHighScore(data.tower_defense_best);
  };

  const saveScore = async (newScore: number) => {
    if (!user || newScore <= highScore) return;
    
    await supabase
      .from('user_game_stats')
      .upsert({ 
        user_id: user.id, 
        tower_defense_best: newScore,
        updated_at: new Date().toISOString()
      });
    
    await supabase
      .from('game_scores')
      .insert({ user_id: user.id, game_type: 'tower_defense', score: newScore });

    setHighScore(newScore);
    toast({
      title: '🏆 Nové nejvyšší skóre!',
      description: `Tower Defense: ${newScore} bodů`,
    });
  };

  const resetGame = () => {
    setTowers([]);
    setEnemies([]);
    setGold(150);
    setLives(20);
    setWave(0);
    setScore(0);
    setGameOver(false);
    setIsPlaying(false);
    enemyIdRef.current = 0;
    towerIdRef.current = 0;
    gameTimeRef.current = 0;
  };

  const spawnEnemies = (waveNum: number) => {
    const newEnemies: Enemy[] = [];
    const baseCount = 3 + Math.floor(waveNum / 2);
    
    // Normal enemies
    for (let i = 0; i < baseCount; i++) {
      const type = ENEMY_TYPES.normal;
      newEnemies.push({
        id: enemyIdRef.current++,
        x: -1 - i * 1.5,
        hp: type.hp + waveNum * 5,
        maxHp: type.hp + waveNum * 5,
        speed: type.speed,
        type: 'normal',
        frozen: 0,
        reward: type.reward,
      });
    }
    
    // Fast enemies from wave 2
    if (waveNum >= 2) {
      const fastCount = Math.floor(waveNum / 2);
      for (let i = 0; i < fastCount; i++) {
        const type = ENEMY_TYPES.fast;
        newEnemies.push({
          id: enemyIdRef.current++,
          x: -2 - (baseCount + i) * 1.5,
          hp: type.hp + waveNum * 3,
          maxHp: type.hp + waveNum * 3,
          speed: type.speed,
          type: 'fast',
          frozen: 0,
          reward: type.reward,
        });
      }
    }
    
    // Tank enemies from wave 3
    if (waveNum >= 3 && waveNum % 2 === 1) {
      const type = ENEMY_TYPES.tank;
      newEnemies.push({
        id: enemyIdRef.current++,
        x: -3 - (baseCount + 2) * 1.5,
        hp: type.hp + waveNum * 20,
        maxHp: type.hp + waveNum * 20,
        speed: type.speed,
        type: 'tank',
        frozen: 0,
        reward: type.reward,
      });
    }
    
    // Boss every 5 waves
    if (waveNum > 0 && waveNum % 5 === 0) {
      const type = ENEMY_TYPES.boss;
      newEnemies.push({
        id: enemyIdRef.current++,
        x: -5 - (baseCount + 3) * 1.5,
        hp: type.hp + waveNum * 50,
        maxHp: type.hp + waveNum * 50,
        speed: type.speed,
        type: 'boss',
        frozen: 0,
        reward: type.reward,
      });
    }
    
    return newEnemies;
  };

  const startWave = () => {
    const newWave = wave + 1;
    setWave(newWave);
    setIsPlaying(true);
    const newEnemies = spawnEnemies(newWave);
    setEnemies(prev => [...prev, ...newEnemies]);
  };

  const placeTower = (x: number, y: number) => {
    if (y === PATH_Y || gameOver) return;
    if (towers.some(t => t.x === x && t.y === y)) return;
    
    const towerType = TOWER_TYPES[selectedTower];
    if (gold < towerType.cost) return;
    
    setTowers(prev => [...prev, {
      id: towerIdRef.current++,
      x,
      y,
      type: selectedTower,
      damage: towerType.damage,
      range: towerType.range,
      fireRate: towerType.fireRate,
      lastFire: 0,
    }]);
    setGold(g => g - towerType.cost);
  };

  // Game loop
  useEffect(() => {
    if (!isOpen || gameOver || !isPlaying) return;

    const gameLoop = setInterval(() => {
      gameTimeRef.current += 50;
      const now = gameTimeRef.current;

      setEnemies(prev => {
        let updatedEnemies = prev.map(e => {
          const speedMod = e.frozen > now ? 0.3 : 1;
          return {
            ...e,
            x: e.x + e.speed * speedMod,
          };
        });

        // Tower attacks
        setTowers(currentTowers => {
          return currentTowers.map(tower => {
            if (now - tower.lastFire < tower.fireRate) return tower;
            
            // Find closest enemy in range
            let closestEnemy: Enemy | null = null;
            let closestDist = Infinity;
            
            updatedEnemies.forEach(enemy => {
              if (enemy.hp <= 0) return;
              const dx = Math.abs(tower.x - enemy.x);
              const dy = Math.abs(tower.y - PATH_Y);
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist <= tower.range && dist < closestDist) {
                closestDist = dist;
                closestEnemy = enemy;
              }
            });
            
            if (closestEnemy) {
              updatedEnemies = updatedEnemies.map(e => {
                if (e.id === closestEnemy!.id) {
                  const newHp = e.hp - tower.damage;
                  // Ice tower freezes enemies
                  const frozen = tower.type === 'ice' ? now + 2000 : e.frozen;
                  return { ...e, hp: newHp, frozen };
                }
                return e;
              });
              return { ...tower, lastFire: now };
            }
            return tower;
          });
        });

        // Check for dead enemies and passed enemies
        const alive = updatedEnemies.filter(e => {
          if (e.hp <= 0) {
            setGold(g => g + e.reward);
            setScore(s => s + e.reward * 5);
            return false;
          }
          if (e.x >= GRID_WIDTH) {
            setLives(l => {
              const damage = e.type === 'boss' ? 5 : e.type === 'tank' ? 2 : 1;
              const newLives = l - damage;
              if (newLives <= 0) {
                setGameOver(true);
                saveScore(score);
              }
              return Math.max(0, newLives);
            });
            return false;
          }
          return true;
        });

        if (alive.length === 0 && updatedEnemies.length > 0) {
          setIsPlaying(false);
          setScore(s => s + wave * 100);
          setGold(g => g + wave * 25);
        }

        return alive;
      });
    }, 50);

    return () => clearInterval(gameLoop);
  }, [isOpen, gameOver, isPlaying, wave, score]);

  if (!isOpen) return null;

  const currentTowerType = TOWER_TYPES[selectedTower];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border bg-gradient-to-r from-orange-500/10 to-red-500/10">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-sm">🏰 Tower Defense</h3>
            <div className="flex items-center gap-2 text-xs">
              <span className="bg-yellow-500/20 px-2 py-0.5 rounded">💰 {gold}</span>
              <span className="bg-red-500/20 px-2 py-0.5 rounded">❤️ {lives}</span>
              <span className="bg-blue-500/20 px-2 py-0.5 rounded">🌊 {wave}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-yellow-500" />
            <span className="text-xs">{highScore}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Tower Selection */}
        <div className="p-2 border-b border-border bg-secondary/20">
          <div className="flex gap-1 justify-center flex-wrap">
            {(Object.entries(TOWER_TYPES) as [keyof typeof TOWER_TYPES, typeof TOWER_TYPES.basic][]).map(([key, tower]) => {
              const Icon = tower.icon;
              const canAfford = gold >= tower.cost;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedTower(key)}
                  disabled={!canAfford}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-all ${
                    selectedTower === key 
                      ? 'ring-2 ring-primary bg-primary/20' 
                      : canAfford 
                        ? 'bg-muted/50 hover:bg-muted' 
                        : 'opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className={`w-5 h-5 rounded ${tower.color} flex items-center justify-center`}>
                    <Icon className="h-3 w-3 text-white" />
                  </div>
                  <span>{tower.name}</span>
                  <span className="text-yellow-500">{tower.cost}💰</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Score */}
        <div className="p-1 text-center bg-secondary/30">
          <span className="font-bold text-sm">Skóre: {score}</span>
        </div>

        {/* Game Grid */}
        <div className="p-2">
          <div 
            className="grid gap-0.5 bg-secondary/30 p-1 rounded-lg"
            style={{ gridTemplateColumns: `repeat(${GRID_WIDTH}, 1fr)` }}
          >
            {Array.from({ length: GRID_WIDTH * GRID_HEIGHT }).map((_, idx) => {
              const x = idx % GRID_WIDTH;
              const y = Math.floor(idx / GRID_WIDTH);
              const tower = towers.find(t => t.x === x && t.y === y);
              const isPath = y === PATH_Y;
              const enemy = enemies.find(e => Math.floor(e.x) === x && y === PATH_Y);
              const TowerIcon = tower ? TOWER_TYPES[tower.type].icon : null;

              return (
                <div
                  key={idx}
                  onClick={() => !gameOver && !isPath && placeTower(x, y)}
                  className={`aspect-square rounded-sm flex items-center justify-center text-xs cursor-pointer transition-colors relative ${
                    isPath ? 'bg-amber-800/50 border border-amber-700/30' :
                    tower ? TOWER_TYPES[tower.type].color :
                    'bg-muted/20 hover:bg-muted/40 border border-transparent hover:border-primary/30'
                  }`}
                >
                  {TowerIcon && <TowerIcon className="h-3 w-3 text-white" />}
                  {enemy && (
                    <div className="relative z-10">
                      <span className={`${enemy.type === 'boss' ? 'text-lg' : 'text-sm'}`}>
                        {ENEMY_TYPES[enemy.type].emoji}
                      </span>
                      <div className="absolute -top-1 left-0 right-0 h-0.5 bg-red-900 rounded overflow-hidden">
                        <div 
                          className={`h-full rounded transition-all ${
                            enemy.frozen > gameTimeRef.current ? 'bg-cyan-400' : 'bg-green-500'
                          }`}
                          style={{ width: `${(enemy.hp / enemy.maxHp) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Enemy Legend */}
        <div className="px-3 pb-1 flex justify-center gap-3 text-xs text-muted-foreground">
          <span>👾 Normální</span>
          <span>🦇 Rychlý</span>
          <span>🤖 Tank</span>
          <span>👹 Boss</span>
        </div>

        {/* Controls */}
        <div className="p-3 border-t border-border flex flex-col gap-2">
          {gameOver ? (
            <Button onClick={resetGame} className="w-full">
              Hrát znovu
            </Button>
          ) : !isPlaying ? (
            <Button onClick={startWave} className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600">
              <Zap className="h-4 w-4 mr-2" />
              Spustit vlnu {wave + 1}
            </Button>
          ) : (
            <Button disabled className="w-full">
              Vlna probíhá...
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
