# VTM Companion - Backend Setup Guide

A serverless backend for a Vampire: The Masquerade companion website using Netlify Functions and OpenAI's Assistants API.

## Quick Start

### 1. Prerequisites

- Node.js 18+
- OpenAI API key with access to Assistants API
- Netlify account (for deployment)

### 2. Initial Setup

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env and add your OpenAI API key
# OPENAI_API_KEY=sk_...

# Create assistants (one-time)
OPENAI_API_KEY=sk_... npm run setup
```

The setup script will create two assistants and output their IDs. Add these to your `.env`:
```
OPENAI_ASSISTANT_ID=asst_...
OPENAI_ST_ASSISTANT_ID=asst_...
```

### 3. Local Development

```bash
npm run dev
```

This starts the Netlify dev server on `http://localhost:8888`. Your functions will be available at `http://localhost:8888/.netlify/functions/`.

## API Endpoints

### Chat (Rules Q&A)

**Endpoint:** `POST /.netlify/functions/chat`

**Request:**
```json
{
  "message": "What is blood potency?",
  "threadId": "thread_123abc" // optional, creates new if omitted
}
```

**Response:**
```json
{
  "success": true,
  "threadId": "thread_123abc",
  "response": "Blood Potency is a measure of the power of a vampire's blood...",
  "error": null
}
```

---

### Storyteller

**Endpoint:** `POST /.netlify/functions/storyteller`

**Request:**
```json
{
  "message": "Give me a scene opener for a Camarilla prince's court.",
  "threadId": "thread_456def", // optional
  "mode": "ai_storyteller",    // or "st_assist"
  "playerCount": 3,
  "sessionLength": "3 hours",
  "scenario": "Modern day New York City"
}
```

**Response:**
```json
{
  "success": true,
  "threadId": "thread_456def",
  "response": "You push through the heavy oak doors into the prince's inner sanctum...",
  "error": null
}
```

**Mode Details:**

- **`ai_storyteller`**: The AI runs the entire game. It controls NPCs, narrates scenes, and resolves player actions. Good for solo play or when you need a full game master.

- **`st_assist`**: The AI assists a human Storyteller with encounter ideas, NPC stats, rule lookups, and pacing suggestions. Good for supplementing your own GMing.

---

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `OPENAI_API_KEY` | Yes | OpenAI API authentication |
| `OPENAI_ASSISTANT_ID` | Yes | ID of the Rules Q&A assistant |
| `OPENAI_ST_ASSISTANT_ID` | Yes | ID of the Storyteller assistant |
| `RULEBOOK_FILE` | No | Path to VTM rulebook PDF for file search during setup |

---

## Architecture

### Netlify Functions

- **`netlify/functions/chat.js`** - Rules Q&A assistant
  - Stateless function that manages OpenAI threads
  - Uses thread IDs to maintain conversation history
  - Polls for assistant responses with 30-second timeout

- **`netlify/functions/storyteller.js`** - Storyteller/DM mode
  - Similar architecture to chat.js but uses different assistant
  - Passes mode and session context to the AI

### Key Design Decisions

1. **No external npm dependencies** - Uses Node 18+ built-in `fetch()`. Keeps cold start times fast.

2. **Thread management** - Clients track `threadId` to maintain conversation state. The backend is stateless.

3. **Polling pattern** - Functions poll the OpenAI run status every 500ms with a 30-second timeout. Adjust `POLL_INTERVAL_MS` and `MAX_WAIT_MS` as needed.

4. **CORS enabled** - Functions return appropriate CORS headers for browser requests.

5. **Raw fetch calls** - Uses direct REST API calls instead of the OpenAI npm package for simplicity and control.

---

## Customization

### Adjusting Polling Timeout

In both function files, modify:
```javascript
const MAX_WAIT_MS = 30000;    // Increase for complex queries
const POLL_INTERVAL_MS = 500; // Decrease for faster feedback
```

### Updating Assistant Instructions

Edit the assistant instructions in `scripts/setup-assistants.js` before running setup, or modify them directly in your OpenAI dashboard afterward.

### File Upload (Rulebook)

To enable file search on the rulebook:

```bash
OPENAI_API_KEY=sk_... RULEBOOK_FILE=path/to/rulebook.pdf npm run setup
```

This uploads the PDF and grants the assistants access to its contents via file search.

---

## Deployment to Netlify

1. Push code to GitHub
2. Connect repo to Netlify
3. Set environment variables in Netlify dashboard:
   - `OPENAI_API_KEY`
   - `OPENAI_ASSISTANT_ID`
   - `OPENAI_ST_ASSISTANT_ID`
4. Deploy!

Functions will be available at `https://your-site.netlify.app/.netlify/functions/chat` etc.

---

## Troubleshooting

### "OPENAI_API_KEY not set"
Make sure `.env` file exists and is properly loaded. During local dev with `netlify dev`, the file should be picked up automatically.

### "Run polling timeout"
Your query might be taking longer than 30 seconds. Increase `MAX_WAIT_MS` or simplify the request.

### "No messages returned"
The assistant ran but produced no text output. Check the assistant's instructions and make sure they're appropriate for the input.

### Rate limiting
If you hit OpenAI rate limits, implement exponential backoff in the polling loop or reduce `POLL_INTERVAL_MS`.

---

## Frontend Integration

### JavaScript Example

```javascript
// Chat endpoint
const response = await fetch('/.netlify/functions/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'What is a Bloodhunt?',
    threadId: savedThreadId // null for first message
  })
});

const { threadId, response: aiResponse } = await response.json();
// Save threadId for next message in conversation
```

### React Hook Example

```jsx
const [threadId, setThreadId] = useState(null);
const [messages, setMessages] = useState([]);

const sendMessage = async (text) => {
  const res = await fetch('/.netlify/functions/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: text, threadId })
  });

  const { threadId: newThreadId, response } = await res.json();
  setThreadId(newThreadId);
  setMessages(prev => [...prev, { user: text, ai: response }]);
};
```

---

## License

MIT
