import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { XPFloat } from "@/components/game/XPFloat";
import { LevelUpModal } from "@/components/game/LevelUpModal";
import { useAuthStore } from "@/store/useAuthStore";
import { calculateBadgesStatus, useGameStore } from "@/store/gameStore";
import { supabase } from "@/lib/supabase";
import { BattleSocketProvider } from "@/hooks/BattleSocketProvider";
import { buildUserDataFromSupabaseUser } from "@/lib/supabaseUser";
import { syncProfileToDatabase } from "@/lib/profileApi";
import { getLastActiveAvatarId } from "@/data/avatars";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import HomeFeed from "./pages/HomeFeed";
import ArticleView from "./pages/ArticleView";
import QuizView from "./pages/QuizView";
import PredictionView from "./pages/PredictionView";
import Dashboard from "./pages/Dashboard";
import Leaderboard from "./pages/Leaderboard";
import Profile from "./pages/Profile";
import UPSCMode from "./pages/UPSCMode";
import AvatarEditor from "./pages/AvatarEditor";
import BattleLobby from "./pages/BattleLobby";
import BattleArena from "./pages/BattleArena";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const getUtcDay = (value?: string | null) => {
  if (!value) return new Date().toISOString().slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
};

const getUtcYesterday = () => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

const calculateNextStreak = (lastActiveDate: string | null | undefined, currentStreak: number) => {
  const today = new Date().toISOString().slice(0, 10);
  if (!lastActiveDate) return 1;
  const lastDay = getUtcDay(lastActiveDate);
  if (lastDay === today) return Math.max(1, currentStreak);
  if (lastDay === getUtcYesterday()) return Math.max(1, currentStreak) + 1;
  return 1;
};

const RequireAuth = ({ children }: { children: ReactNode }) => {
  const user = useAuthStore((s) => s.user);
  return user ? children : <Navigate to="/login" replace />;
};

const PublicOnly = ({ children }: { children: ReactNode }) => {
  const user = useAuthStore((s) => s.user);
  return user ? <Navigate to="/home" replace /> : children;
};

const RootRedirect = () => {
  return <Navigate to="/login" replace />;
};

const FeedBootstrap = () => {
  const user = useAuthStore((s) => s.user);
  const loaded = useGameStore((s) => s.feed.loaded);
  const loadLiveFeed = useGameStore((s) => s.loadLiveFeed);

  useEffect(() => {
    if (user && !loaded) {
      void loadLiveFeed();
    }
  }, [user, loaded, loadLiveFeed]);

  return null;
};

const App = () => (
  <AppShell />
);

