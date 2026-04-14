import { Router } from 'express';

import { buildFastArticleContent, generateArticleContent, type GeneratedArticleContent, type NewsArticleInput } from '../lib/articleAi.js';
import { getLatestNews, getNewsByCategory, searchNews } from '../services/newsDataService.js';

const router = Router();

const extractCommonParams = (query: Record<string, unknown>) => {
  const country = typeof query.country === 'string' ? query.country.trim().toLowerCase() : undefined;
  const language = typeof query.language === 'string' ? query.language.trim().toLowerCase() : undefined;
  const rawPage = typeof query.page === 'string' ? query.page.trim() : undefined;
  const page = rawPage && !/^\d+$/.test(rawPage) ? rawPage : undefined;

  return { country, language, page };
};

const toFrontendContent = (content: GeneratedArticleContent) => ({
  quiz: content.quiz.map((item, index) => ({
    id: `q${index + 1}`,
    question: item.question,
    options: item.options,
    correct: item.correctIndex,
    explanation: item.explanation,
  })),
  prediction: {
    id: 'p1',
    question: content.prediction.question,
    options: content.prediction.options,
    resolvedAnswer: content.prediction.correctIndex,
    deadline: content.prediction.deadline,
    xpReward: content.prediction.xpReward,
  },
});

const buildNewsArticleInput = (article: {
  headline: string;
  summary: string;
  fullContent: string;
  category: string;
  source: string;
  publishedAt: string;
}): NewsArticleInput => ({
  headline: article.headline,
  summary: article.summary,
  fullContent:
    !article.fullContent ||
    article.fullContent.toUpperCase().includes('ONLY AVAILABLE IN PAID PLANS')
      ? article.summary
      : article.fullContent,
  category: article.category,
  source: article.source,
  publishedAt: article.publishedAt,
});

const parseCount = (value: unknown) => {
  if (typeof value !== 'string') return 1;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) return 1;
  return Math.min(parsed, 30);
};

const parseMode = (value: unknown) => {
  if (typeof value !== 'string') return 'ai' as const;
  return value.toLowerCase() === 'fast' ? 'fast' as const : 'ai' as const;
};

const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error('timeout')), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  });
};

const enrichArticle = async (article: {
  headline: string;
  summary: string;
  fullContent: string;
  category: string;
  source: string;
  publishedAt: string;
}, mode: 'fast' | 'ai' = 'fast') => {
  const input = buildNewsArticleInput(article);
  const generated = mode === 'ai' ? await generateArticleContent(input) : buildFastArticleContent(input);
  return {
    article: {
      ...article,
      headline: generated.headline,
      summary: generated.summary,
    },
    content: toFrontendContent(generated),
  };
};

router.get('/', async (req, res, next) => {
  try {
    const { q, category } = req.query;
    const common = extractCommonParams(req.query as Record<string, unknown>);
    const data = await getLatestNews({
      q: typeof q === 'string' ? q.trim() || undefined : undefined,
      category: typeof category === 'string' ? category.trim().toLowerCase() || undefined : undefined,
      ...common,
    });

    res.json({ success: true, ...data });
  } catch (error) {
    next(error);
  }
});

router.get('/search', async (req, res, next) => {
  try {
    const { q } = req.query;
    if (typeof q !== 'string' || !q.trim()) {
      return res.status(400).json({ success: false, error: 'Query parameter "q" is required' });
    }

    const data = await searchNews(q.trim(), extractCommonParams(req.query as Record<string, unknown>));
    res.json({ success: true, ...data });
  } catch (error) {
    next(error);
  }
});

router.get('/category/:type', async (req, res, next) => {
  try {
    const data = await getNewsByCategory(req.params.type, extractCommonParams(req.query as Record<string, unknown>));
    res.json({ success: true, ...data });
  } catch (error) {
    next(error);
  }
});

router.get('/featured', async (req, res, next) => {
  try {
    const { q, category } = req.query;
    const mode = typeof req.query.mode === 'string' && req.query.mode.toLowerCase() === 'ai' ? 'ai' : 'fast';
    const common = extractCommonParams(req.query as Record<string, unknown>);
    const data = await getLatestNews({
      q: typeof q === 'string' ? q.trim() || undefined : undefined,
      category: typeof category === 'string' ? category.trim().toLowerCase() || undefined : undefined,
      ...common,
    });

    const article = data.articles[0];
    if (!article) {
      return res.status(404).json({ success: false, error: 'No articles found' });
    }

    res.json({
      success: true,
      ...(await enrichArticle(article, mode)),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/enriched', async (req, res, next) => {
  try {
    const count = parseCount(req.query.count);
    const mode = typeof req.query.mode === 'string' && req.query.mode.toLowerCase() === 'ai' ? 'ai' : 'fast';
    const { q, category } = req.query;
    const common = extractCommonParams(req.query as Record<string, unknown>);
    const data = await getLatestNews({
      q: typeof q === 'string' ? q.trim() || undefined : undefined,
      category: typeof category === 'string' ? category.trim().toLowerCase() || undefined : undefined,
      ...common,
    });

    const articles = data.articles.slice(0, count);
    if (!articles.length) {
      return res.status(404).json({ success: false, error: 'No articles found' });
    }

    const enriched = await Promise.all(articles.map((article) => enrichArticle(article, mode)));
    res.json({
      success: true,
      count: enriched.length,
      articles: enriched,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/generate', async (req, res, next) => {
  try {
    const requiredFields = ['headline', 'summary', 'fullContent', 'category', 'source', 'publishedAt'] as const;
    const missing = requiredFields.filter((field) => typeof req.body?.[field] !== 'string' || !req.body[field].trim());

    if (missing.length) {
      return res.status(400).json({ success: false, error: `Missing fields: ${missing.join(', ')}` });
    }

    const mode = parseMode(req.query.mode ?? req.body?.mode);
    const input = buildNewsArticleInput(req.body);
    const generated = mode === 'fast'
      ? buildFastArticleContent(input)
      : await withTimeout(generateArticleContent(input), 2500).catch(() => buildFastArticleContent(input));

    res.json({
      success: true,
      ...toFrontendContent(generated),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
