export function resolveErrorStatus(message = '') {
  if (message.includes('quota exceeded') || message.includes('rate limited')) return 429;
  if (message.includes('Missing or invalid Google API key') || message.includes('GOOGLE_API_KEY is missing')) return 401;
  if (message.includes('model not found')) return 503;
  if (message.includes('Invalid URL') || message.includes('valid "url"')) return 400;
  return 500;
}
