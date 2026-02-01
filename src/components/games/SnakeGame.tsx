import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { Button } from '@/components/ui/button';
import { X, Trophy, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Star } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SnakeGameProps {
  isOpen: boolean;
  onClose: () => void;
}

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type PowerUpType = 'speed' | 'slow' | 'double' | 'shrink';

interface Position {
  x: number;
  y: number;
}

interface PowerUp {
  position: Position;
  type: PowerUpType;
  expiresAt: number;
}

const GRID_SIZE = 15;
const INITIAL_SPEED = 150;

const POWER_UP_CONFIG: Record<PowerUpType, { emoji: string; duration: number; color: string }> = {
  speed: { emoji: '⚡', duration: 5000, color: 'bg-yellow-500' },
  slow: { emoji: '🐌', duration: 5000, color: 'bg-blue-500' },
  double: { emoji: '✨', duration: 8000, color: 'bg-purple-500' },
  shrink: { emoji: '💊', duration: 0, color: 'bg-pink-500' },
};

// Memoized grid cell component
const GridCell = memo(({ 
  isSnakeHead, 
  isSnakeBody, 
  isFood, 
  powerUpType 
}: { 
  isSnakeHead: boolean; 
  isSnakeBody: boolean; 
  isFood: boolean; 
  powerUpType: PowerUpType | null;
}) => {
  const baseClass = 'w-4 h-4 rounded-sm';
  
  if (isSnakeHead) {
    return <div className={`${baseClass} bg-green-400 shadow-lg shadow-green-500/50`} />;
  }
  if (isSnakeBody) {
    return <div className={`${baseClass} bg-green-500`} />;
  }
  if (isFood) {
    return <div className={`${baseClass} bg-red-500 animate-pulse`} />;
  }
  if (powerUpType) {
    return (
      <div className={`${baseClass} ${POWER_UP_CONFIG[powerUpType].color} animate-bounce flex items-center justify-center`}>
        <span className="text-xs">{POWER_UP_CONFIG[powerUpType].emoji}</span>
      </div>
    );
  }
  return <div className={`${baseClass} bg-muted/30`} />;
});

GridCell.displayName = 'GridCell';

