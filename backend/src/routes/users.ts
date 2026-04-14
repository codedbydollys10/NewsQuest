import { Router } from 'express';
import { syncUserTables, validateAccessToken, type ProfileSyncPayload } from '../lib/profileSync.js';

const router = Router();

const readString = (value: unknown, fallback = '') => (typeof value === 'string' ? value.trim() : fallback);

const readNumber = (value: unknown, fallback = 0) => (
  typeof value === 'number' && Number.isFinite(value) ? value : fallback
);

const readStringArray = (value: unknown) => (
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
);

const readAvatarCustomization = (value: unknown) => {
  if (!value || typeof value !== 'object') {
    return { skinTone: 0, trailColor: 'cyan' };
  }
  const input = value as Record<string, unknown>;
  return {
    skinTone: readNumber(input.skinTone, 0),
    trailColor: readString(input.trailColor, 'cyan') || 'cyan',
  };
};

const parseSyncBody = (body: unknown): { accessToken: string; profile: ProfileSyncPayload } | null => {
  if (!body || typeof body !== 'object') return null;
  const input = body as Record<string, unknown>;
  const profileRaw = input.profile;
  if (!profileRaw || typeof profileRaw !== 'object') return null;
  const profileInput = profileRaw as Record<string, unknown>;

  const accessToken = readString(input.accessToken);
  const id = readString(profileInput.id);
  const username = readString(profileInput.username);
  if (!accessToken || !id || !username) return null;

  return {
    accessToken,
    profile: {
      id,
      email: readString(profileInput.email) || undefined,
      username,
      avatar_id: readNumber(profileInput.avatar_id, 0),
      avatar_customization: readAvatarCustomization(profileInput.avatar_customization),
      current_level: Math.max(1, readNumber(profileInput.current_level, 1)),
      total_xp: Math.max(0, readNumber(profileInput.total_xp, 0)),
      xp_to_next_level: Math.max(0, readNumber(profileInput.xp_to_next_level, 100)),
      streak_count: Math.max(0, readNumber(profileInput.streak_count, 0)),
      last_active_date: readString(profileInput.last_active_date, new Date().toISOString()),
      interests: readStringArray(profileInput.interests),
      daily_goal: Math.max(0, readNumber(profileInput.daily_goal, 5)),
      mode: readString(profileInput.mode, 'both') || 'both',
      badges: readStringArray(profileInput.badges),
      articles_read: Math.max(0, readNumber(profileInput.articles_read, 0)),
      quizzes_total: Math.max(0, readNumber(profileInput.quizzes_total, 0)),
      quizzes_correct: Math.max(0, readNumber(profileInput.quizzes_correct, 0)),
      predictions_total: Math.max(0, readNumber(profileInput.predictions_total, 0)),
      predictions_correct: Math.max(0, readNumber(profileInput.predictions_correct, 0)),
      battle_rating: Math.max(0, readNumber(profileInput.battle_rating, 1000)),
      battle_tier: readString(profileInput.battle_tier, 'ROOKIE') || 'ROOKIE',
      wins: Math.max(0, readNumber(profileInput.wins, 0)),
      losses: Math.max(0, readNumber(profileInput.losses, 0)),
      draws: Math.max(0, readNumber(profileInput.draws, 0)),
      recent_form: readStringArray(profileInput.recent_form),
    },
  };
};

router.post('/sync', async (req, res) => {
  const payload = parseSyncBody(req.body);
  if (!payload) {
    return res.status(400).json({
      success: false,
      error: 'Invalid profile sync payload.',
    });
  }

  try {
    const authUserId = await validateAccessToken(payload.accessToken);
    if (!authUserId || authUserId !== payload.profile.id) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized profile sync request.',
      });
    }

    const profile = await syncUserTables(payload.profile);
    return res.json({
      success: true,
      profile,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to sync profile.';
    return res.status(500).json({
      success: false,
      error: message,
    });
  }
});

export default router;
