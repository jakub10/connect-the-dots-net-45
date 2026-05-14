import { useState } from 'react';
import { Bot, Gamepad2, Brain, MousePointer2, Crown, Mic } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { AIChatWindow } from './AIChatWindow';
import { SnakeGame } from './SnakeGame';
import { TowerDefenseGame } from './TowerDefenseGame';
import { MemoryGame } from './MemoryGame';
import { ClickerGame } from './ClickerGame';
import { VIPPuzzleGame } from './VIPPuzzleGame';
import { AIChatbotModal } from './AIChatbotModal';
import { VoiceAgentModal } from './VoiceAgentModal';
import { useUserRole } from '@/hooks/useUserRole';

type ActiveModal = 'none' | 'ai' | 'snake' | 'tower' | 'memory' | 'clicker' | 'vip-puzzle' | 'chatbot' | 'voice';

export function FloatingGameMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<ActiveModal>('none');
  const { isVIP, isCreator } = useUserRole();
  const { t } = useTranslation();

  const baseMenuItems = [
    { id: 'voice' as const, icon: Mic, label: t('fab.voice'), color: 'from-pink-500 to-rose-600' },
    { id: 'clicker' as const, icon: MousePointer2, label: t('fab.clicker'), color: 'from-yellow-500 to-orange-600' },
    { id: 'memory' as const, icon: Brain, label: t('fab.memory'), color: 'from-blue-500 to-cyan-600' },
    { id: 'tower' as const, icon: Gamepad2, label: t('fab.tower'), color: 'from-orange-500 to-red-600' },
    { id: 'snake' as const, icon: Gamepad2, label: t('fab.snake'), color: 'from-green-500 to-emerald-600' },
    { id: 'ai' as const, icon: Bot, label: t('fab.ai'), color: 'from-violet-500 to-purple-600' },
    { id: 'chatbot' as const, icon: Bot, label: t('fab.chatbot'), color: 'from-blue-500 to-cyan-600' },
  ];

  const vipMenuItems = isVIP || isCreator ? [
    { id: 'vip-puzzle' as const, icon: Crown, label: t('fab.vipPuzzle'), color: 'from-amber-500 to-yellow-600', vip: true },
  ] : [];

  const menuItems = [...baseMenuItems, ...vipMenuItems];

  const handleItemClick = (id: ActiveModal) => {
    setActiveModal(id);
    setIsOpen(false);
  };

  return (
    <>
      {/* Menu Items */}
      <div className={cn(
        "fixed bottom-44 right-4 md:bottom-[6.5rem] md:right-6 z-[60] transition-all duration-300",
        isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      )}>
        <div className="grid grid-cols-2 gap-3 mb-3 justify-items-end">
          {[...menuItems].reverse().map((item, index) => (
            <button
              key={item.id}
              onClick={() => handleItemClick(item.id)}
              className={cn(
                "w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-white transition-all duration-300 hover:scale-110 relative bg-gradient-to-br",
                item.color,
                isOpen ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
              )}
              style={{ transitionDelay: isOpen ? `${index * 50}ms` : '0ms' }}
              title={item.label}
            >
              <item.icon className="h-5 w-5" />
              {'vip' in item && item.vip && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center">
                  <Crown className="h-2.5 w-2.5 text-amber-900" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main FAB Button with animated lines */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-24 right-4 md:bottom-6 md:right-6 z-[55] w-16 h-16 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
        aria-label={isOpen ? 'Zavřít rychlé menu' : 'Otevřít rychlé menu'}
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
      <AIChatbotModal isOpen={activeModal === 'chatbot'} onClose={() => setActiveModal('none')} />
      <SnakeGame isOpen={activeModal === 'snake'} onClose={() => setActiveModal('none')} />
      <TowerDefenseGame isOpen={activeModal === 'tower'} onClose={() => setActiveModal('none')} />
      <MemoryGame isOpen={activeModal === 'memory'} onClose={() => setActiveModal('none')} />
      <ClickerGame isOpen={activeModal === 'clicker'} onClose={() => setActiveModal('none')} />
      <VIPPuzzleGame isOpen={activeModal === 'vip-puzzle'} onClose={() => setActiveModal('none')} />
      <VoiceAgentModal isOpen={activeModal === 'voice'} onClose={() => setActiveModal('none')} />
    </>
  );
}