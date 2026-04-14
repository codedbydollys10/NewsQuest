import type { UserData } from '@/store/useAuthStore';
import { supabase } from '@/lib/supabase';

const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '/api';

const apiUrl = (path: string) => `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

const toProfilePayload = (user: UserData) => ({
  id: user.id,
  email: user.email,
  username: user.username,
  avatar_id: user.avatarId,
  avatar_customization: user.avatarCustomization,
  current_level: user.currentLevel,
  total_xp: user.totalXP,
  xp_to_next_level: user.xpToNextLevel,
  streak_count: user.streakCount,
  last_active_date: user.lastActiveDate ?? new Date().toISOString(),
  interests: user.interests,
  daily_goal: user.dailyGoal,
  mode: user.mode,
  badges: user.badges,
  articles_read: user.articlesRead,
  quizzes_total: user.quizzesTotal,
  quizzes_correct: user.quizzesCorrect,
  predictions_total: user.predictionsTotal,
  predictions_correct: user.predictionsCorrect,
  battle_rating: user.battleRating,
  battle_tier: user.battleTier,
  wins: user.wins,
  losses: user.losses,
  draws: user.draws,
  recent_form: user.recentForm,
});

export const syncProfileToDatabase = async (user: UserData) => {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) return;

  const response = await fetch(apiUrl('/users/sync'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      accessToken,
      profile: toProfilePayload(user),
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: 'Failed to sync profile.' })) as { error?: string };
    throw new Error(payload.error || 'Failed to sync profile.');
  }
};
