import React from 'react'

/**
 * Badge — reusable pill/badge component.
 *
 * Props:
 *   variant: 'impact-high' | 'impact-medium' | 'impact-low'
 *            'confidence-high' | 'confidence-medium' | 'confidence-low'
 *            'effort-high' | 'effort-medium' | 'effort-low'
 *            'category' | 'success' | 'warning' | 'error' | 'info' | 'purple' | 'default'
 *   label:   string — the badge text
 *   icon:    optional React node
 *   size:    'sm' | 'md' (default 'md')
 */

const variantStyles = {
  // Impact
  'impact-high':       'bg-red-50 text-red-700 ring-1 ring-red-200',
  'impact-medium':     'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  'impact-low':        'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  // Confidence
  'confidence-high':   'bg-teal-50 text-teal-700 ring-1 ring-teal-200',
  'confidence-medium': 'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200',
  'confidence-low':    'bg-gray-50 text-gray-600 ring-1 ring-gray-200',
  // Effort
  'effort-high':       'bg-red-50 text-red-600 ring-1 ring-red-200',
  'effort-medium':     'bg-amber-50 text-amber-600 ring-1 ring-amber-200',
  'effort-low':        'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  // Categories
  'ux':                'bg-purple-50 text-purple-700 ring-1 ring-purple-200',
  'performance':       'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  'trust':             'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  'checkout':          'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  'mobile':            'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200',
  // Generic
  'success':           'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  'warning':           'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  'error':             'bg-red-50 text-red-700 ring-1 ring-red-200',
  'info':              'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  'purple':            'bg-purple-50 text-purple-700 ring-1 ring-purple-200',
  'default':           'bg-gray-100 text-gray-600 ring-1 ring-gray-200',
}

const sizeStyles = {
  sm: 'px-2 py-0.5 text-xs gap-1',
  md: 'px-2.5 py-1 text-xs gap-1.5',
}

export default function Badge({ variant = 'default', label, icon, size = 'md' }) {
  const colorClass = variantStyles[variant] ?? variantStyles.default
  const sizeClass  = sizeStyles[size] ?? sizeStyles.md

  return (
    <span
      className={`
        inline-flex items-center font-medium rounded-full
        ${colorClass} ${sizeClass}
        transition-colors duration-150
      `}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {label}
    </span>
  )
}
