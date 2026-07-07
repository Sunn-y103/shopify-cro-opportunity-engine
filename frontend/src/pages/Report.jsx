import React, { useState } from 'react'
import { useLocation, useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, AlertTriangle, RefreshCw,
  PackageOpen, LayoutGrid, FlaskConical, BarChart2, ChevronDown,
  ChevronUp, CheckCircle2, XCircle, Trophy, Lightbulb, Loader2
} from 'lucide-react'
import ScoreCard from '../components/report/ScoreCard'
import RecommendationCard from '../components/report/RecommendationCard'
import LoadingSkeleton from '../components/ui/LoadingSkeleton'
import Badge from '../components/ui/Badge'
import { generateAbTests } from '../services/api'

// ──────────────────────────────────────────────────────────────────
// UTILITY COMPONENTS
// ──────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 flex flex-col items-center justify-center text-center min-h-[360px]">
      <div className="w-16 h-16 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-5">
        <PackageOpen className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-2">No Report Data Yet</h3>
      <p className="text-sm text-gray-500 max-w-xs leading-relaxed mb-6">
        Run an analysis from the dashboard to see your personalized CRO recommendations here.
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </Link>
    </div>
  )
}

function ErrorState({ onRetry }) {
  return (
    <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-12 flex flex-col items-center justify-center text-center min-h-[360px]">
      <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mb-5">
        <AlertTriangle className="w-8 h-8 text-red-500" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-2">Analysis Failed</h3>
      <p className="text-sm text-gray-500 max-w-xs leading-relaxed mb-6">
        Something went wrong while generating your report. Please try again.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
      >
        <RefreshCw className="w-4 h-4" />
        Retry Analysis
      </button>
    </div>
  )
}

// Collapsible analysis section panel
function AnalysisPanel({ title, content }) {
  const [open, setOpen] = useState(false)
  if (!content) return null
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <span className="text-sm font-bold text-gray-900">{title}</span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && (
        <div className="px-5 pb-5 text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-4">
          {content}
        </div>
      )}
    </div>
  )
}

// A/B Test brief card
function AbTestCard({ experiment, index }) {
  const [open, setOpen] = useState(false)
  if (!experiment) return null
  
  const impactLower = (experiment.expectedImpact || '').toLowerCase()
  const impactVariant = impactLower === 'high' ? 'success' : impactLower === 'medium' ? 'warning' : 'default'

  return (
    <article
      className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
      style={{ animationDelay: `${index * 0.06}s` }}
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-2">
          <Badge variant={impactVariant} label={`Impact: ${experiment.expectedImpact || 'Medium'}`} size="sm" />
          <Badge variant="default" label={`Effort: ${experiment.effort || 'Medium'}`} size="sm" />
        </div>
        <h3 className="text-base font-bold text-gray-900 mb-1 mt-2">{experiment.title || experiment.opportunityIssue}</h3>
        <p className="text-xs text-gray-500 italic mb-4">{experiment.hypothesis}</p>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-gray-50 rounded-lg px-3 py-2.5">
            <p className="text-xs text-gray-400 mb-0.5">Primary Metric</p>
            <p className="text-xs font-semibold text-gray-800">{experiment.primaryMetric}</p>
          </div>
          <div className="bg-gray-50 rounded-lg px-3 py-2.5">
            <p className="text-xs text-gray-400 mb-0.5">Secondary Metric</p>
            <p className="text-xs font-semibold text-gray-800">{experiment.secondaryMetric}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOpen(p => !p)}
          className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-800 transition-colors"
        >
          {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {open ? 'Hide Details' : 'View Details'}
        </button>
        {open && (
          <div className="mt-3 bg-emerald-50 border border-emerald-100 rounded-xl p-3.5 flex flex-col gap-3">
            <div>
              <p className="text-[10px] font-bold text-emerald-800 mb-1 uppercase tracking-wide">Crawler Evidence</p>
              <p className="text-xs text-emerald-900 leading-relaxed">{experiment.evidence}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-emerald-800 mb-1 uppercase tracking-wide">Implementation</p>
              <p className="text-xs text-emerald-900 leading-relaxed whitespace-pre-line">{experiment.implementation}</p>
            </div>
          </div>
        )}
      </div>
    </article>
  )
}

