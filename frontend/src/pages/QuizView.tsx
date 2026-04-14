import { useParams, Link } from 'react-router-dom';
import { useGameStore } from '@/store/gameStore';
import { generateArticleGameplay } from '@/lib/newsApi';
import { buildFastGameplay } from '@/lib/articleGameplay';
import { recordQuizProgress } from '@/lib/progressSync';
import { GlassCard } from '@/components/game/GlassCard';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, XCircle } from 'lucide-react';

const QuizView = () => {
  const { id } = useParams();
  const article = useGameStore(s => s.feed.articles.find(a => a.id === id));
  const feedLoaded = useGameStore(s => s.feed.loaded);
  const { updateQuestProgress, hydrateArticleContent } = useGameStore();
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [loadingGameplay, setLoadingGameplay] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState<ReturnType<typeof buildFastGameplay>['quiz']>([]);
  const generatedForArticleRef = useRef<string | null>(null);

  useEffect(() => {
    if (!article || loadingGameplay || generatedForArticleRef.current === article.id) return;

    let cancelled = false;
    const freshSeed = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    generatedForArticleRef.current = article.id;
    setLoadingGameplay(true);
    const fallback = buildFastGameplay(article);
    setActiveQuiz(fallback.quiz);

    generateArticleGameplay(article, { generalKnowledge: true, freshSeed })
      .then((content) => {
        if (!cancelled) {
          setActiveQuiz(content.quiz);
          hydrateArticleContent(article.id, content);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingGameplay(false);
      });

    return () => {
      cancelled = true;
    };
  }, [article, loadingGameplay, hydrateArticleContent]);

  if (!article) return <div className="min-h-screen bg-nq-void flex items-center justify-center text-foreground">{feedLoaded ? 'No quiz available' : 'Loading article...'}</div>;
  const fallback = !activeQuiz.length ? buildFastGameplay(article) : null;
  const quiz = activeQuiz.length ? activeQuiz : fallback?.quiz ?? [];
  if (!quiz.length) return <div className="min-h-screen bg-nq-void flex items-center justify-center text-foreground">Generating quiz...</div>;

  const question = quiz[currentQ];
  const isCorrect = selected === question.correct;

  const handleSubmit = () => {
    if (selected === null) return;
    setSubmitted(true);
    const correct = selected === question.correct;
    if (correct) {
      setScore(s => s + 1);
    }
    updateQuestProgress('quiz');
    recordQuizProgress(correct, correct ? 30 : 5, {
      title: article.headline,
      category: article.category,
    });
  };

  const handleNext = () => {
    if (currentQ + 1 >= quiz.length) {
      setFinished(true);
      return;
    }
    setCurrentQ(c => c + 1);
    setSelected(null);
    setSubmitted(false);
  };

  if (finished) {
    const accuracy = Math.round((score / quiz.length) * 100);
    return (
      <div className="min-h-screen bg-nq-void grain-overlay flex items-center justify-center p-4">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-md w-full text-center">
          <GlassCard hover={false} className="py-8">
            <motion.div className="font-display text-6xl font-black text-nq-cyan text-glow-cyan mb-4" initial={{ scale: 0.5 }} animate={{ scale: [0.5, 1.3, 1] }} transition={{ duration: 0.6 }}>
              {accuracy}%
            </motion.div>
            <p className="font-display text-lg font-bold text-foreground mb-2">{accuracy >= 80 ? 'EXCELLENT!' : accuracy >= 50 ? 'GOOD EFFORT!' : 'KEEP LEARNING!'}</p>
            <p className="text-sm text-nq-text-secondary mb-4">{score}/{quiz.length} correct</p>
            <div className="font-mono text-sm text-nq-purple mb-6">+{score * 30 + (quiz.length - score) * 5} XP earned</div>
            <div className="flex gap-3 justify-center">
              {article.prediction && (
                <Link to={`/predict/${article.id}`}>
                  <motion.button whileTap={{ scale: 0.94 }} className="px-4 py-2 rounded-lg font-display text-xs font-bold bg-nq-orange/20 text-nq-orange border border-nq-orange/30">PREDICT</motion.button>
                </Link>
              )}
              <Link to="/home">
                <motion.button whileTap={{ scale: 0.94 }} className="px-4 py-2 rounded-lg font-display text-xs font-bold bg-nq-cyan/20 text-nq-cyan border border-nq-cyan/30">BACK TO FEED</motion.button>
              </Link>
            </div>
          </GlassCard>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grain-overlay flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, hsl(240 33% 5%), hsl(263 84% 10%))' }}>
      <div className="max-w-[640px] w-full">
        {/* HUD */}
        <div className="flex items-center justify-between mb-6">
          <Link to={`/article/${article.id}`} className="text-nq-text-secondary hover:text-foreground transition-colors"><ArrowLeft size={20} /></Link>
          <span className="font-display text-sm font-bold text-nq-text-secondary">Q{currentQ + 1} of {quiz.length}</span>
          <span className="font-display text-sm font-bold text-nq-purple">+30 XP</span>
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={currentQ} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
            <GlassCard hover={false} className="py-6">
              <h2 className="font-display text-lg font-bold text-foreground mb-6">{question.question}</h2>
              <div className="space-y-3">
                {question.options.map((opt, i) => {
                  const letter = String.fromCharCode(65 + i);
                  let borderClass = 'border-border/30 hover:border-nq-purple/50';
                  if (submitted) {
                    if (i === question.correct) borderClass = 'border-nq-green bg-nq-green/10';
                    else if (i === selected) borderClass = 'border-nq-red bg-nq-red/10';
                  } else if (i === selected) {
                    borderClass = 'border-nq-purple bg-nq-purple/10 glow-purple';
                  }

                  return (
                    <motion.button
                      key={i}
                      whileTap={!submitted ? { scale: 0.96 } : undefined}
                      onClick={() => !submitted && setSelected(i)}
                      className={`w-full text-left px-4 py-3 rounded-lg glass border-2 transition-all flex items-center gap-3 ${borderClass}`}
                      animate={submitted && i === selected && !isCorrect ? { x: [0, -8, 8, -4, 4, 0] } : {}}
                      transition={{ duration: 0.4 }}
                    >
                      <span className="font-display text-sm font-bold text-nq-text-muted">{letter}</span>
                      <span className="text-sm text-foreground">{opt}</span>
                      {submitted && i === question.correct && <CheckCircle2 className="ml-auto text-nq-green" size={18} />}
                      {submitted && i === selected && i !== question.correct && <XCircle className="ml-auto text-nq-red" size={18} />}
                    </motion.button>
                  );
                })}
              </div>

              {/* Explanation */}
              <AnimatePresence>
                {submitted && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-4 p-4 rounded-lg bg-nq-elevated/50 border border-border/20">
                    <p className="text-sm text-nq-text-secondary">{question.explanation}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="mt-6 flex justify-end">
                {!submitted ? (
                  <motion.button whileTap={{ scale: 0.94 }} onClick={handleSubmit} disabled={selected === null} className="px-6 py-2.5 rounded-lg font-display font-bold text-sm bg-nq-purple/20 text-nq-purple border border-nq-purple/30 hover:glow-purple transition-all disabled:opacity-30">
                    SUBMIT
                  </motion.button>
                ) : (
                  <motion.button whileTap={{ scale: 0.94 }} onClick={handleNext} className="px-6 py-2.5 rounded-lg font-display font-bold text-sm bg-nq-cyan/20 text-nq-cyan border border-nq-cyan/30 hover:glow-cyan transition-all">
                    {currentQ + 1 >= quiz.length ? 'SEE RESULTS' : 'NEXT'}
                  </motion.button>
                )}
              </div>
            </GlassCard>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default QuizView;
