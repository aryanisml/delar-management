# Chatbot Troubleshooting Guide

## Common Issues & Solutions

### 1. **Chat Button Not Showing**

**Problem:** The chat button (💬) is not visible in the topbar

**Solution:**
- Make sure you're logged in (not on login page)
- Refresh the page (Ctrl+R or Cmd+R)
- Check if sidebar is collapsed (might hide topbar buttons)
- Clear browser cache: Ctrl+Shift+Delete

---

### 2. **Chat Drawer Opens but Nothing Happens**

**Problem:** Chat drawer opens but messages aren't sent when clicked

**Solution:**
1. Click **"⚙️ Configure"** button in the chat header
2. Select **"Groq (Mixtral)"** from the dropdown
3. Enter your Groq API key
4. Select **"mixtral-8x7b-32768"** model
5. Click **"Test Connection"** button to verify setup
6. If test passes, click **"Save Configuration"**

---

### 3. **"Connection Failed" Error**

**Problem:** Test connection shows error message

**Possible causes & solutions:**

#### A. Invalid API Key
- [ ] Copy your API key from [console.groq.com](https://console.groq.com)
- [ ] Make sure there are **no extra spaces** when pasting
- [ ] Verify the key starts with `gsk_`
- [ ] Generate a new key if you forgot the old one

#### B. CORS Error (Browser Security)
```
Error: Network request failed
or
TypeError: Failed to fetch
```
- This is a **browser security feature** blocking cross-origin requests
- **Solution:** Use the proxy (see Backend Proxy section below)

#### C. Wrong API Endpoint
- [ ] Make sure Base URL is: `https://api.groq.com/openai/v1`
- [ ] Or leave it empty (auto-detected)

#### D. Rate Limited
```
Error: 429 Too Many Requests
```
- Wait a few minutes
- Check Groq status: [status.groq.com](https://status.groq.com)

---

### 4. **Test Connection Works but Chat Doesn't**

**Problem:** Test button shows ✅ but sending messages fails

**Solution:**
1. Check browser **Developer Console** (F12 → Console tab)
2. Look for error messages like:
   - "CORS error" → Use backend proxy
   - "Invalid API key" → Re-enter key and test again
   - "Model not found" → Select correct model
3. Try sending a simple message like "Hello"
4. Screenshot the error and share for debugging

---

### 5. **"Please Configure LLM First"** Message

**Problem:** After entering key and clicking save, still get config error

**Solution:**
- [ ] Make sure **all fields are filled**:
  - Provider: Groq (Mixtral)
  - API Key: Not empty
  - Model: mixtral-8x7b-32768
  - Temperature: auto-set to 0.7
- [ ] Click **"Test Connection"** first
- [ ] Then click **"Save Configuration"**
- [ ] Wait 2 seconds and try sending a message

---

### 6. **Messages Not Appearing**

**Problem:** I can type but nothing shows in the chat

**Solution:**
1. Check if messages are being sent:
   - Open DevTools (F12)
   - Go to Network tab
   - Send a message
   - Look for API request to `api.groq.com`
   
2. If no request appears:
   - Check if you're authenticated
   - Try refreshing page
   
3. If request appears but fails:
   - Check response headers for errors
   - Follow error handling guide below

---

### 7. **Slow Responses**

**Problem:** Chat takes 10+ seconds to respond

**This is normal!** Groq can take 2-5 seconds depending on:
- Network latency
- Model complexity
- Supabase query time (for tool execution)

**Optimization:**
- Use `mixtral-8x7b-32768` (faster) instead of `llama-2-70b-4096`
- Close extra browser tabs
- Check internet speed: [speedtest.net](https://speedtest.net)

---

## Testing & Debugging

### Enable Debug Logs

Open browser DevTools (F12) and run:
```javascript
// Show all LLM requests
localStorage.setItem('debug_chatbot', 'true');
```

Then refresh the page and check console for debug messages.

---

### Test API Manually

**Using curl:**
```bash
curl https://api.groq.com/openai/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "mixtral-8x7b-32768",
    "messages": [{"role": "user", "content": "Hello"}],
    "max_tokens": 100
  }'
```

**Expected response:**
```json
{
  "choices": [{
    "message": {
      "content": "Hello! How can I help you?"
    }
  }]
}
```

---

### Verify Supabase Connection

The chatbot uses Supabase for searching customers/vehicles/bookings.

**To test:**
1. Open DevTools → Network tab
2. Try the tool: "Search for available vehicles"
3. Look for request to `supabase.com`
4. If it fails:
   - Check Supabase credentials in environment
   - Verify database tables exist
   - Check Row Level Security (RLS) policies

---

## Backend Proxy (Fix for CORS Issues)

If you're getting CORS errors, the best solution is to **use a backend API proxy**.

### Setup Backend Proxy

**Create a new Supabase Edge Function:**

1. In Supabase dashboard → Edge Functions
2. Create new function `llm-proxy`:

```typescript
import { serve } from "https://deno.land/std@0.131.0/http/server.ts";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Not found", { status: 404 });
  }

  const body = await req.json();
  
  // Forward to Groq
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${body.apiKey}`,
    },
    body: JSON.stringify({
      model: body.model,
      messages: body.messages,
      temperature: body.temperature,
      max_tokens: body.maxTokens,
      tools: body.tools,
    }),
  });

  const data = await response.json();
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
});
```

**Then update** `chatbot-llm.service.ts`:
```typescript
// Change from:
const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {

// To:
const response = await fetch('YOUR_SUPABASE_URL/functions/v1/llm-proxy', {
  headers: {
    // ... same headers
  },
```

---

## Getting Help

1. **Check this guide** - Most issues are covered above
2. **Test Connection** - Use the test button to diagnose problems
3. **Check console logs** - F12 → Console tab for errors
4. **Read error messages** - They usually tell you exactly what's wrong
5. **Try different provider** - Test with OpenAI to isolate Groq issues

---

## Quick Checklist

- [ ] Browser cache cleared
- [ ] Page refreshed after configuration
- [ ] Test Connection button clicked and passed
- [ ] API key is valid and not expired
- [ ] Model name matches provider
- [ ] Supabase connection works
- [ ] No CORS errors in console

---

**Still need help?** Check the [Groq API Docs](https://console.groq.com/docs) or contact support.
