import { useState, useCallback, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, X } from 'lucide-react';
import GlassInput from '@/components/auth/GlassInput';
import ParticleBg from '@/components/ParticleBg';
import { supabase } from '@/lib/supabase';
import { useGameStore } from '@/store/gameStore';
import { useAuthStore } from '@/store/useAuthStore';
import { buildUserDataFromSupabaseUser } from '@/lib/supabaseUser';

const Login = () => {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const authUser = useAuthStore((s) => s.user);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState('');

  useEffect(() => {
    if (authUser) {
      navigate('/landing', { replace: true });
    }
  }, [authUser, navigate]);

  const validateEmail = useCallback(() => {
    if (!email) { setEmailError('This field is required'); return false; }
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!isEmail) { setEmailError('Enter a valid email address'); return false; }
    setEmailError('');
    return true;
  }, [email]);

  const validatePassword = useCallback(() => {
    if (!password) { setPasswordError('This field is required'); return false; }
    if (password.length < 8) { setPasswordError('Minimum 8 characters'); return false; }
    setPasswordError('');
    return true;
  }, [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v1 = validateEmail();
    const v2 = validatePassword();
    if (!v1 || !v2) return;

    setLoading(true);
    setError('');
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (signInError || !data.user) {
      setLoading(false);
      setError(signInError?.message || 'Invalid email or password. Please try again.');
      setShake(true);
      setPassword('');
      setTimeout(() => setShake(false), 500);
      return;
    }

    const userData = buildUserDataFromSupabaseUser(data.user);
    setSuccess(true);
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
    setLoading(false);
  };

  const slideContent = [
    {
      title: 'MASTER THE WORLD.',
      subtitle: 'LEVEL BY LEVEL.',
      desc: 'Join 12,847 knowledge warriors',
    },
  ];

  const handleVideoEnd = () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    void video.play();
  };

  const handleGoogleLogin = async () => {
    setGoogleError('');
    setGoogleLoading(true);

    const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/login`,
      },
    });

    if (oauthError) {
      setGoogleError(oauthError.message);
      setGoogleLoading(false);
      return;
    }

    if (data.url) {
      window.location.assign(data.url);
      return;
    }

    setGoogleLoading(false);
  };

  return (
    <div className="flex min-h-screen overflow-hidden">
      {/* Left Panel — Desktop Only */}
      <div className="hidden lg:flex lg:w-1/2 relative particle-bg items-center justify-center">
        <ParticleBg color="#00E5FF" count={50} />
        <div className="relative z-10 text-center space-y-6 px-12">
          <video
            ref={videoRef}
            className="mx-auto w-full max-w-md bg-transparent"
            autoPlay
            muted
            loop
            playsInline
            onEnded={handleVideoEnd}
          >
            <source src="/login-video.webm" type="video/webm" />
            <source src="/login-video.mp4" type="video/mp4" />
          </video>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            className="font-orbitron text-7xl font-black text-gradient-cyan"
          >
            NQ
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="font-orbitron text-2xl text-foreground tracking-wider"
          >
            {slideContent[0].title}
            <br />
            {slideContent[0].subtitle}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-muted-foreground font-plex"
          >
            {slideContent[0].desc}
          </motion.p>
        </div>
      </div>

      {/* Right Panel — Login Form */}
      <motion.div
        initial={{ x: 80, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12"
      >
        <div className="w-full max-w-md space-y-8 glass border border-nq-cyan/40 rounded-2xl p-6 lg:p-8 shadow-[0_0_0_1px_rgba(0,229,255,0.15)]">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-4">
            <span className="font-orbitron text-4xl font-black text-gradient-cyan">NQ</span>
          </div>

          <div className="text-center lg:text-left space-y-2">
            <h1 className="font-orbitron text-3xl font-bold text-foreground">Welcome Back</h1>
            <p className="font-plex text-muted-foreground">Log in to continue your quest</p>
            <div className="w-10 h-px bg-muted-foreground/30 mx-auto lg:mx-0" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <GlassInput
              label="Email Address"
              placeholder="explorer@newsquest.com"
              value={email}
              onChange={(v) => { setEmail(v); setEmailError(''); }}
              onBlur={validateEmail}
              error={emailError}
              autoComplete="email"
            />
            <div className="space-y-1">
              <GlassInput
                label="Password"
                placeholder="••••••••"
                value={password}
                onChange={(v) => { setPassword(v); setPasswordError(''); }}
                onBlur={validatePassword}
                error={passwordError}
                isPassword
                autoComplete="current-password"
              />
            </div>

            {/* Remember Me */}
            <label className="flex items-center gap-3 cursor-pointer group">
              <motion.div
                whileTap={{ scale: 0.9 }}
                onClick={() => setRememberMe(!rememberMe)}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200 ${
                  rememberMe ? 'bg-primary/20 border-primary glow-cyan' : 'border-muted-foreground/40'
                }`}
              >
                {rememberMe && (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-primary text-xs">✓</motion.span>
                )}
              </motion.div>
              <span className="text-sm font-plex text-muted-foreground group-hover:text-foreground transition-colors">
                Keep me logged in
              </span>
            </label>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={loading || success}
              className={`w-full h-[52px] btn-gradient text-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed ${
                shake ? 'animate-shake' : ''
              }`}
              whileHover={!loading ? { scale: 1.02 } : {}}
              whileTap={!loading ? { scale: 0.98 } : {}}
            >
              {loading && !success && <Loader2 className="w-5 h-5 animate-spin" />}
              {success ? 'WELCOME BACK ✓' : loading ? 'LOGGING IN...' : 'LOG IN'}
            </motion.button>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="glass p-3 border-auth-error/30 flex items-center gap-2"
                >
                  <span className="text-auth-error text-sm">⚠</span>
                  <p className="text-sm font-plex text-auth-error flex-1">{error}</p>
                  <button type="button" onClick={() => setError('')}>
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs font-space-mono text-muted-foreground">OR</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Social */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={googleLoading}
              className="w-full h-12 glass flex items-center justify-center gap-3 font-plex text-sm text-foreground hover:border-foreground/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {googleLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              )}
              {googleLoading ? 'Connecting to Google...' : 'Continue with Google'}
            </button>
          </div>
          {googleError && (
            <p className="text-xs text-auth-error font-plex text-center">{googleError}</p>
          )}

          {/* Footer */}
          <p className="text-center text-sm font-plex text-muted-foreground">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary hover:underline font-medium">
              Create one
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
