import { supabase } from '@/lib/supabase';
import { trackActivity } from '@/lib/activityApi';
import { syncProfileToDatabase } from '@/lib/profileApi';
import { useAuthStore } from '@/store/useAuthStore';
import { useGameStore, calculateBadgesStatus, getUnlockedBadgeIds } from '@/store/gameStore';
import type { UserData } from '@/store/useAuthStore';

type BattleResult = 'win' | 'loss' | 'draw';

const LEVEL_XP = [0, 100, 250, 500, 800, 1200, 1700, 2300, 3000, 3800, 4700, 5800, 7000, 8500, 10000, 12000, 14500, 17500, 21000, 25000, 30000];

const getLevelForXP = (xp: number) => {
  let level = 1;
  for (let i = 1; i < LEVEL_XP.length; i++) {
    if (xp >= LEVEL_XP[i]) level = i + 1;
    else break;
  }
  const nextLevelXP = LEVEL_XP[level] || LEVEL_XP[level - 1] + 5000;
  const currentLevelXP = LEVEL_XP[level - 1] || 0;
  return { level, xpToNextLevel: nextLevelXP - currentLevelXP };
};

const getBattleTier = (battleRating: number) => {
  if (battleRating < 1000) return 'ROOKIE';
  if (battleRating < 1300) return 'ANALYST';
  if (battleRating < 1600) return 'STRATEGIST';
  if (battleRating < 1900) return 'ORACLE';
  if (battleRating < 2200) return 'MASTER';
  return 'LEGEND';
};

const getUtcDay = (date: string | Date | null | undefined = undefined) => {
  const dt = date ? new Date(date) : new Date();
  return dt.toISOString().slice(0, 10);
};

const getUtcYesterday = () => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

export const calculateNextStreak = (lastActiveDate: string | null | undefined, currentStreak: number) => {
  const today = getUtcDay();
  const lastDay = lastActiveDate ? getUtcDay(lastActiveDate) : null;

  if (!lastDay) return 1;
  if (lastDay === today) return Math.max(1, currentStreak);
  if (lastDay === getUtcYesterday()) return Math.max(1, currentStreak) + 1;
  return 1;
};

