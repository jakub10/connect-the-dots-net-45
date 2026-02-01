import { useState } from 'react';
import { Bot, Gamepad2, Brain, MousePointer2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AIChatWindow } from './AIChatWindow';
import { SnakeGame } from './SnakeGame';
import { TowerDefenseGame } from './TowerDefenseGame';
import { MemoryGame } from './MemoryGame';
import { ClickerGame } from './ClickerGame';

type ActiveModal = 'none' | 'ai' | 'snake' | 'tower' | 'memory' | 'clicker';

export function FloatingGameMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<ActiveModal>('none');

  const menuItems = [
    { id: 'ai' as const, icon: Bot, label: 'AI Asistent', color: 'bg-gradient-to-br from-violet-500 to-purple-600' },
    { id: 'snake' as const, icon: Gamepad2, label: 'Snake', color: 'bg-gradient-to-br from-green-500 to-emerald-600' },
    { id: 'tower' as const, icon: Gamepad2, label: 'Tower Defense', color: 'bg-gradient-to-br from-orange-500 to-red-600' },
    { id: 'memory' as const, icon: Brain, label: 'Paměť', color: 'bg-gradient-to-br from-blue-500 to-cyan-600' },
    { id: 'clicker' as const, icon: MousePointer2, label: 'Clicker', color: 'bg-gradient-to-br from-yellow-500 to-orange-600' },
  ];

  const handleItemClick = (id: ActiveModal) => {
    setActiveModal(id);
    setIsOpen(false);
  };

  return (
    <>
      {/* Menu Items */}
      <div className={cn(
        "fixed bottom-24 right-4 md:bottom-6 md:right-6 z-50 transition-all duration-300",
        isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      )}>
        <div className="flex flex-col-reverse gap-3 mb-3">
          {menuItems.map((item, index) => (
            <button
              key={item.id}
              onClick={() => handleItemClick(item.id)}
              className={cn(
                "w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-white transition-all duration-300 hover:scale-110",
                item.color,
                isOpen ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
              )}
              style={{ transitionDelay: isOpen ? `${index * 50}ms` : '0ms' }}
              title={item.label}
            >
              <item.icon className="h-5 w-5" />
            </button>
          ))}
        </div>
      </div>

      {/* Main FAB Button with animated lines */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-24 right-4 md:bottom-6 md:right-6 z-50 w-16 h-16 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
      >
        <div className="relative w-6 h-6 flex flex-col justify-center items-center">
          <span
            className={cn(
              "absolute h-0.5 w-6 bg-current transition-all duration-300 rounded-full",
              isOpen ? "rotate-45" : "-translate-y-1.5"
            )}
          />
          <span
            className={cn(
              "absolute h-0.5 w-6 bg-current transition-all duration-300 rounded-full",
              isOpen ? "-rotate-45" : "translate-y-1.5"
            )}
          />
        </div>
      </button>

      {/* Modals */}
      <AIChatWindow isOpen={activeModal === 'ai'} onClose={() => setActiveModal('none')} />
      <SnakeGame isOpen={activeModal === 'snake'} onClose={() => setActiveModal('none')} />
      <TowerDefenseGame isOpen={activeModal === 'tower'} onClose={() => setActiveModal('none')} />
      <MemoryGame isOpen={activeModal === 'memory'} onClose={() => setActiveModal('none')} />
      <ClickerGame isOpen={activeModal === 'clicker'} onClose={() => setActiveModal('none')} />
    </>
  );
}
