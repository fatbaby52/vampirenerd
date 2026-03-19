#!/usr/bin/env node

/**
 * Setup Script: Create OpenAI Assistants for VTM Companion
 *
 * This script creates two assistants:
 * 1. Rules Q&A Assistant - for answering game rules questions
 * 2. Storyteller Assistant - for narrative/DM assistance
 *
 * Usage:
 *   node scripts/setup-assistants.js
 *
 * Environment variables required:
 *   OPENAI_API_KEY - Your OpenAI API key
 *   RULEBOOK_FILE - Path to the VTM rulebook PDF (optional)
 *
 * The script will output the assistant IDs which should be added to .env:
 *   OPENAI_ASSISTANT_ID=asst_...
 *   OPENAI_ST_ASSISTANT_ID=asst_...
 */

const fs = require('fs');
const path = require('path');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const RULEBOOK_FILE = process.env.RULEBOOK_FILE;
const API_BASE = 'https://api.openai.com/v1';

/**
 * Helper: Make authenticated requests to OpenAI API
 */
async function openaiRequest(method, endpoint, body = null, isMultipart = false) {
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'OpenAI-Beta': 'assistants=v2',
    },
  };

  if (!isMultipart && body) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  } else if (body) {
    // FormData for multipart
    options.body = body;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, options);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `OpenAI API error: ${response.status} ${response.statusText}\n${JSON.stringify(errorData, null, 2)}`
    );
  }

  return response.json();
}

/**
 * Upload a file to OpenAI for use with Assistants
 */
async function uploadFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const fileBuffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);

  // Use FormData for multipart upload
  const FormData = (await import('form-data')).default;
  const form = new FormData();
  form.append('file', fileBuffer, fileName);
  form.append('purpose', 'assistants');

  const response = await fetch(`${API_BASE}/files`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'OpenAI-Beta': 'assistants=v2',
    },
    body: form,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `OpenAI file upload error: ${response.status} ${response.statusText}\n${JSON.stringify(errorData, null, 2)}`
    );
  }

  const data = await response.json();
  return data.id;
}

/**
 * Create the Rules Q&A Assistant
 */
async function createRulesAssistant(vectorStoreId = null) {
  console.log('\nCreating Rules Q&A Assistant...');

  const body = {
    name: 'VTM Rules Q&A',
    description: 'Expert on Vampire: The Masquerade Revised Edition rules',
    instructions: `You are an expert on Vampire: The Masquerade (Revised Edition). Answer questions about game rules, lore, clans, disciplines, and mechanics using the uploaded rulebook as your primary reference. Be accurate, cite specific rules when possible, and explain concepts clearly. If something isn't covered in the rulebook, say so.

When answering:
- Prioritize information from the rulebook
- Cite the specific page or section when referencing rules
- Explain mechanics in clear, understandable terms
- If there's ambiguity, explain multiple interpretations
- Be friendly and encouraging to new and experienced players`,
    model: 'gpt-4o',
    tools: vectorStoreId ? [{ type: 'file_search' }] : [],
  };

  if (vectorStoreId) {
    body.tool_resources = {
      file_search: { vector_store_ids: [vectorStoreId] }
    };
  }

  const assistant = await openaiRequest('POST', '/assistants', body);

  console.log(`✓ Rules Q&A Assistant created: ${assistant.id}`);
  return assistant.id;
}

/**
 * Create the Storyteller Assistant
 */
