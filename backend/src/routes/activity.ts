import { Router } from 'express';
import { getUserActivityDays, getUserActivityStats, recordUserActivity } from '../services/userActivityService.js';

const router = Router();

const parseUserId = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) return null;
  return value.trim();
};

const parseActivityType = (value: unknown) => {
  if (value === 'read' || value === 'quiz' || value === 'prediction' || value === 'battle') return value;
  return null;
};

const parseDays = (value: unknown) => {
  if (typeof value !== 'string') return 364;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) return 364;
  return Math.min(parsed, 364);
};

const parseOptionalStreak = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.floor(value));
};

const parseOptionalString = (value: unknown, maxLength: number) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
};

router.post('/track', async (req, res, next) => {
  try {
    const userId = parseUserId(req.body?.userId);
    const type = parseActivityType(req.body?.type);
    if (!userId || !type) {
      return res.status(400).json({
        success: false,
        error: 'userId and a valid type (read, quiz, prediction, battle) are required.',
      });
    }

    const row = await recordUserActivity(
      userId,
      type,
      req.body?.at,
      parseOptionalStreak(req.body?.streakCount),
      {
        title: parseOptionalString(req.body?.articleTitle, 500),
        category: parseOptionalString(req.body?.articleCategory, 80),
      },
    );
    res.json({ success: true, activity: row });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to track activity.';
    res.status(500).json({ success: false, error: message });
  }
});

router.get('/heatmap/:userId', async (req, res, next) => {
  try {
    const userId = parseUserId(req.params.userId);
    if (!userId) {
      return res.status(400).json({ success: false, error: 'Invalid user id.' });
    }

    const days = parseDays(req.query.days);
    const activity = await getUserActivityDays(userId, days);

    res.json({
      success: true,
      days: activity,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/stats/:userId', async (req, res, next) => {
  try {
    const userId = parseUserId(req.params.userId);
    if (!userId) {
      return res.status(400).json({ success: false, error: 'Invalid user id.' });
    }

    const days = parseDays(req.query.days);
    const stats = await getUserActivityStats(userId, Math.min(days, 90));

    res.json({
      success: true,
      ...stats,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