// Competitor comparison view
function ComparisonReport({ report, activeTab }) {
  if (!report) return null
  const sections = [
    { key: 'homepage', label: 'Homepage' },
    { key: 'collections', label: 'Collections' },
    { key: 'pdp', label: 'Product Pages' },
    { key: 'cart', label: 'Cart' },
    { key: 'reviewsAndTrust', label: 'Reviews & Trust' },
    { key: 'uxAndConversion', label: 'UX & Conversion' },
  ]

  const winnerBadge = (winner) => {
    if (winner === 'A') return <Badge variant="success" label="Advantage: Your Store" size="sm" />
    if (winner === 'B') return <Badge variant="error" label="Advantage: Competitor" size="sm" />
    return <Badge variant="default" label="Tie" size="sm" />
  }

  return (
    <div className="flex flex-col gap-8">
      {activeTab === 'competitorAnalysisReport' && (
        <>
          {/* Header */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Executive Summary</h2>
            <p className="text-sm text-gray-600 leading-relaxed">{report.executiveSummary}</p>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                <p className="text-xs font-bold text-emerald-700 mb-1">Your Store (A)</p>
                <p className="text-xs text-emerald-800 truncate">{report.competitorA?.url}</p>
              </div>
              <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                <p className="text-xs font-bold text-red-700 mb-1">Competitor (B)</p>
                <p className="text-xs text-red-800 truncate">{report.competitorB?.url}</p>
              </div>
            </div>
          </div>

          {/* Strengths/Weaknesses */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Strengths */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Your Store's Strengths
              </h3>
              <div className="flex flex-col gap-2">
                {(report.strengths?.A || []).map((s, i) => (
                  <div key={i} className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 text-sm text-emerald-900">{s}</div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-400" /> Your Store's Weaknesses
              </h3>
              <div className="flex flex-col gap-2">
                {(report.weaknesses?.A || []).map((s, i) => (
                  <div key={i} className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-900">{s}</div>
                ))}
              </div>
            </div>
          </div>

          {/* Opportunities to beat competitor */}
          {report.opportunitiesForA?.length > 0 && (
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" /> Opportunities
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {report.opportunitiesForA.map((opp, i) => (
                  <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex gap-2 items-center">
                        <Badge variant={opp.impact >= 4 ? 'impact-high' : 'impact-medium'} label={`Impact: ${Math.round(opp.impact)}/5`} size="sm" />
                        <Badge variant="default" label={`Effort: ${opp.effort || 'Low'}`} size="sm" />
                      </div>
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{opp.category || 'UX'}</span>
                    </div>
                    <h4 className="text-sm font-bold text-gray-900 mb-2">{opp.issue || opp.title}</h4>
                    <p className="text-xs text-gray-500 mb-3 leading-relaxed">{opp.evidence}</p>
                    <div className="flex flex-col gap-3 bg-emerald-50 border border-emerald-100 rounded-lg p-3">
                      {opp.whyItMatters && (
                        <div>
                          <p className="text-[10px] font-bold text-emerald-800 mb-0.5 uppercase tracking-wide">Why It Matters</p>
                          <p className="text-xs text-emerald-900 leading-relaxed">{opp.whyItMatters}</p>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Lightbulb className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[10px] font-bold text-emerald-800 mb-0.5 uppercase tracking-wide">Recommendation</p>
                          <p className="text-xs text-emerald-900 leading-relaxed">{opp.recommendation}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'comparisonView' && (
        <>
          {/* Head-to-head sections */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-emerald-600" /> Head-to-Head Comparison
            </h3>
            <div className="flex flex-col gap-4">
              {sections.map(({ key, label }) => {
                const section = report.comparison?.[key]
                if (!section) return null
                return (
                  <div key={key} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-bold text-gray-900">{label}</h4>
                      {winnerBadge(section.winner)}
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed mb-3">{section.analysis}</p>
                    {section.keyDifferences?.length > 0 && (
                      <ul className="flex flex-col gap-1.5">
                        {section.keyDifferences.map((diff, i) => (
                          <li key={i} className="text-xs text-gray-500 flex items-start gap-2">
                            <span className="text-emerald-500 mt-0.5">•</span> {diff}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────
// MAIN REPORT PAGE
// ──────────────────────────────────────────────────────────────────
export default function Report() {
  const { id } = useParams()
  const location = useLocation()

  // Data comes from navigation state (set by Home.jsx API call)
  const report = location.state?.report || null
  const mode = location.state?.mode || 'audit'

  const [filter, setFilter] = useState('All')
  const [activeTab, setActiveTab] = useState(mode === 'compare' ? 'competitorAnalysisReport' : 'opportunities') // 'opportunities' | 'analysis' | 'ab-tests' | 'competitorAnalysisReport' | 'comparisonView'
  const [abTests, setAbTests] = useState(null)
  const [abLoading, setAbLoading] = useState(false)
  const [abError, setAbError] = useState('')

  const isError = false
  const isLoading = false

  const handleRetry = () => window.location.reload()

  const handleGenerateAbTests = async () => {
    if (!report?.opportunities?.length) return
    setAbLoading(true)
    setAbError('')
    try {
      const result = await generateAbTests(report.opportunities)
      setAbTests(result.briefs?.experiments || [])
      setActiveTab('ab-tests')
    } catch (err) {
      setAbError(err?.response?.data?.error || err.message || 'Failed to generate A/B tests.')
    } finally {
      setAbLoading(false)
    }
  }

  // Opportunities filtering — for audit mode
  let displayRecs = report?.opportunities || []
  if (filter === 'Quick Wins') {
    displayRecs = displayRecs.filter(r => (report?.quickWins || []).includes(r.issue))
  } else if (filter === 'High Impact') {
    displayRecs = displayRecs.filter(r => (report?.highImpactProjects || []).includes(r.issue) || r.impact >= 4)
  }
  displayRecs.sort((a, b) => b.impact - a.impact)

  const analysisItems = report?.analysis ? [
    { title: '🏠 Homepage Analysis', content: report.analysis.homepage },
    { title: '📦 Collections Analysis', content: report.analysis.collections },
    { title: '🛍️ Product Page (PDP) Analysis', content: report.analysis.pdp },
    { title: '🛒 Cart Analysis', content: report.analysis.cart },
    { title: '🔒 Trust & Social Proof Analysis', content: report.analysis.trust },
  ] : []

  const tabs = mode === 'compare'
    ? [
      { key: 'competitorAnalysisReport', label: 'Analysis Report', icon: <Lightbulb className="w-3.5 h-3.5" /> },
      { key: 'comparisonView', label: 'Comparison', icon: <BarChart2 className="w-3.5 h-3.5" /> },
    ]
    : [
      { key: 'opportunities', label: 'Opportunities', icon: <LayoutGrid className="w-3.5 h-3.5" /> },
      { key: 'analysis', label: 'Deep Analysis', icon: <Lightbulb className="w-3.5 h-3.5" /> },
      { key: 'ab-tests', label: 'A/B Tests', icon: <FlaskConical className="w-3.5 h-3.5" /> },
    ]

  return (
    <div className="flex flex-col gap-8 animate-fade-in pb-6">

      {/* HEADER */}
      {isLoading ? (
        <LoadingSkeleton type="header" />
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-emerald-600 transition-colors group"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                New Analysis
              </Link>
              <span className="text-gray-300">·</span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                {mode === 'compare' ? 'Competitor Comparison' : id ? `Report: ${id}` : 'Latest Report'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
              {mode === 'compare' ? 'Competitor Analysis Report' : 'CRO Analysis Report'}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {/* A/B Test generate button — audit mode only */}
            {mode !== 'compare' && report?.opportunities?.length > 0 && (
              <button
                type="button"
                onClick={handleGenerateAbTests}
                disabled={abLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-all shadow-sm disabled:opacity-60"
              >
                {abLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
                <span className="hidden sm:inline">{abLoading ? 'Generating…' : 'Generate A/B Tests'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* No report data yet */}
      {!report && !isLoading && !isError && <EmptyState />}

      {isError && <ErrorState onRetry={handleRetry} />}

      {/* SCORE CARD — audit mode only */}
      {!isLoading && !isError && report && mode !== 'compare' && (
        <ScoreCard
          score={report.croScore || 0}
          executiveSummary={report.executiveSummary}
          totalOpportunities={report.opportunities?.length || 0}
          highImpactCount={report.highImpactProjects?.length || 0}
          quickWinsCount={report.quickWins?.length || 0}
          storeUrl={report.storeUrl}
        />
      )}

      {/* WARNINGS */}
      {report?.warnings?.length > 0 && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">{report.warnings[0]}</p>
        </div>
      )}

      {/* A/B ERROR */}
      {abError && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-2xl p-4">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{abError}</p>
        </div>
      )}

      {/* TABS */}
      {report && !isLoading && !isError && (
        <>
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto self-start">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${activeTab === t.key
                    ? 'bg-white text-gray-900 shadow-sm border border-gray-200/50'
                    : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* ── TAB: OPPORTUNITIES ── */}
          {activeTab === 'opportunities' && mode !== 'compare' && (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <LayoutGrid className="w-5 h-5 text-gray-500" />
                  <h2 className="text-lg font-bold text-gray-900">Actionable Opportunities</h2>
                  <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2.5 py-0.5 rounded-full border border-gray-200">
                    {displayRecs.length}
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl overflow-x-auto">
                  {['All', 'Quick Wins', 'High Impact'].map(f => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${filter === f
                          ? 'bg-white text-gray-900 shadow-sm border border-gray-200/50'
                          : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {displayRecs.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
                  {displayRecs.map((rec, index) => (
                    <RecommendationCard key={rec.issue} recommendation={rec} index={index} />
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── TAB: DEEP ANALYSIS ── */}
          {activeTab === 'analysis' && mode !== 'compare' && (
            <div className="flex flex-col gap-3">
              <h2 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-emerald-600" /> Page-Level Deep Analysis
              </h2>
              {analysisItems.length === 0 ? (
                <p className="text-sm text-gray-500">No detailed analysis sections returned by the AI.</p>
              ) : (
                analysisItems.map(item => <AnalysisPanel key={item.title} title={item.title} content={item.content} />)
              )}
            </div>
          )}

          {/* ── TAB: A/B TESTS ── */}
          {activeTab === 'ab-tests' && mode !== 'compare' && (
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <FlaskConical className="w-5 h-5 text-emerald-600" /> A/B Experiment Briefs
              </h2>
              {abLoading && (
                <div className="flex items-center gap-3 text-sm text-gray-500 py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                  Generating experiment briefs…
                </div>
              )}
              {!abLoading && !abTests && (
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 text-center">
                  <FlaskConical className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 mb-4">Click the "Generate A/B Tests" button to produce experiment briefs for your top opportunities.</p>
                  <button
                    type="button"
                    onClick={handleGenerateAbTests}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
                  >
                    <FlaskConical className="w-4 h-4" /> Generate A/B Tests
                  </button>
                </div>
              )}
              {!abLoading && abTests?.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {abTests.map((exp, i) => <AbTestCard key={i} experiment={exp} index={i} />)}
                </div>
              )}
            </div>
          )}

          {/* ── TAB: COMPARISON ── */}
          {(activeTab === 'competitorAnalysisReport' || activeTab === 'comparisonView') && mode === 'compare' && (
            <ComparisonReport report={report} activeTab={activeTab} />
          )}
        </>
      )}
    </div>
  )
}
