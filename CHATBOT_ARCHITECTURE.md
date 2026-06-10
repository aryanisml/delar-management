# 🏗️ Chatbot Architecture Diagram

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CHATBOT SYSTEM                             │
└─────────────────────────────────────────────────────────────────────┘

                          ┌─────────────────┐
                          │   User Browser  │
                          │ (Your Computer) │
                          └────────┬────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
                    ▼                             ▼
          ┌──────────────────────┐     ┌─────────────────────┐
          │  ChatbotComponent    │     │  Configuration      │
          │  - Message Display   │     │  - LLM Setup        │
          │  - User Input        │     │  - API Key Input    │
          │  - Tool Visualization│     │  - Model Selection  │
          └──────────┬───────────┘     └─────────────────────┘
                     │
                     ▼
          ┌──────────────────────────────┐
          │  ChatbotLLMService           │
          │  (Main Business Logic)       │
          │  - Message Management        │
          │  - Tool Calling              │
          │  - Provider Routing          │
          └──────────┬───────────────────┘
                     │
                     │ (sends messages)
                     ▼
      ┌────────────────────────────────────┐
      │      LLM PROVIDER ROUTING          │
      └─┬──────┬──────┬──────┬──────────────┘
        │      │      │      │
    ┌───▼──┬──▼──┬──▼──┬──▼──┬──────────┐
    │      │     │     │     │          │
    ▼      ▼     ▼     ▼     ▼          ▼
  OpenAI Groq Claude Google Anthropic Ollama
    │      │     │     │     │          │
    └──────┴─────┴─────┴─────┴──────────┘
           │
           ▼
    ┌─────────────────┐
    │  Tool Execution │
    │  - search_*     │
    │  - get_*        │
    │  - create_*     │
    │  - check_*      │
    │  - calculate_*  │
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │   Supabase DB   │
    │  (Your Data)    │
    │  - Customers    │
    │  - Vehicles     │
    │  - Bookings     │
    └─────────────────┘
```

---

## Component Hierarchy

```
AppComponent
  │
  └─ Layout (auth protected)
      │
      ├─ AdminSidebar ◄── ADD CHATBOT LINK HERE
      │
      ├─ AdminTopbar
      │
      └─ Router Outlet
          │
          ├─ AdminDashboard
          ├─ DealerDashboard
          ├─ ProfileComponent
          │
          └─ ChatbotPageComponent ◄─ NEW!
              │
              └─ ChatbotComponent (Standalone)
                  │
                  ├─ Message Display Area
                  │   ├─ User Messages
                  │   ├─ Assistant Messages
                  │   ├─ Tool Messages
                  │   └─ Tool Results
                  │
                  ├─ Configuration Dialog
                  │   ├─ Provider Selector
                  │   ├─ API Key Input
                  │   ├─ Model Selector
                  │   ├─ Temperature Slider
                  │   └─ Token Limit Input
                  │
                  └─ Input Area
                      ├─ Textarea
                      │
                      └─ Send Button
```

---

## Service Dependency Injection

```
ChatbotComponent
    │
    ├─ Injected: ChatbotLLMService
    │    ├─ Injected: HttpClient
    │    ├─ Injected: SupabaseService
    │    │    └─ Injected: SupabaseClient
    │    │
    │    └─ Provides:
    │         ├─ messages$ (Observable)
    │         ├─ loading$ (Observable)
    │         ├─ error$ (Observable)
    │         └─ Methods:
    │             ├─ sendMessage()
    │             ├─ setLLMConfig()
    │             └─ clearMessages()
    │
    ├─ Injected: MessageService (PrimeNG)
    │    └─ For toast notifications
    │
    └─ Injected: destroyRef (for cleanup)
```

---

## Data Flow: User Messages

```
User Types Message
    │
    ▼
User Clicks Send or Presses Ctrl+Enter
    │
    ▼
ChatbotComponent.sendMessage()
    │
    ▼
Add User Message to Store
    │
    ▼
Call ChatbotLLMService.sendMessage()
    │
    ▼
Build Message Array (for LLM context)
    │
    ▼
Determine Provider (OpenAI, Groq, etc.)
    │
    ▼
Call Appropriate Provider Method
    │
    ├─ OpenAI         ─► GET /v1/chat/completions
    ├─ Anthropic      ─► POST /v1/messages
    ├─ Google         ─► POST generativelanguage API
    ├─ Groq           ─► GET /openai/v1/chat/completions
    └─ Ollama         ─► POST /api/chat
    │
    ▼
