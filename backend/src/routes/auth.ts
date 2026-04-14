import { Router } from 'express';
import { syncUserTables } from '../lib/profileSync.js';

const router = Router();

const SUPABASE_URL = process.env.SUPABASE_URL?.trim();
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

const registerBodySchema = (body: unknown) => {
  if (!body || typeof body !== 'object') return null;
  const input = body as Record<string, unknown>;
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const password = typeof input.password === 'string' ? input.password : '';
  const username = typeof input.username === 'string' ? input.username.trim() : '';
  const avatarId = typeof input.avatarId === 'number' && Number.isFinite(input.avatarId) ? input.avatarId : 0;

  if (!email || !password || !username) return null;
  return { email, password, username, avatarId };
};

router.post('/register', async (req, res) => {
  try {
    const body = registerBodySchema(req.body);
    if (!body) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid registration fields.',
      });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({
        success: false,
        error: 'Supabase service role credentials are not configured on the backend.',
      });
    }

    const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        email: body.email,
        password: body.password,
        email_confirm: true,
        user_metadata: {
          username: body.username,
          avatar_id: body.avatarId,
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
        },
      }),
    });

    const data = await response.json() as { id?: string; email?: string; user_metadata?: Record<string, unknown>; error?: string; msg?: string };

    if (!response.ok) {
      const message = data.error || data.msg || 'Failed to register user in Supabase.';
      return res.status(response.status).json({
        success: false,
        error: message,
      });
    }

    if (data.id) {
      const now = new Date().toISOString();
      await syncUserTables({
        id: data.id,
        email: data.email ?? body.email,
        username: body.username,
        avatar_id: body.avatarId,
        avatar_customization: { skinTone: 0, trailColor: 'cyan' },
        current_level: 1,
        total_xp: 25,
        xp_to_next_level: 100,
        streak_count: 0,
        last_active_date: now,
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
    }

    return res.json({
      success: true,
      user: data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to register user.';
    return res.status(500).json({ success: false, error: message });
  }
});

export default router;
