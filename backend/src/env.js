// This MUST be imported first — before any other backend module —
// so that process.env is populated before service constants are evaluated.
import dotenv from 'dotenv';
dotenv.config();

// ── Startup validation ────────────────────────────────────────────
// Warnings only — server boots regardless. Missing keys will cause
// individual AI requests to fail gracefully with a 500 JSON response
// via the controller try/catch, without ever crashing the process.

if (!process.env.OPENROUTER_API_KEY) {
  console.warn('⚠️  WARNING: OPENROUTER_API_KEY is not set. AI features will be unavailable.');
}

if (!process.env.OPENROUTER_MODEL) {
  console.warn('⚠️  WARNING: OPENROUTER_MODEL is not set. Defaulting to openai/gpt-4o-mini.');
  process.env.OPENROUTER_MODEL = 'openai/gpt-4o-mini';
}

if (!process.env.OPENROUTER_BASE_URL) {
  console.warn('⚠️  WARNING: OPENROUTER_BASE_URL is not set. Defaulting to https://openrouter.ai/api/v1.');
  process.env.OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
}

const apiKeyStatus = process.env.OPENROUTER_API_KEY ? '✅ set' : '❌ missing';

console.log('──────────────────────────────────────────');
console.log('🔑 OPENROUTER_API_KEY          :', apiKeyStatus);
console.log('🤖 OPENROUTER_MODEL            :', process.env.OPENROUTER_MODEL);
console.log('🌐 OPENROUTER_BASE_URL         :', process.env.OPENROUTER_BASE_URL);
console.log('──────────────────────────────────────────');

