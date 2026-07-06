export class ShopifyDetectorService {
  /**
   * Detects if a given HTML/Cheerio instance belongs to a Shopify store.
   *
   * @param {string} html - The raw HTML string.
   * @param {import('cheerio').CheerioAPI} $ - The parsed Cheerio instance.
   * @returns {{ isShopify: boolean, confidence: number, evidence: string[], shopifyDetection: { detected: boolean, confidence: string, evidence: string[] } }}
   */
  static detect(html = '', $) {
    const evidence = [];
    let score = 0;

    if (!html) {
      return {
        isShopify: false,
        confidence: 0,
        evidence: [],
        shopifyDetection: {
          detected: false,
          confidence: 'Low',
          evidence: []
        }
      };
    }

    // 1. window.Shopify object in inline scripts or Shopify global references
    if (
      html.includes('window.Shopify') || 
      html.includes('var Shopify = Shopify || {};') || 
      html.includes('Shopify.theme') ||
      html.includes('Shopify.shop') ||
      html.includes('Shopify.currency')
    ) {
      evidence.push('Found window.Shopify or Shopify global object in scripts');
      score += 45;
    }

    // 2. cdn.shopify.com domain for assets
    if (html.includes('cdn.shopify.com')) {
      evidence.push('Assets loaded from cdn.shopify.com');
      score += 40;
    }

    // 3. Shopify specific CSS classes or IDs (e.g. payment button, dynamic checkout, cart drawers)
    if (
      $ && (
        $('.shopify-payment-button').length > 0 || 
        $('#shopify-section-header').length > 0 ||
        $('.shopify-section').length > 0 ||
        html.includes('shopify-payment-button') ||
        html.includes('shopify-section')
      )
    ) {
      evidence.push('Found shopify-specific CSS classes or sections (e.g. shopify-payment-button)');
      score += 30;
    }

    // 4. Common Shopify URL structures (collections, products)
    if ($) {
      const links = $('a')
        .map((_, el) => $(el).attr('href'))
        .get()
        .filter(Boolean);

      const hasProducts = links.some(link => link.includes('/products/'));
      const hasCollections = links.some(link => link.includes('/collections/'));

      if (hasProducts || hasCollections) {
        evidence.push('Found standard Shopify routing patterns (/products/ or /collections/)');
        score += 15;
      }
    } else {
      if (html.includes('/products/') || html.includes('/collections/')) {
        evidence.push('Found Shopify routing patterns in raw HTML content');
        score += 15;
      }
    }

    // 5. Shopify meta tags
    if ($) {
      const shopifyMeta = $('meta[name="shopify-checkout-api-token"], meta[content*="Shopify"], meta[name="shopify-digital-wallet"]').length > 0;
      if (shopifyMeta) {
        evidence.push('Found Shopify-specific meta tags');
        score += 35;
      }
    }

    // 6. Shopify external scripts
    if ($) {
      const shopifyScripts = $('script[src*="shopify.com"], script[src*="cdn.shopify.com"]').length > 0;
      if (shopifyScripts) {
        evidence.push('Found Shopify external scripts or CDN resources linked');
        score += 30;
      }
    }

    // 7. Structured data indicating Shopify or standard templates
    if (html.includes('schema.org/Product') || html.includes('"@type":"Product"') || html.includes('"@type": "Product"')) {
      evidence.push('Found structured product schema data');
      score += 10;
    }

    // Cap the score at 100
    const rawConfidence = Math.min(score, 100);
    const isShopify = rawConfidence >= 40;

    let confidenceLevel = 'Low';
    if (rawConfidence >= 75) {
      confidenceLevel = 'High';
    } else if (rawConfidence >= 40) {
      confidenceLevel = 'Medium';
    }

    return {
      isShopify,
      confidence: rawConfidence,
      evidence,
      shopifyDetection: {
        detected: isShopify,
        confidence: confidenceLevel,
        evidence
      }
    };
  }
}
