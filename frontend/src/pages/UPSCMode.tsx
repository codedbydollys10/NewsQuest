import { useGameStore } from '@/store/gameStore';
import type { Article } from '@/store/gameStore';
import { HUDBar } from '@/components/game/HUDBar';
import { GlassCard } from '@/components/game/GlassCard';
import { NewsCard } from '@/components/game/NewsCard';
import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Globe, Mountain, Leaf, Landmark, FlaskConical } from 'lucide-react';
import { getUpscCompletedArticleIds } from '@/data/upscProgress';

const subjects = [
  { id: 'polity', name: 'Politics', icon: Landmark },
  { id: 'economy', name: 'Economy', icon: Globe },
  { id: 'geography', name: 'Geography', icon: Mountain },
  { id: 'environment', name: 'Environment', icon: Leaf },
  { id: 'history', name: 'History', icon: BookOpen },
  { id: 'science', name: 'Science & Tech', icon: FlaskConical },
];

type SubjectFilter = {
  categories: string[];
  keywords: string[];
  excludedKeywords: string[];
  minScore: number;
  minKeywordMatches: number;
};

const subjectFilters: Record<string, SubjectFilter> = {
  polity: {
    categories: ['Politics', 'Polity'],
    keywords: ['politic', 'constitution', 'parliament', 'supreme court', 'bill', 'election', 'government', 'policy', 'cabinet', 'federal', 'ministry', 'lok sabha', 'rajya sabha', 'election commission'],
    excludedKeywords: ['budget', 'inflation', 'gdp', 'market', 'stock', 'rbi', 'interest rate', 'space', 'wildlife', 'heritage'],
    minScore: 35,
    minKeywordMatches: 1,
  },
  economy: {
    categories: ['Economy'],
    keywords: ['economy', 'budget', 'inflation', 'gdp', 'rbi', 'fiscal', 'tax', 'trade', 'market', 'industry', 'revenue', 'growth', 'rates', 'banking'],
    excludedKeywords: ['constitution', 'parliament', 'heritage', 'wildlife', 'space', 'monument', 'museum'],
    minScore: 35,
    minKeywordMatches: 1,
  },
  geography: {
    categories: ['World', 'General'],
    keywords: ['geography', 'river', 'mountain', 'monsoon', 'delta', 'valley', 'plateau', 'terrain', 'border', 'coast', 'coastal', 'latitude', 'longitude', 'ocean', 'desert', 'earthquake', 'landslide', 'glacier', 'watershed', 'basin', 'map'],
    excludedKeywords: ['budget', 'inflation', 'election', 'parliament', 'museum', 'ancient', 'startup', 'ai', 'stock'],
    minScore: 45,
    minKeywordMatches: 2,
  },
  environment: {
    categories: ['Environment'],
    keywords: ['environment', 'climate', 'wildlife', 'pollution', 'forest', 'carbon', 'emission', 'conservation', 'ecology', 'biodiversity', 'renewable', 'sustainability', 'habitat', 'species', 'recycling'],
    excludedKeywords: ['budget', 'inflation', 'parliament', 'election', 'stock', 'startup', 'museum'],
    minScore: 35,
    minKeywordMatches: 1,
  },
  history: {
    categories: ['Culture', 'World', 'General'],
    keywords: ['history', 'heritage', 'ancient', 'medieval', 'civilization', 'museum', 'archaeology', 'monument', 'culture', 'dynasty', 'empire', 'inscription', 'excavation', 'fort', 'temple'],
    excludedKeywords: ['budget', 'inflation', 'startup', 'space', 'ai', 'pollution', 'election', 'stock'],
    minScore: 45,
    minKeywordMatches: 2,
  },
  science: {
    categories: ['Science'],
    keywords: ['science', 'technology', 'research', 'space', 'ai', 'quantum', 'gene', 'medical', 'spacecraft', 'innovation', 'lab', 'satellite', 'robot', 'vaccine', 'biotech'],
    excludedKeywords: ['budget', 'election', 'museum', 'heritage', 'election commission', 'stock', 'cricket'],
    minScore: 35,
    minKeywordMatches: 1,
  },
};

