import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Lock } from 'lucide-react';

import { GlassCard } from '@/components/game/GlassCard';
import { buildFastGameplay } from '@/lib/articleGameplay';
import { generateArticleGameplay } from '@/lib/newsApi';
import { recordPredictionProgress } from '@/lib/progressSync';
import { useAuthStore } from '@/store/useAuthStore';
import { useGameStore } from '@/store/gameStore';

type OptionVisualState = 'default' | 'selected' | 'correct' | 'wrong' | 'dimmed';

const confidenceLabel = (value: number) => (
  value <= 30
    ? 'Just a guess'
    : value <= 60
      ? 'Moderate'
      : value <= 85
        ? 'High'
        : 'All in'
);

const getOptionVisualState = (
  index: number,
  selected: number | null,
  submitted: boolean,
  correctIndex: number | null,
): OptionVisualState => {
  if (!submitted) return selected === index ? 'selected' : 'default';
  if (correctIndex !== null && index === correctIndex) return 'correct';
  if (selected !== null && index === selected && selected !== correctIndex) return 'wrong';
  return 'dimmed';
};

const optionClassByState: Record<OptionVisualState, string> = {
  default: 'border-border/30 hover:border-nq-orange/30',
  selected: 'border-nq-orange bg-nq-orange/10 glow-orange',
  correct: 'border-emerald-400 bg-emerald-500/15 text-emerald-100',
  wrong: 'border-red-400 bg-red-500/15 text-red-100',
  dimmed: 'border-border/20 opacity-70',
};

const PredictionView = () => {
  const { id } = useParams();
  const article = useGameStore((state) => state.feed.articles.find((entry) => entry.id === id));
  const feedLoaded = useGameStore((state) => state.feed.loaded);
  const { updateQuestProgress, hydrateArticleContent } = useGameStore();
  const authUser = useAuthStore((state) => state.user);

  const [selected, setSelected] = useState<number | null>(null);
  const [confidence, setConfidence] = useState(50);
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [loadingGameplay, setLoadingGameplay] = useState(false);

  useEffect(() => {
    setSelected(null);
    setConfidence(50);
    setSubmitted(false);
    setIsCorrect(null);
    setResultMessage(null);
  }, [article?.id]);

  useEffect(() => {
    if (!article || article.prediction || loadingGameplay) return;

    let cancelled = false;
    setLoadingGameplay(true);
    hydrateArticleContent(article.id, buildFastGameplay(article));
    generateArticleGameplay(article)
      .then((content) => {
        if (!cancelled) hydrateArticleContent(article.id, content);
      })
      .finally(() => {
        if (!cancelled) setLoadingGameplay(false);
      });

    return () => {
      cancelled = true;
    };
  }, [article, loadingGameplay, hydrateArticleContent]);

  if (!article) {
    return (
      <div className="min-h-screen bg-nq-void flex items-center justify-center text-foreground">
        {feedLoaded ? 'No prediction available' : 'Loading article...'}
      </div>
    );
  }

  const fallback = !article.prediction ? buildFastGameplay(article) : null;
  const prediction = article.prediction ?? fallback?.prediction ?? null;
  if (!prediction) {
    return (
      <div className="min-h-screen bg-nq-void flex items-center justify-center text-foreground">
        Generating prediction...
      </div>
    );
  }

  const pred = prediction;
  const xpPreview = Math.round((confidence / 100) * pred.xpReward);
  const correctIndex = typeof pred.resolvedAnswer === 'number'
    && Number.isInteger(pred.resolvedAnswer)
    && pred.resolvedAnswer >= 0
    && pred.resolvedAnswer < pred.options.length
    ? pred.resolvedAnswer
    : null;

  const handleLockPrediction = () => {
    if (!authUser || selected === null || submitted) return;

    if (correctIndex === null) {
      setResultMessage('Answer key unavailable for this prediction.');
      setIsCorrect(null);
      return;
    }

    const correct = selected === correctIndex;
    const earnedXp = correct ? pred.xpReward : Math.max(5, Math.round(pred.xpReward * 0.2));

    updateQuestProgress('predict');
    recordPredictionProgress(correct, earnedXp, {
      title: article.headline,
      category: article.category,
    });

    setSubmitted(true);
    setIsCorrect(correct);
    setResultMessage(correct ? 'Correct ✅' : 'Wrong ❌');
  };

  return (
    <div className="min-h-screen grain-overlay flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, hsl(240 33% 5%), hsl(25 100% 8%))' }}>
      <div className="max-w-[640px] w-full">
        <div className="flex items-center justify-between mb-6">
          <Link to={`/article/${article.id}`} className="text-nq-text-secondary hover:text-foreground"><ArrowLeft size={20} /></Link>
          <span className="font-display text-sm font-bold text-nq-orange text-glow-orange">THE ORACLE CHALLENGE</span>
          <div />
        </div>

        <GlassCard hover={false} className="py-6 border-nq-orange/20">
          <p className="text-xs text-nq-text-muted mb-3 uppercase">Based on: {article.headline}</p>
          <h2 className="font-display text-lg font-bold text-foreground mb-6">{pred.question}</h2>

          <div className="space-y-3 mb-6">
            {pred.options.map((option, index) => {
              const visualState = getOptionVisualState(index, selected, submitted, correctIndex);
              return (
                <motion.button
                  key={option}
                  whileTap={submitted ? undefined : { scale: 0.96 }}
                  onClick={() => {
                    if (!submitted) setSelected(index);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-lg glass border-2 transition-all ${optionClassByState[visualState]}`}
                >
                  <span className="text-sm">{option}</span>
                </motion.button>
              );
            })}
          </div>

          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="font-display text-xs text-nq-text-secondary">CONFIDENCE</span>
              <span className="font-mono text-sm text-nq-orange font-bold">{confidence}%</span>
            </div>
            <input
              type="range"
              min={1}
              max={100}
              value={confidence}
              onChange={(event) => setConfidence(Number(event.target.value))}
              className="w-full accent-[#FF6B00]"
              disabled={submitted}
            />
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-nq-text-muted">{confidenceLabel(confidence)}</span>
              <span className="font-display text-xs text-nq-orange">+{xpPreview} XP</span>
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={handleLockPrediction}
            disabled={selected === null || submitted}
            className="w-full py-3 rounded-lg font-display font-bold bg-nq-orange/20 text-nq-orange border border-nq-orange/30 hover:bg-nq-orange/30 hover:glow-orange transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <Lock size={16} /> {submitted ? 'PREDICTION LOCKED' : 'LOCK IN PREDICTION'}
          </motion.button>

          {resultMessage && (
            <p className={`mt-3 text-sm font-semibold ${isCorrect === null ? 'text-nq-text-secondary' : isCorrect ? 'text-emerald-300' : 'text-red-300'}`}>
              {resultMessage}
            </p>
          )}
        </GlassCard>
      </div>
    </div>
  );
};

export default PredictionView;
