import { Router } from 'express';
import { buildFastArticleContent, generateArticleContent } from '../lib/articleAi.js';
import { getLatestNews, getNewsByCategory, searchNews } from '../services/newsDataService.js';
const router = Router();
const extractCommonParams = (query) => {
    const country = typeof query.country === 'string' ? query.country.trim().toLowerCase() : undefined;
    const language = typeof query.language === 'string' ? query.language.trim().toLowerCase() : undefined;
    const rawPage = typeof query.page === 'string' ? query.page.trim() : undefined;
    const page = rawPage && !/^\d+$/.test(rawPage) ? rawPage : undefined;
    return { country, language, page };
};
const toFrontendContent = (content) => ({
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
const buildNewsArticleInput = (article) => ({
    headline: article.headline,
    summary: article.summary,
    fullContent: !article.fullContent ||
        article.fullContent.toUpperCase().includes('ONLY AVAILABLE IN PAID PLANS')
        ? article.summary
        : article.fullContent,
    category: article.category,
    source: article.source,
    publishedAt: article.publishedAt,
});
const parseCount = (value) => {
    if (typeof value !== 'string')
        return 1;
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed < 1)
        return 1;
    return Math.min(parsed, 30);
};
const parseMode = (value) => {
    if (typeof value !== 'string')
        return 'ai';
    return value.toLowerCase() === 'fast' ? 'fast' : 'ai';
};
const withTimeout = (promise, timeoutMs) => {
    let timeoutHandle;
    const timeout = new Promise((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error('timeout')), timeoutMs);
    });
    return Promise.race([promise, timeout]).finally(() => {
        if (timeoutHandle)
            clearTimeout(timeoutHandle);
    });
};
const enrichArticle = async (article, mode = 'fast') => {
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
        const common = extractCommonParams(req.query);
        const data = await getLatestNews({
            q: typeof q === 'string' ? q.trim() || undefined : undefined,
            category: typeof category === 'string' ? category.trim().toLowerCase() || undefined : undefined,
            language: common.language || 'en',
            country: common.country,
            page: common.page,
        });
        res.json({ success: true, ...data });
    }
    catch (error) {
        const isApiKeyError = error instanceof Error && error.message.includes('NEWSDATA_API_KEY');
        if (isApiKeyError) {
            console.error('❌ NEWS API ERROR: NEWSDATA_API_KEY is not configured. Set it in .env file or environment variables.');
        }
        else {
            console.error('❌ NEWS API ERROR:', error instanceof Error ? error.message : String(error));
        }
        // On error, return empty success response instead of error
        res.json({
            success: true,
            articles: [],
            nextPage: null,
            totalResults: 0,
            _cached: true,
            _fallback: true,
            _error: isApiKeyError ? 'NEWSDATA_API_KEY not configured' : 'API error',
        });
    }
});
router.get('/search', async (req, res, next) => {
    try {
        const { q } = req.query;
        if (typeof q !== 'string' || !q.trim()) {
            return res.status(400).json({ success: false, error: 'Query parameter "q" is required' });
        }
        const common = extractCommonParams(req.query);
        const data = await searchNews(q.trim(), {
            language: common.language || 'en',
            country: common.country,
            page: common.page,
        });
        res.json({ success: true, ...data });
    }
    catch (error) {
        // On error, return empty success response
        res.json({
            success: true,
            articles: [],
            nextPage: null,
            totalResults: 0,
            _cached: true,
            _fallback: true,
        });
    }
});
router.get('/category/:type', async (req, res, next) => {
    try {
        const common = extractCommonParams(req.query);
        const data = await getNewsByCategory(req.params.type, {
            language: common.language || 'en',
            country: common.country,
            page: common.page,
        });
        res.json({ success: true, ...data });
    }
    catch (error) {
        // On error, return empty success response
        res.json({
            success: true,
            articles: [],
            nextPage: null,
            totalResults: 0,
            _cached: true,
            _fallback: true,
        });
    }
});
router.get('/featured', async (req, res) => {
    try {
        const { q, category } = req.query;
        const mode = typeof req.query.mode === 'string' && req.query.mode.toLowerCase() === 'ai' ? 'ai' : 'fast';
        const common = extractCommonParams(req.query);
        const data = await getLatestNews({
            q: typeof q === 'string' ? q.trim() || undefined : undefined,
            category: typeof category === 'string' ? category.trim().toLowerCase() || undefined : undefined,
            ...common,
        });
        const article = data.articles[0];
        if (!article) {
            // Return empty fallback instead of 404
            return res.json({
                success: true,
                article: {
                    id: 'fallback_featured',
                    headline: 'Featured Story Unavailable',
                    summary: 'News content is currently unavailable. Please try again later.',
                    category: 'General',
                    difficulty: 'Easy',
                    xpReward: 15,
                    readTime: '2 min',
                    source: 'System',
                    publishedAt: new Date().toISOString(),
                    fullContent: 'Featured story not available at this time.',
                },
                content: {
                    quiz: [],
                    prediction: {
                        id: 'p1',
                        question: 'Check back soon for more content!',
                        options: [],
                        deadline: new Date(Date.now() + 86400000).toISOString(),
                        xpReward: 0,
                    },
                },
            });
        }
        const enriched = await enrichArticle(article, mode);
        res.json({
            success: true,
            ...enriched,
        });
    }
    catch (error) {
        // On error, return empty fallback
        res.json({
            success: true,
            article: {
                id: 'fallback_featured',
                headline: 'Featured Story Unavailable',
                summary: 'News content is currently unavailable. Please try again later.',
                category: 'General',
                difficulty: 'Easy',
                xpReward: 15,
                readTime: '2 min',
                source: 'System',
                publishedAt: new Date().toISOString(),
                fullContent: 'Featured story not available at this time.',
            },
            content: {
                quiz: [],
                prediction: {
                    id: 'p1',
                    question: 'Check back soon for more content!',
                    options: [],
                    deadline: new Date(Date.now() + 86400000).toISOString(),
                    xpReward: 0,
                },
            },
        });
    }
});
router.get('/enriched', async (req, res) => {
    try {
        const count = parseCount(req.query.count);
        const mode = typeof req.query.mode === 'string' && req.query.mode.toLowerCase() === 'ai' ? 'ai' : 'fast';
        const { q, category } = req.query;
        const common = extractCommonParams(req.query);
        const data = await getLatestNews({
            q: typeof q === 'string' ? q.trim() || undefined : undefined,
            category: typeof category === 'string' ? category.trim().toLowerCase() || undefined : undefined,
            language: common.language || 'en',
            country: common.country,
            page: common.page,
        });
        const articles = data.articles.slice(0, count);
        if (!articles.length) {
            // Return empty array instead of 404
            return res.json({
                success: true,
                count: 0,
                articles: [],
            });
        }
        const enriched = await Promise.all(articles.map((article) => enrichArticle(article, mode)));
        res.json({
            success: true,
            count: enriched.length,
            articles: enriched,
        });
    }
    catch (error) {
        // On error, return empty array instead of error
        res.json({
            success: true,
            count: 0,
            articles: [],
        });
    }
});
router.post('/generate', async (req, res, next) => {
    try {
        const requiredFields = ['headline', 'summary', 'fullContent', 'category', 'source', 'publishedAt'];
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
    }
    catch (error) {
        next(error);
    }
});
export default router;
