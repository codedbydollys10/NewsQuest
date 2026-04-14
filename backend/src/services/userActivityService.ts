import { randomUUID } from 'crypto';

export type ActivityType = 'read' | 'quiz' | 'prediction' | 'battle';

export type UserActivityDay = {
  id?: string;
  user_id: string;
  activity_date: string;
  total_events: number;
  article_reads: number;
  quiz_answers: number;
  prediction_locks: number;
  battle_matches: number;
  streak_count?: number;
  last_active_at?: string;
  updated_at?: string;
};

export type UserActivityStats = {
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

const getSupabaseRestUrl = () => {
  const SUPABASE_URL = process.env.SUPABASE_URL?.trim();
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase service role credentials are not configured.');
  }
  return `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1`;
};

const supabaseHeaders = () => ({
  apikey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '',
  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? ''}`,
  'Content-Type': 'application/json',
});

const toUtcDate = (input?: string | Date) => {
  const date = input ? new Date(input) : new Date();
  return date.toISOString().slice(0, 10);
};

const buildBaseRow = (userId: string, activityDate: string): UserActivityDay => ({
  id: randomUUID(),
  user_id: userId,
  activity_date: activityDate,
  total_events: 0,
  article_reads: 0,
  quiz_answers: 0,
  prediction_locks: 0,
  battle_matches: 0,
  streak_count: 0,
});

const fetchJson = async <T>(input: string, init: RequestInit) => {
  const response = await fetch(input, init);
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`${response.status} ${body}`);
  }
  return response.json() as Promise<T>;
};

const parseLegacyRows = (rows: Array<{ user_id: string; activity_date: string; action_count: number }>): UserActivityDay[] =>
  rows.map((row) => ({
    id: randomUUID(),
    user_id: row.user_id,
    activity_date: row.activity_date,
    total_events: typeof row.action_count === 'number' ? row.action_count : 0,
    article_reads: 0,
    quiz_answers: 0,
    prediction_locks: 0,
    battle_matches: 0,
    streak_count: 0,
  }));

const readFromUserActivityDays = async (userId: string, activityDate: string) => {
  const baseUrl = getSupabaseRestUrl();
  const query = new URLSearchParams({
    select: 'id,user_id,activity_date,total_events,article_reads,quiz_answers,prediction_locks,battle_matches,streak_count,last_active_at,updated_at',
    user_id: `eq.${userId}`,
    activity_date: `eq.${activityDate}`,
    limit: '1',
  });

  return fetchJson<UserActivityDay[]>(`${baseUrl}/user_activity_days?${query.toString()}`, {
    headers: supabaseHeaders(),
  });
};

const readFromUserActivityLegacy = async (userId: string, activityDate: string) => {
  const baseUrl = getSupabaseRestUrl();
  const query = new URLSearchParams({
    select: 'user_id,activity_date,action_count',
    user_id: `eq.${userId}`,
    activity_date: `eq.${activityDate}`,
    limit: '1',
  });

  const rows = await fetchJson<Array<{ user_id: string; activity_date: string; action_count: number }>>(
    `${baseUrl}/user_activity?${query.toString()}`,
    { headers: supabaseHeaders() },
  );
  return parseLegacyRows(rows);
};

const readLegacyActionCount = async (baseUrl: string, userId: string, activityDate: string) => {
  const query = new URLSearchParams({
    select: 'action_count',
    user_id: `eq.${userId}`,
    activity_date: `eq.${activityDate}`,
    limit: '1',
  });

  const rows = await fetchJson<Array<{ action_count?: number }>>(
    `${baseUrl}/user_activity?${query.toString()}`,
    { headers: supabaseHeaders() },
  );

  const current = rows[0]?.action_count;
  return typeof current === 'number' && Number.isFinite(current) ? Math.max(0, current) : 0;
};

const insertArticleRead = async (
  userId: string,
  articleTitle?: string,
  articleCategory?: string,
) => {
  const title = typeof articleTitle === 'string' && articleTitle.trim().length > 0
    ? articleTitle.trim().slice(0, 500)
    : 'Untitled Article';
  const category = typeof articleCategory === 'string' && articleCategory.trim().length > 0
    ? articleCategory.trim().slice(0, 80)
    : 'General';

  const baseUrl = getSupabaseRestUrl();
  const payload = {
    id: randomUUID(),
    user_id: userId,
    title,
    category,
    created_at: new Date().toISOString(),
  };

  const responseWithCategory = await fetch(`${baseUrl}/articles_read`, {
    method: 'POST',
    headers: {
      ...supabaseHeaders(),
      Prefer: 'return=minimal',
    },
    body: JSON.stringify([payload]),
  });

  if (responseWithCategory.ok) return;

  // Backward compatibility if category column is not migrated yet.
  await fetch(`${baseUrl}/articles_read`, {
    method: 'POST',
    headers: {
      ...supabaseHeaders(),
      Prefer: 'return=minimal',
    },
    body: JSON.stringify([{
      id: randomUUID(),
      user_id: userId,
      title,
      created_at: payload.created_at,
    }]),
  }).catch(() => undefined);
};

const upsertLegacyUserActivity = async (baseUrl: string, persisted: UserActivityDay) => {
  const patchResponse = await fetch(
    `${baseUrl}/user_activity?user_id=eq.${encodeURIComponent(persisted.user_id)}&activity_date=eq.${encodeURIComponent(persisted.activity_date)}`,
    {
      method: 'PATCH',
      headers: {
        ...supabaseHeaders(),
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        action_count: persisted.total_events,
      }),
    },
  ).catch(() => null);

  if (patchResponse?.ok) {
    const rows = await patchResponse.json().catch(() => [] as Array<Record<string, unknown>>);
    if (Array.isArray(rows) && rows.length > 0) return;
  }

  const insertResponse = await fetch(`${baseUrl}/user_activity`, {
    method: 'POST',
    headers: {
      ...supabaseHeaders(),
      Prefer: 'return=minimal',
    },
    body: JSON.stringify([{
      id: randomUUID(),
      user_id: persisted.user_id,
      activity_date: persisted.activity_date,
      action_count: persisted.total_events,
    }]),
  });

  if (!insertResponse.ok) {
    const patchBody = patchResponse ? await patchResponse.text().catch(() => '') : 'no patch response';
    const insertBody = await insertResponse.text().catch(() => '');
    throw new Error(`Failed to upsert user_activity: patch=${patchResponse?.status ?? 'n/a'} ${patchBody}; insert=${insertResponse.status} ${insertBody}`);
  }
};

export const recordUserActivity = async (
  userId: string,
  type: ActivityType,
  at: string | Date = new Date(),
  streakCount?: number,
  articleMeta?: { title?: string; category?: string },
) => {
  const activityDate = toUtcDate(at);
  const baseUrl = getSupabaseRestUrl();
  const currentTotal = await readLegacyActionCount(baseUrl, userId, activityDate).catch(() => 0);
  const existing = await readFromUserActivityDays(userId, activityDate).catch(() => [] as UserActivityDay[]);
  const current = existing[0] ?? buildBaseRow(userId, activityDate);

  const next: UserActivityDay = {
    ...current,
    id: current.id ?? randomUUID(),
    total_events: Math.max(current.total_events + 1, currentTotal + 1),
    article_reads: current.article_reads + (type === 'read' ? 1 : 0),
    quiz_answers: current.quiz_answers + (type === 'quiz' ? 1 : 0),
    prediction_locks: current.prediction_locks + (type === 'prediction' ? 1 : 0),
    battle_matches: current.battle_matches + (type === 'battle' ? 1 : 0),
    streak_count: typeof streakCount === 'number'
      ? Math.max(0, Math.floor(streakCount))
      : (current.streak_count ?? 0),
    last_active_at: new Date().toISOString(),
  };

  // user_activity is the guaranteed source of truth for daily activity counts.
  await upsertLegacyUserActivity(baseUrl, next);

  // user_activity_days is optional richer detail; keep it best-effort only.
  const upsertResponse = await fetch(`${baseUrl}/user_activity_days?on_conflict=user_id,activity_date`, {
    method: 'POST',
    headers: {
      ...supabaseHeaders(),
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(next),
  }).catch(() => null);

  const rows = upsertResponse?.ok ? await upsertResponse.json() as UserActivityDay[] : [];
  const persisted = rows[0] ?? next;

  if (articleMeta?.title || articleMeta?.category) {
    await insertArticleRead(userId, articleMeta?.title, articleMeta?.category).catch((error) => {
      console.error('[activity] Failed to insert articles_read row', error);
    });
  }

  return persisted;
};

export const getUserActivityDays = async (userId: string, days = 364) => {
  const baseUrl = getSupabaseRestUrl();
  const startDate = new Date();
  startDate.setUTCDate(startDate.getUTCDate() - Math.max(0, days - 1));
  const fromDate = startDate.toISOString().slice(0, 10);

  const queryDays = new URLSearchParams({
    select: 'id,user_id,activity_date,total_events,article_reads,quiz_answers,prediction_locks,battle_matches,streak_count,last_active_at',
    user_id: `eq.${userId}`,
    activity_date: `gte.${fromDate}`,
    order: 'activity_date.asc',
  });

  const detailedRows = await fetchJson<UserActivityDay[]>(
    `${baseUrl}/user_activity_days?${queryDays.toString()}`,
    { headers: supabaseHeaders() },
  ).catch(() => []);

  const queryLegacy = new URLSearchParams({
    select: 'user_id,activity_date,action_count',
    user_id: `eq.${userId}`,
    activity_date: `gte.${fromDate}`,
    order: 'activity_date.asc',
  });
  const legacyRows = await fetchJson<Array<{ user_id: string; activity_date: string; action_count: number }>>(
    `${baseUrl}/user_activity?${queryLegacy.toString()}`,
    { headers: supabaseHeaders() },
  ).catch(() => []);

  if (detailedRows.length === 0) {
    return parseLegacyRows(legacyRows);
  }

  const mergedByDate = new Map(detailedRows.map((row) => [row.activity_date, { ...row }] as const));
  for (const row of legacyRows) {
    const existing = mergedByDate.get(row.activity_date);
    if (existing) {
      mergedByDate.set(row.activity_date, {
        ...existing,
        total_events: typeof row.action_count === 'number' ? row.action_count : existing.total_events,
      });
      continue;
    }

    mergedByDate.set(row.activity_date, {
      id: randomUUID(),
      user_id: row.user_id,
      activity_date: row.activity_date,
      total_events: typeof row.action_count === 'number' ? row.action_count : 0,
      article_reads: 0,
      quiz_answers: 0,
      prediction_locks: 0,
      battle_matches: 0,
      streak_count: 0,
    });
  }

  return [...mergedByDate.values()].sort((a, b) => a.activity_date.localeCompare(b.activity_date));
};

const getCategoryReadStats = async (userId: string, days = 30) => {
  const baseUrl = getSupabaseRestUrl();
  const from = new Date();
  from.setUTCDate(from.getUTCDate() - Math.max(0, days - 1));
  const fromIso = from.toISOString();

  const query = new URLSearchParams({
    select: 'category,created_at',
    user_id: `eq.${userId}`,
    created_at: `gte.${fromIso}`,
    order: 'created_at.desc',
    limit: '1000',
  });

  const rows = await fetchJson<Array<{ category?: string | null; created_at?: string | null }>>(
    `${baseUrl}/articles_read?${query.toString()}`,
    { headers: supabaseHeaders() },
  ).catch(() => []);

  const buckets = new Map<string, number>();
  const dailyBuckets = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const category = typeof row.category === 'string' && row.category.trim()
      ? row.category.trim()
      : 'General';
    buckets.set(category, (buckets.get(category) ?? 0) + 1);
    const date = new Date(row.created_at ?? new Date().toISOString())
      .toISOString()
      .slice(0, 10);
    const dayMap = dailyBuckets.get(date) ?? new Map<string, number>();
    dayMap.set(category, (dayMap.get(category) ?? 0) + 1);
    dailyBuckets.set(date, dayMap);
  }

  const categoryMix = [...buckets.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const categories = categoryMix.map((entry) => entry.category);
  const dateRows: Array<{ date: string; day: string; values: Record<string, number> }> = [];
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - Math.max(0, days - 1));
  for (let i = 0; i < days; i += 1) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const date = d.toISOString().slice(0, 10);
    const day = date.slice(5);
    const byCategory = dailyBuckets.get(date);
    const values: Record<string, number> = {};
    for (const category of categories) {
      values[category] = byCategory?.get(category) ?? 0;
    }
    dateRows.push({ date, day, values });
  }

  return {
    categoryMix,
    categories,
    categoryDaily: dateRows,
  };
};

export const getUserActivityStats = async (userId: string, days = 30): Promise<UserActivityStats> => {
  const detailedRows = await getUserActivityDays(userId, days);
  const baseUrl = getSupabaseRestUrl();
  const startDate = new Date();
  startDate.setUTCDate(startDate.getUTCDate() - Math.max(0, days - 1));
  const fromDate = startDate.toISOString().slice(0, 10);

  const legacyQuery = new URLSearchParams({
    select: 'activity_date,action_count',
    user_id: `eq.${userId}`,
    activity_date: `gte.${fromDate}`,
    order: 'activity_date.asc',
  });

  const legacyRows = await fetchJson<Array<{ activity_date: string; action_count: number }>>(
    `${baseUrl}/user_activity?${legacyQuery.toString()}`,
    { headers: supabaseHeaders() },
  ).catch(() => []);

  const detailByDay = new Map(detailedRows.map((row) => [row.activity_date, row] as const));

  const trendSource = legacyRows.length > 0
    ? legacyRows.map((row) => ({ day: row.activity_date, totalEvents: row.action_count ?? 0 }))
    : detailedRows.map((row) => ({ day: row.activity_date, totalEvents: row.total_events ?? 0 }));

  const trend = trendSource.map((row) => {
    const detail = detailByDay.get(row.day);
    return {
      day: row.day.slice(5),
      totalEvents: row.totalEvents,
      articleReads: detail?.article_reads ?? 0,
      quizAnswers: detail?.quiz_answers ?? 0,
      predictionLocks: detail?.prediction_locks ?? 0,
      battleMatches: detail?.battle_matches ?? 0,
      streakCount: detail?.streak_count ?? 0,
    };
  });

  const totals = trend.reduce((acc, row) => ({
    totalEvents: acc.totalEvents + row.totalEvents,
    articleReads: acc.articleReads + row.articleReads,
    quizAnswers: acc.quizAnswers + row.quizAnswers,
    predictionLocks: acc.predictionLocks + row.predictionLocks,
    battleMatches: acc.battleMatches + row.battleMatches,
    maxStreak: Math.max(acc.maxStreak, row.streakCount),
    latestStreak: row.streakCount > 0 ? row.streakCount : acc.latestStreak,
  }), {
    totalEvents: 0,
    articleReads: 0,
    quizAnswers: 0,
    predictionLocks: 0,
    battleMatches: 0,
    maxStreak: 0,
    latestStreak: 0,
  });

  const categoryReadStats = await getCategoryReadStats(userId, days);

  return {
    trend,
    totals,
    categoryMix: categoryReadStats.categoryMix,
    categories: categoryReadStats.categories,
    categoryDaily: categoryReadStats.categoryDaily,
  };
};
