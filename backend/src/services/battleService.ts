type BattleMode = 'quiz' | 'prediction' | 'mixed';
type BattleStatus = 'countdown' | 'active' | 'revealing' | 'finished';
type BattleResult = 'win' | 'loss' | 'draw';

export interface BattleQuestionOption {
  id: string;
  text: string;
  icon?: string;
}

export interface BattleQuestionPayload {
  id: string;
  type: 'quiz' | 'prediction';
  category: string;
  context?: string;
  question: string;
  options: BattleQuestionOption[];
  correctAnswer: string;
  explanation?: string;
  source?: string;
  basePoints: number;
  hpDamage: number;
}

export interface BattleProfilePayload {
  userId: string;
  username: string;
  avatarId: number;
  battleRating: number;
  battleTier: string;
}

export interface BattleStartPayload extends BattleProfilePayload {
  mode: BattleMode;
  categories: string[];
  timerSpeed: number;
  questions: BattleQuestionPayload[];
}

export interface BattleInvitePayload extends BattleStartPayload {
  targetUserId: string;
}

export interface BattleAnswerPayload {
  userId: string;
  answer: string;
  confidence?: number;
}

interface PresenceEntry extends BattleProfilePayload {
  lastSeen: number;
}

interface BattleQueueEntry extends BattleStartPayload {
  joinedAt: number;
}

interface BattleInvite extends BattleInvitePayload {
  id: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number;
}

interface BattlePlayerState extends BattleProfilePayload {
  score: number;
  hp: number;
  answered: boolean;
  answer: string | null;
  confidence: number;
  momentum: number;
  onFire: boolean;
  currentRoundAt: number;
  answeredAt: number | null;
}

interface BattleRoundAnswer {
  answer: string | null;
  confidence: number;
  answeredAt: number | null;
  correct: boolean;
  points: number;
}

interface BattleRoundResult {
  questionId: string;
  correctAnswer: string;
  playerAnswer: string | null;
  opponentAnswer: string | null;
  playerCorrect: boolean;
  opponentCorrect: boolean;
  playerConfidence: number | null;
  opponentConfidence: number | null;
  playerFirst: boolean;
  playerPoints: number;
  opponentPoints: number;
}

interface BattleRoom {
  id: string;
  mode: BattleMode;
  categories: string[];
  timerSpeed: number;
  questions: BattleQuestionPayload[];
  createdAt: number;
  startsAt: number;
  revealMs: number;
  status: BattleStatus;
  currentQuestion: number;
  players: [BattlePlayerState, BattlePlayerState];
  currentAnswers: Map<string, BattleRoundAnswer>;
  roundResults: BattleRoundResult[];
  result: BattleResult | null;
  xpEarned: number;
  brChange: number;
  finishedAt: number | null;
}

export interface BattleInviteSummary {
  id: string;
  from: BattleProfilePayload;
  mode: BattleMode;
  categories: string[];
  timerSpeed: number;
  createdAt: number;
}

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
  questions: BattleQuestionPayload[];
  currentQuestion: number;
  totalQuestions: number;
  timeRemaining: number;
  startsAt: number;
  revealMs: number;
  result: BattleResult | null;
  xpEarned: number;
  brChange: number;
  player: BattleViewPlayer;
  opponent: BattleViewPlayer;
  roundResults: BattleRoundResult[];
}

const presence = new Map<string, PresenceEntry>();
const queue = new Map<string, BattleQueueEntry>();
const invites = new Map<string, BattleInvite>();
const rooms = new Map<string, BattleRoom>();

const COUNTDOWN_MS = 6000;
const REVEAL_MS = 2000;
const PRESENCE_TTL_MS = 60_000;
const FINISHED_ROOM_TTL_MS = 10 * 60_000;
const INVITE_TTL_MS = 15 * 60_000;

