import '../runtime.js';
import Bytez from 'bytez.js';

const DEFAULT_MODEL = 'Qwen/Qwen3-4B';

let sdk: Bytez | null = null;

const getApiKey = () => process.env.BYTEZ_API_KEY?.trim() ?? '';

export const hasBytezKey = () => getApiKey().length > 0;

export const extractBytezText = (output: unknown): string | null => {
  if (typeof output === 'string') return output;
  if (Array.isArray(output)) {
    const text = output
      .map((chunk) => extractBytezText(chunk))
      .filter((chunk): chunk is string => Boolean(chunk))
      .join('');
    return text || null;
  }
  if (output && typeof output === 'object') {
    const record = output as Record<string, unknown>;
    if (typeof record.content === 'string') return record.content;
    if (typeof record.text === 'string') return record.text;
    if (typeof record.output === 'string') return record.output;
    if (typeof record.message === 'string') return record.message;
  }
  return null;
};

export const getBytezModel = () => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('Missing BYTEZ_API_KEY. Add it to backend/.env.local.');
  }

  if (!sdk) {
    sdk = new Bytez(apiKey);
  }

  return sdk.model(process.env.BYTEZ_MODEL?.trim() || DEFAULT_MODEL);
};