export function SnakeGame({ isOpen, onClose }: SnakeGameProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [snake, setSnake] = useState<Position[]>([{ x: 7, y: 7 }]);
  const [food, setFood] = useState<Position>({ x: 5, y: 5 });
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [isPaused, setIsPaused] = useState(true);
  const [powerUp, setPowerUp] = useState<PowerUp | null>(null);
  const [activeEffects, setActiveEffects] = useState<{ type: PowerUpType; endsAt: number }[]>([]);
  const [multiplier, setMultiplier] = useState(1);
  
  const directionRef = useRef<Direction>('RIGHT');
  const speedRef = useRef(INITIAL_SPEED);
  const gameLoopRef = useRef<number>();
  const scoreRef = useRef(0);
  const multiplierRef = useRef(1);
  const foodRef = useRef(food);
  const powerUpRef = useRef<PowerUp | null>(null);

  // Keep refs in sync
  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    multiplierRef.current = multiplier;
  }, [multiplier]);

  useEffect(() => {
    foodRef.current = food;
  }, [food]);

  useEffect(() => {
    powerUpRef.current = powerUp;
  }, [powerUp]);

  useEffect(() => {
    if (isOpen && user) {
      fetchHighScore();
      resetGame();
    }
  }, [isOpen, user]);

  const fetchHighScore = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_game_stats')
      .select('snake_best')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) setHighScore(data.snake_best);
  };

  const saveScore = useCallback(async (newScore: number) => {
    if (!user) return;
    
    const { data: currentData } = await supabase
      .from('user_game_stats')
      .select('snake_best')
      .eq('user_id', user.id)
      .maybeSingle();
    
    const currentBest = currentData?.snake_best || 0;
    if (newScore <= currentBest) return;
    
    await supabase
      .from('user_game_stats')
      .upsert({ 
        user_id: user.id, 
        snake_best: newScore,
        updated_at: new Date().toISOString()
      });
    
    await supabase
      .from('game_scores')
      .insert({ user_id: user.id, game_type: 'snake', score: newScore });

    setHighScore(newScore);
    toast({
      title: '🏆 Nové nejvyšší skóre!',
      description: `Snake: ${newScore} bodů`,
    });
  }, [user, toast]);

  const generateFood = useCallback((snakeBody: Position[]): Position => {
    let newFood: Position;
    do {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
    } while (snakeBody.some(s => s.x === newFood.x && s.y === newFood.y));
    return newFood;
  }, []);

  const generatePowerUp = useCallback((snakeBody: Position[], foodPos: Position): PowerUp | null => {
    if (Math.random() > 0.15) return null;
    
    const types: PowerUpType[] = ['speed', 'slow', 'double', 'shrink'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    let position: Position;
    do {
      position = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
    } while (
      snakeBody.some(s => s.x === position.x && s.y === position.y) ||
      (foodPos.x === position.x && foodPos.y === position.y)
    );
    
    return { position, type, expiresAt: Date.now() + 10000 };
  }, []);

  const resetGame = useCallback(() => {
    const initialSnake = [{ x: 7, y: 7 }];
    setSnake(initialSnake);
    const newFood = generateFood(initialSnake);
    setFood(newFood);
    foodRef.current = newFood;
    directionRef.current = 'RIGHT';
    setGameOver(false);
    setScore(0);
    scoreRef.current = 0;
    setIsPaused(true);
    speedRef.current = INITIAL_SPEED;
    setPowerUp(null);
    powerUpRef.current = null;
    setActiveEffects([]);
    setMultiplier(1);
    multiplierRef.current = 1;
  }, [generateFood]);

  const applyPowerUp = useCallback((type: PowerUpType) => {
    const now = Date.now();
    const config = POWER_UP_CONFIG[type];
    
    switch (type) {
      case 'speed':
        speedRef.current = 80;
        setActiveEffects(prev => [...prev.filter(e => e.type !== 'speed' && e.type !== 'slow'), { type, endsAt: now + config.duration }]);
        break;
      case 'slow':
        speedRef.current = 250;
        setActiveEffects(prev => [...prev.filter(e => e.type !== 'speed' && e.type !== 'slow'), { type, endsAt: now + config.duration }]);
        break;
      case 'double':
        setMultiplier(2);
        multiplierRef.current = 2;
        setActiveEffects(prev => [...prev.filter(e => e.type !== 'double'), { type, endsAt: now + config.duration }]);
        break;
      case 'shrink':
        setSnake(prev => prev.length > 3 ? prev.slice(0, -2) : prev);
        break;
    }
  }, []);

  // Effect expiration check
  useEffect(() => {
    if (!isOpen || gameOver || isPaused) return;
    
    const interval = setInterval(() => {
      const now = Date.now();
      setActiveEffects(prev => {
        const active = prev.filter(e => e.endsAt > now);
        if (active.length !== prev.length) {
          if (!active.some(e => e.type === 'speed' || e.type === 'slow')) {
            speedRef.current = INITIAL_SPEED;
          }
          if (!active.some(e => e.type === 'double')) {
            setMultiplier(1);
            multiplierRef.current = 1;
          }
        }
        return active;
      });
      
      setPowerUp(prev => prev && prev.expiresAt > now ? prev : null);
    }, 500);
    
    return () => clearInterval(interval);
  }, [isOpen, gameOver, isPaused]);

  // Main game loop using requestAnimationFrame
  useEffect(() => {
    if (!isOpen || gameOver || isPaused) {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
        gameLoopRef.current = undefined;
      }
      return;
    }

    let lastTime = performance.now();
    
    const gameLoop = (currentTime: number) => {
      const deltaTime = currentTime - lastTime;
      
      if (deltaTime >= speedRef.current) {
        lastTime = currentTime;
        
        setSnake(prevSnake => {
          const head = { ...prevSnake[0] };
          const dir = directionRef.current;

          switch (dir) {
            case 'UP': head.y -= 1; break;
            case 'DOWN': head.y += 1; break;
            case 'LEFT': head.x -= 1; break;
            case 'RIGHT': head.x += 1; break;
          }

          // Wall collision
          if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
            setGameOver(true);
            saveScore(scoreRef.current);
            return prevSnake;
          }

          // Self collision
          if (prevSnake.some(s => s.x === head.x && s.y === head.y)) {
            setGameOver(true);
            saveScore(scoreRef.current);
            return prevSnake;
          }

          const newSnake = [head, ...prevSnake];
          const currentFood = foodRef.current;
          const currentPowerUp = powerUpRef.current;

          // Food collision
          if (head.x === currentFood.x && head.y === currentFood.y) {
            const points = 10 * multiplierRef.current;
            setScore(s => s + points);
            const newFood = generateFood(newSnake);
            setFood(newFood);
            foodRef.current = newFood;
            
            if (!currentPowerUp) {
              const newPowerUp = generatePowerUp(newSnake, newFood);
              if (newPowerUp) {
                setPowerUp(newPowerUp);
                powerUpRef.current = newPowerUp;
              }
            }
            
            return newSnake;
          }
          
          // PowerUp collision
          if (currentPowerUp && head.x === currentPowerUp.position.x && head.y === currentPowerUp.position.y) {
            applyPowerUp(currentPowerUp.type);
            setPowerUp(null);
            powerUpRef.current = null;
            setScore(s => s + 25 * multiplierRef.current);
          }

          newSnake.pop();
          return newSnake;
        });
      }

      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoopRef.current = requestAnimationFrame(gameLoop);
    
    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [isOpen, gameOver, isPaused, generateFood, generatePowerUp, applyPowerUp, saveScore]);

  // Keyboard controls with preventDefault
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      const keyDirections: Record<string, Direction> = {
        ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT',
        w: 'UP', s: 'DOWN', a: 'LEFT', d: 'RIGHT',
        W: 'UP', S: 'DOWN', A: 'LEFT', D: 'RIGHT',
      };
      
      const newDir = keyDirections[e.key];
      if (!newDir) return;
      
      // Prevent page scrolling
      e.preventDefault();
      
      const opposites: Record<Direction, Direction> = {
        UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT'
      };
      
      if (opposites[newDir] !== directionRef.current) {
        directionRef.current = newDir;
        if (isPaused) setIsPaused(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isOpen, isPaused]);

  const handleDirectionClick = useCallback((dir: Direction) => {
    const opposites: Record<Direction, Direction> = {
      UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT'
    };
    if (opposites[dir] !== directionRef.current) {
      directionRef.current = dir;
      if (isPaused) setIsPaused(false);
    }
  }, [isPaused]);

  if (!isOpen) return null;

  // Pre-calculate positions for O(1) lookup
  const snakeSet = new Set(snake.map(s => `${s.x},${s.y}`));
  const headKey = `${snake[0].x},${snake[0].y}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-3 border-b border-border bg-gradient-to-r from-green-500/10 to-emerald-500/10">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">🐍 Snake</h3>
            {activeEffects.length > 0 && (
              <div className="flex gap-1">
                {activeEffects.map(e => (
                  <span key={e.type} className={`text-xs px-1 rounded ${POWER_UP_CONFIG[e.type].color}`}>
                    {POWER_UP_CONFIG[e.type].emoji}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Trophy className="h-4 w-4 text-yellow-500" />
              <span className="text-sm">{highScore}</span>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="p-2 text-center bg-secondary/30 flex justify-center gap-4">
          <span className="font-bold">Skóre: {score}</span>
          {multiplier > 1 && (
            <span className="text-purple-400 flex items-center gap-1">
              <Star className="h-4 w-4" /> x{multiplier}
            </span>
          )}
          <span className="text-muted-foreground">Délka: {snake.length}</span>
        </div>

        <div className="p-3">
          <div 
            className="grid gap-0.5 bg-secondary/50 p-1 rounded-lg mx-auto"
            style={{ 
              gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
              width: 'fit-content'
            }}
          >
            {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, idx) => {
              const x = idx % GRID_SIZE;
              const y = Math.floor(idx / GRID_SIZE);
              const key = `${x},${y}`;
              const isSnakeHead = key === headKey;
              const isSnakeBody = !isSnakeHead && snakeSet.has(key);
              const isFood = food.x === x && food.y === y;
              const isPowerUpCell = powerUp && powerUp.position.x === x && powerUp.position.y === y;

              return (
                <GridCell
                  key={idx}
                  isSnakeHead={isSnakeHead}
                  isSnakeBody={isSnakeBody}
                  isFood={isFood}
                  powerUpType={isPowerUpCell ? powerUp.type : null}
                />
              );
            })}
          </div>
        </div>

        <div className="px-3 pb-2 flex justify-center gap-2 text-xs text-muted-foreground flex-wrap">
          <span>⚡ Rychlost</span>
          <span>🐌 Zpomalení</span>
          <span>✨ 2x Body</span>
          <span>💊 Zmenšení</span>
        </div>

        <div className="p-3 border-t border-border">
          {gameOver ? (
            <Button onClick={resetGame} className="w-full mb-3">
              Hrát znovu
            </Button>
          ) : isPaused ? (
            <p className="text-center text-sm text-muted-foreground mb-3">
              Stiskni šipku pro start
            </p>
          ) : null}
          
          <div className="grid grid-cols-3 gap-1 w-32 mx-auto">
            <div />
            <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => handleDirectionClick('UP')}>
              <ArrowUp className="h-5 w-5" />
            </Button>
            <div />
            <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => handleDirectionClick('LEFT')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => handleDirectionClick('DOWN')}>
              <ArrowDown className="h-5 w-5" />
            </Button>
            <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => handleDirectionClick('RIGHT')}>
              <ArrowRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
