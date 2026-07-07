import { CrawlerService } from './crawler.service.js';
import { HomepageExtractorService } from './homepage-extractor.service.js';
import { CollectionExtractorService } from './collection-extractor.service.js';
import { ProductExtractorService } from './product-extractor.service.js';
import { CartExtractorService } from './cart-extractor.service.js';
import { ShopifyDetectorService } from './shopify-detector.service.js';
import { opportunityCatalog } from '../utils/opportunity-catalog.js';

export class StoreScraperService {
  /**
   * Orchestrates the extraction of a full Shopify store (Homepage, Collections, Products, Cart).
   * Ensures a consistent normalized JSON structure is returned, even on partial failures.
   *
   * @param {string} baseUrl - The base URL of the store.
   * @returns {Promise<object>} The aggregated and normalized JSON data.
   */
  static async scrape(baseUrl) {
    // 1. Initialize the normalized output structure
    const output = {
      storeUrl: baseUrl,
      isShopify: false,
      platformConfidence: 0,
      platformEvidence: [],
      shopifyDetection: { detected: false, confidence: 'Low', evidence: [] },
      homepage: {
        storeName: null,
        meta: { title: null, description: null },
        hero: { heading: null, subheading: null, cta: null },
        announcementBar: null,
        featuredCollections: [],
        featuredProducts: [],
        navigation: [],
        footer: [],
        newsletter: { checked: false, detected: false, exists: false, hasIncentive: false },
        socialLinks: {},
        trustBadges: { checked: false, detected: false, badges: [] }
      },
      collections: [],
      products: [],
      cart: {
        url: null,
        cartType: 'Unknown',
        couponField: { checked: false, detected: false },
        shippingEstimator: { checked: false, detected: false },
        freeShippingBanner: { checked: false, detected: false },
        upsells: { checked: false, detected: false },
        crossSells: { checked: false, detected: false },
        trustBadges: { checked: false, detected: false, badges: [] },
        paymentMethods: { checked: false, detected: false, methods: [] },
        expressCheckout: false
      },
      errors: [] // Track what failed for debugging
    };

    let homepageResult = null;

    // 2. Fetch Homepage and Detect Platform
    try {
      homepageResult = await CrawlerService.crawl(baseUrl);
      // Update storeUrl in case of redirects
      output.storeUrl = homepageResult.responseUrl;

      // Platform Detection
      const detection = ShopifyDetectorService.detect(homepageResult.html, homepageResult.$);
      output.isShopify = detection.isShopify;
      output.platformConfidence = detection.confidence;
      output.platformEvidence = detection.evidence;
      output.shopifyDetection = detection.shopifyDetection;

      // Extract Homepage — pass html so the extractor can parse embedded SPA/RSC JSON
      const homepageData = HomepageExtractorService.extract(homepageResult.$, homepageResult.html);
      output.homepage = { ...output.homepage, ...homepageData };

      // Release the Cheerio DOM immediately — it is only needed for homepage extraction.
      // homepageResult.html is still needed by CartExtractorService below for
      // string-based drawer/cart-type detection, so we keep only that reference.
      homepageResult.$ = null;
    } catch (error) {
      output.errors.push(`Homepage Extraction Failed: ${error.message}`);
      // If we can't load the homepage, the base URL is likely dead. Return early.
      return output;
    }

    // 3. Extract Collections, Products, and Cart in parallel
    // We pass the resolved storeUrl (handling redirects) to the sub-crawlers
    const targetUrl = output.storeUrl;

    const [collectionsResult, productsResult, cartResult] = await Promise.allSettled([
      CollectionExtractorService.extract(targetUrl),
      ProductExtractorService.extract(targetUrl),
      CartExtractorService.extract(targetUrl, homepageResult.html)
    ]);
    
    // Clear homepageResult to free memory (garbage collection)
    homepageResult = null;


    // Handle Collections
    if (collectionsResult.status === 'fulfilled') {
      output.collections = collectionsResult.value;
    } else {
      output.errors.push(`Collections Extraction Failed: ${collectionsResult.reason.message}`);
    }

    // Handle Products
    if (productsResult.status === 'fulfilled') {
      output.products = productsResult.value;
    } else {
      output.errors.push(`Products Extraction Failed: ${productsResult.reason.message}`);
    }

    // Handle Cart
    if (cartResult.status === 'fulfilled') {
      output.cart = { ...output.cart, ...cartResult.value };
    } else {
      output.errors.push(`Cart Extraction Failed: ${cartResult.reason.message}`);
    }

    // 4. Fallback: if products still empty, try to get them from discovered collections
    if (output.products.length === 0 && output.collections.length > 0) {
      console.warn('[StoreScraperService] Products empty — attempting fallback via collection pages...');
      try {
        output.products = await this._fallbackProductsFromCollections(output.collections, targetUrl);
      } catch (err) {
        output.errors.push(`Product Fallback Failed: ${err.message}`);
      }
    }

    // Calculate quality
    const quality = this._calculateQuality(output);
    output.extractionQuality = {
      score: quality.score,
      detected: quality.detected,
      missing: quality.missing
    };

    // Calculate diagnostics
    output.diagnostics = this._getDiagnostics(output);

    // Calculate CRO score & breakdown
    const scoreObj = this._calculateCroScore(output);
    output.croScore = scoreObj.croScore;
    output.scoreBreakdown = scoreObj.breakdown;

    // Determine confidence level
    const extractionQualityScore = output.extractionQuality?.score || 0;
    const pagesCrawledCount = output.diagnostics?.pagesCrawled?.length || 0;
    let storeConfidence = 'Low';
    if (extractionQualityScore >= 80 && pagesCrawledCount >= 3) {
      storeConfidence = 'High';
    } else if (extractionQualityScore >= 60 && pagesCrawledCount >= 2) {
      storeConfidence = 'Medium';
    }

    // Evaluate catalog
    const triggeredOpps = [];
    for (const opp of opportunityCatalog) {
      try {
        if (opp.testTrigger(output)) {
          // Compute priority based on impact + effort
          let priority = 'Medium';
          const effortLower = opp.effort.toLowerCase();
          if (opp.impact >= 4) {
            priority = (effortLower === 'low' || effortLower === 'medium') ? 'High' : 'Medium';
          } else if (opp.impact <= 2) {
            priority = 'Low';
          }

          triggeredOpps.push({
            id: opp.id,
            issue: opp.issue,
            impact: opp.impact,
            confidence: storeConfidence,
            effort: opp.effort,
            priority,
            category: opp.category,
            pageType: opp.pageType,
            verified: true,
            evidence: '', // to be filled by LLM
            recommendation: '', // to be filled by LLM
            expectedLift: '' // to be filled by LLM
          });
        }
      } catch (err) {
        console.warn(`[StoreScraperService] Error evaluating trigger for ${opp.id}: ${err.message}`);
      }
    }

    // Sort opportunities by impact descending
    triggeredOpps.sort((a, b) => b.impact - a.impact);

    // Limit to between 3 and 8 opportunities (dynamic limits)
    output.opportunities = triggeredOpps.slice(0, 8);

    // 5. Post-scrape validation warnings
    this._validateAndWarn(output);

    // 6. Print the enhanced diagnostic summary
    this._printSummary(baseUrl, output);

    return output;
  }

