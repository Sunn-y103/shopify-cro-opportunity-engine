import { callGemini } from './gemini-client.js';
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
      // 1. Crawl both stores concurrently
      const [storeA_Data, storeB_Data] = await Promise.all([
        StoreScraperService.scrape(urlA),
        StoreScraperService.scrape(urlB)
      ]);

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

      // 3. Build prompts
      const systemPrompt = [
        'You are a Shopify CRO competitive analyst.',
        'You MUST return ONLY valid JSON.',
        'Do not include markdown, code fences, explanations, or any surrounding text.',
        'Return exactly one JSON object.',
        'Every JSON object and array must be completely closed with proper brackets.',
        'Never truncate the JSON response — if running low on space, shorten string values but always close all brackets.',
        'All string values must be 150 characters or fewer.',
        'CRITICAL INSTRUCTION ON TRUTHFULNESS:',
        'You must distinguish between "Feature Missing" (e.g. the store definitely does not have this feature) and "Feature Not Detected" (the scraper was unable to extract or find evidence of this feature).',
        'If the scraped data is empty or null for a specific field, NEVER say the store is missing that feature. Instead, use "Not Detected" terminology.',
      ].join(' ');

      const userPrompt = this._buildPrompt(storeA_Data, storeB_Data);

      // 4. Call Gemini via shared client
      const result = await callGemini(systemPrompt, userPrompt, 'compare');
      if (result && Array.isArray(result.opportunitiesForA)) {
        result.opportunitiesForA = result.opportunitiesForA.map(opp => ({
          ...opp,
          impact: typeof opp.impact === 'number' ? Math.round(opp.impact) : Math.round(parseFloat(opp.impact)) || 3
        }));
      }
      return result;

    } catch (error) {
      console.error('Competitor Analysis Error:', error.message);
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
    const filtersTotal      = collections.reduce((sum, c) => sum + (c.filters?.length ?? 0), 0);
    const sortingTotal      = collections.reduce((sum, c) => sum + (c.sortingOptions?.length ?? 0), 0);
    const colsWithFilters   = collections.filter(c => c.filters?.length > 0).length;
    const colsWithSorting   = collections.filter(c => c.sortingOptions?.length > 0).length;
    const productsWithReviews  = products.filter(p => p.reviews?.hasReviews).length;
    const productsWithBuyNow   = products.filter(p => p.buyNow).length;
    const productsWithSticky   = products.filter(p => p.stickyAddToCart).length;
    const productsWithTrust    = products.filter(p => p.trustBadges?.length > 0).length;
    const homepageTrustBadges  = store.homepage?.trustBadges?.length ?? 0;
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

  static _buildPrompt(storeA, storeB) {
    // Build a richer slim payload that preserves actual scraped values
    // so the AI can reason from evidence, not just booleans.
    const slim = (store) => {
      const collections = store.collections || [];
      const products    = store.products    || [];

      // Gather actual filter labels (first 5 across collections)
      const filterLabels = [];
      for (const col of collections) {
        for (const f of (col.filters || [])) {
          if (filterLabels.length < 5 && !filterLabels.includes(f)) filterLabels.push(f);
        }
      }

      // Gather actual sort options (first 5 across collections)
      const sortOptions = [];
      for (const col of collections) {
        for (const s of (col.sortingOptions || [])) {
          if (sortOptions.length < 5 && !sortOptions.includes(s)) sortOptions.push(s);
        }
      }

      // Per-product PDP signals (up to 3 products)
      const pdpSignals = products.slice(0, 3).map(p => ({
        name:            p.name,
        hasReviews:      p.reviews?.hasReviews ?? false,
        reviewRating:    p.reviews?.rating     ?? null,
        reviewCount:     p.reviews?.count      ?? null,
        hasCompareAt:    !!p.compareAtPrice,
        hasBuyNow:       p.buyNow              ?? false,
        hasStickyATC:    p.stickyAddToCart     ?? false,
        hasAddToCart:    p.addToCart           ?? false,
        hasDesc:         !!p.description,
        hasShipping:     p.shippingInfo        ?? false,
        hasReturns:      p.returnPolicy        ?? false,
        trustBadges:     p.trustBadges?.length ?? 0,
        paymentIcons:    p.paymentIcons?.length ?? 0,
        images:          p.images?.length       ?? 0,
      }));

      return {
        url:             store.storeUrl,
        isShopify:       store.isShopify,
        storeName:       store.homepage?.storeName,
        hero:            store.homepage?.hero,
        announcementBar: store.homepage?.announcementBar,
        newsletter:      store.homepage?.newsletter,
        socialLinksCount:    Object.keys(store.homepage?.socialLinks || {}).length,
        homepageTrustBadges: store.homepage?.trustBadges?.length ?? 0,
        collectionsFound:    collections.length,
        filterLabels,           // actual filter names, not just a boolean
        sortOptions,            // actual sort option names
        hasFilters:          filterLabels.length > 0,
        hasSorting:          sortOptions.length > 0,
        productsFound:       products.length,
        pdpSignals,             // detailed per-product signals
        cart: {
          type:            store.cart?.cartType,
          coupon:          store.cart?.couponField        ?? false,
          shippingCalc:    store.cart?.shippingEstimator  ?? false,
          freeShipBanner:  store.cart?.freeShippingBanner ?? false,
          upsells:         store.cart?.upsells            ?? false,
          crossSells:      store.cart?.crossSells         ?? false,
          expressCheckout: store.cart?.expressCheckout    ?? false,
          trustBadges:     store.cart?.trustBadges?.length ?? 0,
          paymentMethods:  store.cart?.paymentMethods     ?? [],
        },
        scrapingErrors: store.errors || [],
      };
    };

    return `Compare these two Shopify stores and return a concise competitor analysis JSON.

CRITICAL: Return ONLY valid JSON. No markdown. No code fences. No explanations. No surrounding text.
Every object and array must be completely closed. Never truncate the JSON response.
If a value would be very long, shorten it — but always close all brackets and braces.

STORE A: ${JSON.stringify(slim(storeA))}
STORE B: ${JSON.stringify(slim(storeB))}

RETURN THIS EXACT JSON SCHEMA (replace placeholder values, no extra fields):
{
  "competitorA": { "url": "string", "name": "string" },
  "competitorB": { "url": "string", "name": "string" },
  "executiveSummary": "string",
  "comparison": {
    "homepage": { "winner": "A|B|Tie", "analysis": "string", "keyDifferences": ["string"] },
    "collections": { "winner": "A|B|Tie", "analysis": "string", "keyDifferences": ["string"] },
    "pdp": { "winner": "A|B|Tie", "analysis": "string", "keyDifferences": ["string"] },
    "cart": { "winner": "A|B|Tie", "analysis": "string", "keyDifferences": ["string"] },
    "reviewsAndTrust": { "winner": "A|B|Tie", "analysis": "string", "keyDifferences": ["string"] },
    "uxAndConversion": { "winner": "A|B|Tie", "analysis": "string", "keyDifferences": ["string"] }
  },
  "strengths": { "A": ["string"], "B": ["string"] },
  "weaknesses": { "A": ["string"], "B": ["string"] },
  "opportunitiesForA": [
    { "issue": "string", "evidence": "string", "recommendation": "string", "impact": number }
  ]
}`;
  }
}
