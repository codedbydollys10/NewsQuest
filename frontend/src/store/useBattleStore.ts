import { create } from 'zustand';
import type { BattleQuestion } from '@/data/battleQuestions';

export interface Opponent {
  id: string;
  username: string;
  avatarId: number;
  level: number;
  battleRating: number;
  tier: string;
  quizAccuracy: number;
  predictionAccuracy: number;
  winRate: number;
  totalBattles: number;
  wins: number;
  losses: number;
  draws: number;
  recentForm: string[];
  isOnline: boolean;
  lastSeen: string;
  socketId?: string;
}

export type BattleMode = 'quiz' | 'prediction' | 'mixed' | null;
export type BattleStatus = 'idle' | 'searching' | 'found' | 'countdown' | 'pre_battle' | 'active' | 'revealing' | 'finished';

export interface RoundResult {
  questionId: string;
  playerAnswer: string | null;
  opponentAnswer: string | null;
  correctAnswer: string;
  playerCorrect: boolean;
  opponentCorrect: boolean;
  playerConfidence: number | null;
  opponentConfidence: number | null;
  playerFirst: boolean;
  playerPoints: number;
  opponentPoints: number;
}

interface BattleState {
  // Lobby
  status: BattleStatus;
  mode: BattleMode;
  opponent: Opponent | null;
  categories: string[];
  timerSpeed: number;
  battleId: string | null;
  countdown: number;
  searchTime: number;

  // Game state
  questions: BattleQuestion[];
  currentQuestion: number;
  totalQuestions: number;
  playerScore: number;
  opponentScore: number;
  playerHP: number;
  opponentHP: number;
  playerAnswered: boolean;
  opponentAnswered: boolean;
  playerAnswer: string | null;
  opponentAnswer: string | null;
  playerConfidence: number;
  opponentConfidence: number;
  roundResults: RoundResult[];
  momentumCount: number;
  opponentMomentum: number;
  isOnFire: boolean;
  opponentOnFire: boolean;
  timeRemaining: number;

  // End state
  result: 'win' | 'loss' | 'draw' | null;
  xpEarned: number;
  brChange: number;

  // Actions
  setMode: (m: BattleMode) => void;
  setStatus: (s: BattleStatus) => void;
  setOpponent: (o: Opponent | null) => void;
  setCategories: (c: string[]) => void;
  setTimerSpeed: (t: number) => void;
  setBattleId: (id: string | null) => void;
  setCountdown: (n: number) => void;
  setSearchTime: (n: number) => void;
  setQuestions: (q: BattleQuestion[]) => void;
  setCurrentQuestion: (n: number) => void;
  lockInAnswer: (answer: string) => void;
  lockInOpponentAnswer: (answer: string) => void;
  setPlayerConfidence: (n: number) => void;
  setOpponentConfidence: (n: number) => void;
  setTimeRemaining: (n: number) => void;
  applyRoundResult: (result: RoundResult) => void;
  nextQuestion: () => void;
  endBattle: (result: 'win' | 'loss' | 'draw', xp: number, br: number) => void;
  startGame: (questions: BattleQuestion[]) => void;
  reset: () => void;
}

const initialGameState = {
  questions: [] as BattleQuestion[],
  currentQuestion: 0,
  totalQuestions: 5,
  playerScore: 0,
  opponentScore: 0,
  playerHP: 100,
  opponentHP: 100,
  playerAnswered: false,
  opponentAnswered: false,
  playerAnswer: null as string | null,
  opponentAnswer: null as string | null,
  playerConfidence: 50,
  opponentConfidence: 50,
  roundResults: [] as RoundResult[],
  momentumCount: 0,
  opponentMomentum: 0,
  isOnFire: false,
  opponentOnFire: false,
  timeRemaining: 30,
  result: null as 'win' | 'loss' | 'draw' | null,
  xpEarned: 0,
  brChange: 0,
};

export const useBattleStore = create<BattleState>((set) => ({
  status: 'idle',
  mode: null,
  opponent: null,
  categories: ['All'],
  timerSpeed: 30,
  battleId: null,
  countdown: 3,
  searchTime: 0,
  ...initialGameState,

  setMode: (mode) => set({ mode }),
  setStatus: (status) => set({ status }),
  setOpponent: (opponent) => set({ opponent }),
  setCategories: (categories) => set({ categories }),
  setTimerSpeed: (timerSpeed) => set({ timerSpeed }),
  setBattleId: (battleId) => set({ battleId }),
  setCountdown: (countdown) => set({ countdown }),
  setSearchTime: (searchTime) => set({ searchTime }),
  setQuestions: (questions) => set({ questions, totalQuestions: questions.length }),
  setCurrentQuestion: (currentQuestion) => set({ currentQuestion }),
  setTimeRemaining: (timeRemaining) => set({ timeRemaining }),
  setPlayerConfidence: (playerConfidence) => set({ playerConfidence }),
  setOpponentConfidence: (opponentConfidence) => set({ opponentConfidence }),

  lockInAnswer: (answer) => set({ playerAnswer: answer, playerAnswered: true }),
  lockInOpponentAnswer: (answer) => set({ opponentAnswer: answer, opponentAnswered: true }),

  applyRoundResult: (result) =>
    set((s) => {
      const newMomentum = result.playerCorrect ? s.momentumCount + 1 : 0;
      const newOppMomentum = result.opponentCorrect ? s.opponentMomentum + 1 : 0;
      const currentQuestion = s.questions[s.currentQuestion];
      const hpDamage = currentQuestion?.hpDamage ?? 15;
      return {
        playerScore: s.playerScore + result.playerPoints,
        opponentScore: s.opponentScore + result.opponentPoints,
        playerHP: Math.max(0, s.playerHP - (result.playerCorrect ? 0 : hpDamage)),
        opponentHP: Math.max(0, s.opponentHP - (result.opponentCorrect ? 0 : hpDamage)),
        roundResults: [...s.roundResults, result],
        momentumCount: newMomentum,
        opponentMomentum: newOppMomentum,
        isOnFire: newMomentum >= 3,
        opponentOnFire: newOppMomentum >= 3,
      };
    }),

  nextQuestion: () =>
    set((s) => ({
      currentQuestion: s.currentQuestion + 1,
      playerAnswered: false,
      opponentAnswered: false,
      playerAnswer: null,
      opponentAnswer: null,
      playerConfidence: 50,
      opponentConfidence: 50,
      timeRemaining: s.timerSpeed,
    })),

  startGame: (questions) =>
    set((s) => ({
      ...initialGameState,
      questions,
      totalQuestions: questions.length,
      timeRemaining: s.timerSpeed,
      status: 'pre_battle',
    })),

  endBattle: (result, xpEarned, brChange) =>
    set({ status: 'finished', result, xpEarned, brChange }),

  reset: () =>
    set({
      status: 'idle',
      mode: null,
      opponent: null,
      battleId: null,
      countdown: 3,
      searchTime: 0,
      ...initialGameState,
    }),
}));