const applyLocalProgress = (patch: {
  xpDelta?: number;
  articlesReadDelta?: number;
  quizzesTotalDelta?: number;
  quizzesCorrectDelta?: number;
  predictionsTotalDelta?: number;
  predictionsCorrectDelta?: number;
  battleRatingDelta?: number;
  winsDelta?: number;
  lossesDelta?: number;
  drawsDelta?: number;
  battleForm?: string[];
}) => {
  const state = useGameStore.getState();
  const user = useAuthStore.getState().user;
  if (!user) return null;

  const nextXP = state.user.totalXP + (patch.xpDelta ?? 0);
  const { level, xpToNextLevel } = getLevelForXP(nextXP);
  const nextBattleRating = Math.max(0, user.battleRating + (patch.battleRatingDelta ?? 0));
  const nextBattleTier = getBattleTier(nextBattleRating);
  const persistedUnlockedBadgeIds = Array.from(new Set([
    ...user.badges,
    ...getUnlockedBadgeIds(state.user.badges),
  ]));
  const nextBadges = calculateBadgesStatus(nextXP, persistedUnlockedBadgeIds);
  const nextUnlockedBadgeIds = getUnlockedBadgeIds(nextBadges);

  const nextLastActiveDate = new Date().toISOString();
  const nextStreakCount = calculateNextStreak(user.lastActiveDate, user.streakCount);

  const nextAuthUser: UserData = {
    ...user,
    currentLevel: level,
    totalXP: nextXP,
    xpToNextLevel,
    streakCount: nextStreakCount,
    lastActiveDate: nextLastActiveDate,
    battleRating: nextBattleRating,
    battleTier: nextBattleTier,
    wins: user.wins + (patch.winsDelta ?? 0),
    losses: user.losses + (patch.lossesDelta ?? 0),
    draws: user.draws + (patch.drawsDelta ?? 0),
    recentForm: patch.battleForm ? [...patch.battleForm, ...user.recentForm].slice(0, 10) : user.recentForm,
    articlesRead: state.user.articlesRead + (patch.articlesReadDelta ?? 0),
    quizzesTotal: state.user.quizzesTotal + (patch.quizzesTotalDelta ?? 0),
    quizzesCorrect: state.user.quizzesCorrect + (patch.quizzesCorrectDelta ?? 0),
    predictionsTotal: state.user.predictionsTotal + (patch.predictionsTotalDelta ?? 0),
    predictionsCorrect: state.user.predictionsCorrect + (patch.predictionsCorrectDelta ?? 0),
    badges: nextUnlockedBadgeIds,
  };

  const floatId = patch.xpDelta && patch.xpDelta > 0
    ? `xp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    : null;

  useGameStore.setState((prev) => ({
    user: {
      ...prev.user,
      currentLevel: level,
      totalXP: nextXP,
      xpToNextLevel,
      articlesRead: prev.user.articlesRead + (patch.articlesReadDelta ?? 0),
      quizzesTotal: prev.user.quizzesTotal + (patch.quizzesTotalDelta ?? 0),
      quizzesCorrect: prev.user.quizzesCorrect + (patch.quizzesCorrectDelta ?? 0),
      predictionsTotal: prev.user.predictionsTotal + (patch.predictionsTotalDelta ?? 0),
      predictionsCorrect: prev.user.predictionsCorrect + (patch.predictionsCorrectDelta ?? 0),
      badges: nextBadges,
    },
    ui: floatId
      ? {
          ...prev.ui,
          showLevelUpModal: level > prev.user.currentLevel,
          xpFloats: [...prev.ui.xpFloats, { id: floatId, amount: patch.xpDelta ?? 0, color: 'cyan', x: window.innerWidth / 2, y: window.innerHeight / 2 }],
        }
      : prev.ui,
  }));

  useAuthStore.getState().updateUser({
    ...user,
    currentLevel: level,
    totalXP: nextXP,
    xpToNextLevel,
    streakCount: nextStreakCount,
    lastActiveDate: nextLastActiveDate,
    battleRating: nextBattleRating,
    battleTier: nextBattleTier,
    wins: user.wins + (patch.winsDelta ?? 0),
    losses: user.losses + (patch.lossesDelta ?? 0),
    draws: user.draws + (patch.drawsDelta ?? 0),
    recentForm: patch.battleForm ? [...patch.battleForm, ...user.recentForm].slice(0, 10) : user.recentForm,
    articlesRead: state.user.articlesRead + (patch.articlesReadDelta ?? 0),
    quizzesTotal: state.user.quizzesTotal + (patch.quizzesTotalDelta ?? 0),
    quizzesCorrect: state.user.quizzesCorrect + (patch.quizzesCorrectDelta ?? 0),
    predictionsTotal: state.user.predictionsTotal + (patch.predictionsTotalDelta ?? 0),
    predictionsCorrect: state.user.predictionsCorrect + (patch.predictionsCorrectDelta ?? 0),
    badges: nextUnlockedBadgeIds,
  });

  void (async () => {
    const { error } = await supabase.auth.updateUser({
      data: {
        username: user.username,
        avatar_id: user.avatarId,
        avatar_customization: user.avatarCustomization,
        current_level: level,
        total_xp: nextXP,
        xp_to_next_level: xpToNextLevel,
        streak_count: nextStreakCount,
        last_active_date: nextLastActiveDate,
        interests: user.interests,
        daily_goal: user.dailyGoal,
        mode: user.mode,
        badges: nextUnlockedBadgeIds,
        articles_read: state.user.articlesRead + (patch.articlesReadDelta ?? 0),
        quizzes_total: state.user.quizzesTotal + (patch.quizzesTotalDelta ?? 0),
        quizzes_correct: state.user.quizzesCorrect + (patch.quizzesCorrectDelta ?? 0),
        predictions_total: state.user.predictionsTotal + (patch.predictionsTotalDelta ?? 0),
        predictions_correct: state.user.predictionsCorrect + (patch.predictionsCorrectDelta ?? 0),
        battle_rating: nextBattleRating,
        battle_tier: nextBattleTier,
        wins: user.wins + (patch.winsDelta ?? 0),
        losses: user.losses + (patch.lossesDelta ?? 0),
        draws: user.draws + (patch.drawsDelta ?? 0),
        recent_form: patch.battleForm ? [...patch.battleForm, ...user.recentForm].slice(0, 10) : user.recentForm,
      },
    });

    if (error) {
      return;
    }
  })();

  void syncProfileToDatabase(nextAuthUser).catch(() => {});

  return nextAuthUser;
};

export const recordReadProgress = (
  xpDelta: number,
  articleMeta?: { title?: string; category?: string },
) => {
  const user = useAuthStore.getState().user;
  if (!user) return;
  const nextUser = applyLocalProgress({ xpDelta, articlesReadDelta: 1 });
  void trackActivity(user.id, 'read', undefined, {
    streakCount: nextUser?.streakCount,
    articleTitle: articleMeta?.title,
    articleCategory: articleMeta?.category,
  }).catch((error) => {
    console.error('Failed to record read activity', error);
  });
};

export const recordQuizProgress = (
  correct: boolean,
  xpDelta: number,
  articleMeta?: { title?: string; category?: string },
) => {
  const user = useAuthStore.getState().user;
  if (!user) return;
  const nextUser = applyLocalProgress({
    xpDelta,
    quizzesTotalDelta: 1,
    quizzesCorrectDelta: correct ? 1 : 0,
  });
  void trackActivity(user.id, 'quiz', undefined, {
    streakCount: nextUser?.streakCount,
    articleTitle: articleMeta?.title,
    articleCategory: articleMeta?.category,
  }).catch((error) => {
    console.error('Failed to record quiz activity', error);
  });
};

export const recordPredictionProgress = (
  correct: boolean,
  xpDelta: number,
  articleMeta?: { title?: string; category?: string },
) => {
  const user = useAuthStore.getState().user;
  if (!user) return;
  const nextUser = applyLocalProgress({
    xpDelta,
    predictionsTotalDelta: 1,
    predictionsCorrectDelta: correct ? 1 : 0,
  });
  void trackActivity(user.id, 'prediction', undefined, {
    streakCount: nextUser?.streakCount,
    articleTitle: articleMeta?.title,
    articleCategory: articleMeta?.category,
  }).catch((error) => {
    console.error('Failed to record prediction activity', error);
  });
};

export const recordPredictionOutcome = (correct: boolean, xpDelta: number) => {
  const user = useAuthStore.getState().user;
  if (!user) return;
  applyLocalProgress({
    xpDelta,
    predictionsCorrectDelta: correct ? 1 : 0,
  });
};

export const recordBattleProgress = (result: BattleResult, xpDelta: number, battleRatingDelta: number) => {
  const user = useAuthStore.getState().user;
  if (!user) return;
  const nextUser = applyLocalProgress({
    xpDelta,
    battleRatingDelta,
    winsDelta: result === 'win' ? 1 : 0,
    lossesDelta: result === 'loss' ? 1 : 0,
    drawsDelta: result === 'draw' ? 1 : 0,
    battleForm: [result === 'win' ? 'W' : result === 'loss' ? 'L' : 'D'],
  });
  void trackActivity(user.id, 'battle', undefined, { streakCount: nextUser?.streakCount }).catch((error) => {
    console.error('Failed to record battle activity', error);
  });
};
