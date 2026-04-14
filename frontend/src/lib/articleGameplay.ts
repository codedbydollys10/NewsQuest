import type { Article } from '@/store/gameStore';

type ArticleSeed = Pick<Article, 'headline' | 'summary' | 'category' | 'source' | 'publishedAt' | 'fullContent'>;

type FastQuizItem = {
  id: string;
  question: string;
  options: string[];
  correct: number;
  explanation: string;
};

const seenQuestionTexts = new Set<string>();
const QUESTION_CACHE_LIMIT = 80;
const seenPredictionTexts = new Set<string>();
const PREDICTION_CACHE_LIMIT = 80;

const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim();

const hashString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

const futureDate = (daysAhead: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysAhead);
  return date.toISOString().slice(0, 10);
};

const pickTopic = (article: ArticleSeed) => {
  const sourceText = `${article.headline} ${article.summary} ${article.category} ${article.fullContent}`.toLowerCase();
  if (sourceText.includes('election') || sourceText.includes('vote') || sourceText.includes('parliament') || sourceText.includes('court')) return 'Politics';
  if (sourceText.includes('market') || sourceText.includes('stock') || sourceText.includes('economy') || sourceText.includes('trade')) return 'Economy';
  if (sourceText.includes('space') || sourceText.includes('mars') || sourceText.includes('nasa') || sourceText.includes('isro')) return 'Science';
  if (sourceText.includes('health') || sourceText.includes('medical') || sourceText.includes('hospital') || sourceText.includes('drug')) return 'Health';
  if (sourceText.includes('sport') || sourceText.includes('cricket') || sourceText.includes('football') || sourceText.includes('olympic')) return 'Sports';
  if (sourceText.includes('ai') || sourceText.includes('artificial intelligence') || sourceText.includes('neural')) return 'AI';
  return article.category || 'General';
};

const extractKeyTerms = (text: string) => {
  const words = text
    .replace(/[^A-Za-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 4);

  const stopWords = new Set([
    'this', 'that', 'with', 'from', 'have', 'will', 'been', 'were', 'into', 'about', 'after', 'before', 'over',
    'news', 'more', 'some', 'than', 'when', 'what', 'where', 'which', 'their', 'there', 'they', 'them', 'said',
    'says', 'could', 'would', 'should', 'also', 'only', 'just', 'then', 'even', 'each', 'such', 'made', 'make',
    'most', 'very', 'for', 'the', 'and', 'are', 'was', 'that', 'have', 'has', 'had', 'its', 'this', 'those',
  ]);

  return Array.from(new Set(words.filter((word) => !stopWords.has(word.toLowerCase())))).slice(0, 8);
};

const extractNumberClues = (text: string) =>
  Array.from(new Set((text.match(/\b\d+(?:\.\d+)?%?\b/g) ?? []).map((value) => value.trim()))).slice(0, 6);

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
    correct: rotated.findIndex((entry) => entry === normalizeText(correct)),
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

const buildContentPrediction = (article: ArticleSeed) => {
  const topic = pickTopic(article);
  const terms = extractKeyTerms(`${article.headline} ${article.summary} ${article.fullContent}`);
  const primary = terms[0] ?? topic;
  const secondary = terms[1] ?? primary;
  const tertiary = terms[2] ?? secondary;
  const seed = `${article.headline}|${article.summary}|${article.category}|prediction`;

  const templates = [
    `Which interpretation is best supported by this article's details on ${primary}?`,
    `Based on this report, what is the strongest evidence-backed takeaway about ${primary} and ${secondary}?`,
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
  const resolvedAnswer = options.findIndex((entry) => entry === baseOptions[0]);

  return {
    id: 'p1',
    question,
    options,
    resolvedAnswer: resolvedAnswer >= 0 ? resolvedAnswer : 0,
    deadline: futureDate(30),
    xpReward: 25,
  };
};

const buildQuizVariants = (article: ArticleSeed) => {
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
      correct: q1.correct,
      explanation: `${first} is presented as the pivot that turns context into a concrete development.`,
    },
    {
      question: `Which causal reading is most consistent with how the article links ${second} and ${third}?`,
      options: q2.options,
      correct: q2.correct,
      explanation: `The narrative implies a mechanism, not just co-occurrence, between these details.`,
    },
    {
      question: `If the evidence point (${numberHint}) is later revised, what fails first in the article's logic?`,
      options: q3.options,
      correct: q3.correct,
      explanation: `That evidence supports the key inference; weakening it weakens the first-order claim.`,
    },
    {
      question: `Which development would most directly contradict the article's projected consequence?`,
      options: q4.options,
      correct: q4.correct,
      explanation: `A contradiction must reverse the direction of the expected outcome, not just wording.`,
    },
    {
      question: `From the article's framing, which stakeholder appears most exposed to second-order effects?`,
      options: q5.options,
      correct: q5.correct,
      explanation: `Exposure follows where consequences concentrate in the story's causal chain.`,
    },
    {
      question: `What timeline claim is the article implicitly making about events after ${publishedAt}?`,
      options: q6.options,
      correct: q6.correct,
      explanation: `The sequence matters because actionability is tied to the reported ordering of events.`,
    },
  ];
};

const pickQuizItems = (article: ArticleSeed): FastQuizItem[] => {
  const variants = buildQuizVariants(article);
  const rotation = hashString(`${article.headline}|${article.summary}|${article.publishedAt}`) % variants.length;
  const ordered = [...variants.slice(rotation), ...variants.slice(0, rotation)];
  const selected: FastQuizItem[] = [];

  for (let i = 0; i < ordered.length && selected.length < 4; i += 1) {
    const candidate = ordered[i];
    const fallbackQuestion = `What detail best captures the article's main point about ${pickTopic(article)}?`;
    const question = candidate.question || fallbackQuestion;
    const finalQuestion = reserveQuestionText(question)
      ? question
      : `${question} (${article.category || pickTopic(article)})`;

    selected.push({
      id: `q${selected.length + 1}`,
      question: finalQuestion,
      options: candidate.options,
      correct: candidate.correct,
      explanation: candidate.explanation,
    });
  }

  return selected;
};

export const buildFastGameplay = (article: ArticleSeed) => {
  return {
    quiz: pickQuizItems(article),
    prediction: buildContentPrediction(article),
  };
};
