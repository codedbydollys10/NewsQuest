import { create } from 'zustand';
import { getLastActiveAvatarId } from '@/data/avatars';

export interface Article {
  id: string;
  headline: string;
  summary: string;
  category: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  xpReward: number;
  readTime: string;
  source: string;
  publishedAt: string;
  fullContent: string;
  quiz: { id: string; question: string; options: string[]; correct: number; explanation: string }[];
  prediction?: { id: string; question: string; options: string[]; deadline: string; resolvedAnswer?: number; xpReward: number };
}

export interface NewsApiEnrichedArticle {
  article: Omit<Article, 'quiz' | 'prediction'>;
  content: {
    quiz: { id: string; question: string; options: string[]; correct: number; explanation: string }[];
    prediction: { id: string; question: string; options: string[]; deadline: string; resolvedAnswer?: number; xpReward: number };
  };
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  type: 'read' | 'quiz' | 'predict' | 'category' | 'upsc';
  target: number;
  progress: number;
  xpReward: number;
  completed: boolean;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  unlockCondition: string;
}

export interface LeaderboardUser {
  id: string;
  username: string;
  level: number;
  totalXP: number;
  accuracy: number;
  streak: number;
  avatar: string;
}

export interface UserState {
  id: string;
  username: string;
  currentLevel: number;
  totalXP: number;
  xpToNextLevel: number;
  streakCount: number;
  longestStreak: number;
  lastActiveDate: string;
  badges: Badge[];
  predictionsTotal: number;
  predictionsCorrect: number;
  quizzesTotal: number;
  quizzesCorrect: number;
  articlesRead: number;
  savedArticles: string[];
  onboarded: boolean;
  avatarId: number;
  avatarBody: string;
  focusMode: 'news' | 'upsc' | 'both';
  dailyTarget: number;
}

interface GameStore {
  user: UserState;
  feed: { articles: Article[]; loading: boolean; loaded: boolean; filter: string; mode: 'news' | 'upsc' };
  quests: { daily: Quest[]; weeklyBonus: Quest | null; lastReset: string };
  leaderboard: { global: LeaderboardUser[]; weekly: LeaderboardUser[] };
  ui: { showLevelUpModal: boolean; xpFloats: { id: string; amount: number; color: string; x: number; y: number }[] };
  addXP: (amount: number, color?: string, x?: number, y?: number) => void;
  completeQuest: (questId: string) => void;
  setMode: (mode: 'news' | 'upsc') => void;
  setOnboarded: (v: boolean) => void;
  setUsername: (name: string) => void;
  setFocusMode: (mode: 'news' | 'upsc' | 'both') => void;
  setDailyTarget: (t: number) => void;
  setFeedArticles: (articles: Article[]) => void;
  hydrateArticleContent: (articleId: string, content: Pick<Article, 'quiz' | 'prediction'>) => void;
  loadLiveFeed: () => Promise<void>;
  incrementArticlesRead: () => void;
  incrementQuizzes: (correct: boolean) => void;
  incrementPredictions: (correct: boolean) => void;
  dismissLevelUp: () => void;
  updateQuestProgress: (type: string) => void;
}

const LEVEL_XP = [0, 100, 250, 500, 800, 1200, 1700, 2300, 3000, 3800, 4700, 5800, 7000, 8500, 10000, 12000, 14500, 17500, 21000, 25000, 30000];
function getLevelForXP(xp: number) {
  let level = 1;
  for (let i = 1; i < LEVEL_XP.length; i++) {
    if (xp >= LEVEL_XP[i]) level = i + 1; else break;
  }
  const nextLevelXP = LEVEL_XP[level] || LEVEL_XP[level - 1] + 5000;
  const currentLevelXP = LEVEL_XP[level - 1] || 0;
  return { level, xpToNextLevel: nextLevelXP - currentLevelXP, xpInLevel: xp - currentLevelXP };
}

const feedCategories = ['Technology', 'Environment', 'Economy', 'Politics', 'Sports'] as const;
const fetchCategories = ['Technology', 'Science', 'Environment', 'Economy', 'Politics', 'Sports', 'World', 'General'] as const;
const MIN_ARTICLES_PER_CATEGORY = 3;
const CATEGORY_BACKFILL_QUERIES: Record<string, string[]> = {
  Environment: [
    'climate environment pollution biodiversity sustainability',
    'environment ministry climate policy',
  ],
  Politics: [
    'parliament election government policy supreme court',
    'constitutional amendment political party legislation',
  ],
  Sports: [
    'sports cricket football olympics tournament league',
    'match result championship team standings',
  ],
};
const FEED_CACHE_KEY = 'newsquest_cached_feed_articles';

