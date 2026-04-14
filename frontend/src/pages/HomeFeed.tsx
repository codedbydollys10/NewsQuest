import { useGameStore } from '@/store/gameStore';
import { HUDBar } from '@/components/game/HUDBar';
import { NewsCard } from '@/components/game/NewsCard';
import { XPProgressBar } from '@/components/game/XPProgressBar';
import { StreakBadge } from '@/components/game/StreakBadge';
import { LevelBadge } from '@/components/game/LevelBadge';
import { GlassCard } from '@/components/game/GlassCard';
import { AvatarVisual } from '@/components/game/AvatarVisual';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Swords } from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchLeaderboard, type LeaderboardEntry } from '@/lib/leaderboardApi';
import { useAuthStore } from '@/store/useAuthStore';

const categories = ['All', 'Technology', 'Environment', 'Economy', 'Politics', 'Sports'];

const HomeFeed = () => {
  const articles = useGameStore(s => s.feed?.articles ?? []);
  const feedLoading = useGameStore(s => s.feed.loading);
  const user = useGameStore(s => s.user);
  const authUser = useAuthStore((s) => s.user);
  const feedLoaded = useGameStore(s => s.feed.loaded);
  const loadLiveFeed = useGameStore(s => s.loadLiveFeed);
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const battleRating = authUser?.battleRating ?? 1000;
  const battleTier = authUser?.battleTier ?? 'ROOKIE';
  const battleRecord = `${authUser?.wins ?? 0}W-${authUser?.losses ?? 0}L-${authUser?.draws ?? 0}D`;
  const [category, setCategory] = useState('All');

  const filtered = articles.filter(a => {
    if (category !== 'All' && a.category !== category) return false;
    return true;
  });
  const featuredPredictionArticle = filtered[0] ?? articles[0];
  useEffect(() => {
    if (!feedLoaded) {
      void loadLiveFeed();
    }
  }, [feedLoaded, loadLiveFeed]);

  useEffect(() => {
    let cancelled = false;
    const loadLeaders = async () => {
      try {
        const data = await fetchLeaderboard();
        if (!cancelled) setLeaders(data.leaderboard ?? []);
      } catch {
        if (!cancelled) setLeaders([]);
      }
    };
    void loadLeaders();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-nq-void grain-overlay">
      <HUDBar />
      <div className="pt-[76px] md:pt-[76px] pb-20 md:pb-8">
        <div className="max-w-[1760px] mx-auto px-3 md:px-4 flex gap-3 xl:gap-4">
          {/* Left Sidebar - Desktop */}
          <aside className="hidden lg:block w-[280px] shrink-0 sticky top-[76px] h-[calc(100vh-76px)] overflow-y-auto space-y-3 pb-8">
            <GlassCard hover={false}>
              <div className="text-center mb-4">
                <div className="w-16 h-16 rounded-xl glass mx-auto mb-2 flex items-center justify-center overflow-hidden">
                  <AvatarVisual avatarId={user.avatarId} className="text-3xl" imageClassName="w-16 h-16" />
                </div>
                <h3 className="font-display text-sm font-bold">{user.username}</h3>
              </div>
              <XPProgressBar />
              <div className="flex items-center justify-center gap-3 mt-3">
                <StreakBadge size="sm" />
                <LevelBadge />
              </div>
            </GlassCard>

            <GlassCard hover={false} className="p-3">
              <h4 className="font-display text-xs font-bold text-nq-text-secondary mb-3">DAILY LEADERS</h4>
              {[...leaders]
                .sort((a, b) => b.streak - a.streak)
                .slice(0, 5)
                .map((u) => (
                  <div key={u.id} className="flex items-center gap-2 py-1">
                    <span className="text-sm">{['🏃', '🧠', '🔮', '⚡', '👻'][u.avatarId % 5]}</span>
                    <span className="text-xs text-foreground flex-1 truncate">{u.username}</span>
                    <span className="font-display text-xs font-bold text-nq-orange">{u.streak}🔥</span>
                  </div>
                ))}
            </GlassCard>
          </aside>

          {/* Center Feed */}
          <main className="flex-1 min-w-0 space-y-3">
            {/* Category chips */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {categories.map(c => (
                <motion.button
                  key={c}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => setCategory(c)}
                  className={`px-3 py-1.5 rounded-full text-xs font-display font-bold whitespace-nowrap transition-all ${category === c ? 'bg-nq-cyan/20 text-nq-cyan border border-nq-cyan/30' : 'glass text-nq-text-secondary hover:text-foreground'}`}
                >
                  {c}
                </motion.button>
              ))}
            </div>

            {/* Articles */}
            {feedLoading && filtered.length === 0 && (
              <GlassCard hover={false}>
                <p className="text-sm text-nq-text-secondary">Loading live news...</p>
              </GlassCard>
            )}
            <div className="space-y-4">
              {filtered.map((article, i) => (
                <NewsCard key={article.id} article={article} index={i} />
              ))}
            </div>
          </main>

          {/* Right Sidebar - Desktop */}
          <aside className="hidden xl:block w-[260px] shrink-0 sticky top-[76px] h-[calc(100vh-76px)] overflow-y-auto space-y-3 pb-8">
            <GlassCard hover={false} className="relative overflow-hidden border border-orange-500/25 rounded-2xl shadow-[0_0_45px_rgba(255,122,24,0.12)] p-3 bg-[radial-gradient(circle_at_top,rgba(255,122,24,0.18),transparent_40%),linear-gradient(180deg,rgba(255,122,24,0.10),rgba(0,0,0,0.10))]">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-orange-400 via-[#ff8a3d] to-[#ff3d81]" />
              <div className="flex items-center gap-2 text-orange-400 mb-2 pt-1">
                <span className="text-lg leading-none">↗</span>
                <h4 className="font-display text-xs font-bold tracking-[0.22em] uppercase">Oracle Challenge</h4>
              </div>
              <div className="glass p-3 rounded-xl border border-orange-400/25 bg-orange-500/10 mb-3">
                <p className="text-[10px] font-space-mono text-nq-text-muted mb-1">FEATURED STORY</p>
                <p className="text-xs text-foreground line-clamp-2">
                  {featuredPredictionArticle?.headline ?? 'Prediction story loading...'}
                </p>
              </div>

              <Link
                to={featuredPredictionArticle ? `/predict/${featuredPredictionArticle.id}` : '/home'}
                className="w-full h-11 rounded-xl flex items-center justify-center text-xs font-display font-bold tracking-[0.22em] text-orange-300 border border-orange-400/30 bg-gradient-to-r from-orange-500/10 via-orange-400/15 to-[#ff3d81]/10 hover:from-orange-500/20 hover:to-[#ff3d81]/20 transition-all shadow-[0_0_20px_rgba(255,122,24,0.12)]"
              >
                MAKE YOUR CALL →
              </Link>
            </GlassCard>

            <GlassCard hover={false} className="relative border-nq-cyan/20 rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(0,229,255,0.08)] p-3">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-battle-blue via-battle-gold to-battle-red" />
              <div className="flex items-start justify-between gap-3 mb-3 pt-1">
                <div>
                  <h4 className="font-display text-xs font-bold text-nq-text-secondary mb-1">BATTLE ARENA</h4>
                  <p className="text-sm text-foreground">Challenge rivals in quiz and prediction battles.</p>
                </div>
                <Swords className="w-5 h-5 text-battle-blue shrink-0" />
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="glass p-2 rounded-xl border border-battle-blue/20 bg-battle-blue/10">
                  <p className="text-[10px] font-space-mono text-nq-text-muted">BR</p>
                  <p className="font-orbitron text-sm text-battle-blue">{battleRating.toLocaleString()}</p>
                </div>
                <div className="glass p-2 rounded-xl border border-secondary/20 bg-secondary/10">
                  <p className="text-[10px] font-space-mono text-nq-text-muted">Tier</p>
                  <p className="font-orbitron text-sm text-secondary">{battleTier}</p>
                </div>
                <div className="glass p-2 rounded-xl col-span-2 border border-battle-gold/20 bg-battle-gold/10">
                  <p className="text-[10px] font-space-mono text-nq-text-muted">Record</p>
                  <p className="font-orbitron text-sm text-foreground">{battleRecord}</p>
                </div>
              </div>
              <Link to="/battle" className="w-full h-12 rounded-xl text-sm flex items-center justify-center gap-3 font-orbitron tracking-wider text-white border border-white/15 bg-gradient-to-r from-[#58b9ff] via-[#8b5cf6] to-[#ff6ea8] shadow-[0_0_28px_rgba(0,229,255,0.18)] disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                BATTLE ARENA
              </Link>
            </GlassCard>

            {filtered.length === 0 && (
              <GlassCard hover={false} className="p-3">
                <h4 className="font-display text-xs font-bold text-nq-text-secondary mb-2">NO ARTICLES FOUND</h4>
                <p className="text-sm text-nq-text-secondary">Try a different category or wait for the live feed to load.</p>
              </GlassCard>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
};

export default HomeFeed;
