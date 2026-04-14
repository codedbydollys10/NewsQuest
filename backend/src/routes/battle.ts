import { Router } from 'express';
import {
  cancelBattleQueue,
  createBattleInvite,
  getBattleRoom,
  getBattleSession,
  getBattleInvites,
  getOnlineRivals,
  joinBattleQueue,
  reportPresence,
  normalizeQuestions,
  respondToInvite,
  submitBattleAnswer,
} from '../services/battleService.js';

const router = Router();
const SUPABASE_URL = process.env.SUPABASE_URL?.trim();
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

interface SupabaseAdminUser {
  id: string;
  email?: string;
  created_at?: string;
  last_sign_in_at?: string;
  user_metadata?: Record<string, unknown>;
}

const readProfile = (body: unknown) => {
  if (!body || typeof body !== 'object') return null;
  const input = body as Record<string, unknown>;
  const userId = typeof input.userId === 'string' ? input.userId.trim() : '';
  const username = typeof input.username === 'string' ? input.username.trim() : '';
  const avatarId = typeof input.avatarId === 'number' && Number.isFinite(input.avatarId) ? input.avatarId : 0;
  const battleRating = typeof input.battleRating === 'number' && Number.isFinite(input.battleRating) ? input.battleRating : 1000;
  const battleTier = typeof input.battleTier === 'string' ? input.battleTier.trim() : 'ROOKIE';

  if (!userId || !username) return null;
  return { userId, username, avatarId, battleRating, battleTier };
};

const readBattleStart = (body: unknown) => {
  const profile = readProfile(body);
  if (!profile || !body || typeof body !== 'object') return null;
  const input = body as Record<string, unknown>;
  const mode = input.mode === 'prediction' || input.mode === 'mixed' ? input.mode : 'quiz';
  const categories = Array.isArray(input.categories)
    ? input.categories.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : ['All'];
  const timerSpeedRaw = typeof input.timerSpeed === 'number' && Number.isFinite(input.timerSpeed) ? input.timerSpeed : 40;
  const timerSpeed = Math.min(90, Math.max(20, Math.round(timerSpeedRaw)));
  const questions = normalizeQuestions(input.questions);
  return { ...profile, mode: mode as 'quiz' | 'prediction' | 'mixed', categories, timerSpeed, questions };
};

