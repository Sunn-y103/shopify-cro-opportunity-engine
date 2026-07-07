import { callOpenRouter } from './openrouter-client.js';
import { buildStoreSummary } from '../utils/store-summary.util.js';

export class AiAnalyzerService {
  /**
   * Generates a CRO report by analyzing structured store data via OpenRouter.
   *
   * @param {object} storeData - The normalized JSON from StoreScraperService.
   * @returns {Promise<object>} Structured JSON CRO report.
   */
  static async analyze(storeData) {
    const systemPrompt = [
      'You are a strict CRO analysis engine.',
      'The scraped crawler data provided below is the ONLY source of truth. Your job is to analyze this data, not to use general ecommerce knowledge or assumptions.',
      'RULES:',
      '1. DATA GROUNDING: Every statement must be directly supported by crawler data. Do not skip available crawler fields.',
      '2. NO HALLUCINATIONS: Never invent features. Never assume standard ecommerce features exist. Never mention shipping, returns, payment methods, policies, or trust elements unless they exist in crawler data. If crawler says NO or Unknown, write: "Not detected from available crawl data."',
      '3. OPPORTUNITIES: Explain ONLY the opportunities provided in the prompt. Do not generate generic CRO recommendations. Each must have title, category, evidence, whyItMatters, recommendation, impactScore (1-5 integer), confidence (High/Medium/Low).',
      '4. IMPACT SCORE: Use only whole numbers 1-5. Do not generate fake conversion lift percentages (e.g. no +0.5%).',
      '5. CONFIDENCE: High (directly detected/missing), Medium (partial detection), Low (cannot verify).',
      '6. NO UNSUPPORTED CLAIMS: Avoid causal claims. Recommendations must explain user experience or friction improvements, not guaranteed business outcomes. Do NOT use phrases like "increase conversion rates", "boost sales by X%", "increase revenue", or "significantly improve conversions". Example: Instead of "Upsells increase AOV", use "Upsell recommendations help customers discover additional products".',
      '7. CART HANDLING: Do not treat unknown cart data as a failed score or say "Cart lacks essential features". If unknown, write: "Cart evaluation has limited confidence because cart data could not be fully verified from available crawl data." Only mention missing features if explicitly detected as NO.',
      '8. TRUST STATEMENTS: Avoid absolute statements like "has all elements present". Use evidence-based wording: "shows strong detected signals through available reviews, ratings, and social proof elements."',
      '9. HOMEPAGE LANGUAGE: If an announcement bar is missing, do not assume it is for promotions. Use: "The homepage does not have a detected announcement bar, which may reduce visibility of important store messaging."',
      '10. GENERAL RULES: Unknown ≠ Missing. Missing ≠ Failed. Only mention features explicitly available in crawler data. Avoid absolute statements like "Best performing store", "Strong brand identity", "Innovative company", or "Premium experience". Use phrases like "Not detected from available crawl data" or "Could not be verified from available crawl data".',
      '11. CRO SCORE: The backend calculates the score. In the executive summary, provide a category breakdown explaining how the final score was calculated.',
      '12. EXECUTIVE SUMMARY: Include Overall CRO score meaning, Strong areas (evidence-based), Weak areas (evidence-based), Highest priority improvements. Never include brand positioning, marketing claims, or business assumptions.',
      'The final report must look like a professional CRO SaaS audit where Crawler data = facts, and AI = analysis and prioritization only.',
      'STRING LENGTH LIMITS:',
      '- executiveSummary: 1000 characters maximum.',
      '- All analysis subfields (homepage, collections, pdp, cart, trust): 500 characters maximum per field.',
      '- evidence and whyItMatters: 500 characters maximum per opportunity.',
      '- recommendation: 300 characters maximum per opportunity.'
    ].join(' ');

    const userPrompt = this._buildPrompt(storeData);

    try {
      const result = await callOpenRouter(systemPrompt, userPrompt, 'analyze');
      
      const backendOpps = storeData.opportunities || [];
      const mergedOpps = [];

      for (const bOpp of backendOpps) {
        // Find matching opportunity from LLM by stable ID (case-insensitive)
        let llmOpp = result?.opportunities?.find(o => String(o.id || '').toLowerCase() === String(bOpp.id).toLowerCase());
        
        // Fallback: match by issue title
        if (!llmOpp) {
          llmOpp = result?.opportunities?.find(o => String(o.issue || '').toLowerCase() === String(bOpp.issue).toLowerCase());
        }

        if (llmOpp) {
          mergedOpps.push({
            ...bOpp,
            issue: llmOpp.title || bOpp.issue,
            category: llmOpp.category || bOpp.category,
            whyItMatters: llmOpp.whyItMatters || 'This improves user experience and conversions.',
            evidence: llmOpp.evidence || bOpp.defaultEvidence || 'Not detected from available crawl data.',
            recommendation: llmOpp.recommendation || bOpp.defaultRecommendation || 'Enable this feature.',
            impact: llmOpp.impactScore ? Math.round(llmOpp.impactScore) : bOpp.impact,
            confidence: llmOpp.confidence || 'Medium'
          });
        } else {
          // Fallback if AI didn't return this opportunity at all
          mergedOpps.push({
            ...bOpp,
            whyItMatters: 'This improves user experience and conversions.',
            evidence: bOpp.defaultEvidence || 'Not detected from available crawl data.',
            recommendation: bOpp.defaultRecommendation || 'Enable this feature.',
            impact: bOpp.impact,
            confidence: 'Medium'
          });
        }
      }

      // Generate quickWins and highImpactProjects dynamically
      const quickWins = mergedOpps
        .filter(opp => opp.effort === 'Low')
        .map(opp => opp.issue);

      const highImpactProjects = mergedOpps
        .filter(opp => opp.impact >= 4)
        .map(opp => opp.issue);

      return {
        executiveSummary: result?.executiveSummary || `We evaluated your store and assigned a CRO score of ${storeData.croScore}/100.`,
        analysis: {
          homepage: result?.analysis?.homepage || 'Homepage analyzed.',
          collections: result?.analysis?.collections || 'Collections analyzed.',
          pdp: result?.analysis?.pdp || 'PDP analyzed.',
          cart: result?.analysis?.cart || 'Cart analyzed.',
          trust: result?.analysis?.trust || 'Trust elements analyzed.'
        },
        opportunities: mergedOpps,
        quickWins,
        highImpactProjects
      };

    } catch (error) {
      throw new Error(`Failed to analyze store data via AI: ${error.message}`);
    }
  }

