import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Zap, ArrowRight, TrendingUp, Lightbulb, ShieldCheck,
  Loader2, AlertTriangle, Globe, BarChart2
} from 'lucide-react'
import { analyzeStore, compareStores } from '../services/api'

export default function Home() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('audit') // 'audit' | 'compare'
  const [url, setUrl] = useState('')
  const [urlA, setUrlA] = useState('')
  const [urlB, setUrlB] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleAudit = async (e) => {
    e.preventDefault()
    if (!url.trim()) return
    setError('')
    setIsLoading(true)
    try {
      const data = await analyzeStore(url.trim())
      // Pass report via navigation state
      navigate('/report', { state: { report: data.report, mode: 'audit' } })
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Analysis failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCompare = async (e) => {
    e.preventDefault()
    if (!urlA.trim() || !urlB.trim()) return
    setError('')
    setIsLoading(true)
    try {
      const data = await compareStores(urlA.trim(), urlB.trim())
      navigate('/report', { state: { report: data.report, mode: 'compare' } })
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Comparison failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const features = [
    {
      icon: <TrendingUp className="w-5 h-5 text-emerald-600" />,
      bg: 'bg-emerald-50',
      title: 'Instant Analysis',
      description: 'Get a comprehensive CRO audit in seconds, powered by advanced AI models.',
    },
    {
      icon: <Lightbulb className="w-5 h-5 text-emerald-600" />,
      bg: 'bg-emerald-50',
      title: 'AI Recommendations',
      description: 'Receive prioritized, actionable insights tailored to your specific store.',
    },
    {
      icon: <ShieldCheck className="w-5 h-5 text-emerald-600" />,
      bg: 'bg-emerald-50',
      title: 'Actionable Insights',
      description: 'Each recommendation includes evidence, expected impact, and effort estimates.',
    },
  ]

  return (
    <div className="flex flex-col items-center justify-center flex-grow py-8 sm:py-16">

      {/* HERO */}
      <div className="text-center max-w-3xl mx-auto mb-12 animate-fade-in-up">
        <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-4 py-1.5 text-xs font-semibold mb-6 animate-fade-in-up">
          <Zap className="w-3.5 h-3.5" strokeWidth={2.5} />
          AI-Powered CRO Analysis
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-gray-900 leading-[1.1] mb-5">
          Boost Your <span className="text-emerald-600">Shopify</span>
          <br />Conversion Rate
        </h1>
        <p className="text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
          Paste your store URL and get a comprehensive, AI-generated CRO audit with prioritized recommendations and evidence-based opportunities.
        </p>
      </div>

      {/* FORM CARD */}
      <div className="w-full max-w-2xl animate-fade-in-up mb-12">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

          {/* Mode Tabs */}
          <div className="flex border-b border-gray-100 bg-gray-50/60">
            <button
              type="button"
              onClick={() => { setMode('audit'); setError('') }}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-semibold transition-all ${mode === 'audit'
                  ? 'text-emerald-700 border-b-2 border-emerald-600 bg-white'
                  : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              <Globe className="w-4 h-4" />
              Store Audit
            </button>
            <button
              type="button"
              onClick={() => { setMode('compare'); setError('') }}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-semibold transition-all ${mode === 'compare'
                  ? 'text-emerald-700 border-b-2 border-emerald-600 bg-white'
                  : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              <BarChart2 className="w-4 h-4" />
              Competitor Compare
            </button>
          </div>

          <div className="p-6 sm:p-8">
            {mode === 'audit' ? (
              <form onSubmit={handleAudit} className="flex flex-col gap-4">
                <label htmlFor="store-url" className="text-sm font-semibold text-gray-700">
                  Your Shopify Store URL
                </label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    id="store-url"
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://yourstore.myshopify.com"
                    required
                    className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-shadow"
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !url.trim()}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {isLoading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing…</>
                    ) : (
                      <>Analyze Store <ArrowRight className="w-4 h-4" /></>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleCompare} className="flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="url-a" className="text-sm font-semibold text-gray-700">Your Store</label>
                    <input
                      id="url-a"
                      type="url"
                      value={urlA}
                      onChange={(e) => setUrlA(e.target.value)}
                      placeholder="https://yourstore.com"
                      required
                      className="px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="url-b" className="text-sm font-semibold text-gray-700">Competitor Store</label>
                    <input
                      id="url-b"
                      type="url"
                      value={urlB}
                      onChange={(e) => setUrlB(e.target.value)}
                      placeholder="https://competitor.com"
                      required
                      className="px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isLoading || !urlA.trim() || !urlB.trim()}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Comparing…</>
                  ) : (
                    <>Compare Stores <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>
            )}

            {/* Error Banner */}
            {error && (
              <div className="mt-4 flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl p-4">
                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Loading note */}
            {isLoading && (
              <p className="mt-3 text-xs text-center text-gray-400">
                Crawling your store and running AI analysis — this may take up to 60 seconds.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* FEATURES GRID */}
      <div className="w-full max-w-3xl grid grid-cols-1 sm:grid-cols-3 gap-5 animate-fade-in-up">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 hover:-translate-y-1 hover:shadow-md transition-all duration-200"
          >
            <div className={`w-10 h-10 ${feature.bg} rounded-xl flex items-center justify-center mb-4`}>
              {feature.icon}
            </div>
            <h3 className="text-sm font-bold text-gray-900 mb-1.5">{feature.title}</h3>
            <p className="text-sm text-gray-500 leading-relaxed">{feature.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