const AppShell = () => {
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);
  const authUser = useAuthStore((s) => s.user);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [authReady, setAuthReady] = useState(false);
  const lastProfileSyncSignature = useRef<string>("");
  const lastStreakWriteKey = useRef<string>("");

  useEffect(() => {
    let active = true;

    const syncSession = (session: Session | null) => {
      if (!active) return;

      if (session?.user) {
        const oauthUser = buildUserDataFromSupabaseUser(session.user);

        const now = new Date().toISOString();
        const nextStreak = calculateNextStreak(oauthUser.lastActiveDate, oauthUser.streakCount);

        const updatedOauthUser = {
          ...oauthUser,
          streakCount: nextStreak,
          lastActiveDate: now,
        };

        const today = now.slice(0, 10);
        const lastActiveDay = oauthUser.lastActiveDate ? getUtcDay(oauthUser.lastActiveDate) : null;
        const shouldUpdateDailyStreak = lastActiveDay !== today;

        // Write streak metadata only once per user/day to avoid auth update loops.
        if (shouldUpdateDailyStreak) {
          const streakWriteKey = `${updatedOauthUser.id}:${today}`;
          if (lastStreakWriteKey.current !== streakWriteKey) {
            lastStreakWriteKey.current = streakWriteKey;
            void supabase.auth.updateUser({
              data: {
                streak_count: updatedOauthUser.streakCount,
                last_active_date: updatedOauthUser.lastActiveDate,
              },
            }).catch(() => {
              lastStreakWriteKey.current = "";
            });
          }
        }

        const profileSyncSignature = [
          updatedOauthUser.id,
          updatedOauthUser.currentLevel,
          updatedOauthUser.totalXP,
          updatedOauthUser.streakCount,
          getUtcDay(updatedOauthUser.lastActiveDate),
        ].join(":");
        if (lastProfileSyncSignature.current !== profileSyncSignature) {
          lastProfileSyncSignature.current = profileSyncSignature;
          void syncProfileToDatabase(updatedOauthUser).catch(() => {
            lastProfileSyncSignature.current = "";
          });
        }

        login(updatedOauthUser);
        useGameStore.setState((state) => ({
          user: {
            ...state.user,
            id: updatedOauthUser.id,
            username: updatedOauthUser.username,
            currentLevel: updatedOauthUser.currentLevel,
            totalXP: updatedOauthUser.totalXP,
            xpToNextLevel: updatedOauthUser.xpToNextLevel,
            streakCount: updatedOauthUser.streakCount,
            lastActiveDate: updatedOauthUser.lastActiveDate,
            articlesRead: updatedOauthUser.articlesRead,
            quizzesTotal: updatedOauthUser.quizzesTotal,
            quizzesCorrect: updatedOauthUser.quizzesCorrect,
            predictionsTotal: updatedOauthUser.predictionsTotal,
            predictionsCorrect: updatedOauthUser.predictionsCorrect,
            badges: calculateBadgesStatus(updatedOauthUser.totalXP, updatedOauthUser.badges),
            avatarId: updatedOauthUser.avatarId,
            avatarBody: "scout",
            focusMode: "both",
            dailyTarget: updatedOauthUser.dailyGoal,
            onboarded: true,
          },
        }));
      } else if (currentUserId) {
        lastProfileSyncSignature.current = "";
        lastStreakWriteKey.current = "";
        logout();
      }

      setAuthReady(true);
    };

    void supabase.auth.getSession().then(({ data }) => syncSession(data.session));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      syncSession(session);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [currentUserId, login, logout]);

  useEffect(() => {
    if (!authUser) return;

    useGameStore.setState((state) => ({
      user: {
        ...state.user,
        id: authUser.id,
        username: authUser.username,
        currentLevel: authUser.currentLevel,
        totalXP: authUser.totalXP,
        xpToNextLevel: authUser.xpToNextLevel,
        streakCount: authUser.streakCount,
        lastActiveDate: authUser.lastActiveDate ?? state.user.lastActiveDate,
        articlesRead: authUser.articlesRead,
        quizzesTotal: authUser.quizzesTotal,
        quizzesCorrect: authUser.quizzesCorrect,
        predictionsTotal: authUser.predictionsTotal,
        predictionsCorrect: authUser.predictionsCorrect,
        badges: calculateBadgesStatus(authUser.totalXP, authUser.badges),
        avatarId: authUser.avatarId ?? getLastActiveAvatarId() ?? state.user.avatarId,
        avatarBody: "scout",
        focusMode: "both",
        dailyTarget: authUser.dailyGoal,
        onboarded: true,
      },
    }));
  }, [authUser]);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-nq-void flex items-center justify-center text-sm text-nq-text-secondary">
        Syncing Supabase session...
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <XPFloat />
        <LevelUpModal />
        <FeedBootstrap />
        <BattleSocketProvider>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes>
              <Route path="/" element={<RootRedirect />} />
              <Route path="/landing" element={<Landing />} />
              <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
              <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
              <Route path="/home" element={<RequireAuth><HomeFeed /></RequireAuth>} />
              <Route path="/article/:id" element={<RequireAuth><ArticleView /></RequireAuth>} />
              <Route path="/quiz/:id" element={<RequireAuth><QuizView /></RequireAuth>} />
              <Route path="/predict/:id" element={<RequireAuth><PredictionView /></RequireAuth>} />
              <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
              <Route path="/battle" element={<RequireAuth><BattleLobby /></RequireAuth>} />
              <Route path="/battle/:id" element={<RequireAuth><BattleArena /></RequireAuth>} />
              <Route path="/leaderboard" element={<RequireAuth><Leaderboard /></RequireAuth>} />
              <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
              <Route path="/upsc" element={<RequireAuth><UPSCMode /></RequireAuth>} />
              <Route path="/avatar-editor" element={<RequireAuth><AvatarEditor /></RequireAuth>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </BattleSocketProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
