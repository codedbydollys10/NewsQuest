import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useGameStore } from '@/store/gameStore';
import { useAuthStore } from '@/store/useAuthStore';
import { HUDBar } from '@/components/game/HUDBar';
import { GlassCard } from '@/components/game/GlassCard';
import { XPProgressBar } from '@/components/game/XPProgressBar';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid, Legend } from 'recharts';
import { ACTIVITY_UPDATED_EVENT, fetchActivityStats } from '@/lib/activityApi';

const COLORS = ['#00E5FF', '#7C3AED', '#FF6B00', '#00FF88'];

const Dashboard = () => {
  const navigate = useNavigate();
  const authUser = useAuthStore((s) => s.user);
  const user = useGameStore((s) => s.user);
  const [trendData, setTrendData] = useState<Array<{ day: string; actions: number }>>([]);
  const [categoryKeys, setCategoryKeys] = useState<string[]>([]);
  const [categoryDaily, setCategoryDaily] = useState<Array<{ day: string; [category: string]: number | string }>>([]);

  useEffect(() => {
    if (!authUser) navigate('/login');
  }, [authUser, navigate]);

  useEffect(() => {
    if (!authUser?.id) return;
    let cancelled = false;

    const loadStats = () => {
      void fetchActivityStats(authUser.id, 30)
        .then((stats) => {
          if (cancelled) return;
          setTrendData(stats.trend.map((row) => ({
            day: row.day,
            actions: row.totalEvents,
          })));
          setCategoryKeys(stats.categories ?? []);
          setCategoryDaily((stats.categoryDaily ?? []).map((row) => ({
            day: row.day,
            ...row.values,
          })));
        })
        .catch(() => {
          if (!cancelled) {
            setTrendData([]);
            setCategoryKeys([]);
            setCategoryDaily([]);
          }
        });
    };

    loadStats();

    const onActivityUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{ userId?: string }>;
      if (customEvent.detail?.userId !== authUser.id) return;
      loadStats();
    };

    window.addEventListener(ACTIVITY_UPDATED_EVENT, onActivityUpdated);

    return () => {
      cancelled = true;
      window.removeEventListener(ACTIVITY_UPDATED_EVENT, onActivityUpdated);
    };
  }, [authUser?.id]);

  const hasTrend = trendData.length > 0;
  const chartTrend = useMemo(
    () => (hasTrend ? trendData : [{ day: 'N/A', actions: 0 }]),
    [hasTrend, trendData],
  );
  const hasCategoryDaily = categoryDaily.some((row) =>
    categoryKeys.some((key) => Number(row[key] ?? 0) > 0),
  );
  const chartCategoryDaily = useMemo(
    () => (hasCategoryDaily ? categoryDaily : [{ day: 'N/A' }]),
    [categoryDaily, hasCategoryDaily],
  );

  if (!authUser) return null;

  const quizTotal = authUser.quizzesTotal ?? user.quizzesTotal;
  const quizCorrect = authUser.quizzesCorrect ?? user.quizzesCorrect;
  const predTotal = authUser.predictionsTotal ?? user.predictionsTotal;
  const predCorrect = authUser.predictionsCorrect ?? user.predictionsCorrect;
  const quizAcc = quizTotal > 0 ? Math.round((quizCorrect / quizTotal) * 100) : 0;
  const predAcc = predTotal > 0 ? Math.round((predCorrect / predTotal) * 100) : 0;
  const battleWins = authUser.wins ?? 0;
  const battleLosses = authUser.losses ?? 0;
  const battleDraws = authUser.draws ?? 0;
  const battleForm = authUser.recentForm?.length ? authUser.recentForm : ['W', 'W', 'L', 'W', 'D'];
  const battleRating = authUser.battleRating ?? 1000;
  const battleTier = authUser.battleTier ?? 'ROOKIE';
  const battleWinRate = Math.round((battleWins / Math.max(1, battleWins + battleLosses)) * 100);

  return (
    <div className="min-h-screen bg-nq-void grain-overlay">
      <HUDBar />
      <div className="pt-[76px] pb-20 md:pb-8 max-w-6xl mx-auto px-4">
        <h1 className="font-display text-xl font-bold text-foreground mb-6">COMMAND CENTER</h1>

        {/* HUD cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'LEVEL', value: user.currentLevel, sub: <XPProgressBar compact />, color: 'text-nq-cyan' },
            { label: 'STREAK', value: `${user.streakCount} 🔥`, sub: <span className="text-xs text-nq-text-muted">Longest: {user.longestStreak}</span>, color: 'text-nq-orange' },
            { label: 'QUIZ ACC.', value: `${quizAcc}%`, sub: <span className="text-xs text-nq-text-muted">{user.quizzesCorrect}/{user.quizzesTotal}</span>, color: 'text-nq-purple' },
            { label: 'ORACLE', value: `${predAcc}%`, sub: <span className="text-xs text-nq-text-muted">{user.predictionsCorrect}/{user.predictionsTotal}</span>, color: 'text-nq-green' },
          ].map(card => (
            <GlassCard key={card.label} hover={false}>
              <p className="font-display text-[10px] text-nq-text-muted mb-1">{card.label}</p>
              <p className={`font-display text-2xl font-bold ${card.color}`}>{card.value}</p>
              <div className="mt-2">{card.sub}</div>
            </GlassCard>
          ))}
        </div>

        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-6 mb-6">
          <div className="space-y-6">
            {/* Game Arena */}
            <GlassCard hover={false}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <p className="font-display text-xs font-bold text-nq-text-secondary mb-2">GAME ARENA</p>
                  <h3 className="font-display text-lg font-bold text-foreground">Battle rivals from your dashboard</h3>
                  <p className="text-sm text-nq-text-secondary mt-1">Enter the arena to start quiz or prediction battles.</p>
                </div>
                <Link to="/battle" className="w-[220px] max-w-full h-12 rounded-xl text-sm flex items-center justify-center gap-3 font-orbitron tracking-wider text-white border border-white/15 bg-gradient-to-r from-[#58b9ff] via-[#8b5cf6] to-[#ff6ea8] shadow-[0_0_28px_rgba(0,229,255,0.18)] disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                  ENTER ARENA
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-4">
                {[
                  { label: 'BR', value: battleRating.toLocaleString() },
                  { label: 'Tier', value: battleTier },
                  { label: 'Win Rate', value: `${battleWinRate}%` },
                  { label: 'Record', value: `${battleWins}W-${battleLosses}L-${battleDraws}D` },
                ].map((item) => (
                  <div key={item.label} className="glass p-3">
                    <p className="font-display text-[10px] text-nq-text-muted mb-1">{item.label}</p>
                    <p className="font-display text-sm font-bold text-foreground">{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <p className="font-display text-xs font-bold text-nq-text-secondary mb-2">RECENT FORM</p>
                <div className="flex gap-1.5">
                  {battleForm.slice(0, 10).map((result, index) => (
                    <div
                      key={`${result}-${index}`}
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        result === 'W' ? 'bg-auth-success/20 text-auth-success' : result === 'L' ? 'bg-auth-error/20 text-auth-error' : 'bg-auth-warning/20 text-auth-warning'
                      }`}
                    >
                      {result === 'W' ? '✓' : result === 'L' ? '✗' : '='}
                    </div>
                  ))}
                </div>
              </div>
            </GlassCard>

            {/* Badges preview */}
            <GlassCard hover={false}>
              <h3 className="font-display text-xs font-bold text-nq-text-secondary mb-3">BADGES</h3>
              <div className="grid grid-cols-5 md:grid-cols-10 gap-3">
                {user.badges.slice(0, 20).map(b => (
                  <div key={b.id} className={`text-center ${!b.earned ? 'opacity-30 grayscale' : ''}`} title={b.name}>
                    <span className="text-3xl md:text-4xl">{b.icon}</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>

          {/* Charts */}
          <div className="grid gap-4">
            <GlassCard hover={false}>
              <h3 className="font-display text-xs font-bold text-nq-text-secondary mb-3">ACTIVITY TREND (30 DAYS)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartTrend}>
                  <defs>
                    <linearGradient id="xpGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00E5FF" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#00E5FF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={false} axisLine={false} />
                  <YAxis tick={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: 'rgba(17,24,39,0.9)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontFamily: 'Space Mono' }} />
                  <Area type="monotone" dataKey="actions" stroke="#00E5FF" fill="url(#xpGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </GlassCard>

            <GlassCard hover={false}>
              <h3 className="font-display text-xs font-bold text-nq-text-secondary mb-3">READ CATEGORIES BY DAY</h3>
              {categoryKeys.length === 0 ? (
                <p className="text-xs text-nq-text-muted">No category activity yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartCategoryDaily}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="day" tick={false} axisLine={false} />
                    <YAxis tick={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: 'rgba(17,24,39,0.9)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }} />
                    <Legend />
                    {categoryKeys.map((category, index) => (
                      <Bar
                        key={category}
                        dataKey={category}
                        stackId="categories"
                        fill={COLORS[index % COLORS.length]}
                        radius={index === categoryKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </GlassCard>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
