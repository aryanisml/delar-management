# Chatbot Integration Guide

## Overview
This chatbot component provides an intelligent interface to manage vehicle rental operations using natural language. It can connect to any online LLM (Large Language Model) and execute tools to search customers, vehicles, and manage bookings.

## Features

- **Multi-LLM Support**:
  - OpenAI (GPT-4, GPT-3.5-turbo)
  - Anthropic (Claude 3 family)
  - Google (Gemini)
  - Groq (Mixtral, Llama 2)
  - Ollama (Local models)

- **Tool Calling**: Automatically execute operations like:
  - Search customers by name, email, or phone
  - Search vehicles by brand, model, location
  - Create bookings
  - Check vehicle availability
  - Calculate pricing with promotions
  - Get booking status
  - View customer booking history

- **Interactive UI**:
  - Real-time message streaming
  - Tool execution visualization
  - Configuration management
  - Responsive design

## Setup Instructions

### 1. Installation

The chatbot is already integrated into your project. You just need to add it to a route or include it in a layout component.

### 2. Add to Routes

In your `app.routes.ts`, add the chatbot page route:

```typescript
import { ChatbotPageComponent } from './pages/chatbot-page/chatbot-page.component';

export const routes: Routes = [
  // ... existing routes
  {
    path: 'chatbot',
    component: ChatbotPageComponent,
    canActivate: [authGuard],
    data: { title: 'AI Assistant' }
  },
];
```

### 3. Add HttpClientModule

In your `main.ts` or app config, ensure HttpClientModule is provided:

```typescript
import { HttpClientModule } from '@angular/common/http';

bootstrapApplication(AppComponent, {
  providers: [
    HttpClientModule,
    // ... other providers
  ]
});
```

Or if using regular module imports, add to your module:

```typescript
import { HttpClientModule } from '@angular/common/http';

@NgModule({
  imports: [HttpClientModule]
})
export class AppModule { }
```

### 4. Configure LLM

After loading the chatbot page, click the "Configure" button and set up your preferred LLM:

