import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GlassCardProps extends HTMLMotionProps<'div'> {
  glow?: 'cyan' | 'purple' | 'orange' | 'none';
  hover?: boolean;
}

export const GlassCard = ({ children, className, glow = 'none', hover = true, ...props }: GlassCardProps) => {
  const glowClass = glow === 'cyan' ? 'hover:glow-cyan' : glow === 'purple' ? 'hover:glow-purple' : glow === 'orange' ? 'hover:glow-orange' : '';
  return (
    <motion.div
      className={cn('glass rounded-lg p-4', hover && 'transition-all duration-300 hover:-translate-y-1', glowClass, className)}
      whileTap={hover ? { scale: 0.98 } : undefined}
      {...props}
    >
      {children}
    </motion.div>
  );
};
