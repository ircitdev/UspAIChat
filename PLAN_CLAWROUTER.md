# Plan: ClawRouter Integration — Auto Model Routing

## Overview

Integrate [ClawRouter](https://github.com/BlockRunAI/ClawRouter) intelligent routing into UspAIChat.
When user selects "Auto" provider (default), the system automatically picks the best model based on prompt complexity, then shows the user which model was used and why.

**Goal:** Reduce costs by 70-90% by routing simple queries to cheap models and only using premium models for complex tasks.

---

## How ClawRouter Works

ClawRouter analyzes prompts across 14 dimensions (code presence, reasoning markers, technical terminology, multi-step patterns, etc.) and classifies them into tiers:

| Tier | Score Range | Example Models |
|------|-------------|----------------|
| SIMPLE | 0.0-0.3 | Gemini Flash, DeepSeek |
| MEDIUM | 0.3-0.5 | GPT-4o, Kimi |
| COMPLEX | 0.5+ | Claude Opus, Gemini Pro |
| REASONING | Special | o1, Claude with thinking |

ClawRouter exports a `route()` function that returns:
```js
{
  model: "gemini-2.5-flash",
  tier: "SIMPLE",
  confidence: 0.85,
  reasoning: "Simple factual query, no code or multi-step reasoning required",
  costEstimate: 0.0003,
  savings: 0.92
}
```

**Our approach:** Use `route()` only for classification, then route through our own provider services with our own API keys and billing.

---

## Architecture

```
User sends message with provider = "auto"
         |
         v
Backend receives POST /api/chat/stream
         |
         v
ClawRouter route(prompt) => { model, tier, reasoning, ... }
         |
         v
Map ClawRouter model → our provider + model
         |
         v
Existing streaming (streamClaude / streamOpenAI / streamGemini)
         |
         v
SSE response includes routing_info: { model, tier, reasoning }
         |
         v
Frontend/Mobile shows "Answered by Claude Opus (Complex task)"
         Click → modal with full reasoning
```

---

## Phase 1: Backend — ClawRouter Integration (2-3 days)

### 1.1 Install ClawRouter as dependency

**File:** `backend/package.json`

```bash
cd backend && npm install @blockrun/clawrouter
```

We only need the `route()` function — NOT the proxy server or wallet/payment system.

### 1.2 Create auto-router service

**New file:** `backend/src/services/autoRouter.js`

```js
import { route } from '@blockrun/clawrouter';

// Map ClawRouter model IDs to our provider/model pairs
const MODEL_MAP = {
  'claude-opus-4-6':     { provider: 'anthropic', model: 'claude-opus-4-6' },
  'claude-sonnet-4-6':   { provider: 'anthropic', model: 'claude-sonnet-4-6' },
  'claude-haiku-4-5':    { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
  'gpt-4o':              { provider: 'openai',    model: 'gpt-4o' },
  'gpt-4o-mini':         { provider: 'openai',    model: 'gpt-4o-mini' },
  'gemini-2.5-flash':    { provider: 'gemini',    model: 'gemini-2.5-flash' },
  'gemini-2.5-pro':      { provider: 'gemini',    model: 'gemini-2.5-pro' },
  'deepseek-chat':       { provider: 'deepseek',  model: 'deepseek-chat' },
  // ... extend as needed
};

export async function autoRoute(messages, options = {}) {
  const prompt = messages.map(m => m.content).join('\n');
  const decision = await route(prompt, {
    profile: options.profile || 'auto',
    // filter: only models we have keys for
  });

  const mapped = MODEL_MAP[decision.model];
  if (!mapped) {
    // Fallback to default
    return {
      provider: 'openai', model: 'gpt-4o',
      routingInfo: { ...decision, fallback: true }
    };
  }

  return {
    provider: mapped.provider,
    model: mapped.model,
    routingInfo: {
      selectedModel: decision.model,
      tier: decision.tier,
      confidence: decision.confidence,
      reasoning: decision.reasoning,
      costEstimate: decision.costEstimate,
      savings: decision.savings,
    }
  };
}
```

**Important:** Filter available models by which API keys the user/admin has configured. If ClawRouter picks a model we don't have a key for, fall back to next best option.

### 1.3 Modify chat route to support "auto" provider

**File:** `backend/src/routes/chat.js`

Changes:
- When `provider === 'auto'`, call `autoRoute(messages)` to get real provider/model
- Send routing info as SSE event `routing_info` before streaming starts
- Save actual provider/model used in message record (not "auto")
- Store `routing_info` JSON in a new `routing_info` column on messages table

```js
// In POST /chat/stream handler:
let actualProvider = provider;
let actualModel = model;
let routingInfo = null;

if (provider === 'auto') {
  const routeResult = await autoRoute(allMessages, { availableKeys });
  actualProvider = routeResult.provider;
  actualModel = routeResult.model;
  routingInfo = routeResult.routingInfo;

  // Send routing info to client BEFORE streaming starts
  res.write(`data: ${JSON.stringify({ type: 'routing_info', ...routingInfo })}\n\n`);
}

// Continue with existing routing using actualProvider/actualModel
```

### 1.4 Database migration

**File:** `backend/src/db/database.js`

```js
try { db.exec('ALTER TABLE messages ADD COLUMN routing_info TEXT'); } catch {}
```

Store JSON with tier, reasoning, confidence for each auto-routed message.

### 1.5 Add "auto" to models list

**File:** `backend/src/routes/models.js`

Add `auto` as a virtual provider in the models response:

```js
const MODELS = {
  auto: [
    { id: 'auto', name: 'Auto (Smart Router)', context: 0,
      description: 'Automatically selects the best model based on task complexity' }
  ],
  anthropic: [...],
  openai: [...],
  ...
};
```

### 1.6 Filter routing by available keys

ClawRouter may pick a model whose provider doesn't have a configured API key.
`autoRoute()` must accept a list of available providers and only route to those.

If ClawRouter's `route()` doesn't support filtering, we post-filter: if picked model's provider has no key, select best available from same tier.

---

## Phase 2: Frontend Web — Auto Mode UI (2-3 days)

### 2.1 Add "Auto" to ModelBar

**File:** `frontend/src/components/ModelBar.tsx`

- Add "Auto" as first provider in the dropdown (with gradient/rainbow icon)
- When selected, model dropdown shows single option "Smart Router"
- Make "Auto" the default for new conversations

### 2.2 Handle routing_info SSE event

**File:** `frontend/src/services/api.ts`

In `streamChat()`, handle new SSE event type:
```js
case 'routing_info':
  onRoutingInfo?.(data); // { selectedModel, tier, reasoning, confidence, savings }
  break;
```

### 2.3 Show routing badge in ChatWindow

**File:** `frontend/src/components/ChatWindow.tsx`

When a message has routing info:
- Show small badge below assistant message: "Answered by Claude Opus 4.6 (Complex)"
- Badge is clickable

### 2.4 Create RoutingInfoModal

**New file:** `frontend/src/components/RoutingInfoModal.tsx`

Modal shown on badge click:
- Selected model and provider (with color)
- Tier (SIMPLE/MEDIUM/COMPLEX/REASONING) with visual indicator
- Confidence score (progress bar)
- Reasoning text (why this model was chosen)
- Estimated savings vs. always using premium
- Dimensions breakdown (optional, if available)

### 2.5 Update types

**File:** `frontend/src/types/index.ts`

```ts
export interface RoutingInfo {
  selectedModel: string;
  tier: 'SIMPLE' | 'MEDIUM' | 'COMPLEX' | 'REASONING';
  confidence: number;
  reasoning: string;
  costEstimate?: number;
  savings?: number;
}

// Add to Message:
export interface Message {
  // ... existing fields
  routing_info?: RoutingInfo;
}
```

### 2.6 Update store

**File:** `frontend/src/store/appStore.ts`

- Default `selectedProvider` = `'auto'` for new conversations
- Handle routing_info in streaming state

---

## Phase 3: Mobile — Auto Mode (2-3 days)

### 3.1 Update models

**File:** `mobile/lib/data/models/model_info_model.dart`

Add routing info model:
```dart
class RoutingInfo {
  final String selectedModel;
  final String tier;
  final double confidence;
  final String reasoning;
  final double? savings;
}
```

### 3.2 Update SSE event parsing

**File:** `mobile/lib/data/models/sse_event_model.dart`

Add new event type:
```dart
class SseRoutingInfo extends SseEvent {
  final RoutingInfo info;
}
```

### 3.3 Update chat provider

**File:** `mobile/lib/providers/chat_provider.dart`

- Parse `routing_info` SSE event
- Store in state so UI can display it

### 3.4 Update ModelBar

**File:** `mobile/lib/presentation/screens/chat/chat_screen.dart`

- Add "Auto" as first provider option with gradient icon
- When auto is active, show routing result badge after response
- Make "Auto" default for new conversations

### 3.5 Add RoutingInfoSheet

**New widget in chat_screen.dart or separate file**

Bottom sheet shown on routing badge tap:
- Model used (with provider color)
- Tier badge (colored: green=SIMPLE, yellow=MEDIUM, orange=COMPLEX, red=REASONING)
- Confidence bar
- Reasoning text
- Savings percentage

### 3.6 Update MessageBubble

Show routing badge below assistant messages:
```
[Assistant message content...]
                    ⚡ Claude Opus 4.6 · Complex task
                       ↑ tap for details
```

---

## Phase 4: Settings & Admin (1 day)

### 4.1 Auto-routing settings

**File:** `backend/src/routes/settings.js` (or new)

Per-user settings:
- `auto_routing_profile`: 'auto' | 'eco' | 'premium' (default: 'auto')
- `auto_routing_enabled`: boolean (default: true)

### 4.2 Admin: routing stats

**File:** `backend/src/routes/admin.js`

New endpoint `GET /api/admin/routing-stats`:
- Distribution by tier (% SIMPLE / MEDIUM / COMPLEX / REASONING)
- Most used models via auto-routing
- Estimated savings over time

### 4.3 Settings UI

Both web and mobile: add routing profile selector in settings
- "Eco" — maximize savings (simpler models)
- "Auto" — balanced (default)
- "Premium" — best quality (premium models more often)

---

## Phase 5: Polish & Edge Cases (1-2 days)

### 5.1 Fallback handling

- If ClawRouter is unavailable/errors → fall back to default model (gpt-4o)
- If selected model's API key missing → try next model in same tier
- If all keys missing → return clear error

### 5.2 Key availability filtering

Before routing, build list of available providers (those with configured API keys).
Pass to autoRoute so it only selects from available providers.

### 5.3 Conversation model display

When conversation uses "auto", sidebar shows:
- Provider badge: "Auto" (with gradient)
- Last used model in subtitle

### 5.4 Performance

- Cache ClawRouter routing decisions for identical prompts (30s TTL)
- Routing should add <50ms overhead (ClawRouter claims <1ms locally)

### 5.5 System prompt consideration

Pass system prompt to ClawRouter along with user message for better classification.
Complex system prompts may need more capable models.

---

## File Changes Summary

### New Files
| File | Description |
|------|-------------|
| `backend/src/services/autoRouter.js` | ClawRouter integration, model mapping, routing logic |
| `frontend/src/components/RoutingInfoModal.tsx` | Modal with routing decision details |

### Modified Files (Backend)
| File | Changes |
|------|---------|
| `backend/package.json` | Add `@blockrun/clawrouter` dependency |
| `backend/src/routes/chat.js` | Handle `provider === 'auto'`, send routing_info SSE event |
| `backend/src/routes/models.js` | Add "auto" virtual provider to models list |
| `backend/src/db/database.js` | Add `routing_info` column to messages table |

### Modified Files (Frontend Web)
| File | Changes |
|------|---------|
| `frontend/src/components/ModelBar.tsx` | Add "Auto" provider option (default) |
| `frontend/src/components/ChatWindow.tsx` | Show routing badge, handle routing_info event |
| `frontend/src/components/MessageBubble.tsx` | Display routing info badge on auto-routed messages |
| `frontend/src/services/api.ts` | Parse `routing_info` SSE event |
| `frontend/src/store/appStore.ts` | Default provider = 'auto', routing state |
| `frontend/src/types/index.ts` | Add RoutingInfo interface |

### Modified Files (Mobile)
| File | Changes |
|------|---------|
| `mobile/lib/presentation/screens/chat/chat_screen.dart` | Auto in ModelBar, routing badge |
| `mobile/lib/data/models/sse_event_model.dart` | Add SseRoutingInfo event |
| `mobile/lib/data/models/model_info_model.dart` | Add RoutingInfo model |
| `mobile/lib/providers/chat_provider.dart` | Handle routing_info in stream |
| `mobile/lib/providers/conversation_provider.dart` | Default provider = 'auto' |

---

## Timeline

| Phase | Duration | Description |
|-------|----------|-------------|
| 1 | 2-3 days | Backend: ClawRouter service, chat route, DB |
| 2 | 2-3 days | Frontend web: Auto UI, routing modal |
| 3 | 2-3 days | Mobile: Auto UI, routing sheet |
| 4 | 1 day | Settings, admin stats |
| 5 | 1-2 days | Edge cases, polish, testing |
| **Total** | **8-12 days** | |

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| ClawRouter npm package may not export `route()` cleanly | Fallback: extract routing algorithm (MIT license) into own service |
| ClawRouter requires wallet/payment setup we don't need | Only import routing module, not proxy/wallet |
| Model mapping drift (ClawRouter updates models) | Maintain our own MODEL_MAP, update periodically |
| Routing adds latency | ClawRouter runs locally, <1ms; cache repeated prompts |
| User confusion about "Auto" | Clear UI: always show which model was used |

---

## Success Criteria

- [ ] "Auto" is default provider for new conversations
- [ ] Routing decision happens in <50ms
- [ ] User sees which model answered and can click for reasoning
- [ ] Routing respects which API keys are configured
- [ ] Fallback works when ClawRouter errors
- [ ] Mobile and web have identical Auto behavior
- [ ] Admin can see routing statistics
