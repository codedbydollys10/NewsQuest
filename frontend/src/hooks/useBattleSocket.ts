import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore, type UserData } from '@/store/useAuthStore';
import type { Opponent } from '@/store/useBattleStore';
import type { BattleQuestion } from '@/data/battleQuestions';

export interface ChallengeRequest {
    challengeId: string;
    from: Opponent;
    mode: 'quiz' | 'prediction' | 'mixed';
    category: string;
    timerSpeed: number;
    questions: BattleQuestion[];
    createdAt: number;
}

export interface BattleRoomData {
    roomId: string;
    players: Opponent[];
    mode: 'quiz' | 'prediction' | 'mixed';
    category: string;
    timerSpeed: number;
    questions: BattleQuestion[];
    startedAt: number;
}

export interface BattleActionPayload {
    roomId: string;
    senderId: string;
    type: 'answer' | 'progress' | 'timer' | 'next-question';
    questionIndex?: number;
    answer?: string;
    confidence?: number;
    progress?: number;
    timeRemaining?: number;
}

function getCurrentPlayer(user: UserData | null, id: string): Opponent {
    const username = user?.username ?? `guest_${id.slice(-4)}`;
    const avatarId = typeof user?.avatarId === 'number' ? user.avatarId : 0;
    const currentLevel = typeof user?.currentLevel === 'number' ? user.currentLevel : 1;
    const battleRating = typeof user?.battleRating === 'number' ? user.battleRating : 1000;
    const wins = typeof user?.wins === 'number' ? user.wins : 0;
    const losses = typeof user?.losses === 'number' ? user.losses : 0;
    const draws = typeof user?.draws === 'number' ? user.draws : 0;
    const quizzesTotal = typeof user?.quizzesTotal === 'number' ? user.quizzesTotal : 0;
    const quizzesCorrect = typeof user?.quizzesCorrect === 'number' ? user.quizzesCorrect : 0;
    const predictionsTotal = typeof user?.predictionsTotal === 'number' ? user.predictionsTotal : 0;
    const predictionsCorrect = typeof user?.predictionsCorrect === 'number' ? user.predictionsCorrect : 0;
    const totalBattles = wins + losses + draws;
    const winRate = totalBattles > 0 ? Math.round((wins / totalBattles) * 100) : 50;
    const quizAccuracy = quizzesTotal > 0 ? Math.round((quizzesCorrect / quizzesTotal) * 100) : 60;
    const predictionAccuracy = predictionsTotal > 0 ? Math.round((predictionsCorrect / predictionsTotal) * 100) : 60;

    return {
        id: user?.id ?? id,
        username,
        avatarId,
        level: currentLevel,
        battleRating,
        tier: user?.battleTier ?? 'ROOKIE',
        quizAccuracy,
        predictionAccuracy,
        winRate,
        totalBattles,
        wins,
        losses,
        draws,
        recentForm: Array.isArray(user?.recentForm) ? user.recentForm : [],
        isOnline: true,
        lastSeen: user?.lastActiveDate ?? new Date().toISOString(),
        socketId: user?.id ?? id,
    };
}

function mapPresenceState(presenceState: Record<string, Array<Record<string, unknown>>>): Opponent[] {
    const asString = (value: unknown, fallback: string) =>
        typeof value === 'string' && value.trim().length > 0 ? value : fallback;

    return Object.entries(presenceState).map(([key, presences]) => {
        const presence = presences[presences.length - 1] || {}; // get latest presence object
        const { presence_ref: _presenceRef, ...payload } = presence;

        return {
            id: key,
            socketId: key,
            username: asString(payload.username, `player-${key.slice(0, 6)}`),
            avatarId: typeof payload.avatarId === 'number' ? payload.avatarId : 0,
            level: typeof payload.level === 'number' ? payload.level : 1,
            battleRating: typeof payload.battleRating === 'number' ? payload.battleRating : 1000,
            tier: asString(payload.tier, 'ROOKIE'),
            quizAccuracy: typeof payload.quizAccuracy === 'number' ? payload.quizAccuracy : 60,
            predictionAccuracy: typeof payload.predictionAccuracy === 'number' ? payload.predictionAccuracy : 60,
            winRate: typeof payload.winRate === 'number' ? payload.winRate : 50,
            totalBattles: typeof payload.totalBattles === 'number' ? payload.totalBattles : 0,
            wins: typeof payload.wins === 'number' ? payload.wins : 0,
            losses: typeof payload.losses === 'number' ? payload.losses : 0,
            draws: typeof payload.draws === 'number' ? payload.draws : 0,
            recentForm: Array.isArray(payload.recentForm)
              ? payload.recentForm.filter((entry): entry is string => typeof entry === 'string')
              : [],
            isOnline: true,
            lastSeen: asString(payload.lastSeen, new Date().toISOString()),
        };
    });
}