  static _buildPrompt(storeData) {
    const hp   = storeData.homepage  || {};
    const cols = storeData.collections || [];
    const prds = storeData.products   || [];
    const cart = storeData.cart       || {};

    const storeSummary = buildStoreSummary(storeData);

    const cleanD = {
      storeUrl: storeData.storeUrl,
      isShopify: storeData.isShopify,
      extractionQualityScore: storeData.extractionQuality?.score,
      pagesCrawledCount: storeData.diagnostics?.pagesCrawled?.length || 0,
      
      croScore: storeData.croScore,
      scoreBreakdown: storeData.scoreBreakdown,

      storeSummary,

      // Pass the list of deterministic opportunities we identified
      opportunitiesToExplain: (storeData.opportunities || []).map(o => ({
        id: o.id,
        issue: o.issue,
        impact: o.impact,
        effort: o.effort,
        category: o.category,
        pageType: o.pageType
      }))
    };

    const payloadString = JSON.stringify(cleanD);

    return `Explain the CRO audit results for this Shopify store. 
Base your analysis ONLY on the actual data provided below. 

Overall CRO Score: ${cleanD.croScore}/100.
Section Scores Breakdown:
- Homepage Score: ${cleanD.scoreBreakdown?.homepage?.score}/${cleanD.scoreBreakdown?.homepage?.max}
- Collections Score: ${cleanD.scoreBreakdown?.collections?.score}/${cleanD.scoreBreakdown?.collections?.max}
- Product Pages (PDP) Score: ${cleanD.scoreBreakdown?.pdp?.score}/${cleanD.scoreBreakdown?.pdp?.max}
- Cart Score: ${cleanD.scoreBreakdown?.cart?.score}/${cleanD.scoreBreakdown?.cart?.max}
- Trust & Social Proof Score: ${cleanD.scoreBreakdown?.trustAndSocial?.score}/${cleanD.scoreBreakdown?.trustAndSocial?.max}

DATA SUMMARY:
${payloadString}

You MUST explain the opportunities list below. Write the evidence explanation and recommendation fields. Do NOT modify the IDs, impact, effort, or issue names.

OPPORTUNITIES TO EXPLAIN:
${JSON.stringify(cleanD.opportunitiesToExplain)}

    RETURN THIS EXACT JSON SCHEMA (do NOT change the "id" values of opportunities, replace placeholders, no extra fields):
    {
      "executiveSummary": "Include: Overall CRO score meaning, Strong areas based on crawler evidence, Weak areas based on crawler evidence, Highest priority improvements.",
      "analysis": {
        "homepage": "Summarize homepage strengths and weaknesses based on evidence.",
        "collections": "Summarize collection page filtering and sorting based on evidence.",
        "pdp": "Summarize product page layout, images, pricing, reviews, and policies based on evidence.",
        "cart": "Summarize cart flow, upsells, coupon entry, and estimators based on evidence.",
        "trust": "Summarize reviews, trust badges, payment icons, and security signals based on evidence."
      },
      "opportunities": [
        {
          "id": "Must match the input opportunity ID exactly.",
          "title": "Specific improvement title",
          "category": "Homepage | Collections | Product Pages | Cart | Trust | UX",
          "evidence": "Exact crawler data supporting this opportunity",
          "whyItMatters": "Short explanation of why it matters for conversions",
          "recommendation": "Specific practical action",
          "impactScore": 4,
          "confidence": "High | Medium | Low"
        }
      ]
    }`;
  }
}
