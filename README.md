# VTM Companion Backend

A serverless backend for a Vampire: The Masquerade companion website. Built with Netlify Functions and OpenAI's Assistants API.

## Features

- **Rules Q&A** - Ask detailed questions about VTM mechanics, lore, clans, and disciplines
- **AI Storyteller** - The AI runs your full game as Game Master
- **Storyteller Assistant** - The AI helps you run your game with NPCs, encounters, and rules support
- **Conversation Threading** - Maintain multi-turn conversations with context
- **Serverless** - No backend infrastructure to manage
- **API Key Security** - OpenAI key kept server-side only

## Quick Start

### 1. Clone and Setup

```bash
cd vtm-companion
npm install
cp .env.example .env
```

### 2. Configure OpenAI

Edit `.env` and add your OpenAI API key:
```
OPENAI_API_KEY=sk_test_...
```

### 3. Create Assistants

```bash
npm run setup
```

This creates two assistants and outputs their IDs. Add to `.env`:
```
OPENAI_ASSISTANT_ID=asst_...
OPENAI_ST_ASSISTANT_ID=asst_...
```

### 4. Start Local Dev Server

```bash
npm run dev
```

Visit `http://localhost:8888` and test with `example-client.html`.

## File Structure

```
vtm-companion/
├── netlify/
│   └── functions/
│       ├── chat.js           # Rules Q&A endpoint
│       └── storyteller.js     # Storyteller/DM endpoint
├── scripts/
│   └── setup-assistants.js   # One-time setup for assistants
├── netlify.toml              # Netlify configuration
├── package.json              # Dependencies & scripts
├── example-client.html       # Working example UI
├── API.md                    # Complete API reference
├── SETUP.md                  # Detailed setup guide
└── README.md                 # This file
```

## API Endpoints

### POST /.netlify/functions/chat

Rules Q&A about Vampire: The Masquerade.

```javascript
const response = await fetch('/.netlify/functions/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: "What is blood potency?",
    threadId: null // Omit for new conversation
  })
});

const { threadId, response: answer } = await response.json();
```

### POST /.netlify/functions/storyteller

Storytelling assistance with two modes: AI-run game or human GM support.

```javascript
const response = await fetch('/.netlify/functions/storyteller', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: "Start a scene in the prince's court",
    threadId: null,
    mode: "ai_storyteller",        // or "st_assist"
    playerCount: 3,
    sessionLength: "3 hours",
    scenario: "Modern New York"
  })
});

const { threadId, response: narrative } = await response.json();
```

See `API.md` for complete endpoint documentation.

## Architecture

### Design Principles

1. **Stateless Functions** - Each function call is independent; state lives on the client (threadId)
2. **No Package Dependencies** - Uses Node 18+ built-in fetch. Fast cold starts.
3. **Raw API Calls** - Direct REST calls to OpenAI, no SDK overhead
4. **Polling Pattern** - Functions poll assistant runs with configurable timeout
5. **CORS Enabled** - Works with frontend requests from any origin

### How It Works

1. Client sends message + optional threadId to function
2. Function creates thread if needed (or uses existing)
3. Function adds message to thread
4. Function creates a run (starts the assistant)
5. Function polls run status every 500ms (timeout: 30s)
6. When complete, function retrieves latest message
7. Client gets response + threadId to maintain conversation

## Configuration

### Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `OPENAI_API_KEY` | Yes | OpenAI authentication |
| `OPENAI_ASSISTANT_ID` | Yes | Rules Q&A assistant ID |
| `OPENAI_ST_ASSISTANT_ID` | Yes | Storyteller assistant ID |
| `RULEBOOK_FILE` | No | Path to VTM PDF for file search |

### Polling Tuning

Edit constants in function files:

```javascript
const MAX_WAIT_MS = 30000;    // Timeout per request (ms)
const POLL_INTERVAL_MS = 500; // Check status interval (ms)
```

Increase `MAX_WAIT_MS` if requests timeout. Decrease `POLL_INTERVAL_MS` for faster feedback.

## Assistant Instructions

### Rules Q&A Assistant

Configured to be an expert on VTM Revised Edition rules. Has file search enabled if rulebook uploaded.

Key capabilities:
- Answer rules questions with citations
- Explain game mechanics clearly
- Discuss clans, disciplines, lore
- Admit when something isn't in rulebook

### Storyteller Assistant

Supports two distinct modes:

**AI Storyteller**: The AI runs the entire game
- Narrates scenes and environments
- Controls all NPCs with distinct personalities
- Resolves player actions using rules
- Manages pacing and drama

**Storyteller Assistant**: Helps you run your game
- Suggests encounter ideas and plot hooks
- Generates NPC stats and backgrounds
- Provides quick rule lookups
- Helps with pacing and balance

## Deployment

### To Netlify

