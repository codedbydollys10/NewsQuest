import './runtime.js';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import newsRouter from './routes/news.js';
import authRouter from './routes/auth.js';
import activityRouter from './routes/activity.js';
import battleRouter from './routes/battle.js';
import predictionsRouter from './routes/predictions.js';
import leaderboardRouter from './routes/leaderboard.js';
import usersRouter from './routes/users.js';
import { errorHandler } from './middleware/errorHandler.js';
import { flushCache, getCacheStats } from './services/newsDataService.js';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const app = express();
const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? '127.0.0.1';
const defaultOrigins = [
  'http://localhost:5173',
  'http://localhost:4000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4000',
];
const allowedOrigins = (process.env.CORS_ORIGIN ?? defaultOrigins.join(','))
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again shortly.' },
});

app.use((req, res, next) => {
  if (req.path.startsWith('/api/news')) {
    next();
    return;
  }

  apiLimiter(req, res, next);
});

app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    cache: getCacheStats(),
    timestamp: new Date().toISOString(),
  });
});

app.post('/api/cache/flush', (req, res) => {
  const requestIp = req.ip ?? '';
  const isLocalRequest = requestIp.includes('127.0.0.1') || requestIp.includes('::1') || requestIp.includes('localhost');
  if (process.env.NODE_ENV === 'production' && !isLocalRequest) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }

  flushCache();
  res.json({ success: true, message: 'Cache cleared' });
});

app.use('/api/news', newsRouter);
app.use('/api/auth', authRouter);
app.use('/api/activity', activityRouter);
app.use('/api/battle', battleRouter);
app.use('/api/predictions', predictionsRouter);
app.use('/api/leaderboard', leaderboardRouter);
app.use('/api/users', usersRouter);

app.use('/api', (_req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});

app.use(errorHandler);

app.listen(port, host, () => {
  console.log(`NewsQuest backend running on http://${host}:${port}`);
  console.log('GET  /api/news');
  console.log('GET  /api/news/search?q=...');
  console.log('GET  /api/news/category/:type');
  console.log('GET  /api/news/featured');
  console.log('POST /api/news/generate');
  console.log('POST /api/activity/track');
  console.log('GET  /api/activity/heatmap/:userId');
  console.log('GET  /api/battle/session?userId=...');
  console.log('POST /api/battle/queue/join');
  console.log('POST /api/battle/invite');
  console.log('POST /api/predictions/resolve');
  console.log('GET  /api/leaderboard');
  console.log('POST /api/users/sync');
  console.log('GET  /api/health');
});
