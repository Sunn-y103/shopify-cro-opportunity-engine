import React from 'react'

/**
 * LoadingSkeleton — shimmer placeholder cards for the report loading state.
 *
 * Props:
 *   type: 'score-card' | 'recommendation' | 'header' (default 'recommendation')
 *   count: number of skeleton cards to render (default 1)
 */
function SkeletonBlock({ className = '' }) {
  return <div className={`skeleton ${className}`} />
}

function RecommendationSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
      {/* Header row */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <SkeletonBlock className="h-4 w-24 mb-2 rounded-full" />
          <SkeletonBlock className="h-5 w-3/4 mb-1" />
          <SkeletonBlock className="h-4 w-1/2" />
        </div>
        <SkeletonBlock className="h-8 w-8 rounded-full ml-4 flex-shrink-0" />
      </div>
      {/* Description lines */}
      <SkeletonBlock className="h-3 w-full mb-2" />
      <SkeletonBlock className="h-3 w-5/6 mb-2" />
      <SkeletonBlock className="h-3 w-4/6 mb-5" />
      {/* Badge row */}
      <div className="flex gap-2">
        <SkeletonBlock className="h-6 w-20 rounded-full" />
        <SkeletonBlock className="h-6 w-24 rounded-full" />
        <SkeletonBlock className="h-6 w-16 rounded-full" />
      </div>
    </div>
  )
}

function ScoreCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
      <div className="flex flex-col sm:flex-row items-center gap-8">
        {/* Ring placeholder */}
        <SkeletonBlock className="w-40 h-40 rounded-full flex-shrink-0" />
        {/* Stats */}
        <div className="flex-1 w-full">
          <SkeletonBlock className="h-6 w-40 mb-2" />
          <SkeletonBlock className="h-4 w-64 mb-6" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="text-center">
                <SkeletonBlock className="h-8 w-12 mx-auto mb-1" />
                <SkeletonBlock className="h-3 w-16 mx-auto rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function HeaderSkeleton() {
  return (
    <div className="flex items-center justify-between mb-8">
      <div>
        <SkeletonBlock className="h-8 w-56 mb-2" />
        <SkeletonBlock className="h-5 w-32 rounded-full" />
      </div>
        <SkeletonBlock className="h-9 w-28 rounded-xl" />
    </div>
  )
}

export default function LoadingSkeleton({ type = 'recommendation', count = 1 }) {
  if (type === 'score-card')     return <ScoreCardSkeleton />
  if (type === 'header')        return <HeaderSkeleton />

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <RecommendationSkeleton key={i} />
      ))}
    </>
  )
}
