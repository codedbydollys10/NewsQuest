import { create } from 'zustand';
import { useGameStore, initialGameState } from '@/store/gameStore';

export interface UserData {
  id: string;
  username: string;
  email: string;
  joinDate: string;
  avatarId: number;
  avatarCustomization: { skinTone: number; trailColor: string };
  currentLevel: number;
  totalXP: number;
  xpToNextLevel: number;
  streakCount: number;
  lastActiveDate: string | null;
  interests: string[];
  dailyGoal: number;
  mode: string;
  badges: string[];
  articlesRead: number;
  quizzesTotal: number;
  quizzesCorrect: number;
  predictionsTotal: number;
  predictionsCorrect: number;
  battleRating: number;
  battleTier: string;
  wins: number;
  losses: number;
  draws: number;
  recentForm: string[];
}

interface AuthState {
  user: UserData | null;
  isAuthenticated: boolean;
  login: (user: UserData) => void;
  logout: () => void;
  updateUser: (data: Partial<UserData>) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  login: (user) => set({ user, isAuthenticated: true }),
  logout: () => {
    set({ user: null, isAuthenticated: false });
    useGameStore.setState(initialGameState);
  },
  updateUser: (data) =>
    set((state) => {
      const updated = state.user ? { ...state.user, ...data } : null;
      return { user: updated };
    }),
}));
