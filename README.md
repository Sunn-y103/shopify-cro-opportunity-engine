# Shopify CRO Engine

<div align="center">
  <p><strong>AI-Powered Conversion Rate Optimization for Shopify Stores</strong></p>
  <p>An enterprise-grade analysis engine that crawls Shopify websites and leverages Google Gemini AI to generate actionable, data-driven CRO insights and A/B test briefs.</p>
</div>

---

## 🎯 Overview

The **Shopify CRO Engine** automates the traditionally manual process of Conversion Rate Optimization auditing. By analyzing the core pages of any Shopify store (Homepage, Collections, Product Pages, and Cart), the engine evaluates trust signals, user experience, and merchandising effectiveness.

It extracts structured metrics and feeds them into an AI evaluator to generate a prioritized list of high-impact opportunities, competitor comparisons, and actionable A/B test briefs—all accessible through a sleek, modern React dashboard.

## ✨ Features

- **Automated Store Scraping:** Intelligently crawls Shopify store structures to extract CRO-critical signals (trust badges, sticky ATCs, product reviews, cart configurations).
- **AI-Powered Diagnostics:** Uses Google Gemini to analyze structural gaps and output a scored audit with categorized Quick Wins and High-Impact projects.
- **Competitor Head-to-Head:** Run direct comparative analysis between two stores to uncover strengths, weaknesses, and unique opportunities to capture market share.
- **A/B Test Generator:** Instantly converts identified issues into structured experiment briefs (KPIs, lift expectations, hypotheses) ready for engineering teams.
- **Single-Deployment Architecture:** Tightly integrated full-stack monorepo ready for single-service hosting.

## 🛠 Tech Stack

**Frontend:**
- React 19 + Vite
- TailwindCSS v4 (for scalable, utility-first styling)
- React Router DOM
- Lucide React (Icons)

**Backend:**
- Node.js + Express
- Google Gen AI SDK (`@google/genai`)
- Cheerio (for robust DOM extraction)
- Axios (for HTTP operations)

---

## 🏗 Architecture Flow

The application follows a clean, decoupled **Client-Service-AI** architecture:

1. **Client Request:** The React frontend captures the target URL(s) and triggers the backend API.
2. **Data Extraction:** The Express backend uses dedicated Scraper Services (Homepage, PDP, Cart, Collections) to crawl the Shopify store and normalize the DOM into structured JSON signals.
3. **AI Evaluation:** The structured payload is sent to Gemini AI via a strictly typed prompt instructing it to act as a CRO consultant.
4. **Presentation:** The JSON response is routed back to the client and rendered into an interactive, filterable report dashboard.

---

## 📁 Folder Structure

```text
shopify-cro-engine/
├── backend/
│   ├── src/
│   │   ├── controllers/      # Route controllers (MVC logic)
│   │   ├── middlewares/      # Express middlewares (e.g., error handling)
│   │   ├── routes/           # API route definitions
│   │   ├── services/         # Core business logic (Scraping, AI, etc.)
│   │   ├── utils/            # Shared backend utilities
│   │   ├── app.js            # Express app configuration & static serving
│   │   └── server.js         # Entry point for backend
│   └── package.json
├── frontend/
│   ├── public/               # Static assets
│   ├── src/
│   │   ├── assets/           # Images, icons, etc.
│   │   ├── components/       # Reusable React components (UI, Report, Layout)
│   │   ├── pages/            # Main route pages (Home, Report)
│   │   ├── services/         # API client layer (Axios interceptors)
│   │   ├── App.jsx           # Main React component & router setup
│   │   └── main.jsx          # Entry point for frontend
│   ├── tailwind.config.js    # Tailwind configuration
│   ├── vite.config.js        # Vite bundler configuration
│   └── package.json
├── package.json              # Root workspace configuration
└── README.md                 # Project documentation
```

---

## 🚀 Local Setup

### Prerequisites
- Node.js (v18 or higher)
- A Google Gemini API Key

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-org/shopify-cro-engine.git
   cd shopify-cro-engine
   ```

2. **Install all dependencies:**
   *(The root package.json utilizes NPM Workspaces to install frontend and backend dependencies simultaneously).*
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the `backend/` directory:
   ```env
   GOOGLE_API_KEY=your_gemini_api_key_here
   GEMINI_MODEL=gemini-2.5-flash
   GEMINI_MAX_OUTPUT_TOKENS=4000
   PORT=5000
   ```

4. **Run the Development Servers:**
   ```bash
   npm run dev:frontend  # Runs Vite on port 5173
   npm run dev:backend   # Runs Express on port 5000
   ```

---

## 📦 Render Deployment Guide

This project is configured for **Single-Service Deployment** on platforms like Render. The Express backend serves the static React build, meaning only one web service is required.

**Render Configuration:**
- **Build Command:**
  ```bash
  npm install && npm run build
  ```
- **Start Command:**
  ```bash
  npm start
  ```
- **Environment Variables:**
  - `NODE_ENV`: `production`
  - `GOOGLE_API_KEY`: `your_key_here`

**How it works:** 
During the build phase, NPM Workspaces compiles the frontend into `frontend/dist`. During runtime, the Express backend automatically detects `NODE_ENV=production` and serves the static files dynamically.

---

## 🔮 Future Improvements

1. **Authentication & History:** Introduce user accounts (e.g., via Supabase or Firebase) to save past CRO audits and track improvement over time.
2. **Headless Browser Scraping:** Upgrade the scraper from Cheerio to Playwright to capture JavaScript-rendered dynamic content and single-page apps (SPAs).
3. **Automated Lighthouse Integration:** Combine the subjective AI analysis with objective Core Web Vitals scoring to provide a holistic performance review.
4. **Export Options:** Implement PDF and CSV generation so agencies can export A/B test briefs directly for their clients.
