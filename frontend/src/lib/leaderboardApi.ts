import { supabase } from '@/lib/supabase';

const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '/api';
const apiUrl = (path: string) => `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

export type LeaderboardEntry = {
  id: string;
  username: string;
  avatarId: number;
  level: number;
  totalXP: number;
  streak: number;
  quizzesTotal: number;
  quizzesCorrect: number;
  predictionsTotal: number;
  predictionsCorrect: number;
  accuracy: number;
  oracleScore: number;
  weeklyScore: number;
};

type LeaderboardResponse = {
  success: boolean;
  leaderboard: LeaderboardEntry[];
  generatedAt: string;
  weekStart: string;
  error?: string;
};

type ProfileRow = {
  id: string;
  username?: string | null;
  avatar_id?: number | null;
  avatarid?: number | null;
  level?: number | null;
  xp?: number | null;
  streak?: number | null;
};

type QuizRow = {
  user_id: string;
  correct?: number | null;
  total?: number | null;
};

type ActivityRow = {
  user_id: string;
  action_count?: number | null;
  total_events?: number | null;
};

const parseJsonSafely = async <T>(response: Response): Promise<T | null> => {
  const raw = await response.text().catch(() => '');
  if (!raw.trim()) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const toInt = (value: unknown, fallback = 0) => (
  typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : fallback
);

const getWeekStartDate = () => {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  const weekStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  weekStart.setUTCDate(weekStart.getUTCDate() - diff);
  return weekStart.toISOString().slice(0, 10);
};

const fetchProfileRows = async (): Promise<ProfileRow[]> => {
  const primary = await supabase
    .from('profiles')
    .select('id,username,avatar_id,avatarid,level,xp,streak')
    .limit(1000);

  if (!primary.error && Array.isArray(primary.data) && primary.data.length > 0) {
    return primary.data as ProfileRow[];
  }

  const fallback = await supabase
    .from('user_profile')
    .select('id,username,avatarid,level,xp,streak')
    .limit(1000);

  if (!fallback.error && Array.isArray(fallback.data)) {
    return fallback.data as ProfileRow[];
  }

  return [];
};

const fetchQuizRows = async (): Promise<QuizRow[]> => {
  const response = await supabase
    .from('quiz_results')
    .select('user_id,correct,total')
    .limit(5000);

  if (response.error || !Array.isArray(response.data)) {
    return [];
  }

  return response.data as QuizRow[];
};

const fetchWeeklyActivityRows = async (weekStart: string): Promise<ActivityRow[]> => {
  const legacy = await supabase
    .from('user_activity')
    .select('user_id,action_count')
    .gte('activity_date', weekStart)
    .limit(5000);

  if (!legacy.error && Array.isArray(legacy.data)) {
    return legacy.data as ActivityRow[];
  }

  const detailed = await supabase
    .from('user_activity_days')
    .select('user_id,total_events')
    .gte('activity_date', weekStart)
    .limit(5000);

  if (detailed.error || !Array.isArray(detailed.data)) {
    return [];
  }

  return detailed.data as ActivityRow[];
};

const fetchLeaderboardFromSupabase = async (): Promise<LeaderboardResponse> => {
  const weekStart = getWeekStartDate();
  const [profiles, quizRows, activityRows] = await Promise.all([
    fetchProfileRows(),
    fetchQuizRows(),
    fetchWeeklyActivityRows(weekStart),
  ]);

  const quizByUser = new Map<string, QuizRow>();
  for (const row of quizRows) {
    if (row.user_id) quizByUser.set(row.user_id, row);
  }

  const weeklyByUser = new Map<string, number>();
  for (const row of activityRows) {
    if (!row.user_id) continue;
    const total = typeof row.action_count === 'number'
      ? row.action_count
      : typeof row.total_events === 'number'
        ? row.total_events
        : 0;
    weeklyByUser.set(row.user_id, (weeklyByUser.get(row.user_id) ?? 0) + toInt(total));
  }

  const leaderboard = profiles.map((entry) => {
    const quiz = quizByUser.get(entry.id);
    const quizzesTotal = toInt(quiz?.total);
    const quizzesCorrect = toInt(quiz?.correct);
    const predictionsTotal = 0;
    const predictionsCorrect = 0;
    const totalAttempts = quizzesTotal + predictionsTotal;
    const weightedAccuracy = totalAttempts > 0
      ? ((quizzesCorrect + predictionsCorrect) / totalAttempts) * 100
      : 0;

    return {
      id: entry.id,
      username: entry.username?.trim() || `user_${entry.id.slice(0, 8)}`,
      avatarId: toInt(entry.avatar_id ?? entry.avatarid),
      level: toInt(entry.level, 1),
      totalXP: toInt(entry.xp),
      streak: toInt(entry.streak),
      quizzesTotal,
      quizzesCorrect,
      predictionsTotal,
      predictionsCorrect,
      accuracy: Math.round(weightedAccuracy),
      oracleScore: 0,
      weeklyScore: weeklyByUser.get(entry.id) ?? 0,
    } satisfies LeaderboardEntry;
  });

  return {
    success: true,
    leaderboard,
    generatedAt: new Date().toISOString(),
    weekStart,
  };
};

const fetchLeaderboardViaApi = async (): Promise<LeaderboardResponse | null> => {
  const response = await fetch(apiUrl('/leaderboard'));
  const data = await parseJsonSafely<LeaderboardResponse>(response);
  if (!response.ok || !data?.success) return null;
  return data;
};

export const fetchLeaderboard = async () => {
  const timeoutPromise = new Promise<never>((_resolve, reject) => 
    setTimeout(() => reject(new Error('Leaderboard request timed out')), 12000)
  );
  
  const fetchPromise = (async () => {
    const response = await fetch(apiUrl('/leaderboard'));
    
    // Check if response status is OK
    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }
    
    // Get the response text first to check it's valid
    const text = await response.text();
    if (!text || text.trim() === '') {
      throw new Error('Empty response from server');
    }
    
    // Try to parse the JSON
    try {
      const data = JSON.parse(text) as LeaderboardResponse;
      if (!data.success) {
        throw new Error(data.error || 'Server returned failure');
      }
      return data;
    } catch (parseError) {
      console.error('Failed to parse leaderboard response:', parseError);
      throw new Error('Invalid response format from server');
    }
  })();
  
  return Promise.race([fetchPromise, timeoutPromise]) as Promise<LeaderboardResponse>;
};