const scoreSubjectArticle = (article: Pick<Article, 'headline' | 'summary' | 'fullContent' | 'category'>, filter: SubjectFilter) => {
  const headline = article.headline.toLowerCase();
  const summary = article.summary.toLowerCase();
  const content = article.fullContent.toLowerCase();
  const haystack = `${headline} ${summary} ${content}`;

  let score = 0;
  let keywordMatches = 0;

  if (filter.categories.includes(article.category)) {
    score += 100;
  }

  for (const keyword of filter.keywords) {
    if (headline.includes(keyword)) score += 40;
    if (summary.includes(keyword)) score += 25;
    if (content.includes(keyword)) score += 10;
    if (haystack.includes(keyword)) keywordMatches += 1;
  }

  for (const keyword of filter.excludedKeywords) {
    if (haystack.includes(keyword)) {
      score -= 80;
    }
  }

  if (keywordMatches < filter.minKeywordMatches && !filter.categories.includes(article.category)) {
    return 0;
  }

  return score;
};

const filterAndSortSubjectArticles = (
  articles: Article[],
  filter: SubjectFilter,
) => {
  return [...articles]
    .map((article) => ({ article, score: scoreSubjectArticle(article, filter) }))
    .filter(({ score }) => score >= filter.minScore)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(b.article.publishedAt).getTime() - new Date(a.article.publishedAt).getTime();
    })
    .map(({ article }) => article);
};

const UPSCMode = () => {
  const articles = useGameStore(s => s.feed.articles);
  const feedLoaded = useGameStore(s => s.feed.loaded);
  const loadLiveFeed = useGameStore(s => s.loadLiveFeed);
  const [view, setView] = useState<'hub' | string>('hub');
  const completedArticleIds = useMemo(() => getUpscCompletedArticleIds(), [articles, view]);

  useEffect(() => {
    if (!feedLoaded) {
      void loadLiveFeed();
    }
  }, [feedLoaded, loadLiveFeed]);

  const activeSubject = subjects.find((subject) => subject.id === view);
  const subjectStats = useMemo(() => {
    return subjects.map((subject) => {
      const filter = subjectFilters[subject.id];
      const subjectArticles = filterAndSortSubjectArticles(articles, filter);
      const completedCount = subjectArticles.filter((article) => completedArticleIds.has(article.id)).length;
      const totalCount = subjectArticles.length;
      const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

      return {
        ...subject,
        totalCount,
        completedCount,
        progress,
      };
    });
  }, [articles, completedArticleIds]);

  const upscArticles = useMemo(() => {
    if (!activeSubject) return [];

    const filter = subjectFilters[activeSubject.id];
    if (!filter) return [];

    return filterAndSortSubjectArticles(articles, filter);
  }, [activeSubject, articles]);

  return (
    <div className="min-h-screen bg-nq-void grain-overlay">
      <HUDBar />
      <div className="pt-[76px] pb-20 md:pb-8 max-w-5xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-xl font-bold text-foreground">
            <span className="text-nq-purple text-glow-purple">UPSC</span> MODE
          </h1>
          {view !== 'hub' && (
            <motion.button whileTap={{ scale: 0.94 }} onClick={() => setView('hub')} className="px-3 py-1.5 rounded-lg font-display text-xs text-nq-text-secondary hover:text-foreground glass">
              ← SUBJECTS
            </motion.button>
          )}
        </div>

        {view === 'hub' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {subjectStats.map((s, i) => (
              <motion.div key={s.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
                <GlassCard glow="purple" className="cursor-pointer" onClick={() => setView(s.id)}>
                  <s.icon className="text-nq-purple mb-3" size={28} />
                  <h3 className="font-display text-sm font-bold text-foreground mb-2">{s.name}</h3>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex-1 h-1.5 rounded-full bg-nq-elevated overflow-hidden">
                      <div className="h-full rounded-full bg-nq-purple" style={{ width: `${s.progress}%` }} />
                    </div>
                    <span className="font-mono text-[10px] text-nq-text-muted">
                      {s.completedCount}/{s.totalCount}
                    </span>
                  </div>
                  <p className="text-[10px] text-nq-text-muted">
                    {s.totalCount > 0 ? `${s.totalCount} available today` : '0 available today'}
                  </p>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <GlassCard hover={false} className="border-nq-purple/20">
              <h3 className="font-display text-sm font-bold text-nq-purple mb-2">DAILY UPSC CHALLENGE</h3>
              <p className="text-xs text-nq-text-secondary">
                {activeSubject?.name ?? 'Selected subject'} only • 3 MCQs refreshed daily • Earns purple XP • Own streak counter
              </p>
            </GlassCard>
            {upscArticles.length > 0 ? (
              upscArticles.map((a, i) => <NewsCard key={a.id} article={a} index={i} />)
            ) : (
              <GlassCard hover={false} className="border-white/10">
                <p className="text-sm text-nq-text-secondary">
                  No live articles found for {activeSubject?.name ?? 'this subject'} yet. Try another subject or refresh after the feed loads.
                </p>
              </GlassCard>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default UPSCMode;
