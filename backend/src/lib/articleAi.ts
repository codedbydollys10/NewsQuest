import { extractBytezText, getBytezModel, hasBytezKey } from './bytez.js';

export interface GeneratedQuizItem {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface GeneratedPredictionItem {
  question: string;
  options: string[];
  correctIndex: number;
  deadline: string;
  xpReward: number;
}

export interface GeneratedArticleContent {
  headline: string;
  summary: string;
  quiz: GeneratedQuizItem[];
  prediction: GeneratedPredictionItem;
}

export interface NewsArticleInput {
  headline: string;
  summary: string;
  fullContent: string;
  category: string;
  source: string;
  publishedAt: string;
}

const SUMMARY_WORD_TARGET = 200;

const extractKeyTerms = (text: string) => {
  const words = text
    .replace(/[^A-Za-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map(word => word.trim())
    .filter(word => word.length >= 4);

  const stopWords = new Set([
    'this', 'that', 'with', 'from', 'have', 'will', 'been', 'were', 'into', 'about', 'after', 'before', 'over',
    'news', 'more', 'some', 'than', 'when', 'what', 'where', 'which', 'their', 'there', 'they', 'them', 'this',
    'said', 'says', 'could', 'would', 'should', 'also', 'only', 'just', 'then', 'even', 'each', 'such', 'made',
    'make', 'most', 'very', 'been', 'have', 'has', 'had', 'its', 'for', 'the', 'and', 'are', 'was', 'that',
  ]);

  const terms = words
    .filter(word => !stopWords.has(word.toLowerCase()))
    .map(word => word.replace(/^-+|-+$/g, ''))
    .filter(Boolean);

  return Array.from(new Set(terms)).slice(0, 6);
};

const extractNumberClues = (text: string) =>
  Array.from(new Set((text.match(/\b\d+(?:\.\d+)?%?\b/g) ?? []).map((value) => value.trim()))).slice(0, 6);

const pickTopic = (article: NewsArticleInput) => {
  const sourceText = `${article.headline} ${article.summary} ${article.category}`.toLowerCase();
  if (sourceText.includes('ai') || sourceText.includes('artificial intelligence') || sourceText.includes('neural')) return 'AI';
  if (sourceText.includes('election') || sourceText.includes('vote') || sourceText.includes('parliament') || sourceText.includes('court')) return 'Politics';
  if (sourceText.includes('market') || sourceText.includes('stock') || sourceText.includes('economy') || sourceText.includes('trade')) return 'Economy';
  if (sourceText.includes('space') || sourceText.includes('mars') || sourceText.includes('nasa') || sourceText.includes('isro')) return 'Science';
  if (sourceText.includes('health') || sourceText.includes('medical') || sourceText.includes('hospital') || sourceText.includes('drug')) return 'Health';
  if (sourceText.includes('sport') || sourceText.includes('cricket') || sourceText.includes('football') || sourceText.includes('olympic')) return 'Sports';
  return article.category || 'General';
};

const futureDate = (daysAhead: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysAhead);
  return date.toISOString().slice(0, 10);
};

const seenQuestionTexts = new Set<string>();
const QUESTION_CACHE_LIMIT = 120;
const seenPredictionTexts = new Set<string>();
const PREDICTION_CACHE_LIMIT = 120;

const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim();

const toExactWordCount = (text: string, targetWords: number) => {
  const words = normalizeText(text).split(/\s+/).filter(Boolean);
  return words.slice(0, targetWords).join(' ');
};

const toExactWordCountFromSources = (primary: string, fallbackSources: string[], targetWords: number) => {
  const baseWords = normalizeText(primary).split(/\s+/).filter(Boolean);
  if (baseWords.length >= targetWords) {
    return baseWords.slice(0, targetWords).join(' ');
  }

  const fallbackWords = fallbackSources
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .join(' ')
    .split(/\s+/)
    .filter(Boolean);

  if (!fallbackWords.length) return baseWords.join(' ');

  const words = [...baseWords];
  let cursor = 0;
  while (words.length < targetWords) {
    words.push(fallbackWords[cursor % fallbackWords.length]);
    cursor += 1;
  }
  return words.slice(0, targetWords).join(' ');
};

const hashString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

const buildOptionSet = (correct: string, distractors: string[], seed: string) => {
  const deduped = Array.from(new Set(
    distractors
      .map((entry) => normalizeText(entry))
      .filter((entry) => entry.length > 0 && entry.toLowerCase() !== normalizeText(correct).toLowerCase()),
  ));

  while (deduped.length < 3) {
    deduped.push(`Alternative interpretation ${deduped.length + 1}`);
  }

  const options = [normalizeText(correct), ...deduped.slice(0, 3)];
  const rotation = hashString(seed) % options.length;
  const rotated = [...options.slice(rotation), ...options.slice(0, rotation)];
  return {
    options: rotated,
    correctIndex: rotated.findIndex((entry) => entry === normalizeText(correct)),
  };
};

const getQuestionKey = (question: string) => normalizeText(question).toLowerCase();

const reserveQuestionText = (question: string) => {
  const key = getQuestionKey(question);
  if (seenQuestionTexts.has(key)) return false;
  seenQuestionTexts.add(key);
  if (seenQuestionTexts.size > QUESTION_CACHE_LIMIT) {
    const oldest = seenQuestionTexts.values().next().value as string | undefined;
    if (oldest) seenQuestionTexts.delete(oldest);
  }
  return true;
};

const reservePredictionText = (question: string) => {
  const key = getQuestionKey(question);
  if (seenPredictionTexts.has(key)) return false;
  seenPredictionTexts.add(key);
  if (seenPredictionTexts.size > PREDICTION_CACHE_LIMIT) {
    const oldest = seenPredictionTexts.values().next().value as string | undefined;
    if (oldest) seenPredictionTexts.delete(oldest);
  }
  return true;
};

const buildContentPrediction = (article: NewsArticleInput): GeneratedPredictionItem => {
  const topic = pickTopic(article);
  const terms = extractKeyTerms(`${article.headline} ${article.summary} ${article.fullContent}`);
  const primary = terms[0] ?? topic;
  const secondary = terms[1] ?? primary;
  const tertiary = terms[2] ?? secondary;
  const seed = `${article.headline}|${article.summary}|${article.category}|prediction`;

  const templates = [
    `Which interpretation is best supported by this article's details on ${primary}?`,
    `Based on the report, what is the strongest evidence-backed takeaway about ${primary} and ${secondary}?`,
    `From the article content, which statement most closely matches the described ${topic.toLowerCase()} situation?`,
    `According to this article, what appears most consistent with the reported relationship between ${primary} and ${tertiary}?`,
  ];

  const baseQuestion = templates[hashString(seed) % templates.length];
  const question = reservePredictionText(baseQuestion) ? baseQuestion : `${baseQuestion} (${article.category || topic})`;
  const baseOptions = [
    `The report links ${primary} to a concrete shift involving ${secondary}`,
    `The article states ${primary} had no connection to ${secondary}`,
    `The update is framed as unrelated to ${topic.toLowerCase()} and purely historical`,
  ];
  const rotation = hashString(`${seed}|pred-options`) % baseOptions.length;
  const options = [...baseOptions.slice(rotation), ...baseOptions.slice(0, rotation)];
  const correctIndex = options.findIndex((entry) => entry === baseOptions[0]);

  return {
    question,
    options,
    correctIndex: correctIndex >= 0 ? correctIndex : 0,
    deadline: futureDate(30),
    xpReward: 25,
  };
};

const buildFastHeadline = (article: NewsArticleInput) => {
  const base = article.headline.replace(/\s+/g, ' ').trim();
  const topic = pickTopic(article);
  if (!base) return `${topic} update draws attention to key developments`;

  const trimmed = base.length > 90 ? `${base.slice(0, 87).trim()}...` : base;
  return `${topic}: ${trimmed}`;
};

const buildFastSummary = (article: NewsArticleInput) => {
  const headline = normalizeText(article.headline);
  const summary = normalizeText(article.summary);
  const content = normalizeText(article.fullContent);
  const source = normalizeText(article.source);
  const publishedAt = normalizeText(article.publishedAt);
  const baseSummary = [
    summary,
    content,
    `Source ${source}. Published ${publishedAt}.`,
    headline,
  ].filter(Boolean).join(' ');

  return toExactWordCountFromSources(
    baseSummary,
    [content, summary, headline, source, publishedAt],
    SUMMARY_WORD_TARGET,
  );
};

const buildQuizVariants = (article: NewsArticleInput) => {
  const topic = pickTopic(article);
  const terms = extractKeyTerms(`${article.headline} ${article.summary} ${article.fullContent}`);
  const numbers = extractNumberClues(`${article.headline} ${article.summary} ${article.fullContent}`);
  const first = terms[0] ?? topic;
  const second = terms[1] ?? first;
  const third = terms[2] ?? second;
  const fourth = terms[3] ?? article.category ?? topic;
  const fifth = terms[4] ?? `${topic} stakeholders`;
  const source = normalizeText(article.source || 'the source');
  const publishedAt = normalizeText(article.publishedAt || 'recently').slice(0, 10);
  const headline = normalizeText(article.headline);
  const numberHint = numbers[0] ?? publishedAt;

  const q1 = buildOptionSet(
    `${first} is the hinge detail that changes how the headline should be interpreted`,
    [
      `${second} is only peripheral context and does not drive the main update`,
      `${third} is historical background rather than the decisive trigger`,
      `${fourth} appears in framing but does not alter the article's central claim`,
    ],
    `${headline}|q1`,
  );
  const q2 = buildOptionSet(
    `The article implies a chain where ${second} influences outcomes through ${third}`,
    [
      `It treats ${second} and ${third} as unrelated events with no causal link`,
      `It argues timing alone (${publishedAt}) explains the whole development`,
      `It claims symbolic messaging matters more than the mechanism involving ${third}`,
    ],
    `${headline}|q2`,
  );
  const q3 = buildOptionSet(
    `If the evidence around ${numberHint} is revised, the conclusion about ${first} weakens first`,
    [
      `A revision of ${numberHint} would mostly affect stylistic tone, not conclusions`,
      `Only ${source} credibility would change while the claim about ${first} stays identical`,
      `The article would become stronger because weaker evidence usually reinforces the same claim`,
    ],
    `${headline}|q3`,
  );
  const q4 = buildOptionSet(
    `A direct contradiction would show ${fifth} moving opposite to the article's projected consequence`,
    [
      `A contradiction would only require renaming ${fifth} without changing outcomes`,
      `The article can only be contradicted by disproving the publication date ${publishedAt}`,
      `Any reaction that mentions ${topic} would automatically confirm the article's thesis`,
    ],
    `${headline}|q4`,
  );
  const q5 = buildOptionSet(
    `The most exposed stakeholder in this framing is the group tied to ${fourth}`,
    [
      `No stakeholder is exposed because all outcomes are evenly distributed`,
      `${source} alone carries full exposure while institutions tied to ${fourth} are unaffected`,
      `Exposure is random and cannot be inferred from how ${fourth} is presented`,
    ],
    `${headline}|q5`,
  );
  const q6 = buildOptionSet(
    `In timeline terms, the article places ${publishedAt} as the point after which ${third} becomes actionable`,
    [
      `It places ${publishedAt} before any preconditions, making later effects impossible`,
      `It treats chronology as irrelevant, so ${third} is actionable at any time`,
      `It suggests action preceded evidence, so timing around ${publishedAt} has no bearing`,
    ],
    `${headline}|q6`,
  );

  return [
    {
      question: `In "${headline}", which interpretation best captures the hinge event?`,
      options: q1.options,
      correctIndex: q1.correctIndex,
      explanation: `${first} is presented as the pivot that turns context into a concrete development.`,
    },
    {
      question: `Which causal reading is most consistent with how the article links ${second} and ${third}?`,
      options: q2.options,
      correctIndex: q2.correctIndex,
      explanation: 'The narrative implies a mechanism, not just co-occurrence, between these details.',
    },
    {
      question: `If the evidence point (${numberHint}) is later revised, what fails first in the article's logic?`,
      options: q3.options,
      correctIndex: q3.correctIndex,
      explanation: 'That evidence supports the key inference; weakening it weakens the first-order claim.',
    },
    {
      question: `Which development would most directly contradict the article's projected consequence?`,
      options: q4.options,
      correctIndex: q4.correctIndex,
      explanation: 'A contradiction must reverse the direction of the expected outcome, not just wording.',
    },
    {
      question: `From the article's framing, which stakeholder appears most exposed to second-order effects?`,
      options: q5.options,
      correctIndex: q5.correctIndex,
      explanation: 'Exposure follows where consequences concentrate in the story\'s causal chain.',
    },
    {
      question: `What timeline claim is the article implicitly making about events after ${publishedAt}?`,
      options: q6.options,
      correctIndex: q6.correctIndex,
      explanation: 'The sequence matters because actionability is tied to the reported ordering of events.',
    },
  ];
};

export const buildFastArticleContent = (article: NewsArticleInput): GeneratedArticleContent => {
  const headline = article.headline.replace(/\s+/g, ' ').trim();
  const variants = buildQuizVariants(article);
  const rotation = hashString(`${article.headline}|${article.summary}|${article.publishedAt}`) % variants.length;
  const orderedVariants = [...variants.slice(rotation), ...variants.slice(0, rotation)];
  const quiz = orderedVariants.slice(0, 4).map((item, index) => {
    const questionKey = normalizeText(item.question).toLowerCase();
    const question = reserveQuestionText(questionKey) ? item.question : `${item.question} (${article.category || pickTopic(article)})`;
    return {
      question,
      options: item.options,
      correctIndex: item.correctIndex,
      explanation: item.explanation,
      id: `q${index + 1}`,
    };
  });

  return {
    headline: buildFastHeadline(article),
    summary: toExactWordCount(buildFastSummary(article), SUMMARY_WORD_TARGET),
    quiz,
    prediction: buildContentPrediction(article),
  };
};

const buildPrompt = (article: NewsArticleInput) => {
  const isGeneralKnowledge = article.category.trim().toLowerCase() === 'general knowledge';
  if (isGeneralKnowledge) {
    return `
You are generating NewsQuest gameplay content for a general-knowledge quiz attempt.

Return valid JSON only, with this exact shape:
{
  "headline": "string",
  "summary": "string",
  "quiz": [
    {
      "question": "string",
      "options": ["A", "B", "C", "D"],
      "correctIndex": 0,
      "explanation": "string"
    }
  ],
  "prediction": {
    "question": "string",
    "options": ["Option 1", "Option 2", "Option 3"],
    "correctIndex": 0,
    "deadline": "YYYY-MM-DD",
    "xpReward": 25
  }
}

Rules:
- Write exactly 4 quiz questions.
- Theme is general knowledge only (polity, economy, sports, science, technology, world affairs).
- Difficulty must be medium overall: not trivial, not expert-only.
- Each question must be unique for this attempt; avoid reusing wording patterns.
- Use plausible distractors, not obvious wrong options.
- At least 2 questions should require reasoning/elimination, not pure recall.
- correctIndex must be 0, 1, 2, or 3.
- Keep options short and mutually exclusive.
- Keep explanations concise and educational.
- Prediction must be based on the article content itself (evidence-backed interpretation), not "what will happen next".
- Avoid future-looking stems like "most likely next development" or "what will happen".
- prediction.correctIndex must be 0, 1, or 2 and point to the best-supported option.
- Deadline must be a future date in YYYY-MM-DD format.
- Do not include markdown or extra commentary.

Attempt seed:
Headline: ${article.headline}
Summary: ${article.summary}
Full notes: ${article.fullContent}
`;
  }

  return `
You are generating NewsQuest gameplay content from a news article.

Return valid JSON only, with this exact shape:
{
  "headline": "string",
  "summary": "string",
  "quiz": [
    {
      "question": "string",
      "options": ["A", "B", "C", "D"],
      "correctIndex": 0,
      "explanation": "string"
    }
  ],
  "prediction": {
    "question": "string",
    "options": ["Option 1", "Option 2", "Option 3"],
    "correctIndex": 0,
    "deadline": "YYYY-MM-DD",
    "xpReward": 25
  }
}

Rules:
- Write exactly 4 quiz questions.
- Quiz options must be short, distinct, and grounded in the article.
- Make the quiz article-centered: use names, places, institutions, numbers, dates, or consequences from the story itself.
- Avoid generic stems like "Which detail is most central?" unless they include article-specific context.
- At least 2 questions should require inference or careful reading, not just headline recognition.
- Vary the question stems across articles so the same wording does not repeat from one story to the next.
- correctIndex must be 0, 1, 2, or 3.
- Prediction should be article-specific and evidence-based from the current article details (not future speculation).
- Prediction question must mention article entities/topics and be phrased as interpretation/alignment with reported facts.
- Keep the prediction options short and mutually exclusive.
- prediction.correctIndex must be 0, 1, or 2 and point to the option best supported by the article.
- Deadline must be a future date in YYYY-MM-DD format.
- xpReward should be an integer between 20 and 50.
- Headline should be a polished, complete headline of 12 to 20 words, specific to the story.
- Summary must be exactly 200 words in 2 to 3 short paragraphs.
- The summary must stay grounded in article facts (people, places, dates, outcomes) and avoid generic filler.
- Do not include markdown or extra commentary.

Article:
Headline: ${article.headline}
Summary: ${article.summary}
Category: ${article.category}
Source: ${article.source}
Published: ${article.publishedAt}
Full content or notes: ${article.fullContent}
Key terms: ${extractKeyTerms(`${article.headline} ${article.summary} ${article.fullContent}`).join(', ') || 'none'}

Important:
- Use the headline and summary as the main source of truth.
- Prefer article-specific nouns and facts over generic placeholders.
- Make the quiz progressively harder: question 1 factual, question 2 detail-based, question 3 inference-based, question 4 implications or consequence-based.
- If the full content is missing, generic, or paywalled, infer from the headline and summary instead.
`;
};

const normaliseGeneratedContent = (article: NewsArticleInput, parsed: GeneratedArticleContent): GeneratedArticleContent => {
  const fallback = buildFastArticleContent(article);
  const quiz = Array.isArray(parsed.quiz) ? parsed.quiz.slice(0, 4) : [];

  while (quiz.length < 4) {
    const next = fallback.quiz[quiz.length];
    if (!next) break;
    quiz.push(next);
  }

  const normalizedQuiz = quiz.map((item, index) => {
    const fallbackItem = fallback.quiz[index];
    const question = typeof item.question === 'string' && item.question.trim() ? item.question.trim() : fallbackItem.question;
    const uniqueQuestion = reserveQuestionText(question) ? question : `${question} (${article.category || pickTopic(article)})`;
    const options = Array.isArray(item.options) && item.options.length >= 4 ? item.options.slice(0, 4) : fallbackItem.options;
    const correctIndex = Number.isInteger(item.correctIndex) && item.correctIndex >= 0 && item.correctIndex < options.length
      ? item.correctIndex
      : fallbackItem.correctIndex;

    return {
      question: uniqueQuestion,
      options,
      correctIndex,
      explanation: typeof item.explanation === 'string' && item.explanation.trim() ? item.explanation.trim() : fallbackItem.explanation,
    };
  });

  return {
    headline: typeof parsed.headline === 'string' && parsed.headline.trim() ? parsed.headline.trim() : fallback.headline,
    summary: (() => {
      const candidate = typeof parsed.summary === 'string' && parsed.summary.trim() ? parsed.summary.trim() : fallback.summary;
      return toExactWordCountFromSources(
        candidate,
        [article.summary, article.fullContent, article.headline, article.source, article.publishedAt],
        SUMMARY_WORD_TARGET,
      );
    })(),
    quiz: normalizedQuiz,
    prediction: (() => {
      const candidate = parsed.prediction ?? fallback.prediction;
      const generic = typeof candidate?.question === 'string'
        && /(most likely next development|what will happen|next update|future outcome)/i.test(candidate.question);
      const hasValidOptions = Array.isArray(candidate?.options) && candidate.options.length >= 3;
      if (generic || !hasValidOptions) return fallback.prediction;
      const correctIndex = Number.isInteger(candidate.correctIndex)
        && candidate.correctIndex >= 0
        && candidate.correctIndex < candidate.options.length
        ? candidate.correctIndex
        : fallback.prediction.correctIndex;
      return {
        ...candidate,
        question: reservePredictionText(candidate.question) ? candidate.question : `${candidate.question} (${article.category || pickTopic(article)})`,
        correctIndex,
      };
    })(),
  };
};

const parseGeneratedContent = (article: NewsArticleInput, raw: string): GeneratedArticleContent => {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  const jsonText = start >= 0 && end >= start ? raw.slice(start, end + 1) : raw;
  const data = JSON.parse(jsonText) as GeneratedArticleContent;

  if (!Array.isArray(data.quiz) || data.quiz.length < 2 || !data.prediction) {
    throw new Error('Unexpected Bytez response format.');
  }

  const deadlineDate = new Date(data.prediction.deadline);
  const now = new Date();
  if (Number.isNaN(deadlineDate.getTime()) || deadlineDate <= now) {
    const fallback = new Date(now);
    fallback.setUTCDate(fallback.getUTCDate() + 90);
    data.prediction.deadline = fallback.toISOString().slice(0, 10);
  }

  data.prediction.xpReward = Math.min(50, Math.max(20, Math.round(data.prediction.xpReward || 30)));

  return normaliseGeneratedContent(article, data);
};

export const canGenerateArticleContent = hasBytezKey;

let generationQueue: Promise<void> = Promise.resolve();
const generatedContentCache = new Map<string, GeneratedArticleContent>();
const MAX_CACHE_ENTRIES = 50;

const buildCacheKey = (article: NewsArticleInput) =>
  [article.headline, article.summary, article.fullContent, article.category, article.source, article.publishedAt]
    .join('||')
    .toLowerCase();

const rememberGeneratedContent = (key: string, content: GeneratedArticleContent) => {
  generatedContentCache.set(key, content);
  if (generatedContentCache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = generatedContentCache.keys().next().value as string | undefined;
    if (oldestKey) {
      generatedContentCache.delete(oldestKey);
    }
  }
};

const runQueuedGeneration = async <T>(task: () => Promise<T>): Promise<T> => {
  let release!: () => void;
  const current = generationQueue.then(() => new Promise<void>((resolve) => {
    release = resolve;
  }));
  generationQueue = current.catch(() => undefined);

  await current;
  try {
    return await task();
  } finally {
    release();
  }
};

export async function generateArticleContent(article: NewsArticleInput): Promise<GeneratedArticleContent> {
  const cacheKey = buildCacheKey(article);
  const cached = generatedContentCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  return runQueuedGeneration(async () => {
    const afterQueueCached = generatedContentCache.get(cacheKey);
    if (afterQueueCached) {
      return afterQueueCached;
    }

    const model = getBytezModel();
    const { error, output } = await model.run([
      {
        role: 'system',
        content: 'You are a precise JSON generator for a news quiz app.',
      },
      {
        role: 'user',
        content: buildPrompt(article),
      },
    ]);

    if (error) {
      throw new Error(typeof error === 'string' ? error : 'Bytez generation failed.');
    }

    const text = extractBytezText(output);

    if (!text) {
      throw new Error('Bytez returned an unexpected output type.');
    }

    const parsed = parseGeneratedContent(article, text);
    rememberGeneratedContent(cacheKey, parsed);
    return parsed;
  });
}
