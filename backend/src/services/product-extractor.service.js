import { CrawlerService } from './crawler.service.js';

/**
 * ProductExtractorService
 *
 * Product discovery strategy (in order of priority):
 *   1. Shopify JSON API  — /products.json?limit=10
 *   2. /collections/all  — scrape product links from HTML
 *   3. Homepage link scan — /products/* anchors
 *
 * For each discovered product URL, extraction strategy:
 *   1. JSON-LD <script type="application/ld+json"> with @type "Product"
 *   2. Embedded Shopify JSON in <script> tags (window.ShopifyAnalytics, meta.product)
 *   3. HTML CSS selectors (extensive fallbacks for many themes)
 */
export class ProductExtractorService {
  /**
   * Discovers and extracts data from up to 2 product pages.
   *
   * @param {string} baseUrl - The base URL of the Shopify store.
   * @returns {Promise<object[]>} Array of extracted product data.
   */
  static async extract(baseUrl) {
    try {
      // Step 1: Discover product URLs from multiple sources
      const productUrls = await this._discoverProductUrls(baseUrl);
      console.log(`[Products] Discovered ${productUrls.length} product URLs to crawl`);

      const extractedProducts = [];

      for (const url of productUrls) {
        try {
          let crawlData = await CrawlerService.crawl(url);
          const data = this._extractProductData(crawlData.$, crawlData.html, url);
          extractedProducts.push(data);
          
          // Clear memory
          crawlData = null;
        } catch (err) {
          console.warn(`[Products] Failed to crawl ${url}: ${err.message}`);
        }
      }

      return extractedProducts;
    } catch (error) {
      throw new Error(`Failed to discover products on ${baseUrl}: ${error.message}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Product URL Discovery
  // ─────────────────────────────────────────────────────────────────
  static async _discoverProductUrls(baseUrl) {
    const urls = new Set();

    // Source 1: Shopify JSON API
    try {
      const apiUrl = new URL('/products.json?limit=10', baseUrl).href;
      const data   = await CrawlerService.crawlJson(apiUrl);
      const apiProducts = data?.products || [];
      if (apiProducts.length > 0) {
        console.log(`[Products] JSON API returned ${apiProducts.length} products`);
        for (const p of apiProducts) {
          if (p.handle) {
            urls.add(new URL(`/products/${p.handle}`, baseUrl).href);
          }
        }
      }
    } catch (_) {}

    // If we already have enough products from API, return early
    if (urls.size >= 2) return Array.from(urls).slice(0, 2);

    // Source 2: /collections/all page
    try {
      const { $ } = await CrawlerService.crawl(new URL('/collections/all', baseUrl).href);
      $('a[href*="/products/"]').each((_, el) => {
        let href = $(el).attr('href') || '';
        href = href.split('?')[0].split('#')[0];
        if (href && href !== '/products' && href !== '/products/') {
          try { urls.add(new URL(href, baseUrl).href); } catch (_) {}
        }
      });
      console.log(`[Products] /collections/all added ${urls.size} URLs so far`);
    } catch (_) {}

    if (urls.size >= 2) return Array.from(urls).slice(0, 2);

    // Source 3: Homepage scan
    try {
      const { $ } = await CrawlerService.crawl(baseUrl);
      $('a[href*="/products/"]').each((_, el) => {
        let href = $(el).attr('href') || '';
        href = href.split('?')[0].split('#')[0];
        if (href && href !== '/products' && href !== '/products/') {
          try { urls.add(new URL(href, baseUrl).href); } catch (_) {}
        }
      });
    } catch (_) {}

    // Source 4: Sitemap XML — works for headless/custom stores that have sitemaps
    try {
      console.log('[Products] Checking sitemap.xml for product URLs...');
      const sitemapData = await CrawlerService.crawlSitemap(baseUrl);
      if (sitemapData.products && sitemapData.products.length > 0) {
        console.log(`[Products] Sitemap yielded ${sitemapData.products.length} product URLs`);
        for (const url of sitemapData.products) {
          urls.add(url);
        }
      }
    } catch (_) {}

    return Array.from(urls).slice(0, 2);
  }

  // ─────────────────────────────────────────────────────────────────
  // Full product data extraction for a single PDP
  // ─────────────────────────────────────────────────────────────────
  static _extractProductData($, html, url) {
    // Try JSON-LD first — gives reliable structured data on most Shopify stores
    const jsonLdProduct = this._extractJsonLdProduct($);
    // Try embedded Shopify script JSON
    const scriptJson    = this._extractShopifyScriptJson(html);

    const priceText       = this._extractPrice($, jsonLdProduct, scriptJson);
    const compareAtText   = this._extractCompareAtPrice($, scriptJson);

    return {
      url,
      name:           this._extractName($, jsonLdProduct, scriptJson),
      price:          priceText,
      compareAtPrice: compareAtText,
      discount:       this._calculateDiscount(priceText, compareAtText),
      images:         this._extractImages($, jsonLdProduct),
      imageCount:     this._extractImages($, jsonLdProduct).length,
      videos:         this._extractVideos($),
      variants:       this._extractVariants($, scriptJson),
      sizes:          this._extractSizes($, scriptJson),
      colors:         this._extractColors($, scriptJson),
      reviews:        this._extractReviews($, jsonLdProduct),
      description:    this._extractDescription($, jsonLdProduct),
      shippingInfo:   this._extractPolicy($, ['shipping', 'delivery']),
      returnPolicy:   this._extractPolicy($, ['return', 'refund', 'exchange']),
      addToCart:      this._hasAddToCart($),
      buyNow:         this._hasBuyNow($),
      stickyAddToCart: this._hasStickyAddToCart($),
      paymentIcons:   this._extractPaymentIcons($),
      trustBadges:    this._extractTrustBadges($),
      relatedProducts: this._extractRelatedProducts($),
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // JSON-LD Product extraction
  // ─────────────────────────────────────────────────────────────────
  static _extractJsonLdProduct($) {
    let product = null;
    $('script[type="application/ld+json"]').each((_, el) => {
      if (product) return;
      try {
        const data = JSON.parse($(el).html() || '');
        const items = Array.isArray(data) ? data : [data];
        const found = items.find(d => d['@type'] === 'Product');
        if (found) product = found;
      } catch (_) {}
    });
    return product;
  }

  // ─────────────────────────────────────────────────────────────────
  // Shopify embedded script JSON (window.ShopifyAnalytics.meta, etc.)
  // ─────────────────────────────────────────────────────────────────
  static _extractShopifyScriptJson(html) {
    try {
      // Pattern: window.ShopifyAnalytics.meta = {...}
      const metaMatch = html.match(/ShopifyAnalytics\.meta\s*=\s*(\{.+?\});/s);
      if (metaMatch) return JSON.parse(metaMatch[1]);
    } catch (_) {}
    try {
      // Pattern: var meta = {"product": {...}}
      const varMatch = html.match(/var\s+meta\s*=\s*(\{.+?"product".+?\});/s);
      if (varMatch) return JSON.parse(varMatch[1]);
    } catch (_) {}
    return null;
  }

  // ─────────────────────────────────────────────────────────────────
  // Name
  // ─────────────────────────────────────────────────────────────────
  static _extractName($, jsonLd, scriptJson) {
    if (jsonLd?.name) return jsonLd.name.trim();
    if (scriptJson?.product?.title) return scriptJson.product.title.trim();

    const selectors = [
      '.product__title', '.product-single__title',
      '.product-title', '[class*="product-name"]',
      '[itemprop="name"]', 'h1.title', 'h1',
    ];
    for (const sel of selectors) {
      const text = $(sel).first().text().replace(/\s+/g, ' ').trim();
      if (text) return text;
    }
    return null;
  }

  // ─────────────────────────────────────────────────────────────────
  // Price
  // ─────────────────────────────────────────────────────────────────
  static _extractPrice($, jsonLd, scriptJson) {
    // JSON-LD offers
    if (jsonLd?.offers) {
      const offer = Array.isArray(jsonLd.offers) ? jsonLd.offers[0] : jsonLd.offers;
      if (offer?.price) return `${offer.priceCurrency || ''}${offer.price}`.trim();
    }
    if (scriptJson?.product?.price) {
      // Shopify prices are in cents
      const cents = scriptJson.product.price;
      return typeof cents === 'number' ? `${(cents / 100).toFixed(2)}` : String(cents);
    }

    const selectors = [
      '.price__regular .price-item--regular',
      '.price__sale .price-item--sale',
      '.product__price',
      '.product-price',
      '[class*="price--main"]',
      '[itemprop="price"]',
      'span.money', 'bdi',
      '[class*="price"]',
    ];
    for (const sel of selectors) {
      const text = $(sel).first().text().replace(/\s+/g, ' ').trim();
      if (text && text.match(/[\d.,]+/)) return text;
    }
    return null;
  }

  // ─────────────────────────────────────────────────────────────────
  // Compare-At Price
  // ─────────────────────────────────────────────────────────────────
  static _extractCompareAtPrice($, scriptJson) {
    if (scriptJson?.product?.compare_at_price) {
      const cents = scriptJson.product.compare_at_price;
      if (cents && cents > 0) return `${(cents / 100).toFixed(2)}`;
    }

    const selectors = [
      '.price__sale .price-item--regular',
      '.price--compare', '.price-compare',
      '[class*="compare-at"]', '[class*="compareAt"]',
      's.money', 'del.money', 'strike',
      's, del, strike',
    ];
    for (const sel of selectors) {
      const text = $(sel).first().text().replace(/\s+/g, ' ').trim();
      if (text && text.match(/[\d.,]+/)) return text;
    }
    return null;
  }

  // ─────────────────────────────────────────────────────────────────
  // Discount calculation
  // ─────────────────────────────────────────────────────────────────
  static _calculateDiscount(priceStr, compareAtStr) {
    if (!priceStr || !compareAtStr) return null;
    const price   = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
    const compare = parseFloat(compareAtStr.replace(/[^0-9.]/g, ''));
    if (price && compare && compare > price) {
      return `${Math.round((1 - price / compare) * 100)}% OFF`;
    }
    return null;
  }

  // ─────────────────────────────────────────────────────────────────
  // Images
  // ─────────────────────────────────────────────────────────────────
  static _extractImages($, jsonLd) {
    const images = new Set();

    // JSON-LD image
    if (jsonLd?.image) {
      const imgs = Array.isArray(jsonLd.image) ? jsonLd.image : [jsonLd.image];
      for (const img of imgs) {
        if (typeof img === 'string') images.add(img);
        else if (img?.url) images.add(img.url);
      }
    }

    const selectors = [
      '.product__media img', '.product-single__media img',
      '.product-gallery img', '[data-thumbnail-id] img',
      '[class*="product"] img', '.product-photo img',
    ];
    for (const sel of selectors) {
      $(sel).each((_, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-srcset');
        if (src && !src.includes('icon') && !src.includes('badge')) images.add(src.split(' ')[0]);
      });
    }
    return [...images];
  }

  // ─────────────────────────────────────────────────────────────────
  // Videos
  // ─────────────────────────────────────────────────────────────────
  static _extractVideos($) {
    const videos = [];
    $('video, .product__media video, .video-wrapper iframe, .product-single__media iframe').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src');
      if (src) videos.push(src);
    });
    return videos;
  }

  // ─────────────────────────────────────────────────────────────────
  // Variants
  // ─────────────────────────────────────────────────────────────────
  static _extractVariants($, scriptJson) {
    const variants = [];

    // From Shopify embedded JSON
    if (scriptJson?.product?.variants) {
      for (const v of scriptJson.product.variants.slice(0, 10)) {
        variants.push({ id: String(v.id), title: v.title });
      }
      return variants;
    }

    // From select elements
    $('select[name="id"] option, select.product-form__input option').each((_, el) => {
      const title = $(el).text().replace(/\s+/g, ' ').trim();
      const id    = $(el).attr('value');
      if (title && id) variants.push({ id, title });
    });

    // Button-based variant selectors
    $('[data-variant-id], [data-option-value], button[name="id"]').each((_, el) => {
      const title = $(el).text().replace(/\s+/g, ' ').trim() || $(el).attr('data-option-value');
      const id    = $(el).attr('data-variant-id') || $(el).attr('value');
      if (title && !variants.find(v => v.title === title)) variants.push({ id: id || null, title });
    });

    return variants;
  }

  // ─────────────────────────────────────────────────────────────────
  // Sizes
  // ─────────────────────────────────────────────────────────────────
  static _extractSizes($, scriptJson) {
    const sizes = [];

    // From embedded JSON — look for "Size" option
    if (scriptJson?.product?.options) {
      const sizeOpt = scriptJson.product.options.find(o => o.name?.toLowerCase() === 'size');
      if (sizeOpt?.values) return sizeOpt.values;
    }

    const selectors = [
      '.variant-input[data-option-name*="Size" i] label',
      '.swatch[data-option-index] [data-value]',
      'input[type="radio"][data-option-name*="size" i] + label',
      'select[data-option-name*="size" i] option',
      'button[data-value][aria-label*="size" i]',
    ].join(', ');
    $(selectors).each((_, el) => {
      const val = $(el).text().replace(/\s+/g, ' ').trim() || $(el).attr('data-value');
      if (val && !sizes.includes(val)) sizes.push(val);
    });
    return sizes;
  }

  // ─────────────────────────────────────────────────────────────────
  // Colors
  // ─────────────────────────────────────────────────────────────────
  static _extractColors($, scriptJson) {
    const colors = [];

    // From embedded JSON — look for "Color" option
    if (scriptJson?.product?.options) {
      const colorOpt = scriptJson.product.options.find(o => o.name?.toLowerCase() === 'color' || o.name?.toLowerCase() === 'colour');
      if (colorOpt?.values) return colorOpt.values;
    }

    const selectors = [
      '.variant-input[data-option-name*="Color" i] label',
      '.color-swatch', '[class*="swatch--color"]',
      'input[type="radio"][data-option-name*="color" i] + label',
      'button[data-value][aria-label*="color" i]',
    ].join(', ');
    $(selectors).each((_, el) => {
      const val = $(el).text().replace(/\s+/g, ' ').trim() || $(el).attr('title') || $(el).attr('data-value');
      if (val && !colors.includes(val)) colors.push(val);
    });
    return colors;
  }

  // ─────────────────────────────────────────────────────────────────
  // Reviews
  // ─────────────────────────────────────────────────────────────────
  static _extractReviews($, jsonLd) {
    // JSON-LD aggregateRating — most reliable
    if (jsonLd?.aggregateRating) {
      return {
        hasReviews: true,
        rating:     String(jsonLd.aggregateRating.ratingValue),
        count:      String(jsonLd.aggregateRating.reviewCount || ''),
      };
    }

    // itemprop attributes (schema.org microdata)
    const ratingValue = $('[itemprop="ratingValue"]').first().attr('content') ||
                        $('[itemprop="ratingValue"]').first().text().trim();
    const reviewCount = $('[itemprop="reviewCount"]').first().attr('content') ||
                        $('[itemprop="reviewCount"]').first().text().trim();

    if (ratingValue) {
      return { hasReviews: true, rating: ratingValue, count: reviewCount || null };
    }

    // Third-party review widgets
    const ratingEl = $(
      '.jdgm-prev-badge__stars, .loox-rating, .spr-badge-starrating, ' +
      '.yotpo-stars, .stamped-badge, [data-rating], ' +
      '[class*="star-rating"], [class*="StarRating"], ' +
      '[class*="review-stars"], [class*="rating"]'
    ).first();

    const ratingText = ratingEl.attr('data-rating') ||
                       ratingEl.attr('title') ||
                       ratingEl.attr('content') ||
                       ratingEl.text().trim() || null;

    const countEl = $(
      '.jdgm-prev-badge__text, .spr-badge-caption, .yotpo-reviews-count, ' +
      '.stamped-badge-caption, .reviews-widget__count, ' +
      '#shopify-product-reviews .spr-summary-caption, ' +
      '[class*="review-count"], [class*="reviewCount"]'
    ).first();
    const countText = countEl.text().replace(/[^0-9]/g, '') || null;

    // Check presence of review containers
    const hasReviewContainer = $(
      '#shopify-product-reviews, .jdgm-widget, .loox-ratings-widget, ' +
      '.stamped-io, .yotpo-widget-instance, .reviews-widget, ' +
      '[data-product-reviews], .spr-container, ' +
      '[class*="review-section"], [class*="reviews-section"]'
    ).length > 0;

    return {
      hasReviews: !!(ratingText || countText || hasReviewContainer),
      rating:     ratingText,
      count:      countText,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // Description
  // ─────────────────────────────────────────────────────────────────
  static _extractDescription($, jsonLd) {
    if (jsonLd?.description) return jsonLd.description.replace(/\s+/g, ' ').trim().slice(0, 500);

    const selectors = [
      '.product__description', '.product-single__description',
      '.product-description', '[itemprop="description"]',
      '[class*="product-desc"]', '.rte',
    ];
    for (const sel of selectors) {
      const text = $(sel).first().text().replace(/\s+/g, ' ').trim();
      if (text) return text.slice(0, 500);
    }
    return null;
  }

  // ─────────────────────────────────────────────────────────────────
  // Shipping / Return Policy
  // ─────────────────────────────────────────────────────────────────
  static _extractPolicy($, keywords) {
    const selectors = [
      '.accordion', '.collapsible', '.tab-content',
      '.product-details', '.product__description',
      '[class*="tab"]', '[class*="accordion"]',
      '.product__policies', '[class*="policy"]',
      '[class*="delivery"]', '[class*="shipping"]',
    ].join(', ');

    let found = false;
    $(selectors).each((_, el) => {
      if (found) return;
      const text = $(el).text().toLowerCase();
      if (keywords.some(kw => text.includes(kw))) found = true;
    });
    return found;
  }

  // ─────────────────────────────────────────────────────────────────
  // Add To Cart
  // ─────────────────────────────────────────────────────────────────
  static _hasAddToCart($) {
    if ($('form[action*="/cart/add"] button[type="submit"], form[action*="/cart/add"] input[type="submit"]').length > 0) return true;
    // Text-based fallback
    let found = false;
    $('button, input[type="submit"]').each((_, el) => {
      const txt = $(el).text().toLowerCase().trim();
      if (txt.includes('add to cart') || txt.includes('add to bag') || txt === 'add') {
        found = true; return false;
      }
    });
    return found;
  }

  // ─────────────────────────────────────────────────────────────────
  // Buy Now / Dynamic Checkout Button
  // ─────────────────────────────────────────────────────────────────
  static _hasBuyNow($) {
    if ($('.shopify-payment-button, .shopify-payment-button__button').length > 0) return true;
    if ($('button[name="checkout"], input[name="checkout"]').length > 0) return true;
    if ($('[data-testid="Checkout-button"]').length > 0) return true;
    if ($('[data-shopify="payment-button"]').length > 0) return true;

    let found = false;
    $('button, a.btn, a.button, a[class*="btn"], a[class*="button"]').each((_, el) => {
      const txt = $(el).text().toLowerCase().trim();
      if (txt === 'buy now' || txt === 'buy it now' || txt === 'checkout now' || txt === 'buy') {
        found = true; return false;
      }
    });
    return found;
  }

  // ─────────────────────────────────────────────────────────────────
  // Sticky Add to Cart
  // ─────────────────────────────────────────────────────────────────
  static _hasStickyAddToCart($) {
    return $(
      '[class*="sticky-add-to-cart"], [class*="sticky-cart"], ' +
      '[class*="sticky-atc"], [class*="sticky"][class*="atc"], ' +
      '[id*="sticky-cart"], [id*="sticky-atc"], ' +
      '[data-sticky-atc], .product-sticky-form, ' +
      '.sticky-product-bar, .sticky-add-to-cart-bar, ' +
      '[class*="sticky-product"], [class*="StickyATC"]'
    ).length > 0;
  }

  // ─────────────────────────────────────────────────────────────────
  // Payment Icons
  // ─────────────────────────────────────────────────────────────────
  static _extractPaymentIcons($) {
    const icons = [];
    $('svg.icon--payment, img[alt*="payment" i], .payment-icons img, ul.payment-icons svg, [class*="payment-icon"]').each((_, el) => {
      const type = $(el).attr('alt') || $(el).attr('class') || 'payment-icon';
      icons.push(type.replace('icon icon--', '').trim());
    });
    return [...new Set(icons)];
  }

  // ─────────────────────────────────────────────────────────────────
  // Trust Badges
  // ─────────────────────────────────────────────────────────────────
  static _extractTrustBadges($) {
    const trustKeywords = [
      'secure', 'guarantee', 'trust', 'warranty', 'ssl',
      'certified', 'verified', 'money-back', 'moneyback', 'free-return',
      'safe', 'protected',
    ];
    const badges = [];

    $('img').each((_, el) => {
      const alt = ($(el).attr('alt') || '').toLowerCase();
      const src = ($(el).attr('src') || $(el).attr('data-src') || '').toLowerCase();
      if (trustKeywords.some(kw => alt.includes(kw) || src.includes(kw))) {
        badges.push({ imageUrl: $(el).attr('src') || $(el).attr('data-src'), alt: $(el).attr('alt') || null });
      }
    });

    // Text-based trust signals
    $('[class*="trust"], [class*="badge"], [class*="secure"], [class*="guarantee"]').each((_, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (text && text.length < 100) badges.push({ text, imageUrl: null, alt: null });
    });

    return badges;
  }

  // ─────────────────────────────────────────────────────────────────
  // Related Products
  // ─────────────────────────────────────────────────────────────────
  static _extractRelatedProducts($) {
    const relatedSection = $(
      '.product-recommendations, [data-product-recommendations], #product-recommendations, ' +
      '[class*="related-products"], [class*="recently-viewed"], ' +
      '[class*="you-may-also"], [class*="frequently-bought"]'
    );

    if (relatedSection.length > 0) {
      const visibleProducts = relatedSection.find(
        '.product-card, .grid-view-item, [class*="product-card"], [data-product-id]'
      ).length;
      return {
        exists: true,
        type: 'shopify-recommendations',
        visibleCount: visibleProducts || 'Loaded via AJAX',
      };
    }
    return { exists: false };
  }
}
