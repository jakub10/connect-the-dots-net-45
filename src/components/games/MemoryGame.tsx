import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Trophy, RotateCcw } from 'lucide-react';
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

const EMOJIS = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼'];

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

  useEffect(() => {
    if (isOpen) {
      fetchHighScore();
      initializeGame();
    }
  }, [isOpen, user]);

  const fetchHighScore = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_game_stats')
      .select('memory_best')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) setHighScore(data.memory_best);
  };

  const saveScore = async (finalMoves: number) => {
    if (!user) return;
    
    // Lower moves is better, so we save if it's a new record or first play
    const score = 1000 - finalMoves * 10; // Convert to points
    
    if (highScore === 0 || score > highScore) {
      await supabase
        .from('user_game_stats')
        .upsert({ 
          user_id: user.id, 
          memory_best: score,
          updated_at: new Date().toISOString()
        });
      
      await supabase
        .from('game_scores')
        .insert({ user_id: user.id, game_type: 'memory', score });

      setHighScore(score);
      toast({
        title: '🏆 Nové nejvyšší skóre!',
        description: `Paměťová hra: ${score} bodů (${finalMoves} tahů)`,
      });
    }
  };

  const initializeGame = () => {
    const shuffled = [...EMOJIS, ...EMOJIS]
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
  };

  const handleCardClick = (id: number) => {
    if (isChecking) return;
    if (flippedCards.includes(id)) return;
    if (cards[id].isMatched) return;
    if (flippedCards.length >= 2) return;

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
        setTimeout(() => {
          setCards(prev => prev.map(card =>
            card.id === first || card.id === second
              ? { ...card, isMatched: true }
              : card
          ));
          setMatches(m => {
            const newMatches = m + 1;
            if (newMatches === EMOJIS.length) {
              setGameComplete(true);
              saveScore(moves + 1);
            }
            return newMatches;
          });
          setFlippedCards([]);
          setIsChecking(false);
        }, 500);
      } else {
        // No match
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-blue-500/10 to-cyan-500/10">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">🧠 Paměťová hra</h3>
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

        {/* Stats */}
        <div className="p-2 text-center bg-secondary/30 flex justify-center gap-6">
          <span>Tahy: {moves}</span>
          <span>Páry: {matches}/{EMOJIS.length}</span>
        </div>

        {/* Game Grid */}
        <div className="p-4">
          <div className="grid grid-cols-4 gap-2">
            {cards.map(card => (
              <button
                key={card.id}
                onClick={() => handleCardClick(card.id)}
                disabled={card.isMatched || card.isFlipped}
                className={`aspect-square rounded-lg text-2xl flex items-center justify-center transition-all duration-300 ${
                  card.isFlipped || card.isMatched
                    ? 'bg-primary/20 rotate-0'
                    : 'bg-primary hover:bg-primary/80 rotate-y-180'
                } ${card.isMatched ? 'opacity-50' : ''}`}
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
            <p className="text-sm text-muted-foreground">Dokončeno za {moves} tahů</p>
          </div>
        )}

        {/* Reset Button */}
        <div className="p-4 border-t border-border">
          <Button onClick={initializeGame} className="w-full" variant="outline">
            <RotateCcw className="h-4 w-4 mr-2" />
            Nová hra
          </Button>
        </div>
      </div>
    </div>
  );
}
