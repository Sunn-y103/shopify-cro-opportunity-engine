import express from 'express';
import { AnalyzeController } from '../controllers/analyze.controller.js';

const router = express.Router();

/**
 * POST /api/analyze
 * Accepts a single store URL, crawls it, and runs AI CRO analysis.
 * Body: { url: string }
 */
router.post('/analyze', AnalyzeController.analyzeStore);

/**
 * POST /api/compare
 * Accepts two store URLs, crawls both, and runs AI competitor comparison.
 * Body: { urlA: string, urlB: string }
 */
router.post('/compare', AnalyzeController.compareStores);

/**
 * POST /api/ab-test
 * Accepts an array of CRO opportunities and generates A/B test experiment briefs.
 * Body: { opportunities: Array }
 */
router.post('/ab-test', AnalyzeController.generateAbTests);

export default router;
