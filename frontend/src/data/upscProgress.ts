const UPSC_COMPLETED_KEY = 'newsquest_upsc_completed_articles';

const readCompletedSet = () => {
  try {
    const raw = localStorage.getItem(UPSC_COMPLETED_KEY);
    if (!raw) return new Set<string>();

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set<string>();

    return new Set(parsed.filter((value): value is string => typeof value === 'string'));
  } catch {
    return new Set<string>();
  }
};

const writeCompletedSet = (completed: Set<string>) => {
  localStorage.setItem(UPSC_COMPLETED_KEY, JSON.stringify([...completed]));
};

export const getUpscCompletedArticleIds = () => readCompletedSet();

export const markUpscArticleCompleted = (articleId: string) => {
  const completed = readCompletedSet();
  completed.add(articleId);
  writeCompletedSet(completed);
};