const createId = () => `battle_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const clampConfidence = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 50;
  return Math.min(100, Math.max(1, Math.round(value)));
};

const toBattleProfile = (payload: BattleProfilePayload): PresenceEntry => ({
  ...payload,
  lastSeen: Date.now(),
});

export const normalizeQuestions = (questions: unknown): BattleQuestionPayload[] => {
  if (!Array.isArray(questions)) return [];
  return questions
    .slice(0, 8)
    .map((question) => {
      if (!question || typeof question !== 'object') return null;
      const q = question as Record<string, unknown>;
      const options = Array.isArray(q.options)
        ? q.options.slice(0, 4).map((option) => {
          if (!option || typeof option !== 'object') return null;
          const o = option as Record<string, unknown>;
          return {
            id: typeof o.id === 'string' ? o.id : '',
            text: typeof o.text === 'string' ? o.text : '',
            icon: typeof o.icon === 'string' ? o.icon : undefined,
          } satisfies BattleQuestionOption;
        }).filter(Boolean) as BattleQuestionOption[]
        : [];

      const id = typeof q.id === 'string' ? q.id : '';
      const type = q.type === 'prediction' ? 'prediction' : 'quiz';
      const category = typeof q.category === 'string' ? q.category : 'General';
      const questionText = typeof q.question === 'string' ? q.question : '';
      const correctAnswer = typeof q.correctAnswer === 'string' ? q.correctAnswer : '';
      const basePoints = typeof q.basePoints === 'number' && Number.isFinite(q.basePoints) ? q.basePoints : 1;
      const hpDamage = typeof q.hpDamage === 'number' && Number.isFinite(q.hpDamage) ? q.hpDamage : 10;

      if (!id || !questionText || !options.length || !correctAnswer) return null;

      return {
        id,
        type,
        category,
        context: typeof q.context === 'string' ? q.context : undefined,
        question: questionText,
        options,
        correctAnswer,
        explanation: typeof q.explanation === 'string' ? q.explanation : undefined,
        source: typeof q.source === 'string' ? q.source : undefined,
        basePoints,
        hpDamage,
      } satisfies BattleQuestionPayload;
    })
    .filter(Boolean) as BattleQuestionPayload[];
};

const buildPlayerState = (profile: BattleProfilePayload): BattlePlayerState => ({
  ...profile,
  score: 0,
  hp: 100,
  answered: false,
  answer: null,
  confidence: 50,
  momentum: 0,
  onFire: false,
  currentRoundAt: 0,
  answeredAt: null,
});

const swapRoundResult = (round: BattleRoundResult): BattleRoundResult => ({
  ...round,
  playerAnswer: round.opponentAnswer,
  opponentAnswer: round.playerAnswer,
  playerCorrect: round.opponentCorrect,
  opponentCorrect: round.playerCorrect,
  playerConfidence: round.opponentConfidence,
  opponentConfidence: round.playerConfidence,
  playerFirst: !round.playerFirst,
  playerPoints: round.opponentPoints,
  opponentPoints: round.playerPoints,
});

const getWinner = (room: BattleRoom): BattleResult => {
  const [a, b] = room.players;
  if (a.score > b.score) return 'win';
  if (a.score < b.score) return 'loss';
  if (a.hp > b.hp) return 'win';
  if (a.hp < b.hp) return 'loss';
  return 'draw';
};

const applyRound = (room: BattleRoom, questionIndex: number) => {
  const question = room.questions[questionIndex];
  if (!question) return;

  const [playerA, playerB] = room.players;
  const answerA = room.currentAnswers.get(playerA.userId) ?? { answer: null, confidence: 50, answeredAt: null, correct: false, points: 0 };
  const answerB = room.currentAnswers.get(playerB.userId) ?? { answer: null, confidence: 50, answeredAt: null, correct: false, points: 0 };
  const firstUserId = [answerA.answeredAt, answerB.answeredAt]
    .filter((value): value is number => typeof value === 'number')
    .sort((x, y) => x - y)[0] === answerA.answeredAt ? playerA.userId : playerB.userId;
  const playerACorrect = answerA.answer !== null && answerA.answer === question.correctAnswer;
  const playerBCorrect = answerB.answer !== null && answerB.answer === question.correctAnswer;
  const playerAFirst = firstUserId === playerA.userId && playerACorrect;
  const playerBFirst = firstUserId === playerB.userId && playerBCorrect;

  const computePoints = (correct: boolean, playerFirst: boolean, confidence: number, currentMomentum: number) => {
    if (!correct) return 0;
    if (question.type === 'prediction') {
      return Math.round(question.basePoints * (confidence / 50));
    }
    return question.basePoints + (playerFirst ? 1 : 0) + (currentMomentum >= 3 ? 1 : 0);
  };

  const pointsA = computePoints(playerACorrect, playerAFirst, answerA.confidence, playerA.momentum);
  const pointsB = computePoints(playerBCorrect, playerBFirst, answerB.confidence, playerB.momentum);

  playerA.score += pointsA;
  playerB.score += pointsB;
  playerA.hp = Math.max(0, playerA.hp - (playerACorrect ? 0 : question.hpDamage));
  playerB.hp = Math.max(0, playerB.hp - (playerBCorrect ? 0 : question.hpDamage));
  playerA.momentum = playerACorrect ? playerA.momentum + 1 : 0;
  playerB.momentum = playerBCorrect ? playerB.momentum + 1 : 0;
  playerA.onFire = playerA.momentum >= 3;
  playerB.onFire = playerB.momentum >= 3;

  playerA.answered = false;
  playerB.answered = false;
  playerA.answer = null;
  playerB.answer = null;
  playerA.confidence = 50;
  playerB.confidence = 50;
  playerA.answeredAt = null;
  playerB.answeredAt = null;
  playerA.currentRoundAt = Date.now();
  playerB.currentRoundAt = Date.now();
  room.currentAnswers.clear();

  room.roundResults.push({
    questionId: question.id,
    correctAnswer: question.correctAnswer,
    playerAnswer: answerA.answer,
    opponentAnswer: answerB.answer,
    playerCorrect: playerACorrect,
    opponentCorrect: playerBCorrect,
    playerConfidence: answerA.answer === null ? null : answerA.confidence,
    opponentConfidence: answerB.answer === null ? null : answerB.confidence,
    playerFirst: firstUserId === playerA.userId,
    playerPoints: pointsA,
    opponentPoints: pointsB,
  });
};

const roomShouldReveal = (room: BattleRoom, now: number) => {
  const questionStart = Math.max(room.players[0]?.currentRoundAt ?? room.startsAt, room.players[1]?.currentRoundAt ?? room.startsAt, room.startsAt);
  const questionEnds = questionStart + room.timerSpeed * 1000;
  const currentQuestion = room.questions[room.currentQuestion];
  if (!currentQuestion) return false;

  if (room.currentAnswers.size >= 2) return true;
  return now >= questionEnds;
};

const resolveRoomProgress = (room: BattleRoom) => {
  const now = Date.now();
  if (room.status === 'finished') return;

  if (room.status === 'countdown' && now >= room.startsAt) {
    room.status = 'active';
    room.players.forEach((player) => {
      player.currentRoundAt = now;
    });
  }

  while (room.status === 'active' || room.status === 'revealing') {
    const currentQuestion = room.questions[room.currentQuestion];
    if (!currentQuestion) {
      room.status = 'finished';
      room.finishedAt = now;
      room.result = getWinner(room);
      break;
    }

    const shouldReveal = roomShouldReveal(room, now);

    if (room.status === 'active' && !shouldReveal) {
      break;
    }

    if (room.status === 'active' && shouldReveal) {
      room.status = 'revealing';
      room.finishedAt = now;
      (room as BattleRoom & { revealUntil?: number }).revealUntil = now + room.revealMs;
      break;
    }

    const revealUntil = (room as BattleRoom & { revealUntil?: number }).revealUntil ?? 0;
    if (room.status === 'revealing' && now < revealUntil) {
      break;
    }

    if (room.status === 'active' || room.status === 'revealing') {
      applyRound(room, room.currentQuestion);
      room.currentQuestion += 1;
      room.status = room.currentQuestion >= room.questions.length ? 'finished' : 'active';
      if (room.status === 'finished') {
        room.finishedAt = now;
        room.result = getWinner(room);
        room.xpEarned = Math.max(10, room.players[0].score * 15 + (room.result === 'win' ? 50 : room.result === 'draw' ? 20 : 5));
        room.brChange = room.result === 'win' ? 25 : room.result === 'draw' ? 5 : -15;
        break;
      }
    }
  }
};

const buildPlayerView = (player: BattlePlayerState): BattleViewPlayer => ({
  userId: player.userId,
  username: player.username,
  avatarId: player.avatarId,
  battleRating: player.battleRating,
  battleTier: player.battleTier,
  score: player.score,
  hp: player.hp,
  answered: player.answered,
  answer: player.answer,
  confidence: player.confidence,
  momentum: player.momentum,
  onFire: player.onFire,
});

const buildView = (room: BattleRoom, userId: string): BattleView | null => {
  const selfIndex = room.players.findIndex((player) => player.userId === userId);
  if (selfIndex < 0) return null;

  const self = room.players[selfIndex];
  const opponent = room.players[selfIndex === 0 ? 1 : 0];
  const currentQuestion = room.questions[room.currentQuestion];
  const now = Date.now();
  const questionStart = Math.max(room.players[0]?.currentRoundAt ?? room.startsAt, room.players[1]?.currentRoundAt ?? room.startsAt, room.startsAt);
  const timeRemaining = room.status === 'active'
    ? Math.max(0, Math.ceil((questionStart + room.timerSpeed * 1000 - now) / 1000))
    : room.status === 'countdown'
      ? Math.max(0, Math.ceil((room.startsAt - now) / 1000))
      : 0;

  return {
    id: room.id,
    status: room.status,
    mode: room.mode,
    categories: room.categories,
    timerSpeed: room.timerSpeed,
    questions: room.questions,
    currentQuestion: room.currentQuestion,
    totalQuestions: room.questions.length,
    timeRemaining: currentQuestion ? timeRemaining : 0,
    startsAt: room.startsAt,
    revealMs: room.revealMs,
    result: selfIndex === 0 ? room.result : room.result === 'win' ? 'loss' : room.result === 'loss' ? 'win' : room.result,
    xpEarned: room.xpEarned,
    brChange: selfIndex === 0 ? room.brChange : -room.brChange,
    player: buildPlayerView(self),
    opponent: buildPlayerView(opponent),
    roundResults: selfIndex === 0 ? room.roundResults : room.roundResults.map(swapRoundResult),
  };
};

const createRoom = (payload: BattleStartPayload, opponent: BattleProfilePayload) => {
  const id = createId();
  const players: [BattlePlayerState, BattlePlayerState] = [buildPlayerState(payload), buildPlayerState(opponent)];

  rooms.set(id, {
    id,
    mode: payload.mode,
    categories: payload.categories,
    timerSpeed: payload.timerSpeed,
    questions: payload.questions,
    createdAt: Date.now(),
    startsAt: Date.now() + COUNTDOWN_MS,
    revealMs: REVEAL_MS,
    status: 'countdown',
    currentQuestion: 0,
    players,
    currentAnswers: new Map<string, BattleRoundAnswer>(),
    roundResults: [],
    result: null,
    xpEarned: 0,
    brChange: 0,
    finishedAt: null,
  });

  return rooms.get(id)!;
};

const clearExpiredPresence = () => {
  const cutoff = Date.now() - PRESENCE_TTL_MS;
  for (const [userId, entry] of presence.entries()) {
    if (entry.lastSeen < cutoff) {
      presence.delete(userId);
      queue.delete(userId);
    }
  }
};

const clearExpiredInvites = () => {
  const cutoff = Date.now() - INVITE_TTL_MS;
  for (const [inviteId, invite] of invites.entries()) {
    if (invite.status !== 'pending') continue;
    if (invite.createdAt < cutoff) {
      invites.delete(inviteId);
    }
  }
};

const clearExpiredRooms = () => {
  const cutoff = Date.now() - FINISHED_ROOM_TTL_MS;
  for (const [roomId, room] of rooms.entries()) {
    if (room.status !== 'finished') continue;
    const finishedAt = room.finishedAt ?? room.createdAt;
    if (finishedAt < cutoff) {
      rooms.delete(roomId);
    }
  }
};

export const getOnlineRivals = (excludeUserId?: string) => {
  clearExpiredPresence();
  clearExpiredInvites();
  clearExpiredRooms();
  return Array.from(presence.values())
    .filter((entry) => entry.userId !== excludeUserId)
    .sort((a, b) => b.lastSeen - a.lastSeen)
    .map(({ lastSeen, ...entry }) => ({
      ...entry,
      isOnline: true,
      lastSeen: new Date(lastSeen).toISOString(),
    }));
};

export const reportPresence = (payload: BattleProfilePayload) => {
  presence.set(payload.userId, toBattleProfile(payload));
  return getOnlineRivals(payload.userId);
};

export const joinBattleQueue = (payload: BattleStartPayload) => {
  const joinedAt = Date.now();
  const entry: BattleQueueEntry = {
    ...payload,
    joinedAt,
  };
  queue.set(payload.userId, entry);

  clearExpiredPresence();
  clearExpiredInvites();
  clearExpiredRooms();
  const candidate = Array.from(queue.values())
    .filter((entry) => entry.userId !== payload.userId && entry.mode === payload.mode)
    .sort((a, b) => Math.abs(a.battleRating - payload.battleRating) - Math.abs(b.battleRating - payload.battleRating))[0];

  if (!candidate) {
    return { matched: false as const };
  }

  queue.delete(payload.userId);
  queue.delete(candidate.userId);

  const primary = entry.joinedAt <= candidate.joinedAt ? entry : candidate;
  const secondary = primary.userId === entry.userId ? candidate : entry;
  const room = createRoom(primary, secondary);
  return {
    matched: true as const,
    battle: buildView(room, payload.userId) ?? buildView(room, candidate.userId),
    opponent: payload.userId === room.players[0].userId ? room.players[1] : room.players[0],
  };
};

export const cancelBattleQueue = (userId: string) => {
  queue.delete(userId);
};

export const getQueueStatus = (userId: string) => {
  const entry = queue.get(userId);
  if (!entry) return { status: 'idle' as const };

  return {
    status: 'waiting' as const,
    queuedAt: entry.joinedAt,
  };
};

export const createBattleInvite = (payload: BattleInvitePayload) => {
  const invite: BattleInvite = {
    ...payload,
    id: createId(),
    status: 'pending',
    createdAt: Date.now(),
  };
  invites.set(invite.id, invite);
  return invite;
};

export const getBattleInvites = (userId: string) => {
  clearExpiredPresence();
  clearExpiredInvites();
  return Array.from(invites.values())
    .filter((invite) => invite.targetUserId === userId && invite.status === 'pending')
    .map((invite) => ({
      id: invite.id,
      from: {
        userId: invite.userId,
        username: invite.username,
        avatarId: invite.avatarId,
        battleRating: invite.battleRating,
        battleTier: invite.battleTier,
      },
      mode: invite.mode,
      categories: invite.categories,
      timerSpeed: invite.timerSpeed,
      createdAt: invite.createdAt,
    } satisfies BattleInviteSummary));
};

export const respondToInvite = (inviteId: string, accepted: boolean, responder: BattleProfilePayload) => {
  const invite = invites.get(inviteId);
  if (!invite || invite.targetUserId !== responder.userId || invite.status !== 'pending') {
    return { accepted: false as const };
  }

  if (!accepted) {
    invite.status = 'declined';
    return { accepted: false as const };
  }

  invite.status = 'accepted';
  const room = createRoom(invite, responder);
  return {
    accepted: true as const,
    battle: buildView(room, responder.userId),
  };
};

export const getBattleRoom = (battleId: string, userId: string) => {
  clearExpiredRooms();
  const room = rooms.get(battleId);
  if (!room) return null;
  resolveRoomProgress(room);
  return buildView(room, userId);
};

export const submitBattleAnswer = (battleId: string, payload: BattleAnswerPayload) => {
  clearExpiredRooms();
  const room = rooms.get(battleId);
  if (!room) return null;

  resolveRoomProgress(room);
  if (room.status !== 'active') {
    return buildView(room, payload.userId);
  }

  const player = room.players.find((entry) => entry.userId === payload.userId);
  if (!player) return null;

  const currentQuestion = room.questions[room.currentQuestion];
  if (!currentQuestion) return buildView(room, payload.userId);

  if (!player.answered) {
    player.answered = true;
    player.answer = payload.answer;
    player.confidence = clampConfidence(payload.confidence);
    player.answeredAt = Date.now();
    room.currentAnswers.set(player.userId, {
      answer: payload.answer,
      confidence: player.confidence,
      answeredAt: player.answeredAt,
      correct: payload.answer === currentQuestion.correctAnswer,
      points: 0,
    });
  }

  if (room.currentAnswers.size >= 2) {
    room.status = 'revealing';
    (room as BattleRoom & { revealUntil?: number }).revealUntil = Date.now() + room.revealMs;
  }

  resolveRoomProgress(room);
  return buildView(room, payload.userId);
};

export const getBattleSession = (userId: string) => {
  clearExpiredPresence();
  clearExpiredInvites();
  clearExpiredRooms();
  const invite = Array.from(invites.values()).filter((entry) => entry.targetUserId === userId && entry.status === 'pending');
  const activeRoom = Array.from(rooms.values()).find((room) => room.status !== 'finished' && room.players.some((player) => player.userId === userId));
  if (activeRoom) resolveRoomProgress(activeRoom);

  return {
    onlineUsers: getOnlineRivals(userId),
    queue: getQueueStatus(userId),
    incomingInvites: invite.map((entry) => ({
      id: entry.id,
      from: {
        userId: entry.userId,
        username: entry.username,
        avatarId: entry.avatarId,
        battleRating: entry.battleRating,
        battleTier: entry.battleTier,
      },
      mode: entry.mode,
      categories: entry.categories,
      timerSpeed: entry.timerSpeed,
      createdAt: entry.createdAt,
    })),
    battle: activeRoom ? buildView(activeRoom, userId) : null,
  };
};
