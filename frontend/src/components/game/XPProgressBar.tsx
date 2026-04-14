import { useGameStore } from '@/store/gameStore';
import { motion } from 'framer-motion';

export const XPProgressBar = ({ compact = false }: { compact?: boolean }) => {
  const { currentLevel, totalXP, xpToNextLevel } = useGameStore(s => s.user);
  const LEVEL_XP = [0, 100, 250, 500, 800, 1200, 1700, 2300, 3000, 3800, 4700, 5800, 7000, 8500, 10000, 12000, 14500, 17500, 21000, 25000, 30000];
  const currentLevelXP = LEVEL_XP[currentLevel - 1] || 0;
  const progress = Math.max(5, ((totalXP - currentLevelXP) / xpToNextLevel) * 100);

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-2 w-[180px] rounded-full bg-nq-elevated overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-nq-cyan to-nq-purple"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
        <span className="font-mono text-xs text-nq-text-secondary">{Math.round(xpToNextLevel - (totalXP - currentLevelXP))} XP</span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="font-display text-xs text-nq-cyan">LEVEL {currentLevel}</span>
        <span className="font-mono text-xs text-nq-text-secondary">{totalXP.toLocaleString()} XP</span>
      </div>
      <div className="h-3 rounded-full bg-nq-elevated overflow-hidden relative">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-nq-cyan via-nq-purple to-nq-cyan relative"
          initial={{ width: '5%' }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
        </motion.div>
      </div>
      <p className="font-mono text-xs text-nq-text-muted text-right">{Math.round(xpToNextLevel - (totalXP - currentLevelXP))} XP to Level {currentLevel + 1}</p>
    </div>
  );
};
