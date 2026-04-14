import { useGameStore } from '@/store/gameStore';

export const StreakBadge = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => {
  const streak = useGameStore(s => s.user.streakCount);
  const sizeClasses = size === 'sm' ? 'text-sm px-2 py-0.5' : size === 'lg' ? 'text-xl px-4 py-2' : 'text-base px-3 py-1';
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full glass border border-nq-orange/30 ${sizeClasses}`}>
      <span className="text-nq-orange">🔥</span>
      <span className="font-display font-bold text-nq-orange">{streak}</span>
    </div>
  );
};
