/**
 * Netlify Function: Rules Q&A Chat
 *
 * Handles chat requests for Vampire: The Masquerade rules questions.
 *
 * Migrated from the OpenAI Assistants API (sunset Aug 26, 2026) to the
 * OpenAI Responses API. Same request/response contract as before, so the
 * front-end needs no changes. Conversation continuity is handled by chaining
 * `previous_response_id` — the client keeps passing back the `threadId` we return.
 *
 * Expected POST body:
 * {
 *   message: string,      // User's question
 *   threadId?: string     // Prior response id (optional; omit to start fresh)
 * }
 *
 * Returns:
 * {
 *   success: boolean,
 *   threadId: string,     // response id to send back on the next turn
 *   response: string,
 *   error?: string
 * }
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const API_BASE = 'https://api.openai.com/v1';
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

const INSTRUCTIONS = `You are an expert on Vampire: The Masquerade (Revised Edition). Answer questions about game rules, lore, clans, disciplines, and mechanics as accurately as possible, drawing on your knowledge of the published Revised Edition rulebooks. Be accurate, cite specific rules when you can, and explain concepts clearly. If something isn't covered by the published rules or you are unsure, say so rather than inventing a rule.

When answering:
- Ground your answers in the published Revised Edition rules
- Cite the specific book, chapter, or section when referencing rules
- Explain mechanics in clear, understandable terms
- If there's ambiguity, explain the multiple interpretations
- Be friendly and encouraging to new and experienced players alike`;

/**
 * Call the OpenAI Responses API.
 */
async function createResponse({ input, previousResponseId }) {
  const body = {
    model: MODEL,
    instructions: INSTRUCTIONS,
    input,
  };
  if (previousResponseId) {
    body.previous_response_id = previousResponseId;
  }

  const response = await fetch(`${API_BASE}/responses`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `OpenAI API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`
    );
  }

  return response.json();
}

/**
 * Extract the assistant's text from a Responses API result.
 */
function extractText(data) {
  if (data && typeof data.output_text === 'string' && data.output_text.length > 0) {
    return data.output_text;
  }
  const parts = [];
  const output = (data && data.output) || [];
  for (const item of output) {
    if (item && item.type === 'message' && Array.isArray(item.content)) {
      for (const block of item.content) {
        if (block && (block.type === 'output_text' || block.type === 'text') && typeof block.text === 'string') {
          parts.push(block.text);
        }
      }
    }
  }
  return parts.join('').trim();
}

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable not set');
    }

    let body;
    try {
      body = JSON.parse(event.body);
    } catch (e) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
    }

    const { message, threadId } = body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'message field is required and must be non-empty' }),
      };
    }

    const data = await createResponse({
      input: message.trim(),
      previousResponseId: threadId || null,
    });

    const response = extractText(data);
    if (!response) {
      throw new Error('Model returned no text');
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        threadId: data.id,
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