const remapCategory = (articles: Article[]) =>
  articles.map((article) => {
    let category = article.category;
    if (category === 'Science') category = 'Technology';
    if (category === 'General' || category === 'General Knowledge' || category === 'Top') category = 'Politics';
    if (category === 'Polity') category = 'Politics';
    return { ...article, category };
  });

const getCategoryCounts = (articles: Article[]) => {
  const counts = new Map<string, number>();
  for (const article of articles) {
    counts.set(article.category, (counts.get(article.category) ?? 0) + 1);
  }
  return counts;
};

const hasMinimumCoverage = (articles: Article[], minCount = MIN_ARTICLES_PER_CATEGORY) => {
  const counts = getCategoryCounts(articles);
  return feedCategories.every((category) => (counts.get(category) ?? 0) >= minCount);
};

const balanceFeedArticles = (articles: Article[]) => {
  const sorted = sortArticlesForFeed(articles);
  const byCategory = new Map<string, Article[]>();
  for (const article of sorted) {
    const bucket = byCategory.get(article.category) ?? [];
    bucket.push(article);
    byCategory.set(article.category, bucket);
  }

  const selected: Article[] = [];
  const seen = new Set<string>();
  const takeUnique = (entry: Article) => {
    if (seen.has(entry.id)) return;
    seen.add(entry.id);
    selected.push(entry);
  };

  for (const category of feedCategories) {
    const bucket = byCategory.get(category) ?? [];
    bucket.slice(0, MIN_ARTICLES_PER_CATEGORY).forEach(takeUnique);
  }

  for (const category of feedCategories) {
    const bucket = byCategory.get(category) ?? [];
    bucket.slice(MIN_ARTICLES_PER_CATEGORY, 8).forEach(takeUnique);
  }

  for (const entry of sorted) {
    if (selected.length >= 40) break;
    takeUnique(entry);
  }

  return selected.slice(0, 40);
};

const readCachedFeedArticles = (): Article[] => {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(FEED_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Article[]) : [];
  } catch {
    return [];
  }
};

const persistCachedFeedArticles = (articles: Article[]) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(FEED_CACHE_KEY, JSON.stringify(articles));
  } catch {
    // Ignore storage failures and keep the in-memory feed usable.
  }
};

const mergeUniqueArticles = (base: Article[], additions: Article[]) => {
  const seen = new Set(base.map(article => article.id));
  const merged = [...base];

  for (const article of additions) {
    if (seen.has(article.id)) continue;
    seen.add(article.id);
    merged.push(article);
  }

  return merged;
};

const sortArticlesForFeed = (articles: Article[]) => {
  const categoryRank = new Map(feedCategories.map((category, index) => [category, index] as const));
  return [...articles].sort((a, b) => {
    const aRank = categoryRank.get(a.category as typeof feedCategories[number]) ?? feedCategories.length;
    const bRank = categoryRank.get(b.category as typeof feedCategories[number]) ?? feedCategories.length;
    if (aRank !== bRank) return aRank - bRank;
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });
};

const mockQuests: Quest[] = [
  { id: 'dq1', title: 'Knowledge Seeker', description: 'Read 3 articles today', type: 'read', target: 3, progress: 1, xpReward: 50, completed: false },
  { id: 'dq2', title: 'Quiz Master', description: 'Complete 2 quizzes', type: 'quiz', target: 2, progress: 2, xpReward: 75, completed: true },
  { id: 'dq3', title: 'Oracle\'s Gambit', description: 'Make 1 prediction', type: 'predict', target: 1, progress: 0, xpReward: 40, completed: false },
  { id: 'dq4', title: 'Explorer', description: 'Read articles from 3 different categories', type: 'category', target: 3, progress: 2, xpReward: 60, completed: false },
  { id: 'dq5', title: 'UPSC Warrior', description: 'Answer 5 UPSC questions', type: 'upsc', target: 5, progress: 3, xpReward: 80, completed: false },
];

