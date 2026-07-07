import { callOpenRouter } from './openrouter-client.js';
import { buildStoreSummary } from '../utils/store-summary.util.js';
import { StoreScraperService } from './store-scraper.service.js';

export class CompetitorAnalyzerService {
  /**
   * Crawls two Shopify URLs, extracts their data, and generates an AI comparison report.
   *
   * @param {string} urlA - The primary store URL.
   * @param {string} urlB - The competitor store URL.
   * @returns {Promise<object>} The structured JSON comparison report.
   */
  static async compare(urlA, urlB) {
    try {
      // 1. Scrape stores SEQUENTIALLY — not concurrently.
      //
      // The original Promise.all() ran both full scrapes at the same time.
      // StoreScraperService.scrape() itself runs 3 sub-crawls concurrently
      // (collections + products + cart), so Promise.all() of two scrapes meant
      // 6 simultaneous HTTP responses all buffered in RAM plus 6 Cheerio DOM
      // trees alive at the same moment — the primary OOM cause on Render Free.
      //
      // Serialising adds ~10–15 s wall time but cuts peak heap usage by ~50%.
      console.log('[CompetitorAnalyzerService] Scraping Store A...');
      const storeA_Data = await StoreScraperService.scrape(urlA);

      console.log('[CompetitorAnalyzerService] Scraping Store B...');
      const storeB_Data = await StoreScraperService.scrape(urlB);

      // 2. Log diagnostic summary of scraped data before calling AI
      this._logScrapeSummary('A', urlA, storeA_Data);
      this._logScrapeSummary('B', urlB, storeB_Data);

      const qualityA = storeA_Data.extractionQuality?.score || 0;
      const qualityB = storeB_Data.extractionQuality?.score || 0;

      // Programmatic quality difference check
      if (Math.abs(qualityA - qualityB) >= 30) {
        console.warn(`[CompetitorAnalyzerService] Quality difference differs greatly (Store A: ${qualityA}%, Store B: ${qualityB}%). Bypassing AI comparison.`);
        return {
          competitorA: { url: urlA, name: storeA_Data.homepage?.storeName || 'Store A' },
          competitorB: { url: urlB, name: storeB_Data.homepage?.storeName || 'Store B' },
          executiveSummary: "Insufficient comparable evidence due to a significant difference in the quality of data extracted from the two websites.",
          comparison: {
            homepage: { winner: "Tie", analysis: "Insufficient comparable evidence.", keyDifferences: [] },
            collections: { winner: "Tie", analysis: "Insufficient comparable evidence.", keyDifferences: [] },
            pdp: { winner: "Tie", analysis: "Insufficient comparable evidence.", keyDifferences: [] },
            cart: { winner: "Tie", analysis: "Insufficient comparable evidence.", keyDifferences: [] },
            reviewsAndTrust: { winner: "Tie", analysis: "Insufficient comparable evidence.", keyDifferences: [] },
            uxAndConversion: { winner: "Tie", analysis: "Insufficient comparable evidence.", keyDifferences: [] }
          },
          strengths: { A: [], B: [] },
          weaknesses: { A: [], B: [] },
          opportunitiesForA: []
        };
      }

      const summaryA = buildStoreSummary(storeA_Data);
      const summaryB = buildStoreSummary(storeB_Data);

      // 3. Determine winners deterministically based on weighted comparative signals
      const WEIGHTS = {
        // High weight
        heroCta: 3, trustBadges: 3, filtersDetected: 3, sortingDetected: 3,
        reviewsDetected: 3, ratingsDetected: 3, shippingInfoDetected: 3, returnPolicyDetected: 3,
        stickyAtcDetected: 3, buyNowDetected: 3, trustBadgesDetected: 3,
        freeShippingBanner: 3, expressCheckout: 3, upsellsDetected: 3, crossSellsDetected: 3,
        // Medium weight
        newsletter: 2, navigationSize: 2, featuredCollections: 2, filterLabelsCount: 2,
        sortingOptionsCount: 2, paymentIconsDetected: 2, couponDetected: 2,
        // Low weight
        heroHeading: 1, announcementBar: 1, socialLinks: 1, count: 1, socialProofLinks: 1
      };

      const determineWinnerBySignals = (sectionA, sectionB) => {
        let scoreA = 0;
        let scoreB = 0;
        if (!sectionA || !sectionB) return 'Tie';
        
        for (const key of Object.keys(sectionA)) {
          const weight = WEIGHTS[key] || 1;
          const valA = sectionA[key];
          const valB = sectionB[key];

          const numA = typeof valA === 'boolean' ? (valA ? 1 : 0) : (typeof valA === 'number' ? valA : 0);
          const numB = typeof valB === 'boolean' ? (valB ? 1 : 0) : (typeof valB === 'number' ? valB : 0);

          if (numA > numB) scoreA += weight;
          else if (numB > numA) scoreB += weight;
        }

        // Return tie if evidence is mixed or difference is insignificant
        if (Math.abs(scoreA - scoreB) <= 2) return 'Tie';
        return scoreA > scoreB ? 'A' : 'B';
      };

      const winners = {
        homepage: determineWinnerBySignals(summaryA.Homepage, summaryB.Homepage),
        collections: determineWinnerBySignals(summaryA.Collections, summaryB.Collections),
        pdp: determineWinnerBySignals(summaryA.Products, summaryB.Products),
        cart: determineWinnerBySignals(summaryA.Cart, summaryB.Cart),
        reviewsAndTrust: determineWinnerBySignals(summaryA.Trust, summaryB.Trust)
      };

      // UX & Conversion ties into the overall comparative strength
      let totalScoreA = 0, totalScoreB = 0;
      Object.keys(winners).forEach(k => {
        if (winners[k] === 'A') totalScoreA++;
        if (winners[k] === 'B') totalScoreB++;
      });
      winners.uxAndConversion = totalScoreA > totalScoreB ? 'A' : (totalScoreB > totalScoreA ? 'B' : 'Tie');

      // 4. Build user prompt
      const userPrompt = this._buildPrompt(summaryA, summaryB, storeA_Data, storeB_Data, winners);

      // Allow GC of the large raw objects before making the OpenRouter API call
      // (the API call itself can allocate a few MB for the response buffer).
      storeA_Data.collections = storeA_Data.products = storeA_Data.homepage = null;
      storeB_Data.collections = storeB_Data.products = storeB_Data.homepage = null;


      // 5. Build system prompt
      const systemPrompt = [
        'You are a strict CRO analysis engine.',
        'The scraped crawler data provided below is the ONLY source of truth. Your job is to analyze this data, not to use general ecommerce knowledge or assumptions.',
        'RULES:',
        '1. DATA GROUNDING: Every comparison, strength, weakness, opportunity, and recommendation must come from extracted crawler fields. Do not use assumptions.',
        '2. NO INVENTED FEATURES: Never claim a store has shipping, returns, product descriptions, payment methods, trust badges, reviews, ratings, or navigation unless explicitly present in crawler data. If missing, write: "Not detected from available crawl data."',
        '3. UNKNOWN DATA: Unknown means "Could not be verified from available crawl data." Do not penalize a store for unknown fields.',
        '4. COMPARISONS: Comparison winners must come ONLY from deterministic backend logic. Explain WHY the backend picked the winner using strict evidence (e.g. "Store A has more detected features: Reviews: YES"). When evidence is balanced, prefer "Tie" over forcing a winner.',
        '5. NO BRAND FLUFF: Do not write brand descriptions like "Store X focuses on sustainability". This is a technical CRO audit.',
        '6. NO UNSUPPORTED CLAIMS: Avoid causal claims. Recommendations must explain user experience or friction improvements, not guaranteed business outcomes. Do NOT use phrases like "increase conversion rates", "boost sales by X%", "increase revenue", or "significantly improve conversions". Example: Instead of "Upsells increase AOV", use "Upsell recommendations help customers discover additional products".',
        '7. OPPORTUNITIES: Must contain Title, Category, Evidence, Why it matters, Recommendation, Impact Score (1-5 integer), Confidence (High/Medium/Low).',
        '8. OPPORTUNITY FRAMING: Check both stores before creating opportunities. If Store A lacks a feature but Store B has it, frame it as matching competitor capabilities. If BOTH lack the feature, frame it as a neutral improvement (e.g., "Opportunity to improve product discovery"). Do not use phrases like "Opportunity to beat competitor".',
        '9. NEUTRAL EXECUTIVE SUMMARY: Avoid absolute judgments (e.g., "Store B excels"). Use evidence-based wording (e.g., "Store B shows stronger detected CRO signals..."). Always clarify that conclusions are based on available crawler data. Never include brand positioning, marketing claims, or business assumptions.',
        '10. CART HANDLING: Do not treat unknown cart data as a failed score. If unknown, write: "Cart evaluation has limited confidence because cart data could not be fully verified from available crawl data." Only mention missing features if explicitly detected as NO.',
        '11. TRUST STATEMENTS: Avoid absolute statements like "has all elements present". Use evidence-based wording: "shows strong detected signals through available reviews, ratings, and social proof elements."',
        '12. HOMEPAGE LANGUAGE: If an announcement bar is missing, do not assume it is for promotions. Use: "The homepage does not have a detected announcement bar, which may reduce visibility of important store messaging."',
        '13. GENERAL RULES: Unknown ≠ Missing. Missing ≠ Failed. Only mention features explicitly available in crawler data. Avoid absolute statements like "Best performing store", "Strong brand identity", "Innovative company", or "Premium experience". Use phrases like "Not detected from available crawl data" or "Could not be verified from available crawl data".',
        '14. CONFIDENCE: High (directly detected comparison), Medium (partial data), Low (cannot verify).',
        '15. OUTPUT STYLE: Evidence-driven, neutral tone, no assumptions, no generic marketing statements. NEVER override, recalculate, or contradict backend winner decisions.',
        'STRING LENGTH LIMITS:',
        '- executiveSummary: 1000 characters maximum.',
        '- analysis (in comparison sections): 500 characters maximum per field.',
        '- keyDifferences: 300 characters maximum per bullet.',
        '- strengths/weaknesses: 200 characters maximum per bullet.',
        '- evidence and whyItMatters: 500 characters maximum.',
        '- recommendation: 300 characters maximum.'
      ].join(' ');

      // 5. Call OpenRouter via shared client
      const result = await callOpenRouter(systemPrompt, userPrompt, 'compare');
      if (result && Array.isArray(result.opportunitiesForA)) {
        result.opportunitiesForA = result.opportunitiesForA.map(opp => ({
          ...opp,
          impact: opp.impactScore ? Math.round(opp.impactScore) : (typeof opp.impact === 'number' ? Math.round(opp.impact) : Math.round(parseFloat(opp.impact)) || 3)
        }));
      }
      return result;

    } catch (error) {
      console.error('Competitor Analysis Error:', error.stack || error.message);
      throw new Error(`Failed to generate competitor comparison: ${error.message}`);
    }
  }

