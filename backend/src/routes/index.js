import express from 'express';
import analyzeRoutes from './analyze.js';

const router = express.Router();

// Base API Route
router.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Shopify CRO API' });
});

// Analysis routes: /api/analyze, /api/compare, /api/ab-test
router.use('/', analyzeRoutes);

export default router;
