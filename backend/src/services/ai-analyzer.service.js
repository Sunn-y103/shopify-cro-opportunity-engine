import { callOpenRouter } from './openrouter-client.js';

// ──────────────────────────────────────────────────────────────────

export class AiAnalyzerService {
  /**
   * Generates a CRO report by analyzing structured store data via OpenRouter.
   *
   * @param {object} storeData - The normalized JSON from StoreScraperService.
   * @returns {Promise<object>} Structured JSON CRO report.
   */
  static async analyze(storeData) {
    const systemPrompt = [
      'You are a Shopify CRO consultant.',
      'You MUST return ONLY valid JSON.',
      'Do not include markdown. Do not include code fences. Do not include explanations.',
      'Do not omit commas or braces.',
      'Return exactly one JSON object.',
      'All string values must be 120 characters or fewer.',
      'CRITICAL TRUTHFULNESS INSTRUCTION:',
      'You must distinguish between "Feature Missing" (e.g., the store definitely does not have this feature) and "Feature Not Detected" (the scraper was unable to extract or find evidence of this feature).',
      'If the scraped data is empty or null for a specific field, NEVER say the store is missing that feature. Instead, write:',
      '- "Add to Cart could not be detected by the scraper." (or similar for PDPs)',
      '- "No filtering controls were detected during analysis." (or similar for Collections)',
      '- "No review widgets were detected on the analyzed pages." (or similar for trust/social)',
      'Use this distinct "Not Detected" language in your analysis fields and opportunities evidence/issue description.',
      'CONFIDENCE LEVEL RULES:',
      'Set the confidence field of each opportunity strictly based on evidence:',
      '- "High" ONLY if multiple pages were crawled/scraped and the feature/issue is confirmed.',
      '- "Medium" if there is partial evidence or some sections are empty.',
      '- "Low" if only the homepage was scraped, or extraction quality is limited.',
      'Do NOT always output "High".',
      'OPPORTUNITY CONTENT:',
      'Every opportunity must include:',
      '- "issue": A brief title using "Not Detected" or "Missing" strictly based on evidence.',
      '- "evidence": Use the format: "Analyzed X pages. [State what was found or not]. Reasoning: [Explain why this is an issue for conversion rate]."',
      '- "recommendation": Concrete actionable recommendation.',
    ].join(' ');

    const userPrompt = this._buildPrompt(storeData);

    try {
      const result = await callOpenRouter(systemPrompt, userPrompt, 'analyze');
      if (result && Array.isArray(result.opportunities)) {
        result.opportunities = result.opportunities.map(opp => ({
          ...opp,
          impact: typeof opp.impact === 'number' ? Math.round(opp.impact) : Math.round(parseFloat(opp.impact)) || 3
        }));
      }
      return result;
    } catch (error) {
      throw new Error(`Failed to analyze store data via AI: ${error.message}`);
    }
  }

