// Angular dev-server proxy (used by `npm start` / `ng serve`) — LOCAL DEV ONLY.
//
// Forwards the Booking Assistant's calls to Google Gemini's OpenAI-compatible endpoint
// (same path as the prod Vercel function, /api/agent-llm) and the Cashfree sandbox. In
// production the Vercel functions under api/ handle these instead.
//
// The Gemini key is read from a gitignored .env.local / .env and is NEVER committed —
// a committed Google key gets detected by GitHub secret scanning and auto-revoked by
// Google. For production, set GEMINI_API_KEY in the Vercel project's env vars.

const fs = require('fs');
const path = require('path');

// Prefer IPv4 when resolving upstream hosts. On some Windows / dev networks Node returns
// IPv6 (AAAA) records first but lacks a working IPv6 route, which can make the proxy
// intermittently fail to reach Gemini (ENOTFOUND / connection errors). ipv4first avoids it.
try { require('dns').setDefaultResultOrder('ipv4first'); } catch {}

// Minimal .env reader (no dotenv dependency). Precedence: real env > .env.local > .env.
function loadEnvFile(file) {
  const fullPath = path.resolve(__dirname, file);
  if (!fs.existsSync(fullPath)) return;
  for (const line of fs.readFileSync(fullPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const key = match[1];
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile('.env.local');
loadEnvFile('.env');

if (!process.env.GEMINI_API_KEY) {
  // eslint-disable-next-line no-console
  console.warn('[proxy] GEMINI_API_KEY is not set — add it to .env.local. The assistant will get 401s until you do.');
}

module.exports = {
  // Existing Cashfree dev proxy — kept exactly as before.
  '/cashfree-proxy': {
    target: 'https://sandbox.cashfree.com/pg',
    secure: true,
    changeOrigin: true,
    pathRewrite: {
      '^/cashfree-proxy': '',
    },
    logLevel: 'debug',
  },
  // Booking Assistant -> Google Gemini (OpenAI-compatible). Same path as the Vercel
  // function (api/agent-llm.js) so dev and prod share one frontend URL: /api/agent-llm.
  '/api/agent-llm': {
    target: 'https://generativelanguage.googleapis.com/v1beta/openai',
    secure: true,
    changeOrigin: true,
    pathRewrite: {
      '^/api/agent-llm': '/chat/completions',
    },
    headers: {
      Authorization: `Bearer ${process.env.GEMINI_API_KEY || ''}`,
    },
  },
};
