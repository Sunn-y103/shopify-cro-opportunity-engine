import { StoreScraperService } from '../services/store-scraper.service.js';
import { AiAnalyzerService } from '../services/ai-analyzer.service.js';
import { CompetitorAnalyzerService } from '../services/competitor-analyzer.service.js';
import { AbTestGeneratorService } from '../services/ab-test-generator.service.js';
import { resolveErrorStatus } from '../utils/errorHandler.util.js';

export class AnalyzeController {

  static async analyzeStore(req, res) {
    const { url } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ success: false, error: 'A valid "url" string is required.' });
    }

    const startTime = Date.now();

    try {
      // 1. Scrape the store
      const storeData = await StoreScraperService.scrape(url);

      const quality = storeData.extractionQuality;
      const isShopify = storeData.isShopify;

      let report;

      // 2. Perform validation checks
      if (!isShopify || quality.score < 60) {
        console.warn(`[POST /analyze] Store is unsupported or poor quality: Shopify=${isShopify}, Quality=${quality.score}%`);
        report = {
          executiveSummary: "This website could not be reliably analyzed because insufficient structured evidence was extracted.",
          croScore: storeData.croScore || 0,
          scoreBreakdown: storeData.scoreBreakdown || null,
          analysis: {
            homepage: `What was detected: ${quality.detected.join(', ') || 'None'}. What could not be analyzed: ${quality.missing.join(', ') || 'None'}. Confidence: Low.`,
            collections: "Not analyzed due to insufficient data or non-Shopify platform.",
            pdp: "Not analyzed due to insufficient data or non-Shopify platform.",
            cart: "Not analyzed due to insufficient data or non-Shopify platform.",
            trust: "Not analyzed due to insufficient data or non-Shopify platform."
          },
          opportunities: [],
          quickWins: [],
          highImpactProjects: [],
          warnings: [`This website could not be reliably analyzed because it is either not a Shopify store or has low extraction quality (${quality.score}%).`],
          shopifyDetection: storeData.shopifyDetection,
          extractionQuality: quality,
          diagnostics: storeData.diagnostics
        };
      } else {
        // Run AI analysis on the scraped data
        report = await AiAnalyzerService.analyze(storeData);

        // Overwrite / inject programmatic score & breakdown
        report.croScore = storeData.croScore;
        report.scoreBreakdown = storeData.scoreBreakdown;
        report.shopifyDetection = storeData.shopifyDetection;
        report.extractionQuality = quality;
        report.diagnostics = storeData.diagnostics;
        report.warnings = [];
      }

      // 3. Attach metadata
      report.storeUrl = storeData.storeUrl;
      report.isShopify = storeData.isShopify;
      report.platformConfidence = storeData.platformConfidence;
      report.platformEvidence = storeData.platformEvidence;
      report.scrapingErrors = storeData.errors || [];

      const elapsed = Date.now() - startTime;

      // Log diagnostic audit summary
      console.log('\n========== POST /analyze DIAGNOSTIC LOG ==========');
      console.log(`URL Checked        : ${url}`);
      console.log(`Shopify Detected   : ${report.isShopify} (Confidence: ${report.shopifyDetection?.confidence})`);
      console.log(`Extraction Quality : ${report.extractionQuality?.score}%`);
      console.log(`Pages Crawled      : ${report.diagnostics?.pagesCrawled?.length ?? 0} pages`);
      console.log(`Features Detected  : ${report.extractionQuality?.detected?.join(', ') || 'None'}`);
      console.log(`Features Missing   : ${report.extractionQuality?.missing?.join(', ') || 'None'}`);
      console.log(`CRO Score          : ${report.croScore}/100`);
      console.log(`Total Time Elapsed : ${elapsed} ms`);
      console.log('==================================================\n');

      return res.status(200).json({ success: true, report });

    } catch (error) {
      console.error('[POST /analyze] Error:', error.message);
      const status = resolveErrorStatus(error.message);
      return res.status(status).json({ success: false, error: error.message });
    }
  }

  static async compareStores(req, res) {
    const { urlA, urlB } = req.body;

    if (!urlA || !urlB || typeof urlA !== 'string' || typeof urlB !== 'string') {
      return res.status(400).json({ success: false, error: 'Valid "urlA" and "urlB" string fields are required.' });
    }

    try {
      const comparisonReport = await CompetitorAnalyzerService.compare(urlA, urlB);
      return res.status(200).json({ success: true, report: comparisonReport });

    } catch (error) {
      console.error('[POST /compare] Error:', error.message);
      const status = resolveErrorStatus(error.message);
      return res.status(status).json({ success: false, error: error.message });
    }
  }

  static async generateAbTests(req, res) {
    const { opportunities } = req.body;

    if (!opportunities || !Array.isArray(opportunities) || opportunities.length === 0) {
      return res.status(400).json({ success: false, error: 'A non-empty "opportunities" array is required.' });
    }

    try {
      const briefs = await AbTestGeneratorService.generate(opportunities);
      return res.status(200).json({ success: true, briefs });

    } catch (error) {
      console.error('[POST /ab-test] Error:', error.message);
      const status = resolveErrorStatus(error.message);
      return res.status(status).json({ success: false, error: error.message });
    }
  }
}
