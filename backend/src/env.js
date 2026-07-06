// This MUST be imported first — before any other backend module —
// so that process.env is populated before service constants are evaluated.
import dotenv from 'dotenv';
dotenv.config();

// ── Startup validation ────────────────────────────────────────────
if (!process.env.OPENROUTER_API_KEY) {
  console.error('❌ FATAL: OPENROUTER_API_KEY is missing from .env. Server cannot start.');
  process.exit(1);
}

if (!process.env.OPENROUTER_MODEL) {
  console.error('❌ FATAL: OPENROUTER_MODEL is missing from .env. Server cannot start.');
  process.exit(1);
}

if (!process.env.OPENROUTER_BASE_URL) {
  console.error('❌ FATAL: OPENROUTER_BASE_URL is missing from .env. Server cannot start.');
  process.exit(1);
}

const model     = process.env.OPENROUTER_MODEL;

console.log('──────────────────────────────────────────');
console.log('🔑 OPENROUTER_API_KEY          :', `${process.env.OPENROUTER_API_KEY.slice(0, 10)}...`);
console.log('🤖 OPENROUTER_MODEL            :', model);
console.log('🌐 OPENROUTER_BASE_URL         :', process.env.OPENROUTER_BASE_URL);
console.log('──────────────────────────────────────────');
