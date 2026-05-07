import { Router } from 'express';
const router = Router();
const getSupabaseBase = () => {
    const SUPABASE_URL = process.env.SUPABASE_URL?.trim();
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Supabase service role credentials are not configured on the backend.');
    }
    return SUPABASE_URL.replace(/\/$/, '');
};
const getHeaders = () => ({
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '',
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? ''}`,
});
const getWeekStartDate = () => {
    const now = new Date();
    const day = now.getUTCDay();
    const diff = day === 0 ? 6 : day - 1;
    const weekStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    weekStart.setUTCDate(weekStart.getUTCDate() - diff);
    return weekStart.toISOString().slice(0, 10);
};
const fetchJson = async (url) => {
    const response = await fetch(url, { headers: getHeaders() });
    if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`${response.status} ${body}`);
    }
    const text = await response.text();
    if (!text || text.trim() === '') {
        throw new Error('Empty response');
    }
    try {
        return JSON.parse(text);
    }
    catch (parseError) {
        console.error('JSON parse error:', parseError, 'Response:', text.slice(0, 500));
        throw new Error('Invalid JSON response');
    }
};
// Helper to add timeout to async operations
const withTimeout = (promise, ms, label) => {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
};
const listUserProfiles = async () => {
    const base = getSupabaseBase();
    const query = new URLSearchParams({
        select: '*',
        limit: '1000',
    });
    return withTimeout(fetchJson(`${base}/rest/v1/profiles?${query.toString()}`), 10000, 'User profiles');
};
const listQuizRows = async () => {
    const base = getSupabaseBase();
    const query = new URLSearchParams({
        select: 'user_id,correct,total',
        limit: '1000',
    });
    return withTimeout(fetchJson(`${base}/rest/v1/quiz_results?${query.toString()}`), 8000, 'Quiz rows');
};
const listWeeklyActivity = async () => {
    const base = getSupabaseBase();
    const weekStart = getWeekStartDate();
    const legacyQuery = new URLSearchParams({
        select: 'user_id,action_count',
        activity_date: `gte.${weekStart}`,
        limit: '5000',
    });
    return withTimeout(fetchJson(`${base}/rest/v1/user_activity?${legacyQuery.toString()}`).catch(async () => {
        const richQuery = new URLSearchParams({
            select: 'user_id,total_events',
            activity_date: `gte.${weekStart}`,
            limit: '5000',
        });
        return fetchJson(`${base}/rest/v1/user_activity_days?${richQuery.toString()}`);
    }), 8000, 'Weekly activity');
};
router.get('/', async (_req, res) => {
    try {
        const [profiles, quizRows, activityRows] = await Promise.all([
            listUserProfiles(),
            listQuizRows().catch(() => []),
            listWeeklyActivity().catch(() => []),
        ]);
        const quizByUser = new Map();
        for (const row of quizRows) {
            if (!row.user_id)
                continue;
            quizByUser.set(row.user_id, row);
        }
        const weeklyByUser = new Map();
        for (const row of activityRows) {
            if (!row.user_id)
                continue;
            const total = typeof row.action_count === 'number'
                ? row.action_count
                : typeof row.total_events === 'number'
                    ? row.total_events
                    : 0;
            weeklyByUser.set(row.user_id, (weeklyByUser.get(row.user_id) ?? 0) + total);
        }
        const leaderboard = profiles.map((entry) => {
            const quiz = quizByUser.get(entry.id);
            const quizzesTotal = typeof quiz?.total === 'number' ? quiz.total : 0;
            const quizzesCorrect = typeof quiz?.correct === 'number' ? quiz.correct : 0;
            const predictionsTotal = 0;
            const predictionsCorrect = 0;
            const totalAttempts = quizzesTotal + predictionsTotal;
            const weightedAccuracy = totalAttempts > 0 ? ((quizzesCorrect + predictionsCorrect) / totalAttempts) * 100 : 0;
            const predictionAccuracy = predictionsTotal > 0 ? (predictionsCorrect / predictionsTotal) * 100 : 0;
            return {
                id: entry.id,
                username: entry.username?.trim() || `user_${entry.id.slice(0, 8)}`,
                avatarId: typeof entry.avatar_id === 'number'
                    ? entry.avatar_id
                    : typeof entry.avatarid === 'number'
                        ? entry.avatarid
                        : 0,
                level: typeof entry.level === 'number' ? entry.level : 1,
                totalXP: typeof entry.xp === 'number' ? entry.xp : 0,
                streak: typeof entry.streak === 'number' ? entry.streak : 0,
                quizzesTotal,
                quizzesCorrect,
                predictionsTotal,
                predictionsCorrect,
                accuracy: Math.round(weightedAccuracy),
                oracleScore: Math.round(predictionAccuracy),
                weeklyScore: weeklyByUser.get(entry.id) ?? 0,
            };
        });
        return res.json({
            success: true,
            leaderboard,
            generatedAt: new Date().toISOString(),
            weekStart: getWeekStartDate(),
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load leaderboard.';
        return res.status(500).json({ success: false, error: message });
    }
});
export default router;
