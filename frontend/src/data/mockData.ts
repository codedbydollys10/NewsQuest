import type { Opponent } from '@/store/useBattleStore';
export { AVATAR_OPTIONS } from './avatars';

const TIERS = ['ROOKIE', 'ANALYST', 'STRATEGIST', 'ORACLE', 'MASTER', 'LEGEND'];
const getTier = (br: number) => {
  if (br < 1000) return TIERS[0];
  if (br < 1300) return TIERS[1];
  if (br < 1600) return TIERS[2];
  if (br < 1900) return TIERS[3];
  if (br < 2200) return TIERS[4];
  return TIERS[5];
};

const names = [
  'shadow_scholar', 'quiz_samurai', 'oracle_knight', 'data_phoenix', 'cipher_sage',
  'neon_strategist', 'quantum_mind', 'pixel_prophet', 'volt_wizard', 'stellar_analyst',
  'byte_warrior', 'cosmic_thinker', 'turbo_scribe', 'iron_oracle', 'blaze_scholar',
  'frost_genius', 'echo_tactician', 'storm_seeker', 'nova_hunter', 'apex_brain',
];

const forms = ['W', 'L', 'D'];

export const MOCK_OPPONENTS: Opponent[] = names.map((username, i) => {
  const br = 800 + Math.floor(Math.random() * 1700);
  const total = 20 + Math.floor(Math.random() * 200);
  const wr = 35 + Math.floor(Math.random() * 55);
  const wins = Math.floor(total * wr / 100);
  const losses = Math.floor(total * (100 - wr) / 200);
  const draws = total - wins - losses;
  return {
    id: `opp-${i}`,
    username,
    avatarId: i % 5,
    level: 5 + Math.floor(Math.random() * 45),
    battleRating: br,
    tier: getTier(br),
    quizAccuracy: 40 + Math.floor(Math.random() * 55),
    predictionAccuracy: 35 + Math.floor(Math.random() * 55),
    winRate: wr,
    totalBattles: total,
    wins, losses, draws,
    recentForm: Array.from({ length: 10 }, () => forms[Math.floor(Math.random() * 3)]),
    isOnline: Math.random() > 0.4,
    lastSeen: new Date(Date.now() - Math.floor(Math.random() * 86400000)).toISOString(),
  };
});

export const CATEGORIES = ['Politics', 'Economy', 'Science', 'Technology', 'World News', 'Environment', 'Sports', 'Culture'];

export const SKIN_TONES = ['#FFDBB4', '#EDB98A', '#D08B5B', '#AE5D29', '#694D3D', '#3B2219'];
