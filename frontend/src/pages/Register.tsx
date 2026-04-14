import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, ChevronRight, ChevronLeft, Sparkles, Loader2 } from 'lucide-react';
import GlassInput from '@/components/auth/GlassInput';
import PasswordStrengthMeter from '@/components/auth/PasswordStrengthMeter';
import StepProgress from '@/components/auth/StepProgress';
import ParticleBg from '@/components/ParticleBg';
import { AvatarVisual } from '@/components/game/AvatarVisual';
import { AVATAR_OPTIONS, getDefaultAvatarId, isAvatarUnlocked } from '@/data/avatars';
import { supabase } from '@/lib/supabase';
import { buildUserDataFromSupabaseUser } from '@/lib/supabaseUser';
import { useAuthStore } from '@/store/useAuthStore';
import { useGameStore } from '@/store/gameStore';

const STEPS = [
  { label: 'Account', icon: '👤' },
  { label: 'Avatar', icon: '🎭' },
  { label: 'Launch', icon: '🚀' },
];

const EXISTING_USERNAMES = ['demo_user', 'oracle_sage', 'quiz_master'];

const Register = () => {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [step, setStep] = useState(0);
  const [isLaunching, setIsLaunching] = useState(false);

  // Step 1
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [usernameSuccess, setUsernameSuccess] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [registerError, setRegisterError] = useState('');

  // Step 2
  const [selectedAvatar, setSelectedAvatar] = useState<number>(getDefaultAvatarId());

  // Validation
  const checkUsername = async (val: string) => {
    if (val.length < 3) { setUsernameError('At least 3 characters'); setUsernameSuccess(''); return; }
    if (val.length > 20) { setUsernameError('Max 20 characters'); setUsernameSuccess(''); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(val)) { setUsernameError('Only letters, numbers, underscores'); setUsernameSuccess(''); return; }
    setCheckingUsername(true);
    setUsernameError('');
    setUsernameSuccess('');
    await new Promise((r) => setTimeout(r, 600));
    if (EXISTING_USERNAMES.includes(val.toLowerCase())) {
      setUsernameError('Username taken');
    } else {
      setUsernameSuccess('Available!');
    }
    setCheckingUsername(false);
  };

  const validateStep1 = () => {
    let valid = true;
    if (!username || usernameError) { if (!username) setUsernameError('Required'); valid = false; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setEmailError('Valid email required'); valid = false; }
    if (password.length < 8) { setPasswordError('Min 8 characters'); valid = false; }
    if (password !== confirmPassword) { setConfirmError('Passwords must match'); valid = false; }
    if (!termsAccepted) valid = false;
    return valid;
  };

  const goNext = () => {
    if (step === 0 && !validateStep1()) return;
    setStep(step + 1);
  };

  const handleLaunch = () => {
    if (isLaunching) return;
    setIsLaunching(true);
    setRegisterError('');

    void (async () => {
      try {
        const normalizedEmail = email.trim().toLowerCase();
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: {
              username,
              avatar_id: selectedAvatar,
              avatar_customization: { skinTone: 0, trailColor: 'cyan' },
              current_level: 1,
              total_xp: 25,
              xp_to_next_level: 100,
              streak_count: 0,
              last_active_date: new Date().toISOString(),
              interests: [],
              daily_goal: 5,
              mode: 'both',
              badges: ['Account Created'],
              articles_read: 0,
              quizzes_total: 0,
              quizzes_correct: 0,
              predictions_total: 0,
              predictions_correct: 0,
              battle_rating: 1000,
              battle_tier: 'ROOKIE',
              wins: 0,
              losses: 0,
              draws: 0,
              recent_form: [],
            },
          },
        });

        if (error) {
          setRegisterError(error.message);
          setIsLaunching(false);
          navigate('/login', { replace: true });
          return;
        }

        if (data.session && data.user) {
          const userData = buildUserDataFromSupabaseUser(data.user);
          login(userData);
          useGameStore.setState((state) => ({
            user: {
              ...state.user,
              id: userData.id,
              username: userData.username,
              currentLevel: userData.currentLevel,
              totalXP: userData.totalXP,
              xpToNextLevel: userData.xpToNextLevel,
              streakCount: userData.streakCount,
              lastActiveDate: userData.lastActiveDate ?? state.user.lastActiveDate,
              articlesRead: userData.articlesRead,
              quizzesTotal: userData.quizzesTotal,
              quizzesCorrect: userData.quizzesCorrect,
              predictionsTotal: userData.predictionsTotal,
              predictionsCorrect: userData.predictionsCorrect,
              avatarId: userData.avatarId,
              avatarBody: 'scout',
              onboarded: true,
            },
          }));
          navigate('/landing', { replace: true });
          return;
        }

        navigate('/login', { replace: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to register account.';
        setRegisterError(message.includes('rate limit')
          ? 'This email was recently used too many times. Please log in with the same details.'
          : message);
        setIsLaunching(false);
        navigate('/login', { replace: true });
      }
    })();
  };

  const pwChecks = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'One uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'One number', met: /\d/.test(password) },
    { label: 'One special character', met: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password) },
  ];

  return (
    <div className="flex min-h-screen overflow-hidden">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative particle-bg items-center justify-center">
        <ParticleBg color="#7C3AED" count={50} />
        <div className="relative z-10 text-center space-y-6 px-12">
          <video
            className="mx-auto w-full max-w-md bg-transparent"
            autoPlay
            muted
            loop
            playsInline
          >
            <source src="/register-video.webm" type="video/webm" />
            <source src="/register-video.mp4" type="video/mp4" />
          </video>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-7xl"
          >
            {step === 0 ? '⚔️' : step === 1 ? '🎭' : step === 2 ? '🧠' : '🚀'}
          </motion.div>
          <h2 className="font-orbitron text-2xl text-foreground">
            {step === 0 ? 'Join the Quest' : step === 1 ? 'Your Avatar Awaits' : step === 2 ? 'Personalize Your Path' : 'Ready to Launch'}
          </h2>
          <p className="text-muted-foreground font-plex">
            {step === 0
              ? '12,847 explorers are already mastering the world'
              : step === 1
              ? 'Your knowledge companion evolves with you'
              : step === 2
              ? 'Tell us what you want to master'
              : '+25 XP for creating your account'}
          </p>
        </div>
      </div>

      {/* Right Panel */}
      <motion.div
        initial={{ x: 80, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="w-full lg:w-1/2 flex flex-col items-center p-6 lg:p-12 overflow-y-auto"
      >
        <div className="w-full max-w-md space-y-6 glass border border-nq-cyan/40 rounded-2xl p-6 lg:p-8 shadow-[0_0_0_1px_rgba(0,229,255,0.15)]">
          <StepProgress steps={STEPS} currentStep={step} />

          <AnimatePresence mode="wait">
            {/* STEP 1: Account */}
            {step === 0 && (
              <motion.div
                key="step1"
                initial={{ x: 60, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -60, opacity: 0 }}
                className="space-y-5"
              >
                <div className="space-y-1">
                  <h1 className="font-orbitron text-2xl font-bold text-foreground">Create Your Account</h1>
                  <p className="font-plex text-sm text-muted-foreground">Step 1 of 3 — Let's get you started</p>
                </div>

                <GlassInput
                  label="Choose Your Username"
                  placeholder="knowledge_warrior"
                  value={username}
                  onChange={(v) => { setUsername(v); setUsernameError(''); setUsernameSuccess(''); }}
                  onBlur={() => username && checkUsername(username)}
                  error={usernameError}
                  success={usernameSuccess}
                  loading={checkingUsername}
                  autoComplete="username"
                />
                <p className="text-xs text-muted-foreground font-plex -mt-3">This is how you'll appear on leaderboards</p>

                <GlassInput
                  label="Email Address"
                  type="email"
                  placeholder="your.email@example.com"
                  value={email}
                  onChange={(v) => { setEmail(v); setEmailError(''); }}
                  onBlur={() => { if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) setEmailError('Invalid email'); }}
                  error={emailError}
                  autoComplete="email"
                />

                <div className="space-y-2">
                  <GlassInput
                    label="Create Password"
                    placeholder="Min. 8 characters"
                    value={password}
                    onChange={(v) => { setPassword(v); setPasswordError(''); }}
                    error={passwordError}
                    isPassword
                    autoComplete="new-password"
                  />
                  <PasswordStrengthMeter password={password} />
                  {password && (
                    <div className="glass p-3 space-y-1.5">
                      {pwChecks.map((c) => (
                        <div key={c.label} className="flex items-center gap-2 text-xs font-plex">
                          <span className={c.met ? 'text-auth-success' : 'text-muted-foreground'}>
                            {c.met ? '✓' : '○'}
                          </span>
                          <span className={c.met ? 'text-foreground' : 'text-muted-foreground'}>{c.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <GlassInput
                  label="Confirm Password"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(v) => { setConfirmPassword(v); setConfirmError(''); }}
                  onBlur={() => { if (confirmPassword && confirmPassword !== password) setConfirmError('Passwords must match'); }}
                  error={confirmError}
                  isPassword
                  autoComplete="new-password"
                />

                <label className="flex items-center gap-3 cursor-pointer">
                  <motion.div
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setTermsAccepted(!termsAccepted)}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                      termsAccepted ? 'bg-primary/20 border-primary' : 'border-muted-foreground/40'
                    }`}
                  >
                    {termsAccepted && <span className="text-primary text-xs">✓</span>}
                  </motion.div>
                  <span className="text-xs font-plex text-muted-foreground">
                    I agree to the <button type="button" className="text-primary hover:underline">Terms of Service</button> and{' '}
                    <button type="button" className="text-primary hover:underline">Privacy Policy</button>
                  </span>
                </label>

                <motion.button
                  onClick={goNext}
                  disabled={!username || !email || !password || !confirmPassword || !termsAccepted}
                  className="w-full h-[52px] btn-gradient text-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  CONTINUE TO AVATAR <ChevronRight className="w-4 h-4" />
                </motion.button>

                <p className="text-center text-sm font-plex text-muted-foreground">
                  Already have an account?{' '}
                  <Link to="/login" className="text-primary hover:underline">Log in</Link>
                </p>
              </motion.div>
            )}

            {/* STEP 2: Avatar */}
            {step === 1 && (
              <motion.div
                key="step2"
                initial={{ x: 60, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -60, opacity: 0 }}
                className="space-y-6"
              >
                <div className="space-y-1">
                  <h1 className="font-orbitron text-2xl font-bold">Choose Your Avatar</h1>
                  <p className="font-plex text-sm text-muted-foreground">Step 2 of 3 — Pick your knowledge companion</p>
                </div>

                <div className="flex gap-3 overflow-x-auto pb-2 snap-x">
                  {AVATAR_OPTIONS.map((av) => {
                    const unlocked = isAvatarUnlocked(av, 0);

                    return (
                      <motion.button
                        key={av.id}
                        whileHover={unlocked ? { scale: 1.05 } : {}}
                        whileTap={unlocked ? { scale: 0.95 } : {}}
                        onClick={() => unlocked && setSelectedAvatar(av.id)}
                        className={`shrink-0 w-28 snap-center glass p-4 flex flex-col items-center gap-2 transition-all ${
                          selectedAvatar === av.id
                            ? 'border-primary border-2 glow-cyan'
                            : unlocked
                              ? 'hover:border-foreground/20'
                              : 'opacity-40 grayscale cursor-not-allowed'
                        }`}
                      >
                        <div className="w-14 h-14 flex items-center justify-center overflow-hidden rounded-2xl bg-white/5">
                          {unlocked ? (
                            <AvatarVisual avatarId={av.id} className="text-4xl" imageClassName="w-14 h-14" />
                          ) : (
                            <span className="text-2xl">🔒</span>
                          )}
                        </div>
                        <span className="font-orbitron text-xs">{av.name}</span>
                        <span className="text-[10px] font-space-mono text-muted-foreground">{av.badge}</span>
                      </motion.button>
                    );
                  })}
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass p-4 space-y-4"
                >
                  <div>
                    <p className="text-xs font-plex text-muted-foreground uppercase tracking-wider mb-2">Selected Avatar</p>
                    <p className="text-sm text-foreground">{AVATAR_OPTIONS.find((av) => av.id === selectedAvatar)?.name ?? 'Scout'}</p>
                  </div>
                </motion.div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(0)}
                    className="h-[48px] px-6 glass flex items-center gap-2 font-plex text-sm text-muted-foreground hover:text-foreground"
                  >
                    <ChevronLeft className="w-4 h-4" /> BACK
                  </button>
                  <motion.button
                    onClick={() => setStep(2)}
                    className="flex-1 h-[48px] btn-gradient text-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                    whileHover={{ scale: 1.02 }}
                  >
                    CONTINUE TO LAUNCH <ChevronRight className="w-4 h-4" />
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {step === 2 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6 pt-2"
            >
              <div className="space-y-1">
                <h1 className="font-orbitron text-2xl font-bold text-center">Ready to Launch</h1>
                <p className="font-plex text-sm text-muted-foreground text-center">Step 3 of 3 — Your account is almost ready</p>
              </div>

              <motion.div
                initial={{ y: -100, rotate: 0, scale: 0.3 }}
                animate={{ y: 0, rotate: 1080, scale: 1 }}
                transition={{ type: 'spring', stiffness: 80, damping: 12, duration: 1.5 }}
                className="w-32 h-32 mx-auto flex items-center justify-center"
              >
                <AvatarVisual
                  avatarId={selectedAvatar}
                  className="text-7xl"
                  imageClassName="w-32 h-32"
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.0 }}
                className="flex flex-wrap justify-center gap-3"
              >
                {['LEVEL 1', '0/100 XP', '0 Day Streak', 'ROOKIE'].map((badge, i) => (
                  <motion.span
                    key={badge}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 1.2 + i * 0.15, type: 'spring' }}
                    className="glass px-3 py-1.5 text-xs font-space-mono text-primary"
                  >
                    {badge}
                  </motion.span>
                ))}
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 2.0 }}
                className="font-orbitron text-3xl md:text-4xl font-bold text-gradient-cyan text-center"
              >
                YOUR QUEST BEGINS
              </motion.h1>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 2.5 }}
                className="glass px-4 py-2 text-sm font-plex text-auth-success flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                +25 XP — Account Created!
              </motion.div>

              <motion.button
                type="button"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 3.0, type: 'spring' }}
                onClick={handleLaunch}
                disabled={isLaunching}
                className="w-full btn-gradient px-10 h-14 text-base flex items-center justify-center gap-3 animate-pulse-glow disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLaunching ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    ENTERING...
                  </>
                ) : (
                  'START MY JOURNEY'
                )}
              </motion.button>
              {registerError && (
                <p className="text-xs text-center font-plex text-auth-error">
                  {registerError}
                </p>
              )}
              {isLaunching && (
                <p className="text-xs text-center font-plex text-muted-foreground">
                  Redirecting to the main screen...
                </p>
              )}
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default Register;