1. Push to GitHub
2. Connect repo to Netlify
3. Set environment variables in dashboard:
   - `OPENAI_API_KEY`
   - `OPENAI_ASSISTANT_ID`
   - `OPENAI_ST_ASSISTANT_ID`
4. Deploy!

Functions automatically available at:
- `https://your-site.netlify.app/.netlify/functions/chat`
- `https://your-site.netlify.app/.netlify/functions/storyteller`

### To Other Platforms

These are standard Netlify Functions, so they can be adapted for:
- AWS Lambda
- Google Cloud Functions
- Azure Functions

The request/response patterns are platform-agnostic.

## Example Usage

### Chat UI

```javascript
// Initialize
let threadId = null;

// Send message
async function chat(message) {
  const res = await fetch('/.netlify/functions/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, threadId })
  });

  const data = await res.json();
  threadId = data.threadId;  // Save for next message
  return data.response;
}

// Multi-turn conversation
await chat("How do I create a Tremere?");
await chat("What's the clan weakness?");
await chat("How does blood sorcery work?");
```

### Game Session

```javascript
// Start AI-run game
let gameThreadId = null;

async function startGame() {
  const res = await fetch('/.netlify/functions/storyteller', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: "I play a Brujah warrior named Marcus. Start the game.",
      mode: "ai_storyteller",
      playerCount: 1,
      scenario: "Modern San Francisco"
    })
  });

  const data = await res.json();
  gameThreadId = data.threadId;
  return data.response;  // Narration
}

// Continue game
async function playerAction(action) {
  const res = await fetch('/.netlify/functions/storyteller', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: action,
      threadId: gameThreadId,
      mode: "ai_storyteller"
    })
  });

  return (await res.json()).response;
}
```

## Troubleshooting

### "OPENAI_API_KEY not set"
Ensure `.env` exists in project root and is loaded. Run `netlify dev` from correct directory.

### "OPENAI_ASSISTANT_ID not set"
Run `npm run setup` after setting your API key.

### Timeout errors
Your query takes longer than 30 seconds. Either:
- Simplify the request
- Increase `MAX_WAIT_MS` in function code
- Check OpenAI API status

### No response from assistant
The assistant may have failed. Check:
- Assistant instructions are valid
- Message reaches the assistant
- Model is available (check OpenAI dashboard)

### Rate limiting
You're hitting OpenAI rate limits. Implement:
- Exponential backoff in polling loop
- Client-side rate limiting (wait between requests)
- Check your API plan limits

## Development

### Local Testing

Use `example-client.html`:

```bash
npm run dev
# Open http://localhost:8888 in browser
```

### Testing Functions Directly

```bash
curl -X POST http://localhost:8888/.netlify/functions/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"What is a Bloodhunt?"}'
```

### Debugging

1. Functions log to console - check `netlify dev` output
2. Check OpenAI API status at https://status.openai.com
3. Test API key with: `curl https://api.openai.com/v1/models -H "Authorization: Bearer $OPENAI_API_KEY"`

## Customization

### Custom Assistant Instructions

Edit in `scripts/setup-assistants.js` before running `npm run setup`, or modify existing assistants in OpenAI dashboard.

### Adding the Rulebook

Upload PDF during setup:

```bash
OPENAI_API_KEY=sk_... RULEBOOK_FILE=path/to/rulebook.pdf npm run setup
```

The assistants will use file search to reference the rulebook.

### Adding More Assistants

Duplicate setup code and function pattern. Each needs:
1. Creation in `scripts/setup-assistants.js`
2. New Netlify Function in `netlify/functions/`
3. Assistant ID in `.env`

## Security Notes

- API keys are kept server-side only - never exposed to client
- CORS is configured but still uses standard security headers
- Functions validate input (non-empty messages, valid mode values)
- No authentication implemented (add if needed for production)
- Rate limiting not implemented (add if needed)

## Performance

- **Cold start**: ~500ms first request (Netlify Functions)
- **Warm start**: ~100-200ms after that
- **Assistant response**: 5-30 seconds depending on complexity
- **Total latency**: Cold start + API call time

Optimize by:
- Keeping assistant instructions concise
- Using simpler prompts when possible
- Implementing client-side debouncing
- Caching responses when appropriate

## Costs

OpenAI Assistants API pricing:
- Input tokens: ~$0.003 per 1K tokens
- Output tokens: ~$0.006 per 1K tokens
- File search: $0.20 per GB-day

With average 2K token conversations, expect $0.01-0.02 per conversation.

## Future Enhancements

Potential additions:
- User authentication & conversation history
- Rate limiting per user
- Custom system prompts
- Integration with character sheets
- Multi-game session management
- Webhook support for async processing
- Caching layer for common questions

## Support

For issues:
1. Check API.md for endpoint docs
2. Review SETUP.md for configuration
3. Check function logs with `netlify dev`
4. Verify OpenAI API key and assistant IDs
5. Test with example client

## License

MIT
