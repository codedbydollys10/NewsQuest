import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

interface Step {
  label: string;
  icon: string;
}

interface StepProgressProps {
  steps: Step[];
  currentStep: number;
}

const StepProgress = ({ steps, currentStep }: StepProgressProps) => {
  return (
    <div className="flex items-center justify-center gap-0 w-full px-4">
      {steps.map((step, i) => {
        const completed = i < currentStep;
        const active = i === currentStep;
        return (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <motion.div
                animate={{
                  scale: active ? 1.15 : completed ? 1 : 0.9,
                }}
                className={`w-10 h-10 rounded-full flex items-center justify-center text-lg border-2 transition-colors duration-300 ${
                  completed
                    ? 'bg-primary/20 border-primary glow-cyan'
                    : active
                    ? 'border-secondary bg-secondary/10 glow-purple'
                    : 'border-muted-foreground/30 bg-muted/30'
                }`}
              >
                {completed ? <Check className="w-4 h-4 text-primary" /> : step.icon}
              </motion.div>
              <span
                className={`text-[10px] font-space-mono uppercase tracking-wider ${
                  active ? 'text-secondary' : completed ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className="w-12 h-0.5 mx-2 rounded-full overflow-hidden bg-muted mt-[-18px]">
                <motion.div
                  className="h-full bg-primary"
                  initial={{ width: '0%' }}
                  animate={{ width: completed ? '100%' : '0%' }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default StepProgress;
