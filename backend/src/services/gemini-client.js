/**
 * gemini-client.js
 *
 * Shared Gemini API client used by all AI services.
 * Handles:
 *   - GoogleGenAI initialization
 *   - Pre-request audit logging (model, maxTokens, prompt size)
 *   - Post-response metadata logging (finish reason, token counts, elapsed time)
 *   - Raw response logging before any parse attempt
 *   - Truncation detection (finishReason=MAX_TOKENS + bracket-balance check)
 *   - Multi-pass JSON extraction & repair (fence strip → extract block → trailing commas → bracket-close)
 *   - Structured error handling (quota, auth, model-not-found)
 */

import { GoogleGenAI } from '@google/genai';

// ── Config ─────────────────────────────────────────────────────────

/**
 * Reads Gemini config lazily at call time so process.env is always populated.
 */
export function getGeminiConfig() {
  return {
    model:     process.env.GEMINI_MODEL                || 'gemini-2.5-flash',
    maxTokens: Number(process.env.GEMINI_MAX_OUTPUT_TOKENS) || 4000,
    apiKey:    process.env.GOOGLE_API_KEY,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Checks whether a string's outermost JSON brackets are balanced.
 * Returns { balanced: boolean, open: number, openChar: string }.
 */
function checkBracketBalance(text) {
  const trimmed = text.trim();
  const openChar = trimmed[0];
  const closeChar = openChar === '{' ? '}' : openChar === '[' ? ']' : null;

  if (!closeChar) return { balanced: false, open: 0, openChar };

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (const ch of trimmed) {
    if (escaped) { escaped = false; continue; }
    if (ch === '\\' && inString) { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === openChar || ch === '{' || ch === '[') depth++;
    else if (ch === closeChar || ch === '}' || ch === ']') depth--;
  }

  return { balanced: depth === 0, open: depth, openChar };
}

/**
 * Attempts to close an unclosed JSON object/array by appending the right
 * number of closing brackets. This is a best-effort repair for truncated JSON.
 */
function attemptBracketClose(text) {
  const trimmed = text.trim();
  // Build stacks of unclosed brackets
  const stack = [];
  let inString = false;
  let escaped = false;

  for (const ch of trimmed) {
    if (escaped) { escaped = false; continue; }
    if (ch === '\\' && inString) { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{' || ch === '[') stack.push(ch === '{' ? '}' : ']');
    else if (ch === '}' || ch === ']') stack.pop();
  }

  if (stack.length === 0) return trimmed; // already balanced

  // Remove any trailing comma before we close
  let repaired = trimmed.replace(/,\s*$/, '');
  // Append closing brackets in reverse order
  while (stack.length > 0) repaired += stack.pop();

  return repaired;
}

// ── JSON Parsing ────────────────────────────────────────────────────

/**
 * Attempts to extract and parse a valid JSON object from a raw string.
 *
 * Repair passes (in order):
 *   1. Strip markdown code fences  (```json … ``` or ``` … ```)
 *   2. Extract the first {...} or [...] block (handles prose before/after JSON)
 *   3. Remove JS-style trailing commas before } or ]
 *   4. Bracket-balance check → attempt bracket-close repair for truncated JSON
 *   5. Standard JSON.parse (with full raw log on failure)
 *
 * @param {string} raw - Raw text returned by Gemini.
 * @param {string} [label='Gemini'] - Label used in error/log messages.
 * @returns {object|Array} Parsed JSON value.
 * @throws {Error} If all repair attempts fail.
 */
export function safeParseJson(raw, label = 'Gemini') {
  // ── Step 0: log the raw response so we can always inspect it ────
  console.log(`\n┌─ ${label} Raw Response ${'─'.repeat(Math.max(0, 45 - label.length))}`);
  console.log(raw);
  console.log(`└${'─'.repeat(50)}\n`);

  if (!raw || typeof raw !== 'string') {
    throw new Error(`${label} returned an empty or non-string response.`);
  }

  let text = raw.trim();

  // ── Pass 1: strip markdown code fences ──────────────────────────
  // Handles: ```json\n{...}\n```, ```\n{...}\n```, ```json{...}```, etc.
  text = text
    .replace(/^```(?:json)?\s*/i, '')   // opening fence
    .replace(/\s*```\s*$/i, '')         // closing fence
    .trim();

  // ── Pass 2: extract first JSON object or array block ─────────────
  // Handles explanatory prose before/after the JSON.
  // Use a non-greedy approach: find the outermost { or [ position
  const firstBrace   = text.indexOf('{');
  const firstBracket = text.indexOf('[');

  if (firstBrace !== -1 || firstBracket !== -1) {
    // Start from whichever delimiter comes first
    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      const lastBrace = text.lastIndexOf('}');
      if (lastBrace > firstBrace) text = text.slice(firstBrace, lastBrace + 1);
    } else if (firstBracket !== -1) {
      const lastBracket = text.lastIndexOf(']');
      if (lastBracket > firstBracket) text = text.slice(firstBracket, lastBracket + 1);
    }
  }

  // ── Pass 3: remove trailing commas (common LLM quirk) ───────────
  // e.g. [1, 2, 3,] or {"a":1,}
  text = text.replace(/,\s*([}\]])/g, '$1');

  // ── Pass 3.5: bracket-balance check & repair ─────────────────────
  const balance = checkBracketBalance(text);
  if (!balance.balanced && balance.open > 0) {
    console.warn(`⚠️  [${label}] JSON appears truncated (${balance.open} unclosed bracket(s)). Attempting bracket-close repair...`);
    text = attemptBracketClose(text);
  }

  // ── Pass 4: attempt final parse ─────────────────────────────────
  try {
    return JSON.parse(text);
  } catch (parseError) {
    // Log the COMPLETE raw response and cleaned text for full diagnosis
    console.error(`❌ [${label}] JSON parse failed after all repair passes.`);
    console.error(`   Parse error  : ${parseError.message}`);
    console.error(`\n--- ${label} COMPLETE RAW RESPONSE (for diagnosis) ---`);
    console.error(raw);
    console.error(`--- END RAW RESPONSE ---\n`);
    console.error(`\n--- ${label} CLEANED TEXT (after repair) ---`);
    console.error(text);
    console.error(`--- END CLEANED TEXT ---\n`);
    throw new Error(
      `${label} returned malformed JSON that could not be repaired. ` +
      `Parse error: ${parseError.message}`
    );
  }
}

// ── Core Gemini Call ────────────────────────────────────────────────

/**
 * Sends a prompt pair to Gemini and returns a parsed JSON object.
 *
 * @param {string} systemPrompt - System / persona instruction.
 * @param {string} userPrompt   - The actual task prompt.
 * @param {string} [label='Gemini'] - Label for logs (e.g. 'analyze', 'compare').
 * @returns {Promise<object>} Parsed JSON response from Gemini.
 */
export async function callGemini(systemPrompt, userPrompt, label = 'Gemini') {
  const { model, maxTokens, apiKey } = getGeminiConfig();

  const promptLength = systemPrompt.length + userPrompt.length;
  const approxTokens = Math.ceil(promptLength / 4);

  // ── Pre-request audit log ────────────────────────────────────────
  console.log(`\n┌─ ${label} Request ${'─'.repeat(Math.max(0, 43 - label.length))}`);
  console.log(`│ Model           : ${model}`);
  console.log(`│ maxOutputTokens : ${maxTokens}`);
  console.log(`│ Prompt len      : ${promptLength} chars (~${approxTokens} tokens)`);
  console.log(`│ API Key         : ${apiKey ? apiKey.slice(0, 10) + '...' : '⚠️  MISSING'}`);
  console.log(`└${'─'.repeat(50)}`);

  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY is missing. Cannot make Gemini request.');
  }

  const ai = new GoogleGenAI({ apiKey });

  let rawText;
  let finishReason = 'UNKNOWN';
  let usageMeta = null;

  const startTime = Date.now();

  try {
    const response = await ai.models.generateContent({
      model,
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        temperature:       0.2,
        maxOutputTokens:   maxTokens,
        responseMimeType:  'application/json',
      },
    });

    const elapsed = Date.now() - startTime;

    // ── Extract finish reason & usage metadata ────────────────────
    try {
      finishReason = response?.candidates?.[0]?.finishReason ?? 'UNKNOWN';
    } catch (_) { /* safe */ }

    try {
      usageMeta = response?.usageMetadata ?? null;
    } catch (_) { /* safe */ }

    rawText = response.text;

    // ── Post-response metadata log ───────────────────────────────
    console.log(`\n┌─ ${label} Response Metadata ${'─'.repeat(Math.max(0, 35 - label.length))}`);
    console.log(`│ Model               : ${model}`);
    console.log(`│ maxOutputTokens     : ${maxTokens}`);
    console.log(`│ Prompt chars        : ${promptLength}`);
    console.log(`│ Finish reason       : ${finishReason}`);
    console.log(`│ Prompt tokens       : ${usageMeta?.promptTokenCount       ?? 'N/A'}`);
    console.log(`│ Output tokens       : ${usageMeta?.candidatesTokenCount   ?? 'N/A'}`);
    console.log(`│ Total tokens        : ${usageMeta?.totalTokenCount        ?? 'N/A'}`);
    console.log(`│ Generation time     : ${elapsed} ms`);
    console.log(`└${'─'.repeat(50)}`);

    // ── Truncation warning ───────────────────────────────────────
    if (finishReason === 'MAX_TOKENS') {
      console.warn(
        `⚠️  [${label}] Gemini stopped at MAX_TOKENS (${maxTokens}). ` +
        `The response is likely truncated. Consider increasing GEMINI_MAX_OUTPUT_TOKENS.`
      );
    }

  } catch (apiError) {
    console.error(`❌ [${label}] Gemini API call failed:`, apiError.message);
    if (apiError.status) console.error(`   HTTP Status:`, apiError.status);

    const msg = apiError.message ?? '';
    if (msg.includes('API_KEY_INVALID') || apiError.status === 401) {
      throw new Error('Missing or invalid Google API key. Check GOOGLE_API_KEY in .env.');
    }
    if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota') || apiError.status === 429) {
      throw new Error(`Gemini quota exceeded or rate limited. Model: ${model}`);
    }
    if (msg.includes('not found') || apiError.status === 404) {
      throw new Error(`Gemini model not found: "${model}". Check GEMINI_MODEL in .env.`);
    }
    throw apiError;
  }

  // ── Parse the response safely ────────────────────────────────────
  return safeParseJson(rawText, label);
}
