import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Security Middlewares (Vite-compatible CSP)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // Required for Vite/React runtime
        styleSrc: ["'self'", "'unsafe-inline'"],  // Required for Tailwind/Vite injected styles
        imgSrc: ["'self'", "data:", "https:"],    // Allow external images (CRO engine)
        connectSrc: ["'self'", "https:"],         // Allow API requests
        fontSrc: ["'self'", "https:", "data:"],   // Allow external fonts
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
  })
);
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*', // Restrict this in production
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Performance Middlewares
app.use(compression());

// Logging Middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Parsing Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is healthy 🚀',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api', routes);

// Handle 404 for API routes natively before static serving
app.use('/api', notFoundHandler);

// Serve Static Frontend (Production Mode)
if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendDist));

  // Catch-all to serve index.html for React Router
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
} else {
  // If not production, fall through to 404 handler for all other routes
  app.use(notFoundHandler);
}

// Global Error Handler
app.use(errorHandler);

export default app;
