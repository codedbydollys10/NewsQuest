import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { UserData } from '@/store/useAuthStore';

const readMetaString = (metadata: Record<string, unknown> | undefined, keys: string[], fallback: string) => {
  for (const key of keys) {
    const value = metadata?.[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return fallback;
};

const readMetaNumber = (metadata: Record<string, unknown> | undefined, keys: string[], fallback: number) => {
  for (const key of keys) {
    const value = metadata?.[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return fallback;
};

const readMetaStringArray = (metadata: Record<string, unknown> | undefined, keys: string[], fallback: string[]) => {
  for (const key of keys) {
    const value = metadata?.[key];
    if (Array.isArray(value) && value.every((entry) => typeof entry === 'string')) {
      return value as string[];
    }
  }
  return fallback;
};

const readMetaObject = (metadata: Record<string, unknown> | undefined, keys: string[], fallback: { skinTone: number; trailColor: string }) => {
  for (const key of keys) {
    const value = metadata?.[key];
    if (value && typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      const skinTone = typeof obj.skinTone === 'number' ? obj.skinTone : fallback.skinTone;
      const trailColor = typeof obj.trailColor === 'string' ? obj.trailColor : fallback.trailColor;
      return { skinTone, trailColor };
    }
  }
  return fallback;
};

export const buildUserDataFromSupabaseUser = (authUser: SupabaseUser): UserData => {
  const metadata = authUser.user_metadata as Record<string, unknown> | undefined;
  const avatarId = readMetaNumber(metadata, ['avatar_id', 'avatarId'], 0);
  const baseLevel = readMetaNumber(metadata, ['current_level', 'currentLevel'], 1);
  const totalXP = readMetaNumber(metadata, ['total_xp', 'totalXP'], 25);
  const xpToNextLevel = readMetaNumber(metadata, ['xp_to_next_level', 'xpToNextLevel'], 100);
  const streakCount = readMetaNumber(metadata, ['streak_count', 'streakCount'], 0);
  const dailyGoal = readMetaNumber(metadata, ['daily_goal', 'dailyGoal'], 5);
  const articlesRead = readMetaNumber(metadata, ['articles_read', 'articlesRead'], 0);
  const quizzesTotal = readMetaNumber(metadata, ['quizzes_total', 'quizzesTotal'], 0);
  const quizzesCorrect = readMetaNumber(metadata, ['quizzes_correct', 'quizzesCorrect'], 0);
  const predictionsTotal = readMetaNumber(metadata, ['predictions_total', 'predictionsTotal'], 0);
  const predictionsCorrect = readMetaNumber(metadata, ['predictions_correct', 'predictionsCorrect'], 0);
  const battleRating = readMetaNumber(metadata, ['battle_rating', 'battleRating'], 1000);
  const wins = readMetaNumber(metadata, ['wins'], 0);
  const losses = readMetaNumber(metadata, ['losses'], 0);
  const draws = readMetaNumber(metadata, ['draws'], 0);

  return {
    id: authUser.id,
    username: readMetaString(metadata, ['username', 'full_name', 'name', 'user_name'], authUser.email?.split('@')[0] ?? 'player'),
    email: authUser.email ?? '',
    joinDate: authUser.created_at ?? new Date().toISOString(),
    avatarId,
    avatarCustomization: readMetaObject(metadata, ['avatar_customization', 'avatarCustomization'], { skinTone: 0, trailColor: 'cyan' }),
    currentLevel: baseLevel,
    totalXP,
    xpToNextLevel,
    streakCount,
    lastActiveDate: readMetaString(metadata, ['last_active_date', 'lastActiveDate'], new Date().toISOString()),
    interests: readMetaStringArray(metadata, ['interests'], []),
    dailyGoal,
    mode: readMetaString(metadata, ['mode'], 'both'),
    badges: readMetaStringArray(metadata, ['badges'], authUser.app_metadata?.provider === 'google' ? ['Google Sign-In'] : ['Account Created']),
    articlesRead,
    quizzesTotal,
    quizzesCorrect,
    predictionsTotal,
    predictionsCorrect,
    battleRating,
    battleTier: readMetaString(metadata, ['battle_tier', 'battleTier'], 'ROOKIE'),
    wins,
    losses,
    draws,
    recentForm: readMetaStringArray(metadata, ['recent_form', 'recentForm'], []),
  };
};

export const buildSignupMetadata = (input: {
  username: string;
  avatarId: number;
}) => ({
  username: input.username,
  avatar_id: input.avatarId,
  avatar_customization: { skinTone: 0, trailColor: 'cyan' },
  current_level: 1,
  total_xp: 25,
  xp_to_next_level: 100,
  streak_count: 0,
  last_active_date: new Date().toISOString(),
  interests: [],
  daily_goal: 5,
  mode: 'both',
  badges: ['Account Created'],
  articles_read: 0,
  quizzes_total: 0,
  quizzes_correct: 0,
  predictions_total: 0,
  predictions_correct: 0,
  battle_rating: 1000,
  battle_tier: 'ROOKIE',
  wins: 0,
  losses: 0,
  draws: 0,
  recent_form: [],
});