const readStringQuery = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const listSupabaseUsers = async () => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return [] as SupabaseAdminUser[];

  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/users?page=1&per_page=200`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });

  if (!response.ok) return [] as SupabaseAdminUser[];
  const data = await response.json() as { users?: SupabaseAdminUser[] };
  return Array.isArray(data.users) ? data.users : [];
};

router.get('/users/search', async (req, res) => {
  const userId = readStringQuery(req.query.userId);
  const query = readStringQuery(req.query.q).replace(/^@/, '').toLowerCase();
  const limit = Math.min(20, Math.max(1, Number.parseInt(readStringQuery(req.query.limit) || '10', 10) || 10));

  if (!userId) {
    return res.status(400).json({ success: false, error: 'Missing userId.' });
  }

  const onlineUsers = getOnlineRivals(userId);
  const onlineById = new Map(onlineUsers.map((entry) => [entry.userId, entry] as const));

  const users = await listSupabaseUsers();
  const mapped = users
    .filter((entry) => entry.id !== userId)
    .map((entry) => {
      const metadata = entry.user_metadata ?? {};
      const username = typeof metadata.username === 'string' && metadata.username.trim()
        ? metadata.username.trim()
        : typeof entry.email === 'string'
          ? entry.email.split('@')[0]
          : `user_${entry.id.slice(0, 8)}`;
      const avatarId = typeof metadata.avatar_id === 'number' && Number.isFinite(metadata.avatar_id) ? metadata.avatar_id : 0;
      const battleRating = typeof metadata.battle_rating === 'number' && Number.isFinite(metadata.battle_rating) ? metadata.battle_rating : 1000;
      const battleTier = typeof metadata.battle_tier === 'string' && metadata.battle_tier.trim() ? metadata.battle_tier : 'ROOKIE';
      const searchable = `${username} ${entry.id} ${entry.email ?? ''}`.toLowerCase();
      return {
        userId: entry.id,
        username,
        avatarId,
        battleRating,
        battleTier,
        lastSeen: entry.last_sign_in_at || entry.created_at || new Date().toISOString(),
        matches: !query || searchable.includes(query),
      };
    })
    .filter((entry) => entry.matches)
    .map(({ matches: _matches, ...entry }) => {
      const online = onlineById.get(entry.userId);
      return {
        ...entry,
        isOnline: Boolean(online),
        lastSeen: online?.lastSeen ?? entry.lastSeen,
      };
    })
    .sort((a, b) => {
      if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
      return new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime();
    })
    .slice(0, limit);

  return res.json({ success: true, users: mapped });
});

router.post('/presence', (req, res) => {
  const profile = readProfile(req.body);
  if (!profile) {
    return res.status(400).json({ success: false, error: 'Invalid presence payload.' });
  }

  const onlineUsers = reportPresence(profile);
  return res.json({ success: true, onlineUsers });
});

router.get('/session', (req, res) => {
  const userId = typeof req.query.userId === 'string' ? req.query.userId : '';
  if (!userId) {
    return res.status(400).json({ success: false, error: 'Missing userId.' });
  }

  return res.json({ success: true, ...getBattleSession(userId) });
});

router.post('/queue/join', (req, res) => {
  const payload = readBattleStart(req.body);
  if (!payload) {
    return res.status(400).json({ success: false, error: 'Invalid queue payload.' });
  }

  const result = joinBattleQueue(payload);
  return res.json({ success: true, ...result });
});

router.post('/queue/cancel', (req, res) => {
  const profile = readProfile(req.body);
  if (!profile) {
    return res.status(400).json({ success: false, error: 'Invalid payload.' });
  }

  cancelBattleQueue(profile.userId);
  return res.json({ success: true });
});

router.get('/inbox', (req, res) => {
  const userId = typeof req.query.userId === 'string' ? req.query.userId : '';
  if (!userId) {
    return res.status(400).json({ success: false, error: 'Missing userId.' });
  }

  return res.json({ success: true, invites: getBattleInvites(userId) });
});

router.post('/invite', (req, res) => {
  const payload = readBattleStart(req.body);
  const targetUserId = typeof req.body === 'object' && req.body && typeof (req.body as Record<string, unknown>).targetUserId === 'string'
    ? ((req.body as Record<string, unknown>).targetUserId as string).trim()
    : '';

  if (!payload || !targetUserId) {
    return res.status(400).json({ success: false, error: 'Invalid invite payload.' });
  }

  const invite = createBattleInvite({ ...payload, targetUserId });
  return res.json({ success: true, invite });
});

router.post('/invite/respond', (req, res) => {
  const profile = readProfile(req.body);
  const inviteId = typeof req.body === 'object' && req.body && typeof (req.body as Record<string, unknown>).inviteId === 'string'
    ? ((req.body as Record<string, unknown>).inviteId as string).trim()
    : '';
  const accepted = typeof req.body === 'object' && req.body && typeof (req.body as Record<string, unknown>).accepted === 'boolean'
    ? ((req.body as Record<string, unknown>).accepted as boolean)
    : false;

  if (!profile || !inviteId) {
    return res.status(400).json({ success: false, error: 'Invalid invite response payload.' });
  }

  const result = respondToInvite(inviteId, accepted, profile);
  return res.json({ success: true, ...result });
});

router.get('/:battleId', (req, res) => {
  const battle = getBattleRoom(req.params.battleId, typeof req.query.userId === 'string' ? req.query.userId : '');
  if (!battle) {
    return res.status(404).json({ success: false, error: 'Battle not found.' });
  }

  return res.json({ success: true, battle });
});

router.post('/:battleId/answer', (req, res) => {
  const profile = readProfile(req.body);
  const answer = typeof req.body === 'object' && req.body && typeof (req.body as Record<string, unknown>).answer === 'string'
    ? ((req.body as Record<string, unknown>).answer as string)
    : '';
  const confidence = typeof req.body === 'object' && req.body && (req.body as Record<string, unknown>).confidence;

  if (!profile || !answer) {
    return res.status(400).json({ success: false, error: 'Invalid answer payload.' });
  }

  const battle = submitBattleAnswer(req.params.battleId, { userId: profile.userId, answer, confidence: typeof confidence === 'number' ? confidence : undefined });
  if (!battle) {
    return res.status(404).json({ success: false, error: 'Battle not found.' });
  }

  return res.json({ success: true, battle });
});

export default router;