  /**
   * Logs a structured diagnostic summary of scraped data for one store.
   * Helps distinguish scraper failures from AI reasoning issues.
   */
  static _logScrapeSummary(label, url, store) {
    const collections       = store.collections || [];
    const products          = store.products    || [];
    const filtersTotal      = collections.reduce((sum, c) => sum + (c.filters?.labels?.length ?? c.filters?.length ?? 0), 0);
    const sortingTotal      = collections.reduce((sum, c) => sum + (c.sortingOptions?.options?.length ?? c.sortingOptions?.length ?? 0), 0);
    const colsWithFilters   = collections.filter(c => (c.filters?.labels?.length ?? c.filters?.length ?? 0) > 0).length;
    const colsWithSorting   = collections.filter(c => (c.sortingOptions?.options?.length ?? c.sortingOptions?.length ?? 0) > 0).length;
    const productsWithReviews  = products.filter(p => p.reviews?.detected ?? p.reviews?.hasReviews).length;
    const productsWithBuyNow   = products.filter(p => p.buyNow?.detected ?? p.buyNow).length;
    const productsWithSticky   = products.filter(p => p.stickyAddToCart?.detected ?? p.stickyAddToCart).length;
    const productsWithTrust    = products.filter(p => (p.trustBadges?.badges?.length ?? p.trustBadges?.length ?? 0) > 0).length;
    const homepageTrustBadges  = store.homepage?.trustBadges?.badges?.length ?? store.homepage?.trustBadges?.length ?? 0;
    const errors               = store.errors || [];

    console.log(`\n┌─ Scrape Diagnostic — Store ${label} (${url}) ${'─'.repeat(10)}`);
    console.log(`│ isShopify             : ${store.isShopify} (confidence: ${store.platformConfidence})`);
    console.log(`│ collectionsFound      : ${collections.length}`);
    console.log(`│ colsWithFilters       : ${colsWithFilters} (${filtersTotal} total filter labels)`);
    console.log(`│ colsWithSorting       : ${colsWithSorting} (${sortingTotal} total sort options)`);
    console.log(`│ productsFound         : ${products.length}`);
    console.log(`│ productsWithReviews   : ${productsWithReviews}`);
    console.log(`│ productsWithBuyNow    : ${productsWithBuyNow}`);
    console.log(`│ productsWithStickyATC : ${productsWithSticky}`);
    console.log(`│ productsWithTrustBadge: ${productsWithTrust}`);
    console.log(`│ homepageTrustBadges   : ${homepageTrustBadges}`);
    console.log(`│ cartType              : ${store.cart?.cartType ?? 'Unknown'}`);
    console.log(`│ cartExpressCheckout   : ${store.cart?.expressCheckout ?? false}`);
    console.log(`│ scrapingErrors        : ${errors.length > 0 ? errors.join(' | ') : 'none'}`);
    console.log(`└${'─'.repeat(60)}`);
  }

