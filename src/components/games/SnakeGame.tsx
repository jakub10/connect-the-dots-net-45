import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { X, Trophy, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Zap, Star } from 'lucide-react';
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

export function SnakeGame({ isOpen, onClose }: SnakeGameProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [snake, setSnake] = useState<Position[]>([{ x: 7, y: 7 }]);
  const [food, setFood] = useState<Position>({ x: 5, y: 5 });
  const [direction, setDirection] = useState<Direction>('RIGHT');
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [isPaused, setIsPaused] = useState(true);
  const [speed, setSpeed] = useState(INITIAL_SPEED);
  const [powerUp, setPowerUp] = useState<PowerUp | null>(null);
  const [activeEffects, setActiveEffects] = useState<{ type: PowerUpType; endsAt: number }[]>([]);
  const [multiplier, setMultiplier] = useState(1);
  
  const directionRef = useRef(direction);
  const gameLoopRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    directionRef.current = direction;
  }, [direction]);

  useEffect(() => {
    if (isOpen) {
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

  const saveScore = async (newScore: number) => {
    if (!user || newScore <= highScore) return;
    
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
  };

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

  const resetGame = () => {
    const initialSnake = [{ x: 7, y: 7 }];
    setSnake(initialSnake);
    setFood(generateFood(initialSnake));
    setDirection('RIGHT');
    setGameOver(false);
    setScore(0);
    setIsPaused(true);
    setSpeed(INITIAL_SPEED);
    setPowerUp(null);
    setActiveEffects([]);
    setMultiplier(1);
  };

  const applyPowerUp = (type: PowerUpType) => {
    const now = Date.now();
    const config = POWER_UP_CONFIG[type];
    
    switch (type) {
      case 'speed':
        setSpeed(80);
        setActiveEffects(prev => [...prev.filter(e => e.type !== 'speed' && e.type !== 'slow'), { type, endsAt: now + config.duration }]);
        break;
      case 'slow':
        setSpeed(250);
        setActiveEffects(prev => [...prev.filter(e => e.type !== 'speed' && e.type !== 'slow'), { type, endsAt: now + config.duration }]);
        break;
      case 'double':
        setMultiplier(2);
        setActiveEffects(prev => [...prev.filter(e => e.type !== 'double'), { type, endsAt: now + config.duration }]);
        break;
      case 'shrink':
        setSnake(prev => prev.length > 3 ? prev.slice(0, -2) : prev);
        break;
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setActiveEffects(prev => {
        const active = prev.filter(e => e.endsAt > now);
        if (active.length !== prev.length) {
          if (!active.some(e => e.type === 'speed' || e.type === 'slow')) {
            setSpeed(INITIAL_SPEED);
          }
          if (!active.some(e => e.type === 'double')) {
            setMultiplier(1);
          }
        }
        return active;
      });
      
      setPowerUp(prev => prev && prev.expiresAt > now ? prev : null);
    }, 100);
    
    return () => clearInterval(interval);
  }, []);

  const moveSnake = useCallback(() => {
    if (gameOver || isPaused) return;

    setSnake(prevSnake => {
      const head = { ...prevSnake[0] };
      const dir = directionRef.current;

      switch (dir) {
        case 'UP': head.y -= 1; break;
        case 'DOWN': head.y += 1; break;
        case 'LEFT': head.x -= 1; break;
        case 'RIGHT': head.x += 1; break;
      }

      if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
        setGameOver(true);
        saveScore(score);
        return prevSnake;
      }

      if (prevSnake.some(s => s.x === head.x && s.y === head.y)) {
        setGameOver(true);
        saveScore(score);
        return prevSnake;
      }

      const newSnake = [head, ...prevSnake];

      if (head.x === food.x && head.y === food.y) {
        const points = 10 * multiplier;
        setScore(s => s + points);
        const newFood = generateFood(newSnake);
        setFood(newFood);
        
        if (!powerUp) {
          const newPowerUp = generatePowerUp(newSnake, newFood);
          if (newPowerUp) setPowerUp(newPowerUp);
        }
        
        return newSnake;
      }
      
      if (powerUp && head.x === powerUp.position.x && head.y === powerUp.position.y) {
        applyPowerUp(powerUp.type);
        setPowerUp(null);
        setScore(s => s + 25 * multiplier);
      }

      newSnake.pop();
      return newSnake;
    });
  }, [gameOver, isPaused, food, powerUp, score, multiplier, generateFood, generatePowerUp]);

  useEffect(() => {
    if (!isOpen || gameOver || isPaused) {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
      return;
    }

    gameLoopRef.current = setInterval(moveSnake, speed);
    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [isOpen, gameOver, isPaused, speed, moveSnake]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;
    
    const keyDirections: Record<string, Direction> = {
      ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT',
      w: 'UP', s: 'DOWN', a: 'LEFT', d: 'RIGHT',
    };
    
    const newDir = keyDirections[e.key];
    if (!newDir) return;
    
    const opposites: Record<Direction, Direction> = {
      UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT'
    };
    
    if (opposites[newDir] !== directionRef.current) {
      setDirection(newDir);
      if (isPaused) setIsPaused(false);
    }
  }, [isOpen, isPaused]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleDirectionClick = (dir: Direction) => {
    const opposites: Record<Direction, Direction> = {
      UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT'
    };
    if (opposites[dir] !== directionRef.current) {
      setDirection(dir);
      if (isPaused) setIsPaused(false);
    }
  };

  if (!isOpen) return null;

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
              const isSnakeHead = snake[0].x === x && snake[0].y === y;
              const isSnakeBody = snake.slice(1).some(s => s.x === x && s.y === y);
              const isFood = food.x === x && food.y === y;
              const isPowerUpCell = powerUp && powerUp.position.x === x && powerUp.position.y === y;

              return (
                <div
                  key={idx}
                  className={`w-4 h-4 rounded-sm transition-colors ${
                    isSnakeHead ? 'bg-green-400 shadow-lg shadow-green-500/50' :
                    isSnakeBody ? 'bg-green-500' :
                    isFood ? 'bg-red-500 animate-pulse' :
                    isPowerUpCell ? `${POWER_UP_CONFIG[powerUp.type].color} animate-bounce` :
                    'bg-muted/30'
                  }`}
                >
                  {isPowerUpCell && (
                    <span className="flex items-center justify-center text-xs">
                      {POWER_UP_CONFIG[powerUp.type].emoji}
                    </span>
                  )}
                </div>
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