const mockBadges: Badge[] = [
  { id: 'b1', name: 'First Steps', description: 'Read your first article', icon: '📖', earned: true, unlockCondition: 'Read 1 article' },
  { id: 'b2', name: 'Quiz Initiate', description: 'Complete your first quiz', icon: '🧠', earned: true, unlockCondition: 'Complete 1 quiz' },
  { id: 'b3', name: 'Oracle Apprentice', description: 'Earn 100 XP and unlock this badge', icon: '🔮', earned: true, unlockCondition: '100 XP' },
  { id: 'b4', name: 'Streak Starter', description: 'Earn 200 XP and unlock this badge', icon: '🔥', earned: true, unlockCondition: '200 XP' },
  { id: 'b5', name: 'Bookworm', description: 'Earn 300 XP and unlock this badge + avatar', icon: '📚', earned: true, unlockCondition: '300 XP' },
  { id: 'b6', name: 'Sharp Mind', description: 'Earn 400 XP and unlock this badge', icon: '⚡', earned: true, unlockCondition: '400 XP' },
  { id: 'b7', name: 'Seer', description: 'Earn 500 XP and unlock this badge + avatar', icon: '👁', earned: true, unlockCondition: '500 XP' },
  { id: 'b8', name: 'Night Owl', description: 'Earn 600 XP and unlock this badge', icon: '🦉', earned: true, unlockCondition: '600 XP' },
  { id: 'b9', name: 'Flame Keeper', description: 'Earn 700 XP and unlock this badge + avatar', icon: '🔥', earned: false, unlockCondition: '700 XP' },
  { id: 'b10', name: 'Century', description: 'Earn 800 XP and unlock this badge', icon: '💯', earned: false, unlockCondition: '800 XP' },
  { id: 'b11', name: 'Grandmaster', description: 'Earn 900 XP and unlock this badge + avatar', icon: '👑', earned: false, unlockCondition: '900 XP' },
  { id: 'b12', name: 'Oracle Supreme', description: 'Earn 1000 XP and unlock this badge', icon: '🌟', earned: false, unlockCondition: '1000 XP' },
  { id: 'b13', name: 'Polymath', description: 'Earn 1100 XP and unlock this badge + avatar', icon: '🎓', earned: false, unlockCondition: '1100 XP' },
  { id: 'b14', name: 'Speed Demon', description: 'Earn 1200 XP and unlock this badge', icon: '💨', earned: false, unlockCondition: '1200 XP' },
  { id: 'b15', name: 'Unstoppable', description: 'Earn 1300 XP and unlock this badge + avatar', icon: '🏔', earned: false, unlockCondition: '1300 XP' },
  { id: 'b16', name: 'Architect', description: 'Earn 1400 XP and unlock this badge', icon: '🏗', earned: false, unlockCondition: '1400 XP' },
  { id: 'b17', name: 'Phantom', description: 'Earn 1500 XP and unlock this badge + avatar', icon: '👻', earned: false, unlockCondition: '1500 XP' },
  { id: 'b18', name: 'Visionary', description: 'Earn 1600 XP and unlock this badge', icon: '🔭', earned: false, unlockCondition: '1600 XP' },
  { id: 'b19', name: 'Marathon', description: 'Earn 1700 XP and unlock this badge + avatar', icon: '🏃', earned: false, unlockCondition: '1700 XP' },
  { id: 'b20', name: 'Legendary', description: 'Earn 1800 XP and unlock this badge', icon: '⭐', earned: false, unlockCondition: '1800 XP' },
];

const mockLeaderboard: LeaderboardUser[] = [
  { id: 'l1', username: 'cyber_sage', level: 24, totalXP: 18500, accuracy: 92, streak: 45, avatar: '🧙' },
  { id: 'l2', username: 'neural_monk', level: 22, totalXP: 16200, accuracy: 88, streak: 38, avatar: '🧘' },
  { id: 'l3', username: 'data_phoenix', level: 20, totalXP: 14800, accuracy: 85, streak: 52, avatar: '🔥' },
  { id: 'l4', username: 'quantum_wolf', level: 19, totalXP: 13500, accuracy: 79, streak: 28, avatar: '🐺' },
  { id: 'l5', username: 'shreya_k', level: 18, totalXP: 12200, accuracy: 91, streak: 33, avatar: '⚡' },
  { id: 'l6', username: 'arjun_v', level: 17, totalXP: 11000, accuracy: 82, streak: 21, avatar: '🎯' },
  { id: 'l7', username: 'priya_codes', level: 16, totalXP: 9800, accuracy: 87, streak: 15, avatar: '💻' },
  { id: 'l9', username: 'zen_hacker', level: 14, totalXP: 7200, accuracy: 76, streak: 12, avatar: '🥷' },
  { id: 'l10', username: 'nova_star', level: 13, totalXP: 6100, accuracy: 83, streak: 9, avatar: '🌟' },
  { id: 'l11', username: 'mind_forge', level: 12, totalXP: 5200, accuracy: 74, streak: 7, avatar: '🔨' },
  { id: 'l12', username: 'eco_ranger', level: 11, totalXP: 4500, accuracy: 80, streak: 14, avatar: '🌿' },
  { id: 'l13', username: 'byte_rider', level: 10, totalXP: 3800, accuracy: 71, streak: 5, avatar: '🏍' },
  { id: 'l14', username: 'atlas_mind', level: 9, totalXP: 3200, accuracy: 69, streak: 3, avatar: '🗺' },
  { id: 'l15', username: 'spark_nova', level: 8, totalXP: 2600, accuracy: 65, streak: 2, avatar: '✨' },
];

