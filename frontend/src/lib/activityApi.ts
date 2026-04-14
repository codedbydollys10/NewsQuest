const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '/api';

const apiUrl = (path: string) => `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

export const ACTIVITY_UPDATED_EVENT = 'newsquest:activity-updated';

export type ActivityType = 'read' | 'quiz' | 'prediction' | 'battle';

export type ActivityDay = {
  user_id: string;
  activity_date: string;
  total_events: number;
  article_reads: number;
  quiz_answers: number;
  prediction_locks: number;
  battle_matches: number;
  streak_count?: number;
  last_active_at?: string;
};

type HeatmapResponse = {
  success: boolean;
  days: ActivityDay[];
};

type TrackResponse = {
  success: boolean;
  activity: ActivityDay;
};

type ActivityStatsResponse = {
  success: boolean;
  trend: Array<{
    day: string;
    totalEvents: number;
    articleReads: number;
    quizAnswers: number;
    predictionLocks: number;
    battleMatches: number;
    streakCount: number;
  }>;
  totals: {
    totalEvents: number;
    articleReads: number;
    quizAnswers: number;
    predictionLocks: number;
    battleMatches: number;
    maxStreak: number;
    latestStreak: number;
  };
  categoryMix: Array<{
    category: string;
    count: number;
  }>;
  categories: string[];
  categoryDaily: Array<{
    date: string;
    day: string;
    values: Record<string, number>;
  }>;
};

const toLocalDateString = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const fetchActivityHeatmap = async (userId: string, days = 364) => {
  const response = await fetch(apiUrl(`/activity/heatmap/${encodeURIComponent(userId)}?days=${days}`));
  const data = await response.json() as HeatmapResponse;

  if (!response.ok || !data.success) {
    throw new Error('Failed to load activity heatmap.');
  }

  return data.days ?? [];
};

export const trackActivity = async (
  userId: string,
  type: ActivityType,
  at?: string | Date,
  options?: { streakCount?: number; articleTitle?: string; articleCategory?: string },
) => {
  const activityDate = typeof at === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(at)
    ? at
    : toLocalDateString(at instanceof Date ? at : new Date());

  const response = await fetch(apiUrl('/activity/track'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      type,
      at: activityDate,
      streakCount: options?.streakCount,
      articleTitle: options?.articleTitle,
      articleCategory: options?.articleCategory,
    }),
  });

  const data = await response.json().catch(() => null) as TrackResponse | null;
  if (!response.ok || !data.success) {
    const errorMessage = (data as { error?: string } | null)?.error;
    throw new Error(errorMessage || `Failed to track activity (${response.status}).`);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ACTIVITY_UPDATED_EVENT, {
      detail: {
        userId,
        type,
        activityDate: data.activity?.activity_date ?? activityDate,
      },
    }));
  }

  return data.activity;
};

export const fetchActivityStats = async (userId: string, days = 30) => {
  const response = await fetch(apiUrl(`/activity/stats/${encodeURIComponent(userId)}?days=${days}`));
  const data = await response.json() as ActivityStatsResponse;

  if (!response.ok || !data.success) {
    throw new Error('Failed to load activity stats.');
  }

  return data;
};
