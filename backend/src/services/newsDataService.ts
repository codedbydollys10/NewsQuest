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

const lastSuccessfulResults = new Map<string, {
  articles: NewsArticle[];
  nextPage: string | null;
  totalResults: number;
  _cached: boolean;
}>();
let latestSuccessfulResult: {
  articles: NewsArticle[];
  nextPage: string | null;
  totalResults: number;
  _cached: boolean;
} | null = null;
const inFlightRequests = new Map<string, Promise<{
  articles: NewsArticle[];
  nextPage: string | null;
  totalResults: number;
  _cached: boolean;
}>>();

const loadPersistentCache = () => {
  try {
    if (!existsSync(CACHE_FILE)) return;
    const raw = readFileSync(CACHE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as {
      latest?: {
        articles: NewsArticle[];
        nextPage: string | null;
        totalResults: number;
        _cached: boolean;
      } | null;
      entries?: Array<[
        string,
        {
          articles: NewsArticle[];
          nextPage: string | null;
          totalResults: number;
          _cached: boolean;
        }
      ]>;
    };

    latestSuccessfulResult = parsed.latest ?? null;
    for (const [key, value] of parsed.entries ?? []) {
      lastSuccessfulResults.set(key, value);
    }
  } catch {
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
  } catch {
    // Ignore cache write failures; memory cache still works.
  }
};

loadPersistentCache();

export interface NewsDataQuery {
  q?: string;
  country?: string;
  language?: string;
  category?: string;
  page?: string;
}

export interface NewsArticle {
  id: string;
  headline: string;
  summary: string;
  fullContent: string;
  category: string;
  source: string;
  publishedAt: string;
  readTime: string;
  imageUrl: string | null;
  sourceUrl: string | null;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  xpReward: number;
  quiz: never[];
  prediction: null;
}

export class NewsDataError extends Error {
  statusCode: number;

  raw: unknown;

  constructor(message: string, statusCode = 500, raw: unknown = null) {
    super(message);
    this.name = 'NewsDataError';
    this.statusCode = statusCode;
    this.raw = raw;
  }
}

const buildCacheKey = (params: Record<string, string | number | boolean | undefined | null>) =>
  Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${value}`)
    .join('|');

const slugify = (title: string) => title
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)/g, '')
  .slice(0, 60);

const estimateReadTime = (text: string) => {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 200));
  return `${minutes} min`;
};

const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim();

const extractCompleteSentences = (text: string) => {
  const normalized = normalizeText(text);
  if (!normalized) return [];
  const complete = normalized.match(/[^.!?]+[.!?]+/g)?.map((entry) => normalizeText(entry)).filter(Boolean) ?? [];
  if (complete.length > 0) return complete;
  return [normalized];
};

const dedupeSentences = (text: string) => {
  const sentences = extractCompleteSentences(text);
  if (sentences.length === 0) return '';
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const sentence of sentences) {
    const key = normalizeText(sentence).toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(normalizeText(sentence));
  }
  return unique.join(' ');
};
const mergeSourcesWithoutDuplicates = (primary: string, fallbackSources: string[]) => {
  const uniqueSources = Array.from(new Set(
    [primary, ...fallbackSources]
      .map((value) => normalizeText(value))
      .filter(Boolean),
  ));

  if (uniqueSources.length === 0) return '';

  return dedupeSentences(uniqueSources.join(' '));
};

const isPaywalledContent = (content: string) =>
  /only available in paid plans/i.test(content) ||
  /available in paid plans/i.test(content) ||
  /subscriber only/i.test(content);

const buildReadableContent = (title: string, description: string, content?: string) => {
  const cleanDescription = description.trim();
  const cleanContent = content?.trim();
  const sourceText = cleanContent && !isPaywalledContent(cleanContent) ? cleanContent : '';
  const merged = [cleanDescription, sourceText]
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .join('\n\n');
  const mergedWithoutRepeats = dedupeSentences(merged);
  return mergeSourcesWithoutDuplicates(
    mergedWithoutRepeats || normalizeText(title),
    [sourceText, cleanDescription, title],
  );
};

const buildExpandedSummary = (title: string, description: string, content?: string) => {
  const cleanDescription = description.trim();
  const cleanContent = content?.trim();
  const base = normalizeText(cleanDescription || cleanContent || title);
  return mergeSourcesWithoutDuplicates(
    base,
    [cleanDescription, cleanContent ?? '', title],
  );
};

const normaliseCategory = (rawCategory: unknown) => {
  if (!rawCategory) return 'General';

  const values = (Array.isArray(rawCategory) ? rawCategory : [rawCategory])
    .map((entry) => String(entry ?? '').toLowerCase().trim())
    .filter(Boolean);
  const value = values[0] ?? '';

  const map: Record<string, string> = {
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

const inferDifficulty = (article: { content?: string | null }) => {
  const wordCount = (article.content ?? '').split(/\s+/).filter(Boolean).length;
  if (wordCount > 500) return 'Hard';
  if (wordCount > 200) return 'Medium';
  return 'Easy';
};

const inferXP = (article: { content?: string | null }) => {
  const map: Record<'Easy' | 'Medium' | 'Hard', number> = {
    Easy: 15,
    Medium: 20,
    Hard: 25,
  };

  return map[inferDifficulty(article)];
};

const transformArticles = (rawArticles: Array<Record<string, unknown>>): NewsArticle[] =>
  rawArticles
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

const fetchFromNewsData = async (params: NewsDataQuery) => {
  const apiKey = process.env.NEWSDATA_API_KEY?.trim();
  if (!apiKey) {
    throw new NewsDataError('NEWSDATA_API_KEY is not configured', 500);
  }

  const cleanParams = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );

  const cacheKey = buildCacheKey(cleanParams);
  const cached = cache.get<{
    articles: NewsArticle[];
    nextPage: string | null;
    totalResults: number;
    _cached: boolean;
  }>(cacheKey);

  if (cached) {
    return { ...cached, _cached: true };
  }

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

    const response = await fetch(url.toString());
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      if (response.status === 429) {
        const fallback = lastSuccessfulResults.get(cacheKey)
          ?? latestSuccessfulResult
          ?? cache.get<{
            articles: NewsArticle[];
            nextPage: string | null;
            totalResults: number;
            _cached: boolean;
          }>(cacheKey);

        if (fallback) {
          return { ...fallback, _cached: true };
        }
      }

      throw new NewsDataError(`NewsData API responded with ${response.status}`, response.status, body);
    }

    const data = await response.json() as {
      status?: string;
      results?: Array<Record<string, unknown>>;
      nextPage?: string | null;
      totalResults?: number;
      message?: string;
    };

    if (data.status !== 'success') {
      throw new NewsDataError(data.message ?? 'NewsData API returned a non-success status', 422, data);
    }

    const result = {
      articles: transformArticles(data.results ?? []),
      nextPage: data.nextPage ?? null,
      totalResults: data.totalResults ?? 0,
      _cached: false,
    };

    cache.set(cacheKey, result);
    lastSuccessfulResults.set(cacheKey, result);
    latestSuccessfulResult = result;
    savePersistentCache();
    return result;
  })();

  inFlightRequests.set(cacheKey, request);

  try {
    return await request;
  } finally {
    inFlightRequests.delete(cacheKey);
  }
};

export const getLatestNews = (options: NewsDataQuery = {}) => fetchFromNewsData(options);

export const searchNews = (query: string, options: Omit<NewsDataQuery, 'q'> = {}) => {
  if (!query.trim()) {
    throw new NewsDataError('Search query cannot be empty', 400);
  }

  return fetchFromNewsData({ q: query.trim(), ...options });
};

export const getNewsByCategory = (category: string, options: Omit<NewsDataQuery, 'category'> = {}) => {
  const valid = ['business', 'entertainment', 'environment', 'food', 'health', 'politics', 'science', 'sports', 'technology', 'top', 'world'];
  if (!valid.includes(category.toLowerCase())) {
    throw new NewsDataError(`Invalid category '${category}'. Valid: ${valid.join(', ')}`, 400);
  }

  return fetchFromNewsData({ category: category.toLowerCase(), ...options });
};

export const getCacheStats = () => cache.getStats();

export const flushCache = () => cache.flushAll();
