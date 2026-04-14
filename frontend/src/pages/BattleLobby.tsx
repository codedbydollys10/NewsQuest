import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, Brain, Sparkles, Zap, Users, Settings, X, Search, Target, Flame, Clock } from 'lucide-react';
import ParticleBg from '@/components/ParticleBg';
import { createId } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import { useBattleStore, type Opponent } from '@/store/useBattleStore';
import { useBattleSocketContext } from '@/hooks/BattleSocketProvider';
import { supabase } from '@/lib/supabase';
import { getQuestionsForBattle } from '@/data/battleQuestions';
import { MOCK_OPPONENTS } from '@/data/mockData';

const BATTLE_CATEGORIES = ['All', 'Politics', 'Economy', 'Science', 'World', 'Tech', 'Environment'];
type RivalProfileRow = {
  id: string;
  username: string | null;
  email?: string | null;
  avatarid?: number | null;
  avatar_id?: number | null;
  level?: number | null;
  current_level?: number | null;
  battle_rating: number | null;
  battle_tier: string | null;
  wins: number | null;
  losses: number | null;
  draws: number | null;
  quizzes_total: number | null;
  quizzes_correct: number | null;
  predictions_total: number | null;
  predictions_correct: number | null;
  recent_form: string[] | null;
  last_active_date: string | null;
  created_at?: string | null;
};
type UserActivityRow = {
  user_id: string;
  activity_date: string;
  action_count: number | null;
};

const tierColor = (tier: string) => {
  switch (tier) {
    case 'ROOKIE': return 'text-muted-foreground';
    case 'ANALYST': return 'text-primary';
    case 'STRATEGIST': return 'text-battle-blue';
    case 'ORACLE': return 'text-secondary';
    case 'MASTER': return 'text-battle-gold';
    case 'LEGEND': return 'text-battle-gold';
    default: return 'text-muted-foreground';
  }
};

const mapProfileToOpponent = (profile: RivalProfileRow): Opponent => {
  const wins = typeof profile.wins === 'number' ? profile.wins : 0;
  const losses = typeof profile.losses === 'number' ? profile.losses : 0;
  const draws = typeof profile.draws === 'number' ? profile.draws : 0;
  const quizzesTotal = typeof profile.quizzes_total === 'number' ? profile.quizzes_total : 0;
  const quizzesCorrect = typeof profile.quizzes_correct === 'number' ? profile.quizzes_correct : 0;
  const predictionsTotal = typeof profile.predictions_total === 'number' ? profile.predictions_total : 0;
  const predictionsCorrect = typeof profile.predictions_correct === 'number' ? profile.predictions_correct : 0;
  const avatarId = typeof profile.avatarid === 'number'
    ? profile.avatarid
    : typeof profile.avatar_id === 'number'
      ? profile.avatar_id
      : 0;
  const level = typeof profile.level === 'number'
    ? profile.level
    : typeof profile.current_level === 'number'
      ? profile.current_level
      : 1;
  const fallbackLastSeen = profile.created_at ?? new Date().toISOString();

  return {
    id: profile.id,
    username: profile.username ?? `player-${String(profile.id).slice(-4)}`,
    avatarId,
    level,
    battleRating: typeof profile.battle_rating === 'number' ? profile.battle_rating : 1000,
    tier: profile.battle_tier ?? 'ROOKIE',
    quizAccuracy: quizzesTotal > 0 ? Math.round((quizzesCorrect / quizzesTotal) * 100) : 60,
    predictionAccuracy: predictionsTotal > 0 ? Math.round((predictionsCorrect / predictionsTotal) * 100) : 60,
    winRate: wins + losses > 0 ? Math.round((wins / Math.max(1, wins + losses)) * 100) : 50,
    totalBattles: wins + losses + draws,
    wins,
    losses,
    draws,
    recentForm: Array.isArray(profile.recent_form) ? profile.recent_form : [],
    isOnline: false,
    lastSeen: profile.last_active_date ?? fallbackLastSeen,
    socketId: profile.id,
  };
};

