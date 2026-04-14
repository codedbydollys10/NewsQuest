import { useGameStore } from '@/store/gameStore';
import { HUDBar } from '@/components/game/HUDBar';
import { GlassCard } from '@/components/game/GlassCard';
import { XPProgressBar } from '@/components/game/XPProgressBar';
import { BadgeCard } from '@/components/game/BadgeCard';
import { ActivityHeatmap } from '@/components/game/ActivityHeatmap';
import { StreakBadge } from '@/components/game/StreakBadge';
import { AvatarVisual } from '@/components/game/AvatarVisual';
import { getAvatarLabel } from '@/data/avatars';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRightLeft, LogOut } from 'lucide-react';

const Profile = () => {
  const user = useGameStore(s => s.user);
  const authUser = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const quizAcc = user.quizzesTotal > 0 ? Math.round((user.quizzesCorrect / user.quizzesTotal) * 100) : 0;
  const predAcc = user.predictionsTotal > 0 ? Math.round((user.predictionsCorrect / user.predictionsTotal) * 100) : 0;
  const earnedBadges = user.badges.filter((badge) => badge.earned).length;
  const badgeProgress = `${earnedBadges}/${user.badges.length}`;
  const focusLabel = user.focusMode === 'news' ? 'News focus' : user.focusMode === 'upsc' ? 'UPSC focus' : 'Balanced mode';

  return (
    <div className="min-h-screen bg-nq-void grain-overlay">
      <HUDBar />
      <div className="pt-[76px] pb-20 md:pb-8 max-w-6xl mx-auto px-4">
        <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(0,229,255,0.12),transparent_34%),radial-gradient(circle_at_top_right,rgba(124,58,237,0.14),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-4 md:p-6 mb-6 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(135deg,rgba(255,255,255,0.05)_0%,transparent_30%,transparent_70%,rgba(0,229,255,0.06)_100%)]" />
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={async () => {
              const { error } = await supabase.auth.signOut();
              if (error) {
                console.error('Sign out failed:', error.message);
              }
              logout();
              navigate('/login', { replace: true });
            }}
            className="absolute right-4 top-4 z-10 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-2 text-[10px] font-space-mono uppercase tracking-[0.22em] text-nq-text-secondary transition-colors hover:border-auth-error/40 hover:text-auth-error"
          >
            <LogOut size={13} />
            Logout
          </motion.button>
          <div className="relative grid lg:grid-cols-[1.15fr_0.85fr] gap-4">
            <GlassCard hover={false} glow="cyan" className="relative overflow-hidden border border-nq-cyan/20 bg-black/15 p-6 md:p-8">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(0,229,255,0.12),transparent_35%)] pointer-events-none" />
              <div className="relative flex flex-col md:flex-row items-center gap-6">
                <div className="relative shrink-0">
                  <div className="absolute inset-[-16px] rounded-[2rem] bg-nq-cyan/10 blur-2xl" />
                  <div className="relative w-36 h-36 md:w-40 md:h-40 rounded-[2rem] glass border border-nq-cyan/30 flex items-center justify-center overflow-hidden bg-black/20 shadow-[0_0_30px_rgba(0,229,255,0.12)]">
                    <AvatarVisual
                      avatarId={user.avatarId}
                      className="text-7xl"
                      imageClassName="w-40 h-40"
                    />
                  </div>
                </div>

                <div className="flex-1 text-center md:text-left space-y-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full border border-nq-cyan/30 bg-nq-cyan/10 px-3 py-1 text-[9px] font-space-mono uppercase tracking-[0.25em] text-nq-cyan">
                        Profile
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[9px] font-space-mono uppercase tracking-[0.25em] text-nq-text-muted">
                        {focusLabel}
                      </span>
                    </div>
                    <h1 className="font-display text-xl md:text-2xl font-bold text-foreground">{user.username}</h1>
                    <p className="text-xs md:text-sm text-nq-text-secondary">
                      Level {user.currentLevel} • {getAvatarLabel(user.avatarId)} • {badgeProgress} badges earned
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                    <StreakBadge size="lg" />
                    <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
                      <p className="text-[9px] uppercase tracking-[0.25em] text-nq-text-muted">Daily Target</p>
                      <p className="font-display text-sm text-foreground">{user.dailyTarget} actions</p>
                    </div>
                    <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
                      <p className="text-[9px] uppercase tracking-[0.25em] text-nq-text-muted">Focus Mode</p>
                      <p className="font-display text-sm text-foreground">{user.focusMode.toUpperCase()}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <XPProgressBar />
                    <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
                      <Link
                        to="/avatar-editor"
                        className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-nq-cyan/30 bg-nq-cyan/10 text-xs font-display text-nq-cyan hover:glow-cyan transition-all"
                      >
                        <ArrowRightLeft size={14} />
                        Change Avatar
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </GlassCard>

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Total XP', value: user.totalXP.toLocaleString(), accent: 'text-nq-cyan' },
                { label: 'Articles Read', value: user.articlesRead, accent: 'text-nq-orange' },
                { label: 'Quiz Accuracy', value: `${quizAcc}%`, accent: 'text-nq-green' },
                { label: 'Pred. Accuracy', value: `${predAcc}%`, accent: 'text-nq-purple' },
              ].map((card) => (
                <GlassCard key={card.label} hover={false} className="p-4 md:p-5 border border-white/10 bg-white/5">
                  <p className="text-[9px] uppercase tracking-[0.25em] text-nq-text-muted">{card.label}</p>
                  <p className={`mt-2 font-orbitron text-xl md:text-2xl font-bold ${card.accent}`}>{card.value}</p>
                </GlassCard>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 mb-6">
          <GlassCard hover={false} glow="cyan" className="p-5 md:p-6">
            <div className="flex items-center justify-between gap-4 mb-2">
              <div>
                <h3 className="font-display text-xs font-bold text-nq-text-secondary">ACTIVITY</h3>
                <p className="text-[11px] text-nq-text-muted">Your rhythm over the past year.</p>
              </div>
              <div className="rounded-full border border-nq-orange/20 bg-nq-orange/10 px-3 py-1 text-[10px] font-space-mono uppercase tracking-[0.25em] text-nq-orange">
                {user.streakCount} day streak
              </div>
            </div>
            <div className="w-full">
              <ActivityHeatmap userId={authUser?.id ?? user.id} cellSize={14} />
            </div>
          </GlassCard>
        </div>

        <GlassCard hover={false} className="mb-6 p-5 md:p-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
            <div>
              <h3 className="font-display text-xs font-bold text-nq-text-secondary">BADGE COLLECTION</h3>
              <p className="text-[11px] text-nq-text-muted">Earned badges stay bright, locked ones stay hidden until you unlock them.</p>
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-space-mono uppercase tracking-[0.25em] text-nq-text-muted">
              {badgeProgress}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
            {user.badges.map((badge, index) => (
              <motion.div
                key={badge.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
              >
                <BadgeCard badge={badge} />
              </motion.div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
};

export default Profile;
