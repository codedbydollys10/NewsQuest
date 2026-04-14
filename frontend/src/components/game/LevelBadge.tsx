import { useGameStore } from '@/store/gameStore';

export const LevelBadge = ({ size = 'md' }: { size?: 'sm' | 'md' }) => {
  const level = useGameStore(s => s.user.currentLevel);
  const sizeClasses = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm';
  return (
    <div className={`${sizeClasses} rounded-lg glass border border-nq-cyan/30 flex items-center justify-center font-display font-bold text-nq-cyan`}>
      {level}
    </div>
  );
};
