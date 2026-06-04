# Chatbot Integration Guide

## Add Chatbot Link to Sidebar

Update your sidebar/layout component to include a link to the chatbot.

### For Admin Users

Add to admin sidebar (e.g., `admin-sidebar.component.html`):

```html
<!-- Add this to your admin navigation menu -->
<div class="menu-section">
  <a 
    routerLink="/ai-assistant" 
    routerLinkActive="active"
    class="menu-item"
  >
    <i class="pi pi-fw pi-comment"></i>
    <span>AI Assistant</span>
  </a>
</div>
```

### For Dealer Users

Add to dealer sidebar (e.g., `dealer-sidebar.component.html`):

```html
<!-- Add this to dealer navigation menu -->
<div class="quick-actions">
  <a 
    routerLink="/ai-assistant" 
    routerLinkActive="active"
    class="action-btn"
  >
    <i class="pi pi-bolt"></i>
    <span>Chat with AI</span>
  </a>
</div>
```

## Update Navigation Menu

### Using your existing navigation component:

```typescript
// In your navigation/menu service
export const MENU_ITEMS = [
  // ... existing items
  {
    label: 'AI Assistant',
    icon: 'pi pi-comment',
    routerLink: ['/ai-assistant'],
    badge: 'NEW', // Optional
  }
];
```

## Update Main Sidebar (Admin-Sidebar Component)

If your layout has a dedicated admin sidebar, add:

```html
<!-- In admin-sidebar.component.html -->
<ul class="sidebar-menu">
  <!-- Existing menu items -->
  
  <li class="menu-divider">
    <span class="divider-label">TOOLS</span>
  </li>
  
  <li>
    <a 
      routerLink="/ai-assistant"
      routerLinkActive="active"
      [routerLinkActiveOptions]="{ exact: true }"
      class="menu-link"
    >
      <i class="pi pi-fw pi-comment"></i>
      <span>AI Assistant</span>
      <span class="badge badge-success">Beta</span>
    </a>
  </li>
</ul>
```

## Mobile Navigation

Add to mobile menu/drawer:

```html
<!-- In mobile navigation component -->
<div class="mobile-menu-item">
  <a routerLink="/ai-assistant" class="flex align-items-center gap-2">
    <i class="pi pi-comment"></i>
    <span>Chat Assistant</span>
  </a>
</div>
```

## Styling for Navigation

```scss
// In your admin-sidebar.scss or styles.scss

.ai-assistant-link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-radius: 8px;
  transition: all 0.3s ease;

  &:hover {
    background-color: #f3f4f6;
  }

  &.active {
    background-color: #3b82f6;
    color: white;
  }

  i {
    font-size: 18px;
  }
}
```

## Update Topbar (Optional)

Add quick access button in topbar:

```html
<!-- In admin-topbar.component.html -->
<div class="topbar-actions">
  <!-- Existing actions -->
  
  <button 
    pButton 
    type="button" 
    icon="pi pi-comment" 
    [routerLink]="['/ai-assistant']"
    pTooltip="AI Assistant"
    tooltipPosition="bottom"
    class="p-button-rounded p-button-outlined"
  ></button>
</div>
```

## Add to Profile Menu

In user profile dropdown:

```html
<!-- In profile/auth menu component -->
<p-menu [model]="menuItems" [popup]="true" #menu></p-menu>

<!-- Menu items -->
<a 
  routerLink="/ai-assistant"
  class="dropdown-item"
>
  <i class="pi pi-comment"></i> 
  Chat with AI
</a>
```

## Update Route Metadata

The route is already configured, but you can enhance it:

```typescript
// In app.routes.ts (already done, but for reference)
{
  path: 'ai-assistant',
  component: ChatbotPageComponent,
  canActivate: [authGuard],
  data: { 
    title: 'AI Chat Assistant',
    description: 'Chat with AI to manage bookings and vehicles',
    icon: 'pi pi-comment'
  }
}
```

## Breadcrumb Navigation

Add to breadcrumb component:

```typescript
// In breadcrumb service or component
case '/ai-assistant':
  return [
    { label: 'Home', routerLink: '/' },
    { label: 'AI Assistant' }
  ];
```

## Icon Reference

All icons use PrimeIcons. Relevant icons for chatbot:

```
pi pi-comment      // Comment/chat
pi pi-comments     // Multiple comments
pi pi-bolt         // Lightning/AI
pi pi-star         // Favorite
pi pi-fw           // Fixed width
pi pi-send         // Send message
pi pi-paperclip    // Attachments
pi pi-spin pi-spinner // Loading
```

## Analytics Integration

Track when users access the chatbot:

```typescript
// In your analytics service
navigateToChatbot() {
  this.router.navigate(['/ai-assistant']);
  
  // Track event
  this.analytics.trackEvent({
    category: 'Navigation',
    action: 'Open AI Assistant',
    label: 'Chatbot Access'
  });
}
```

## Feature Flag (Optional)

If you want to control chatbot visibility:

```typescript
// In your feature service
export class FeatureService {
  isAIAssistantEnabled = true; // Set based on config
}

// In template
<a 
  *ngIf="(featureService.isAIAssistantEnabled$ | async)"
  routerLink="/ai-assistant"
>
  AI Assistant
</a>
```

## Configuration in Environment

Add to your environment files:

```typescript
// environment.ts
export const environment = {
  // ... existing config
  features: {
    aiChatbot: true,
    defaultLLMProvider: 'ollama', // or 'openai', 'anthropic', etc.
  }
};
```

## Testing Navigation

After adding the link:

1. Login to the app
2. Look for "AI Assistant" in sidebar/menu
3. Click it - should navigate to `/ai-assistant`
4. You should see the chatbot UI
5. Click "Configure" to set up LLM
6. Send a test message

## Troubleshooting

### Link doesn't appear
- Check `ChatbotPageComponent` is imported in routes
- Verify route path is `/ai-assistant`
- Check authGuard is not blocking access

### Visual issues
- Ensure PrimeNG styles are loaded
- Check SCSS is being compiled
- Review browser console for CSS errors

### Navigation doesn't work
- Clear browser cache
- Hard refresh (Cmd+Shift+R / Ctrl+Shift+R)
- Check routerLink syntax

## Complete Example

Here's a minimal sidebar update:

```html
<!-- admin-sidebar.component.html -->
<div class="admin-sidebar">
  <nav class="nav-menu">
    <a 
      routerLink="/admin/dashboard" 
      routerLinkActive="active"
    >
      Dashboard
    </a>
    
    <a 
      routerLink="/admin/vehicles" 
      routerLinkActive="active"
    >
      Vehicles
    </a>
    
    <!-- New Chatbot Link -->
    <a 
      routerLink="/ai-assistant" 
      routerLinkActive="active"
      class="ai-assistant-link"
      title="Chat with AI to search vehicles and create bookings"
    >
      <i class="pi pi-bolt"></i>
      <span>AI Assistant</span>
    </a>
  </nav>
</div>
```

---

✓ Chatbot is ready to integrate!
