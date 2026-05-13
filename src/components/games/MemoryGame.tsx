import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Trophy, RotateCcw, Clock, Zap } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface MemoryGameProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Card {
  id: number;
  emoji: string;
  isFlipped: boolean;
  isMatched: boolean;
}

type Difficulty = 'easy' | 'medium' | 'hard';

const EMOJI_SETS = {
  animals: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🦁', '🐯', '🐮'],
  food: ['🍎', '🍕', '🍔', '🍟', '🌮', '🍣', '🍩', '🍪', '🧁', '🍫', '🍿', '🥤'],
  sports: ['⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🎱', '🏓', '🥊', '🏆', '🎯', '🎮'],
};

const DIFFICULTIES: Record<Difficulty, { pairs: number; cols: number; timeBonus: number }> = {
  easy: { pairs: 6, cols: 4, timeBonus: 50 },
  medium: { pairs: 8, cols: 4, timeBonus: 100 },
  hard: { pairs: 12, cols: 6, timeBonus: 200 },
};

export function MemoryGame({ isOpen, onClose }: MemoryGameProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [cards, setCards] = useState<Card[]>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [matches, setMatches] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [isChecking, setIsChecking] = useState(false);
  const [gameComplete, setGameComplete] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [emojiSet, setEmojiSet] = useState<keyof typeof EMOJI_SETS>('animals');
  const [timer, setTimer] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [combo, setCombo] = useState(0);
  const [lastScore, setLastScore] = useState(0);

  useEffect(() => {
    if (isOpen) {
      fetchHighScore();
    }
  }, [isOpen, user]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && !gameComplete) {
      interval = setInterval(() => setTimer(t => t + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, gameComplete]);

  const fetchHighScore = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_game_stats')
      .select('memory_best')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) setHighScore(data.memory_best);
  };

  const calculateScore = (finalMoves: number, finalTime: number, finalCombo: number): number => {
    const config = DIFFICULTIES[difficulty];
    const baseScore = config.pairs * 100;
    const movesPenalty = finalMoves * 5;
    const timePenalty = Math.floor(finalTime / 2);
    const comboBonus = finalCombo * 25;
    const timeBonus = finalTime < config.pairs * 5 ? config.timeBonus : 0;
    
    return Math.max(0, baseScore - movesPenalty - timePenalty + comboBonus + timeBonus);
  };

  const saveScore = async (finalScore: number) => {
    if (!user) return;
    
    if (highScore === 0 || finalScore > highScore) {
      await supabase.rpc('submit_game_score', { _game_type: 'memory', _score: finalScore });

      setHighScore(finalScore);
      toast({
        title: '🏆 Nové nejvyšší skóre!',
        description: `Paměťová hra: ${finalScore} bodů`,
      });
    }
  };

  const initializeGame = () => {
    const config = DIFFICULTIES[difficulty];
    const emojis = EMOJI_SETS[emojiSet].slice(0, config.pairs);
    
    const shuffled = [...emojis, ...emojis]
      .sort(() => Math.random() - 0.5)
      .map((emoji, idx) => ({
        id: idx,
        emoji,
        isFlipped: false,
        isMatched: false,
      }));
    
    setCards(shuffled);
    setFlippedCards([]);
    setMoves(0);
    setMatches(0);
    setGameComplete(false);
    setTimer(0);
    setIsPlaying(false);
    setCombo(0);
    setLastScore(0);
  };

  useEffect(() => {
    if (isOpen) initializeGame();
  }, [isOpen, difficulty, emojiSet]);

  const handleCardClick = (id: number) => {
    if (isChecking) return;
    if (flippedCards.includes(id)) return;
    if (cards[id].isMatched) return;
    if (flippedCards.length >= 2) return;

    if (!isPlaying) setIsPlaying(true);

    const newFlipped = [...flippedCards, id];
    setFlippedCards(newFlipped);
    setCards(prev => prev.map(card => 
      card.id === id ? { ...card, isFlipped: true } : card
    ));

    if (newFlipped.length === 2) {
      setMoves(m => m + 1);
      setIsChecking(true);

      const [first, second] = newFlipped;
      if (cards[first].emoji === cards[second].emoji) {
        // Match found
        const newCombo = combo + 1;
        setCombo(newCombo);
        
        setTimeout(() => {
          setCards(prev => prev.map(card =>
            card.id === first || card.id === second
              ? { ...card, isMatched: true }
              : card
          ));
          setMatches(m => {
            const newMatches = m + 1;
            if (newMatches === DIFFICULTIES[difficulty].pairs) {
              setGameComplete(true);
              setIsPlaying(false);
              const finalScore = calculateScore(moves + 1, timer, newCombo);
              setLastScore(finalScore);
              saveScore(finalScore);
            }
            return newMatches;
          });
          setFlippedCards([]);
          setIsChecking(false);
        }, 500);
      } else {
        // No match - reset combo
        setCombo(0);
        setTimeout(() => {
          setCards(prev => prev.map(card =>
            card.id === first || card.id === second
              ? { ...card, isFlipped: false }
              : card
          ));
          setFlippedCards([]);
          setIsChecking(false);
        }, 1000);
      }
    }
  };

  if (!isOpen) return null;

  const config = DIFFICULTIES[difficulty];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border bg-gradient-to-r from-blue-500/10 to-cyan-500/10">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">🧠 Paměťová hra</h3>
            {combo > 1 && (
              <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded animate-pulse">
                🔥 x{combo}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-sm">
              <Trophy className="h-4 w-4 text-yellow-500" />
              {highScore}
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Settings */}
        {!isPlaying && !gameComplete && (
          <div className="p-2 border-b border-border bg-secondary/20 flex flex-wrap justify-center gap-2">
            <div className="flex gap-1">
              {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`px-2 py-1 rounded text-xs transition-colors ${
                    difficulty === d ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  {d === 'easy' ? 'Lehká' : d === 'medium' ? 'Střední' : 'Těžká'}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              {(Object.keys(EMOJI_SETS) as (keyof typeof EMOJI_SETS)[]).map(set => (
                <button
                  key={set}
                  onClick={() => setEmojiSet(set)}
                  className={`px-2 py-1 rounded text-xs transition-colors ${
                    emojiSet === set ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  {set === 'animals' ? '🐶' : set === 'food' ? '🍕' : '⚽'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="p-2 text-center bg-secondary/30 flex justify-center gap-4 text-sm">
          <span className="flex items-center gap-1">
            <Zap className="h-4 w-4" /> {moves} tahů
          </span>
          <span>🎯 {matches}/{config.pairs}</span>
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" /> {timer}s
          </span>
        </div>

        {/* Game Grid */}
        <div className="p-3">
          <div 
            className="grid gap-2 mx-auto"
            style={{ 
              gridTemplateColumns: `repeat(${config.cols}, 1fr)`,
              maxWidth: config.cols * 56 + (config.cols - 1) * 8
            }}
          >
            {cards.map(card => (
              <button
                key={card.id}
                onClick={() => handleCardClick(card.id)}
                disabled={card.isMatched || card.isFlipped}
                className={`aspect-square rounded-lg text-2xl flex items-center justify-center transition-all duration-300 transform ${
                  card.isFlipped || card.isMatched
                    ? 'bg-primary/20 scale-100'
                    : 'bg-primary hover:bg-primary/80 hover:scale-105'
                } ${card.isMatched ? 'opacity-50 scale-95' : ''}`}
                style={{ minWidth: 48, minHeight: 48 }}
              >
                {card.isFlipped || card.isMatched ? card.emoji : '❓'}
              </button>
            ))}
          </div>
        </div>

        {/* Game Complete */}
        {gameComplete && (
          <div className="p-4 text-center bg-green-500/10 border-t border-border">
            <p className="text-lg font-bold text-green-500">🎉 Gratuluji!</p>
            <p className="text-sm text-muted-foreground">
              {moves} tahů • {timer}s • Combo: {combo}
            </p>
            <p className="text-xl font-bold mt-2">Skóre: {lastScore}</p>
          </div>
        )}

        {/* Reset Button */}
        <div className="p-3 border-t border-border">
          <Button onClick={initializeGame} className="w-full" variant="outline">
            <RotateCcw className="h-4 w-4 mr-2" />
            Nová hra
          </Button>
        </div>
      </div>
    </div>
  );
}
