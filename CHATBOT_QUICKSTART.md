# Chatbot Quick Start Guide

## 🚀 Getting Started in 5 Minutes

### Step 1: Navigate to the Chatbot
After logging in, go to: `http://localhost:4200/ai-assistant`

### Step 2: Configure Your LLM

Click the **"Configure"** button and choose your LLM provider:

#### 🏃 **Fastest Setup (Groq - Free)**
```
1. Go to https://console.groq.com/keys
2. Sign up (no credit card needed)
3. Copy your API key
4. Select Provider: "Groq (Mixtral)"
5. Paste API Key
6. Model: mixtral-8x7b-32768
7. Click "Save"
```

#### 🏠 **Local Setup (Ollama - No API Key)**
```
1. Install Ollama: https://ollama.ai
2. Open terminal and run: ollama serve
3. In another terminal: ollama pull mistral
4. Back in app, select Provider: "Ollama (Local)"
5. Model: mistral
6. Click "Save"
```

#### 🧠 **Best Quality (OpenAI - Paid)**
```
1. Go to https://platform.openai.com/api-keys
2. Create API key
3. Set up billing
4. Back in app, select "OpenAI (GPT-4, GPT-3.5)"
5. Paste API key
6. Model: gpt-4-turbo
7. Click "Save"
```

### Step 3: Start Chatting!

Try these example prompts:

**Search Vehicles:**
```
"Show me available SUVs in Mumbai under 5000 per day"
"What's the cheapest car available for rent?"
"Find luxury vehicles for premium customers"
```

**Customer Operations:**
```
"Search for customer named John Smith"
"Get details for john@example.com"
"Show me all bookings for this customer"
```

**Bookings & Pricing:**
```
"Book a Swift for Raj from June 10 to 15"
"How much is a BMW for a week?"
"Check if Mercedes is available next week"
"Create booking with SUMMER20 promo code"
```

## 📊 Available Tools

The chatbot can execute 9 different tools:

| Tool | What it does | Example |
|------|-------------|---------|
| `search_customers` | Find customers by name/email/phone | "Find John Smith" |
| `search_vehicles` | Find available cars | "Show SUVs under 5000" |
| `get_vehicle_details` | Get specific car info | "Tell me about vehicle X" |
| `get_customer_details` | Get customer profile | "Get John's details" |
| `check_availability` | Check if car is free | "Is Swift available June 10-15?" |
| `create_booking` | Create new reservation | "Book a car for John" |
| `get_booking_status` | Check booking info | "Where's my booking?" |
| `calculate_booking_price` | Calculate total cost | "What's the price for 5 days?" |
| `get_customer_bookings` | See all customer bookings | "Show all bookings for John" |

## 🎛️ Settings Explained

### Temperature (Creativity)
- **0.0-0.3**: Precise, factual (good for data queries)
- **0.7**: Balanced (default, recommended)
- **1.5-2.0**: Creative, varied responses

### Max Tokens
- **512**: Short answers
- **2048**: Standard (default)
- **4096**: Long, detailed responses

## 🔑 API Keys (Don't Share!)

Never commit API keys to git!

**For local development:**
```bash
# In your environment file
VITE_LLM_OPENAI_API_KEY=sk_...
VITE_LLM_ANTHROPIC_API_KEY=sk-ant-...
```

**Chatbot saves in localStorage:**
- Stored locally in your browser
- Survives page reloads
- Only you can see it

## 🛠️ Troubleshooting

### "LLM not configured"
→ Click Configure and save settings

### "API Key invalid"
→ Check key is correct and active on provider's dashboard

### "Network error"
→ Check your internet connection
→ If using Ollama, make sure it's running

### "Tool execution failed"
→ Check database tables exist
→ Verify you have permission to access data
→ Check database connection

## 🚀 Advanced Features

### Backend Proxy (Recommended for Production)

Instead of exposing API keys to frontend:

```typescript
// Call your backend
POST /api/chat
{
  message: "Search for vehicles"
  conversationId: "abc123"
}

// Backend handles LLM + tools
// Frontend just displays results
```

### Streaming Responses

Enable real-time responses:

```typescript
const response = await chatbotService.sendMessageStream(userInput);
response.pipe(displayInUI);
```

### Custom Tools

Add your own tools:

1. Update `llm-tools.ts`
2. Add implementation in `chatbot-llm.service.ts`
3. Tools automatically available in chatbot

### Analytics

Track chatbot usage:

```typescript
// Log to your analytics service
{
  user: currentUser,
  message: userInput,
  tool_used: toolName,
  duration: executionTime
}
```

## 💡 Best Practices

✅ **Do:**
- Use specific queries ("SUVs in Mumbai" not "cars")
- Include dates for availability checks
- Ask to create bookings with all details
- Review tool results before confirming

❌ **Don't:**
- Share API keys in Slack/Email
- Don't commit secrets to git
- Don't use high token limits unless needed
- Don't make very vague queries

## 📞 Support

- Check [CHATBOT_README.md](../CHATBOT_README.md) for detailed docs
- Review tool definitions in `llm-tools.ts`
- Check console (F12) for error messages
- Review LLM provider docs for API issues

## 🎓 Example Workflow

```
User: "Find a car for Raj Kumar"
Bot: Searches customers, finds Raj
Bot: Asks for dates and preferences
User: "June 10-15, needs SUV"
Bot: Checks availability, shows options
User: "Book the Creta"
Bot: Creates booking, shows booking ID
User: "What's the price?"
Bot: Calculates with taxes, shows total
```

## 🔐 Security Checklist

- [ ] Never commit API keys
- [ ] Use environment variables in production
- [ ] Implement rate limiting
- [ ] Add user permission checks
- [ ] Log all operations
- [ ] Monitor API costs
- [ ] Rotate keys periodically

---

**Ready to get started?** Navigate to `/ai-assistant` and click Configure! 🎉
