// Vercel serverless function — Booking Assistant LLM proxy.
//
// The browser talks ONLY to this endpoint; the LLM provider key never leaves the
// server. It forwards an OpenAI-compatible chat-completion request to Groq and
// returns the assistant message (including any tool_calls) back to the client.
//
// SECURITY: the Groq API key is read from the GROQ_API_KEY environment variable and is
// never hardcoded or committed. Set it in Vercel (Project → Settings → Environment
// Variables), or for local `vercel dev` put it in a gitignored .env.local at the repo
// root. GROQ_BASE_URL and GROQ_MODEL are not secret and stay as plain constants.
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
// Current Groq free, tool-calling capable model. Update if Groq's recommended
// production model changes.
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_TEMPERATURE = 0.1;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Read the secret from the environment at request time — never hardcoded or committed.
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    console.error('[agent-llm] GROQ_API_KEY is not configured');
    return res.status(500).json({ error: 'GROQ_API_KEY is not configured' });
  }

  // Vercel parses JSON bodies automatically, but guard for raw-string bodies too.
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
  }

  const { messages, tools, tool_choice } = body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages[] is required' });
  }

  const payload = {
    model: GROQ_MODEL,
    temperature: GROQ_TEMPERATURE,
    messages,
  };

  if (Array.isArray(tools) && tools.length) {
    payload.tools = tools;
    payload.tool_choice = tool_choice || 'auto';
  }

  try {
    const groqResponse = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!groqResponse.ok) {
      const detail = await groqResponse.text();
      console.error('[agent-llm] Groq API error:', detail);
      return res.status(502).json({ error: 'LLM request failed', detail });
    }

    const data = await groqResponse.json();
    const message = data?.choices?.[0]?.message ?? null;

    if (!message) {
      return res.status(502).json({ error: 'LLM returned no message', detail: data });
    }

    return res.status(200).json({ message, usage: data.usage ?? null });
  } catch (err) {
    console.error('[agent-llm] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
};
