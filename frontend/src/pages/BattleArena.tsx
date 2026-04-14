import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, Flame, Zap, Home, RotateCcw } from 'lucide-react';
import ParticleBg from '@/components/ParticleBg';
import { useAuthStore } from '@/store/useAuthStore';
import { useBattleStore, type RoundResult, type Opponent } from '@/store/useBattleStore';
import { useBattleSocketContext } from '@/hooks/BattleSocketProvider';
import { getQuestionsForBattle } from '@/data/battleQuestions';
import type { BattleQuestion } from '@/data/battleQuestions';
import { recordBattleProgress } from '@/lib/progressSync';

const AVATAR_EMOJIS = ['🏃', '🧠', '🔮', '⚡', '👻'];

/* ── HP Bar ── */
const HPBar = ({ hp, max, side }: { hp: number; max: number; side: 'player' | 'opponent' }) => {
  const pct = (hp / max) * 100;
  const color = pct > 70
    ? 'bg-gradient-to-r from-battle-blue via-primary to-battle-gold'
    : pct > 30
      ? 'bg-gradient-to-r from-battle-gold via-auth-warning to-auth-warning'
      : 'bg-gradient-to-r from-battle-red via-auth-error to-battle-red';
  return (
    <div className="w-40 lg:w-48">
      <div className="h-5 rounded-full bg-muted overflow-hidden relative border border-border/40 shadow-[0_0_20px_rgba(0,229,255,0.08)]">
        <motion.div
          className={`h-full rounded-full ${color}`}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5 }}
        />
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-space-mono text-foreground font-bold">
          {hp} / {max}
        </span>
      </div>
    </div>
  );
};

