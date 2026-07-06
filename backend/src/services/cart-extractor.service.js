import { CrawlerService } from './crawler.service.js';

/**
 * CartExtractorService
 *
 * Analyzes cart-related features by:
 *   1. Crawling the /cart page for static cart features
 *   2. Crawling the homepage to detect AJAX/drawer cart in global layout
 *   3. Checking raw HTML for class/script patterns indicating drawer carts
 */
export class CartExtractorService {
  /**
   * Crawls the /cart page and evaluates cart-related features.
   *
   * @param {string} baseUrl - The base URL of the Shopify store.
   * @returns {Promise<object>} Extracted cart features in JSON format.
   */
  static async extract(baseUrl, homeHtml = '') {
    try {
      const cartUrl = new URL('/cart', baseUrl).href;

      const [cartPageResult] = await Promise.allSettled([
        CrawlerService.crawl(cartUrl),
      ]);

      let cart$ = null;
      let cartHtml = '';
      // To save memory, we don't re-crawl or re-parse the homepage into Cheerio.
      // We rely on string-based detection on homeHtml and the dedicated cart page.
      let home$ = null;

      if (cartPageResult.status === 'fulfilled') {
        cart$    = cartPageResult.value.$;
        cartHtml = cartPageResult.value.html || '';
      }

      const $ = cart$;
      
      const result = {
        url:              cartUrl,
        cartType:         this._detectCartType(cart$, home$, cartHtml, homeHtml),
        couponField:      $ ? this._hasCouponField($) : false,
        shippingEstimator: $ ? this._hasShippingEstimator($) : false,
        freeShippingBanner: $ ? this._hasFreeShippingBanner($) : false,
        upsells:          $ ? this._hasRecommendations($, ['upsell', 'frequently bought', 'complete the look', 'bundle']) : false,
        crossSells:       $ ? this._hasRecommendations($, ['cross', 'recommend', 'also like', 'may also']) : false,
        trustBadges:      $ ? this._extractTrustBadges($) : [],
        paymentMethods:   $ ? this._extractPaymentMethods($) : [],
        expressCheckout:  $ ? this._hasExpressCheckout($, homeHtml) : false,
      };

      // Clear memory
      cart$ = null;
      
      return result;

    } catch (error) {
      throw new Error(`Failed to extract cart data on ${baseUrl}: ${error.message}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Cart Type Detection
  // ─────────────────────────────────────────────────────────────────
  static _detectCartType(cart$, home$, cartHtml = '', homeHtml = '') {
    const types = [];

    // Check for drawer/mini-cart in homepage layout
    if (home$) {
      const drawerSelectors = [
        '#CartDrawer', '#cart-drawer', '.cart-drawer',
        '#mini-cart', '.mini-cart', '[data-ajax-cart]',
        '[data-cart-type]', '[class*="cart-sidebar"]',
        'cart-notification', 'cart-items',   // Shopify Dawn Web Components
        '[class*="side-cart"]', '[class*="slide-cart"]',
      ].join(', ');

      if (home$(drawerSelectors).length > 0) types.push('Drawer / Mini-Cart');
    }

    // Also check raw HTML for JS class names (injected carts may be in scripts)
    if (homeHtml.includes('CartDrawer') || homeHtml.includes('cart-drawer') ||
        homeHtml.includes('MiniCart') || homeHtml.includes('SideCart') ||
        homeHtml.includes('cart-notification')) {
      if (!types.includes('Drawer / Mini-Cart')) types.push('Drawer / Mini-Cart');
    }

    // Check dedicated cart page
    if (cart$) {
      if (cart$('form[action="/cart"], .cart__contents, .cart-page, [class*="cart-form"]').length > 0) {
        types.push('Dedicated Page');
      }
    }

    if (types.length === 0) return 'Unknown';
    return types.join(' & ');
  }

  // ─────────────────────────────────────────────────────────────────
  // Coupon / Discount Field
  // ─────────────────────────────────────────────────────────────────
  static _hasCouponField($) {
    const selectors = [
      'input[name="discount"]',
      'input[id*="discount"]', 'input[id*="coupon"]',
      'input[name*="coupon"]', 'input[name="discount_code"]',
      'input[placeholder*="coupon" i]', 'input[placeholder*="promo" i]',
      'input[placeholder*="discount" i]', 'input[placeholder*="gift" i]',
      '[class*="promo-code"] input', '[class*="coupon"] input',
      '[class*="discount-code"] input',
    ].join(', ');

    if ($(selectors).length > 0) return true;

    // Text-based: look for label text near input fields
    let found = false;
    $('label, span, p').each((_, el) => {
      const txt = $(el).text().toLowerCase().trim();
      if (txt.includes('promo code') || txt.includes('coupon code') || txt.includes('discount code') || txt.includes('gift card')) {
        found = true; return false;
      }
    });
    return found;
  }

  // ─────────────────────────────────────────────────────────────────
  // Shipping Estimator
  // ─────────────────────────────────────────────────────────────────
  static _hasShippingEstimator($) {
    const selectors = [
      '#shipping-calculator', '.shipping-calculator',
      '[data-shipping-calculator]', '.shipping-estimator',
      '[class*="shipping-estimate"]', '[id*="shipping-calc"]',
      'form[id*="shipping"]',
    ].join(', ');

    if ($(selectors).length > 0) return true;

    // Text-based fallback
    let found = false;
    $('h2, h3, h4, p, label, span').each((_, el) => {
      const txt = $(el).text().toLowerCase().trim();
      if (txt.includes('calculate shipping') || txt.includes('estimate shipping') || txt.includes('shipping calculator')) {
        found = true; return false;
      }
    });
    return found;
  }

  // ─────────────────────────────────────────────────────────────────
  // Free Shipping Banner / Progress Bar
  // ─────────────────────────────────────────────────────────────────
  static _hasFreeShippingBanner($) {
    const selectors = [
      '.free-shipping-bar', '.shipping-bar', '[data-free-shipping]',
      '.cart-shipping-threshold', '[class*="free-ship"]',
      '[class*="shipping-progress"]', '[class*="ship-threshold"]',
    ].join(', ');

    if ($(selectors).length > 0) return true;

    // Text-based detection within cart area
    let found = false;
    $('form[action="/cart"], .cart-drawer, .cart-page, .cart__contents, *').each((_, el) => {
      if (found) return;
      const text = $(el).text().toLowerCase();
      if (text.includes('away from free shipping') ||
          text.includes('eligible for free shipping') ||
          text.includes('free shipping on orders') ||
          text.includes('you\'re $') ||
          text.includes('spend') && text.includes('free shipping')) {
        found = true;
      }
    });
    return found;
  }

  // ─────────────────────────────────────────────────────────────────
  // Upsells / Cross-sells
  // ─────────────────────────────────────────────────────────────────
  static _hasRecommendations($, keywords) {
    const selectors = [
      '.cart-recommendations', '[data-cart-recommendations]',
      '.cart-upsell', '.cart-cross-sell', '.related-products',
      '[class*="upsell"]', '[class*="cross-sell"]',
      '[class*="recommendation"]', '[class*="bundle"]',
    ].join(', ');

    if ($(selectors).length > 0) return true;

    // Look for headings in the cart area with matching text
    let found = false;
    $('h2, h3, h4, span.title, p.title, [class*="heading"]').each((_, el) => {
      const text = $(el).text().toLowerCase();
      if (keywords.some(kw => text.includes(kw))) {
        found = true; return false;
      }
    });
    return found;
  }

  // ─────────────────────────────────────────────────────────────────
  // Express Checkout (PayPal, Apple Pay, Google Pay, Shop Pay)
  // ─────────────────────────────────────────────────────────────────
  static _hasExpressCheckout($, html = '') {
    const selectors = [
      '.additional-checkout-buttons', '[data-additional-checkout-buttons]',
      '.shopify-payment-button', '[data-shopify="payment-button"]',
      '.dynamic-checkout__content', '[class*="dynamic-checkout"]',
      '[class*="express-checkout"]', '[class*="express-pay"]',
    ].join(', ');

    if ($(selectors).length > 0) return true;

    // HTML scan for express payment methods
    const lower = html.toLowerCase();
    return (
      lower.includes('paypal') || lower.includes('apple pay') ||
      lower.includes('google pay') || lower.includes('shop pay') ||
      lower.includes('dynamic-checkout') || lower.includes('express checkout')
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // Payment Methods
  // ─────────────────────────────────────────────────────────────────
  static _extractPaymentMethods($) {
    const icons = [];
    $(
      'svg.icon--payment, img[alt*="payment" i], .payment-icons img, ' +
      'ul.payment-icons svg, ul.payment-methods svg, [class*="payment-icon"]'
    ).each((_, el) => {
      const type = $(el).attr('alt') || $(el).attr('class') || 'payment-icon';
      icons.push(type.replace('icon icon--', '').trim());
    });
    return [...new Set(icons)];
  }

  // ─────────────────────────────────────────────────────────────────
  // Trust Badges in Cart Area
  // ─────────────────────────────────────────────────────────────────
  static _extractTrustBadges($) {
    const trustKeywords = ['secure', 'guarantee', 'trust', 'ssl', 'checkout', 'safe', 'protected'];
    const badges = [];

    $('form[action="/cart"], .cart-drawer, .cart-page, .cart__contents').find('img').each((_, el) => {
      const alt = ($(el).attr('alt') || '').toLowerCase();
      const src = ($(el).attr('src') || $(el).attr('data-src') || '').toLowerCase();

      if (trustKeywords.some(kw => alt.includes(kw) || src.includes(kw))) {
        badges.push({ imageUrl: $(el).attr('src') || $(el).attr('data-src'), alt: $(el).attr('alt') || null });
      }
    });

    // Also check text-based trust signals in cart
    $('form[action="/cart"], .cart-drawer, .cart-page').find('[class*="trust"], [class*="secure"], [class*="guarantee"]').each((_, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (text && text.length < 100) badges.push({ text, imageUrl: null, alt: null });
    });

    return badges;
  }
}
