import axios from 'axios';

// Create an Axios instance with default configurations
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 120000, // 120 seconds — AI + crawling can take time
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response.data; // Return only the data payload to components
  },
  (error) => {
    // Centralized error handling
    console.error('API Error:', error.response?.data?.message || error.message);
    return Promise.reject(error);
  }
);

/**
 * Run a full CRO audit on a single Shopify store URL.
 * @param {string} url
 */
export const analyzeStore = (url) => api.post('/analyze', { url });

/**
 * Run a competitor comparison between two Shopify store URLs.
 * @param {string} urlA - Primary store
 * @param {string} urlB - Competitor store
 */
export const compareStores = (urlA, urlB) => api.post('/compare', { urlA, urlB });

/**
 * Generate A/B testing experiment briefs from an array of CRO opportunities.
 * @param {Array} opportunities - The opportunities array from the CRO report
 */
export const generateAbTests = (opportunities) => api.post('/ab-test', { opportunities });

export default api;