  static _buildPrompt(storeData) {
    // ── Build a rich but concise CRO-critical payload ──────────────
    const hp   = storeData.homepage  || {};
    const cols = storeData.collections || [];
    const prds = storeData.products   || [];
    const cart = storeData.cart       || {};

    const d = {
      url:       storeData.storeUrl,
      isShopify: storeData.isShopify,
      storeName: hp.storeName,

      // Homepage signals
      hero: {
        heading:    hp.hero?.heading    || null,
        subheading: hp.hero?.subheading || null,
        ctaText:    hp.hero?.cta?.text  || null,
      },
      announcementBar:    !!hp.announcementBar,
      announcementText:   hp.announcementBar ? String(hp.announcementBar).slice(0, 120) : null,
      newsletter:         hp.newsletter,
      socialLinksFound:   Object.keys(hp.socialLinks || {}).length,
      socialNetworks:     Object.keys(hp.socialLinks || {}),
      homepageTrustBadges: hp.trustBadges?.length ?? 0,
      navItemCount:       hp.navigation?.length ?? 0,
      featuredCollections: (hp.featuredCollections || []).slice(0, 5).map(c => c.title),

      // Collections signals
      collectionsFound:     cols.length,
      collectionNames:      cols.slice(0, 5).map(c => c.title).filter(Boolean),
      hasCollectionFilters: cols.some(c => c.filters?.length > 0),
      filterLabels:         cols.flatMap(c => c.filters || []).slice(0, 10),
      hasCollectionSorting: cols.some(c => c.sortingOptions?.length > 0),
      sortOptions:          cols.flatMap(c => c.sortingOptions || []).slice(0, 6),

      // Product signals
      productsFound: prds.length,
      productsWithPrice:     prds.filter(p => p.price).length,
      productsWithReviews:   prds.filter(p => p.reviews?.hasReviews).length,
      productsWithCompareAt: prds.filter(p => p.compareAtPrice).length,
      productsWithBuyNow:    prds.filter(p => p.buyNow).length,
      productsWithStickyATC: prds.filter(p => p.stickyAddToCart).length,
      // Up to 4 products with key CRO signals
      productSignals: prds.slice(0, 4).map(p => ({
        name:          p.name,
        price:         p.price,
        compareAt:     p.compareAtPrice,
        discount:      p.discount,
        rating:        p.reviews?.rating,
        reviewCount:   p.reviews?.count,
        hasReviews:    p.reviews?.hasReviews ?? false,
        hasDesc:       !!p.description,
        hasShipping:   p.shippingInfo ?? false,
        hasReturns:    p.returnPolicy  ?? false,
        hasAddToCart:  p.addToCart     ?? false,
        hasBuyNow:     p.buyNow        ?? false,
        hasSticky:     p.stickyAddToCart ?? false,
        paymentIcons:  p.paymentIcons?.length ?? 0,
        trustBadges:   p.trustBadges?.length  ?? 0,
        imageCount:    p.imageCount    ?? p.images?.length ?? 0,
        sizes:         (p.sizes || []).slice(0, 5),
        colors:        (p.colors || []).slice(0, 5),
      })),

      // Cart signals
      cart: {
        type:            cart.cartType,
        coupon:          cart.couponField       ?? false,
        shippingCalc:    cart.shippingEstimator ?? false,
        freeShipBanner:  cart.freeShippingBanner ?? false,
        upsells:         cart.upsells           ?? false,
        crossSells:      cart.crossSells        ?? false,
        expressCheckout: cart.expressCheckout   ?? false,
        trustBadges:     cart.trustBadges?.length ?? 0,
        paymentMethods:  cart.paymentMethods     ?? [],
      },
    };

    // Recursively truncate all strings to 120 chars
    const truncate = (obj) => {
      if (typeof obj === 'string') return obj.slice(0, 120);
      if (Array.isArray(obj)) return obj.map(truncate);
      if (obj !== null && typeof obj === 'object') {
        const newObj = {};
        for (const key in obj) newObj[key] = truncate(obj[key]);
        return newObj;
      }
      return obj;
    };
    
    const cleanD = truncate(d);
    
    // Strict payload size limit check (keep it under ~30KB)
    let payloadString = JSON.stringify(cleanD);
    if (payloadString.length > 30000) {
      console.warn(`[AiAnalyzer] Payload size ${payloadString.length} exceeds 30KB. Truncating optional arrays.`);
      cleanD.productSignals = cleanD.productSignals.slice(0, 1);
      cleanD.filterLabels = cleanD.filterLabels.slice(0, 3);
      payloadString = JSON.stringify(cleanD);
    }

    return `Analyze this Shopify store and return a CRO report. Base your analysis ONLY on the actual data provided — do not assume missing features exist. Max 5 opportunities.

IMPORTANT: Return ONLY valid JSON. No markdown. No code fences. No explanations. One JSON object only.

DATA: ${payloadString}

RETURN THIS EXACT JSON SCHEMA (replace placeholder values, no extra fields):
{
  "executiveSummary": "string",
  "croScore": number,
  "analysis": {
    "homepage": "string",
    "collections": "string",
    "pdp": "string",
    "cart": "string",
    "trust": "string"
  },
  "opportunities": [
    {
      "issue": "string",
      "evidence": "string",
      "impact": number,
      "confidence": "High|Medium|Low",
      "effort": "High|Medium|Low",
      "recommendation": "string",
      "expectedLift": "string"
    }
  ],
  "quickWins": ["string"],
  "highImpactProjects": ["string"]
}`;
  }
}