Receive LLM Response
    │
    ├─ If has tool_calls/tool_use:
    │   │
    │   ▼
    │   Add Assistant Message with Tool Calls
    │   │
    │   ▼
    │   Execute Each Tool
    │   │   ├─ search_customers  ─► Query Supabase
    │   │   ├─ search_vehicles   ─► Query Supabase
    │   │   ├─ create_booking    ─► Insert Supabase
    │   │   └─ ... (other tools)
    │   │
    │   ▼
    │   Add Tool Results Message
    │   │
    │   ▼
    │   Call LLM Again with Tool Results
    │   │
    │   ▼
    │   Add Final Assistant Message
    │
    └─ If no tools needed:
        │
        ▼
        Add Assistant Message
        │
        ▼
        Display to User

    All messages displayed in real-time
    │
    ▼
User Sees Response
```

---

## Tool Execution Flow

```
LLM Suggests Tool: "search_vehicles"
    │
    ▼
Extract Tool Name & Arguments
    │   name: "search_vehicles"
    │   args: {
    │     brand: "Maruti",
    │     location: "Mumbai",
    │     max_price: 5000
    │   }
    │
    ▼
Execute Tool in ChatbotLLMService
    │
    ▼
Router to Specific Tool Handler
    │
    ├─ search_customers    ─► toolSearchCustomers()
    ├─ search_vehicles     ─► toolSearchVehicles()
    ├─ get_vehicle_details ─► toolGetVehicleDetails()
    ├─ get_customer_details── toolGetCustomerDetails()
    ├─ check_availability  ─► toolCheckAvailability()
    ├─ create_booking      ─► toolCreateBooking()
    ├─ get_booking_status  ─► toolGetBookingStatus()
    ├─ calculate_booking_price ─► toolCalculateBookingPrice()
    └─ get_customer_bookings ─► toolGetCustomerBookings()
    │
    ▼
Query Supabase Database
    │
    ├─ SELECT from customers/vehicles/bookings
    ├─ INSERT new booking
    ├─ Calculate with business logic
    │
    ▼
Return Results
    │
    ▼
Format as Tool Result
    │
    ▼
Add to Response
    │
    ▼
Display to User
```

---

## State Management

```
ChatbotLLMService
    │
    ├─ messagesSubject: BehaviorSubject<ChatMessage[]>
    │   │ Emits: messages$
    │   │ Value: Array of all chat messages
    │   │
    │   └─ Types:
    │       ├─ role: 'user' | 'assistant' | 'tool'
    │       ├─ content: string
    │       ├─ toolCalls?: ToolCall[]
    │       └─ toolResults?: ToolResult[]
    │
    ├─ loadingSubject: BehaviorSubject<boolean>
    │   │ Emits: loading$
    │   │ Value: true/false
    │   │
    │   └─ Used for: Loading indicators
    │
    └─ errorSubject: BehaviorSubject<string | null>
        │ Emits: error$
        │ Value: Error message or null
        │
        └─ Used for: Error notifications

Configuration Storage
    │
    └─ localStorage.setItem('llm-config')
       └─ Persists: provider, apiKey, model, temperature, maxTokens
```

---

## LLM Provider Integration Points

```
Provider Interface (Internal)
    │
    ├─ Accepts: messages[], useTools boolean
    │
    ├─ Returns: { assistantMessage, toolCalls? }
    │
    └─ Implementations:
    
        ┌─ OpenAI ────────────────────────────┐
        │ URL: api.openai.com/v1/chat/completions
        │ Format: tools[] array with type: 'function'
        │ Tool Use: message.tool_calls[]
        └──────────────────────────────────────┘
    
        ┌─ Anthropic ──────────────────────────┐
        │ URL: api.anthropic.com/v1/messages
        │ Format: tools[] with input_schema
        │ Tool Use: content[].type === 'tool_use'
        └──────────────────────────────────────┘
    
        ┌─ Google ─────────────────────────────┐
        │ URL: generativelanguage.googleapis.com
        │ Format: functionDeclarations[] array
        │ Tool Use: parts[].functionCall
        └──────────────────────────────────────┘
    
        ┌─ Groq ───────────────────────────────┐
        │ URL: api.groq.com/openai/v1/chat/completions
        │ Format: OpenAI-compatible tools[]
        │ Tool Use: message.tool_calls[]
        └──────────────────────────────────────┘
    
        ┌─ Ollama ──────────────────────────────┐
        │ URL: localhost:11434/api/chat
        │ Format: Basic message format (limited)
        │ Tool Use: JSON in response (manual)
        └───────────────────────────────────────┘
```

---

## Error Handling Flow

```
User Action
    │
    ▼
Try/Catch Block
    │
    ├─ Network Error
    │   │
    │   └─► Toast: "Failed to connect to LLM"
    │
    ├─ Invalid API Key
    │   │
    │   └─► Toast: "OpenAI API error: Unauthorized"
    │
    ├─ Tool Execution Error
    │   │
    │   └─► ToolResult: { error: "Database not accessible" }
    │       │
    │       └─► Show in UI with error styling
    │
    ├─ Supabase Query Error
    │   │
    │   └─► Tool Result: { error: "Query failed" }
    │
    └─ Unexpected Error
        │
        └─► Console log + User notification
