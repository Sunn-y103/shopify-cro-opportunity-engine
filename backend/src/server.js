// env.js MUST be imported first — it runs dotenv.config() before any
// other module (app → routes → services) evaluates their module-level constants.
import './env.js';
import app from './app.js';

const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0'; // Required for Render: bind to all interfaces, not just localhost
const NODE_ENV = process.env.NODE_ENV || 'development';

const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running in ${NODE_ENV} mode on ${HOST}:${PORT}`);
  console.log(`   Heap limit: ${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)} MB`);
});

// Hard timeout on all HTTP connections (120 s).
// Prevents a slow scrape from holding a socket open indefinitely while
// accumulating memory. After 120 s, Express sends 503 and the connection
// is released, freeing the request's heap allocation.
server.timeout = 120000;

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down...');
  console.error(err?.stack || `${err?.name}: ${err?.message}`);
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error(err?.stack || `${err?.name}: ${err?.message}`);
  process.exit(1);
});
