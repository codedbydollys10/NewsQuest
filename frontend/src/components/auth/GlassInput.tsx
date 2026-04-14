import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Mail, Loader2, Check, AlertTriangle } from 'lucide-react';

interface GlassInputProps {
  label: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  error?: string;
  success?: string;
  loading?: boolean;
  icon?: React.ReactNode;
  isPassword?: boolean;
  autoComplete?: string;
}

const GlassInput = ({
  label, type = 'text', placeholder, value, onChange, onBlur,
  error, success, loading, icon, isPassword, autoComplete,
}: GlassInputProps) => {
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;
  const hasError = !!error;
  const hasSuccess = !!success;

  return (
    <div className="w-full space-y-1.5">
      <label
        className={`block font-plex text-xs uppercase tracking-wider transition-colors duration-200 ${
          focused ? 'text-input-focus' : hasError ? 'text-auth-error' : 'text-muted-foreground'
        }`}
      >
        {label}
      </label>
      <div
        className={`glass-input flex items-center gap-3 cursor-text ${hasError ? 'error' : ''}`}
        onClick={() => inputRef.current?.focus()}
      >
        {icon && <span className="text-muted-foreground shrink-0">{icon}</span>}
        <input
          ref={inputRef}
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); onBlur?.(); }}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="flex-1 bg-transparent outline-none font-plex-mono text-base text-foreground placeholder:text-muted-foreground/50"
          aria-label={label}
          aria-invalid={hasError}
        />
        {loading && <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />}
        {hasSuccess && !loading && <Check className="w-5 h-5 text-auth-success shrink-0" />}
        {hasError && !loading && <AlertTriangle className="w-4 h-4 text-auth-error shrink-0" />}
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        )}
      </div>
      <AnimatePresence>
        {hasError && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="text-auth-error text-xs font-plex font-medium flex items-center gap-1"
          >
            ⚠ {error}
          </motion.p>
        )}
        {hasSuccess && !hasError && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="text-auth-success text-xs font-plex font-medium"
          >
            {success}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GlassInput;
