// Angular dev-server proxy (used by `npm start` / `ng serve`) — LOCAL DEV ONLY.
//
// Forwards the Booking Assistant's calls to Google Gemini's OpenAI-compatible endpoint
// (same path as the prod Vercel function, /api/agent-llm) and the Cashfree sandbox. In
// production the Vercel functions under api/ handle these instead.
//
// SECURITY: the Gemini key is hardcoded for this sprint, matching the Cashfree keys and the
// api/agent-llm.js function. Move it to an env var and ROTATE before real production. An OS
// GEMINI_API_KEY env var overrides the hardcoded value below.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AQ.Ab8RN6Ie-orJjbK6CAmUVw7fm96aplbPuUDFMdTJ9bhLhAMK-g';

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
      Authorization: `Bearer ${GEMINI_API_KEY}`,
    },
  },
};
