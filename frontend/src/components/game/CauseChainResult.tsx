import { motion } from 'framer-motion';
import { CheckCircle, AlertCircle, Zap } from 'lucide-react';
import { GlassCard } from './GlassCard';

interface CauseChainResultProps {
  result: {
    percentageCorrect: number;
    allCorrect: boolean;
    hasDistractor: boolean;
    feedback: string;
    aiFeedback: string;
    xpEarned: number;
    xpPenalty: number;
    correctConnections: number;
    totalConnections: number;
  };
  onClose: () => void;
}

export const CauseChainResult = ({ result, onClose }: CauseChainResultProps) => {
  const netXP = result.xpEarned - result.xpPenalty;
  const isSuccess = result.percentageCorrect >= 50;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md"
      >
        <GlassCard className="border-2 border-nq-orange/50">
          <div className="flex flex-col items-center text-center space-y-4">
            {/* Icon */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', delay: 0.1 }}
            >
              {result.allCorrect ? (
                <CheckCircle className="w-16 h-16 text-green-400 drop-shadow-lg" />
              ) : isSuccess ? (
                <AlertCircle className="w-16 h-16 text-yellow-400 drop-shadow-lg" />
              ) : (
                <AlertCircle className="w-16 h-16 text-red-400 drop-shadow-lg" />
              )}
            </motion.div>

            {/* Title */}
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">
                {result.allCorrect
                  ? '🎉 Perfect Chain!'
                  : isSuccess
                    ? '✨ Good Reasoning'
                    : '🤔 Keep Learning'}
              </h2>
              <p className="text-sm text-slate-300">
                {result.percentageCorrect}% of connections were correct
              </p>
            </div>

            {/* Score Details */}
            <div className="w-full space-y-2">
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-700/30">
                <span className="text-sm text-slate-300">Correct Connections:</span>
                <span className="font-bold text-nq-orange">
                  {result.correctConnections} / {result.totalConnections}
                </span>
              </div>

              {result.hasDistractor && (
                <div className="flex items-center justify-between p-2 rounded-lg bg-red-500/20 border border-red-500/50">
                  <span className="text-sm text-red-200">⚠️ Distractor Included</span>
                  <span className="text-xs font-semibold text-red-300">-10 XP</span>
                </div>
              )}
            </div>

            {/* XP Reward */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="relative w-full"
            >
              <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-gradient-to-r from-nq-orange/30 to-yellow-500/30 border border-nq-orange/50">
                <Zap className="w-5 h-5 text-nq-orange" />
                <div className="text-center">
                  <p className="text-xs text-slate-400">XP Earned</p>
                  <p className="text-2xl font-bold text-nq-orange">{netXP} XP</p>
                </div>
                <Zap className="w-5 h-5 text-nq-orange" />
              </div>
              {result.xpPenalty > 0 && (
                <p className="text-xs text-slate-400 mt-1">
                  ({result.xpEarned} - {result.xpPenalty} penalty)
                </p>
              )}
            </motion.div>

            {/* AI Feedback */}
            <div className="w-full space-y-2 p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <p className="text-xs font-semibold text-nq-orange uppercase mb-2">Correct Answer</p>
              <p className="text-sm font-medium text-slate-100">{result.aiFeedback}</p>
            </div>

            {/* Feedback Type */}
            <div className="text-sm p-3 rounded-lg bg-slate-700/30 text-slate-300">
              {result.allCorrect
                ? '✅ You perfectly identified the cause-effect chain!'
                : isSuccess
                  ? '⭐ You got most of it! Review the remaining connections.'
                  : '💡 Need to think more carefully about cause-effect relationships.'}
            </div>

            {/* Close Button */}
            <motion.button
              onClick={onClose}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-nq-orange/70 hover:bg-nq-orange/90 transition-colors text-white font-bold"
            >
              <span>Continue</span>
            </motion.button>
          </div>
        </GlassCard>
      </motion.div>
    </motion.div>
  );
};
