import { useState, useEffect, useCallback, useRef, memo } from 'react';
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
  type: 'normal' | 'fast' | 'tank' | 'boss' | 'healer' | 'armored';
  frozen: number;
  reward: number;
}

interface Projectile {
  id: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  type: 'basic' | 'fire' | 'ice' | 'sniper';
  createdAt: number;
}

const GRID_WIDTH = 16; // Longer track
const GRID_HEIGHT = 9;
const PATH_Y = 4;

const TOWER_TYPES = {
  basic: { cost: 50, damage: 20, range: 2.5, fireRate: 400, icon: Shield, color: 'bg-blue-500', name: 'Základní' },
  fire: { cost: 100, damage: 35, range: 2, fireRate: 250, icon: Flame, color: 'bg-orange-500', name: 'Ohnivá' },
  ice: { cost: 80, damage: 12, range: 3, fireRate: 600, icon: Snowflake, color: 'bg-cyan-400', name: 'Ledová' },
  sniper: { cost: 150, damage: 75, range: 5, fireRate: 1200, icon: Target, color: 'bg-purple-500', name: 'Sniper' },
};

const ENEMY_TYPES = {
  normal: { hp: 60, speed: 0.025, emoji: '👾', reward: 15 },
  fast: { hp: 35, speed: 0.05, emoji: '🦇', reward: 20 },
  tank: { hp: 180, speed: 0.012, emoji: '🤖', reward: 45 },
  boss: { hp: 600, speed: 0.008, emoji: '👹', reward: 200 },
  healer: { hp: 80, speed: 0.02, emoji: '💚', reward: 35 },
  armored: { hp: 120, speed: 0.018, emoji: '🛡️', reward: 50 },
};

// Projectile component
const ProjectileComponent = memo(({ projectile, gameTime }: { projectile: Projectile; gameTime: number }) => {
  const progress = Math.min(1, (gameTime - projectile.createdAt) / 150);
  const x = projectile.fromX + (projectile.toX - projectile.fromX) * progress;
  const y = projectile.fromY + (projectile.toY - projectile.fromY) * progress;
  
  const colors = {
    basic: 'bg-blue-400',
    fire: 'bg-orange-400',
    ice: 'bg-cyan-300',
    sniper: 'bg-purple-400',
  };

  return (
    <div
      className={`absolute w-2 h-2 rounded-full ${colors[projectile.type]} shadow-lg z-20`}
      style={{
        left: `${(x / GRID_WIDTH) * 100}%`,
        top: `${(y / GRID_HEIGHT) * 100}%`,
        transform: 'translate(-50%, -50%)',
        opacity: 1 - progress * 0.3,
      }}
    />
  );
});

ProjectileComponent.displayName = 'ProjectileComponent';