const calculateBadgesStatus = (totalXP: number, persistedUnlockedBadgeIds: string[] = []): Badge[] => {
  // First 2 badges are always unlocked, then unlock 1 badge every 100 XP
  const unlockedCount = 2 + Math.floor(totalXP / 100);
  const persistedUnlocked = new Set(persistedUnlockedBadgeIds);
  return mockBadges.map((badge, index) => ({
    ...badge,
    earned: index < unlockedCount || persistedUnlocked.has(badge.id),
  }));
};

export { calculateBadgesStatus };
export const getUnlockedBadgeIds = (badges: Badge[]) => badges.filter((badge) => badge.earned).map((badge) => badge.id);

export const initialGameState: Pick<GameStore, 'user' | 'feed' | 'quests' | 'leaderboard' | 'ui'> = {
  user: {
    id: 'player1',
    username: 'Player',
    currentLevel: 15,
    totalXP: 0,
    xpToNextLevel: 100,
    streakCount: 0,
    longestStreak: 0,
    lastActiveDate: new Date().toISOString(),
    badges: calculateBadgesStatus(0),
    predictionsTotal: 0,
    predictionsCorrect: 0,
    quizzesTotal: 0,
    quizzesCorrect: 0,
    articlesRead: 0,
    savedArticles: [],
    onboarded: false,
    avatarId: getLastActiveAvatarId() ?? 0,
    avatarBody: 'scout',
    focusMode: 'both',
    dailyTarget: 3,
  },
  feed: {
    articles: balanceFeedArticles(remapCategory(readCachedFeedArticles())),
    loading: false,
    loaded: false,
    filter: 'all',
    mode: 'news',
  },
  quests: { daily: mockQuests, weeklyBonus: { id: 'wq1', title: 'Weekly Oracle', description: '70%+ prediction accuracy this week', type: 'predict', target: 70, progress: 71, xpReward: 200, completed: true }, lastReset: new Date().toISOString() },
  leaderboard: { global: mockLeaderboard, weekly: mockLeaderboard.slice(0, 10) },
  ui: { showLevelUpModal: false, xpFloats: [] },
};

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialGameState,

  addXP: (amount, color = 'cyan', x = window.innerWidth / 2, y = window.innerHeight / 2) => {
    const state = get();
    const newTotalXP = state.user.totalXP + amount;
    const { level, xpToNextLevel } = getLevelForXP(newTotalXP);
    const leveledUp = level > state.user.currentLevel;
    const floatId = `xp-${Date.now()}-${Math.random()}`;
    const updatedBadges = calculateBadgesStatus(newTotalXP, getUnlockedBadgeIds(state.user.badges));
    set({
      user: { ...state.user, totalXP: newTotalXP, currentLevel: level, xpToNextLevel, badges: updatedBadges },
      ui: { ...state.ui, showLevelUpModal: leveledUp, xpFloats: [...state.ui.xpFloats, { id: floatId, amount, color, x, y }] },
    });
    setTimeout(() => {
      set(s => ({ ui: { ...s.ui, xpFloats: s.ui.xpFloats.filter(f => f.id !== floatId) } }));
    }, 1500);
  },
  completeQuest: (questId) => set(s => ({
    quests: { ...s.quests, daily: s.quests.daily.map(q => q.id === questId ? { ...q, completed: true, progress: q.target } : q) },
  })),
  setMode: (mode) => set(s => ({ feed: { ...s.feed, mode } })),
  setOnboarded: (v) => set(s => ({ user: { ...s.user, onboarded: v } })),
  setUsername: (name) => set(s => ({ user: { ...s.user, username: name } })),
  setFocusMode: (mode) => set(s => ({ user: { ...s.user, focusMode: mode } })),
  setDailyTarget: (t) => set(s => ({ user: { ...s.user, dailyTarget: t } })),
  setFeedArticles: (articles) => {
    const normalized = remapCategory(articles);
    const balanced = balanceFeedArticles(normalized);
    persistCachedFeedArticles(balanced);
    set(s => ({ feed: { ...s.feed, articles: balanced, loading: false, loaded: true } }));
  },
  hydrateArticleContent: (articleId, content) => set(s => ({
    feed: {
      ...s.feed,
      articles: s.feed.articles.map(article => article.id === articleId ? { ...article, ...content } : article),
    },
  })),
  loadLiveFeed: async () => {
    const state = get();
    if (state.feed.loading) return;
    if (state.feed.loaded && hasMinimumCoverage(state.feed.articles)) return;

    const cachedArticles = remapCategory(readCachedFeedArticles());
    if (cachedArticles.length && !state.feed.articles.length) {
      set(s => ({
        feed: {
          ...s.feed,
          articles: balanceFeedArticles(cachedArticles),
        },
      }));
    }

    set(s => ({ feed: { ...s.feed, loading: true } }));

    try {
      const { fetchRawNews } = await import('@/lib/newsApi');
      const safeFetchRawNews = async (...args: Parameters<typeof fetchRawNews>) => {
        try {
          return await fetchRawNews(...args);
        } catch {
          return [] as Article[];
        }
      };

      const perCategoryBatches = await Promise.all(
        fetchCategories.map(async (category) => {
          const targetCategory = category === 'Science' ? 'Technology' : category;
          const dedupe = new Map<string, Article>();
          const takeForCategory = (items: Article[], forceCategory = false) => {
            for (const item of items) {
              const fits = item.category === targetCategory || (category === 'Science' && item.category === 'Science');
              if (!fits && !forceCategory) continue;
              if (!dedupe.has(item.id)) {
                const withCategory = (forceCategory && !fits) || category === 'Science'
                  ? { ...item, category: targetCategory }
                  : item;
                dedupe.set(item.id, withCategory);
              }
            }
          };

          const primary = await safeFetchRawNews(category);
          takeForCategory(primary);

          if (dedupe.size < 5) {
            const globalSameCategory = await safeFetchRawNews(category, { country: false });
            takeForCategory(globalSameCategory);
          }

          if (dedupe.size < MIN_ARTICLES_PER_CATEGORY) {
            const queries = CATEGORY_BACKFILL_QUERIES[targetCategory] ?? [`${targetCategory} latest news`];
            for (const q of queries) {
              if (dedupe.size >= MIN_ARTICLES_PER_CATEGORY) break;
              const searched = await safeFetchRawNews(undefined, { country: false, q });
              takeForCategory(searched, true);
            }
          }

          if (dedupe.size < MIN_ARTICLES_PER_CATEGORY) {
            const globalTop = await safeFetchRawNews(undefined, { country: false });
            takeForCategory(globalTop, true);
          }

          return Array.from(dedupe.values()).slice(0, 5);
        }),
      );

      const freshArticles = remapCategory(perCategoryBatches.flat());
      const nextArticles = balanceFeedArticles(mergeUniqueArticles(cachedArticles, freshArticles));
      persistCachedFeedArticles(nextArticles);

      set(s => ({
        feed: {
          ...s.feed,
          articles: nextArticles,
          loading: false,
          loaded: true,
        },
      }));
    } catch (_error) {
      set(s => ({
        feed: {
          ...s.feed,
          articles: s.feed.articles.length ? s.feed.articles : cachedArticles,
          loading: false,
          loaded: true,
        },
      }));
    }
  },
  incrementArticlesRead: () => set(s => ({ user: { ...s.user, articlesRead: s.user.articlesRead + 1 } })),
  incrementQuizzes: (correct) => set(s => ({
    user: { ...s.user, quizzesTotal: s.user.quizzesTotal + 1, quizzesCorrect: s.user.quizzesCorrect + (correct ? 1 : 0) },
  })),
  incrementPredictions: (correct) => set(s => ({
    user: { ...s.user, predictionsTotal: s.user.predictionsTotal + 1, predictionsCorrect: s.user.predictionsCorrect + (correct ? 1 : 0) },
  })),
  dismissLevelUp: () => set(s => ({ ui: { ...s.ui, showLevelUpModal: false } })),
  updateQuestProgress: (type) => set(s => ({
    quests: { ...s.quests, daily: s.quests.daily.map(q => q.type === type && !q.completed ? { ...q, progress: Math.min(q.progress + 1, q.target), completed: q.progress + 1 >= q.target } : q) },
  })),
}));
