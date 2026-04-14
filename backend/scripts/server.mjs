import './runtime.mjs';
import http from 'node:http';
import Bytez from 'bytez.js';
import { buildPrompt, extractBytezText, loadLocalEnv, parseGeneratedContent } from './bytez-common.mjs';

loadLocalEnv();

const apiKey = process.env.BYTEZ_API_KEY?.trim();
const modelName = process.env.BYTEZ_MODEL?.trim() || 'Qwen/Qwen3-4B';

if (!apiKey) {
  console.error('Missing BYTEZ_API_KEY. Add it to backend/.env.local first.');
  process.exit(1);
}

const sdk = new Bytez(apiKey);
const model = sdk.model(modelName);

const readJsonBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
};

const sendJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
};

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/health') {
      sendJson(res, 200, { ok: true, model: modelName });
      return;
    }

    if (req.method === 'POST' && req.url === '/generate') {
      const article = await readJsonBody(req);
      const required = ['headline', 'summary', 'fullContent', 'category', 'source', 'publishedAt'];
      const missing = required.filter((key) => !article?.[key]);
      if (missing.length) {
        sendJson(res, 400, { error: `Missing fields: ${missing.join(', ')}` });
        return;
      }

      const { error, output } = await model.run([
        { role: 'system', content: 'You are a precise JSON generator for a news quiz app.' },
        { role: 'user', content: buildPrompt(article) },
      ]);

      if (error) {
        sendJson(res, 500, { error: typeof error === 'string' ? error : 'Bytez generation failed.' });
        return;
      }

      const text = extractBytezText(output);

      if (!text) {
        sendJson(res, 500, { error: 'Unexpected output type from Bytez.' });
        return;
      }

      sendJson(res, 200, parseGeneratedContent(text));
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    sendJson(res, 500, { error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

const port = Number(process.env.PORT || 8787);
server.listen(port, () => {
  console.log(`NewsQuest Bytez test server running on http://localhost:${port}`);
});
