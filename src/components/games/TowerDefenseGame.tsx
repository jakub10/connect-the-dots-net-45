import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { X, Trophy, Shield, Zap } from 'lucide-react';
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
  damage: number;
  range: number;
}

interface Enemy {
  id: number;
  x: number;
  hp: number;
  maxHp: number;
  speed: number;
}

const GRID_WIDTH = 10;
const GRID_HEIGHT = 6;
const PATH_Y = 2;
const TOWER_COST = 50;

export function TowerDefenseGame({ isOpen, onClose }: TowerDefenseGameProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [towers, setTowers] = useState<Tower[]>([]);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [gold, setGold] = useState(100);
  const [lives, setLives] = useState(10);
  const [wave, setWave] = useState(0);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const enemyIdRef = useRef(0);
  const towerIdRef = useRef(0);

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
    setGold(100);
    setLives(10);
    setWave(0);
    setScore(0);
    setGameOver(false);
    setIsPlaying(false);
    enemyIdRef.current = 0;
    towerIdRef.current = 0;
  };

  const startWave = () => {
    setWave(w => w + 1);
    setIsPlaying(true);
    const enemyCount = 3 + wave;
    const newEnemies: Enemy[] = [];
    
    for (let i = 0; i < enemyCount; i++) {
      newEnemies.push({
        id: enemyIdRef.current++,
        x: -1 - i * 2,
        hp: 30 + wave * 10,
        maxHp: 30 + wave * 10,
        speed: 0.03 + wave * 0.005,
      });
    }
    setEnemies(prev => [...prev, ...newEnemies]);
  };

  const placeTower = (x: number, y: number) => {
    if (y === PATH_Y || gold < TOWER_COST) return;
    if (towers.some(t => t.x === x && t.y === y)) return;
    
    setTowers(prev => [...prev, {
      id: towerIdRef.current++,
      x,
      y,
      damage: 10,
      range: 2,
    }]);
    setGold(g => g - TOWER_COST);
  };

  // Game loop
  useEffect(() => {
    if (!isOpen || gameOver || !isPlaying) return;

    const gameLoop = setInterval(() => {
      setEnemies(prev => {
        let updatedEnemies = prev.map(e => ({
          ...e,
          x: e.x + e.speed,
        }));

        // Tower attacks
        towers.forEach(tower => {
          updatedEnemies = updatedEnemies.map(enemy => {
            const dx = Math.abs(tower.x - enemy.x);
            const dy = Math.abs(tower.y - PATH_Y);
            if (Math.sqrt(dx * dx + dy * dy) <= tower.range && enemy.hp > 0) {
              return { ...enemy, hp: enemy.hp - tower.damage * 0.05 };
            }
            return enemy;
          });
        });

        // Check for dead enemies and passed enemies
        const alive = updatedEnemies.filter(e => {
          if (e.hp <= 0) {
            setGold(g => g + 20);
            setScore(s => s + 100);
            return false;
          }
          if (e.x >= GRID_WIDTH) {
            setLives(l => {
              const newLives = l - 1;
              if (newLives <= 0) {
                setGameOver(true);
                saveScore(score);
              }
              return newLives;
            });
            return false;
          }
          return true;
        });

        if (alive.length === 0 && updatedEnemies.length > 0) {
          setIsPlaying(false);
          setScore(s => s + wave * 50);
        }

        return alive;
      });
    }, 50);

    return () => clearInterval(gameLoop);
  }, [isOpen, gameOver, isPlaying, towers, wave, score]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-orange-500/10 to-red-500/10">
          <div className="flex items-center gap-4">
            <h3 className="font-semibold">🏰 Tower Defense</h3>
            <div className="flex items-center gap-3 text-sm">
              <span>💰 {gold}</span>
              <span>❤️ {lives}</span>
              <span>🌊 Vlna {wave}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-yellow-500" />
            <span className="text-sm">{highScore}</span>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Score */}
        <div className="p-2 text-center bg-secondary/30">
          <span className="font-bold">Skóre: {score}</span>
        </div>

        {/* Game Grid */}
        <div className="p-4">
          <div 
            className="grid gap-1 bg-secondary/30 p-2 rounded-lg"
            style={{ gridTemplateColumns: `repeat(${GRID_WIDTH}, 1fr)` }}
          >
            {Array.from({ length: GRID_WIDTH * GRID_HEIGHT }).map((_, idx) => {
              const x = idx % GRID_WIDTH;
              const y = Math.floor(idx / GRID_WIDTH);
              const tower = towers.find(t => t.x === x && t.y === y);
              const isPath = y === PATH_Y;
              const enemy = enemies.find(e => Math.floor(e.x) === x && y === PATH_Y);

              return (
                <div
                  key={idx}
                  onClick={() => !gameOver && !isPath && placeTower(x, y)}
                  className={`aspect-square rounded flex items-center justify-center text-xs cursor-pointer transition-colors ${
                    isPath ? 'bg-amber-800/50' :
                    tower ? 'bg-blue-500' :
                    'bg-muted/30 hover:bg-muted/50'
                  }`}
                >
                  {tower && <Shield className="h-3 w-3 text-white" />}
                  {enemy && (
                    <div className="relative">
                      <span className="text-red-500">👾</span>
                      <div className="absolute -top-1 left-0 right-0 h-0.5 bg-red-500 rounded">
                        <div 
                          className="h-full bg-green-500 rounded"
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

        {/* Controls */}
        <div className="p-4 border-t border-border flex flex-col gap-2">
          <div className="text-sm text-muted-foreground text-center">
            Klikni na pole (mimo cestu) pro postavení věže ({TOWER_COST} 💰)
          </div>
          {gameOver ? (
            <Button onClick={resetGame} className="w-full">
              Hrát znovu
            </Button>
          ) : !isPlaying ? (
            <Button onClick={startWave} className="w-full">
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
