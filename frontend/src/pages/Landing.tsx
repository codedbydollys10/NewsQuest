import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { ParticleField } from '@/components/game/ParticleField';
import { GlassCard } from '@/components/game/GlassCard';
import { Zap, Brain, TrendingUp, ChevronRight } from 'lucide-react';

const LandingHero = ({ onStart }: { onStart: () => void }) => (
  <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden grain-overlay">
    <ParticleField />
    <div className="relative z-10 text-center px-4 max-w-4xl">
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
        <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-black text-foreground mb-4 leading-tight">
          MASTER THE WORLD.<br />
          <span className="text-nq-cyan text-glow-cyan">LEVEL BY LEVEL.</span>
        </h1>
        <p className="text-lg md:text-xl text-nq-text-secondary max-w-2xl mx-auto mb-8">
          The gamified news experience that turns knowledge into power. Read, compete, predict — and level up.
        </p>
      </motion.div>

      <motion.button
        onClick={onStart}
        className="px-8 py-4 rounded-xl font-display font-bold text-lg bg-nq-cyan/10 text-nq-cyan border-2 border-nq-cyan/40 hover:bg-nq-cyan/20 animate-pulse-glow transition-all"
        whileTap={{ scale: 0.94 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        START YOUR QUEST <ChevronRight className="inline ml-2" size={20} />
      </motion.button>

      {/* Stats */}
      <motion.div
        className="flex flex-wrap justify-center gap-4 mt-12"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        {[
          { label: 'Active Players', value: '12,847' },
          { label: 'XP Earned Today', value: '2.4M' },
          { label: 'Return Rate', value: '94%' },
        ].map(s => (
          <GlassCard key={s.label} hover={false} className="px-6 py-3 text-center">
            <p className="font-display text-xl font-bold text-nq-cyan">{s.value}</p>
            <p className="text-xs text-nq-text-muted">{s.label}</p>
          </GlassCard>
        ))}
      </motion.div>

      {/* Features */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12 max-w-3xl mx-auto"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.1 }}
      >
        {[
          { icon: Zap, title: 'CONSUME', desc: 'Curated news with XP rewards for every article you read', color: 'text-nq-cyan' },
          { icon: Brain, title: 'COMPETE', desc: 'Quizzes and predictions to test your understanding', color: 'text-nq-purple' },
          { icon: TrendingUp, title: 'EVOLVE', desc: 'Level up, earn badges, and climb the leaderboard', color: 'text-nq-orange' },
        ].map(f => (
          <GlassCard key={f.title} className="text-center py-6">
            <f.icon className={`mx-auto mb-3 ${f.color}`} size={32} />
            <h3 className={`font-display font-bold text-sm mb-2 ${f.color}`}>{f.title}</h3>
            <p className="text-xs text-nq-text-secondary">{f.desc}</p>
          </GlassCard>
        ))}
      </motion.div>
    </div>
  </div>
);

const OnboardingSteps = () => {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const { setUsername, setOnboarded, setFocusMode, setDailyTarget } = useGameStore();
  const [focus, setFocus] = useState<'news' | 'upsc' | 'both'>('both');
  const [target, setTarget] = useState(3);
  const navigate = useNavigate();

  const steps = [
    // Step 1: Name
    <div key="name" className="text-center space-y-6">
      <h2 className="font-display text-2xl font-bold text-foreground">CHOOSE YOUR CALLSIGN</h2>
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Enter username..."
        className="w-full max-w-sm mx-auto block px-4 py-3 rounded-lg glass border border-nq-cyan/20 bg-transparent text-foreground font-display text-center focus:outline-none focus:border-nq-cyan focus:glow-cyan transition-all"
        autoFocus
      />
    </div>,
    // Step 2: Avatar
    <div key="avatar" className="text-center space-y-6">
      <h2 className="font-display text-2xl font-bold text-foreground">SELECT YOUR AVATAR</h2>
      <div className="flex justify-center gap-4">
        {['🎮', '🧙', '🥷', '🧑‍🚀', '🤖'].map(a => (
          <motion.button key={a} whileTap={{ scale: 0.9 }} className="w-20 h-20 rounded-xl glass border border-nq-cyan/20 text-4xl hover:border-nq-cyan hover:glow-cyan transition-all flex items-center justify-center">
            {a}
          </motion.button>
        ))}
      </div>
    </div>,
    // Step 3: Focus
    <div key="focus" className="text-center space-y-6">
      <h2 className="font-display text-2xl font-bold text-foreground">YOUR FOCUS</h2>
      <div className="flex flex-col gap-3 max-w-sm mx-auto">
        {(['news', 'upsc', 'both'] as const).map(m => (
          <motion.button
            key={m}
            whileTap={{ scale: 0.94 }}
            onClick={() => setFocus(m)}
            className={`px-4 py-3 rounded-lg glass font-display font-bold transition-all ${focus === m ? 'border-nq-cyan text-nq-cyan glow-cyan' : 'border-transparent text-nq-text-secondary hover:text-foreground'}`}
          >
            {m === 'news' ? '📰 NEWS MODE' : m === 'upsc' ? '📚 UPSC MODE' : '🌐 BOTH'}
          </motion.button>
        ))}
      </div>
    </div>,
    // Step 4: Daily Target
    <div key="target" className="text-center space-y-6">
      <h2 className="font-display text-2xl font-bold text-foreground">DAILY TARGET</h2>
      <p className="text-nq-text-secondary">How many articles per day?</p>
      <div className="flex items-center justify-center gap-6">
        <input
          type="range"
          min={1}
          max={10}
          value={target}
          onChange={e => setTarget(Number(e.target.value))}
          className="w-48 accent-[#00E5FF]"
        />
        <span className="font-display text-3xl font-bold text-nq-cyan text-glow-cyan">{target}</span>
      </div>
    </div>,
  ];

  const handleNext = () => {
    if (step === 0 && name) setUsername(name);
    if (step === 2) setFocusMode(focus);
    if (step === 3) {
      setDailyTarget(target);
      setOnboarded(true);
      navigate('/home');
      return;
    }
    setStep(s => s + 1);
  };

  return (
    <div className="min-h-screen flex items-center justify-center grain-overlay bg-nq-void">
      <div className="w-full max-w-lg px-4">
        {/* Progress */}
        <div className="flex gap-2 mb-8">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className={`flex-1 h-1 rounded-full transition-all ${i <= step ? 'bg-nq-cyan' : 'bg-nq-elevated'}`} />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
          >
            {steps[step]}
          </motion.div>
        </AnimatePresence>

        <div className="flex justify-between mt-8">
          {step > 0 && (
            <motion.button whileTap={{ scale: 0.94 }} onClick={() => setStep(s => s - 1)} className="px-6 py-2 rounded-lg font-display text-sm text-nq-text-secondary hover:text-foreground transition-colors">
              BACK
            </motion.button>
          )}
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={handleNext}
            className="ml-auto px-8 py-3 rounded-lg font-display font-bold bg-nq-cyan/10 text-nq-cyan border border-nq-cyan/30 hover:bg-nq-cyan/20 hover:glow-cyan transition-all"
          >
            {step === 3 ? 'BEGIN QUEST' : 'NEXT'}
          </motion.button>
        </div>
      </div>
    </div>
  );
};

const Landing = () => {
  const navigate = useNavigate();
  return <LandingHero onStart={() => navigate('/home')} />;
};

export default Landing;
