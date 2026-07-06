/**
 * HomepageExtractorService
 *
 * Extracts structured data from a Shopify store homepage.
 * Strategy (in priority order for each field):
 *   1. Embedded SPA JSON (Next.js RSC, window.__INITIAL_STATE__, etc.) — for headless stores
 *   2. Schema.org JSON-LD embedded in <script type="application/ld+json">
 *   3. Shopify-specific data-section-type / data-* attributes
 *   4. Common class-name patterns (Shopify default, Dawn, Debut, etc.)
 *   5. Generic semantic fallbacks (first h1, any email form, etc.)
 */
export class HomepageExtractorService {
  static extract($, html = '') {
    const jsonLd   = this._extractJsonLd($);
    const spaData  = this._extractSpaEmbeddedData($, html);

    return {
      storeName:           this._extractStoreName($, jsonLd, spaData),
      meta: {
        title:       this._extractMetaTitle($),
        description: this._extractMetaDescription($),
      },
      hero: {
        heading:    this._extractHeroHeading($, spaData),
        subheading: this._extractHeroSubheading($),
        cta:        this._extractHeroCTA($, spaData),
      },
      announcementBar:     this._extractAnnouncementBar($, spaData),
      featuredCollections: this._extractFeaturedCollections($, spaData),
      featuredProducts:    this._extractFeaturedProducts($),
      navigation:          this._extractNavigation($, spaData),
      footer:              this._extractFooter($),
      newsletter:          this._extractNewsletter($, spaData),
      socialLinks:         this._extractSocialLinks($, jsonLd, spaData),
      trustBadges:         this._extractTrustBadges($),
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // SPA / Headless Store embedded JSON extraction
  // Handles: Next.js App Router (RSC), __NEXT_DATA__, __INITIAL_STATE__,
  //          window.initialData, __PRELOADED_STATE__, etc.
  // ─────────────────────────────────────────────────────────────────
  static _extractSpaEmbeddedData($, html) {
    const data = {};
    if (!html) return data;

    // Cap the total inline-script content we process to 500 KB.
    // Next.js RSC pages can embed several MB of serialised server component
    // payloads across many <script> tags. Running regex passes on a multi-MB
    // string creates multiple large copies on the V8 heap simultaneously.
    // 500 KB is more than enough to capture all meaningful SPA/headless data.
    const MAX_INLINE_BYTES = 500 * 1024; // 500 KB

    let allInlineContent = '';
    if ($) {
      $('script:not([src])').each((_, el) => {
        if (allInlineContent.length >= MAX_INLINE_BYTES) return false; // stop early
        allInlineContent += $(el).html() || '';
      });
      // Enforce hard cap in case the last script pushed us over
      if (allInlineContent.length > MAX_INLINE_BYTES) {
        allInlineContent = allInlineContent.slice(0, MAX_INLINE_BYTES);
      }
    }

    if (!allInlineContent) {
      // Fall back to a capped slice of the raw HTML string
      allInlineContent = html.slice(0, MAX_INLINE_BYTES);
    }

    // Clean up escaping before matching
    let cleaned = allInlineContent
      .replace(/\\\"/g, '"')
      .replace(/\\\\/g, '\\');

    // Release allInlineContent — cleaned is the only copy needed from here
    allInlineContent = null;

    // Next.js App Router RSC payload parsing
    if (cleaned.includes('heroCarouselData') || cleaned.includes('self.__next_f')) {
      // Hero Carousel
      const heroCarouselMatch = cleaned.match(/"heroCarouselData"\s*:\s*(\[.+?\])/s);
      if (heroCarouselMatch) {
        try {
          data.heroCarouselData = JSON.parse(heroCarouselMatch[1]);
        } catch (_) {}
      }

      // Nav Items
      const navMatch = cleaned.match(/"(navItems|navigationData|menuItems)"\s*:\s*(\[.+?\])/s);
      if (navMatch) {
        try {
          const key = navMatch[1];
          data[key] = JSON.parse(navMatch[2]);
        } catch (_) {}
      }

      // Collection names
      const collectionNames = [];
      const collectionNameMatches = cleaned.matchAll(/"collection_name"\s*:\s*"([^"]+)"/g);
      for (const m of collectionNameMatches) {
        if (!collectionNames.includes(m[1])) collectionNames.push(m[1]);
      }
      if (collectionNames.length > 0) data.collectionNames = collectionNames;

      // CTA texts
      const ctaMatches = cleaned.matchAll(/"cta"\s*:\s*"([^"]+)"/g);
      const ctas = [];
      for (const m of ctaMatches) {
        if (m[1] && !ctas.includes(m[1])) ctas.push(m[1]);
      }
      if (ctas.length > 0) data.ctaTexts = ctas;

      // Announcement/Banner texts
      const bannerTitleMatches = cleaned.matchAll(/"(?:title|banner_text|announcement)"\s*:\s*"([^"]{3,100})"/g);
      const bannerTexts = [];
      for (const m of bannerTitleMatches) {
        if (m[1] && !bannerTexts.includes(m[1])) bannerTexts.push(m[1]);
      }
      if (bannerTexts.length > 0) data.bannerTexts = bannerTexts;
    }


    // Pattern 2: window.__INITIAL_STATE__ or window.__PRELOADED_STATE__
    try {
      const stateMatch = cleaned.match(/window\.__(?:INITIAL|PRELOADED|NUXT|APP)_STATE__\s*=\s*({.+?})(?:\s*;|\s*<\/script>)/s);
      if (stateMatch) {
        const parsed = JSON.parse(stateMatch[1]);
        Object.assign(data, { windowState: parsed });
      }
    } catch (_) {}

    // Pattern 3: window.initialData or window.pageData (custom patterns)
    try {
      const initDataMatch = cleaned.match(/window\.(?:initialData|pageData|siteData)\s*=\s*({.+?})(?:\s*;|\s*<\/script>)/s);
      if (initDataMatch) {
        const parsed = JSON.parse(initDataMatch[1]);
        Object.assign(data, { windowInitialData: parsed });
      }
    } catch (_) {}

    // Release cleaned string — all regex work is complete
    cleaned = null;

    return data;
  }

