import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GlassCard } from './GlassCard';
import { useGameStore } from '@/store/gameStore';
import type { Article } from '@/store/gameStore';

const difficultyColors: Record<string, string> = {
  Easy: 'bg-nq-green/20 text-nq-green border-nq-green/30',
  Medium: 'bg-nq-orange/20 text-nq-orange border-nq-orange/30',
  Hard: 'bg-nq-red/20 text-nq-red border-nq-red/30',
};

const categoryColors: Record<string, string> = {
  Technology: 'bg-nq-cyan/20 text-nq-cyan',
  Environment: 'bg-nq-green/20 text-nq-green',
  Economy: 'bg-nq-orange/20 text-nq-orange',
  Science: 'bg-nq-purple/20 text-nq-purple',
  Politics: 'bg-nq-cyan/20 text-nq-cyan',
  Polity: 'bg-nq-cyan/20 text-nq-cyan',
};

export const NewsCard = ({ article, index = 0 }: { article: Article; index?: number }) => {
  const addXP = useGameStore(s => s.addXP);

  const handleRead = (e: React.MouseEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    addXP(10, 'cyan', rect.left, rect.top);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <GlassCard glow="cyan" className="group">
        {/* Badges row */}
        <div className="flex items-center gap-2 mb-3">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-display font-bold ${categoryColors[article.category] || 'bg-muted text-muted-foreground'}`}>
            {article.category.toUpperCase()}
          </span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-display border ${difficultyColors[article.difficulty]}`}>
            {article.difficulty}
          </span>
          <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-display font-bold bg-nq-cyan/10 text-nq-cyan">
            +{article.xpReward} XP
          </span>
        </div>

        {/* Content */}
        <h3 className="font-display text-sm font-bold text-foreground mb-2 leading-tight group-hover:text-nq-cyan transition-colors">
          {article.headline}
        </h3>
        <p className="text-sm text-nq-text-secondary line-clamp-3 mb-3 leading-relaxed">
          {article.summary}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-nq-text-muted">
            <span>{article.source}</span>
            <span>•</span>
            <span>{article.readTime}</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to={`/article/${article.id}`} onClick={handleRead}>
              <motion.button whileTap={{ scale: 0.94 }} className="px-3 py-1.5 rounded-lg text-xs font-display font-bold bg-nq-cyan/10 text-nq-cyan border border-nq-cyan/20 hover:bg-nq-cyan/20 hover:glow-cyan transition-all">
                READ
              </motion.button>
            </Link>
            <Link to={`/quiz/${article.id}`}>
              <motion.button whileTap={{ scale: 0.94 }} className="px-3 py-1.5 rounded-lg text-xs font-display font-bold bg-nq-purple/10 text-nq-purple border border-nq-purple/20 hover:bg-nq-purple/20 hover:glow-purple transition-all">
                QUIZ
              </motion.button>
            </Link>
            <Link to={`/predict/${article.id}`}>
              <motion.button whileTap={{ scale: 0.94 }} className="px-3 py-1.5 rounded-lg text-xs font-display font-bold bg-nq-orange/10 text-nq-orange border border-nq-orange/20 hover:bg-nq-orange/20 hover:glow-orange transition-all">
                PREDICT
              </motion.button>
            </Link>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
};
