import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { X, Trophy, Star, Zap, Crown, Heart, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface VIPPuzzleGameProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Tile {
  id: number;
  value: number;
  x: number;
  y: number;
}

export function VIPPuzzleGame({ isOpen, onClose }: VIPPuzzleGameProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const gameRef = useRef<HTMLDivElement>(null);

  const GRID_SIZE = 4;

  const initGame = useCallback(() => {
    const newTiles: Tile[] = [];
    addRandomTile(newTiles);
    addRandomTile(newTiles);
    setTiles(newTiles);
    setScore(0);
    setGameOver(false);
    setWon(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      initGame();
      fetchBestScore();
    }
  }, [isOpen, initGame]);

  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        handleMove(e.key as 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, tiles]);

  // Touch swipe controls for mobile
  useEffect(() => {
    if (!isOpen) return;
    const el = gameRef.current;
    if (!el) return;

    let startX = 0, startY = 0, startedAt = 0;
    const MIN_DIST = 24;

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      startedAt = Date.now();
    };
    const onMove = (e: TouchEvent) => {
      // prevent page scroll while swiping the board
      e.preventDefault();
    };
    const onEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (Math.abs(dx) < MIN_DIST && Math.abs(dy) < MIN_DIST) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        handleMove(dx > 0 ? 'ArrowRight' : 'ArrowLeft');
      } else {
        handleMove(dy > 0 ? 'ArrowDown' : 'ArrowUp');
      }
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
    };
  }, [isOpen, tiles]);

  const fetchBestScore = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_game_stats')
      .select('memory_best')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) setBestScore(data.memory_best);
  };

  const saveScore = async (newScore: number) => {
    if (!user || newScore <= bestScore) return;
    
    await supabase.rpc('submit_game_score', { _game_type: 'memory', _score: newScore });
    
    setBestScore(newScore);
  };

  const addRandomTile = (currentTiles: Tile[]) => {
    const emptyCells: { x: number; y: number }[] = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      for (let y = 0; y < GRID_SIZE; y++) {
        if (!currentTiles.find(t => t.x === x && t.y === y)) {
          emptyCells.push({ x, y });
        }
      }
    }
    
    if (emptyCells.length > 0) {
      const { x, y } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
      currentTiles.push({
        id: Date.now() + Math.random(),
        value: Math.random() < 0.9 ? 2 : 4,
        x,
        y,
      });
    }
  };

  const handleMove = (direction: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight') => {
    if (gameOver) return;

    let newTiles = [...tiles];
    let moved = false;
    let newScore = score;

    const getVector = () => {
      switch (direction) {
        case 'ArrowUp': return { x: 0, y: -1 };
        case 'ArrowDown': return { x: 0, y: 1 };
        case 'ArrowLeft': return { x: -1, y: 0 };
        case 'ArrowRight': return { x: 1, y: 0 };
      }
    };

    const vector = getVector();
    
    // Sort tiles based on direction
    const sortedTiles = [...newTiles].sort((a, b) => {
      if (vector.x === 1) return b.x - a.x;
      if (vector.x === -1) return a.x - b.x;
      if (vector.y === 1) return b.y - a.y;
      if (vector.y === -1) return a.y - b.y;
      return 0;
    });

    const mergedIds = new Set<number>();
    
    for (const tile of sortedTiles) {
      let newX = tile.x;
      let newY = tile.y;
      
      while (true) {
        const nextX = newX + vector.x;
        const nextY = newY + vector.y;
        
        if (nextX < 0 || nextX >= GRID_SIZE || nextY < 0 || nextY >= GRID_SIZE) break;
        
        const blockingTile = newTiles.find(t => t.x === nextX && t.y === nextY && t.id !== tile.id);
        
        if (blockingTile) {
          if (blockingTile.value === tile.value && !mergedIds.has(blockingTile.id)) {
            // Merge
            blockingTile.value *= 2;
            newScore += blockingTile.value;
            mergedIds.add(blockingTile.id);
            newTiles = newTiles.filter(t => t.id !== tile.id);
            moved = true;
            
            if (blockingTile.value === 2048 && !won) {
              setWon(true);
              toast({ title: '🎉 Výhra!', description: 'Dosáhl(a) jsi 2048!' });
            }
          }
          break;
        }
        
        newX = nextX;
        newY = nextY;
      }
      
      if (tile.x !== newX || tile.y !== newY) {
        tile.x = newX;
        tile.y = newY;
        moved = true;
      }
    }

    if (moved) {
      addRandomTile(newTiles);
      setTiles(newTiles);
      setScore(newScore);
      
      // Check game over
      const hasEmptyCell = newTiles.length < GRID_SIZE * GRID_SIZE;
      if (!hasEmptyCell) {
        let canMove = false;
        for (const tile of newTiles) {
          const neighbors = [
            newTiles.find(t => t.x === tile.x + 1 && t.y === tile.y),
            newTiles.find(t => t.x === tile.x - 1 && t.y === tile.y),
            newTiles.find(t => t.x === tile.x && t.y === tile.y + 1),
            newTiles.find(t => t.x === tile.x && t.y === tile.y - 1),
          ];
          if (neighbors.some(n => n && n.value === tile.value)) {
            canMove = true;
            break;
          }
        }
        if (!canMove) {
          setGameOver(true);
          saveScore(newScore);
        }
      }
    }
  };

  const getTileColor = (value: number) => {
    const colors: Record<number, string> = {
      2: 'bg-amber-100 text-amber-900',
      4: 'bg-amber-200 text-amber-900',
      8: 'bg-orange-300 text-white',
      16: 'bg-orange-400 text-white',
      32: 'bg-orange-500 text-white',
      64: 'bg-red-500 text-white',
      128: 'bg-yellow-400 text-white',
      256: 'bg-yellow-500 text-white',
      512: 'bg-yellow-600 text-white',
      1024: 'bg-amber-500 text-white',
      2048: 'bg-gradient-to-br from-purple-500 to-pink-500 text-white',
    };
    return colors[value] || 'bg-gradient-to-br from-purple-600 to-pink-600 text-white';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-amber-500/30 rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 relative overflow-hidden">
        {/* VIP decoration */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-yellow-500 to-orange-500" />
        
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <Crown className="h-6 w-6 text-amber-500" />
            <h2 className="text-xl font-bold">VIP 2048</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Scores */}
        <div className="flex justify-between mb-4">
          <div className="bg-muted rounded-lg px-4 py-2 text-center">
            <p className="text-xs text-muted-foreground">Skóre</p>
            <p className="text-xl font-bold text-amber-500">{score}</p>
          </div>
          <div className="bg-muted rounded-lg px-4 py-2 text-center">
            <p className="text-xs text-muted-foreground">Nejlepší</p>
            <p className="text-xl font-bold">{Math.max(bestScore, score)}</p>
          </div>
        </div>

        {/* Game Grid */}
        <div 
          ref={gameRef}
          className="relative bg-muted rounded-xl p-2 aspect-square"
          style={{ touchAction: 'none' }}
        >
          {/* Grid background */}
          <div className="grid grid-cols-4 gap-2 absolute inset-2">
            {Array.from({ length: 16 }).map((_, i) => (
              <div key={i} className="bg-muted-foreground/10 rounded-lg" />
            ))}
          </div>
          
          {/* Tiles */}
          <div className="relative w-full h-full">
            {tiles.map(tile => (
              <div
                key={tile.id}
                className={cn(
                  "absolute rounded-lg flex items-center justify-center font-bold transition-all duration-100",
                  getTileColor(tile.value),
                  tile.value >= 1024 ? 'text-lg' : 'text-2xl'
                )}
                style={{
                  width: 'calc(25% - 6px)',
                  height: 'calc(25% - 6px)',
                  left: `calc(${tile.x * 25}% + 4px)`,
                  top: `calc(${tile.y * 25}% + 4px)`,
                }}
              >
                {tile.value}
              </div>
            ))}
          </div>

          {/* Game Over Overlay */}
          {gameOver && (
            <div className="absolute inset-0 bg-black/60 rounded-xl flex flex-col items-center justify-center">
              <Trophy className="h-12 w-12 text-amber-500 mb-2" />
              <p className="text-xl font-bold text-white mb-1">Konec hry!</p>
              <p className="text-amber-500 mb-4">Skóre: {score}</p>
              <Button onClick={initGame} className="bg-amber-500 hover:bg-amber-600">
                Hrát znovu
              </Button>
            </div>
          )}
        </div>

        {/* Controls hint */}
        <p className="text-center text-xs text-muted-foreground mt-4">
          Použij šipky ← ↑ → ↓ nebo přejížděj prstem
        </p>

        {/* On-screen D-pad for mobile */}
        <div className="grid grid-cols-3 gap-2 mt-3 sm:hidden max-w-[180px] mx-auto">
          <div />
          <Button variant="outline" size="icon" onClick={() => handleMove('ArrowUp')}>↑</Button>
          <div />
          <Button variant="outline" size="icon" onClick={() => handleMove('ArrowLeft')}>←</Button>
          <Button variant="outline" size="icon" onClick={() => handleMove('ArrowDown')}>↓</Button>
          <Button variant="outline" size="icon" onClick={() => handleMove('ArrowRight')}>→</Button>
        </div>

        {/* New Game Button */}
        <Button onClick={initGame} variant="outline" className="w-full mt-4">
          <Sparkles className="h-4 w-4 mr-2" />
          Nová hra
        </Button>
      </div>
    </div>
  );
}
