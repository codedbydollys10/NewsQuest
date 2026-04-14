import { useGameStore } from '@/store/gameStore';
import { useAuthStore } from '@/store/useAuthStore';
import { HUDBar } from '@/components/game/HUDBar';
import { GlassCard } from '@/components/game/GlassCard';
import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { Trophy, Flame, Brain, Clock } from 'lucide-react';
import { fetchLeaderboard, type LeaderboardEntry } from '@/lib/leaderboardApi';

const tabs = [
  { id: 'all', label: 'ALL', icon: Trophy },
  { id: 'weekly', label: 'THIS WEEK', icon: Clock },
  { id: 'streak', label: 'STREAK KING', icon: Flame },
  { id: 'oracle', label: 'ORACLE MASTER', icon: Brain },
] as const;
type TabId = typeof tabs[number]['id'];

const podiumColors = ['border-yellow-400/40 glow-orange', 'border-gray-400/40', 'border-amber-700/40'];
const podiumEmoji = ['🥇', '🥈', '🥉'];
const avatarEmoji = ['🏃', '🧠', '🔮', '⚡', '👻'];

const Leaderboard = () => {
  const [tab, setTab] = useState<TabId>('all');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const user = useGameStore(s => s.user);
  const authUser = useAuthStore((s) => s.user);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchLeaderboard();
        if (!cancelled) setEntries(data.leaderboard ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load leaderboard.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const getTabScore = (entry: LeaderboardEntry) => {
    if (tab === 'weekly') return entry.weeklyScore;
    if (tab === 'streak') return entry.streak;
    if (tab === 'oracle') return entry.oracleScore;
    return entry.totalXP;
  };

  const tabUnit = tab === 'weekly'
    ? 'pts'
    : tab === 'streak'
      ? 'days'
      : tab === 'oracle'
        ? '%'
        : 'XP';

  const sorted = useMemo(() => {
    const list = [...entries];
    list.sort((a, b) => {
      if (tab === 'weekly') {
        if (b.weeklyScore !== a.weeklyScore) return b.weeklyScore - a.weeklyScore;
        return b.totalXP - a.totalXP;
      }
      if (tab === 'streak') {
        if (b.streak !== a.streak) return b.streak - a.streak;
        return b.totalXP - a.totalXP;
      }
      if (tab === 'oracle') {
        if (b.oracleScore !== a.oracleScore) return b.oracleScore - a.oracleScore;
        if (b.predictionsTotal !== a.predictionsTotal) return b.predictionsTotal - a.predictionsTotal;
        return b.totalXP - a.totalXP;
      }
      return b.totalXP - a.totalXP;
    });
    return list;
  }, [entries, tab]);

  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);
  const currentUserId = authUser?.id ?? user.id;
  const rawUserRank = sorted.findIndex(u => u.id === currentUserId);
  const userRank = rawUserRank >= 0 ? rawUserRank + 1 : 0;
  const currentUserEntry = userRank > 0 ? sorted[userRank - 1] : null;
  const nextUser = userRank > 1 ? sorted[userRank - 2] : null;
  const gapToNext = nextUser && currentUserEntry
    ? Math.max(0, getTabScore(nextUser) - getTabScore(currentUserEntry))
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-nq-void grain-overlay">
        <HUDBar />
        <div className="pt-[108px] pb-20 md:pb-8 max-w-3xl mx-auto px-4">
          <GlassCard hover={false} className="py-8 text-center text-nq-text-secondary">
            Loading leaderboard...
          </GlassCard>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-nq-void grain-overlay">
      <HUDBar />
      <div className="pt-[108px] pb-20 md:pb-8 max-w-3xl mx-auto px-4">
        {error && (
          <GlassCard hover={false} className="mb-4 py-3 text-center text-xs text-red-300">
            {error}
          </GlassCard>
        )}
        {/* Tabs */}
        <div className="flex gap-1 mb-8 overflow-x-auto no-scrollbar">
          {tabs.map(t => (
            <motion.button
              key={t.id}
              whileTap={{ scale: 0.94 }}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-display font-bold whitespace-nowrap transition-all ${tab === t.id ? 'bg-nq-cyan/20 text-nq-cyan' : 'text-nq-text-muted hover:text-nq-text-secondary'}`}
            >
              <t.icon size={14} />
              {t.label}
            </motion.button>
          ))}
        </div>

        {/* Podium */}
        <div className="flex items-end justify-center gap-3 mb-16 mt-16 pt-6 h-56">
          {[1, 0, 2].map(i => {
            const u = top3[i];
            if (!u) return null;
            const height = i === 0 ? 'h-44' : i === 1 ? 'h-36' : 'h-28';
            return (
              <motion.div
                key={u.id}
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: i * 0.15, type: 'spring' }}
                className="flex flex-col items-center translate-y-10"
              >
                <span className="text-3xl mb-2">{avatarEmoji[u.avatarId % avatarEmoji.length]}</span>
                <span className="font-display text-xs font-bold text-foreground mb-1">{u.username}</span>
                <span className="font-mono text-[10px] text-nq-cyan mb-3">
                  {tab === 'streak' ? `${u.streak}🔥` : tab === 'oracle' ? `${u.oracleScore}%` : tab === 'weekly' ? `${u.weeklyScore} pts` : u.totalXP.toLocaleString()}
                </span>
                <div className={`${height} w-20 rounded-t-lg glass border-2 ${podiumColors[i]} flex items-start justify-center pt-2`}>
                  <span className="text-xl">{podiumEmoji[i]}</span>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Table */}
        <div className="space-y-2">
          {rest.map((u, i) => (
            <motion.div key={u.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
              <GlassCard className="flex items-center gap-3 py-3 hover:border-nq-cyan/20">
                <span className="font-display text-xs font-bold text-nq-text-muted w-6 text-center">{i + 4}</span>
                <span className="text-lg">{avatarEmoji[u.avatarId % avatarEmoji.length]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{u.username}</p>
                  <p className="text-[10px] text-nq-text-muted">Level {u.level}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-xs text-nq-cyan">
                    {tab === 'weekly'
                      ? `${u.weeklyScore} pts`
                      : tab === 'streak'
                        ? `${u.streak} days`
                        : tab === 'oracle'
                          ? `${u.oracleScore}%`
                          : `${u.totalXP.toLocaleString()} XP`}
                  </p>
                  <p className="font-mono text-[10px] text-nq-text-muted">{u.oracleScore}% • {u.streak}🔥</p>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>

        {/* Your position */}
        <div className="fixed bottom-6 md:bottom-4 left-1/2 -translate-x-1/2 z-30">
          <GlassCard hover={false} className="px-6 py-3 border-nq-purple/30">
            <p className="font-display text-xs text-nq-text-secondary">
              {userRank > 0 ? (
                <>#{userRank} — You need <span className="text-nq-cyan font-bold">{gapToNext.toLocaleString()} {tabUnit}</span> to overtake <span className="text-nq-purple">@{nextUser?.username || 'nobody'}</span></>
              ) : (
                <>You are not ranked yet in this list.</>
              )}
            </p>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
