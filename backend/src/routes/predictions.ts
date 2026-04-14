import { Router } from 'express';
import { searchNews } from '../services/newsDataService.js';
import { extractBytezText, getBytezModel, hasBytezKey } from '../lib/bytez.js';

const router = Router();

type ResolveBody = {
  headline?: unknown;
  summary?: unknown;
  question?: unknown;
  options?: unknown;
  category?: unknown;
  country?: unknown;
  language?: unknown;
};

const stopWords = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'have', 'will', 'were', 'been', 'about',
  'what', 'when', 'where', 'which', 'into', 'over', 'after', 'before', 'more', 'most', 'only',
  'just', 'they', 'them', 'their', 'there', 'could', 'would', 'should', 'also', 'than', 'then',
  'news', 'report', 'reported', 'likely', 'option', 'choice',
]);

const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();

const tokenize = (value: string) =>
  normalize(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3 && !stopWords.has(word));

const parseBody = (body: ResolveBody) => {
  const headline = typeof body.headline === 'string' ? normalize(body.headline) : '';
  const summary = typeof body.summary === 'string' ? normalize(body.summary) : '';
  const question = typeof body.question === 'string' ? normalize(body.question) : '';
  const category = typeof body.category === 'string' ? normalize(body.category) : '';
  const country = typeof body.country === 'string' ? normalize(body.country).toLowerCase() : undefined;
  const language = typeof body.language === 'string' ? normalize(body.language).toLowerCase() : undefined;
  const options = Array.isArray(body.options)
    ? body.options
      .map((entry) => (typeof entry === 'string' ? normalize(entry) : ''))
      .filter(Boolean)
      .slice(0, 4)
    : [];

  if (!headline || !question || options.length < 2) {
    return null;
  }

  return { headline, summary, question, options, category, country, language };
};

const buildQuery = (headline: string, summary: string, category: string) => {
  const terms = [...tokenize(headline), ...tokenize(summary), ...tokenize(category)];
  const unique = Array.from(new Set(terms)).slice(0, 8);
  return unique.join(' ') || headline;
};

const scoreOptionsAgainstContext = (options: string[], context: string) => {
  const contextTokens = tokenize(context);
  const contextCounts = new Map<string, number>();
  for (const token of contextTokens) {
    contextCounts.set(token, (contextCounts.get(token) ?? 0) + 1);
  }

  let bestIndex = 0;
  let bestScore = Number.NEGATIVE_INFINITY;
  const scores: number[] = [];

  options.forEach((option, index) => {
    const optionTokens = tokenize(option);
    const overlapScore = optionTokens.reduce((sum, token) => sum + (contextCounts.get(token) ?? 0), 0);
    const uniquenessBonus = new Set(optionTokens).size * 0.15;
    const score = overlapScore + uniquenessBonus;
    scores.push(score);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return { bestIndex, scores };
};

const scoresToProbabilities = (scores: number[]) => {
  if (!scores.length) return [];
  const shifted = scores.map((score) => Math.max(0, score) + 0.5);
  const sum = shifted.reduce((acc, value) => acc + value, 0);
  if (!sum) {
    const equal = Math.floor(100 / scores.length);
    return scores.map((_, index) => (index === scores.length - 1 ? 100 - equal * (scores.length - 1) : equal));
  }

  const raw = shifted.map((value) => (value / sum) * 100);
  const rounded = raw.map((value) => Math.round(value));
  const diff = 100 - rounded.reduce((acc, value) => acc + value, 0);
  if (diff !== 0) {
    const bestIndex = raw
      .map((value, index) => ({ value, index }))
      .sort((a, b) => b.value - a.value)[0]?.index ?? 0;
    rounded[bestIndex] += diff;
  }
  return rounded;
};

const tryBytezResolution = async (input: {
  question: string;
  options: string[];
  context: string;
}) => {
  if (!hasBytezKey()) return null;

  const model = getBytezModel();
  const prompt = `
Pick the single best option index for this prediction based on latest context.
Return JSON only:
{"resolvedIndex":0,"reason":"short reason","probabilities":[55,25,20]}

Question: ${input.question}
Options:
${input.options.map((option, idx) => `${idx}. ${option}`).join('\n')}
Latest context:
${input.context.slice(0, 3500)}
`;

  const { error, output } = await model.run([
    { role: 'system', content: 'You are a strict JSON responder.' },
    { role: 'user', content: prompt },
  ]);

  if (error) return null;
  const text = extractBytezText(output);
  if (!text) return null;

  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    const payload = JSON.parse(start >= 0 && end >= start ? text.slice(start, end + 1) : text) as {
      resolvedIndex?: number;
      reason?: string;
      probabilities?: number[];
    };
    if (!Number.isInteger(payload.resolvedIndex)) return null;
    if (payload.resolvedIndex! < 0 || payload.resolvedIndex! >= input.options.length) return null;

    const safeProbabilities = Array.isArray(payload.probabilities) && payload.probabilities.length === input.options.length
      ? payload.probabilities.map((value) => (typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0))
      : null;

    const probabilities = safeProbabilities
      ? (() => {
        const sum = safeProbabilities.reduce((acc, value) => acc + value, 0);
        if (!sum) return scoresToProbabilities(new Array(input.options.length).fill(1));
        const normalized = safeProbabilities.map((value) => Math.round((value / sum) * 100));
        const diff = 100 - normalized.reduce((acc, value) => acc + value, 0);
        normalized[payload.resolvedIndex!] += diff;
        return normalized;
      })()
      : scoresToProbabilities(new Array(input.options.length).fill(1));

    return {
      resolvedIndex: payload.resolvedIndex!,
      reason: typeof payload.reason === 'string' ? payload.reason.trim() : 'Resolved from latest reporting context.',
      probabilities,
    };
  } catch {
    return null;
  }
};

router.post('/resolve', async (req, res, next) => {
  try {
    const parsed = parseBody(req.body as ResolveBody);
    if (!parsed) {
      return res.status(400).json({
        success: false,
        error: 'headline, question and at least 2 options are required.',
      });
    }

    const q = buildQuery(parsed.headline, parsed.summary, parsed.category);
    const latest = await searchNews(q, {
      country: parsed.country || 'in',
      language: parsed.language || 'en',
    });

    const context = latest.articles
      .slice(0, 5)
      .map((article) => `${article.headline}. ${article.summary}`)
      .join('\n\n');

    const aiPick = await tryBytezResolution({
      question: parsed.question,
      options: parsed.options,
      context,
    });

    const fallback = scoreOptionsAgainstContext(parsed.options, context || `${parsed.headline} ${parsed.summary}`);
    const resolvedIndex = aiPick?.resolvedIndex ?? fallback.bestIndex;
    const probabilities = aiPick?.probabilities ?? scoresToProbabilities(fallback.scores);
    const reason = aiPick?.reason ?? 'Resolved by matching prediction options with latest related article context.';

    return res.json({
      success: true,
      resolvedIndex,
      resolvedOption: parsed.options[resolvedIndex],
      probabilities,
      reason,
      resolvedAt: new Date().toISOString(),
      sourceCount: latest.articles.length,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
