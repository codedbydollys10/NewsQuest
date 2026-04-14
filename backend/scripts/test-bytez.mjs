import './runtime.mjs';
import Bytez from 'bytez.js';
import { buildPrompt, defaultArticle, extractBytezText, loadLocalEnv, parseGeneratedContent } from './bytez-common.mjs';

loadLocalEnv();

const modelName = process.env.BYTEZ_MODEL?.trim() || 'Qwen/Qwen3-4B';
const apiKey = process.env.BYTEZ_API_KEY?.trim();

if (!apiKey) {
  console.error('Missing BYTEZ_API_KEY. Add it to backend/.env.local first.');
  process.exit(1);
}

const sdk = new Bytez(apiKey);
const model = sdk.model(modelName);
const article = defaultArticle;

console.log(`Using model: ${modelName}`);
console.log(`Article: ${article.headline}`);

const { error, output } = await model.run([
  { role: 'system', content: 'You are a precise JSON generator for a news quiz app.' },
  { role: 'user', content: buildPrompt(article) },
]);

if (error) {
  console.error('Bytez error:', error);
  process.exit(1);
}

const text = extractBytezText(output);

if (!text) {
  console.error('Unexpected output type from Bytez:', output);
  process.exit(1);
}

const parsed = parseGeneratedContent(text);
console.log(JSON.stringify(parsed, null, 2));
