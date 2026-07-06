// This MUST be imported first — before any other backend module —
// so that process.env is populated before service constants are evaluated.
import dotenv from 'dotenv';
dotenv.config();

// ── Startup validation ────────────────────────────────────────────
if (!process.env.GOOGLE_API_KEY) {
  console.error('❌ FATAL: GOOGLE_API_KEY is missing from .env. Server cannot start.');
  process.exit(1);
}

if (!process.env.GEMINI_MODEL) {
  console.error('❌ FATAL: GEMINI_MODEL is missing from .env. Server cannot start.');
  process.exit(1);
}

const model     = process.env.GEMINI_MODEL;
const maxTokens = Number(process.env.GEMINI_MAX_OUTPUT_TOKENS) || 4000;

console.log('──────────────────────────────────────────');
console.log('🔑 GOOGLE_API_KEY          :', `${process.env.GOOGLE_API_KEY.slice(0, 10)}...`);
console.log('🤖 GEMINI_MODEL            :', model);
console.log('📊 GEMINI_MAX_OUTPUT_TOKENS:', maxTokens);
console.log('──────────────────────────────────────────');
