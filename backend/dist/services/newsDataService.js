import NodeCache from 'node-cache';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const BASE_URL = 'https://newsdata.io/api/1/latest';
const cache = new NodeCache({
    stdTTL: Number.parseInt(process.env.CACHE_TTL ?? '300', 10),
    checkperiod: 60,
    useClones: false,
});
const CACHE_FILE = path.resolve(process.cwd(), '.cache', 'news-data-cache.json');
const lastSuccessfulResults = new Map();
let latestSuccessfulResult = null;
const inFlightRequests = new Map();
const loadPersistentCache = () => {
    try {
        if (!existsSync(CACHE_FILE))
            return;
        const raw = readFileSync(CACHE_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        latestSuccessfulResult = parsed.latest ?? null;
        for (const [key, value] of parsed.entries ?? []) {
            lastSuccessfulResults.set(key, value);
        }
    }
    catch {
        // Ignore cache load failures and fall back to live fetches.
    }
};
const savePersistentCache = () => {
    try {
        mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
        writeFileSync(CACHE_FILE, JSON.stringify({
            latest: latestSuccessfulResult,
            entries: Array.from(lastSuccessfulResults.entries()),
        }, null, 2));
    }
    catch {
        // Ignore cache write failures; memory cache still works.
    }
};
loadPersistentCache();
export class NewsDataError extends Error {
    statusCode;
    raw;
    constructor(message, statusCode = 500, raw = null) {
        super(message);
        this.name = 'NewsDataError';
        this.statusCode = statusCode;
        this.raw = raw;
    }
}
const buildCacheKey = (params) => Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${value}`)
    .join('|');
const slugify = (title) => title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
const estimateReadTime = (text) => {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    const minutes = Math.max(1, Math.round(words / 200));
    return `${minutes} min`;
};
const normalizeText = (value) => value.replace(/\s+/g, ' ').trim();
const extractCompleteSentences = (text) => {
    const normalized = normalizeText(text);
    if (!normalized)
        return [];
    const complete = normalized.match(/[^.!?]+[.!?]+/g)?.map((entry) => normalizeText(entry)).filter(Boolean) ?? [];
    if (complete.length > 0)
        return complete;
    return [normalized];
};
const dedupeSentences = (text) => {
    const sentences = extractCompleteSentences(text);
    if (sentences.length === 0)
        return '';
    const seen = new Set();
    const unique = [];
    for (const sentence of sentences) {
        const key = normalizeText(sentence).toLowerCase();
        if (!key || seen.has(key))
            continue;
        seen.add(key);
        unique.push(normalizeText(sentence));
    }
    return unique.join(' ');
};
const mergeSourcesWithoutDuplicates = (primary, fallbackSources) => {
    const uniqueSources = Array.from(new Set([primary, ...fallbackSources]
        .map((value) => normalizeText(value))
        .filter(Boolean)));
    if (uniqueSources.length === 0)
        return '';
    return dedupeSentences(uniqueSources.join(' '));
};
const isPaywalledContent = (content) => /only available in paid plans/i.test(content) ||
    /available in paid plans/i.test(content) ||
    /subscriber only/i.test(content);
const buildReadableContent = (title, description, content) => {
    const cleanDescription = description.trim();
    const cleanContent = content?.trim();
    const sourceText = cleanContent && !isPaywalledContent(cleanContent) ? cleanContent : '';
    const merged = [cleanDescription, sourceText]
        .map((value) => normalizeText(value))
        .filter(Boolean)
        .join('\n\n');
    const mergedWithoutRepeats = dedupeSentences(merged);
    return mergeSourcesWithoutDuplicates(mergedWithoutRepeats || normalizeText(title), [sourceText, cleanDescription, title]);
};
const buildExpandedSummary = (title, description, content) => {
    const cleanDescription = description.trim();
    const cleanContent = content?.trim();
    const base = normalizeText(cleanDescription || cleanContent || title);
    return mergeSourcesWithoutDuplicates(base, [cleanDescription, cleanContent ?? '', title]);
};
const normaliseCategory = (rawCategory) => {
    if (!rawCategory)
        return 'General';
    const values = (Array.isArray(rawCategory) ? rawCategory : [rawCategory])
        .map((entry) => String(entry ?? '').toLowerCase().trim())
        .filter(Boolean);
    const value = values[0] ?? '';
    const map = {
        technology: 'Technology',
        tech: 'Technology',
        science: 'Science',
        climate: 'Environment',
        business: 'Economy',
        economy: 'Economy',
        finance: 'Economy',
        entertainment: 'Culture',
        sports: 'Sports',
        health: 'Science',
        politics: 'Polity',
        polity: 'Polity',
        government: 'Polity',
        environment: 'Environment',
        ecological: 'Environment',
        world: 'World',
        top: 'General',
    };
    for (const entry of values) {
        const mapped = map[entry];
        if (mapped && mapped !== 'General') {
            return mapped;
        }
    }
    return map[value] ?? 'General';
};
const inferDifficulty = (article) => {
    const wordCount = (article.content ?? '').split(/\s+/).filter(Boolean).length;
    if (wordCount > 500)
        return 'Hard';
    if (wordCount > 200)
        return 'Medium';
    return 'Easy';
};
const inferXP = (article) => {
    const map = {
        Easy: 15,
        Medium: 20,
        Hard: 25,
    };
    return map[inferDifficulty(article)];
};
const transformArticles = (rawArticles) => rawArticles
    .filter((article) => article.title && article.description)
    .map((article) => {
    const content = typeof article.content === 'string' ? article.content : undefined;
    const description = typeof article.description === 'string' ? article.description : '';
    const title = typeof article.title === 'string' ? article.title : 'Untitled';
    const readableContent = buildReadableContent(title, description, content);
    const expandedSummary = buildExpandedSummary(title, description, content);
    return {
        id: typeof article.article_id === 'string' ? article.article_id : slugify(title),
        headline: title,
        summary: expandedSummary,
        fullContent: readableContent,
        category: normaliseCategory(article.category),
        source: typeof article.source_id === 'string'
            ? article.source_id
            : typeof article.source_name === 'string'
                ? article.source_name
                : 'Unknown',
        publishedAt: typeof article.pubDate === 'string' ? article.pubDate : new Date().toISOString(),
        readTime: estimateReadTime(readableContent),
        imageUrl: typeof article.image_url === 'string' ? article.image_url : null,
        sourceUrl: typeof article.link === 'string' ? article.link : null,
        difficulty: inferDifficulty(article),
        xpReward: inferXP(article),
        quiz: [],
        prediction: null,
    };
});
const generateMockArticles = (count) => {
    const mockHeadlines = [
        'Major Tech Breakthrough: New AI Model Shows Promise',
        'Climate Conference Reaches Historic Agreement',
        'Global Markets Rally on Economic Data',
        'Political Leaders Meet for Trade Negotiations',
        'Athletic Records Broken at International Championship',
        'Scientific Discovery Could Revolutionize Medicine',
        'Environmental Crisis Demands Urgent Action',
        'Business Merger Creates Industry Giant',
        'International Cooperation Addresses Global Challenge',
        'Youth Environmental Movement Gains Momentum',
    ];
    const mockSummaries = [
        'Researchers announce a groundbreaking discovery that could transform the industry and impact millions worldwide.',
        'Economic indicators suggest strong growth despite challenging market conditions in several regions.',
        'Nations unite to address pressing issues and work toward sustainable solutions for future generations.',
        'Industry experts predict significant changes ahead as new technologies reshape the landscape.',
        'Community leaders celebrate progress on initiatives aimed at improving quality of life.',
    ];
    const mockContent = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.';
    const categories = ['Technology', 'Environment', 'Economy', 'Polity', 'Sports', 'Science'];
    const articles = [];
    for (let i = 0; i < Math.min(count, mockHeadlines.length); i++) {
        articles.push({
            id: `mock_${Date.now()}_${i}`,
            headline: mockHeadlines[i],
            summary: mockSummaries[i % mockSummaries.length],
            fullContent: mockContent,
            category: categories[i % categories.length],
            source: 'NewsQuest',
            publishedAt: new Date(Date.now() - i * 3600000).toISOString(),
            readTime: '3 min',
            imageUrl: null,
            sourceUrl: null,
            difficulty: ['Easy', 'Medium', 'Hard'][i % 3],
            xpReward: [15, 20, 25][i % 3],
            quiz: [],
            prediction: null,
        });
    }
    return articles;
};
const fetchFromNewsData = async (params) => {
    const apiKey = process.env.NEWSDATA_API_KEY?.trim();
    if (!apiKey) {
        throw new NewsDataError('NEWSDATA_API_KEY is not configured', 500);
    }
    const cleanParams = Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''));
    const cacheKey = buildCacheKey(cleanParams);
    // Check for in-flight requests to avoid duplicate API calls
    const inFlight = inFlightRequests.get(cacheKey);
    if (inFlight) {
        return inFlight;
    }
    const request = (async () => {
        const url = new URL(BASE_URL);
        url.searchParams.set('apikey', apiKey);
        url.searchParams.set('removeduplicate', '1');
        for (const [key, value] of Object.entries(cleanParams)) {
            url.searchParams.set(key, String(value));
        }
        // Retry logic for 429 errors
        let lastError = null;
        const maxRetries = 6;
        const baseDelay = 2000; // 2 seconds
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const response = await fetch(url.toString());
                if (response.status === 429) {
                    // Rate limited - wait and retry
                    if (attempt < maxRetries - 1) {
                        const delay = baseDelay * Math.pow(2, attempt); // Exponential backoff: 2s, 4s, 8s, 16s, 32s
                        console.log(`⏳ API rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    }
                    throw new NewsDataError('API rate limit exceeded after all retries', 429);
                }
                if (!response.ok) {
                    const body = await response.text().catch(() => '');
                    throw new NewsDataError(`NewsData API responded with ${response.status}`, response.status, body);
                }
                const data = await response.json();
                if (data.status !== 'success') {
                    throw new NewsDataError(data.message ?? 'NewsData API returned a non-success status', 422, data);
                }
                const result = {
                    articles: transformArticles(data.results ?? []),
                    nextPage: data.nextPage ?? null,
                    totalResults: data.totalResults ?? 0,
                    _cached: false,
                };
                // Store in cache for fallback only
                cache.set(cacheKey, result);
                lastSuccessfulResults.set(cacheKey, result);
                latestSuccessfulResult = result;
                savePersistentCache();
                return result;
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                // Don't retry on non-rate-limit errors
                if (!(error instanceof NewsDataError && error.statusCode === 429)) {
                    throw lastError;
                }
            }
        }
        // All retries exhausted - throw the last error
        throw lastError || new NewsDataError('Failed to fetch from NewsData API', 500);
    })();
    inFlightRequests.set(cacheKey, request);
    try {
        return await request;
    }
    finally {
        inFlightRequests.delete(cacheKey);
    }
};
export const getLatestNews = (options = {}) => fetchFromNewsData(options);
export const searchNews = (query, options = {}) => {
    if (!query.trim()) {
        throw new NewsDataError('Search query cannot be empty', 400);
    }
    return fetchFromNewsData({ q: query.trim(), ...options });
};
export const getNewsByCategory = (category, options = {}) => {
    const valid = ['business', 'entertainment', 'environment', 'food', 'health', 'politics', 'science', 'sports', 'technology', 'top', 'world'];
    if (!valid.includes(category.toLowerCase())) {
        throw new NewsDataError(`Invalid category '${category}'. Valid: ${valid.join(', ')}`, 400);
    }
    return fetchFromNewsData({ category: category.toLowerCase(), ...options });
};
export const getCacheStats = () => cache.getStats();
export const flushCache = () => cache.flushAll();
