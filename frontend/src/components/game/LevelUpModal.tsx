import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';

export const LevelUpModal = () => {
  const show = useGameStore(s => s.ui.showLevelUpModal);
  const level = useGameStore(s => s.user.currentLevel);
  const dismiss = useGameStore(s => s.dismissLevelUp);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-nq-void/80 backdrop-blur-md" onClick={dismiss} />
          <motion.div
            className="relative z-10 text-center"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', damping: 15 }}
          >
            <motion.div
              className="text-8xl font-display font-black text-nq-cyan text-glow-cyan mb-4"
              initial={{ scale: 0.5 }}
              animate={{ scale: [0.5, 1.5, 1] }}
              transition={{ duration: 0.8, times: [0, 0.6, 1] }}
            >
              {level}
            </motion.div>
            <motion.p
              className="font-display text-2xl font-bold text-foreground mb-2"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              LEVEL UP!
            </motion.p>
            <motion.p
              className="text-nq-text-secondary mb-6"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              You've reached a new milestone
            </motion.p>
            <motion.button
              onClick={dismiss}
              className="px-8 py-3 rounded-lg font-display font-bold bg-nq-cyan/20 text-nq-cyan border border-nq-cyan/30 hover:bg-nq-cyan/30 glow-cyan transition-all"
              whileTap={{ scale: 0.94 }}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              CONTINUE
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
