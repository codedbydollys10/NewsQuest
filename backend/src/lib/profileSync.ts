export type ProfileSyncPayload = {
  id: string;
  email?: string;
  username: string;
  avatar_id: number;
  avatar_customization: { skinTone: number; trailColor: string };
  current_level: number;
  total_xp: number;
  xp_to_next_level: number;
  streak_count: number;
  last_active_date: string;
  interests: string[];
  daily_goal: number;
  mode: string;
  badges: string[];
  articles_read: number;
  quizzes_total: number;
  quizzes_correct: number;
  predictions_total: number;
  predictions_correct: number;
  battle_rating: number;
  battle_tier: string;
  wins: number;
  losses: number;
  draws: number;
  recent_form: string[];
};

const getSupabaseBase = () => {
  const SUPABASE_URL = process.env.SUPABASE_URL?.trim();
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase service role credentials are not configured on the backend.');
  }
  return SUPABASE_URL.replace(/\/$/, '');
};

const getHeaders = () => {
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY ?? '',
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY ?? ''}`,
  };
};

const parseRows = async <T>(response: Response) => {
  const rows = await response.json().catch(() => null) as T[] | null;
  return Array.isArray(rows) ? rows : [];
};

const restUpsert = async <T>(table: string, row: Record<string, unknown>, onConflict = 'id') => {
  const base = getSupabaseBase();
  const response = await fetch(`${base}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`, {
    method: 'POST',
    headers: {
      ...getHeaders(),
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify([row]),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Failed to upsert ${table}: ${response.status} ${body}`);
  }

  const rows = await parseRows<T>(response);
  return rows[0] ?? null;
};

const replaceUserInterests = async (userId: string, interests: string[]) => {
  const base = getSupabaseBase();
  await fetch(`${base}/rest/v1/user_interests?user_id=eq.${userId}`, {
    method: 'DELETE',
    headers: {
      ...getHeaders(),
      Prefer: 'return=minimal',
    },
  });

  if (interests.length === 0) return;

  const rows = interests.map((interest) => ({
    user_id: userId,
    interest,
  }));

  await fetch(`${base}/rest/v1/user_interests`, {
    method: 'POST',
    headers: {
      ...getHeaders(),
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(rows),
  });
};

const upsertQuizResults = async (profile: ProfileSyncPayload) => {
  const base = getSupabaseBase();
  const patchResponse = await fetch(`${base}/rest/v1/quiz_results?user_id=eq.${profile.id}`, {
    method: 'PATCH',
    headers: {
      ...getHeaders(),
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      correct: profile.quizzes_correct,
      total: profile.quizzes_total,
    }),
  });

  if (patchResponse.ok) {
    const rows = await parseRows<Record<string, unknown>>(patchResponse);
    if (rows.length > 0) return;
  }

  await fetch(`${base}/rest/v1/quiz_results`, {
    method: 'POST',
    headers: {
      ...getHeaders(),
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify([{
      user_id: profile.id,
      correct: profile.quizzes_correct,
      total: profile.quizzes_total,
    }]),
  });
};

const upsertUserActivity = async (profile: ProfileSyncPayload) => {
  const date = new Date(profile.last_active_date).toISOString().slice(0, 10);
  const actionCount = Math.max(
    0,
    profile.articles_read + profile.quizzes_total + profile.predictions_total + profile.wins + profile.losses + profile.draws,
  );

  await restUpsert<Record<string, unknown>>('user_activity', {
    user_id: profile.id,
    activity_date: date,
    action_count: actionCount,
  }, 'user_id,activity_date');
};

const syncArticlesReadSnapshot = async (_profile: ProfileSyncPayload) => {
  // Keep historical article rows intact; reads are tracked per event in activity tracking.
  return;
};

const getProfileRank = (profile: ProfileSyncPayload) => {
  if (profile.battle_tier && profile.battle_tier.trim()) return profile.battle_tier.trim();
  if (profile.current_level >= 20) return 'LEGEND';
  if (profile.current_level >= 15) return 'MASTER';
  if (profile.current_level >= 10) return 'ORACLE';
  if (profile.current_level >= 6) return 'STRATEGIST';
  if (profile.current_level >= 3) return 'ANALYST';
  return 'ROOKIE';
};

export const syncUserTables = async (profile: ProfileSyncPayload) => {
  const rank = getProfileRank(profile);

  const [profilesRow, userRow, userProfileRow] = await Promise.all([
    restUpsert<Record<string, unknown>>('profiles', {
      id: profile.id,
      username: profile.username,
      email: profile.email ?? '',
      avatar_id: profile.avatar_id,
      level: profile.current_level,
      xp: profile.total_xp,
      streak: profile.streak_count,
      rank,
      is_onboarded: true,
    }),
    restUpsert<Record<string, unknown>>('user', {
      id: profile.id,
      username: profile.username,
      email: profile.email ?? '',
    }),
    restUpsert<Record<string, unknown>>('user_profile', {
      id: profile.id,
      username: profile.username,
      email: profile.email ?? '',
      avatarid: profile.avatar_id,
      level: profile.current_level,
      xp: profile.total_xp,
      streak: profile.streak_count,
      battle_rating: profile.battle_rating,
      battle_tier: profile.battle_tier,
    }),
  ]);

  await Promise.allSettled([
    replaceUserInterests(profile.id, profile.interests),
    upsertQuizResults(profile),
    upsertUserActivity(profile),
    syncArticlesReadSnapshot(profile),
  ]);

  return {
    profiles: profilesRow,
    user: userRow,
    user_profile: userProfileRow,
  };
};

export const validateAccessToken = async (accessToken: string) => {
  const base = getSupabaseBase();
  const response = await fetch(`${base}/auth/v1/user`, {
    headers: {
      ...getHeaders(),
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  const user = await response.json() as { id?: string } | null;
  if (!user?.id || typeof user.id !== 'string') {
    return null;
  }
  return user.id;
};
