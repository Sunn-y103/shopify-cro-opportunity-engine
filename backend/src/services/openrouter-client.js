/**
 * openrouter-client.js
 *
 * Shared OpenRouter API client used by all AI services.
 * Uses openai/gpt-4o-mini via OpenRouter.
 */

import OpenAI from 'openai';

// ── Config ─────────────────────────────────────────────────────────
export function getOpenRouterConfig() {
  return {
    model:   process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
    apiKey:  process.env.OPENROUTER_API_KEY,
    baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
  };
}

// ── JSON Parsing ────────────────────────────────────────────────────
export function safeParseJson(raw, label = 'OpenRouter') {
  console.log(`\n┌─ ${label} Raw Response ${'─'.repeat(Math.max(0, 45 - label.length))}`);
  console.log(raw);
  console.log(`└${'─'.repeat(50)}\n`);

  if (!raw || typeof raw !== 'string') {
    throw new Error(`${label} returned an empty or non-string response.`);
  }

  let text = raw.trim();

  // Strip markdown code fences (just in case, though json_object usually prevents this)
  text = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();

  // Remove trailing commas (common LLM quirk)
  text = text.replace(/,\s*([}\]])/g, '$1');

  try {
    return JSON.parse(text);
  } catch (parseError) {
    console.error(`❌ [${label}] JSON parse failed:`, parseError.message);
    throw new Error(`${label} returned malformed JSON that could not be repaired.`);
  }
}

// ── Core AI Call ────────────────────────────────────────────────
/**
 * Sends a prompt pair to OpenRouter and returns a parsed JSON object.
 *
 * @param {string} systemPrompt - System / persona instruction.
 * @param {string} userPrompt   - The actual task prompt.
 * @param {string} [label='OpenRouter'] - Label for logs.
 * @returns {Promise<object>} Parsed JSON response.
 */
export async function callOpenRouter(systemPrompt, userPrompt, label = 'OpenRouter') {
  const { model, apiKey, baseURL } = getOpenRouterConfig();

  const promptLength = systemPrompt.length + userPrompt.length;

  console.log(`\n┌─ ${label} Request ${'─'.repeat(Math.max(0, 43 - label.length))}`);
  console.log(`│ Model           : ${model}`);
  console.log(`│ Prompt len      : ${promptLength} chars`);
  console.log(`│ API Key         : ${apiKey ? '✅ set' : '❌ MISSING'}`);
  console.log(`└${'─'.repeat(50)}`);

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is missing. Cannot make OpenRouter request.');
  }

  const openai = new OpenAI({ apiKey, baseURL });
  const maxRetries = 1;
  let attempt = 0;

  while (attempt <= maxRetries) {
    attempt++;
    const startTime = Date.now();

    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];

      const requestPayload = {
        model,
        messages,
        temperature: 0, // Lower temperature to 0 for maximum determinism (per user request)
        response_format: { type: "json_object" } // Strongly enforce JSON
      };

      const response = await openai.chat.completions.create(requestPayload);
      const elapsed = Date.now() - startTime;

      const rawText = response.choices[0]?.message?.content || '';
      const finishReason = response.choices[0]?.finish_reason || 'UNKNOWN';
      const usage = response.usage || {};

      console.log(`\n┌─ ${label} Response Metadata (Attempt ${attempt}) ${'─'.repeat(Math.max(0, 35 - label.length))}`);
      console.log(`│ Model               : ${model}`);
      console.log(`│ Finish reason       : ${finishReason}`);
      console.log(`│ Prompt tokens       : ${usage.prompt_tokens ?? 'N/A'}`);
      console.log(`│ Completion tokens   : ${usage.completion_tokens ?? 'N/A'}`);
      console.log(`│ Total tokens        : ${usage.total_tokens ?? 'N/A'}`);
      console.log(`│ Generation time     : ${elapsed} ms`);
      console.log(`└${'─'.repeat(50)}`);

      if (finishReason === 'length') {
        console.warn(`⚠️  [${label}] Generation stopped at max length limit.`);
      }

      return safeParseJson(rawText, label);

    } catch (error) {
      // Differentiate between API errors and Parsing errors
      const isApiError = error.status || error.name === 'APIError' || error.name === 'RateLimitError' || error.name === 'AuthenticationError';
      
      if (isApiError) {
        console.error(`❌ [${label}] OpenRouter API call failed:`, error.message);
        if (error.status) console.error(`   HTTP Status:`, error.status);

        if (error.status === 401) throw new Error('Invalid or missing OpenRouter API key. Check OPENROUTER_API_KEY in .env.');
        if (error.status === 429) throw new Error(`OpenRouter rate limit exceeded. Model: ${model}`);
        if (error.status === 404) throw new Error(`OpenRouter model not found: "${model}". Check OPENROUTER_MODEL in .env.`);
        throw error; // Throw other unhandled API errors directly
      }

      // If it's a parse error (from safeParseJson) or other generation error, retry
      if (attempt <= maxRetries) {
        console.warn(`⚠️  [${label}] Attempt ${attempt} failed with error: ${error.message}. Retrying...`);
      } else {
        console.error(`❌ [${label}] Failed after ${attempt} attempts: ${error.message}`);
        throw error;
      }
    }
  }
}
