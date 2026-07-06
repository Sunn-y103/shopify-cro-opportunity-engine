import React from 'react'
import { TrendingUp, Zap, Target } from 'lucide-react'
import ScoreRing from '../ui/ScoreRing'

export default function ScoreCard({
  score = 0,
  executiveSummary = '',
  totalOpportunities = 0,
  quickWinsCount = 0,
  highImpactCount = 0,
  storeUrl = '',
}) {
  const stats = [
    {
      icon: <Target className="w-5 h-5 text-emerald-600" />,
      value: totalOpportunities,
      label: 'Opportunities',
      bg: 'bg-emerald-50',
    },
    {
      icon: <TrendingUp className="w-5 h-5 text-red-500" />,
      value: highImpactCount,
      label: 'High Impact',
      bg: 'bg-red-50',
    },
    {
      icon: <Zap className="w-5 h-5 text-amber-500" />,
      value: quickWinsCount,
      label: 'Quick Wins',
      bg: 'bg-amber-50',
    },
  ]

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col md:flex-row">
      
      {/* Score Section */}
      <div className="p-6 sm:p-8 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-gray-100 bg-gray-50/50 min-w-[280px]">
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-6">CRO Score</h2>
        <ScoreRing score={score} size={140} strokeWidth={10} animated />
        {storeUrl && (
          <div className="mt-6 text-center">
            <span className="inline-block px-3 py-1 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-500 truncate max-w-[200px]">
              {storeUrl}
            </span>
          </div>
        )}
      </div>

      {/* Summary Section */}
      <div className="p-6 sm:p-8 flex-1">
        <h3 className="text-xl font-bold text-gray-900 mb-3">
          Executive Summary
        </h3>
        <p className="text-sm text-gray-600 leading-relaxed mb-8">
          {executiveSummary || "Your store has been analyzed against industry best practices. Below are prioritized recommendations to increase your conversion rate."}
        </p>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className={`${stat.bg} rounded-xl p-4 flex flex-col items-center sm:items-start`}
            >
              <div className="mb-2">{stat.icon}</div>
              <span className="text-2xl font-black text-gray-900 leading-none mb-1">{stat.value}</span>
              <span className="text-xs text-gray-500 font-medium">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
