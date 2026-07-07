import { callOpenRouter } from './openrouter-client.js';

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
      'You are a strict Shopify CRO experiment designer.',
      'You MUST return ONLY valid JSON.',
      'Do not include markdown. Do not include code fences. Do not include explanations.',
      'RULES:',
      '1. EVIDENCE REQUIREMENT: Every A/B test must originate directly from detected crawler data. Do not generate generic CRO tests without crawler evidence.',
      '2. NO FAKE LIFT PERCENTAGES: Do not generate "Expected Lift: 2-4%" or any percentage improvement predictions. Use "Low", "Medium", or "High" for expectedImpact.',
      '3. NO UNSUPPORTED CLAIMS: Avoid causal claims (e.g., instead of "Payment icons increase conversions", write "Payment icons can improve checkout transparency"). Do not use "increase conversion rates", "boost sales", "increase revenue", or "improve AOV" unless backed by actual data. Frame hypotheses around reducing friction, improving usability, product discovery, and trust (e.g., "reduces purchase friction", "improves checkout transparency").',
      '4. UNKNOWN DATA HANDLING: Unknown does not mean missing. If data is unknown or not verified, do not assume it is a problem. State "Insufficient data available for evaluation." if needed. Do not treat unknown cart data as a failed score. Only mention missing features if explicitly detected as NO.',
      '5. GENERAL RULES: Unknown ≠ Missing. Missing ≠ Failed. Only mention features explicitly available in crawler data. Avoid absolute statements like "Best performing store", "Strong brand identity", "Innovative company", or "Premium experience". Never include brand positioning, marketing claims, or business assumptions. Use phrases like "Not detected from available crawl data" or "Could not be verified from available crawl data".',
      '6. PROFESSIONAL FOCUS: Focus on reducing friction, improving usability, discovery, and trust clarity.',
      'Return exactly one JSON object.'
    ].join(' ');

    const userPrompt = this._buildPrompt(topOpportunities);

    try {
      return await callOpenRouter(systemPrompt, userPrompt, 'ab-test');
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
      "title": "Experiment name",
      "hypothesis": "If X is changed, then Y user behavior may improve because Z",
      "evidence": "Exact crawler evidence supporting this test (e.g. Filters = NO)",
      "primaryMetric": "Metric to measure (e.g. Add to Cart Rate)",
      "secondaryMetric": "Additional metric (e.g. Bounce Rate)",
      "expectedImpact": "Low | Medium | High",
      "effort": "Low | Medium | High",
      "implementation": "Practical implementation steps"
    }
  ]
}`;
  }
}
