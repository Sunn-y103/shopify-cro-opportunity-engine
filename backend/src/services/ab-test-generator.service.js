import { callGemini } from './gemini-client.js';

export class AbTestGeneratorService {
  /**
   * Generates A/B testing experiment briefs based on the top CRO opportunities.
   *
   * @param {Array<object>} opportunities - The prioritized list of opportunities from AiAnalyzerService.
   * @returns {Promise<object>} A JSON object containing the experiment briefs.
   */
  static async generate(opportunities) {
    if (!opportunities || opportunities.length === 0) {
      throw new Error('No opportunities provided to generate A/B tests for.');
    }

    // Keep costs down — only top 3 opportunities for A/B briefs
    const topOpportunities = opportunities
      .sort((a, b) => (b.impact || 0) - (a.impact || 0))
      .slice(0, 3);

    const systemPrompt = [
      'You are a Shopify CRO experiment designer.',
      'You MUST return ONLY valid JSON.',
      'Do not include markdown.',
      'Do not include code fences.',
      'Do not include explanations.',
      'Return exactly one JSON object.',
      'All string values must be 120 characters or fewer.',
    ].join(' ');

    const userPrompt = this._buildPrompt(topOpportunities);

    try {
      return await callGemini(systemPrompt, userPrompt, 'ab-test');
    } catch (error) {
      console.error('A/B Test Generation Error:', error.message);
      throw new Error(`Failed to generate A/B test briefs: ${error.message}`);
    }
  }

  static _buildPrompt(opportunities) {
    return `Generate a structured A/B test experiment brief for each CRO opportunity below.

IMPORTANT: Return ONLY valid JSON. No markdown. No code fences. No explanations. One JSON object only.

RULES:
1. Hypothesis MUST follow: "If [change], then [result], because [rationale]."
2. Be specific in Implementation, referencing Shopify conventions where applicable.

INPUT OPPORTUNITIES:
${JSON.stringify(opportunities, null, 2)}

RETURN THIS EXACT JSON SCHEMA (replace placeholder values, no extra fields):
{
  "experiments": [
    {
      "opportunityIssue": "string (must exactly match the issue title from input)",
      "hypothesis": "string (If X, then Y, because Z)",
      "whyItMatters": "string (psychological or UX impact explanation)",
      "implementation": "string (step-by-step setup guide)",
      "primaryKpi": "string (e.g. Add to Cart Rate)",
      "secondaryKpi": "string (e.g. Bounce Rate or AOV)",
      "expectedLift": "string (e.g. 2-4%)",
      "confidence": "High|Medium|Low",
      "priority": "High|Medium|Low",
      "estimatedEffort": "string (e.g. 1-2 hours (Low) or Developer required (High))"
    }
  ]
}`;
  }
}
