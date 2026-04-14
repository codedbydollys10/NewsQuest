import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, ArrowLeft, Sparkles } from 'lucide-react';
import { GlassCard } from '@/components/game/GlassCard';
import { HUDBar } from '@/components/game/HUDBar';
import { AvatarVisual } from '@/components/game/AvatarVisual';
import { AVATAR_OPTIONS, getLastActiveAvatarId, isAvatarUnlocked } from '@/data/avatars';
import { supabase } from '@/lib/supabase';
import { buildUserDataFromSupabaseUser } from '@/lib/supabaseUser';
import { syncProfileToDatabase } from '@/lib/profileApi';
import { useAuthStore } from '@/store/useAuthStore';
import { useGameStore } from '@/store/gameStore';

const AvatarEditor = () => {
  const navigate = useNavigate();
  const authUser = useAuthStore((s) => s.user);
  const login = useAuthStore((s) => s.login);
  const updateAuthUser = useAuthStore((s) => s.updateUser);
  const gameUser = useGameStore((s) => s.user);
  const currentLevel = authUser?.currentLevel ?? gameUser.currentLevel;
  const [selectedAvatar, setSelectedAvatar] = useState<number>(authUser?.avatarId ?? gameUser.avatarId ?? getLastActiveAvatarId() ?? 0);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSelectedAvatar(authUser?.avatarId ?? gameUser.avatarId ?? getLastActiveAvatarId() ?? 0);
  }, [authUser?.avatarId, gameUser.avatarId]);

  const selected = AVATAR_OPTIONS.find((avatar) => avatar.id === selectedAvatar) ?? AVATAR_OPTIONS[0];
  const earnedBadgeIds = authUser?.badges ?? gameUser.badges.filter((badge) => badge.earned).map((badge) => badge.id);
  const selectedUnlocked = isAvatarUnlocked(selected, currentLevel, earnedBadgeIds);

  const handleSave = async () => {
    if (!selectedUnlocked) {
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const currentUser = sessionData.session?.user;

    if (!currentUser) {
      navigate('/login', { replace: true });
      return;
    }

    const currentMetadata = (currentUser.user_metadata ?? {}) as Record<string, unknown>;
    const nextMetadata = {
      ...currentMetadata,
      avatar_id: selectedAvatar,
      avatarId: selectedAvatar,
    };

    const { data, error } = await supabase.auth.updateUser({ data: nextMetadata });

    if (error || !data.user) {
      return;
    }

    const updatedUser = buildUserDataFromSupabaseUser(data.user);
    await syncProfileToDatabase(updatedUser).catch(() => { });
    login(updatedUser);
    updateAuthUser({ avatarId: selectedAvatar });
    useGameStore.setState((state) => ({
      user: {
        ...state.user,
        id: updatedUser.id,
        username: updatedUser.username,
        currentLevel: updatedUser.currentLevel,
        totalXP: updatedUser.totalXP,
        xpToNextLevel: updatedUser.xpToNextLevel,
        streakCount: updatedUser.streakCount,
        lastActiveDate: updatedUser.lastActiveDate ?? state.user.lastActiveDate,
        articlesRead: updatedUser.articlesRead,
        quizzesTotal: updatedUser.quizzesTotal,
        quizzesCorrect: updatedUser.quizzesCorrect,
        predictionsTotal: updatedUser.predictionsTotal,
        predictionsCorrect: updatedUser.predictionsCorrect,
        avatarId: selectedAvatar,
        dailyTarget: updatedUser.dailyGoal,
      },
    }));
    setSaved(true);
    window.setTimeout(() => navigate('/profile'), 300);
  };

  return (
    <div className="min-h-screen bg-nq-void grain-overlay">
      <HUDBar />
      <div className="pt-[76px] pb-20 md:pb-8 max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">AVATAR EDITOR</h1>
            <p className="text-sm text-nq-text-secondary">Choose the avatar that appears in your profile and battle lobby.</p>
          </div>
          <Link to="/profile" className="glass px-4 py-2 rounded-lg border border-nq-cyan/20 text-sm font-display text-nq-text-secondary hover:text-foreground transition-colors inline-flex items-center gap-2">
            <ArrowLeft size={14} />
            Back
          </Link>
        </div>

        <div className="grid lg:grid-cols-[1.1fr_1.4fr] gap-6 items-start">
          {/* Preview */}
          <GlassCard hover={false} className="p-6 sticky top-[96px]">
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-xs font-space-mono uppercase tracking-[0.25em] text-nq-text-muted">
                <Sparkles size={14} className="text-nq-cyan" />
                Live Preview
              </div>
              <div className="rounded-3xl border border-nq-cyan/20 bg-[radial-gradient(circle_at_top,rgba(0,229,255,0.08),transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent)] p-8 flex items-center justify-center">
                <div className="w-56 h-56 rounded-full glass border-2 border-nq-cyan/30 overflow-hidden flex items-center justify-center bg-white/5">
                  <AvatarVisual avatarId={selectedAvatar} className="text-8xl" imageClassName="w-56 h-56" />
                </div>
              </div>
              <div className="text-center space-y-1">
                <p className="font-orbitron text-lg text-foreground">{selected.name}</p>
                <p className="text-sm text-nq-text-secondary">{selected.badge}</p>
              </div>
              <p className="text-center text-xs text-nq-text-muted">
                Changes save to your account and will appear on the feed, battles, and profile.
              </p>
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleSave}
                disabled={!selectedUnlocked}
                className={`w-full h-[52px] text-sm flex items-center justify-center gap-2 ${selectedUnlocked
                  ? 'btn-gradient'
                  : 'rounded-xl border border-white/10 bg-white/5 text-nq-text-muted cursor-not-allowed'
                  }`}
              >
                {saved ? <Check className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                {selectedUnlocked ? 'SAVE AVATAR' : `LOCKED • ${selected.badge.toUpperCase()}`}
              </motion.button>
            </div>
          </GlassCard>

          {/* Options */}
          <GlassCard hover={false} className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-display text-sm font-bold text-nq-text-secondary">SELECT AN AVATAR</h2>
                <p className="text-xs text-nq-text-muted">Images you pick here will also show in battle lobby.</p>
              </div>
              <div className="text-xs font-space-mono text-nq-text-muted">
                {AVATAR_OPTIONS.length} choices
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {AVATAR_OPTIONS.map((avatar) => {
                const active = selectedAvatar === avatar.id;
                const unlocked = isAvatarUnlocked(avatar, currentLevel, earnedBadgeIds);
                return (
                  <motion.button
                    key={avatar.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedAvatar(avatar.id)}
                    className={`group text-left rounded-2xl border transition-all p-3 ${active
                      ? 'border-nq-cyan bg-nq-cyan/10 shadow-[0_0_20px_rgba(0,229,255,0.16)]'
                      : unlocked
                        ? 'border-white/10 bg-white/5 hover:border-white/20'
                        : 'border-white/5 bg-white/5 opacity-60 grayscale'
                      }`}
                  >
                    <div className="relative aspect-square rounded-2xl bg-black/20 border border-white/10 overflow-hidden flex items-center justify-center mb-3">
                      <AvatarVisual avatarId={avatar.id} className="text-5xl" imageClassName="w-full h-full" />
                      {!unlocked && (
                        <div className="absolute inset-0 bg-black/45 flex flex-col items-center justify-center gap-1">
                          <span className="text-2xl text-white/90">🔒</span>
                          <span className="text-[9px] font-space-mono text-white/80">{avatar.badge}</span>
                        </div>
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-orbitron text-xs text-foreground truncate">{avatar.name}</p>
                        {active && <Check size={12} className="text-nq-cyan shrink-0" />}
                      </div>
                      <p className="text-[10px] font-space-mono uppercase tracking-wide text-nq-text-muted">{avatar.badge}</p>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};

export default AvatarEditor;
