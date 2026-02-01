import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { X, Trophy, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SnakeGameProps {
  isOpen: boolean;
  onClose: () => void;
}

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type Position = { x: number; y: number };

const GRID_SIZE = 15;
const INITIAL_SPEED = 150;

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
  const directionRef = useRef<Direction>('RIGHT');

  useEffect(() => {
    if (isOpen) {
      fetchHighScore();
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
    } while (snakeBody.some(segment => segment.x === newFood.x && segment.y === newFood.y));
    return newFood;
  }, []);

  const resetGame = () => {
    setSnake([{ x: 7, y: 7 }]);
    setFood({ x: 5, y: 5 });
    setDirection('RIGHT');
    directionRef.current = 'RIGHT';
    setGameOver(false);
    setScore(0);
    setIsPaused(true);
  };

  const moveSnake = useCallback(() => {
    if (gameOver || isPaused) return;

    setSnake(prevSnake => {
      const head = { ...prevSnake[0] };
      const currentDir = directionRef.current;

      switch (currentDir) {
        case 'UP': head.y -= 1; break;
        case 'DOWN': head.y += 1; break;
        case 'LEFT': head.x -= 1; break;
        case 'RIGHT': head.x += 1; break;
      }

      // Check wall collision
      if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
        setGameOver(true);
        saveScore(score);
        return prevSnake;
      }

      // Check self collision
      if (prevSnake.some(segment => segment.x === head.x && segment.y === head.y)) {
        setGameOver(true);
        saveScore(score);
        return prevSnake;
      }

      const newSnake = [head, ...prevSnake];

      // Check food
      if (head.x === food.x && head.y === food.y) {
        setScore(s => s + 10);
        setFood(generateFood(newSnake));
      } else {
        newSnake.pop();
      }

      return newSnake;
    });
  }, [food, gameOver, isPaused, generateFood, score]);

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(moveSnake, INITIAL_SPEED);
    return () => clearInterval(interval);
  }, [moveSnake, isOpen]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;
    
    const key = e.key;
    const currentDir = directionRef.current;
    
    if (key === 'ArrowUp' && currentDir !== 'DOWN') {
      directionRef.current = 'UP';
      setDirection('UP');
    } else if (key === 'ArrowDown' && currentDir !== 'UP') {
      directionRef.current = 'DOWN';
      setDirection('DOWN');
    } else if (key === 'ArrowLeft' && currentDir !== 'RIGHT') {
      directionRef.current = 'LEFT';
      setDirection('LEFT');
    } else if (key === 'ArrowRight' && currentDir !== 'LEFT') {
      directionRef.current = 'RIGHT';
      setDirection('RIGHT');
    } else if (key === ' ') {
      if (gameOver) {
        resetGame();
      } else {
        setIsPaused(p => !p);
      }
    }
  }, [isOpen, gameOver]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleDirectionButton = (newDir: Direction) => {
    const currentDir = directionRef.current;
    if (
      (newDir === 'UP' && currentDir !== 'DOWN') ||
      (newDir === 'DOWN' && currentDir !== 'UP') ||
      (newDir === 'LEFT' && currentDir !== 'RIGHT') ||
      (newDir === 'RIGHT' && currentDir !== 'LEFT')
    ) {
      directionRef.current = newDir;
      setDirection(newDir);
      if (isPaused && !gameOver) setIsPaused(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-green-500/10 to-emerald-500/10">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">🐍 Snake</h3>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm">
              <Trophy className="h-4 w-4 inline mr-1 text-yellow-500" />
              {highScore}
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Score */}
        <div className="p-2 text-center bg-secondary/30">
          <span className="font-bold text-lg">Skóre: {score}</span>
        </div>

        {/* Game Grid */}
        <div className="p-4 flex justify-center">
          <div 
            className="grid gap-0.5 bg-secondary/50 p-1 rounded-lg"
            style={{ 
              gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
              width: 'min(300px, 80vw)',
              height: 'min(300px, 80vw)'
            }}
          >
            {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, idx) => {
              const x = idx % GRID_SIZE;
              const y = Math.floor(idx / GRID_SIZE);
              const isSnake = snake.some(s => s.x === x && s.y === y);
              const isHead = snake[0].x === x && snake[0].y === y;
              const isFood = food.x === x && food.y === y;

              return (
                <div
                  key={idx}
                  className={`aspect-square rounded-sm ${
                    isHead ? 'bg-green-600' :
                    isSnake ? 'bg-green-500' :
                    isFood ? 'bg-red-500' :
                    'bg-muted/30'
                  }`}
                />
              );
            })}
          </div>
        </div>

        {/* Overlay */}
        {(gameOver || isPaused) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="text-center text-white">
              {gameOver ? (
                <>
                  <p className="text-2xl font-bold mb-2">Konec hry!</p>
                  <p className="mb-4">Skóre: {score}</p>
                  <Button onClick={resetGame}>Hrát znovu</Button>
                </>
              ) : (
                <>
                  <p className="text-xl font-bold mb-4">Pauza</p>
                  <Button onClick={() => setIsPaused(false)}>Pokračovat</Button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Mobile Controls */}
        <div className="p-4 flex flex-col items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => handleDirectionButton('UP')}>
            <ArrowUp className="h-5 w-5" />
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => handleDirectionButton('LEFT')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => handleDirectionButton('DOWN')}>
              <ArrowDown className="h-5 w-5" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => handleDirectionButton('RIGHT')}>
              <ArrowRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
