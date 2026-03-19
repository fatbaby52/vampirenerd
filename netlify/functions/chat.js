/**
 * Netlify Function: Rules Q&A Chat
 *
 * Handles chat requests for Vampire: The Masquerade rules questions.
 * Uses OpenAI Assistants API (v2) to provide accurate game knowledge.
 *
 * Expected POST body:
 * {
 *   message: string,      // User's question
 *   threadId?: string     // Existing thread ID (optional, creates new if omitted)
 * }
 *
 * Returns:
 * {
 *   success: boolean,
 *   threadId: string,
 *   response: string,
 *   error?: string
 * }
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID;
const API_BASE = 'https://api.openai.com/v1';
const OPENAI_BETA = 'assistants=v2';

// Polling configuration
const MAX_WAIT_MS = 30000; // 30 second timeout
const POLL_INTERVAL_MS = 500; // Check every 500ms

/**
 * Helper: Make authenticated requests to OpenAI API
 */
async function openaiRequest(method, endpoint, body = null) {
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'OpenAI-Beta': OPENAI_BETA,
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, options);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `OpenAI API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`
    );
  }

  return response.json();
}

/**
 * Create a new conversation thread
 */
async function createThread() {
  const data = await openaiRequest('POST', '/threads');
  return data.id;
}

/**
 * Add a message to a thread
 */
async function addMessage(threadId, message) {
  await openaiRequest('POST', `/threads/${threadId}/messages`, {
    role: 'user',
    content: message,
  });
}

/**
 * Start a run on the assistant
 */
async function createRun(threadId) {
  const data = await openaiRequest('POST', `/threads/${threadId}/runs`, {
    assistant_id: ASSISTANT_ID,
  });
  return data.id;
}

/**
 * Poll for run completion
 */
async function pollRunCompletion(threadId, runId) {
  const startTime = Date.now();

  while (Date.now() - startTime < MAX_WAIT_MS) {
    const data = await openaiRequest('GET', `/threads/${threadId}/runs/${runId}`);

    if (data.status === 'completed') {
      return true;
    }

    if (data.status === 'failed' || data.status === 'cancelled') {
      throw new Error(`Run ${data.status}: ${data.last_error?.message || 'Unknown error'}`);
    }

    // Still running, wait before next check
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(`Run polling timeout after ${MAX_WAIT_MS}ms`);
}

/**
 * Retrieve the assistant's response messages
 */
async function getMessages(threadId) {
  const data = await openaiRequest('GET', `/threads/${threadId}/messages?limit=1&order=desc`);

  if (!data.data || data.data.length === 0) {
    throw new Error('No messages returned from assistant');
  }

  // Extract text content from the first message
  const message = data.data[0];
  const textContent = message.content.find(block => block.type === 'text');

  if (!textContent) {
    throw new Error('Assistant response contains no text');
  }

  // Assistants API v2 returns text as { value: string, annotations: [...] }
  return typeof textContent.text === 'string' ? textContent.text : textContent.text.value;
}

/**
 * Main handler
 */
exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Validate configuration
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable not set');
    }
    if (!ASSISTANT_ID) {
      throw new Error('OPENAI_ASSISTANT_ID environment variable not set');
    }

    // Parse request body
    let body;
    try {
      body = JSON.parse(event.body);
    } catch (e) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid JSON body' }),
      };
    }

    const { message, threadId } = body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'message field is required and must be non-empty' }),
      };
    }

    // Create thread if needed
    let finalThreadId = threadId;
    if (!finalThreadId) {
      finalThreadId = await createThread();
    }

    // Add user message
    await addMessage(finalThreadId, message.trim());

    // Create and poll run
    const runId = await createRun(finalThreadId);
    await pollRunCompletion(finalThreadId, runId);

    // Get assistant response
    const response = await getMessages(finalThreadId);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        threadId: finalThreadId,
        response,
      }),
    };
  } catch (error) {
    console.error('Chat function error:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
      }),
    };
  }
};
