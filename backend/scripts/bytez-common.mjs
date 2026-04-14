import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const loadLocalEnv = () => {
  const envPath = path.join(backendRoot, '.env.local');
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, '');
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
};

export const defaultArticle = {
  headline: 'AI Breakthrough: Neural Networks Achieve Self-Repair',
  summary: 'Researchers demonstrate neural networks that can detect and repair damaged pathways on their own.',
  category: 'Technology',
  source: 'TechReview',
  publishedAt: '2h ago',
  fullContent:
    'In a groundbreaking study, researchers at MIT demonstrated that artificial neural networks can detect and autonomously repair damaged computational pathways. The team developed a novel architecture called Self-Healing Networks that monitors its own performance metrics in real time.',
};

export const buildPrompt = (article) => `
You are generating NewsQuest gameplay content from a news article.

Return valid JSON only, with this exact shape:
{
  "quiz": [
    {
      "question": "string",
      "options": ["A", "B", "C", "D"],
      "correctIndex": 0,
      "explanation": "string"
    }
  ],
  "prediction": {
    "question": "string",
    "options": ["Option 1", "Option 2", "Option 3"],
    "deadline": "YYYY-MM-DD",
    "xpReward": 25
  }
}

Rules:
- Write exactly 2 quiz questions.
- Quiz options must be short, distinct, and grounded in the article.
- correctIndex must be 0, 1, 2, or 3.
- Prediction should be forward-looking and based on the article.
- Keep the prediction options short and mutually exclusive.
- Deadline must be a future date in YYYY-MM-DD format.
- xpReward should be an integer between 20 and 50.
- Do not include markdown or extra commentary.

Article:
Headline: ${article.headline}
Summary: ${article.summary}
Category: ${article.category}
Source: ${article.source}
Published: ${article.publishedAt}
Full content: ${article.fullContent}
`;

export const parseGeneratedContent = (raw) => {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  const jsonText = start >= 0 && end >= start ? raw.slice(start, end + 1) : raw;
  const data = JSON.parse(jsonText);

  if (!Array.isArray(data.quiz) || data.quiz.length !== 2 || !data.prediction) {
    throw new Error('Unexpected Bytez response format.');
  }

  const deadlineDate = new Date(data.prediction.deadline);
  const now = new Date();
  if (Number.isNaN(deadlineDate.getTime()) || deadlineDate <= now) {
    const fallback = new Date(now);
    fallback.setUTCDate(fallback.getUTCDate() + 90);
    data.prediction.deadline = fallback.toISOString().slice(0, 10);
  }

  data.prediction.xpReward = Math.min(50, Math.max(20, Math.round(data.prediction.xpReward || 30)));

  return data;
};

export const extractBytezText = (output) => {
  if (typeof output === 'string') return output;
  if (Array.isArray(output)) {
    const text = output.map((chunk) => extractBytezText(chunk)).filter(Boolean).join('');
    return text || null;
  }
  if (output && typeof output === 'object') {
    if (typeof output.content === 'string') return output.content;
    if (typeof output.text === 'string') return output.text;
    if (typeof output.output === 'string') return output.output;
    if (typeof output.message === 'string') return output.message;
  }
  return null;
};
