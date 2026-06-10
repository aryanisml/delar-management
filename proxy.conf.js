// Angular dev-server proxy (used by `npm start` / `ng serve`).
//
// The Booking Assistant calls Google Gemini's OpenAI-compatible endpoint the same way
// this repo proxies Cashfree in local dev: the browser hits a same-origin path
// (/agent-proxy), and this proxy forwards to Gemini and injects the Authorization header
// from GEMINI_API_KEY. The key is read from a gitignored .env / .env.local and is NEVER
// sent to the browser or committed.
//
// Angular's dev-server translates this http-proxy-middleware-style config (pathRewrite,
// headers, secure, changeOrigin) for its underlying proxy. Change .env? Restart npm start.

const fs = require('fs');
const path = require('path');

// Minimal .env reader — avoids adding a dotenv dependency.
// Precedence: real process env > .env.local > .env (first writer wins below).
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
  console.warn(
    '[proxy] GEMINI_API_KEY is not set. Add it to .env or .env.local — the Booking Assistant will get 401s until you do.'
  );
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
  // Booking Assistant -> Google Gemini (OpenAI-compatible). Auth header injected here.
  // /agent-proxy/chat/completions -> https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
  '/agent-proxy': {
    target: 'https://generativelanguage.googleapis.com/v1beta/openai',
    secure: true,
    changeOrigin: true,
    pathRewrite: {
      '^/agent-proxy': '',
    },
    headers: {
      Authorization: `Bearer ${process.env.GEMINI_API_KEY || ''}`,
    },
  },
};