```

---

## File Organization

```
src/app/
├── services/
│   ├── chatbot-llm.service.ts ◄─ Main service (500 lines)
│   ├── llm-tools.ts ◄─ Tool schemas (300 lines)
│   ├── llm-config.example.ts ◄─ Config examples
│   ├── auth.ts
│   ├── booking-flow.ts
│   ├── supabase.ts
│   └── ... (other services)
│
├── Shared/
│   └── components/
│       └── chatbot/ ◄─ NEW COMPONENT
│           ├── chatbot.component.ts (200 lines)
│           ├── chatbot.component.html (150 lines)
│           └── chatbot.component.scss (400 lines)
│
├── pages/
│   └── chatbot-page/ ◄─ NEW PAGE
│       └── chatbot-page.component.ts (30 lines)
│
├── layout/
├── models/
└── ... (other pages)

Root/
├── CHATBOT_README.md ◄─ Full documentation
├── CHATBOT_QUICKSTART.md ◄─ Setup guide
├── CHATBOT_INTEGRATION.md ◄─ Integration guide
├── CHATBOT_IMPLEMENTATION_SUMMARY.md ◄─ Summary
└── CHATBOT_FILES_CREATED.md ◄─ This checklist
```

---

## Tool Database Queries

```
Tool Execution Calls Supabase:

search_customers
    └─ SELECT * FROM customers
       WHERE name ILIKE %query%
          OR email ILIKE %query%
          OR phone ILIKE %query%

search_vehicles
    └─ SELECT * FROM vehicles
       WHERE brand ILIKE %brand%
         AND status = 'available'
         AND (conditions...)

create_booking
    └─ INSERT INTO bookings
       VALUES (customer_id, vehicle_id, dates, location)
       RETURNING *

check_availability
    └─ SELECT * FROM bookings
       WHERE vehicle_id = ?
         AND status = 'confirmed'
         AND (dates overlap)

get_booking_status
    └─ SELECT * FROM bookings
       WHERE id = ?

get_customer_bookings
    └─ SELECT * FROM bookings
       WHERE customer_id = ?
       AND status = ? (optional filter)
```

---

## Security Layers

```
Access Control
    │
    ├─ Route Guard
    │   └─ authGuard on /ai-assistant route
    │
    ├─ Authentication
    │   └─ Must be logged-in user
    │
    └─ Authorization
        └─ Can read/write own data

API Key Management
    │
    ├─ Development: localStorage
    │   └─ Visible in DevTools (test only)
    │
    └─ Production: Backend Proxy
        ├─ Store key securely on server
        ├─ Frontend calls: POST /api/llm/chat
        ├─ Backend handles LLM communication
        └─ Backend logs all requests

Data Protection
    │
    ├─ Database: Supabase with RLS
    │
    ├─ Network: HTTPS/TLS
    │
    └─ Error Handling: No sensitive data in UI errors
```

---

## UI State Transitions

```
Initial State
    ├─ No LLM configured
    ├─ Empty message list
    ├─ Input disabled
    └─ "Configure" button visible

Configure → Click Button
    ├─ Dialog opens
    ├─ Form visible
    └─ "Save" button ready

Configure → Save
    ├─ Dialog closes
    ├─ Input enabled
    ├─ Messages cleared
    └─ Ready for input

Typing Message
    ├─ Message visible in input
    ├─ "Send" button enabled if text present
    ├─ Ctrl+Enter sends
    └─ Or click "Send" button

Message Sent
    ├─ User message appears
    ├─ Input cleared
    ├─ Loading spinner shown
    ├─ Send button disabled
    └─ Tool calls show (if any)

Tool Executing
    ├─ Tool results appear
    ├─ Database queries running
    └─ User sees: "Tool Results"

Response Ready
    ├─ Loading spinner removed
    ├─ Send button re-enabled
    ├─ Assistant message appears
    ├─ Input enabled
    └─ Ready for next message
```

---

## Performance Optimization Path

```
User sends message
    │
    ├─ 100ms: Message validated
    ├─ 200ms: LLM API call initiated
    │
    ├─ LLM Response Time (varies by provider):
    │   ├─ Ollama: 1-3s
    │   ├─ Groq: 0.5-2s
    │   ├─ OpenAI: 2-5s
    │   └─ Anthropic: 1-3s
    │
    ├─ Tool Execution (if needed): 500ms-2s
    │   └─ Database query: 100-500ms
    │   └─ LLM final response: 1-3s
    │
    └─ Total Time: 2-10 seconds (typical)
```

---

This completes the complete visual architecture of your chatbot system! 🎉