async function createStorytellerAssistant(vectorStoreId = null) {
  console.log('\nCreating Storyteller Assistant...');

  const body = {
    name: 'VTM Storyteller',
    description: 'Storyteller and Game Master assistant for Vampire: The Masquerade',
    instructions: `You are an expert Storyteller for Vampire: The Masquerade (Revised Edition). You support two distinct modes:

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
- Use the rulebook as your authoritative reference for mechanics, clans, disciplines, lore
- Maintain the gothic atmosphere of VTM
- Encourage dramatic roleplay and character development
- Balance challenge with fun
- Remember important narrative details and character developments
- Be collaborative and responsive to player agency`,
    model: 'gpt-4o',
    tools: vectorStoreId ? [{ type: 'file_search' }] : [],
  };

  if (vectorStoreId) {
    body.tool_resources = {
      file_search: { vector_store_ids: [vectorStoreId] }
    };
  }

  const assistant = await openaiRequest('POST', '/assistants', body);

  console.log(`✓ Storyteller Assistant created: ${assistant.id}`);
  return assistant.id;
}

/**
 * Main setup flow
 */
async function main() {
  console.log('='.repeat(60));
  console.log('VTM Companion - Assistant Setup');
  console.log('='.repeat(60));

  // Validate API key
  if (!OPENAI_API_KEY) {
    console.error('\n❌ Error: OPENAI_API_KEY environment variable not set');
    console.error('Please set your OpenAI API key:');
    console.error('  export OPENAI_API_KEY=sk_...');
    process.exit(1);
  }

  console.log('\n✓ OpenAI API key configured');

  let vectorStoreId = null;

  // Handle rulebook upload if provided
  if (RULEBOOK_FILE) {
    try {
      console.log(`\nUploading rulebook: ${RULEBOOK_FILE}`);
      const fileId = await uploadFile(RULEBOOK_FILE);
      console.log(`✓ Rulebook uploaded with ID: ${fileId}`);

      // Create a vector store and add the file
      console.log('\nCreating vector store...');
      const vectorStore = await openaiRequest('POST', '/vector_stores', {
        name: 'VTM Rulebook',
        file_ids: [fileId],
      });
      vectorStoreId = vectorStore.id;
      console.log(`✓ Vector store created: ${vectorStoreId}`);

      // Wait for the vector store to finish processing
      console.log('Waiting for vector store to process file...');
      let vs = vectorStore;
      while (vs.status === 'in_progress') {
        await new Promise(resolve => setTimeout(resolve, 2000));
        vs = await openaiRequest('GET', `/vector_stores/${vectorStoreId}`);
        console.log(`  Status: ${vs.status} (${vs.file_counts?.completed || 0}/${vs.file_counts?.total || 0} files)`);
      }
      if (vs.status === 'completed') {
        console.log('✓ Vector store ready');
      } else {
        console.warn(`⚠ Vector store status: ${vs.status}`);
      }
    } catch (error) {
      console.error(`\n⚠ Warning: Failed to upload rulebook`);
      console.error(`  ${error.message}`);
      console.log('  Continuing without rulebook...');
    }
  } else {
    console.log(
      '\n⚠ No rulebook file provided. Set RULEBOOK_FILE to enable file search:'
    );
    console.log('  export RULEBOOK_FILE=path/to/vtm-rulebook.pdf');
  }

  // Create assistants
  try {
    const rulesAssistantId = await createRulesAssistant(vectorStoreId);
    const storytellerAssistantId = await createStorytellerAssistant(vectorStoreId);

    // Output results
    console.log('\n' + '='.repeat(60));
    console.log('Setup Complete!');
    console.log('='.repeat(60));
    console.log('\nAdd these to your .env file:\n');
    console.log(`OPENAI_ASSISTANT_ID=${rulesAssistantId}`);
    console.log(`OPENAI_ST_ASSISTANT_ID=${storytellerAssistantId}`);
    console.log('\nOr set them as environment variables:');
    console.log(`  export OPENAI_ASSISTANT_ID=${rulesAssistantId}`);
    console.log(`  export OPENAI_ST_ASSISTANT_ID=${storytellerAssistantId}`);

    if (vectorStoreId) {
      console.log(`\nVector Store ID for reference: ${vectorStoreId}`);
    }

    console.log('\n✓ Ready to use! Start your Netlify dev server.');
  } catch (error) {
    console.error('\n❌ Error during setup:');
    console.error(error.message);
    process.exit(1);
  }
}

main();
