import { useParams, Link } from 'react-router-dom';
import { useGameStore } from '@/store/gameStore';
import { generateArticleGameplay } from '@/lib/newsApi';
import { buildFastGameplay } from '@/lib/articleGameplay';
import { recordReadProgress } from '@/lib/progressSync';
import { HUDBar } from '@/components/game/HUDBar';
import { GlassCard } from '@/components/game/GlassCard';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { ArrowLeft, Clock } from 'lucide-react';
import { markUpscArticleCompleted } from '@/data/upscProgress';
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis';

const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim();

const extractCompleteSentences = (text: string) => {
  const normalized = normalizeText(text);
  if (!normalized) return [];
  const complete = normalized.match(/[^.!?]+[.!?]+/g)?.map((entry) => normalizeText(entry)).filter(Boolean) ?? [];
  if (complete.length > 0) return complete;
  return [normalized];
};

const dedupeSentences = (sentences: string[]) => {
  const seen = new Set<string>();
  return sentences.filter((sentence) => {
    const key = normalizeText(sentence).toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const dedupeTextSentences = (text: string) => {
  const sentences = extractCompleteSentences(text);
  if (sentences.length === 0) return '';
  return dedupeSentences(sentences).join(' ');
};

const toParagraphs = (text: string) => {
  const sentences = extractCompleteSentences(text);
  if (sentences.length === 0) return [];
  const deduped = dedupeSentences(sentences);
  const paragraphs: string[] = [];
  for (let i = 0; i < deduped.length; i += 3) {
    paragraphs.push(deduped.slice(i, i + 3).join(' ').trim());
  }
  return paragraphs;
};

const ArticleView = () => {
  const { id } = useParams();
  const article = useGameStore(s => s.feed.articles.find(a => a.id === id));
  const feedLoaded = useGameStore(s => s.feed.loaded);
  const { updateQuestProgress, hydrateArticleContent } = useGameStore();
  const [scrollProgress, setScrollProgress] = useState(0);
  const [xpAwarded, setXpAwarded] = useState(false);
  const [gameplayLoading, setGameplayLoading] = useState(false);
  const { speak, stop, supported } = useSpeechSynthesis();

  useEffect(() => {
    const handleScroll = () => {
      const el = document.documentElement;
      const progress = el.scrollTop / (el.scrollHeight - el.clientHeight);
      setScrollProgress(Math.min(progress, 1));
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (scrollProgress >= 0.95 && !xpAwarded && article) {
      setXpAwarded(true);
      updateQuestProgress('read');
      markUpscArticleCompleted(article.id);
      recordReadProgress(article.xpReward, { title: article.headline, category: article.category });
    }
  }, [scrollProgress, xpAwarded, article, updateQuestProgress]);

  useEffect(() => {
    if (!article || article.quiz.length || gameplayLoading) return;

    let cancelled = false;
    setGameplayLoading(true);
    hydrateArticleContent(article.id, buildFastGameplay(article));

    generateArticleGameplay(article)
      .then((content) => {
        if (!cancelled) {
          hydrateArticleContent(article.id, content);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setGameplayLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [article, gameplayLoading, hydrateArticleContent]);

  if (!article) return <div className="min-h-screen bg-nq-void flex items-center justify-center text-foreground">{feedLoaded ? 'Article not found' : 'Loading article...'}</div>;

  const readSummary = dedupeTextSentences(article.summary || article.headline);
  const readBodyParagraphs = toParagraphs(
    dedupeTextSentences(article.fullContent || article.summary || article.headline),
  );

  const articleSpeechText = [article.headline, article.fullContent ?? article.summary]
    .filter(Boolean)
    .join('. ');

  const handleStartSpeech = () => {
    if (!supported) return;
    speak(articleSpeechText);
  };

  const handleStopSpeech = () => {
    stop();
  };

  return (
    <div className="min-h-screen bg-nq-void grain-overlay">
      <HUDBar />
      {/* Reading progress bar */}
      <div className="fixed top-[60px] left-0 right-0 h-[3px] bg-nq-elevated z-40">
        <motion.div className="h-full bg-nq-cyan glow-cyan" style={{ width: `${scrollProgress * 100}%` }} />
      </div>

      <div className="pt-24 pb-32 max-w-[900px] mx-auto px-4">
        <Link to="/home" className="inline-flex items-center gap-2 text-sm text-nq-text-secondary hover:text-nq-cyan mb-6 transition-colors">
          <ArrowLeft size={16} /> Back to feed
        </Link>

        <div className="flex items-center gap-2 mb-4">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-display font-bold bg-nq-cyan/20 text-nq-cyan">{article.category}</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-display border border-nq-orange/30 text-nq-orange">{article.difficulty}</span>
          <span className="flex items-center gap-1 text-xs text-nq-text-muted ml-auto"><Clock size={12} />{article.readTime}</span>
        </div>

        <h1 className="font-display text-3xl md:text-5xl font-bold text-foreground mb-4 leading-tight">{article.headline}</h1>
        <div className="flex items-center gap-3 mb-6 text-sm text-nq-text-secondary flex-wrap">
          <span>{article.source}</span>
          <span>•</span>
          <span>{article.publishedAt}</span>
          <span className="ml-auto font-display text-nq-cyan">+{article.xpReward} XP</span>
        </div>

        <GlassCard hover={false} className="mb-8 border-nq-cyan/20 p-5 md:p-6">
          <p className="text-xs uppercase tracking-[0.28em] text-nq-text-muted mb-3">Summary</p>
          <p className="text-lg md:text-xl leading-[1.8] text-foreground">
            {readSummary}
          </p>
        </GlassCard>

        <article className="space-y-5">
          {readBodyParagraphs.map((p, i) => (
            <p key={i} className="text-base md:text-lg leading-[1.95] text-nq-text-primary/90">
              {p}
            </p>
          ))}
        </article>

        {/* Post-read CTA */}
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={scrollProgress > 0.5 ? { y: 0, opacity: 1 } : {}}
          className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-40"
        >
          <GlassCard hover={false} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <Link to={`/quiz/${article.id}`}>
              <motion.button whileTap={{ scale: 0.94 }} className="px-4 py-2 rounded-lg font-display text-xs font-bold bg-nq-purple/20 text-nq-purple border border-nq-purple/30 hover:glow-purple transition-all">
                TAKE QUIZ +30XP
              </motion.button>
            </Link>
            <Link to={`/predict/${article.id}`}>
              <motion.button whileTap={{ scale: 0.94 }} className="px-4 py-2 rounded-lg font-display text-xs font-bold bg-nq-orange/20 text-nq-orange border border-nq-orange/30 hover:glow-orange transition-all">
                PREDICT
              </motion.button>
            </Link>
            <motion.button
              whileTap={{ scale: 0.94 }}
              className="px-4 py-2 rounded-lg font-display text-xs font-bold bg-nq-cyan/20 text-nq-cyan border border-nq-cyan/30 hover:glow-cyan transition-all"
              onClick={handleStartSpeech}
            >
              🔊 LISTEN
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.94 }}
              className="px-4 py-2 rounded-lg font-display text-xs font-bold bg-nq-text-secondary/10 text-nq-text-secondary border border-nq-text-secondary/20 hover:bg-nq-text-secondary/15 transition-all"
              onClick={handleStopSpeech}
            >
              STOP
            </motion.button>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
};

export default ArticleView;
