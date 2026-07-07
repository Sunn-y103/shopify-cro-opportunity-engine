import React, { useState } from 'react'
import { ChevronDown, ChevronUp, Lightbulb, ExternalLink, TrendingUp } from 'lucide-react'
import Badge from '../ui/Badge'

export default function RecommendationCard({ recommendation, index = 0 }) {
  const [evidenceOpen, setEvidenceOpen] = useState(false)

  const {
    issue,
    evidence,
    impact = 3,
    confidence = 'Medium',
    effort = 'Medium',
    recommendation: actionStep,
    expectedLift
  } = recommendation

  // Map 1-5 impact to category
  const impactCategory = impact >= 4 ? 'high' : impact >= 3 ? 'medium' : 'low';
  
  // Effort mapping
  const effortLower = effort.toLowerCase();
  const confidenceLower = confidence.toLowerCase();

  const priorityConfig = {
    high:   { border: 'border-l-red-500',   dot: 'bg-red-500',   label: 'High Priority' },
    medium: { border: 'border-l-amber-500', dot: 'bg-amber-500', label: 'Medium Priority' },
    low:    { border: 'border-l-emerald-500', dot: 'bg-emerald-500', label: 'Low Priority' },
  }

  // Define priority based on impact + effort (e.g., High impact + Low effort = High Priority)
  let priority = 'medium';
  if (impact >= 4) priority = (effortLower === 'low' || effortLower === 'medium') ? 'high' : 'medium';
  if (impact <= 2) priority = 'low';

  const pc = priorityConfig[priority];

  return (
    <article
      className={`
        bg-white rounded-2xl border border-gray-200 shadow-sm
        border-l-4 ${pc.border}
        hover:-translate-y-1 hover:shadow-md transition-all duration-200
        animate-fade-in-up flex flex-col h-full
      `}
      style={{ animationDelay: `${index * 0.08}s` }}
      aria-label={`Recommendation: ${issue}`}
    >
      <div className="p-6 flex flex-col h-full">
        {/* Top row */}
        <div className="flex items-center justify-between mb-3">
          <span className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wider">
            <span className={`inline-block w-2 h-2 rounded-full ${pc.dot}`} />
            {pc.label}
          </span>
          {expectedLift && (
            <Badge variant="success" icon={<TrendingUp className="w-3 h-3" />} label={expectedLift} size="sm" />
          )}
        </div>

        {/* Title */}
        <h3 className="text-lg font-bold text-gray-900 leading-snug mb-3">
          {issue}
        </h3>

        {/* Badges */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500 font-medium">Impact:</span>
            <Badge variant={`impact-${impactCategory}`} label={`${Math.round(impact)}/5`} size="sm" />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500 font-medium">Confidence:</span>
            <Badge variant={`confidence-${confidenceLower}`} label={confidence} size="sm" />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500 font-medium">Effort:</span>
            <Badge variant={`effort-${effortLower}`} label={effort} size="sm" />
          </div>
        </div>

        {/* Action Step */}
        <div className="flex flex-col gap-3 bg-emerald-50 border border-emerald-100 rounded-xl p-4 mb-4 flex-grow">
          {recommendation.whyItMatters && (
            <div>
              <p className="text-xs font-bold text-emerald-800 mb-1 uppercase tracking-wide">Why It Matters</p>
              <p className="text-sm text-emerald-900 leading-relaxed">{recommendation.whyItMatters}</p>
            </div>
          )}
          <div className="flex gap-2">
            <Lightbulb className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-emerald-800 mb-1 uppercase tracking-wide">Recommendation</p>
              <p className="text-sm text-emerald-900 leading-relaxed">{actionStep}</p>
            </div>
          </div>
        </div>

        {/* Evidence */}
        {evidence && (
          <div className="mt-auto border-t border-gray-100 pt-3">
            <button
              type="button"
              onClick={() => setEvidenceOpen(prev => !prev)}
              className="flex items-center justify-between text-xs font-semibold text-gray-500 hover:text-gray-800 transition-colors focus-visible:outline-2 w-full"
            >
              <span>{evidenceOpen ? 'Hide Evidence' : 'View Extracted Evidence'}</span>
              {evidenceOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {evidenceOpen && (
              <div className="mt-3 bg-gray-50 rounded-lg p-3 animate-fade-in text-xs text-gray-600 leading-relaxed border border-gray-100 flex items-start gap-2">
                <ExternalLink className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                <span>{evidence}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  )
}
