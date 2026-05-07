import { useParams, Link } from 'react-router-dom';
import { useGameStore } from '@/store/gameStore';
import { useAuthStore } from '@/store/useAuthStore';
import { generateArticleGameplay } from '@/lib/newsApi';
import { buildFastGameplay } from '@/lib/articleGameplay';
import { recordPredictionOutcome, recordPredictionProgress } from '@/lib/progressSync';
import { resolvePrediction as resolvePredictionFromApi } from '@/lib/predictionApi';
import { GlassCard } from '@/components/game/GlassCard';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { ArrowLeft, Lock } from 'lucide-react';

const confidenceLabel = (v: number) => v <= 30 ? 'Just a guess' : v <= 60 ? 'Moderate' : v <= 85 ? 'High' : 'ALL IN 🔥';

const PredictionView = () => {
  const { id } = useParams();
  const article = useGameStore(s => s.feed.articles.find(a => a.id === id));
  const feedLoaded = useGameStore(s => s.feed.loaded);
  const { updateQuestProgress, hydrateArticleContent } = useGameStore();
  const authUser = useAuthStore((s) => s.user);
  const [selected, setSelected] = useState<number | null>(null);
  const [confidence, setConfidence] = useState(50);
  const [submitted, setSubmitted] = useState(false);
  const [resolvedIndex, setResolvedIndex] = useState<number | null>(null);
  const [probabilities, setProbabilities] = useState<number[]>([]);
  const [resolutionReason, setResolutionReason] = useState<string>('');
  const [loadingGameplay, setLoadingGameplay] = useState(false);
  const [resolving, setResolving] = useState(false);

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

  if (!article) return <div className="min-h-screen bg-nq-void flex items-center justify-center text-foreground">{feedLoaded ? 'No prediction available' : 'Loading article...'}</div>;
  const fallback = !article.prediction ? buildFastGameplay(article) : null;
  const prediction = article.prediction ?? fallback?.prediction ?? null;
  if (!prediction) return <div className="min-h-screen bg-nq-void flex items-center justify-center text-foreground">Generating prediction...</div>;

  const pred = prediction;
  const xpPreview = Math.round((confidence / 100) * pred.xpReward);
  const selectedProbability = selected !== null ? probabilities[selected] ?? 0 : 0;
  const resolvedProbability = resolvedIndex !== null ? probabilities[resolvedIndex] ?? 0 : 0;
  const isCorrect = submitted && selected !== null && resolvedIndex !== null ? selected === resolvedIndex : false;

  const handleLock = async () => {
    if (selected === null || !authUser) return;
    setResolving(true);
    updateQuestProgress('predict');
    recordPredictionProgress(false, xpPreview, {
      title: article.headline,
      category: article.category,
    });
    try {
      const response = await resolvePredictionFromApi({
        headline: article.headline,
        summary: article.summary,
        question: pred.question,
        options: pred.options,
        category: article.category,
      });
      const correct = selected === response.resolvedIndex;
      const bonusXp = correct
        ? Math.max(0, pred.xpReward - xpPreview)
        : Math.max(5, Math.round(pred.xpReward * 0.2));
      recordPredictionOutcome(correct, bonusXp);
      setResolvedIndex(response.resolvedIndex);
      setProbabilities(Array.isArray(response.probabilities) ? response.probabilities : []);
      setResolutionReason(response.reason);
      setSubmitted(true);
    } finally {
      setResolving(false);
    }
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

          {!submitted ? (
            <>
              <div className="space-y-3 mb-6">
                {pred.options.map((opt, i) => (
                  <motion.button
                    key={i}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setSelected(i)}
                    className={`w-full text-left px-4 py-3 rounded-lg glass border-2 transition-all ${selected === i ? 'border-nq-orange bg-nq-orange/10 glow-orange' : 'border-border/30 hover:border-nq-orange/30'}`}
                  >
                    <span className="text-sm text-foreground">{opt}</span>
                  </motion.button>
                ))}
              </div>

              {/* Confidence slider */}
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
                  onChange={e => setConfidence(Number(e.target.value))}
                  className="w-full accent-[#FF6B00]"
                />
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-nq-text-muted">{confidenceLabel(confidence)}</span>
                  <span className="font-display text-xs text-nq-orange">+{xpPreview} XP</span>
                </div>
              </div>

              <motion.button
                whileTap={{ scale: 0.94 }}
                onClick={() => { void handleLock(); }}
                disabled={selected === null || resolving}
                className="w-full py-3 rounded-lg font-display font-bold bg-nq-orange/20 text-nq-orange border border-nq-orange/30 hover:bg-nq-orange/30 hover:glow-orange transition-all disabled:opacity-30 flex items-center justify-center gap-2"
              >
                <Lock size={16} /> {resolving ? 'CHECKING WITH QWEN...' : 'LOCK IN PREDICTION'}
              </motion.button>
            </>
          ) : (
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-6">
              <div className={`font-display text-4xl font-black mb-3 ${isCorrect ? 'text-auth-success' : 'text-auth-error'}`}>
                {isCorrect ? 'RIGHT ✅' : 'WRONG ❌'}
              </div>
              <p className="text-sm text-nq-text-secondary mb-2">Your prediction: <span className="text-foreground">{pred.options[selected!]}</span></p>
              <p className="text-sm text-nq-text-secondary mb-4">Confidence: <span className="font-mono text-nq-orange">{confidence}%</span></p>
              <p className="text-xs text-nq-text-secondary mb-2">
                Qwen probability for your pick: <span className="text-nq-orange font-bold">{selectedProbability}%</span>
              </p>
              <p className="text-xs text-nq-text-secondary mb-4">
                Most likely outcome now: <span className="text-foreground">{resolvedIndex !== null ? pred.options[resolvedIndex] : '-'}</span>{' '}
                (<span className="text-nq-cyan font-bold">{resolvedProbability}%</span>)
              </p>
              {resolutionReason && (
                <p className="text-[11px] text-nq-text-muted leading-5 mb-4">{resolutionReason}</p>
              )}
              <div className="mt-6 flex gap-3 justify-center">
                <Link to="/home">
                  <motion.button whileTap={{ scale: 0.94 }} className="px-4 py-2 rounded-lg font-display text-xs font-bold bg-nq-cyan/20 text-nq-cyan border border-nq-cyan/30">BACK TO FEED</motion.button>
                </Link>
              </div>
            </motion.div>
          )}
        </GlassCard>
      </div>
    </div>
  );
};

export default PredictionView;
