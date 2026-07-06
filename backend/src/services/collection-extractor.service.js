import { CrawlerService } from './crawler.service.js';

/**
 * CollectionExtractorService
 *
 * Discovery strategy (in order):
 *   1. Shopify JSON API  — /collections.json?limit=250  (most reliable)
 *   2. /collections/all  — HTML page with all products listed
 *   3. Homepage link scan — /collections/* anchors on homepage
 *
 * For each discovered collection, we crawl the HTML page to extract:
 *   filters, sort options, pagination, product list, product count.
 */
export class CollectionExtractorService {
  static async extract(baseUrl) {
    try {
      // Step 1: Try the Shopify JSON API to discover all collections
      const apiCollections = await this._discoverViaApi(baseUrl);

      let collectionUrls = [];

      if (apiCollections.length > 0) {
        console.log(`[Collections] JSON API returned ${apiCollections.length} collections`);
        // Pick up to 1 non-trivial collection to stay under memory limits
        collectionUrls = apiCollections
          .filter(c => c.handle && c.handle !== 'frontpage')
          .slice(0, 1)
          .map(c => new URL(`/collections/${c.handle}`, baseUrl).href);
      } else {
        // Step 2: Try Sitemap-based discovery (works great for headless/SPAs)
        console.log('[Collections] JSON API unavailable, checking sitemap.xml...');
        const sitemapData = await CrawlerService.crawlSitemap(baseUrl);
        if (sitemapData.collections && sitemapData.collections.length > 0) {
          console.log(`[Collections] Sitemap discovered ${sitemapData.collections.length} collections`);
          collectionUrls = sitemapData.collections.slice(0, 1);
        } else {
          // Step 3: Fall back to HTML-based discovery
          console.log('[Collections] Sitemap empty, falling back to HTML homepage discovery');
          collectionUrls = await this._discoverViaHtml(baseUrl);
        }
      }

      if (collectionUrls.length === 0) {
        // Step 4: Try /collections/all as a last resort
        collectionUrls = [new URL('/collections/all', baseUrl).href];
        console.log('[Collections] Trying /collections/all as fallback');
      }

      const extractedCollections = [];

      for (const url of collectionUrls) {
        try {
          let crawlData = await CrawlerService.crawl(url);
          const data = this._extractCollectionData(crawlData.$, url, apiCollections);
          extractedCollections.push(data);
          
          // Clear memory
          crawlData = null;
        } catch (err) {
          console.warn(`[Collections] Failed to crawl ${url}: ${err.message}`);
        }
      }

      return extractedCollections;
    } catch (error) {
      throw new Error(`Failed to discover collections on ${baseUrl}: ${error.message}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Shopify JSON API discovery
  // ─────────────────────────────────────────────────────────────────
  static async _discoverViaApi(baseUrl) {
    const apiUrl = new URL('/collections.json?limit=250', baseUrl).href;
    const data   = await CrawlerService.crawlJson(apiUrl);
    return (data?.collections || []);
  }

  // ─────────────────────────────────────────────────────────────────
  // HTML-based collection discovery (fallback)
  // ─────────────────────────────────────────────────────────────────
  static async _discoverViaHtml(baseUrl) {
    const urls = new Set();

    try {
      const { $ } = await CrawlerService.crawl(baseUrl);
      $('a[href*="/collections/"]').each((_, el) => {
        let href = $(el).attr('href');
        if (!href) return;
        href = href.split('?')[0].split('#')[0];
        if (href === '/collections' || href === '/collections/') return;
        try {
          urls.add(new URL(href, baseUrl).href);
        } catch (_) {}
      });
    } catch (_) {}

    return Array.from(urls).slice(0, 1);
  }

  // ─────────────────────────────────────────────────────────────────
  // Extract all data from a single collection page
  // ─────────────────────────────────────────────────────────────────
  static _extractCollectionData($, url, apiCollections = []) {
    // Try to match to API data for extra metadata (products_count)
    const handle    = url.split('/collections/')[1]?.split('?')[0]?.split('/')[0];
    const apiRecord = apiCollections.find(c => c.handle === handle);

    return {
      url,
      handle:       handle || null,
      title:        this._extractTitle($, apiRecord),
      description:  apiRecord?.body_html ? this._stripHtml(apiRecord.body_html) : null,
      productCount: this._extractProductCount($, apiRecord),
      filters:      this._extractFilters($),
      sortingOptions: this._extractSortingOptions($),
      pagination:   this._extractPagination($),
      products:     this._extractProducts($),
    };
  }

  static _stripHtml(html) {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
  }

  // ─────────────────────────────────────────────────────────────────
  // Title
  // ─────────────────────────────────────────────────────────────────
  static _extractTitle($, apiRecord) {
    if (apiRecord?.title) return apiRecord.title;

    const selectors = [
      '.collection-hero__title', '.collection-title',
      '[data-section-type="collection-template"] h1',
      '.page-title', 'h1.title', 'h1',
    ];
    for (const sel of selectors) {
      const text = $(sel).first().text().replace(/\s+/g, ' ').trim();
      if (text) return text;
    }
    return null;
  }

  // ─────────────────────────────────────────────────────────────────
  // Product Count
  // ─────────────────────────────────────────────────────────────────
  static _extractProductCount($, apiRecord) {
    if (apiRecord?.products_count != null) {
      return `${apiRecord.products_count} products`;
    }

    const selectors = [
      '.collection-product-count', '.product-count',
      '#ProductCount', '[data-product-count]',
      '[class*="product-count"]', '[class*="results-count"]',
    ];
    for (const sel of selectors) {
      const text = $(sel).first().text().replace(/\s+/g, ' ').trim();
      if (text) return text;
    }

    // Fallback: count visible product cards
    const cardSelectors = [
      '.product-card', '.grid-view-item', '.product-item',
      '.card--product', '[class*="product-card"]', '[data-product-id]',
      'li[class*="product"]',
    ].join(', ');
    const visual = $(cardSelectors).length;
    return visual > 0 ? `${visual} products (visible)` : null;
  }

  // ─────────────────────────────────────────────────────────────────
  // Filters — extensive selector coverage
  // ─────────────────────────────────────────────────────────────────
  static _extractFilters($) {
    const filters = [];

    const selectors = [
      // Shopify Dawn / OS 2.0
      '.facets__summary', '.facets__heading', '.facets__legend',
      'details[id*="Filter"] summary', 'details[id*="filter"] summary',
      'legend.facets__legend',
      // Classic Shopify themes
      '.filter-group-summary', '.filter-group__summary',
      '.collection-filters__label',
      // Data attributes
      '[data-filter-type]', '[data-filter] label',
      '[data-facets] legend', 'ul[data-filter-group] > li > span',
      // Third-party apps (Boost Commerce, Smart Product Filter)
      '.filter-group label', '.facet-filters__item label',
      'fieldset.js-filter legend', '.filter-option-list__item label',
      // Generic heading inside a filter sidebar
      '[class*="filter"] [class*="heading"]',
      '[class*="filter"] [class*="label"]',
      '[class*="filter"] h3', '[class*="filter"] h4',
      '[class*="sidebar"] h3', '[class*="sidebar"] h4',
      // Accordion-style filter titles
      '[class*="accordion"] [class*="filter"]',
    ].join(', ');

    $(selectors).each((_, el) => {
      const filterName = $(el).text().replace(/\s+/g, ' ').trim();
      if (filterName && filterName.length < 80 && !filters.includes(filterName)) {
        filters.push(filterName);
      }
    });
    return filters;
  }

  // ─────────────────────────────────────────────────────────────────
  // Sorting Options
  // ─────────────────────────────────────────────────────────────────
  static _extractSortingOptions($) {
    const options = [];

    const selectors = [
      // Standard select elements
      'select[name="sort_by"] option', 'select#SortBy option',
      'select.facet-filters__sort option',
      'select[id*="sort" i] option', 'select[id*="Sort"] option',
      '[class*="sort"] select option', '.collection-sort select option',
      '.sort-by select option',
      // Button/link-based sorting (headless themes)
      'button[data-sort]', 'button[data-sort-by]',
      '[data-sort-by]', 'a[data-sort-by]',
      // Text nodes in sort dropdowns
      '[class*="sort"] li', '[class*="sort"] [role="option"]',
    ].join(', ');

    $(selectors).each((_, el) => {
      const sortOption = (
        $(el).text().replace(/\s+/g, ' ').trim() ||
        $(el).attr('data-sort') ||
        $(el).attr('data-sort-by') ||
        $(el).attr('value') ||
        ''
      );
      if (sortOption && sortOption.length < 80 && !options.includes(sortOption)) {
        options.push(sortOption);
      }
    });
    return options;
  }

  // ─────────────────────────────────────────────────────────────────
  // Pagination
  // ─────────────────────────────────────────────────────────────────
  static _extractPagination($) {
    const paginationEl = $('.pagination, nav.pagination, .collection-pagination, [class*="pagination"]');

    if (paginationEl.length === 0) {
      const loadMore = $('[class*="load-more"], [id*="load-more"], button[data-loadmore]');
      if (loadMore.length > 0) return { exists: true, type: 'load_more' };
      return { exists: false };
    }

    const currentPage = paginationEl.find('.pagination__item--current, .current, [aria-current]').text().trim() || '1';
    const pageNumbers = paginationEl.find('.pagination__item, a.page, [class*="page-number"]')
      .map((_, el) => parseInt($(el).text().trim(), 10))
      .get()
      .filter(n => !isNaN(n));
    const totalPages = pageNumbers.length > 0 ? Math.max(...pageNumbers) : null;

    return {
      exists: true,
      type: 'standard',
      currentPage: parseInt(currentPage, 10) || 1,
      totalPages,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // Products visible on the collection page
  // ─────────────────────────────────────────────────────────────────
  static _extractProducts($) {
    const products = [];

    const cardSelectors = [
      '.product-card', '.grid-view-item', '.product-item',
      '.card--product', '[class*="product-card"]', '[class*="ProductCard"]',
      '[data-product-id]', 'li[class*="product"]',
    ].join(', ');

    $(cardSelectors).each((_, el) => {
      const title = $(el).find(
        '.product-card__title, .grid-view-item__title, .product-item__title, .card__heading, h3, h2, [class*="title"]'
      ).first().text().replace(/\s+/g, ' ').trim();

      const linkEl = $(el).find('a[href*="/products/"]').first();
      const url    = linkEl.attr('href') || null;

      const priceText       = $(el).find('.price, .product-price, .money, [class*="price"], bdi').first().text().replace(/\s+/g, ' ').trim();
      const compareAtText   = $(el).find('.price--compare, s, strike, del, [class*="compare"]').first().text().replace(/\s+/g, ' ').trim();
      const saleBadgeText   = $(el).find('.badge--sale, [class*="sale"], [class*="discount"]').first().text().replace(/\s+/g, ' ').trim();

      if (title) {
        products.push({
          title,
          url,
          price:          priceText || null,
          compareAtPrice: compareAtText || null,
          isSale:         !!saleBadgeText || !!compareAtText,
          saleBadgeText:  saleBadgeText || null,
        });
      }
    });

    return products;
  }
}
