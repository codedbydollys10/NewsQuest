import { describe, it, expect } from 'vitest';
import { AVATAR_OPTIONS, isAvatarUnlocked } from '@/data/avatars';

describe('Avatar unlock rules', () => {
  it('defaults unlocked avatars should be unlocked', () => {
    const defaultAvatar = AVATAR_OPTIONS.find((a) => a.id === 0);
    expect(defaultAvatar).toBeDefined();
    expect(defaultAvatar && isAvatarUnlocked(defaultAvatar, 0, [])).toBe(true);
  });

  it('requires correct badge pair for specific avatar', () => {
    const oracle = AVATAR_OPTIONS.find((a) => a.id === 2);
    expect(oracle).toBeDefined();
    expect(oracle && isAvatarUnlocked(oracle, 0, ['b4', 'b5'])).toBe(true);
    expect(oracle && isAvatarUnlocked(oracle, 0, ['b4'])).toBe(false);
  });

  it('bonus badge unlocks all paired avatars', () => {
    const specialAvatar = AVATAR_OPTIONS.find((a) => a.id === 15);
    expect(specialAvatar).toBeDefined();
    expect(specialAvatar && isAvatarUnlocked(specialAvatar, 0, ['b20'])).toBe(true);
  });

  it('unlocks Architect with badges b5 + b6', () => {
    const architect = AVATAR_OPTIONS.find((a) => a.id === 3);
    expect(architect).toBeDefined();
    expect(architect && isAvatarUnlocked(architect, 0, ['b5', 'b6'])).toBe(true);
    expect(architect && isAvatarUnlocked(architect, 0, ['b5'])).toBe(false);
    expect(architect && isAvatarUnlocked(architect, 0, ['b6'])).toBe(false);
  });

  it('unlocks Phantom with badges b7 + b8', () => {
    const phantom = AVATAR_OPTIONS.find((a) => a.id === 4);
    expect(phantom).toBeDefined();
    expect(phantom && isAvatarUnlocked(phantom, 0, ['b7', 'b8'])).toBe(true);
    expect(phantom && isAvatarUnlocked(phantom, 0, ['b7'])).toBe(false);
    expect(phantom && isAvatarUnlocked(phantom, 0, ['b8'])).toBe(false);
  });

  it('unlocks Rose School with badges b9 + b10', () => {
    const roseSchool = AVATAR_OPTIONS.find((a) => a.id === 11);
    expect(roseSchool).toBeDefined();
    expect(roseSchool && isAvatarUnlocked(roseSchool, 0, ['b9', 'b10'])).toBe(true);
    expect(roseSchool && isAvatarUnlocked(roseSchool, 0, ['b9'])).toBe(false);
    expect(roseSchool && isAvatarUnlocked(roseSchool, 0, ['b10'])).toBe(false);
  });

  it('unlocks Bear Hoodie with badges b11 + b12', () => {
    const bearHoodie = AVATAR_OPTIONS.find((a) => a.id === 12);
    expect(bearHoodie).toBeDefined();
    expect(bearHoodie && isAvatarUnlocked(bearHoodie, 0, ['b11', 'b12'])).toBe(true);
    expect(bearHoodie && isAvatarUnlocked(bearHoodie, 0, ['b11'])).toBe(false);
  });

  it('unlocks Campus Boy with badges b13 + b14', () => {
    const campusBoy = AVATAR_OPTIONS.find((a) => a.id === 13);
    expect(campusBoy).toBeDefined();
    expect(campusBoy && isAvatarUnlocked(campusBoy, 0, ['b13', 'b14'])).toBe(true);
    expect(campusBoy && isAvatarUnlocked(campusBoy, 0, ['b13'])).toBe(false);
  });

  it('unlocks Sentinel with badges b15 + b16', () => {
    const sentinel = AVATAR_OPTIONS.find((a) => a.id === 14);
    expect(sentinel).toBeDefined();
    expect(sentinel && isAvatarUnlocked(sentinel, 0, ['b15', 'b16'])).toBe(true);
    expect(sentinel && isAvatarUnlocked(sentinel, 0, ['b15'])).toBe(false);
  });

  it('unlocks Astra Legend with badges b17 + b18', () => {
    const astraLegend = AVATAR_OPTIONS.find((a) => a.id === 15);
    expect(astraLegend).toBeDefined();
    expect(astraLegend && isAvatarUnlocked(astraLegend, 0, ['b17', 'b18'])).toBe(true);
    expect(astraLegend && isAvatarUnlocked(astraLegend, 0, ['b17'])).toBe(false);
  });

  it('unlocks Visionary with badges b19 + b20', () => {
    const visionary = AVATAR_OPTIONS.find((a) => a.id === 16);
    expect(visionary).toBeDefined();
    expect(visionary && isAvatarUnlocked(visionary, 0, ['b19', 'b20'])).toBe(true);
    expect(visionary && isAvatarUnlocked(visionary, 0, ['b19'])).toBe(false);
  });
});