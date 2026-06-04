/**
 * LLM Configuration Examples
 * 
 * Choose your preferred LLM provider and follow the setup below.
 * The chatbot will save your configuration in localStorage.
 */

// ============================================================================
// OPTION 1: OpenAI (GPT-4, GPT-3.5 Turbo)
// ============================================================================
// Setup:
// 1. Get API key from: https://platform.openai.com/api-keys
// 2. Go to https://platform.openai.com/account/billing/overview and set up billing
//
// Configuration in Chatbot:
// Provider: OpenAI (GPT-4, GPT-3.5)
// API Key: sk_...
// Model: gpt-4-turbo (recommended) or gpt-3.5-turbo
// Temperature: 0.7 (default)
// Max Tokens: 2048

export const OPENAI_CONFIG = {
  provider: 'openai' as const,
  apiKey: 'sk_YOUR_API_KEY_HERE',
  model: 'gpt-4-turbo',
  temperature: 0.7,
  maxTokens: 2048,
};

// ============================================================================
// OPTION 2: Anthropic (Claude)
// ============================================================================
// Setup:
// 1. Get API key from: https://console.anthropic.com/account/keys
// 2. Create an account and enable API access
//
// Configuration in Chatbot:
// Provider: Anthropic (Claude)
// API Key: sk-ant-...
// Model: claude-3-sonnet-20240229 (recommended)
// Temperature: 0.7 (default)
// Max Tokens: 2048

export const ANTHROPIC_CONFIG = {
  provider: 'anthropic' as const,
  apiKey: 'sk-ant-YOUR_API_KEY_HERE',
  model: 'claude-3-sonnet-20240229',
  temperature: 0.7,
  maxTokens: 2048,
};

// ============================================================================
// OPTION 3: Google Gemini
// ============================================================================
// Setup:
// 1. Get API key from: https://aistudio.google.com/app/apikey
// 2. Enable Generative AI API
//
// Configuration in Chatbot:
// Provider: Google (Gemini)
// API Key: AIzaSy...
// Model: gemini-1.5-pro
// Temperature: 0.7 (default)
// Max Tokens: 2048

export const GOOGLE_CONFIG = {
  provider: 'google' as const,
  apiKey: 'AIzaSy_YOUR_API_KEY_HERE',
  model: 'gemini-1.5-pro',
  temperature: 0.7,
  maxTokens: 2048,
};

// ============================================================================
// OPTION 4: Groq (Fast Inference)
// ============================================================================
// Setup:
// 1. Get API key from: https://console.groq.com/keys
// 2. No credit card required for free tier
// 3. Simple rate limits (good for testing)
//
// Configuration in Chatbot:
// Provider: Groq (Mixtral)
// API Key: gsk_...
// Model: mixtral-8x7b-32768 (recommended)
// Temperature: 0.7 (default)
// Max Tokens: 2048

export const GROQ_CONFIG = {
  provider: 'groq' as const,
  apiKey: 'gsk_YOUR_API_KEY_HERE',
  model: 'mixtral-8x7b-32768',
  temperature: 0.7,
  maxTokens: 2048,
};

// ============================================================================
// OPTION 5: Ollama (Local/Self-Hosted)
// ============================================================================
// Setup:
// 1. Install Ollama from: https://ollama.ai
// 2. Run in terminal:
//    - On Mac/Linux: `ollama serve`
//    - On Windows: Start Ollama desktop app
// 3. In another terminal, pull a model:
//    - `ollama pull mistral`
//    - `ollama pull llama2`
//    - `ollama pull neural-chat`
//    - `ollama pull starling-lm`
//
// No API key needed! Runs locally on your machine.
//
// Configuration in Chatbot:
// Provider: Ollama (Local)
// API Key: (leave empty)
// Base URL: http://localhost:11434
// Model: mistral (or any pulled model)
// Temperature: 0.7 (default)
// Max Tokens: 2048

export const OLLAMA_CONFIG = {
  provider: 'ollama' as const,
  apiKey: undefined, // Not needed for local
  model: 'mistral',
  baseUrl: 'http://localhost:11434',
  temperature: 0.7,
  maxTokens: 2048,
};

// ============================================================================
// Recommended Models for Each Provider
// ============================================================================

