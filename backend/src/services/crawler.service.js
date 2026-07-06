import axios from 'axios';
import * as cheerio from 'cheerio';

export class CrawlerError extends Error {
  constructor(message, statusCode, originalError) {
    super(message);
    this.name = 'CrawlerError';
    this.statusCode = statusCode;
    this.originalError = originalError;
  }
}

// Shared Axios default options for all requests
const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
};

export class CrawlerService {
  /**
   * Fetches HTML from a given URL and parses it using Cheerio.
   *
   * @param {string} url - The URL to crawl.
   * @param {object} options - Optional configurations for Axios.
   * @returns {Promise<{ html: string, $: cheerio.Root, responseUrl: string }>}
   *          The raw HTML, the Cheerio instance, and the final URL (handling redirects).
   * @throws {CrawlerError} Throws if the URL is invalid or the network request fails.
   */
  static async crawl(url, options = {}) {
    this._validateUrl(url);

    const axiosOptions = {
      headers: { ...DEFAULT_HEADERS },
      timeout: 15000, // 15 seconds max (reduced for safety)
      maxRedirects: 5,
      ...options,
    };

    // One retry on network failure
    let lastError;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await axios.get(url, axiosOptions);

        // Verify we received HTML
        const contentType = response.headers['content-type'] || '';
        if (!contentType.includes('text/html')) {
          throw new Error(`Expected text/html but received ${contentType}`);
        }

        let html = response.data;
        
        // Memory optimization: Trim massive tags before parsing with Cheerio
        html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
        html = html.replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '');
        html = html.replace(/<!--[\s\S]*?-->/g, '');

        const $ = cheerio.load(html);

        // Return the final redirected URL, or fallback to the provided URL
        const responseUrl = response.request?.res?.responseUrl || url;

        return { html, $, responseUrl };
      } catch (error) {
        lastError = error;
        if (attempt === 0 && axios.isAxiosError(error) && !error.response) {
          // Only retry on network-level errors (no response received), not 4xx/5xx
          await new Promise(resolve => setTimeout(resolve, 1500));
          continue;
        }
        break;
      }
    }

    this._handleCrawlerError(url, lastError);
  }

  /**
   * Fetches a Shopify JSON API endpoint and returns the parsed JSON.
   * Shopify stores expose machine-readable data at endpoints like:
   *   /products.json, /collections.json, /collections/<handle>/products.json
   *
   * @param {string} url - The full URL of the JSON endpoint.
   * @returns {Promise<object|null>} Parsed JSON object, or null if unavailable.
   */
  static async crawlJson(url) {
    this._validateUrl(url);

    try {
      const response = await axios.get(url, {
        headers: {
          ...DEFAULT_HEADERS,
          'Accept': 'application/json, text/javascript, */*',
        },
        timeout: 10000, // 10 seconds max
        maxRedirects: 5,
      });

      const contentType = response.headers['content-type'] || '';
      // Accept both application/json and text/html (some stores serve JSON with wrong content-type)
      if (typeof response.data === 'object') {
        return response.data;
      }
      if (typeof response.data === 'string') {
        return JSON.parse(response.data);
      }
      return null;
    } catch (_error) {
      // JSON API endpoints are optional; silently return null on failure
      return null;
    }
  }

  /**
   * Discovers product and collection URLs from a store's sitemap.xml.
   * Supports standard Shopify sitemaps, headless Next.js, and custom SPAs.
   *
   * @param {string} baseUrl - Base URL of the store.
   * @returns {Promise<{ collections: string[], products: string[] }>} Lists of discovered URLs.
   */
  static async crawlSitemap(baseUrl) {
    const collections = new Set();
    const products = new Set();

    try {
      const sitemapUrl = new URL('/sitemap.xml', baseUrl).href;
      const response = await axios.get(sitemapUrl, {
        headers: { ...DEFAULT_HEADERS, 'Accept': 'application/xml, text/xml, */*' },
        timeout: 10000,
      });
      const sitemapHtml = String(response.data);

      // Check if it's a sitemap index containing other sitemaps
      const subSitemaps = sitemapHtml.match(/<loc>(https?:\/\/[^<]+sitemap[^<]+)<\/loc>/g) || [];
      const urlsToCrawl = subSitemaps.map(m => m.replace('<loc>', '').replace('</loc>', '').trim());

      if (urlsToCrawl.length > 0) {
        // Crawl up to 6 key sub-sitemaps (focus on products/collections/categories)
        const relevantSitemaps = urlsToCrawl.filter(u => 
          u.includes('product') || u.includes('collection') || u.includes('category')
        );
        const crawlList = relevantSitemaps.length > 0 ? relevantSitemaps : urlsToCrawl;

        for (const subUrl of crawlList.slice(0, 2)) {
          try {
            const subResponse = await axios.get(subUrl, {
              headers: { ...DEFAULT_HEADERS, 'Accept': 'application/xml, text/xml, */*' },
              timeout: 10000,
            });
            this._extractUrlsFromXml(String(subResponse.data), collections, products);
          } catch (_) {
            // Ignore sub-sitemap failures
          }
        }
      } else {
        // Flat sitemap
        this._extractUrlsFromXml(sitemapHtml, collections, products);
      }
    } catch (_) {
      // Main sitemap failed, return empty lists
    }

    return {
      collections: Array.from(collections),
      products: Array.from(products),
    };
  }

  static _extractUrlsFromXml(xmlText, collections, products) {
    const matches = xmlText.match(/<loc>(https?:\/\/[^<]+)<\/loc>/g) || [];
    for (const m of matches) {
      const url = m.replace('<loc>', '').replace('</loc>', '').trim();

      // Product patterns
      if (
        url.includes('/products/') ||
        url.includes('/product/') ||
        /\/products\/[a-z0-9-]+/i.test(url) ||
        /\/[0-9]+\/buy$/i.test(url)
      ) {
        products.add(url);
      }
      // Collection patterns
      else if (
        url.includes('/collections/') ||
        url.includes('/explore/') ||
        url.includes('/men/') ||
        url.includes('/women/') ||
        url.endsWith('/buy')
      ) {
        collections.add(url);
      }
    }
  }

  static _validateUrl(urlString) {
    try {
      const parsedUrl = new URL(urlString);
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        throw new Error('Only HTTP and HTTPS protocols are supported.');
      }
    } catch (error) {
      throw new CrawlerError(`Invalid URL provided: ${urlString}`, 400, error);
    }
  }

  static _handleCrawlerError(url, error) {
    let message = `Failed to crawl URL: ${url}`;
    let statusCode = 500;

    if (axios.isAxiosError(error)) {
      if (error.response) {
        statusCode = error.response.status;
        message = `Server responded with status ${statusCode}: ${error.response.statusText}`;
      } else if (error.request) {
        message = 'No response received from the server (network error or timeout).';
      } else {
        message = error.message;
      }
    } else {
      message = error.message;
      statusCode = 400;
    }

    throw new CrawlerError(message, statusCode, error);
  }
}