const BattleLobby = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { status, mode, opponent, categories, timerSpeed, searchTime,
    setMode, setStatus, setOpponent, setCategories, setTimerSpeed, setSearchTime, setBattleId, reset, startGame } = useBattleStore();
  const {
    onlinePlayers,
    incomingChallenge,
    outgoingStatus,
    battleRoom,
    challengePlayer,
    respondToChallenge,
    clearBattleRoom,
    socketConnected,
    selfId,
  } = useBattleSocketContext();

  const [showSettings, setShowSettings] = useState(false);
  const [showChallenge, setShowChallenge] = useState(false);
  const [challengeSearch, setChallengeSearch] = useState('');
  const [challengeTarget, setChallengeTarget] = useState<Opponent | null>(null);
  const [challengeStatus, setChallengeStatus] = useState<'idle' | 'pending' | 'accepted' | 'declined'>('idle');
  const [countdown, setCountdown] = useState(3);
  const [rivalUsers, setRivalUsers] = useState<Opponent[]>([]);
  const [rivalsLoading, setRivalsLoading] = useState(false);
  const [rivalsError, setRivalsError] = useState<string | null>(null);

  const liveOpponents = onlinePlayers.filter((player) => player.id !== user?.id && player.socketId !== selfId);
  const suggested = liveOpponents.length > 0 ? liveOpponents : rivalUsers;

  const openChallengeWithTarget = useCallback((target: Opponent) => {
    if (!mode) setMode('quiz');
    setChallengeTarget(target);
    setChallengeStatus('idle');
    setShowChallenge(true);
  }, [mode, setMode]);

  const challengeWithTarget = useCallback((target: Opponent) => {
    if (!user) return;
    const effectiveMode = mode ?? 'quiz';
    if (!mode) setMode(effectiveMode);
    const category = categories[0] || 'All';
    const questions = getQuestionsForBattle(effectiveMode, category);
    const sent = challengePlayer(target.id, {
      mode: effectiveMode,
      category,
      timerSpeed,
      questions,
    });
    setChallengeTarget(target);
    if (sent) {
      setChallengeStatus('pending');
      setShowChallenge(true);
      return;
    }
    setChallengeStatus('declined');
    setShowChallenge(true);
  }, [user, mode, setMode, categories, timerSpeed, challengePlayer]);

  const handleSendChallenge = () => {
    if (!challengeTarget) return;
    challengeWithTarget(challengeTarget);
  };

  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  useEffect(() => {
    if (!user) return;
    let active = true;

    const loadRivalUsers = async () => {
      setRivalsLoading(true);
      setRivalsError(null);
      let data: RivalProfileRow[] | null = null;
      let error: { message: string } | null = null;
      const today = new Date();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 7);
      const fromDate = sevenDaysAgo.toISOString().slice(0, 10);

      const activityResp = await supabase
        .from('user_activity')
        .select('user_id,activity_date,action_count')
        .gte('activity_date', fromDate);

      const activeUserIds = new Set<string>(
        ((activityResp.data as UserActivityRow[] | null) ?? [])
          .filter((row) => row.user_id && (typeof row.action_count !== 'number' || row.action_count > 0))
          .map((row) => row.user_id)
          .filter((id) => id !== user.id),
      );

      if (activityResp.error) {
        error = { message: activityResp.error.message };
      }

      if (activeUserIds.size === 0) {
        if (!active) return;
        setRivalUsers([]);
        setRivalsLoading(false);
        return;
      }

      const activeIds = Array.from(activeUserIds);

      const userProfileResp = await supabase
        .from('user_profile')
        .select('id,username,email,avatarid,level,battle_rating,battle_tier,created_at')
        .in('id', activeIds);

      if (userProfileResp.error) {
        const fallbackResp = await supabase
          .from('profiles')
          .select('*')
          .in('id', activeIds);
        data = (fallbackResp.data as RivalProfileRow[] | null) ?? null;
        if (fallbackResp.error) {
          error = { message: fallbackResp.error.message };
        }
      } else {
        data = (userProfileResp.data as RivalProfileRow[] | null) ?? null;
      }

      if (!active) return;
      if (error) {
        setRivalsError(error.message);
        setRivalUsers([]);
      } else {
        setRivalUsers((data ?? []).map(mapProfileToOpponent));
      }
      setRivalsLoading(false);
    };

    void loadRivalUsers();

    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (!battleRoom || !user) return;

    const opponentPlayer = battleRoom.players.find((player) => player.id !== user.id);
    if (!opponentPlayer) {
      clearBattleRoom();
      return;
    }
    if (!opponentPlayer) return;

    setMode(battleRoom.mode);
    setBattleId(battleRoom.roomId);
    setOpponent(opponentPlayer as Opponent);
    setStatus('pre_battle');
    setCategories([battleRoom.category]);
    setTimerSpeed(battleRoom.timerSpeed);
    startGame(battleRoom.questions);
    navigate(`/battle/${battleRoom.roomId}`);
  }, [battleRoom, user, setMode, setBattleId, setOpponent, setStatus, setCategories, setTimerSpeed, startGame, navigate, clearBattleRoom]);

  useEffect(() => {
    if (outgoingStatus === 'pending') setChallengeStatus('pending');
    if (outgoingStatus === 'accepted') setChallengeStatus('accepted');
    if (outgoingStatus === 'declined') setChallengeStatus('declined');
    if (outgoingStatus === 'idle') setChallengeStatus('idle');
  }, [outgoingStatus]);

  // Matchmaking simulation
  const startSearch = useCallback(() => {
    if (!mode) return;
    setStatus('searching');
    setSearchTime(0);

    const duration = 2000 + Math.random() * 3000;
    let elapsed = 0;
    const timer = setInterval(() => { elapsed++; setSearchTime(elapsed); }, 1000);

    setTimeout(() => {
      clearInterval(timer);
      const br = user?.battleRating || 1000;
      const match = MOCK_OPPONENTS.filter((o) => Math.abs(o.battleRating - br) < 300);
      const picked = match[Math.floor(Math.random() * match.length)] || MOCK_OPPONENTS[0];
      setOpponent(picked);
      setStatus('found');
    }, duration);
  }, [mode, user, setStatus, setOpponent, setSearchTime]);

  // Countdown after opponent found
  useEffect(() => {
    if (status !== 'found') return;
    setCountdown(3);
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          const id = createId();
          setBattleId(id);
          // Prepare questions and navigate to arena
          import('@/data/battleQuestions').then(({ getQuestionsForBattle }) => {
            const qs = getQuestionsForBattle(useBattleStore.getState().mode!, useBattleStore.getState().categories[0]);
            useBattleStore.getState().startGame(qs);
            navigate(`/battle/${id}`);
          });
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [status, setBattleId]);

  if (!user) return null;

  const filteredRivalUsers = suggested.filter((o) =>
    o.id !== user.id &&
    (!challengeSearch || o.username.toLowerCase().includes(challengeSearch.toLowerCase()))
  );

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#171b20] grain-overlay">
      <ParticleBg color={status === 'searching' ? '#FF2244' : '#00E5FF'} count={80} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,229,255,0.10),transparent_34%),radial-gradient(circle_at_top_right,rgba(255,34,68,0.08),transparent_30%),radial-gradient(circle_at_bottom,rgba(124,58,237,0.06),transparent_28%)]" />

      {/* Header */}
      <div className="relative z-10 h-16 glass flex items-center justify-between px-6 border-b border-white/10 bg-[#181c21]/80">
        <div className="flex items-center gap-2">
          <Swords className="w-5 h-5 text-battle-blue" />
          <span className="font-orbitron text-lg text-gradient-cyan tracking-wider">BATTLE ARENA</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowSettings(!showSettings)} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <Settings className="w-5 h-5 text-muted-foreground" />
          </button>
          <button onClick={() => { reset(); navigate('/'); }} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col lg:flex-row h-[calc(100vh-4rem)]">

        {/* LEFT — Player Card */}
        <div className="lg:w-1/3 p-4 lg:p-6 overflow-y-auto border-l border-white/10">
          <div className="space-y-5">
            {/* Avatar */}
            <div className="flex flex-col items-center">
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="text-7xl mb-3"
              >
                {['🏃', '🧠', '🔮', '⚡', '👻'][user.avatarId]}
              </motion.div>
              <h2 className="font-orbitron text-lg uppercase tracking-wider text-white/90">{user.username}</h2>
              <span className="text-xs font-space-mono text-white/45">Level {user.currentLevel}</span>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="glass p-3 text-center rounded-2xl border border-white/10 bg-[#23282f]/70">
                <p className="text-[10px] font-space-mono uppercase text-white/45">Battle Rating</p>
                <p className="font-orbitron text-2xl text-battle-blue">{user.battleRating.toLocaleString()}</p>
              </div>
              <div className="glass p-3 text-center rounded-2xl border border-white/10 bg-[#23282f]/70">
                <p className="text-[10px] font-space-mono uppercase text-white/45">Tier</p>
                <p className={`font-orbitron text-sm ${tierColor(user.battleTier)}`}>{user.battleTier}</p>
              </div>
              <div className="glass p-3 text-center rounded-2xl border border-white/10 bg-[#23282f]/70">
                <p className="text-[10px] font-space-mono uppercase text-white/45">Win Rate</p>
                <p className={`font-orbitron text-xl ${user.wins / Math.max(1, user.wins + user.losses) > 0.6 ? 'text-auth-success' : 'text-auth-warning'}`}>
                  {Math.round((user.wins / Math.max(1, user.wins + user.losses)) * 100)}%
                </p>
              </div>
              <div className="glass p-3 text-center rounded-2xl border border-white/10 bg-[#23282f]/70">
                <p className="text-[10px] font-space-mono uppercase text-white/45">Record</p>
                <p className="font-space-mono text-xs">
                  <span className="text-auth-success">{user.wins}W</span>{' '}
                  <span className="text-auth-error">{user.losses}L</span>{' '}
                  <span className="text-auth-warning">{user.draws}D</span>
                </p>
              </div>
            </div>

            {/* Recent Form */}
            <div>
              <p className="text-[10px] font-space-mono uppercase text-white/45 mb-2">Last 10 Battles</p>
              <div className="flex gap-1.5">
                {user.recentForm.map((r, i) => (
                  <div
                    key={i}
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${r === 'W' ? 'bg-auth-success/20 text-auth-success' : r === 'L' ? 'bg-auth-error/20 text-auth-error' : 'bg-auth-warning/20 text-auth-warning'
                      }`}
                  >
                    {r === 'W' ? '✓' : r === 'L' ? '✗' : '='}
                  </div>
                ))}
              </div>
            </div>

            {/* Skill Bars */}
            <div className="space-y-3">
              {[
                { label: 'Quiz Speed', icon: <Clock className="w-3.5 h-3.5" />, value: 82, color: 'bg-[#57b7ff]' },
                { label: 'Prediction IQ', icon: <Sparkles className="w-3.5 h-3.5" />, value: 67, color: 'bg-[#b07cff]' },
                { label: 'Accuracy', icon: <Target className="w-3.5 h-3.5" />, value: 74, color: 'bg-[#43e0d1]' },
                { label: 'Streak Power', icon: <Flame className="w-3.5 h-3.5" />, value: 85, color: 'bg-[#ffc94d]' },
              ].map((s, i) => (
                <div key={s.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-plex text-white/45">{s.icon} {s.label}</span>
                    <span className="font-space-mono">{s.value}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/8 overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${s.color}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${s.value}%` }}
                      transition={{ duration: 1, delay: i * 0.15 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CENTER — VS Zone */}
        <div className="lg:w-1/3 p-4 lg:p-6 flex flex-col items-center justify-start gap-6 overflow-y-auto">
          {/* VS */}
          <div className="flex items-center justify-center py-4">
            <motion.span
              initial={{ x: -100, opacity: 0, rotate: -8 }}
              animate={{ x: 0, opacity: 1, rotate: 0 }}
              transition={{ duration: 0.6 }}
              className="font-orbitron text-[72px] lg:text-[104px] leading-none font-black text-[#58b9ff] drop-shadow-[0_0_24px_rgba(0,229,255,0.45)]"
            >
              V
            </motion.span>
            <motion.span
              initial={{ scale: 0.85, opacity: 0, y: -8 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.45, delay: 0.15 }}
              className="font-orbitron text-[72px] lg:text-[104px] leading-none font-black -ml-1 text-[#ff6a67] drop-shadow-[0_0_24px_rgba(255,106,103,0.45)]"
            >
              S
            </motion.span>
          </div>

          {/* Mode Selector */}
          <div className="w-full max-w-sm space-y-3">
            <p className="text-[10px] font-space-mono uppercase text-white/45 text-center tracking-widest">Select Battle Mode</p>
            {[
              { id: 'quiz' as const, label: 'QUIZ BATTLE', desc: 'Speed & accuracy competition', badge: '5 QUESTIONS', icon: <Brain className="w-8 h-8" />, borderColor: 'border-[#57b7ff]' },
              { id: 'prediction' as const, label: 'PREDICTION BATTLE', desc: 'Confidence & foresight duel', badge: '5 PREDICTIONS', icon: <Sparkles className="w-8 h-8" />, borderColor: 'border-[#b07cff]' },
              { id: 'mixed' as const, label: 'MIXED BATTLE', desc: 'Quiz + Prediction hybrid', badge: '8 ROUNDS', icon: <Zap className="w-8 h-8" />, borderColor: 'border-[#7ad4ff]' },
            ].map((m) => (
              <motion.button
                key={m.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setMode(m.id)}
                className={`w-full glass p-4 flex items-center gap-4 rounded-2xl transition-all bg-[#21262c]/80 border border-white/10 ${mode === m.id ? `${m.borderColor} border-2 shadow-[0_0_22px_rgba(124,58,237,0.18)]` : 'hover:border-white/20'
                  }`}
              >
                <span className={mode === m.id ? 'text-[#7ad4ff]' : 'text-white/45'}>{m.icon}</span>
                <div className="flex-1 text-left">
                  <p className="font-orbitron text-sm text-white/90">{m.label}</p>
                  <p className="text-xs font-plex text-white/45">{m.desc}</p>
                </div>
                <span className="text-[10px] font-space-mono glass px-2 py-1 rounded-full bg-white/5 border border-white/10 text-white/70">{m.badge}</span>
              </motion.button>
            ))}
          </div>

          {/* Settings */}
          {mode && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-sm space-y-4"
            >
              <div>
                <p className="text-[10px] font-space-mono uppercase text-white/45 mb-2">Category</p>
                <div className="flex flex-wrap gap-1.5">
                  {BATTLE_CATEGORIES.map((c) => (
                    <button
                      key={c}
                      onClick={() => setCategories(categories.includes(c) ? categories.filter((x) => x !== c) : [...categories, c])}
                      className={`px-3 py-1 rounded-full text-[11px] font-plex transition-all border ${categories.includes(c) ? 'bg-[#b07cff]/20 border-[#b07cff]/30 text-[#d6b7ff]' : 'bg-white/5 border-white/10 text-white/45'
                        }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-space-mono uppercase text-white/45 mb-2">Timer Speed</p>
                <div className="flex gap-2">
                  {[{ v: 15, l: '⚡ Quick' }, { v: 30, l: '⏱ Standard' }, { v: 45, l: '🎯 Pro' }].map((t) => (
                    <button
                      key={t.v}
                      onClick={() => setTimerSpeed(t.v)}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-plex transition-all border ${timerSpeed === t.v ? 'bg-[#57b7ff]/20 border-[#57b7ff]/30 text-[#57b7ff]' : 'bg-white/5 border-white/10 text-white/45'
                        }`}
                    >
                      {t.l}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Action Buttons */}
          <div className="w-full max-w-sm space-y-3">
            {status === 'idle' && (
              <>
                <motion.button
                  whileHover={mode ? { scale: 1.03 } : {}}
                  whileTap={mode ? { scale: 0.97 } : {}}
                  onClick={startSearch}
                  disabled={!mode}
                  className="w-full h-16 rounded-2xl text-base flex items-center justify-center gap-3 font-orbitron tracking-wider text-white border border-white/15 bg-gradient-to-r from-[#58b9ff] via-[#8b5cf6] to-[#ff6ea8] shadow-[0_0_28px_rgba(0,229,255,0.18)] disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Swords className="w-6 h-6" />
                  FIND RIVAL
                </motion.button>
                <button onClick={() => { if (!mode) setMode('quiz'); setShowChallenge(true); }} className="w-full h-12 rounded-2xl glass flex items-center justify-center gap-2 font-orbitron text-xs tracking-[0.2em] text-white/70 hover:text-white transition-colors border border-white/10 bg-white/5">
                  <Users className="w-5 h-5" />
                  CHALLENGE FRIEND
                </button>
              </>
            )}
            {status === 'searching' && (
              <div className="text-center space-y-3">
                <div className="relative w-32 h-32 mx-auto">
                  {[200, 150, 100].map((s, i) => (
                    <motion.div
                      key={s}
                      animate={{ scale: [1, 1.15, 1] }}
                      transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
                      className="absolute inset-0 m-auto rounded-full border border-battle-red/30"
                      style={{ width: s * 0.6, height: s * 0.6 }}
                    />
                  ))}
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    className="absolute inset-0 m-auto w-full h-0.5 origin-center"
                  >
                    <div className="w-1/2 h-full bg-gradient-to-r from-transparent to-battle-red" />
                  </motion.div>
                  <Search className="absolute inset-0 m-auto w-6 h-6 text-battle-red" />
                </div>
                <p className="font-orbitron text-sm">SCANNING FOR RIVALS...</p>
                <p className="font-space-mono text-xs text-muted-foreground">Searching: 00:{String(searchTime).padStart(2, '0')}</p>
                <button
                  onClick={() => { setStatus('idle'); setOpponent(null); }}
                  className="glass px-4 py-2 text-xs font-plex text-muted-foreground hover:text-foreground"
                >
                  Cancel Search
                </button>
              </div>
            )}
          </div>

          {/* Active Count */}
          <div className="glass px-4 py-2 text-center w-full max-w-sm rounded-2xl border border-white/10 bg-[#23282f]/70">
            <p className="text-xs font-plex text-white/65">🔥 Active battles right now: <span className="text-[#57b7ff] font-bold">23</span></p>
            <p className="text-[10px] text-white/40">Average wait time: &lt;10s</p>
          </div>
        </div>

        {/* RIGHT — Opponent Zone */}
        <div className="lg:w-1/3 p-4 lg:p-6 overflow-y-auto border-r border-white/10">
          <AnimatePresence mode="wait">
            {/* IDLE */}
            {(status === 'idle') && (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                <div className="text-center space-y-2 py-6">
                  <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity }}>
                    <Search className="w-12 h-12 mx-auto text-battle-red" />
                  </motion.div>
                  <h3 className="font-orbitron text-lg">AWAITING CHALLENGER</h3>
                  <p className="text-xs font-plex text-muted-foreground">Find a rival or challenge a friend to begin</p>
                </div>

                <div>
                  <p className="text-[10px] font-space-mono uppercase text-muted-foreground mb-3">Recommended Rivals</p>
                  <div className="space-y-2">
                    {rivalsLoading ? (
                      <div className="rounded-2xl glass border border-white/10 bg-[#23282f]/70 p-4 text-center text-xs text-muted-foreground">Loading rivals...</div>
                    ) : rivalsError ? (
                      <div className="rounded-2xl glass border border-white/10 bg-[#23282f]/70 p-4 text-center text-xs text-red-300">{rivalsError}</div>
                    ) : suggested.length === 0 ? (
                      <div className="rounded-2xl glass border border-white/10 bg-[#23282f]/70 p-4 text-center text-xs text-muted-foreground">No rivals available</div>
                    ) : (
                      suggested.map((opp) => (
                        <OpponentCard key={opp.id} opp={opp} onChallenge={() => openChallengeWithTarget(opp)} />
                      ))
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* SEARCHING */}
            {status === 'searching' && (
              <motion.div key="searching" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center justify-center h-full">
                <div className="text-center space-y-4">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                    className="w-24 h-24 mx-auto border-2 border-battle-red/30 rounded-full border-t-battle-red"
                  />
                  <p className="font-orbitron text-sm text-battle-red">SCANNING...</p>
                </div>
              </motion.div>
            )}

            {/* FOUND */}
            {status === 'found' && opponent && (
              <motion.div key="found" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-5">
                <motion.div
                  initial={{ x: 100 }}
                  animate={{ x: 0 }}
                  className="glass p-3 rounded-2xl bg-[#23282f]/80 border border-white/10 text-center"
                >
                  <span className="font-orbitron text-sm text-[#57b7ff]">RIVAL LOCKED IN</span>
                </motion.div>

                <div className="flex flex-col items-center">
                  <motion.div animate={{ y: [0, -6, 0], scale: [1, 1.02, 1] }} transition={{ duration: 3, repeat: Infinity }} className="text-7xl mb-3 drop-shadow-[0_0_18px_rgba(0,229,255,0.18)]">
                    {['🏃', '🧠', '🔮', '⚡', '👻'][opponent.avatarId]}
                  </motion.div>
                  <h2 className="font-orbitron text-lg uppercase text-white/90">{opponent.username}</h2>
                  <span className="text-xs font-space-mono text-white/45">Level {opponent.level}</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="glass p-3 text-center rounded-2xl border border-[#57b7ff]/20 bg-[#57b7ff]/10">
                    <p className="text-[10px] font-space-mono uppercase text-white/45">BR</p>
                    <p className="font-orbitron text-xl text-battle-blue">{opponent.battleRating}</p>
                  </div>
                  <div className="glass p-3 text-center rounded-2xl border border-[#b07cff]/20 bg-[#b07cff]/10">
                    <p className="text-[10px] font-space-mono uppercase text-white/45">Tier</p>
                    <p className={`font-orbitron text-sm ${tierColor(opponent.tier)}`}>{opponent.tier}</p>
                  </div>
                  <div className="glass p-3 text-center rounded-2xl border border-[#43e0d1]/20 bg-[#43e0d1]/10">
                    <p className="text-[10px] font-space-mono uppercase text-white/45">Win Rate</p>
                    <p className="font-orbitron text-lg text-[#43e0d1]">{opponent.winRate}%</p>
                  </div>
                  <div className="glass p-3 text-center rounded-2xl border border-[#ffc94d]/20 bg-[#ffc94d]/10">
                    <p className="text-[10px] font-space-mono uppercase text-white/45">Accuracy</p>
                    <p className="font-orbitron text-lg text-[#ffc94d]">{opponent.quizAccuracy}%</p>
                  </div>
                </div>

                {/* Head to Head */}
                <div className="glass p-4 space-y-3 rounded-2xl border border-white/10 bg-[#23282f]/70">
                  <p className="text-[10px] font-space-mono uppercase text-center text-white/45 tracking-widest">Head to Head</p>
                  {[
                    { label: 'Quiz Accuracy', you: 74, them: opponent.quizAccuracy },
                    { label: 'Prediction IQ', you: 67, them: opponent.predictionAccuracy },
                    { label: 'Win Rate', you: Math.round((user.wins / Math.max(1, user.wins + user.losses)) * 100), them: opponent.winRate },
                  ].map((h) => (
                    <div key={h.label} className="flex items-center gap-2 text-xs">
                      <span className={`w-8 text-right font-space-mono ${h.you >= h.them ? 'text-battle-blue font-bold' : 'text-muted-foreground'}`}>{h.you}%</span>
                      <div className="flex-1 text-center font-plex text-muted-foreground">
                        <span className="text-white/70">{h.label}</span>
                      </div>
                      <span className={`w-8 font-space-mono ${h.them > h.you ? 'text-battle-red font-bold' : 'text-muted-foreground'}`}>{h.them}%</span>
                    </div>
                  ))}
                </div>

                {/* Countdown */}
                <div className="text-center py-4">
                  <motion.span
                    key={countdown}
                    initial={{ scale: 2, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="font-orbitron text-6xl text-[#57b7ff] drop-shadow-[0_0_18px_rgba(0,229,255,0.3)]"
                  >
                    {countdown}
                  </motion.span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Challenge Friend Modal */}
      <AnimatePresence>
        {showChallenge && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm"
            onClick={() => { setShowChallenge(false); setChallengeTarget(null); setChallengeStatus('idle'); }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass p-6 w-full max-w-sm mx-4 space-y-4 bg-[#20252b]/90 border border-white/10 rounded-2xl"
            >
              <h3 className="font-orbitron text-lg text-center text-white/90">Challenge a Friend</h3>

              {challengeStatus === 'idle' && !challengeTarget && (
                <>
                  <div className="glass-input flex items-center gap-2 rounded-xl border border-white/10 bg-white/5">
                    <Search className="w-4 h-4 text-white/45" />
                    <input
                      type="text" placeholder="Search by username..."
                      value={challengeSearch} onChange={(e) => setChallengeSearch(e.target.value)}
                      className="bg-transparent w-full text-sm font-plex-mono outline-none placeholder:text-white/35 text-white/80"
                    />
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {rivalsLoading ? (
                      <div className="rounded-2xl glass border border-white/10 bg-[#23282f]/70 p-4 text-center text-xs text-muted-foreground">Loading users...</div>
                    ) : rivalsError ? (
                      <div className="rounded-2xl glass border border-white/10 bg-[#23282f]/70 p-4 text-center text-xs text-red-300">{rivalsError}</div>
                    ) : filteredRivalUsers.length === 0 ? (
                      <div className="rounded-2xl glass border border-white/10 bg-[#23282f]/70 p-4 text-center text-xs text-muted-foreground">No users found</div>
                    ) : (
                      filteredRivalUsers.map((opp) => (
                        <div key={opp.id} className="glass p-2 flex items-center gap-2 cursor-pointer rounded-xl border border-white/10 bg-white/5 hover:border-[#57b7ff]/30 transition-all"
                          onClick={() => setChallengeTarget(opp)}
                        >
                          <span className="text-xl">{['🏃', '🧠', '🔮', '⚡', '👻'][opp.avatarId]}</span>
                          <div className="flex-1">
                            <p className="font-orbitron text-xs text-white/85">{opp.username}</p>
                            <p className="text-[10px] text-white/45 font-space-mono">Lv{opp.level} • {opp.battleRating} BR</p>
                          </div>
                          <span className="text-[10px] font-orbitron text-[#57b7ff]">SELECT</span>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}

              {challengeTarget && challengeStatus === 'idle' && (
                <div className="text-center space-y-4">
                  <p className="font-plex text-sm">
                    Challenge <span className="text-battle-red font-bold">@{challengeTarget.username}</span> to a{' '}
                    <span className="text-[#57b7ff] font-bold">{mode?.toUpperCase() || 'QUIZ'}</span> Battle?
                  </p>
                  <div className="space-y-2">
                    {!socketConnected && (
                      <p className="text-[10px] text-white/50">Socket disconnected. Please wait until the connection restores before challenging.</p>
                    )}
                    <div className="flex gap-3">
                      <button onClick={() => setChallengeTarget(null)} className="flex-1 h-10 glass rounded-xl font-plex text-sm text-white/55 border border-white/10">CANCEL</button>
                      <button
                        onClick={() => handleSendChallenge()}
                        className="flex-1 h-10 rounded-xl font-orbitron text-xs text-white border border-white/10 transition bg-gradient-to-r from-[#58b9ff] via-[#8b5cf6] to-[#ff6ea8]"
                      >
                        CONFIRM
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {challengeStatus === 'pending' && (
                <div className="text-center space-y-3 py-4">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    className="w-10 h-10 mx-auto border-2 border-primary/30 rounded-full border-t-battle-gold" />
                  <p className="font-plex text-sm text-white/55">Waiting for <span className="text-[#57b7ff]">@{challengeTarget?.username}</span>...</p>
                </div>
              )}

              {challengeStatus === 'accepted' && (
                <div className="text-center py-4">
                  <p className="font-orbitron text-[#43e0d1]">✓ Challenge Accepted!</p>
                </div>
              )}

              {challengeStatus === 'declined' && (
                <div className="text-center py-4">
                  <p className="font-orbitron text-[#ff6a67] text-sm">@{challengeTarget?.username} declined.</p>
                </div>
              )}

              <button onClick={() => { setShowChallenge(false); setChallengeTarget(null); setChallengeStatus('idle'); }}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground font-plex transition-colors">
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {incomingChallenge && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm"
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
    </div>
  );
};

const OpponentCard = ({ opp, onChallenge }: { opp: Opponent; onChallenge: () => void }) => (
  <div className="glass p-3 flex items-center gap-3">
    <span className="text-3xl">{['🏃', '🧠', '🔮', '⚡', '👻'][opp.avatarId]}</span>
    <div className="flex-1 min-w-0">
      <p className="font-orbitron text-xs truncate">{opp.username}</p>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-space-mono text-muted-foreground">Lv{opp.level}</span>
        <span className="text-[10px] font-space-mono text-battle-red">{opp.battleRating} BR</span>
        {opp.isOnline && <span className="w-1.5 h-1.5 rounded-full bg-auth-success" />}
      </div>
    </div>
    <button onClick={onChallenge} className="px-3 py-1.5 rounded-lg bg-battle-red/20 text-battle-red text-[10px] font-orbitron hover:bg-battle-red/30 transition-colors">
      CHALLENGE
    </button>
  </div>
);

export default BattleLobby;