  // ─────────────────────────────────────────────────────────────────
  // JSON-LD helper — parse all embedded structured data blocks

  // ─────────────────────────────────────────────────────────────────
  static _extractJsonLd($) {
    const results = [];
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const raw = $(el).html() || '';
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) results.push(...parsed);
        else results.push(parsed);
      } catch (_) { /* ignore malformed blocks */ }
    });
    return results;
  }

  // ─────────────────────────────────────────────────────────────────
  // Store Name
  // ─────────────────────────────────────────────────────────────────
  static _extractStoreName($, jsonLd = [], spaData = {}) {
    // 1. JSON-LD Organization or WebSite name
    const org = jsonLd.find(d => d['@type'] === 'Organization' || d['@type'] === 'WebSite');
    if (org?.name) return org.name.trim();

    // 2. og:site_name meta tag
    const ogSiteName = $('meta[property="og:site_name"]').attr('content');
    if (ogSiteName) return ogSiteName.trim();

    // 3. Logo alt text in header
    const logoAlt = $('header img').first().attr('alt');
    if (logoAlt && logoAlt.length < 60) return logoAlt.trim();

    // 4. Title tag (strip common suffixes)
    const title = $('title').first().text().trim();
    if (title) return title.split('|')[0].split('–')[0].split('-')[0].trim();

    return null;
  }

  // ─────────────────────────────────────────────────────────────────
  // Meta
  // ─────────────────────────────────────────────────────────────────
  static _extractMetaTitle($) {
    return (
      $('meta[property="og:title"]').attr('content') ||
      $('title').first().text() ||
      ''
    ).trim();
  }

  static _extractMetaDescription($) {
    return (
      $('meta[name="description"]').attr('content') ||
      $('meta[property="og:description"]').attr('content') ||
      ''
    ).trim();
  }

  // ─────────────────────────────────────────────────────────────────
  // Hero Heading — extensive fallbacks for custom themes
  // ─────────────────────────────────────────────────────────────────
  static _extractHeroHeading($, spaData = {}) {
    // 1. SPA embedded data — first hero carousel item's collection_name or banner text
    if (spaData.heroCarouselData && spaData.heroCarouselData.length > 0) {
      const first = spaData.heroCarouselData[0];
      const text = first.collection_name || first.title || first.cta;
      if (text) return text.trim();
    }
    if (spaData.bannerTexts && spaData.bannerTexts.length > 0) {
      return spaData.bannerTexts[0].trim();
    }

    const candidates = [
      // Shopify data-section-type attributes (Dawn, Online Store 2.0)
      '[data-section-type="image-banner"] h1',
      '[data-section-type="hero"] h1',
      '[data-section-type="slideshow"] h1',
      '[data-section-type="image-banner"] h2',
      '[data-section-type="hero"] h2',
      // Generic class patterns
      '.hero h1', '.hero-banner h1', '[class*="hero"] h1',
      '.banner h1', '.banner__heading', '.image-banner h1',
      '.slide h1', '.slider h1', '[class*="slide"] h1',
      // Section-level heading
      'section:first-of-type h1', 'section:first-of-type h2',
      // Last resort — first h1/h2 anywhere
      'h1', 'h2',
    ];

    for (const selector of candidates) {
      const text = $(selector).first().text().replace(/\s+/g, ' ').trim();
      if (text && text.length > 2 && text.length < 200) return text;
    }
    return null;
  }

  // ─────────────────────────────────────────────────────────────────
  // Hero Subheading
  // ─────────────────────────────────────────────────────────────────
  static _extractHeroSubheading($) {
    const candidates = [
      '[data-section-type="image-banner"] p',
      '[data-section-type="image-banner"] h2',
      '[data-section-type="hero"] p',
      '.hero p', '.hero-banner p', '[class*="hero"] p',
      '.banner__subheading', '[class*="subtitle"]',
      '[class*="hero"] .rte',
    ];

    for (const selector of candidates) {
      const text = $(selector).first().text().replace(/\s+/g, ' ').trim();
      if (text && text.length > 2 && text.length < 300) return text;
    }
    return null;
  }

  // ─────────────────────────────────────────────────────────────────
  // Hero CTA
  // ─────────────────────────────────────────────────────────────────
  static _extractHeroCTA($, spaData = {}) {
    // 1. SPA data — first CTA text from hero carousel
    if (spaData.heroCarouselData && spaData.heroCarouselData.length > 0) {
      const first = spaData.heroCarouselData.find(h => h.cta);
      if (first?.cta) return { text: first.cta.trim(), url: null };
    }
    if (spaData.ctaTexts && spaData.ctaTexts.length > 0) {
      return { text: spaData.ctaTexts[0].trim(), url: null };
    }

    // Ordered from most specific to least specific
    const sectionSelectors = [
      '[data-section-type="image-banner"]',
      '[data-section-type="hero"]',
      '[data-section-type="slideshow"]',
      '.hero', '.hero-banner', '[class*="hero"]',
      '.banner', '.image-banner', 'section:first-of-type',
    ];

    for (const sectionSel of sectionSelectors) {
      const section = $(sectionSel).first();
      if (section.length === 0) continue;

      // Try button/link with a clear CTA class
      const ctaEl = section.find('a.btn, a.button, a[class*="btn"], a[class*="button"], button.btn, button[class*="btn"]').first();
      if (ctaEl.length > 0) {
        return {
          text: ctaEl.text().replace(/\s+/g, ' ').trim(),
          url:  ctaEl.attr('href') || null,
        };
      }
      // Fallback — any <a> in this section with short text
      const anyLink = section.find('a').filter((_, el) => {
        const txt = $(el).text().trim();
        return txt.length > 1 && txt.length < 50;
      }).first();
      if (anyLink.length > 0) {
        return {
          text: anyLink.text().replace(/\s+/g, ' ').trim(),
          url:  anyLink.attr('href') || null,
        };
      }
    }
    return null;
  }

  // ─────────────────────────────────────────────────────────────────
  // Announcement Bar
  // ─────────────────────────────────────────────────────────────────
  static _extractAnnouncementBar($, spaData = {}) {
    // 1. SPA embedded data — banner/announcement text
    if (spaData.bannerTexts && spaData.bannerTexts.length > 0) {
      // Look for specifically announcement-like texts (short, promotional)
      const announcementText = spaData.bannerTexts.find(t => t.length < 120);
      if (announcementText) return announcementText;
    }

    const selectors = [
      // Shopify data-section-type (Dawn, Debut)
      '[data-section-type="announcement-bar"]',
      // Class patterns
      '.announcement-bar', '#announcement-bar',
      '[class*="announcement"]', '[class*="promo-bar"]',
      '[class*="top-bar"]', '[class*="topbar"]',
      '[class*="marquee"]', '[id*="announcement"]',
      // Common header strips
      'header > [class*="bar"]', 'header > [class*="strip"]',
    ];

    for (const selector of selectors) {
      const el = $(selector).first();
      if (el.length > 0) {
        const text = el.text().replace(/\s+/g, ' ').trim();
        if (text && text.length > 2) return text;
      }
    }
    return null;
  }

  // ─────────────────────────────────────────────────────────────────
  // Featured Collections
  // ─────────────────────────────────────────────────────────────────
  static _extractFeaturedCollections($, spaData = {}) {
    const collections = [];
    const seenUrls = new Set();
    const seenTitles = new Set();

    // 1. SPA data — collection names from RSC payload (headless Shopify stores)
    if (spaData.collectionNames && spaData.collectionNames.length > 0) {
      for (const name of spaData.collectionNames) {
        if (!seenTitles.has(name)) {
          collections.push({ title: name, url: null, imageUrl: null, fromSpa: true });
          seenTitles.add(name);
        }
      }
    }

    // 2. First pass: all anchors pointing to /collections/*
    $('a[href*="/collections/"]').each((_, el) => {
      let href = $(el).attr('href') || '';
      href = href.split('?')[0].split('#')[0];

      // Skip root /collections and /collections/all (too generic)
      if (!href || href === '/collections' || href === '/collections/' || href === '/collections/all') return;
      if (seenUrls.has(href)) return;

      const text = $(el).text().replace(/\s+/g, ' ').trim();
      const img  = $(el).find('img').attr('src') || $(el).find('img').attr('data-src');

      let title = text;
      if (!title) {
        const card = $(el).closest('[class*="collection"]');
        title = card.find('h2, h3, h4, [class*="title"]').first().text().replace(/\s+/g, ' ').trim();
      }

      if (title && href) {
        collections.push({ title, url: href, imageUrl: img || null });
        seenUrls.add(href);
      }
    });

    // 3. data-section-type="featured-collection" sections
    $('[data-section-type="featured-collection"], [data-section-type="collection-list"]').each((_, el) => {
      const href = $(el).find('a[href*="/collections/"]').first().attr('href');
      const title = $(el).find('h2, h3, [class*="title"]').first().text().replace(/\s+/g, ' ').trim();
      if (href && title && !seenUrls.has(href)) {
        collections.push({ title, url: href, imageUrl: null });
        seenUrls.add(href);
      }
    });

    return collections.slice(0, 15);
  }

  // ─────────────────────────────────────────────────────────────────
  // Featured Products (on homepage)
  // ─────────────────────────────────────────────────────────────────
  static _extractFeaturedProducts($) {
    const products = [];
    const seenUrls = new Set();

    const cardSelectors = [
      '.product-card', '.grid-view-item', '.product-item',
      '.card--product', '[class*="product-card"]', '[class*="ProductCard"]',
      '[data-product-id]', 'li[class*="product"]',
    ].join(', ');

    $(cardSelectors).each((_, el) => {
      const linkEl = $(el).find('a[href*="/products/"]').first();
      const url    = linkEl.attr('href');
      if (!url || seenUrls.has(url)) return;

      const title = $(el).find(
        '.product-card__title, .grid-view-item__title, .product-item__title, .card__heading, h3, h2, [class*="title"]'
      ).first().text().replace(/\s+/g, ' ').trim();

      const price = $(el).find('.price, .product-price, .money, [class*="price"]').first().text().replace(/\s+/g, ' ').trim();
      const img   = $(el).find('img').first().attr('src') || $(el).find('img').first().attr('data-src');

      if (title) {
        products.push({ title, price: price || null, url, imageUrl: img || null });
        seenUrls.add(url);
      }
    });

    return products.slice(0, 20);
  }

  // ─────────────────────────────────────────────────────────────────
  // Navigation
  // ─────────────────────────────────────────────────────────────────
  static _extractNavigation($, spaData = {}) {
    const navLinks = [];
    const seenUrls = new Set();

    // 1. SPA embedded nav data
    const spaNavItems = spaData.navItems || spaData.navigationData || spaData.menuItems || [];
    if (Array.isArray(spaNavItems)) {
      for (const item of spaNavItems) {
        const text = item.label || item.title || item.name || item.text || '';
        const url  = item.url || item.href || item.path || '';
        if (text && url && !seenUrls.has(url)) {
          navLinks.push({ text, url });
          seenUrls.add(url);
        }
      }
    }

    // 2. HTML navigation
    $('header nav a, .site-nav a, .header__inline-menu a, nav[role="navigation"] a, [class*="nav"] a').each((_, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      const url  = $(el).attr('href');
      if (text && url && !seenUrls.has(url) && text.length < 60) {
        navLinks.push({ text, url });
        seenUrls.add(url);
      }
    });

    return navLinks;
  }

  // ─────────────────────────────────────────────────────────────────
  // Footer
  // ─────────────────────────────────────────────────────────────────
  static _extractFooter($) {
    const footerLinks = [];
    $('footer a, .site-footer a, [class*="footer"] a').each((_, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      const url  = $(el).attr('href');
      if (text && url) footerLinks.push({ text, url });
    });
    return footerLinks;
  }

  // ─────────────────────────────────────────────────────────────────
  // Newsletter
  // ─────────────────────────────────────────────────────────────────
  static _extractNewsletter($, spaData = {}) {
    // Any form containing an email input field
    const emailInput = $('input[type="email"], input[name*="email" i], input[placeholder*="email" i]').first();
    const form       = emailInput.closest('form');
    const hasForm    = form.length > 0 || emailInput.length > 0;

    // Newsletter section detection via data attributes
    const sectionExists = $('[data-section-type="email-signup"], [class*="newsletter"], [id*="newsletter"]').length > 0;

    // Check SPA embedded data for newsletter/subscribe flags
    const spaHasNewsletter = !!(spaData.windowState?.newsletter ||
                                 spaData.windowInitialData?.newsletter ||
                                 spaData.windowState?.subscribe);

    const exists = hasForm || sectionExists || spaHasNewsletter;

    let hasIncentive = false;
    if (exists) {
      const container = form.length > 0
        ? form.parent()
        : $('[class*="newsletter"], [id*="newsletter"]').first();
      const text = container.text().toLowerCase();
      hasIncentive = text.includes('discount') || text.includes('% off') ||
                     text.includes('free') || text.includes('exclusive') ||
                     text.includes('save') || text.includes('gift');
    }

    return { exists, hasIncentive };
  }

  // ─────────────────────────────────────────────────────────────────
  // Social Links
  // ─────────────────────────────────────────────────────────────────
  static _extractSocialLinks($, jsonLd = [], spaData = {}) {
    const socialNetworks = ['facebook', 'instagram', 'twitter', 'tiktok', 'youtube', 'pinterest', 'snapchat', 'linkedin'];
    const links = {};

    // 1. JSON-LD Organization sameAs (most reliable for standard Shopify)
    const org = jsonLd.find(d => d['@type'] === 'Organization');
    if (org?.sameAs) {
      const sameAs = Array.isArray(org.sameAs) ? org.sameAs : [org.sameAs];
      for (const url of sameAs) {
        for (const network of socialNetworks) {
          if (url.includes(`${network}.com`) && !links[network]) {
            links[network] = url;
          }
        }
      }
    }

    // 2. All <a> tags (covers most themes)
    $('a[href]').each((_, el) => {
      const url = $(el).attr('href') || '';
      for (const network of socialNetworks) {
        if (!links[network] && url.includes(`${network}.com`)) {
          links[network] = url;
        }
      }
    });

    // 3. Social icon containers (SVG-based themes)
    $('[class*="social"] a, [data-social] a, footer [class*="icon"] a').each((_, el) => {
      const url  = $(el).attr('href') || '';
      const aria = ($(el).attr('aria-label') || '').toLowerCase();
      for (const network of socialNetworks) {
        if (!links[network] && (url.includes(network) || aria.includes(network))) {
          links[network] = url;
        }
      }
    });

    // 4. SPA window state may contain social links
    const windowSocial = spaData.windowState?.social || spaData.windowInitialData?.social || {};
    for (const [network, url] of Object.entries(windowSocial)) {
      const lowerNetwork = network.toLowerCase();
      if (socialNetworks.includes(lowerNetwork) && !links[lowerNetwork]) {
        links[lowerNetwork] = url;
      }
    }

    return links;
  }

  // ─────────────────────────────────────────────────────────────────
  // Trust Badges
  // ─────────────────────────────────────────────────────────────────
  static _extractTrustBadges($) {
    const trustKeywords = [
      'secure', 'guarantee', 'payment', 'ssl', 'visa', 'mastercard',
      'paypal', 'shop pay', 'trust', 'money-back', 'free return',
      'money back', 'certified', 'verified', '100%',
    ];
    const badges = [];
    const seenSrcs = new Set();

    // 1. Images with trust-related alt text or filename
    $('img').each((_, el) => {
      const alt = ($(el).attr('alt') || '').toLowerCase();
      const src = ($(el).attr('src') || $(el).attr('data-src') || '').toLowerCase();

      if (seenSrcs.has(src)) return;

      const isTrustBadge = trustKeywords.some(kw => alt.includes(kw) || src.includes(kw));
      if (isTrustBadge) {
        badges.push({ imageUrl: $(el).attr('src') || $(el).attr('data-src'), alt: $(el).attr('alt') || null });
        seenSrcs.add(src);
      }
    });

    // 2. Trust-related text blocks (not image-based)
    $('[class*="trust"], [class*="badge"], [class*="secure"], [class*="guarantee"]').each((_, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (text && text.length < 100) {
        badges.push({ text, imageUrl: null, alt: null });
      }
    });

    return badges;
  }
}
