/**
 * Netlify Function: Storyteller/DM Mode
 *
 * Storytelling and game-master assistance for Vampire: The Masquerade.
 * Supports two modes:
 * - ai_storyteller: the AI runs the full game
 * - st_assist: the AI assists a human Storyteller
 *
 * Migrated from the OpenAI Assistants API (sunset Aug 26, 2026) to the
 * OpenAI Responses API. Same request/response contract, so the front-end
 * needs no changes. Continuity is handled by chaining `previous_response_id`.
 *
 * Expected POST body:
 * {
 *   message: string,
 *   threadId?: string,                          // prior response id
 *   mode: "ai_storyteller" | "st_assist",
 *   playerCount?: number,
 *   sessionLength?: string,
 *   scenario?: string
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
const API_BASE = 'https://api.openai.com/v1';
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

const INSTRUCTIONS = `You are an expert Storyteller for Vampire: The Masquerade (Revised Edition). You support two distinct modes:

**AI Storyteller Mode:** You run the full game. Set scenes, describe environments, play all NPCs with distinct personalities, and narrate outcomes. Ask players for their actions, then resolve them using the game's rules. Track the narrative, manage tension, and create memorable moments. When starting, ask about:
- Character details (names, clans, concepts)
- Setting and time period
- Tone (gritty, gothic, intrigue, horror, etc.)
- Any specific story hooks or themes

**Storyteller Assistant Mode:** You help a human Storyteller run their game. Your role is to:
- Suggest encounter ideas and plot hooks
- Generate NPC stats, backgrounds, and personalities
- Look up rules on the fly and help clarify mechanics
- Help with pacing and suggest when to escalate tension
- Brainstorm solutions to player dilemmas
- Manage encounter difficulty and balance

In both modes:
- Use your knowledge of the published Revised Edition rules as your authoritative reference for mechanics, clans, disciplines, and lore
- Maintain the gothic atmosphere of VTM
- Encourage dramatic roleplay and character development
- Balance challenge with fun
- Remember important narrative details and character developments
- Be collaborative and responsive to player agency

The current mode and any session parameters are provided at the start of each user message in a bracketed header.`;

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

    const { message, threadId, mode, playerCount, sessionLength, scenario } = body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'message field is required and must be non-empty' }),
      };
    }

    if (!mode || !['ai_storyteller', 'st_assist'].includes(mode)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'mode must be "ai_storyteller" or "st_assist"' }),
      };
    }

    const contextParts = [];
    if (mode === 'ai_storyteller') {
      contextParts.push('[MODE: AI STORYTELLER]');
      if (playerCount) contextParts.push(`Player count: ${playerCount}`);
      if (sessionLength) contextParts.push(`Session length: ${sessionLength}`);
      if (scenario) contextParts.push(`Scenario: ${scenario}`);
    } else {
      contextParts.push('[MODE: STORYTELLER ASSISTANT]');
      if (playerCount) contextParts.push(`Players: ${playerCount}`);
      if (sessionLength) contextParts.push(`Time: ${sessionLength}`);
      if (scenario) contextParts.push(`Context: ${scenario}`);
    }

    let fullMessage = message.trim();
    if (contextParts.length > 0) {
      fullMessage = `${contextParts.join('\n')}\n\n${fullMessage}`;
    }

    const data = await createResponse({
      input: fullMessage,
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
    console.error('Storyteller function error:', error);
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
