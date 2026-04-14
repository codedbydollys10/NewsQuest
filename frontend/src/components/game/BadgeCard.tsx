import { GlassCard } from './GlassCard';
import { Lock } from 'lucide-react';
import type { Badge } from '@/store/gameStore';

export const BadgeCard = ({ badge }: { badge: Badge }) => (
  <GlassCard className={`text-center relative p-5 ${!badge.earned ? 'opacity-60 grayscale' : ''}`} hover={badge.earned}>
    <div className="text-4xl md:text-5xl mb-3">{badge.icon}</div>
    {!badge.earned && <Lock className="absolute top-2 right-2 w-3 h-3 text-nq-text-muted" />}
    <h4 className="font-display text-sm font-bold text-foreground mb-1">{badge.name}</h4>
    <p className="text-xs text-nq-text-muted">{badge.earned ? badge.description : badge.unlockCondition}</p>
  </GlassCard>
);
