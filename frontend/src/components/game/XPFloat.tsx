import { useGameStore } from '@/store/gameStore';

const colorMap: Record<string, string> = {
  cyan: 'text-nq-cyan text-glow-cyan',
  purple: 'text-nq-purple text-glow-purple',
  orange: 'text-nq-orange text-glow-orange',
};

export const XPFloat = () => {
  const xpFloats = useGameStore(s => s.ui.xpFloats);
  return (
    <div className="fixed inset-0 pointer-events-none z-[100]">
      {xpFloats.map(f => (
        <div
          key={f.id}
          className={`absolute font-display font-bold text-lg animate-xp-float ${colorMap[f.color] || colorMap.cyan}`}
          style={{ left: f.x, top: f.y }}
        >
          +{f.amount} XP
        </div>
      ))}
    </div>
  );
};