  // ─────────────────────────────────────────────────────────────────
  // Quality Score Calculation
  // ─────────────────────────────────────────────────────────────────
  static _calculateQuality(storeData) {
    const hp = storeData.homepage || {};
    const cols = storeData.collections || [];
    const prds = storeData.products || [];
    const cart = storeData.cart || {};

    const checks = [
      { name: 'Hero Banner Heading', passed: !!hp.hero?.heading },
      { name: 'CTA Button', passed: !!hp.hero?.cta?.text },
      { name: 'Navigation Menu', passed: hp.navigation?.length > 0 },
      { name: 'Collections Found', passed: cols.length > 0 },
      { name: 'Collection Filters', passed: cols.some(c => c.filters?.detected ?? (c.filters?.length > 0)) },
      { name: 'Product Title', passed: prds.some(p => p.name) },
      { name: 'Product Price', passed: prds.some(p => p.price) },
      { name: 'Product Images', passed: prds.some(p => p.imageCount > 0 || (p.images && p.images.length > 0)) },
      { name: 'Product Reviews', passed: prds.some(p => p.reviews?.detected ?? p.reviews?.hasReviews) },
      { name: 'Cart Accessibility', passed: (cart.cartType && cart.cartType !== 'Unknown') }
    ];

    const passedChecks = checks.filter(c => c.passed);
    const failedChecks = checks.filter(c => !c.passed);
    const score = Math.round((passedChecks.length / checks.length) * 100);

    return {
      score,
      detected: passedChecks.map(c => c.name),
      missing: failedChecks.map(c => c.name)
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // Weighted CRO Score Calculation
  // ─────────────────────────────────────────────────────────────────
  static _calculateCroScore(storeData) {
    const hp = storeData.homepage || {};
    const cols = storeData.collections || [];
    const prds = storeData.products || [];
    const cart = storeData.cart || {};

    // 1. Homepage (max 20)
    let homepageScore = 0;
    if (hp.hero?.heading) homepageScore += 6;
    if (hp.hero?.cta?.text) homepageScore += 6;
    if (hp.navigation?.length > 0) homepageScore += 5;
    if (hp.announcementBar) homepageScore += 3;

    // 2. Collections (max 20)
    let collectionsScore = 0;
    if (cols.length > 0) collectionsScore += 8;
    if (cols.some(c => c.filters?.detected ?? (c.filters?.length > 0))) collectionsScore += 6;
    if (cols.some(c => c.sortingOptions?.detected ?? (c.sortingOptions?.length > 0))) collectionsScore += 6;

    // 3. PDP (max 25)
    let pdpScore = 0;
    if (prds.some(p => p.price)) pdpScore += 5;
    if (prds.some(p => p.buyNow?.detected ?? p.buyNow)) pdpScore += 5;
    if (prds.some(p => p.addToCart?.detected ?? p.addToCart)) pdpScore += 5;
    if (prds.some(p => p.stickyAddToCart?.detected ?? p.stickyAddToCart)) pdpScore += 5;
    if (prds.some(p => p.imageCount > 0 || (p.images && p.images.length > 0))) pdpScore += 5;

    // 4. Cart (max 20)
    let cartScore = 0;
    const hasCoupon = cart.couponField?.detected ?? cart.couponField;
    const hasShippingEstimator = cart.shippingEstimator?.detected ?? cart.shippingEstimator;
    const hasFreeShippingBanner = cart.freeShippingBanner?.detected ?? cart.freeShippingBanner;
    const hasExpressCheckout = cart.expressCheckout?.detected ?? cart.expressCheckout;
    const hasUpsells = (cart.upsells?.detected ?? cart.upsells) || (cart.crossSells?.detected ?? cart.crossSells);

    if (hasCoupon) cartScore += 4;
    if (hasShippingEstimator) cartScore += 4;
    if (hasFreeShippingBanner) cartScore += 4;
    if (hasExpressCheckout) cartScore += 4;
    if (hasUpsells) cartScore += 4;

    // 5. Trust & Social Proof (max 15)
    let trustScore = 0;
    if (prds.some(p => p.reviews?.detected ?? p.reviews?.hasReviews)) trustScore += 5;

    const hasHpTrust = hp.trustBadges?.detected ?? (hp.trustBadges?.length > 0);
    const hasCartTrust = cart.trustBadges?.detected ?? (cart.trustBadges?.length > 0);
    const hasPdpTrust = prds.some(p => p.trustBadges?.detected ?? (p.trustBadges?.length > 0));
    if (hasHpTrust || hasCartTrust || hasPdpTrust) trustScore += 5;

    if (hp.socialLinks && Object.keys(hp.socialLinks).length > 0) trustScore += 5;

    const total = homepageScore + collectionsScore + pdpScore + cartScore + trustScore;

    return {
      croScore: total,
      breakdown: {
        homepage: { score: homepageScore, max: 20 },
        collections: { score: collectionsScore, max: 20 },
        pdp: { score: pdpScore, max: 25 },
        cart: { score: cartScore, max: 20 },
        trustAndSocial: { score: trustScore, max: 15 }
      }
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // Diagnostic Gathering
  // ─────────────────────────────────────────────────────────────────
  static _getDiagnostics(storeData) {
    const hp = storeData.homepage || {};
    const cols = storeData.collections || [];
    const prds = storeData.products || [];
    const cart = storeData.cart || {};

    const pagesCrawled = [
      storeData.storeUrl,
      ...cols.map(c => c.url),
      ...prds.map(p => p.url),
      cart.url
    ].filter(Boolean);

    return {
      pagesCrawled,
      homepage: true,
      collections: cols.length,
      pdps: prds.length,
      cart: !!cart.url,
      blogs: 0,
      productsAnalyzed: prds.length,
      collectionsAnalyzed: cols.length,
      imagesFound: (hp.trustBadges?.badges?.length || hp.trustBadges?.length || 0) + prds.reduce((sum, p) => sum + (p.imageCount || p.images?.length || 0), 0) + (hp.featuredProducts?.length || 0),
      reviewsFound: prds.filter(p => p.reviews?.detected ?? p.reviews?.hasReviews).length,
      ratingsFound: prds.filter(p => p.reviews?.rating).length,
      trustBadgesFound: (hp.trustBadges?.badges?.length || hp.trustBadges?.length || 0) + (cart.trustBadges?.badges?.length || cart.trustBadges?.length || 0) + prds.reduce((sum, p) => sum + (p.trustBadges?.badges?.length || p.trustBadges?.length || 0), 0),
      navigationDetected: hp.navigation?.length > 0
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // Fallback: extract product URLs from collection pages we already scraped
  // ─────────────────────────────────────────────────────────────────
  static async _fallbackProductsFromCollections(collections, baseUrl) {
    const urls = new Set();

    for (const col of collections.slice(0, 3)) {
      if (!col.products || col.products.length === 0) continue;
      for (const p of col.products.slice(0, 3)) {
        if (p.url) {
          try { urls.add(new URL(p.url, baseUrl).href); } catch (_) {}
        }
      }
    }

    const extractedProducts = [];
    for (const url of Array.from(urls).slice(0, 1)) {
      try {
        let crawlData = await CrawlerService.crawl(url);
        const { ProductExtractorService } = await import('./product-extractor.service.js');
        const data = ProductExtractorService._extractProductData(crawlData.$, crawlData.html, url);
        extractedProducts.push(data);
        
        // Clear memory
        crawlData = null;
      } catch (err) {
        console.warn(`[Fallback] Failed to crawl product ${url}: ${err.message}`);
      }
    }

    return extractedProducts;
  }

  // ─────────────────────────────────────────────────────────────────
  // Validation warnings
  // ─────────────────────────────────────────────────────────────────
  static _validateAndWarn(output) {
    const warnings = [];

    if (!output.homepage?.hero?.heading) {
      warnings.push('⚠  Hero heading not found — homepage selectors may not match this theme');
    }
    if (output.collections.length === 0) {
      warnings.push('⚠  Collections returned 0 results — JSON API may be blocked or store has no collections');
    }
    if (output.products.length === 0) {
      warnings.push('⚠  Products returned 0 results — /products.json may be disabled or no product URLs found');
    }
    if (!output.homepage?.socialLinks || Object.keys(output.homepage.socialLinks).length === 0) {
      warnings.push('⚠  No social links detected — links may be SVG-only or loaded via JS');
    }
    const hasNewsletter = output.homepage?.newsletter?.detected ?? output.homepage?.newsletter?.exists;
    if (!hasNewsletter) {
      warnings.push('⚠  No newsletter form detected — may be loaded client-side');
    }

    if (warnings.length > 0) {
      console.warn('\n[StoreScraperService] Validation Warnings:');
      warnings.forEach(w => console.warn(`  ${w}`));
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Enhanced diagnostic summary
  // ─────────────────────────────────────────────────────────────────
  static _printSummary(baseUrl, output) {
    const cols  = output.collections || [];
    const prods = output.products    || [];
    const hp    = output.homepage    || {};
    const cart  = output.cart        || {};

    const filtersTotal  = cols.reduce((sum, c) => sum + (c.filters?.labels?.length ?? c.filters?.length ?? 0), 0);
    const sortingTotal  = cols.reduce((sum, c) => sum + (c.sortingOptions?.options?.length ?? c.sortingOptions?.length ?? 0), 0);
    const pricesCount   = prods.filter(p => p.price).length;
    const ratingsCount  = prods.filter(p => p.reviews?.rating).length;
    const reviewsCount  = prods.filter(p => p.reviews?.detected ?? p.reviews?.hasReviews).length;

    const heroHeading   = hp.hero?.heading;
    const heroTrunc     = heroHeading ? `"${heroHeading.slice(0, 50)}${heroHeading.length > 50 ? '…' : ''}"` : 'not found';

    const hasNewsletter = hp.newsletter?.detected ?? hp.newsletter?.exists;
    const hpBadgesCount = hp.trustBadges?.badges?.length ?? hp.trustBadges?.length ?? 0;
    const cartBadgesCount = cart.trustBadges?.badges?.length ?? cart.trustBadges?.length ?? 0;

    console.log('\n========== SCRAPED STORE SUMMARY ==========');
    console.log(`Store : ${baseUrl}`);
    console.log(`Shopify: ${output.isShopify} (confidence: ${output.platformConfidence}%)`);
    console.log('');
    console.log('Homepage:');
    console.log(`  - Hero Found        : ${heroHeading ? 'YES' : 'NO'}  (${heroTrunc})`);
    console.log(`  - Subheading Found  : ${hp.hero?.subheading ? 'YES' : 'NO'}`);
    console.log(`  - CTA Found         : ${hp.hero?.cta ? 'YES' : 'NO'}  ${hp.hero?.cta?.text ? `("${hp.hero.cta.text}")` : ''}`);
    console.log(`  - Announcement Bar  : ${hp.announcementBar ? 'YES' : 'NO'}`);
    console.log(`  - Newsletter        : ${hasNewsletter ? 'YES' : 'NO'}${hp.newsletter?.hasIncentive ? ' (with incentive)' : ''}`);
    console.log(`  - Trust Badges      : ${hpBadgesCount} found`);
    console.log(`  - Social Links      : ${Object.keys(hp.socialLinks || {}).length} found  ${Object.keys(hp.socialLinks || {}).join(', ') || ''}`);
    console.log(`  - Featured Colls.   : ${hp.featuredCollections?.length ?? 0}`);
    console.log(`  - Featured Products : ${hp.featuredProducts?.length ?? 0}`);
    console.log(`  - Nav Links         : ${hp.navigation?.length ?? 0}`);
    console.log('');
    console.log('Collections:');
    console.log(`  - Count             : ${cols.length}`);
    console.log(`  - Filters           : ${filtersTotal > 0 ? 'YES' : 'NO'}  (${filtersTotal} labels across ${cols.filter(c => (c.filters?.labels?.length ?? c.filters?.length ?? 0) > 0).length} collections)`);
    console.log(`  - Sorting           : ${sortingTotal > 0 ? 'YES' : 'NO'}  (${sortingTotal} options across ${cols.filter(c => (c.sortingOptions?.options?.length ?? c.sortingOptions?.length ?? 0) > 0).length} collections)`);
    console.log('');
    console.log('Products:');
    console.log(`  - Count             : ${prods.length}`);
    console.log(`  - With Price        : ${pricesCount}`);
    console.log(`  - With Rating       : ${ratingsCount}`);
    console.log(`  - With Reviews      : ${reviewsCount}`);
    console.log(`  - With Buy Now      : ${prods.filter(p => p.buyNow?.detected ?? p.buyNow).length}`);
    console.log(`  - With Sticky ATC   : ${prods.filter(p => p.stickyAddToCart?.detected ?? p.stickyAddToCart).length}`);
    console.log(`  - With Trust Badges : ${prods.filter(p => p.trustBadges?.badges?.length ?? p.trustBadges?.length ?? 0).length}`);
    console.log('');
    console.log('Cart:');
    console.log(`  - Type              : ${cart.cartType ?? 'Unknown'}`);
    console.log(`  - Coupon Field      : ${cart.couponField?.detected ?? cart.couponField ? 'YES' : 'NO'}`);
    console.log(`  - Shipping Calc     : ${cart.shippingEstimator?.detected ?? cart.shippingEstimator ? 'YES' : 'NO'}`);
    console.log(`  - Free Ship Banner  : ${cart.freeShippingBanner?.detected ?? cart.freeShippingBanner ? 'YES' : 'NO'}`);
    console.log(`  - Upsells           : ${cart.upsells?.detected ?? cart.upsells ? 'YES' : 'NO'}`);
    console.log(`  - Cross-sells       : ${cart.crossSells?.detected ?? cart.crossSells ? 'YES' : 'NO'}`);
    console.log(`  - Express Checkout  : ${cart.expressCheckout?.detected ?? cart.expressCheckout ? 'YES' : 'NO'}`);
    console.log(`  - Trust Badges      : ${cartBadgesCount}`);
    console.log('');
    if (output.errors.length > 0) {
      console.log('Errors:');
      output.errors.forEach(e => console.log(`  - ${e}`));
      console.log('');
    }
    console.log('==========================================\n');
  }
}
