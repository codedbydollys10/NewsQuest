const PREDICTION_HISTORY_KEY = 'newsquest_prediction_history_v1';
export const PREDICTION_HISTORY_UPDATED_EVENT = 'newsquest:prediction-history-updated';

export type PredictionOutcome = 'pending' | 'correct' | 'incorrect';

export interface PredictionHistoryEntry {
  id: string;
  userId: string;
  articleId: string;
  headline: string;
  question: string;
  selectedIndex: number;
  selectedOption: string;
  confidence: number;
  attemptXp: number;
  maxXp: number;
  category: string;
  deadline: string;
  createdAt: string;
  expiresAt: string;
  outcome: PredictionOutcome;
  resolvedAt?: string;
  resolvedAnswer?: number;
  bonusXp?: number;
  bonusAwarded?: boolean;
}

type PredictionAttemptInput = {
  userId: string;
  articleId: string;
  headline: string;
  question: string;
  selectedIndex: number;
  selectedOption: string;
  confidence: number;
  attemptXp: number;
  maxXp: number;
  category: string;
  deadline: string;
};

const safeNow = () => new Date().toISOString();

const expiresInOneDay = (timestamp: string) => {
  const date = new Date(timestamp);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString();
};

const emitUpdate = (userId: string) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(PREDICTION_HISTORY_UPDATED_EVENT, {
    detail: { userId },
  }));
};

const readAll = (): PredictionHistoryEntry[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(PREDICTION_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as PredictionHistoryEntry[]) : [];
  } catch {
    return [];
  }
};

const writeAll = (entries: PredictionHistoryEntry[]) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PREDICTION_HISTORY_KEY, JSON.stringify(entries));
  } catch {
    // Local persistence is best-effort only.
  }
};

const pruneExpired = (entries: PredictionHistoryEntry[]) => {
  const now = Date.now();
  return entries.filter((entry) => new Date(entry.expiresAt).getTime() > now);
};

const saveEntries = (entries: PredictionHistoryEntry[]) => {
  const active = pruneExpired(entries);
  writeAll(active);
  return active;
};

export const getPredictionHistoryForUser = (userId: string) => {
  const all = readAll();
  const active = pruneExpired(all);
  if (active.length !== all.length) {
    writeAll(active);
  }

  const entries = active.filter((entry) => entry.userId === userId);
  entries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return entries;
};

export const getActivePredictionAttempt = (userId: string, articleId: string) => {
  return getPredictionHistoryForUser(userId).find((entry) => entry.articleId === articleId) ?? null;
};

export const recordPredictionAttempt = (attempt: PredictionAttemptInput) => {
  const createdAt = safeNow();
  const entry: PredictionHistoryEntry = {
    id: `pred-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userId: attempt.userId,
    articleId: attempt.articleId,
    headline: attempt.headline,
    question: attempt.question,
    selectedIndex: attempt.selectedIndex,
    selectedOption: attempt.selectedOption,
    confidence: Math.min(100, Math.max(1, Math.round(attempt.confidence))),
    attemptXp: Math.max(0, Math.round(attempt.attemptXp)),
    maxXp: Math.max(0, Math.round(attempt.maxXp)),
    category: attempt.category,
    deadline: attempt.deadline,
    createdAt,
    expiresAt: expiresInOneDay(createdAt),
    outcome: 'pending',
  };

  const entries = readAll().filter((item) => !(item.userId === attempt.userId && item.articleId === attempt.articleId));
  entries.push(entry);
  saveEntries(entries);
  emitUpdate(attempt.userId);
  return entry;
};

export const resolvePredictionAttempt = (input: {
  userId: string;
  articleId: string;
  resolvedAnswer: number;
}) => {
  const entries = readAll();
  const index = entries.findIndex((entry) => entry.userId === input.userId && entry.articleId === input.articleId);
  if (index < 0) return null;

  const current = entries[index];
  const correct = current.selectedIndex === input.resolvedAnswer;
  const bonusXp = current.bonusXp ?? (correct
    ? Math.max(0, current.maxXp - current.attemptXp)
    : Math.max(5, Math.round(current.maxXp * 0.2)));

  const next: PredictionHistoryEntry = {
    ...current,
    resolvedAnswer: input.resolvedAnswer,
    resolvedAt: current.resolvedAt ?? safeNow(),
    outcome: correct ? 'correct' : 'incorrect',
    bonusXp,
    bonusAwarded: true,
  };

  entries[index] = next;
  saveEntries(entries);
  emitUpdate(input.userId);
  return { entry: next, correct, bonusXp };
};