export const useBattleSocket = () => {
    const user = useAuthStore((s) => s.user);
    const [socketConnected, setSocketConnected] = useState(false);
    const [selfId, setSelfId] = useState<string | null>(null);
    const [onlinePlayers, setOnlinePlayers] = useState<Opponent[]>([]);
    const [incomingChallenge, setIncomingChallenge] = useState<ChallengeRequest | null>(null);
    const [outgoingStatus, setOutgoingStatus] = useState<'idle' | 'pending' | 'accepted' | 'declined'>('idle');
    const [battleRoom, setBattleRoom] = useState<BattleRoomData | null>(null);
    const [lastBattleAction, setLastBattleAction] = useState<BattleActionPayload | null>(null);
    const [timerSync, setTimerSync] = useState<{ roomId: string; timeRemaining: number } | null>(null);
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

    const guestId = useMemo(() => `guest_${Math.floor(Math.random() * 900000 + 100000)}`, []);
    const currentPlayer = useMemo(() => getCurrentPlayer(user, guestId), [user, guestId]);

    useEffect(() => {
        const channel = supabase.channel('battle-lobby', {
            config: {
                broadcast: { self: true, ack: false },
                presence: { key: currentPlayer.id, enabled: true },
            },
        });

        setSelfId(currentPlayer.id);

        const syncPresence = () => {
            setOnlinePlayers(mapPresenceState(channel.presenceState()));
        };

        const updateConnectionState = (status: unknown) => {
            const statusObj = status as { status?: string; type?: string } | null;
            const normalizedStatusValue = typeof status === 'string' ? status : statusObj?.status ?? statusObj?.type;
            if (normalizedStatusValue === 'SUBSCRIBED') {
                setSocketConnected(true);
                return true;
            }
            if (normalizedStatusValue === 'CLOSED' || normalizedStatusValue === 'CHANNEL_ERROR' || normalizedStatusValue === 'ERROR') {
                setSocketConnected(false);
            }
            return false;
        };

        channel
            .on('presence', { event: 'sync' }, syncPresence)
            .on('presence', { event: 'join' }, syncPresence)
            .on('presence', { event: 'leave' }, syncPresence)
            .on('broadcast', { event: 'challenge' }, (payload) => {
                if (!payload?.payload || payload.payload.targetId !== currentPlayer.id) return;
                setIncomingChallenge({
                    challengeId: payload.payload.challengeId,
                    from: payload.payload.from,
                    mode: payload.payload.mode,
                    category: payload.payload.category,
                    timerSpeed: payload.payload.timerSpeed,
                    questions: payload.payload.questions,
                    createdAt: Date.now(),
                });
            })
            .on('broadcast', { event: 'challenge-response' }, (payload) => {
                if (!payload?.payload || payload.payload.challengerId !== currentPlayer.id) return;
                setOutgoingStatus(payload.payload.accepted ? 'accepted' : 'declined');
            })
            .on('broadcast', { event: 'battle-started' }, (payload) => {
                if (!payload?.payload) return;
                const room = payload.payload as BattleRoomData;
                if (!room.players.some((player) => player.id === currentPlayer.id)) return;
                setBattleRoom(room);
            })
            .on('broadcast', { event: 'room-joined' }, (payload) => {
                if (!payload?.payload) return;
                const room = payload.payload as BattleRoomData;
                if (!room.players.some((player) => player.id === currentPlayer.id)) return;
                setBattleRoom(room);
            })
            .on('broadcast', { event: 'battle-action' }, (payload) => {
                if (!payload?.payload) return;
                const action = payload.payload as BattleActionPayload;
                if (action.senderId === currentPlayer.id) return;
                setLastBattleAction(action);
                if (action.type === 'timer' && typeof action.timeRemaining === 'number') {
                    setTimerSync({ roomId: action.roomId, timeRemaining: action.timeRemaining });
                }
            })
            .subscribe(async (status) => {
                const isSubscribed = updateConnectionState(status);
                if (!isSubscribed) return;

                await channel.track({
                    ...currentPlayer,
                    lastSeen: new Date().toISOString(),
                });
                syncPresence();
            });

        channelRef.current = channel;

        return () => {
            if (channelRef.current) {
                channelRef.current.untrack();
                channelRef.current.unsubscribe();
                channelRef.current = null;
            }
            setSocketConnected(false);
        };
    }, [currentPlayer]);

    const challengePlayer = useCallback(
        (targetId: string, payload: { mode: 'quiz' | 'prediction' | 'mixed'; category: string; timerSpeed: number; questions: BattleQuestion[] }) => {
            if (!channelRef.current) return false;
            const challengeId = `${currentPlayer.id}-${Date.now()}`;
            channelRef.current.send({
                type: 'broadcast',
                event: 'challenge',
                payload: {
                    challengeId,
                    targetId,
                    from: currentPlayer,
                    mode: payload.mode,
                    category: payload.category,
                    timerSpeed: payload.timerSpeed,
                    questions: payload.questions,
                },
            });
            setOutgoingStatus('pending');
            return true;
        },
        [currentPlayer]
    );

    const respondToChallenge = useCallback(
        (challengeId: string, accepted: boolean) => {
            if (!channelRef.current || !incomingChallenge) return;
            channelRef.current.send({
                type: 'broadcast',
                event: 'challenge-response',
                payload: {
                    challengeId,
                    accepted,
                    challengerId: incomingChallenge.from.id,
                },
            });

            if (accepted) {
                const room: BattleRoomData = {
                    roomId: `${incomingChallenge.challengeId}-${Date.now()}`,
                    mode: incomingChallenge.mode,
                    category: incomingChallenge.category,
                    timerSpeed: incomingChallenge.timerSpeed,
                    questions: incomingChallenge.questions,
                    players: [incomingChallenge.from, currentPlayer],
                    startedAt: Date.now(),
                };
                channelRef.current.send({
                    type: 'broadcast',
                    event: 'battle-started',
                    payload: room,
                });
                setBattleRoom(room);
            }

            setIncomingChallenge(null);
            setOutgoingStatus(accepted ? 'accepted' : 'declined');
        },
        [currentPlayer, incomingChallenge]
    );

    const resetChallenge = useCallback(() => {
        setIncomingChallenge(null);
        setOutgoingStatus('idle');
    }, []);

    const joinBattleRoom = useCallback(
        (roomId: string) => {
            if (!channelRef.current) return;
            channelRef.current.send({
                type: 'broadcast',
                event: 'room-joined',
                payload: {
                    roomId,
                    players: [currentPlayer],
                    mode: 'quiz',
                    category: 'All',
                    timerSpeed: 30,
                    questions: [],
                    startedAt: Date.now(),
                },
            });
        },
        [currentPlayer]
    );

    const sendBattleAction = useCallback(
        (roomId: string, action: string, data: Record<string, unknown>) => {
            if (!channelRef.current) return;
            channelRef.current.send({
                type: 'broadcast',
                event: 'battle-action',
                payload: {
                    roomId,
                    senderId: currentPlayer.id,
                    type: action,
                    ...data,
                },
            });
        },
        [currentPlayer.id]
    );

    const clearBattleRoom = useCallback(() => {
        setBattleRoom(null);
        setOutgoingStatus('idle');
        setIncomingChallenge(null);
        setLastBattleAction(null);
        setTimerSync(null);
    }, []);

    return {
        socketConnected,
        selfId,
        onlinePlayers,
        incomingChallenge,
        outgoingStatus,
        battleRoom,
        lastBattleAction,
        timerSync,
        challengePlayer,
        respondToChallenge,
        joinBattleRoom,
        sendBattleAction,
        resetChallenge,
        clearBattleRoom,
    };
};

export type BattleSocketContextValue = ReturnType<typeof useBattleSocket>;
