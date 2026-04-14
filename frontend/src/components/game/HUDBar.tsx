import { Link, useLocation } from 'react-router-dom';
import { useGameStore } from '@/store/gameStore';
import { XPProgressBar } from './XPProgressBar';
import { StreakBadge } from './StreakBadge';
import { LevelBadge } from './LevelBadge';
import { AvatarVisual } from './AvatarVisual';
import { motion } from 'framer-motion';
import { Home, BookOpen, Trophy, User, BarChart3 } from 'lucide-react';

const navItems = [
  { path: '/home', icon: Home, label: 'Feed' },
  { path: '/upsc', icon: BookOpen, label: 'UPSC' },
  { path: '/leaderboard', icon: Trophy, label: 'Rank' },
  { path: '/profile', icon: User, label: 'Profile' },
];

export const HUDBar = () => {
  const avatarId = useGameStore(s => s.user.avatarId);
  const location = useLocation();

  return (
    <>
      {/* Desktop top bar */}
      <header className="fixed top-0 left-0 right-0 h-[60px] glass-strong z-50 hidden md:flex items-center px-6 gap-4">
        <Link to="/home" className="flex items-center gap-2 group">
          <span className="font-display font-bold text-xl text-nq-cyan text-glow-cyan group-hover:scale-110 transition-transform">NQ</span>
          <span className="font-display text-sm text-nq-text-secondary hidden lg:inline">NEWSQUEST</span>
        </Link>

        <nav className="flex items-center gap-1 ml-6">
          {[...navItems, { path: '/dashboard', icon: BarChart3, label: 'Dashboard' }].map(item => {
            const active = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all ${active ? 'bg-nq-cyan/10 text-nq-cyan' : 'text-nq-text-secondary hover:text-nq-text-primary hover:bg-muted/50'}`}>
                <item.icon size={16} />
                <span className="hidden lg:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <StreakBadge size="sm" />
          <XPProgressBar compact />
          <Link to="/profile" className="w-10 h-10 rounded-full glass border border-nq-cyan/20 flex items-center justify-center overflow-hidden shrink-0 shadow-[0_0_18px_rgba(0,229,255,0.12)]">
            <AvatarVisual avatarId={avatarId} className="text-sm" imageClassName="w-10 h-10" />
          </Link>
          <LevelBadge size="sm" />
        </div>
      </header>

      {/* Mobile bottom bar */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 glass-strong z-50 flex md:hidden items-center justify-around px-2 safe-area-bottom">
        {navItems.map(item => {
          const active = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path} className="flex flex-col items-center gap-0.5">
              <motion.div
                whileTap={{ scale: 0.85 }}
                className={`p-2 rounded-xl transition-all ${active ? 'text-nq-cyan glow-cyan' : 'text-nq-text-muted'}`}
              >
                <item.icon size={22} />
              </motion.div>
              <span className={`text-[10px] font-display ${active ? 'text-nq-cyan' : 'text-nq-text-muted'}`}>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
};