/* ── Circular Timer ── */
const BattleTimer = ({ time, max, onTimeout }: { time: number; max: number; onTimeout: () => void }) => {
  const pct = time / max;
  const circumference = 2 * Math.PI * 34;
  const offset = circumference * (1 - pct);
  const strokeColor = pct > 0.6 ? 'hsl(187 100% 50%)' : pct > 0.3 ? 'hsl(25 100% 50%)' : 'hsl(349 100% 61%)';
  const isUrgent = time <= 10;

  useEffect(() => {
    if (time <= 0) onTimeout();
  }, [time, onTimeout]);

  return (
    <motion.div
      animate={isUrgent ? { scale: [1, 1.08, 1] } : {}}
      transition={isUrgent ? { duration: 1, repeat: Infinity } : {}}
      className="relative w-20 h-20"
    >
      <svg className="w-full h-full -rotate-90" viewBox="0 0 76 76">
        <circle cx="38" cy="38" r="34" fill="none" stroke="hsl(var(--muted))" strokeWidth="5" />
        <circle
          cx="38" cy="38" r="34" fill="none"
          stroke={strokeColor} strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.3s linear, stroke 0.3s' }}
        />
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center font-orbitron text-xl tabular-nums ${isUrgent ? 'text-auth-error' : 'text-foreground'}`}>
        {time}
      </span>
    </motion.div>
  );
};

/* ── Answer Option ── */
const AnswerOption = ({
  option, index, isSelected, isCorrect, isRevealed, isDisabled, onClick
}: {
  option: { id: string; text: string; icon?: string };
  index: number;
  isSelected: boolean;
  isCorrect: boolean | null;
  isRevealed: boolean;
  isDisabled: boolean;
  onClick: () => void;
}) => {
  const letters = ['A', 'B', 'C', 'D'];
  let borderClass = 'border-border/30';
  let bgClass = '';

  if (isRevealed) {
    if (isCorrect) {
      borderClass = 'border-battle-gold';
      bgClass = 'bg-battle-gold/10';
    } else if (isSelected) {
      borderClass = 'border-battle-red';
      bgClass = 'bg-battle-red/10';
    }
  } else if (isSelected) {
    borderClass = 'border-battle-blue';
    bgClass = 'bg-battle-blue/10';
  }

  return (
    <motion.button
      onClick={onClick}
      disabled={isDisabled}
      whileHover={!isDisabled ? { scale: 1.01 } : {}}
      whileTap={!isDisabled ? { scale: 0.98 } : {}}
      className={`w-full glass p-4 flex items-center gap-4 transition-all border-2 ${borderClass} ${bgClass} ${isDisabled ? 'cursor-default opacity-70' : 'cursor-pointer hover:border-primary/50'}`}
    >
      <span className={`w-9 h-9 rounded-full flex items-center justify-center font-orbitron text-sm font-bold border-2 flex-shrink-0 ${isRevealed && isCorrect ? 'bg-battle-gold text-primary-foreground border-battle-gold' :
        isRevealed && isSelected ? 'bg-battle-red text-primary-foreground border-battle-red' :
          isSelected ? 'bg-battle-blue text-primary-foreground border-battle-blue' : 'border-muted-foreground text-muted-foreground'
        }`}>
        {option.icon || letters[index] || option.id}
      </span>
      <span className="font-plex text-sm text-left flex-1">{option.text}</span>
      {isRevealed && isCorrect && <span className="text-auth-success text-lg">✓</span>}
      {isRevealed && isSelected && !isCorrect && <span className="text-auth-error text-lg">✗</span>}
      {!isRevealed && isSelected && <span className="text-primary text-xs font-orbitron">LOCKED</span>}
    </motion.button>
  );
};

/* ── Confidence Slider ── */
const ConfidenceSlider = ({ value, onChange, locked }: { value: number; onChange: (v: number) => void; locked: boolean }) => {
  const label = value <= 30 ? 'Just a guess — low risk, low reward' :
    value <= 60 ? 'Moderate confidence — balanced play' :
      value <= 85 ? 'High confidence — big stakes' : 'ALL IN — maximum risk and reward';
  const potentialReward = Math.round(20 * (value / 50));

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass p-4 space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-xs font-space-mono uppercase text-muted-foreground">Confidence</span>
        <span className="font-orbitron text-2xl text-battle-gold">{value}%</span>
      </div>
      <input
        type="range" min={1} max={100} value={value}
        onChange={(e) => !locked && onChange(Number(e.target.value))}
        disabled={locked}
        className="w-full h-2 rounded-full appearance-none cursor-pointer bg-gradient-to-r from-battle-blue via-battle-gold to-battle-red [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:shadow-lg"
      />
      <p className={`text-xs font-plex ${value <= 60 ? 'text-primary' : 'text-battle-gold'}`}>{label}</p>
      <div className="glass px-3 py-1.5 inline-block">
        <span className="text-xs font-space-mono text-auth-success">Potential: +{potentialReward} pts</span>
      </div>
    </motion.div>
  );
};

/* ── Pre-Battle Countdown ── */
const PreBattleCountdown = ({ onComplete, playerAvatar, opponentAvatar, mode, playerName, opponentName }: {
  onComplete: () => void; playerAvatar: number; opponentAvatar: number;
  mode: string; playerName: string; opponentName: string;
}) => {
  const [phase, setPhase] = useState(0);
  const [count, setCount] = useState(3);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 1500);
    const t2 = setTimeout(() => setPhase(2), 2500);
    const t3 = setTimeout(() => setCount(2), 3500);
    const t4 = setTimeout(() => setCount(1), 4500);
    const t5 = setTimeout(() => setPhase(3), 5500);
    const t6 = setTimeout(onComplete, 6000);
    return () => { [t1, t2, t3, t4, t5, t6].forEach(clearTimeout); };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-background/90 backdrop-blur-xl">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,229,255,0.18),transparent_36%),radial-gradient(circle_at_top_right,rgba(255,34,68,0.16),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent)]" />
      <motion.div
        animate={{ y: [0, -16, 0], x: [0, 10, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -left-16 top-16 w-56 h-56 rounded-full bg-battle-blue/20 blur-3xl"
      />
      <motion.div
        animate={{ y: [0, 18, 0], x: [0, -12, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -right-16 bottom-16 w-64 h-64 rounded-full bg-battle-red/20 blur-3xl"
      />
      <div className="absolute inset-0 flex">
        <div className="w-1/2 bg-gradient-to-b from-battle-blue/20 to-transparent" />
        <div className="w-1/2 bg-gradient-to-b from-battle-red/20 to-transparent" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-px h-full bg-foreground/20" />
      </div>

      {/* Avatars */}
      <AnimatePresence>
        {phase >= 0 && (
          <>
            <motion.div
              initial={{ x: '-100vw' }} animate={{ x: '-25vw' }}
              transition={{ duration: 1.2, type: 'spring', bounce: 0.3 }}
              className="absolute text-8xl lg:text-9xl drop-shadow-[0_0_20px_rgba(0,229,255,0.35)]"
            >
              <div className="relative">
                <div className="absolute inset-0 rounded-full border border-battle-blue/30 blur-md" />
                {AVATAR_EMOJIS[playerAvatar]}
              </div>
            </motion.div>
            <motion.div
              initial={{ x: '100vw' }} animate={{ x: '25vw' }}
              transition={{ duration: 1.2, type: 'spring', bounce: 0.3 }}
              className="absolute text-8xl lg:text-9xl drop-shadow-[0_0_20px_rgba(255,34,68,0.35)]"
            >
              <div className="relative">
                <div className="absolute inset-0 rounded-full border border-battle-red/30 blur-md" />
                {AVATAR_EMOJIS[opponentAvatar]}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Names */}
      {phase >= 0 && (
        <>
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
            className="absolute left-8 top-1/2 -translate-y-12 font-orbitron text-sm text-battle-blue uppercase tracking-wider">
            {playerName}
          </motion.span>
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
            className="absolute right-8 top-1/2 -translate-y-12 font-orbitron text-sm text-battle-red uppercase tracking-wider">
            {opponentName}
          </motion.span>
        </>
      )}

      {/* Banner */}
      {phase >= 1 && (
        <motion.div
          initial={{ y: -100, opacity: 0 }} animate={{ y: -160, opacity: 1 }}
          className="absolute glass px-6 py-3 text-center border border-nq-cyan/20 bg-battle-blue/10"
        >
          <p className="font-orbitron text-sm text-gradient-cyan uppercase tracking-widest">
            {mode === 'quiz' ? '⚡ Quiz Battle' : mode === 'prediction' ? '🔮 Prediction Battle' : '⚡🔮 Mixed Battle'}
          </p>
        </motion.div>
      )}

      {/* Countdown */}
      {phase >= 2 && phase < 3 && (
        <motion.span
          key={count}
          initial={{ scale: 2.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.5, opacity: 0 }}
          className="absolute font-orbitron text-[180px] text-foreground font-black"
          style={{ textShadow: '0 0 60px hsl(187 100% 50% / 0.5)' }}
        >
          {count}
        </motion.span>
      )}

      {/* FIGHT */}
      {phase >= 3 && (
        <motion.span
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: [0.5, 2, 1.5], opacity: [0, 1, 0] }}
          transition={{ duration: 0.5 }}
          className="absolute font-orbitron text-[120px] lg:text-[180px] text-foreground font-black"
          style={{ textShadow: '0 0 80px hsl(45 100% 60% / 0.7)' }}
        >
          FIGHT!
        </motion.span>
      )}
    </div>
  );
};

/* ── Battle End Screen ── */
const BattleEndScreen = ({ result, playerScore, opponentScore, playerHP, opponentHP,
  xpEarned, brChange, roundResults, opponentName, mode, onRematch, onExit
}: {
  result: 'win' | 'loss' | 'draw'; playerScore: number; opponentScore: number;
  playerHP: number; opponentHP: number; xpEarned: number; brChange: number;
  roundResults: RoundResult[]; opponentName: string; mode: string;
  onRematch: () => void; onExit: () => void;
}) => {
  const [phase, setPhase] = useState(0);
  const accuracy = roundResults.length ? Math.round(roundResults.filter(r => r.playerCorrect).length / roundResults.length * 100) : 0;

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 1500);
    const t2 = setTimeout(() => setPhase(2), 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 backdrop-blur-lg">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,229,255,0.08),transparent_35%),radial-gradient(circle_at_top,rgba(255,204,0,0.10),transparent_28%),radial-gradient(circle_at_bottom,rgba(255,34,68,0.08),transparent_30%)]" />
      {/* Phase 0: Scores */}
      <AnimatePresence>
        {phase === 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-12">
            <motion.span initial={{ y: 50 }} animate={{ y: 0 }} className="font-orbitron text-7xl lg:text-9xl text-battle-blue drop-shadow-[0_0_24px_rgba(0,229,255,0.35)]">{playerScore}</motion.span>
            <span className="font-orbitron text-2xl text-muted-foreground">—</span>
            <motion.span initial={{ y: 50 }} animate={{ y: 0 }} className="font-orbitron text-7xl lg:text-9xl text-battle-red drop-shadow-[0_0_24px_rgba(255,34,68,0.35)]">{opponentScore}</motion.span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phase 1: Verdict */}
      {phase >= 1 && phase < 2 && (
        <motion.div initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', bounce: 0.4 }}
          className="text-center space-y-4 relative z-10"
        >
          <h1 className={`font-orbitron text-7xl lg:text-9xl font-black ${result === 'win' ? 'text-auth-success' : result === 'loss' ? 'text-battle-red' : 'text-foreground'
            }`} style={{ textShadow: result === 'win' ? '0 0 60px hsl(153 100% 50% / 0.55)' : result === 'loss' ? '0 0 60px hsl(349 100% 61% / 0.55)' : 'none' }}>
            {result === 'win' ? 'VICTORY' : result === 'loss' ? 'DEFEATED' : 'DRAW'}
          </h1>
          {result === 'win' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
              <span className="text-4xl text-auth-success">🎉🏆🎉</span>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* Phase 2: Rewards Modal */}
      {phase >= 2 && (
        <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          className="glass p-6 lg:p-8 max-w-lg w-full mx-4 space-y-5 max-h-[80vh] overflow-y-auto border border-nq-cyan/20 shadow-[0_0_60px_rgba(0,229,255,0.08)]"
        >
          <div className="text-center">
            <h2 className="font-orbitron text-xl text-gradient-cyan">BATTLE COMPLETE</h2>
            <span className={`inline-block mt-2 px-4 py-1 rounded-full text-sm font-orbitron ${result === 'win' ? 'bg-auth-success/20 text-auth-success' : result === 'loss' ? 'bg-battle-red/20 text-battle-red' : 'bg-muted text-foreground'
              }`}>{result === 'win' ? 'VICTORY' : result === 'loss' ? 'DEFEAT' : 'DRAW'}</span>
          </div>

          <div className="space-y-3">
            {[
              { label: 'Final Score', value: `${playerScore} — ${opponentScore}`, color: '' },
              { label: 'Accuracy', value: `${accuracy}%`, color: accuracy > 60 ? 'text-auth-success' : 'text-auth-warning' },
              { label: 'HP Remaining', value: `${playerHP} / 100`, color: '' },
              { label: 'Battle Rating', value: `${brChange >= 0 ? '+' : ''}${brChange} BR`, color: brChange >= 0 ? 'text-auth-success' : 'text-auth-error' },
            ].map((r, i) => (
              <motion.div key={r.label} initial={{ x: -30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.15 }}
                className="flex justify-between items-center glass px-4 py-3 border border-border/30 rounded-2xl"
              >
                <span className={`text-xs font-space-mono uppercase ${i === 0 ? 'text-battle-blue' : i === 1 ? 'text-battle-gold' : i === 2 ? 'text-teal-400' : 'text-secondary'}`}>{r.label}</span>
                <span className={`font-orbitron text-sm ${r.color}`}>{r.value}</span>
              </motion.div>
            ))}
            <motion.div initial={{ x: -30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.6 }}
              className={`flex justify-between items-center glass px-4 py-4 border-2 rounded-2xl ${result === 'win' ? 'border-auth-success/30 glow-green' : 'border-primary/30 glow-cyan'
                }`}
            >
              <span className={`text-xs font-space-mono uppercase ${result === 'win' ? 'text-auth-success' : 'text-primary'}`}>Total XP Earned</span>
              <span className={`font-orbitron text-2xl ${result === 'win' ? 'text-auth-success' : 'text-primary'}`}>+{xpEarned} XP 🔥</span>
            </motion.div>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={onRematch} className="flex-1 h-12 btn-battle rounded-xl flex items-center justify-center gap-2 font-orbitron text-xs">
              <RotateCcw className="w-4 h-4" /> REMATCH
            </button>
            <button onClick={onExit} className="flex-1 h-12 glass flex items-center justify-center gap-2 font-plex text-sm text-muted-foreground hover:text-foreground transition-colors">
              <Home className="w-4 h-4" /> EXIT
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

/* ── Momentum Overlay ── */
const MomentumOverlay = ({ side }: { side: 'player' | 'opponent' }) => (
  <motion.div
    initial={{ opacity: 0, x: side === 'player' ? -100 : 100 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0 }}
    className={`fixed top-20 ${side === 'player' ? 'left-4' : 'right-4'} z-30`}
  >
    <div className={`glass px-4 py-2 border-2 ${side === 'player' ? 'border-battle-gold/40 bg-battle-gold/10' : 'border-battle-red bg-battle-red/10'}`}>
      <span className={`font-orbitron text-xs flex items-center gap-1 ${side === 'player' ? 'text-battle-gold' : 'text-battle-red'}`}>
        <Flame className="w-4 h-4" /> ON FIRE 🔥
      </span>
    </div>
  </motion.div>
);

/* ════════════════════════════════════════════════════════════════
   MAIN BATTLE ARENA PAGE
   ════════════════════════════════════════════════════════════════ */
const BattleArena = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const user = useAuthStore((s) => s.user);
  const battle = useBattleStore();
  const battleId = battle.battleId;
  const battleMode = battle.mode;
  const battleOpponent = battle.opponent;
  const battleQuestions = battle.questions;
  const battleCurrentQuestion = battle.currentQuestion;
  const battlePlayerAnswered = battle.playerAnswered;
  const battleOpponentAnswered = battle.opponentAnswered;
  const battlePlayerAnswer = battle.playerAnswer;
  const battleOpponentAnswer = battle.opponentAnswer;
  const battlePlayerConfidence = battle.playerConfidence;
  const battleOpponentConfidence = battle.opponentConfidence;
  const battlePlayerHP = battle.playerHP;
  const battleOpponentHP = battle.opponentHP;
  const battlePlayerScore = battle.playerScore;
  const battleOpponentScore = battle.opponentScore;
  const battleTimeRemaining = battle.timeRemaining;
  const battleTimerSpeed = battle.timerSpeed;
  const battleStatus = battle.status;
  const battleIsOnFire = battle.isOnFire;
  const battleOpponentOnFire = battle.opponentOnFire;
  const battleSetTimeRemaining = battle.setTimeRemaining;
  const battleLockInOpponentAnswer = battle.lockInOpponentAnswer;
  const battleSetOpponentConfidence = battle.setOpponentConfidence;
  const battleSetPlayerConfidence = battle.setPlayerConfidence;
  const battleNextQuestion = battle.nextQuestion;
  const battleApplyRoundResult = battle.applyRoundResult;
  const battleEndBattle = battle.endBattle;
  const battleReset = battle.reset;
  const battleStartGame = battle.startGame;
  const battleSetStatus = battle.setStatus;
  const battleSetMode = battle.setMode;
  const battleSetBattleId = battle.setBattleId;
  const battleSetOpponent = battle.setOpponent;
  const battleSetCategories = battle.setCategories;
  const battleSetTimerSpeed = battle.setTimerSpeed;
  const battleLockInAnswer = battle.lockInAnswer;
  const { battleRoom, incomingChallenge, lastBattleAction, timerSync, joinBattleRoom, sendBattleAction, respondToChallenge, clearBattleRoom, socketConnected } = useBattleSocketContext();
  const [opponentProgress, setOpponentProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentQ = battle.questions[battle.currentQuestion] as BattleQuestion | undefined;
  const isPrediction = currentQ?.type === 'prediction';
  const [showConfidence, setShowConfidence] = useState(false);
  const [revealPhase, setRevealPhase] = useState<'idle' | 'revealing' | 'explanation'>('idle');
  const [showPreBattle, setShowPreBattle] = useState(true);

  useEffect(() => {
    const roomId = battleId || id;
    if (!roomId || !socketConnected) return;
    joinBattleRoom(roomId);
  }, [battleId, id, joinBattleRoom, socketConnected]);

  useEffect(() => {
    if (battleRoom && user) {
      const hasBattleState = battleMode && battleOpponent && battleQuestions.length > 0;
      if (!hasBattleState) {
        const opponentPlayer = battleRoom.players.find((player) => player.id !== user.id) || battleRoom.players[0];
        if (opponentPlayer) {
          battleSetMode(battleRoom.mode);
          battleSetBattleId(battleRoom.roomId);
          battleSetOpponent(opponentPlayer as Opponent);
          battleStartGame(battleRoom.questions);
          battleSetStatus('pre_battle');
        }
      }
    }
  }, [battleRoom, user, battleMode, battleOpponent, battleQuestions.length, battleSetMode, battleSetBattleId, battleSetOpponent, battleStartGame, battleSetStatus]);

  useEffect(() => {
    if (!timerSync || timerSync.roomId !== battleId) return;
    battleSetTimeRemaining(timerSync.timeRemaining);
  }, [timerSync, battleId, battleSetTimeRemaining]);

  useEffect(() => {
    if (!lastBattleAction || lastBattleAction.roomId !== battleId) return;
    if (lastBattleAction.type === 'answer' && lastBattleAction.questionIndex === battleCurrentQuestion) {
      battleLockInOpponentAnswer(lastBattleAction.answer || '');
      if (currentQ?.type === 'prediction' && typeof lastBattleAction.confidence === 'number') {
        battleSetOpponentConfidence(lastBattleAction.confidence);
      }
    }
    if (lastBattleAction.type === 'progress' && typeof lastBattleAction.progress === 'number') {
      setOpponentProgress(lastBattleAction.progress);
    }
  }, [lastBattleAction, battleId, battleCurrentQuestion, currentQ, battleLockInOpponentAnswer, battleSetOpponentConfidence]);

  // Start timer when active
  useEffect(() => {
    if (battleStatus !== 'active' || revealPhase !== 'idle') return;
    timerRef.current = setInterval(() => {
      battle.setTimeRemaining(Math.max(0, battleTimeRemaining - 1));
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [battleStatus, battleCurrentQuestion, revealPhase, battleTimeRemaining]);

  // Simulate opponent answer
  useEffect(() => {
    if (battleStatus !== 'active' || !currentQ || battleOpponentAnswered || revealPhase !== 'idle' || !!battleId) return;
    const opp = battleOpponent;
    if (!opp) return;
    const delay = (battle.timerSpeed * 0.3 + Math.random() * battle.timerSpeed * 0.4) * 1000;
    const t = setTimeout(() => {
      const accuracy = currentQ.type === 'quiz' ? opp.quizAccuracy : opp.predictionAccuracy;
      const isCorrect = Math.random() * 100 < accuracy;
      const answer = isCorrect ? currentQ.correctAnswer : currentQ.options.find(o => o.id !== currentQ.correctAnswer)?.id || currentQ.options[0].id;
      battle.lockInOpponentAnswer(answer);
      if (isPrediction) {
        const conf = Math.min(100, Math.max(20, opp.predictionAccuracy + (Math.random() * 20 - 10)));
        battle.setOpponentConfidence(Math.round(conf));
      }
    }, delay);
    return () => clearTimeout(t);
  }, [battle.status, battle.currentQuestion, battle.opponentAnswered, revealPhase]);

  const handleReveal = useCallback(() => {
    if (!currentQ) return;
    setRevealPhase('revealing');
    setShowConfidence(false);

    const playerCorrect = battle.playerAnswer === currentQ.correctAnswer;
    const opponentCorrect = battle.opponentAnswer === currentQ.correctAnswer;
    const playerFirst = battle.playerAnswered && !battle.opponentAnswered;

    let playerPoints = 0;
    let opponentPoints = 0;

    if (currentQ.type === 'quiz') {
      playerPoints = playerCorrect ? currentQ.basePoints + (playerFirst ? 1 : 0) + (battle.isOnFire ? 1 : 0) : 0;
      opponentPoints = opponentCorrect ? currentQ.basePoints : 0;
    } else {
      playerPoints = playerCorrect ? Math.round(currentQ.basePoints * (battle.playerConfidence / 50)) : 0;
      opponentPoints = opponentCorrect ? Math.round(currentQ.basePoints * (battle.opponentConfidence / 50)) : 0;
    }

    const result: import('@/store/useBattleStore').RoundResult = {
      questionId: currentQ.id,
      playerAnswer: battle.playerAnswer,
      opponentAnswer: battle.opponentAnswer,
      correctAnswer: currentQ.correctAnswer,
      playerCorrect,
      opponentCorrect,
      playerConfidence: isPrediction ? battle.playerConfidence : null,
      opponentConfidence: isPrediction ? battle.opponentConfidence : null,
      playerFirst,
      playerPoints,
      opponentPoints,
    };

    setTimeout(() => {
      battle.applyRoundResult(result);
      setRevealPhase('explanation');
    }, 1500);
  }, [currentQ, battle, isPrediction]);

  // Both answered → reveal
  useEffect(() => {
    if (battleStatus !== 'active') return;
    if ((battlePlayerAnswered && battleOpponentAnswered) || battleTimeRemaining <= 0) {
      if (revealPhase === 'idle') {
        if (timerRef.current) clearInterval(timerRef.current);
        handleReveal();
      }
    }
  }, [battleStatus, battlePlayerAnswered, battleOpponentAnswered, battleTimeRemaining, revealPhase, handleReveal]);

  const handleNextOrEnd = useCallback(() => {
    setRevealPhase('idle');
    const isLast = battle.currentQuestion >= battle.totalQuestions - 1;
    const playerDead = battle.playerHP <= 0;
    const opponentDead = battle.opponentHP <= 0;

    if (isLast || playerDead || opponentDead) {
      // Determine result
      let result: 'win' | 'loss' | 'draw';
      if (battle.playerScore > battle.opponentScore) result = 'win';
      else if (battle.playerScore < battle.opponentScore) result = 'loss';
      else if (battle.playerHP > battle.opponentHP) result = 'win';
      else if (battle.playerHP < battle.opponentHP) result = 'loss';
      else result = 'draw';

      const xp = result === 'win'
        ? Math.max(10, battle.playerScore * 15 + 50)
        : result === 'draw'
          ? 0
          : -Math.max(5, Math.round(battle.opponentScore * 5));
      const br = result === 'win'
        ? Math.floor(20 + Math.random() * 30)
        : result === 'loss'
          ? -Math.floor(10 + Math.random() * 20)
          : 0;
      battle.endBattle(result, xp, br);

      recordBattleProgress(result, xp, br);
    } else {
      battle.nextQuestion();
    }
  }, [battle]);

  const handlePlayerAnswer = useCallback((answerId: string) => {
    if (battlePlayerAnswered || revealPhase !== 'idle') return;
    battleLockInAnswer(answerId);
    if (battleId) {
      sendBattleAction(battleId, 'answer', {
        questionIndex: battleCurrentQuestion,
        answer: answerId,
        confidence: battlePlayerConfidence,
      });
    }
    if (isPrediction) {
      setShowConfidence(true);
    }
  }, [battlePlayerAnswered, revealPhase, battleLockInAnswer, battleId, sendBattleAction, battleCurrentQuestion, battlePlayerConfidence, isPrediction]);

  const handleTimeout = useCallback(() => {
    if (revealPhase !== 'idle' || battle.status !== 'active') return;
    if (!battle.playerAnswered) {
      battle.lockInAnswer('');
      if (battleId) {
        sendBattleAction(battleId, 'answer', {
          questionIndex: battleCurrentQuestion,
          answer: '',
          confidence: isPrediction ? 0 : undefined,
        });
      }
    }
    if (!battle.opponentAnswered && !battleId) {
      battle.lockInOpponentAnswer(currentQ?.correctAnswer || '');
    }
  }, [revealPhase, battle, currentQ, battleId, sendBattleAction, battleCurrentQuestion, isPrediction]);

  if (!user) return null;
  if (!battle.opponent || !battle.mode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-white px-4">
        <div className="glass p-8 rounded-3xl border border-border/40 text-center shadow-lg max-w-md">
          <p className="text-xl font-semibold">Joining battle...</p>
          <p className="mt-3 text-sm text-muted-foreground">Waiting for the opponent and battle data to load.</p>
        </div>
      </div>
    );
  }

  // Pre-battle countdown
  if (showPreBattle) {
    return (
      <PreBattleCountdown
        onComplete={() => { setShowPreBattle(false); battle.setStatus('active'); }}
        playerAvatar={user.avatarId}
        opponentAvatar={battle.opponent.avatarId}
        mode={battle.mode}
        playerName={user.username}
        opponentName={battle.opponent.username}
      />
    );
  }

  // Battle end
  if (battle.status === 'finished') {
    return (
      <BattleEndScreen
        result={battle.result!}
        playerScore={battle.playerScore}
        opponentScore={battle.opponentScore}
        playerHP={battle.playerHP}
        opponentHP={battle.opponentHP}
        xpEarned={battle.xpEarned}
        brChange={battle.brChange}
        roundResults={battle.roundResults}
        opponentName={battle.opponent.username}
        mode={battle.mode}
        onRematch={() => {
          const qs = getQuestionsForBattle(battle.mode!, battle.categories[0]);
          battle.startGame(qs);
          setShowPreBattle(true);
        }}
        onExit={() => {
          battle.reset();
          clearBattleRoom();
          navigate('/battle');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-nq-void grain-overlay">
      <AnimatePresence>
        {incomingChallenge && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="glass p-6 max-w-md w-full space-y-4 border border-white/10 rounded-3xl"
            >
              <p className="text-sm text-white/60 uppercase tracking-[0.35em]">Incoming Challenge</p>
              <h3 className="font-orbitron text-xl text-white">{incomingChallenge.from.username} challenged you to a battle</h3>
              <p className="text-sm text-white/70">Mode: {incomingChallenge.mode.toUpperCase()} • Category: {incomingChallenge.category}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => respondToChallenge(incomingChallenge.challengeId, false)}
                  className="flex-1 h-12 rounded-2xl glass text-sm font-medium text-white/80 border border-white/10"
                >
                  Decline
                </button>
                <button
                  onClick={() => respondToChallenge(incomingChallenge.challengeId, true)}
                  className="flex-1 h-12 rounded-2xl bg-battle-blue text-white text-sm font-medium"
                >
                  Accept
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <ParticleBg color={battle.status === 'active' ? '#00E5FF' : '#FF2244'} count={40} />

      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          animate={{ scale: [1, 1.05, 1], opacity: [0.12, 0.2, 0.12] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute left-0 top-0 h-full w-1/2 bg-[radial-gradient(circle_at_top_left,rgba(0,229,255,0.16),transparent_42%)]"
        />
        <motion.div
          animate={{ scale: [1, 1.06, 1], opacity: [0.1, 0.18, 0.1] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute right-0 top-0 h-full w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(255,34,68,0.16),transparent_42%)]"
        />
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-battle-blue via-battle-gold to-battle-red opacity-70" />
      </div>

      {/* Split bg tint */}
      <div className="absolute inset-0 flex pointer-events-none">
        <div className="w-1/2 bg-battle-blue/[0.04]" />
        <div className="w-1/2 bg-battle-red/[0.04]" />
      </div>
      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-foreground/10" />

      {/* Momentum overlays */}
      <AnimatePresence>
        {battle.isOnFire && <MomentumOverlay side="player" />}
        {battle.opponentOnFire && <MomentumOverlay side="opponent" />}
      </AnimatePresence>

      {/* HUD */}
      <div className="relative z-10 glass border-b border-border/30 bg-gradient-to-r from-battle-blue/10 via-background to-battle-red/10">
        <div className="flex items-center justify-between px-3 lg:px-6 py-3">
          {/* Player side */}
          <div className="flex items-center gap-3">
            <span className="text-2xl lg:text-3xl">{AVATAR_EMOJIS[user.avatarId]}</span>
            <div className="hidden sm:block">
              <p className="font-orbitron text-xs text-battle-blue uppercase tracking-wider">{user.username}</p>
              <HPBar hp={battle.playerHP} max={100} side="player" />
            </div>
            <span className="font-orbitron text-2xl lg:text-4xl text-battle-blue ml-2">{battle.playerScore}</span>
          </div>

          {/* Center */}
          <div className="flex flex-col items-center gap-1">
            <span className="font-orbitron text-[10px] text-battle-gold tracking-[0.35em] uppercase">Battle Arena</span>
            <span className="font-orbitron text-xs text-muted-foreground">Q{battle.currentQuestion + 1}/{battle.totalQuestions}</span>
            {battle.status === 'active' && revealPhase === 'idle' && (
              <BattleTimer time={battle.timeRemaining} max={battle.timerSpeed} onTimeout={handleTimeout} />
            )}
          </div>

          {/* Opponent side */}
          <div className="flex items-center gap-3">
            <span className="font-orbitron text-2xl lg:text-4xl text-battle-red mr-2">{battle.opponentScore}</span>
            <div className="hidden sm:block text-right">
              <p className="font-orbitron text-xs text-battle-red uppercase tracking-wider">{battle.opponent.username}</p>
              <HPBar hp={battle.opponentHP} max={100} side="opponent" />
            </div>
            <span className="text-2xl lg:text-3xl">{AVATAR_EMOJIS[battle.opponent.avatarId]}</span>
          </div>
        </div>

        {/* Mobile HP bars */}
        <div className="sm:hidden flex justify-between px-3 pb-2">
          <div>
            <p className="text-[9px] font-space-mono text-battle-blue mb-0.5">{user.username}</p>
            <HPBar hp={battle.playerHP} max={100} side="player" />
          </div>
          <div className="text-right">
            <p className="text-[9px] font-space-mono text-battle-red mb-0.5">{battle.opponent.username}</p>
            <HPBar hp={battle.opponentHP} max={100} side="opponent" />
          </div>
        </div>
      </div>

      {/* Question Area */}
      <div className="relative z-10 max-w-2xl mx-auto px-4 py-6 space-y-5">
        {currentQ && (
          <AnimatePresence mode="wait">
            <motion.div key={currentQ.id} initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -60, opacity: 0 }}
              transition={{ duration: 0.3 }} className="space-y-5"
            >
              {/* Question card */}
              <div className="glass p-5 lg:p-6 space-y-3 border border-nq-cyan/15 shadow-[0_0_40px_rgba(0,229,255,0.08)] relative overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-battle-blue via-battle-gold to-battle-red opacity-80" />
                <div className="flex items-center gap-3">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center font-orbitron text-xs font-bold border ${currentQ.type === 'quiz' ? 'bg-battle-blue/15 text-battle-blue border-battle-blue/30' : 'bg-battle-gold/15 text-battle-gold border-battle-gold/30'
                    }`}>
                    {currentQ.type === 'quiz' ? <Zap className="w-4 h-4" /> : '🔮'}
                  </span>
                  <span className="text-[10px] font-space-mono uppercase text-muted-foreground">{currentQ.category} • {currentQ.type === 'quiz' ? currentQ.difficulty : 'Prediction'}</span>
                </div>
                <p className="font-plex text-sm text-muted-foreground italic">{currentQ.context}</p>
                <p className="font-plex text-base lg:text-lg leading-relaxed">{currentQ.question}</p>
              </div>

              {/* Status indicators */}
              <div className="flex justify-between text-[10px] font-space-mono text-muted-foreground px-1">
                <span>{battle.playerAnswered ? '✓ You locked in' : 'Awaiting your answer...'}</span>
                <span>{battle.opponentAnswered ? '✓ Opponent locked in' : 'Opponent thinking...'}</span>
              </div>

              {/* Answer options */}
              <div className="space-y-3">
                {currentQ.options.map((opt, i) => (
                  <AnswerOption
                    key={opt.id}
                    option={opt}
                    index={i}
                    isSelected={battle.playerAnswer === opt.id}
                    isCorrect={revealPhase !== 'idle' ? opt.id === currentQ.correctAnswer : null}
                    isRevealed={revealPhase !== 'idle'}
                    isDisabled={battle.playerAnswered || revealPhase !== 'idle'}
                    onClick={() => handlePlayerAnswer(opt.id)}
                  />
                ))}
              </div>

              {/* Confidence slider for predictions */}
              {isPrediction && showConfidence && revealPhase === 'idle' && (
                <ConfidenceSlider
                  value={battle.playerConfidence}
                  onChange={(v) => battle.setPlayerConfidence(v)}
                  locked={false}
                />
              )}

              {/* Explanation */}
              {revealPhase === 'explanation' && (
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="glass p-5 space-y-3">
                  <p className={`font-orbitron text-sm ${battle.playerAnswer === currentQ.correctAnswer ? 'text-auth-success' : 'text-auth-error'}`}>
                    {battle.playerAnswer === currentQ.correctAnswer ? '✓ CORRECT!' : '✗ WRONG!'}
                  </p>
                  <p className="font-plex text-sm text-muted-foreground">{currentQ.explanation}</p>
                  <p className="text-[10px] font-space-mono text-muted-foreground">Source: {currentQ.source}</p>
                  <button onClick={handleNextOrEnd}
                    className="w-full h-12 btn-gradient rounded-xl font-orbitron text-sm"
                  >
                    {battle.currentQuestion >= battle.totalQuestions - 1 ? 'SEE RESULTS' : 'NEXT QUESTION →'}
                  </button>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

export default BattleArena;