  static _buildPrompt(summaryA, summaryB, storeA, storeB, winners) {
    const opportunitiesToExplain = (storeA.opportunities || []).map(o => ({
      id: o.id,
      title: o.issue,
      impact: Math.round(o.impact),
      effort: o.effort || 'Medium',
      category: o.category || 'UX'
    }));

    return `Compare these two Shopify stores and return a concise competitor analysis JSON.

CRITICAL: Return ONLY valid JSON. No markdown. No code fences. No explanations outside the JSON.
Every object and array must be completely closed.

PRE-COMPUTED WINNERS (DO NOT CHANGE THESE):
${JSON.stringify(winners, null, 2)}

STORE A EVIDENCE: 
${JSON.stringify(summaryA)}

STORE B EVIDENCE: 
${JSON.stringify(summaryB)}

OPPORTUNITIES FOR STORE A (DO NOT CHANGE TITLE, IMPACT, EFFORT, OR CATEGORY):
${JSON.stringify(opportunitiesToExplain)}

RETURN THIS EXACT JSON SCHEMA (replace placeholder values, no extra fields):
{
  "competitorA": { "url": "${storeA.storeUrl}", "name": "${storeA.homepage?.storeName || 'Store A'}" },
  "competitorB": { "url": "${storeB.storeUrl}", "name": "${storeB.homepage?.storeName || 'Store B'}" },
  "executiveSummary": "Summarize where the competitor is better, where the analyzed store is better, and the biggest conversion opportunities. Do not use generic assumptions.",
  "comparison": {
    "homepage": { "winner": "${winners.homepage}", "analysis": "Explain why based on evidence.", "keyDifferences": ["Factual bullet 1", "Factual bullet 2"] },
    "collections": { "winner": "${winners.collections}", "analysis": "Explain why based on evidence.", "keyDifferences": ["Factual bullet 1", "Factual bullet 2"] },
    "pdp": { "winner": "${winners.pdp}", "analysis": "Explain why based on evidence.", "keyDifferences": ["Factual bullet 1", "Factual bullet 2"] },
    "cart": { "winner": "${winners.cart}", "analysis": "Explain why based on evidence.", "keyDifferences": ["Factual bullet 1", "Factual bullet 2"] },
    "reviewsAndTrust": { "winner": "${winners.reviewsAndTrust}", "analysis": "Explain why based on evidence.", "keyDifferences": ["Factual bullet 1", "Factual bullet 2"] },
    "uxAndConversion": { "winner": "${winners.uxAndConversion}", "analysis": "Explain overall why based on evidence.", "keyDifferences": ["Factual bullet 1", "Factual bullet 2"] }
  },
  "strengths": { 
    "A": ["Factual strength 1", "Factual strength 2", "Factual strength 3"], 
    "B": ["Factual strength 1", "Factual strength 2", "Factual strength 3"] 
  },
  "weaknesses": { 
    "A": ["Factual weakness 1", "Factual weakness 2", "Factual weakness 3"], 
    "B": ["Factual weakness 1", "Factual weakness 2", "Factual weakness 3"] 
  },
  "opportunitiesForA": [
    { 
      "title": "Exact title from provided opportunities", 
      "category": "Exact category from provided opportunities",
      "evidence": "Supporting factual evidence identifying the problem (e.g. Store A: Filters = NO, Store B: Filters = YES)", 
      "whyItMatters": "Short explanation of why it matters",
      "recommendation": "Practical recommended action", 
      "impactScore": 4,
      "confidence": "High | Medium | Low"
    }
  ]
}`;
  }
}