// Memoized grid cell
const GridCell = memo(({ 
  isPath, 
  tower, 
  onClick 
}: { 
  isPath: boolean;
  tower: Tower | undefined;
  onClick: () => void;
}) => {
  const TowerIcon = tower ? TOWER_TYPES[tower.type].icon : null;
  
  return (
    <div
      onClick={onClick}
      className={`aspect-square rounded-sm flex items-center justify-center text-xs cursor-pointer transition-colors relative ${
        isPath ? 'bg-amber-800/50 border border-amber-700/30' :
        tower ? TOWER_TYPES[tower.type].color :
        'bg-muted/20 hover:bg-muted/40 border border-transparent hover:border-primary/30'
      }`}
    >
      {TowerIcon && <TowerIcon className="h-3 w-3 text-white" />}
      {tower && (
        <div 
          className="absolute inset-0 rounded-full border border-current opacity-10 pointer-events-none"
          style={{
            width: `${tower.range * 200}%`,
            height: `${tower.range * 200}%`,
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />
      )}
    </div>
  );
});

GridCell.displayName = 'GridCell';

// Enemy component with smooth movement
const EnemyComponent = memo(({ enemy, gameTime }: { enemy: Enemy; gameTime: number }) => {
  const isFrozen = enemy.frozen > gameTime;
  const hpPercent = (enemy.hp / enemy.maxHp) * 100;
  
  return (
    <div
      className="absolute z-10 flex flex-col items-center transition-transform"
      style={{
        left: `${(enemy.x / GRID_WIDTH) * 100}%`,
        top: `${(PATH_Y / GRID_HEIGHT) * 100}%`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div className="w-6 h-1 bg-red-900 rounded overflow-hidden mb-0.5">
        <div 
          className={`h-full rounded transition-all ${isFrozen ? 'bg-cyan-400' : 'bg-green-500'}`}
          style={{ width: `${hpPercent}%` }}
        />
      </div>
      <span className={`${enemy.type === 'boss' ? 'text-xl' : 'text-base'} ${isFrozen ? 'opacity-60' : ''}`}>
        {ENEMY_TYPES[enemy.type].emoji}
      </span>
    </div>
  );
});

EnemyComponent.displayName = 'EnemyComponent';

export function TowerDefenseGame({ isOpen, onClose }: TowerDefenseGameProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [towers, setTowers] = useState<Tower[]>([]);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const [gold, setGold] = useState(150);
  const [lives, setLives] = useState(20);
  const [wave, setWave] = useState(0);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedTower, setSelectedTower] = useState<keyof typeof TOWER_TYPES>('basic');
  const [gameTime, setGameTime] = useState(0);
  
  const enemyIdRef = useRef(0);
  const towerIdRef = useRef(0);
  const projectileIdRef = useRef(0);
  const gameTimeRef = useRef(0);
  const scoreRef = useRef(0);
  const waveRef = useRef(0);
  const gameLoopRef = useRef<number>();
  const towersRef = useRef<Tower[]>([]);
  const lastFrameTimeRef = useRef(0);

  // Keep refs in sync
  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    waveRef.current = wave;
  }, [wave]);

  useEffect(() => {
    towersRef.current = towers;
  }, [towers]);

  useEffect(() => {
    if (isOpen && user) fetchHighScore();
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

  const saveScore = useCallback(async (newScore: number) => {
    if (!user) return;
    
    const { data: currentData } = await supabase
      .from('user_game_stats')
      .select('tower_defense_best')
      .eq('user_id', user.id)
      .maybeSingle();
    
    const currentBest = currentData?.tower_defense_best || 0;
    if (newScore <= currentBest) return;
    
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
  }, [user, toast]);

  const resetGame = useCallback(() => {
    setTowers([]);
    setEnemies([]);
    setProjectiles([]);
    setGold(150);
    setLives(20);
    setWave(0);
    setScore(0);
    setGameOver(false);
    setIsPlaying(false);
    setGameTime(0);
    enemyIdRef.current = 0;
    towerIdRef.current = 0;
    projectileIdRef.current = 0;
    gameTimeRef.current = 0;
    scoreRef.current = 0;
    waveRef.current = 0;
    lastFrameTimeRef.current = 0;
  }, []);

  const spawnEnemies = useCallback((waveNum: number): Enemy[] => {
    const newEnemies: Enemy[] = [];
    const baseCount = 4 + Math.floor(waveNum / 2);
    
    // Normal enemies
    for (let i = 0; i < baseCount; i++) {
      const type = ENEMY_TYPES.normal;
      newEnemies.push({
        id: enemyIdRef.current++,
        x: -1 - i * 1.8,
        hp: type.hp + waveNum * 8,
        maxHp: type.hp + waveNum * 8,
        speed: type.speed,
        type: 'normal',
        frozen: 0,
        reward: type.reward,
      });
    }
    
    // Fast enemies from wave 2
    if (waveNum >= 2) {
      const fastCount = Math.floor(waveNum / 2) + 1;
      for (let i = 0; i < fastCount; i++) {
        const type = ENEMY_TYPES.fast;
        newEnemies.push({
          id: enemyIdRef.current++,
          x: -2 - (baseCount + i) * 1.8,
          hp: type.hp + waveNum * 5,
          maxHp: type.hp + waveNum * 5,
          speed: type.speed,
          type: 'fast',
          frozen: 0,
          reward: type.reward,
        });
      }
    }
    
    // Tank enemies from wave 3
    if (waveNum >= 3) {
      const tankCount = Math.floor(waveNum / 3);
      for (let i = 0; i < tankCount; i++) {
        const type = ENEMY_TYPES.tank;
        newEnemies.push({
          id: enemyIdRef.current++,
          x: -3 - (baseCount + 4 + i) * 2,
          hp: type.hp + waveNum * 25,
          maxHp: type.hp + waveNum * 25,
          speed: type.speed,
          type: 'tank',
          frozen: 0,
          reward: type.reward,
        });
      }
    }

    // Healer enemies from wave 4
    if (waveNum >= 4 && waveNum % 2 === 0) {
      const type = ENEMY_TYPES.healer;
      newEnemies.push({
        id: enemyIdRef.current++,
        x: -4 - (baseCount + 6) * 1.8,
        hp: type.hp + waveNum * 10,
        maxHp: type.hp + waveNum * 10,
        speed: type.speed,
        type: 'healer',
        frozen: 0,
        reward: type.reward,
      });
    }

    // Armored enemies from wave 5
    if (waveNum >= 5) {
      const type = ENEMY_TYPES.armored;
      newEnemies.push({
        id: enemyIdRef.current++,
        x: -5 - (baseCount + 7) * 1.8,
        hp: type.hp + waveNum * 15,
        maxHp: type.hp + waveNum * 15,
        speed: type.speed,
        type: 'armored',
        frozen: 0,
        reward: type.reward,
      });
    }
    
    // Boss every 5 waves
    if (waveNum > 0 && waveNum % 5 === 0) {
      const type = ENEMY_TYPES.boss;
      newEnemies.push({
        id: enemyIdRef.current++,
        x: -6 - (baseCount + 8) * 2,
        hp: type.hp + waveNum * 80,
        maxHp: type.hp + waveNum * 80,
        speed: type.speed,
        type: 'boss',
        frozen: 0,
        reward: type.reward,
      });
    }
    
    return newEnemies;
  }, []);

  const startWave = useCallback(() => {
    const newWave = waveRef.current + 1;
    setWave(newWave);
    waveRef.current = newWave;
    setIsPlaying(true);
    const newEnemies = spawnEnemies(newWave);
    setEnemies(prev => [...prev, ...newEnemies]);
  }, [spawnEnemies]);

  const placeTower = useCallback((x: number, y: number) => {
    if (y === PATH_Y || gameOver) return;
    
    const towerType = TOWER_TYPES[selectedTower];
    
    setGold(currentGold => {
      if (currentGold < towerType.cost) return currentGold;
      
      setTowers(prevTowers => {
        if (prevTowers.some(t => t.x === x && t.y === y)) {
          return prevTowers;
        }
        
        return [...prevTowers, {
          id: towerIdRef.current++,
          x,
          y,
          type: selectedTower,
          damage: towerType.damage,
          range: towerType.range,
          fireRate: towerType.fireRate,
          lastFire: 0,
        }];
      });
      
      return currentGold - towerType.cost;
    });
  }, [gameOver, selectedTower]);

  // Game loop using requestAnimationFrame with smooth movement
  useEffect(() => {
    if (!isOpen || gameOver || !isPlaying) {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
        gameLoopRef.current = undefined;
      }
      return;
    }

    const gameLoop = (currentTime: number) => {
      if (lastFrameTimeRef.current === 0) {
        lastFrameTimeRef.current = currentTime;
      }
      
      const deltaTime = currentTime - lastFrameTimeRef.current;
      lastFrameTimeRef.current = currentTime;
      
      // Update game time
      gameTimeRef.current += deltaTime;
      const now = gameTimeRef.current;
      setGameTime(now);

      // Move enemies smoothly based on delta time
      setEnemies(prevEnemies => {
        let updatedEnemies = prevEnemies.map(e => {
          const speedMod = e.frozen > now ? 0.3 : 1;
          const movement = e.speed * speedMod * (deltaTime / 16.67); // Normalize to 60fps
          return {
            ...e,
            x: e.x + movement,
          };
        });

        // Process tower attacks using ref
        const currentTowers = towersRef.current;
        const newTowers: Tower[] = [];
        const newProjectiles: Projectile[] = [];
        
        currentTowers.forEach(tower => {
          if (now - tower.lastFire < tower.fireRate) {
            newTowers.push(tower);
            return;
          }
          
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
            // Create projectile
            newProjectiles.push({
              id: projectileIdRef.current++,
              fromX: tower.x + 0.5,
              fromY: tower.y + 0.5,
              toX: closestEnemy.x,
              toY: PATH_Y + 0.5,
              type: tower.type,
              createdAt: now,
            });

            // Apply damage to enemy
            updatedEnemies = updatedEnemies.map(e => {
              if (e.id === closestEnemy!.id) {
                // Armored enemies take 50% less damage from basic towers
                let damage = tower.damage;
                if (e.type === 'armored' && tower.type === 'basic') {
                  damage = Math.floor(damage * 0.5);
                }
                // Fire does extra damage to tanks
                if (e.type === 'tank' && tower.type === 'fire') {
                  damage = Math.floor(damage * 1.5);
                }
                const newHp = e.hp - damage;
                const frozen = tower.type === 'ice' ? now + 2000 : e.frozen;
                return { ...e, hp: newHp, frozen };
              }
              return e;
            });
            newTowers.push({ ...tower, lastFire: now });
          } else {
            newTowers.push(tower);
          }
        });
        
        // Update towers and projectiles
        if (newTowers.some((t, i) => t.lastFire !== currentTowers[i]?.lastFire)) {
          setTowers(newTowers);
        }
        if (newProjectiles.length > 0) {
          setProjectiles(prev => [...prev.filter(p => now - p.createdAt < 200), ...newProjectiles]);
        }

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
                saveScore(scoreRef.current);
              }
              return Math.max(0, newLives);
            });
            return false;
          }
          return true;
        });

        if (alive.length === 0 && updatedEnemies.length > 0) {
          setIsPlaying(false);
          setScore(s => s + waveRef.current * 100);
          setGold(g => g + waveRef.current * 25);
        }

        return alive;
      });

      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoopRef.current = requestAnimationFrame(gameLoop);
    
    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [isOpen, gameOver, isPlaying, saveScore]);

  if (!isOpen) return null;

  const currentTowerType = TOWER_TYPES[selectedTower];

  // Pre-create tower map for O(1) lookup
  const towerMap = new Map(towers.map(t => [`${t.x},${t.y}`, t]));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
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
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-5 w-5" />
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
        <div className="p-2 relative">
          <div 
            className="grid gap-0.5 bg-secondary/30 p-1 rounded-lg relative"
            style={{ gridTemplateColumns: `repeat(${GRID_WIDTH}, 1fr)` }}
          >
            {Array.from({ length: GRID_WIDTH * GRID_HEIGHT }).map((_, idx) => {
              const x = idx % GRID_WIDTH;
              const y = Math.floor(idx / GRID_WIDTH);
              const key = `${x},${y}`;
              const tower = towerMap.get(key);
              const isPath = y === PATH_Y;

              return (
                <GridCell
                  key={idx}
                  isPath={isPath}
                  tower={tower}
                  onClick={() => !gameOver && !isPath && placeTower(x, y)}
                />
              );
            })}
            
            {/* Render enemies on top of grid */}
            {enemies.map(enemy => (
              <EnemyComponent key={enemy.id} enemy={enemy} gameTime={gameTime} />
            ))}
            
            {/* Render projectiles */}
            {projectiles.map(p => (
              <ProjectileComponent key={p.id} projectile={p} gameTime={gameTime} />
            ))}
          </div>
        </div>

        {/* Enemy Legend */}
        <div className="px-3 pb-1 flex justify-center gap-2 text-xs text-muted-foreground flex-wrap">
          <span>👾 Normální</span>
          <span>🦇 Rychlý</span>
          <span>🤖 Tank</span>
          <span>💚 Léčitel</span>
          <span>🛡️ Obrněný</span>
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