#### OpenAI Setup
1. Get API key from [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Select provider: "OpenAI (GPT-4, GPT-3.5)"
3. Enter API Key
4. Select model (e.g., "gpt-4-turbo")
5. Click "Save Configuration"

#### Anthropic Setup
1. Get API key from [https://console.anthropic.com/account/keys](https://console.anthropic.com/account/keys)
2. Select provider: "Anthropic (Claude)"
3. Enter API Key
4. Select Claude model
5. Click "Save Configuration"

#### Google Gemini Setup
1. Get API key from [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Select provider: "Google (Gemini)"
3. Enter API Key
4. Select model (e.g., "gemini-1.5-pro")
5. Click "Save Configuration"

#### Groq Setup
1. Get API key from [https://console.groq.com/keys](https://console.groq.com/keys)
2. Select provider: "Groq (Mixtral)"
3. Enter API Key
4. Select model
5. Click "Save Configuration"

#### Ollama Setup (Local)
1. Install Ollama from [https://ollama.ai](https://ollama.ai)
2. Run `ollama serve` in terminal
3. Pull a model: `ollama pull mistral` (or any other model)
4. Select provider: "Ollama (Local)"
5. Leave API Key empty (not required for local)
6. Keep base URL as: `http://localhost:11434`
7. Select model
8. Click "Save Configuration"

## Usage Examples

### Search for a Vehicle
**User:** "Show me available SUVs in Mumbai under 5000 per day"
**Bot:** Searches vehicles and returns matching results, then can help with booking

### Check Customer History
**User:** "Get me the booking history for john@example.com"
**Bot:** Retrieves all bookings for that customer

### Create a Booking
**User:** "Book a Maruti Swift for customer Raj Kumar from June 5 to June 10"
**Bot:** Checks availability, calculates price, and creates the booking

### Calculate Pricing
**User:** "How much would a Hyundai Creta cost for 7 days with promo code SUMMER20?"
**Bot:** Calculates pricing including taxes and discounts

## Tool Definitions

The chatbot has access to 9 tools:

### 1. `search_customers`
Search customers by name, email, or phone number
- **Parameters**: `query` (required), `limit` (optional)

### 2. `search_vehicles`
Search vehicles by specifications
- **Parameters**: `brand` (required), `model`, `location`, `min_price`, `max_price`, `vehicle_type`

### 3. `get_vehicle_details`
Get full details of a specific vehicle
- **Parameters**: `vehicle_id` (required)

### 4. `get_customer_details`
Get customer information
- **Parameters**: `customer_id` or `email` (at least one required)

### 5. `check_availability`
Check if a vehicle is available for dates
- **Parameters**: `vehicle_id`, `start_date`, `end_date` (all required, YYYY-MM-DD format)

### 6. `create_booking`
Create a new booking
- **Parameters**: `customer_id`, `vehicle_id`, `start_date`, `end_date`, `pickup_location` (required), `dropoff_location`, `special_requests`

### 7. `get_booking_status`
Get booking details
- **Parameters**: `booking_id` (required)

### 8. `calculate_booking_price`
Calculate total rental price
- **Parameters**: `vehicle_id`, `start_date`, `end_date` (required), `promo_code` (optional)

### 9. `get_customer_bookings`
Get all bookings for a customer
- **Parameters**: `customer_id` (required), `status` (optional: pending, confirmed, completed, cancelled)

## Architecture

### Service Layer (`chatbot-llm.service.ts`)
- Manages LLM connections
- Handles API communication
- Processes tool calls
- Maintains conversation history

### Component Layer (`chatbot.component.ts`)
- Manages UI state
- Handles user input
- Displays messages and tool results
- Configuration management

### Tool Definitions (`llm-tools.ts`)
- Defines available tools
- Tool schemas and parameters
- Tool descriptions for LLM

## Advanced Features

### Custom LLM Configuration
The service supports custom base URLs for self-hosted LLMs:
```typescript
const config: LLMConfig = {
  provider: 'ollama',
  model: 'mistral',
  baseUrl: 'http://your-server:11434'
};
chatbotService.setLLMConfig(config);
```

### Temperature Control
Adjust model creativity:
- **0.0**: Most deterministic (fact-based)
- **0.7**: Balanced (default)
- **2.0**: Most creative

### Token Management
Configure max tokens based on your needs and API limits.

### Error Handling
The service includes comprehensive error handling for:
- Network failures
- API errors
- Tool execution errors
- Invalid configurations

## Integration with Existing Services

The chatbot integrates with your existing services:

### Supabase Integration
- Uses `SupabaseService` for database queries
- Executes tools using Supabase client
- Supports custom query logic

### Authentication
- Protected by `authGuard`
- Uses authenticated user context
- Secure database access

## Customization

### Adding Custom Tools

To add a new tool, update `llm-tools.ts`:

```typescript
export const CHATBOT_TOOLS: ToolDefinition[] = [
  // ... existing tools
  {
    name: 'my_custom_tool',
    description: 'What this tool does',
    parameters: {
      type: 'object',
      properties: {
        param1: { type: 'string', description: '...' },
      },
      required: ['param1'],
    },
  },
];
```

Then implement in `chatbot-llm.service.ts`:

```typescript
private async executeTool(toolName: ToolName, args: Record<string, any>): Promise<any> {
  // ... existing cases
  case 'my_custom_tool':
    return this.toolMyCustomTool(args);
  // ...
}

private async toolMyCustomTool(args: { param1: string }): Promise<any> {
  // Your implementation
}
```

### Styling Customization

The component uses SCSS with CSS variables. Customize in `chatbot.component.scss`:

```scss
.message-avatar {
  background: your-color; // Change avatar colors
}

.send-btn {
  // Customize button styling
}
```

## Troubleshooting

### "LLM not configured" error
- Click Configure button
- Select LLM provider
- Enter valid API key
- Save configuration

### API Key not working
- Verify API key is correct
- Check account has API access enabled
- Ensure billing is set up
- Check API key hasn't been revoked

### Tools not executing
- Check Supabase connection
- Verify database tables exist
- Check user permissions
- Review tool parameters

### Slow responses
- Reduce `maxTokens`
- Lower `temperature` value
- Use a faster model
- Check network connection

## Performance Optimization

1. **Cache Tool Results**: Implement Redis caching for frequent queries
2. **Batch Operations**: Group multiple bookings or searches
3. **Stream Responses**: Enable streaming for long responses
4. **Rate Limiting**: Implement per-user rate limits

## Security Best Practices

1. **Store API Keys Securely**: Consider backend proxy for API calls
2. **Validate Tool Parameters**: Implement input validation
3. **Authorization Checks**: Verify user permissions before operations
4. **Audit Logging**: Log all operations for compliance
5. **Rate Limiting**: Prevent abuse

## Production Deployment

For production, consider:

1. **Backend Proxy**: Don't expose API keys to frontend
```typescript
// Call your backend instead
POST /api/chat
{
  message: string,
  conversationId: string
}
```

2. **Environment Configuration**:
```typescript
// Use environment files
import { environment } from '../environments/environment';

chatbot.setLLMConfig({
  provider: environment.llmProvider,
  model: environment.llmModel,
  // baseUrl for backend proxy
  baseUrl: environment.apiBaseUrl + '/llm'
});
```

3. **Session Management**: Persist conversations per user
4. **Analytics**: Track user interactions and tool usage
5. **Monitoring**: Monitor API usage and costs

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review LLM provider documentation
3. Check browser console for errors
4. Review Supabase logs
