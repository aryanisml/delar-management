# Groq Setup Guide (Free LLM Testing)

## Overview
Groq offers a **free tier** with fast, high-quality open-source LLM models. This guide will help you set up Groq for testing the AI Chatbot without any cost.

## Groq Advantages
- ✅ **Free tier**: No credit card required
- ✅ **Fast inference**: Extremely fast LLM processing
- ✅ **Open-source models**: Mixtral 8x7B, Llama 2 70B
- ✅ **Generous rate limits**: Great for development and testing
- ✅ **No usage caps**: Test as much as you need

## Step 1: Create a Groq Account

1. Visit [console.groq.com](https://console.groq.com)
2. Sign up with your email or Google account
3. Verify your email address
4. Accept the terms of service

## Step 2: Generate Your API Key

1. After logging in, navigate to **API Keys** in the left sidebar
2. Click **"Create API Key"**
3. Give it a name like "Delar Management Chatbot"
4. Click **"Create"**
5. **Copy your API key** - you'll need it in the next step
6. ⚠️ **Save it securely** - you won't be able to see it again

## Step 3: Configure the Chatbot

1. Open the AI Chatbot in your application (http://localhost:4200/ai-assistant)
2. Click the **"⚙️ Configure LLM"** button in the top-right
3. The form will open with these fields:

### Fill in the configuration:

| Field | Value |
|-------|-------|
| **LLM Provider** | Select **"Groq (Mixtral)"** |
| **API Key** | Paste your API key from Step 2 |
| **Base URL** | Leave empty (uses default) or use `https://api.groq.com/openai/v1` |
| **Model** | Select **"mixtral-8x7b-32768"** (default) or **"llama-2-70b-4096"** |
| **Temperature** | 0.7 (default - good balance of creativity and consistency) |
| **Max Tokens** | 2048 (default - adjust based on response length needs) |

### Available Groq Models:

- **mixtral-8x7b-32768** ⭐ (Recommended)
  - Fast, versatile, great for general tasks
  - Best for customer service and booking conversations

- **llama-2-70b-4096**
  - Larger model, more detailed responses
  - Slower but more capable

## Step 4: Test the Chatbot

1. Click **"Save Configuration"** button
2. Try asking a test question:
   - "Search for available vehicles in New York"
   - "What are the booking options for a Tesla?"
   - "Show me my booking history"

3. The chatbot will:
   - Process your request using Groq's LLM
   - Extract relevant information
   - Execute tools to fetch data
   - Return formatted results

## Troubleshooting

### "Invalid API Key" Error
- ✅ Copy-paste your API key again carefully
- ✅ Make sure there are no extra spaces
- ✅ Ensure you're using the latest key (not an old one)

### "Rate Limited" Message
- This rarely happens on Groq's free tier
- Wait a few seconds and try again
- Check Groq's status at [status.groq.com](https://status.groq.com)

### Slow Responses
- Groq is very fast, but network latency may vary
- Try selecting "mixtral-8x7b-32768" model (it's faster)
- Check your internet connection

### Nothing Happens When I Send a Message
- Open browser Developer Tools (F12)
- Check the **Console** tab for errors
- Verify the API key is correctly saved
- Try refreshing the page

## Using Groq in Production

⚠️ **Important**: 
- Groq's free tier is ideal for development/testing
- For production, consider:
  - Upgrading to Groq's paid tier (very affordable)
  - Using another provider (OpenAI, Anthropic, etc.)
  - Self-hosting Ollama for complete privacy

To switch providers:
1. Click **"⚙️ Configure LLM"** again
2. Select a different provider
3. Enter its API key
4. Click **"Save Configuration"**

## Groq API Documentation

For more details:
- [Groq API Docs](https://console.groq.com/docs)
- [Groq Models Info](https://console.groq.com/docs/models)
- [Pricing](https://groq.com/pricing)

## Cost Estimation

🎉 **Groq Free Tier**:
- No monthly costs
- No rate limits enforcement (soft limits apply)
- Unlimited API keys
- Perfect for prototyping

---

**Happy chatting! 🚀**
