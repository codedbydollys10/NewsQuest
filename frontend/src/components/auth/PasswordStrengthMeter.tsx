import { motion } from 'framer-motion';

interface PasswordStrengthMeterProps {
  password: string;
}

const getStrength = (pw: string) => {
  let score = 0;
  if (pw.length >= 8) score += 25;
  if (pw.length >= 12) score += 15;
  if (/[A-Z]/.test(pw)) score += 15;
  if (/[a-z]/.test(pw)) score += 10;
  if (/\d/.test(pw)) score += 15;
  if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pw)) score += 20;
  return Math.min(score, 100);
};

const getLabel = (s: number) => {
  if (s < 26) return { label: 'Weak', color: 'bg-auth-error' };
  if (s < 51) return { label: 'Fair', color: 'bg-auth-warning' };
  if (s < 76) return { label: 'Good', color: 'bg-primary' };
  return { label: 'Strong', color: 'bg-auth-success' };
};

const PasswordStrengthMeter = ({ password }: PasswordStrengthMeterProps) => {
  const strength = getStrength(password);
  const { label, color } = getLabel(strength);

  if (!password) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${strength > i * 25 ? color : ''}`}
              initial={{ width: 0 }}
              animate={{ width: strength > i * 25 ? '100%' : '0%' }}
              transition={{ duration: 0.3 }}
            />
          </div>
        ))}
      </div>
      <p className="text-xs font-plex font-medium text-muted-foreground">{label}</p>
    </div>
  );
};

export default PasswordStrengthMeter;
export { getStrength };
