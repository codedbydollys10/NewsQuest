import type { BattleQuestion } from '@/data/battleQuestions';
import type { Opponent, RoundResult, BattleStatus, BattleMode } from '@/store/useBattleStore';
import type { UserData } from '@/store/useAuthStore';

const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '/api';
const apiUrl = (path: string) => `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

export interface BattleViewPlayer {
  userId: string;
  username: string;
  avatarId: number;
  battleRating: number;
  battleTier: string;
  score: number;
  hp: number;
  answered: boolean;
  answer: string | null;
  confidence: number;
  momentum: number;
  onFire: boolean;
}

export interface BattleView {
  id: string;
  status: BattleStatus;
  mode: BattleMode;
  categories: string[];
  timerSpeed: number;
  questions: BattleQuestion[];
  currentQuestion: number;
  totalQuestions: number;
  timeRemaining: number;
  startsAt: number;
  revealMs: number;
  result: 'win' | 'loss' | 'draw' | null;
  xpEarned: number;
  brChange: number;
  player: BattleViewPlayer;
  opponent: BattleViewPlayer;
  roundResults: RoundResult[];
}

export interface BattleInviteSummary {
  id: string;
  from: Opponent;
  mode: BattleMode;
  categories: string[];
  timerSpeed: number;
  createdAt: number;
}

export interface BattleSessionResponse {
  onlineUsers: Opponent[];
  queue: { status: 'idle' | 'waiting'; queuedAt?: number };
  incomingInvites: BattleInviteSummary[];
  battle: BattleView | null;
}

type RawOpponent = {
  userId: string;
  username: string;
  avatarId: number;
  battleRating: number;
  battleTier: string;
  isOnline?: boolean;
  lastSeen?: string;
};

type RawBattleSessionResponse = {
  success: boolean;
  onlineUsers?: RawOpponent[];
  queue: { status: 'idle' | 'waiting'; queuedAt?: number };
  incomingInvites?: Array<{
    id: string;
    from: Opponent;
    mode: BattleMode;
    categories: string[];
    timerSpeed: number;
    createdAt: number;
  }>;
  battle: BattleView | null;
};

const toOpponent = (entry: {
  userId: string;
  username: string;
  avatarId: number;
  battleRating: number;
  battleTier: string;
  isOnline?: boolean;
  lastSeen?: string;
}): Opponent => ({
  id: entry.userId,
  username: entry.username,
  avatarId: entry.avatarId,
  level: Math.max(1, Math.round(entry.battleRating / 100)),
  battleRating: entry.battleRating,
  tier: entry.battleTier,
  quizAccuracy: Math.min(95, Math.max(35, Math.round(entry.battleRating / 20))),
  predictionAccuracy: Math.min(95, Math.max(35, Math.round(entry.battleRating / 22))),
  winRate: 50,
  totalBattles: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  recentForm: [],
  isOnline: entry.isOnline ?? true,
  lastSeen: entry.lastSeen ?? new Date().toISOString(),
});

const postJson = async <T>(path: string, body: unknown): Promise<T> => {
  const response = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return response.json() as Promise<T>;
};

export const reportBattlePresence = (user: UserData) =>
  postJson<{ success: boolean; onlineUsers: Opponent[] }>('/battle/presence', {
    userId: user.id,
    username: user.username,
    avatarId: user.avatarId,
    battleRating: user.battleRating,
    battleTier: user.battleTier,
  });

export const fetchBattleSession = async (userId: string): Promise<BattleSessionResponse> => {
  const response = await fetch(apiUrl(`/battle/session?userId=${encodeURIComponent(userId)}`));
  const data = await response.json() as RawBattleSessionResponse;
  if (!response.ok || !data.success) {
    throw new Error('Failed to load battle session.');
  }
  return {
    ...data,
    onlineUsers: (data.onlineUsers ?? []).map(toOpponent),
    incomingInvites: (data.incomingInvites ?? []).map((invite) => ({
      ...invite,
      from: toOpponent({
        userId: invite.from.id,
        username: invite.from.username,
        avatarId: invite.from.avatarId,
        battleRating: invite.from.battleRating,
        battleTier: invite.from.tier,
      }),
    })),
  };
};

export const searchBattleUsers = async (userId: string, query: string, limit = 10): Promise<Opponent[]> => {
  const response = await fetch(
    apiUrl(`/battle/users/search?userId=${encodeURIComponent(userId)}&q=${encodeURIComponent(query)}&limit=${encodeURIComponent(String(limit))}`),
  );
  const data = await response.json() as {
    success: boolean;
    users?: Array<{
      userId: string;
      username: string;
      avatarId: number;
      battleRating: number;
      battleTier: string;
      isOnline: boolean;
      lastSeen: string;
    }>;
  };

  if (!response.ok || !data.success) {
    throw new Error('Failed to search battle users.');
  }

  return (data.users ?? []).map(toOpponent);
};

export const joinBattleQueue = async (user: UserData, payload: {
  mode: BattleMode;
  categories: string[];
  timerSpeed: number;
  questions: BattleQuestion[];
}) => postJson<{ success: boolean; matched: boolean; battle?: BattleView; opponent?: Opponent }>('/battle/queue/join', {
  userId: user.id,
  username: user.username,
  avatarId: user.avatarId,
  battleRating: user.battleRating,
  battleTier: user.battleTier,
  ...payload,
});

export const cancelBattleQueue = (user: UserData) =>
  postJson<{ success: boolean }>('/battle/queue/cancel', {
    userId: user.id,
    username: user.username,
    avatarId: user.avatarId,
    battleRating: user.battleRating,
    battleTier: user.battleTier,
  });

export const createBattleInvite = async (user: UserData, payload: {
  targetUserId: string;
  mode: BattleMode;
  categories: string[];
  timerSpeed: number;
  questions: BattleQuestion[];
}) => postJson<{ success: boolean; invite: { id: string } }>('/battle/invite', {
  userId: user.id,
  username: user.username,
  avatarId: user.avatarId,
  battleRating: user.battleRating,
  battleTier: user.battleTier,
  ...payload,
});

export const respondToBattleInvite = async (user: UserData, inviteId: string, accepted: boolean) =>
  postJson<{ success: boolean; accepted: boolean; battle?: BattleView }>('/battle/invite/respond', {
    inviteId,
    accepted,
    userId: user.id,
    username: user.username,
    avatarId: user.avatarId,
    battleRating: user.battleRating,
    battleTier: user.battleTier,
  });

export const fetchBattleRoom = async (battleId: string, userId: string) => {
  const response = await fetch(apiUrl(`/battle/${battleId}?userId=${encodeURIComponent(userId)}`));
  const data = await response.json() as { success: boolean; battle: BattleView; error?: string };
  if (!response.ok || !data.success) throw new Error(data.error || 'Failed to load battle room.');
  return data.battle;
};

export const submitBattleAnswer = async (battleId: string, user: UserData, answer: string, confidence?: number) => {
  const response = await fetch(apiUrl(`/battle/${battleId}/answer`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: user.id,
      username: user.username,
      avatarId: user.avatarId,
      battleRating: user.battleRating,
      battleTier: user.battleTier,
      answer,
      confidence,
    }),
  });
  const data = await response.json() as { success: boolean; battle?: BattleView; error?: string };
  if (!response.ok || !data.success || !data.battle) {
    throw new Error(data.error || 'Failed to submit battle answer.');
  }
  return data;
};
