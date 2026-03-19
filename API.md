# VTM Companion API Reference

Complete API documentation for the Vampire: The Masquerade companion backend.

## Base URL

**Local Development:** `http://localhost:8888/.netlify/functions`
**Production:** `https://your-site.netlify.app/.netlify/functions`

---

## Endpoint: Chat (Rules Q&A)

### Description
Ask questions about Vampire: The Masquerade game rules, mechanics, lore, clans, and disciplines. The assistant uses the rulebook as its primary reference.

### URL
```
POST /.netlify/functions/chat
```

### Request Headers
```
Content-Type: application/json
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | Yes | The question or statement to send |
| `threadId` | string | No | Existing thread ID to continue conversation. Omit to start new thread |

### Example Request

```bash
curl -X POST http://localhost:8888/.netlify/functions/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is blood potency and how does it affect my vampire?"
  }'
```

### Example Response (200 OK)

```json
{
  "success": true,
  "threadId": "thread_abc123def456",
  "response": "Blood Potency represents the power and purity of a vampire's blood. In Vampire: The Masquerade Revised Edition...",
  "error": null
}
```

### Error Response (400 Bad Request)

```json
{
  "error": "message field is required and must be non-empty"
}
```

### Error Response (500 Internal Server Error)

```json
{
  "success": false,
  "error": "Run polling timeout after 30000ms"
}
```

### Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad request (missing/invalid message) |
| 405 | Method not allowed (not POST) |
| 500 | Server error |

### Notes

- Save the returned `threadId` to maintain conversation context
- The assistant cites specific rules when possible
- Include the thread ID in follow-up messages to continue the same conversation
- The API has a 30-second timeout per request

---

## Endpoint: Storyteller

### Description
Get assistance with storytelling and game master duties in Vampire: The Masquerade. Supports two modes:

1. **AI Storyteller** - The AI runs the entire game as your GM
2. **Storyteller Assistant** - The AI helps you run the game

### URL
```
POST /.netlify/functions/storyteller
```

### Request Headers
```
Content-Type: application/json
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | Yes | Your request or action |
| `threadId` | string | No | Existing thread ID to continue. Omit for new thread |
| `mode` | string | Yes | Either `"ai_storyteller"` or `"st_assist"` |
| `playerCount` | number | No | Number of players in the session |
| `sessionLength` | string | No | Expected duration (e.g., "3 hours") |
| `scenario` | string | No | Setting, campaign hook, or context |

### Example: AI Storyteller Mode

```bash
curl -X POST http://localhost:8888/.netlify/functions/storyteller \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Start a scene in a Camarilla prince\''s inner sanctum",
    "mode": "ai_storyteller",
    "playerCount": 3,
    "sessionLength": "3 hours",
    "scenario": "Modern day New York City, Elysium gathering"
  }'
```

### Example Response (200 OK)

```json
{
  "success": true,
  "threadId": "thread_xyz789uvw012",
  "response": "You push through the heavy oak doors into the prince's inner sanctum. The scent of expensive incense and old money fills your nostrils...",
  "error": null
}
```

### Example: Storyteller Assistant Mode

```bash
curl -X POST http://localhost:8888/.netlify/functions/storyteller \
  -H "Content-Type: application/json" \
  -d '{
    "threadId": "thread_xyz789uvw012",
    "message": "Give me 3 NPC stat blocks for vampires who would serve as Primogen advisors to the prince",
    "mode": "st_assist",
    "playerCount": 4,
    "sessionLength": "4 hours",
    "scenario": "Multi-clan political intrigue"
  }'
```

### Response Format

```json
{
  "success": true,
  "threadId": "thread_xyz789uvw012",
  "response": "Here are three Primogen advisors fitting for your story...",
  "error": null
}
```

### Mode Guide

#### AI Storyteller
- You provide character names, clans, and concepts
- AI narrates scenes, controls NPCs with distinct personalities
- AI resolves your actions according to game rules
- AI manages pacing and dramatic tension
- Good for: Solo play, learning the system, one-off sessions

**Opening request example:**
```json
{
  "message": "I play a Tremere sorcerer named Viktor seeking allies. Start the first scene.",
  "mode": "ai_storyteller",
  "scenario": "Underground society in Prague, 1990s"
}
```

#### Storyteller Assistant
- You describe what your players do
- AI suggests NPC reactions, stats, and encounter design
- AI helps resolve mechanics and rule questions
- AI provides pacing advice and plot hooks
- Good for: Supplementing your own GMing, encountering blockers

**Opening request example:**
```json
{
  "message": "My players just started a blood hunt against a rogue vampire. Give me 3 encounter ideas and NPCs they might face.",
  "mode": "st_assist",
  "playerCount": 4,
  "scenario": "Los Angeles, Camarilla-controlled city"
}
```

### Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad request (invalid mode or missing message) |
| 405 | Method not allowed (not POST) |
| 500 | Server error |

### Error Responses

```json
{
  "error": "mode must be \"ai_storyteller\" or \"st_assist\""
}
```

```json
{
  "error": "message field is required and must be non-empty"
}
```

### Notes

- Save `threadId` to maintain narrative continuity across messages
- Provide session context (players, length, scenario) for better responses
- AI Storyteller mode starts by asking about character details if not provided
- Both modes have 30-second timeout per request
- The AI will ask clarifying questions if your request is ambiguous

---

## Common Patterns

### Starting a New Conversation

```javascript
const response = await fetch('/.netlify/functions/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: "How do I create a vampire character?"
  })
  // No threadId = new conversation
});

const { threadId, response: answer } = await response.json();
```

### Continuing a Conversation

```javascript
const response = await fetch('/.netlify/functions/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: "What's the Tremere clan weakness?",
    threadId: "thread_abc123" // Use saved threadId
  })
});

const { response: answer } = await response.json();
```

### Starting a Full AI Game

```javascript
const response = await fetch('/.netlify/functions/storyteller', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: "I'm a Brujah anarchist named Cain. Start the game.",
    mode: "ai_storyteller",
    playerCount: 1,
    scenario: "Modern San Francisco, punk vs establishment"
  })
});

const { threadId, response: gameStart } = await response.json();
// Save threadId for game continuation
```

### Getting GM Assistance

```javascript
const response = await fetch('/.netlify/functions/storyteller', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    threadId: "thread_xyz789",
    message: "My Toreador player just tried to seduce the Prince. Help me handle this!",
    mode: "st_assist",
    playerCount: 5,
    scenario: "New Orleans, tense Elysium"
  })
});

const { response: suggestion } = await response.json();
```

---

## Rate Limits & Timeouts

- **Request timeout:** 30 seconds per request
- **Polling interval:** 500ms between status checks
- **OpenAI rate limits:** Subject to your API plan
- **Recommended:** 2-3 second delays between client requests for UX

---

## CORS

All endpoints support CORS. Requests from any origin are allowed. Appropriate headers are automatically set.

---

## Environment Variables (Backend Only)

These are required in `.env` for the functions to work:

```
OPENAI_API_KEY=sk_...
OPENAI_ASSISTANT_ID=asst_...
OPENAI_ST_ASSISTANT_ID=asst_...
```

Do not expose these on the client. They're kept server-side for security.
