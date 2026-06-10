// Vercel serverless function — Booking Assistant LLM proxy (production).
//
// The browser POSTs an OpenAI-style chat-completions body to /api/agent-llm; this function
// forwards it to Google Gemini's OpenAI-compatible endpoint, injects the Authorization
// header from the GEMINI_API_KEY environment variable, and passes Gemini's response back.
// Local dev uses the matching /api/agent-llm rule in proxy.conf.js, so the frontend calls
// the same URL everywhere.
//
// The key is NOT hardcoded: a committed Google key is detected by GitHub secret scanning
// and auto-revoked by Google, so it must live in the deployment environment. Set
// GEMINI_API_KEY in the Vercel project's Settings -> Environment Variables.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: { message: 'Method not allowed' } });

  if (!GEMINI_API_KEY) {
    console.error('[agent-llm] GEMINI_API_KEY is not configured');
    return res.status(500).json({ error: { message: 'GEMINI_API_KEY is not set in the server environment.' } });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: { message: 'Invalid JSON body' } });
    }
  }

  try {
    const upstream = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GEMINI_API_KEY}` },
      body: JSON.stringify(body),
    });
    // Pass Gemini's status + body through unchanged so the client reads choices[0].message
    // (and Gemini's error shape) exactly as it does in local dev.
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', 'application/json');
    return res.send(text);
  } catch (err) {
    console.error('[agent-llm] Upstream error:', err);
    return res.status(502).json({ error: { message: `Upstream error: ${err.message}` } });
  }
};
