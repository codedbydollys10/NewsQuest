export type AvatarKind = 'emoji' | 'image';

export interface AvatarOption {
  id: number;
  name: string;
  badge: string;
  unlocked: boolean;
  unlockLevel?: number;
  unlockBadges?: string[];
  kind: AvatarKind;
  emoji?: string;
  src?: string;
}

export const AVATAR_OPTIONS: AvatarOption[] = [
  { id: 0, name: 'Scout', badge: 'DEFAULT', unlocked: true, kind: 'emoji', emoji: '🏃' },
  { id: 1, name: 'Strategist', badge: 'DEFAULT', unlocked: true, kind: 'emoji', emoji: '🧠' },
  { id: 2, name: 'Oracle', badge: 'Streak + Reader', unlocked: false, unlockLevel: 10, unlockBadges: ['b4', 'b5'], kind: 'emoji', emoji: '🔮' },
  { id: 3, name: 'Architect', badge: 'Bookworm + Sharp Mind', unlocked: false, unlockBadges: ['b5', 'b6'], kind: 'emoji', emoji: '⚡' },
  { id: 4, name: 'Phantom', badge: 'Seer + Night Owl', unlocked: false, unlockBadges: ['b7', 'b8'], kind: 'emoji', emoji: '👻' },
  { id: 5, name: 'Girl Hoodie', badge: 'NEW', unlocked: true, kind: 'image', src: '/avatars/avatar-girl-hoodie.png' },
  { id: 6, name: 'Bee Hoodie', badge: 'NEW', unlocked: true, kind: 'image', src: '/avatars/avatar-bee-hoodie.jpeg' },
  { id: 7, name: 'Smiling Hero', badge: 'NEW', unlocked: true, kind: 'image', src: '/avatars/avatar-boy-smile.jpeg' },
  { id: 8, name: 'Sparkle Star', badge: 'NEW', unlocked: true, kind: 'image', src: '/avatars/avatar-girl-sparkles.jpeg' },
  { id: 9, name: 'Red Sailor', badge: 'NEW', unlocked: true, kind: 'image', src: '/avatars/avatar-red-sailor.jpeg' },
  { id: 10, name: 'Dark Catgirl', badge: 'NEW', unlocked: true, kind: 'image', src: '/avatars/avatar-dark-catgirl.jpeg' },
  { id: 11, name: 'Rose School', badge: 'Badges 9+10', unlocked: false, unlockBadges: ['b9', 'b10'], kind: 'image', src: '/avatars/avatar-rose-school.jpeg' },
  { id: 12, name: 'Bear Hoodie', badge: 'Badges 11+12', unlocked: false, unlockBadges: ['b11', 'b12'], kind: 'image', src: '/avatars/avatar-bear-hoodie.jpeg' },
  { id: 13, name: 'Campus Boy', badge: 'Badges 13+14', unlocked: false, unlockBadges: ['b13', 'b14'], kind: 'image', src: '/avatars/avatar-campus-boy.jpeg' },
  { id: 14, name: 'Sentinel', badge: 'Badges 15+16', unlocked: false, unlockBadges: ['b15', 'b16'], kind: 'emoji', emoji: '🛡️' },
  { id: 15, name: 'Astra Legend', badge: 'Badges 17+18', unlocked: false, unlockBadges: ['b17', 'b18'], kind: 'emoji', emoji: '🌠' },
  { id: 16, name: 'Visionary', badge: 'Badges 19+20', unlocked: false, unlockBadges: ['b19', 'b20'], kind: 'emoji', emoji: '🔭' },
];

export const getAvatarOption = (avatarId?: number | null) =>
  AVATAR_OPTIONS.find((avatar) => avatar.id === (avatarId ?? 0)) ?? AVATAR_OPTIONS[0];

export const getAvatarLabel = (avatarId?: number | null) => getAvatarOption(avatarId).name;

const BONUS_UNLOCK_BADGE_ID = 'b20';

export const isAvatarUnlocked = (
  avatar: AvatarOption,
  userLevel = 0,
  earnedBadgeIds: string[] = [],
) => {
  if (avatar.unlocked) return true;

  const earnedBadges = new Set(earnedBadgeIds);
  if (earnedBadges.has(BONUS_UNLOCK_BADGE_ID) && Array.isArray(avatar.unlockBadges) && avatar.unlockBadges.length > 0) {
    return true;
  }

  if (Array.isArray(avatar.unlockBadges) && avatar.unlockBadges.length > 0) {
    const hasRequiredBadges = avatar.unlockBadges.every((badgeId) => earnedBadges.has(badgeId));
    if (hasRequiredBadges) return true;
  }

  if (typeof avatar.unlockLevel === 'number' && userLevel >= avatar.unlockLevel) {
    return true;
  }

  return false;
};

const LAST_AVATAR_KEY = 'newsquest_last_avatar_id';

const isValidAvatarId = (avatarId: number | null | undefined): avatarId is number =>
  typeof avatarId === 'number' && AVATAR_OPTIONS.some((avatar) => avatar.id === avatarId);

export const getStoredAvatarId = () => {
  const stored = localStorage.getItem(LAST_AVATAR_KEY);
  if (stored === null) return null;

  const parsed = Number.parseInt(stored, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

export const setStoredAvatarId = (avatarId: number) => {
  localStorage.setItem(LAST_AVATAR_KEY, String(avatarId));
};

export const getLastActiveAvatarId = () => {
  const stored = getStoredAvatarId();
  return isValidAvatarId(stored) ? stored : null;
};

export const getDefaultAvatarId = (userLevel = 0) =>
  getLastActiveAvatarId() ??
  AVATAR_OPTIONS.find((avatar) => avatar.kind === 'image' && isAvatarUnlocked(avatar, userLevel))?.id ??
  AVATAR_OPTIONS.find((avatar) => isAvatarUnlocked(avatar, userLevel))?.id ??
  0;
