import { useCallback, useEffect, useRef, useState } from 'react';

export const useSpeechSynthesis = () => {
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const stop = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    (text: string, lang = 'en-US') => {
      if (!supported || !text.trim()) return;
      stop();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;

      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
      setSpeaking(true);
    },
    [supported, stop],
  );

  useEffect(() => {
    return () => stop();
  }, [stop]);

  return { speak, stop, speaking, supported };
};
