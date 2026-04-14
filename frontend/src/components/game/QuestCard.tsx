import { motion } from 'framer-motion';
import { GlassCard } from './GlassCard';
import type { Quest } from '@/store/gameStore';
import { CheckCircle2, BookOpen, Brain, Eye, Compass, GraduationCap } from 'lucide-react';

const questIcons: Record<string, React.ElementType> = {
  read: BookOpen, quiz: Brain, predict: Eye, category: Compass, upsc: GraduationCap,
};

export const QuestCard = ({ quest, index = 0 }: { quest: Quest; index?: number }) => {
  const Icon = questIcons[quest.type] || BookOpen;
  const progress = Math.max(5, (quest.progress / quest.target) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <GlassCard className={`relative overflow-hidden ${quest.completed ? 'border-nq-green/30' : ''}`}>
        {quest.completed && (
          <div className="absolute inset-0 bg-nq-green/5 pointer-events-none" />
        )}
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${quest.completed ? 'bg-nq-green/20 text-nq-green' : 'bg-nq-cyan/10 text-nq-cyan'}`}>
            {quest.completed ? <CheckCircle2 size={20} /> : <Icon size={20} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h4 className="font-display text-xs font-bold text-foreground">{quest.title}</h4>
              <span className="font-display text-xs font-bold text-nq-cyan">+{quest.xpReward} XP</span>
            </div>
            <p className="text-xs text-nq-text-secondary mb-2">{quest.description}</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-nq-elevated overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${quest.completed ? 'bg-nq-green' : 'bg-gradient-to-r from-nq-cyan to-nq-purple'}`}
                  initial={{ width: '5%' }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.8 }}
                />
              </div>
              <span className="font-mono text-[10px] text-nq-text-muted">{quest.progress}/{quest.target}</span>
            </div>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
};