export const RECOMMENDED_MODELS = {
  openai: [
    'gpt-4-turbo', // Best quality, most expensive
    'gpt-4', // Good quality
    'gpt-3.5-turbo', // Fast, affordable
  ],
  anthropic: [
    'claude-3-opus-20240229', // Best quality
    'claude-3-sonnet-20240229', // Balanced (recommended)
    'claude-3-haiku-20240307', // Fast, cheap
  ],
  google: [
    'gemini-1.5-pro', // Best quality
    'gemini-1.5-flash', // Fast
    'gemini-1.0-pro', // Stable
  ],
  groq: [
    'mixtral-8x7b-32768', // Best quality
    'llama-2-70b-4096', // Fast
  ],
  ollama: [
    'mistral', // Recommended - 7B
    'llama2', // 7B model
    'neural-chat', // 7B, optimized for chat
    'starling-lm', // 7B
  ],
};

// ============================================================================
// Cost Comparison (approximate, as of 2024)
// ============================================================================

/*
OpenAI:
- GPT-4 Turbo: $0.01 input / $0.03 output per 1K tokens
- GPT-3.5: $0.50 / $1.50 per 1M tokens

Anthropic (Claude):
- Opus: $0.015 input / $0.075 output per 1K tokens
- Sonnet: $0.003 input / $0.015 output per 1K tokens
- Haiku: $0.00025 input / $0.00125 output per 1K tokens

Google (Gemini):
- 1.5 Pro: $0.075 input / $0.3 output per 1M tokens
- 1.5 Flash: $0.0375 input / $0.15 output per 1M tokens

Groq:
- Free tier available (limited usage)
- Pro tier: Pay-as-you-go

Ollama:
- Completely free (runs locally)
- Only costs your compute resources
*/

// ============================================================================
// Quick Start (Copy & Paste)
// ============================================================================

// For OpenAI (Most Popular):
// 1. Get key from: https://platform.openai.com/api-keys
// 2. In chatbot, click "Configure"
// 3. Provider: OpenAI (GPT-4, GPT-3.5)
// 4. API Key: [paste your key]
// 5. Model: gpt-4-turbo
// 6. Click "Save Configuration"

// For Local Ollama (Free):
// 1. Install: brew install ollama (on Mac)
// 2. Run: ollama serve
// 3. Pull model: ollama pull mistral
// 4. In chatbot, click "Configure"
// 5. Provider: Ollama (Local)
// 6. Base URL: http://localhost:11434
// 7. Model: mistral
// 8. Click "Save Configuration"

// ============================================================================
// Testing the Chatbot
// ============================================================================

/*
After configuring, try these prompts:

1. Search Vehicles:
   "Show me available SUVs in Mumbai costing less than 5000 per day"
   "Find luxury cars for premium customers"
   "What cars do you have available?"

2. Customer Lookup:
   "Search for customer John Smith"
   "Find customer with email john@example.com"
   "Get details for mobile 9876543210"

3. Create Booking:
   "Book a Maruti Swift for Raj Kumar from June 10 to June 15"
   "Create a booking for the cheapest available car for 5 days"

4. Check Availability:
   "Is the Tesla available from July 1 to July 7?"
   "What's available next week?"

5. Calculate Price:
   "How much would a BMW 5 Series cost for a week?"
   "Price for Hyundai Creta for 3 days with SUMMER20 promo"

6. Get Booking History:
   "Show me all bookings for john@example.com"
   "What are the pending bookings?"
*/

// ============================================================================
// Environment Variables (for production)
// ============================================================================

/*
Create .env file in your project root:

# OpenAI
VITE_LLM_PROVIDER=openai
VITE_LLM_OPENAI_API_KEY=sk_...
VITE_LLM_MODEL=gpt-4-turbo

# Or for Anthropic
VITE_LLM_PROVIDER=anthropic
VITE_LLM_ANTHROPIC_API_KEY=sk-ant-...
VITE_LLM_MODEL=claude-3-sonnet-20240229

# Or for local Ollama
VITE_LLM_PROVIDER=ollama
VITE_LLM_BASE_URL=http://localhost:11434
VITE_LLM_MODEL=mistral

Then in your component:
const provider = import.meta.env.VITE_LLM_PROVIDER;
const apiKey = import.meta.env.VITE_LLM_OPENAI_API_KEY;
// etc.
*/

// ============================================================================
// Advanced Configuration
// ============================================================================

// Lower temperature = More deterministic (better for data queries)
// Higher temperature = More creative (better for conversations)

export const TEMPERATURE_PRESETS = {
  DATA_QUERIES: 0.2, // For searching customers and vehicles
  BALANCED: 0.7, // Default, good for most tasks
  CREATIVE: 1.5, // For generating suggestions
};

// Adjust max tokens based on response type
export const MAX_TOKENS_PRESETS = {
  SHORT: 512, // For yes/no answers
  MEDIUM: 2048, // Default
  LONG: 4096, // For detailed responses
};
