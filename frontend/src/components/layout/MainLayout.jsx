import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Zap, LayoutDashboard, FileText, Menu, X, ArrowRight } from 'lucide-react'

export default function MainLayout({ children }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()

  const navLinks = [
    { to: '/',       label: 'Dashboard', icon: LayoutDashboard },
    { to: '/report', label: 'Reports',   icon: FileText },
  ]

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-gray-900 font-sans">
      {/* ──────────────────────────────────────────
          STICKY NAVIGATION
      ────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            {/* Brand */}
            <Link
              to="/"
              className="flex items-center gap-2.5 group focus-visible:outline-2 focus-visible:outline-emerald-600 rounded-lg"
              aria-label="ShopifyCRO — Home"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-600 shadow-sm group-hover:shadow-md transition-shadow">
                <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
              <span className="text-lg font-bold tracking-tight text-gray-900">
                ShopifyCRO
              </span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden sm:flex items-center gap-1" aria-label="Main navigation">
              {navLinks.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className={`
                    flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-150
                    ${isActive(to)
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                    }
                  `}
                  aria-current={isActive(to) ? 'page' : undefined}
                >
                  <Icon className="w-4 h-4" strokeWidth={1.75} />
                  {label}
                </Link>
              ))}
            </nav>

            {/* Desktop CTA */}
            <div className="hidden sm:flex items-center gap-3">
              <Link
                to="/"
                className="
                  inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold
                  bg-emerald-600 text-white shadow-sm hover:bg-emerald-700
                  transition-all duration-150 hover:shadow-md
                  focus-visible:outline-2 focus-visible:outline-emerald-600 focus-visible:outline-offset-2
                "
              >
                New Analysis
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Mobile hamburger */}
            <button
              type="button"
              className="sm:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors focus-visible:outline-2"
              onClick={() => setMobileMenuOpen(prev => !prev)}
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-gray-200 bg-white animate-fade-in">
            <nav className="max-w-7xl mx-auto px-4 py-3 space-y-1" aria-label="Mobile navigation">
              {navLinks.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`
                    flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium transition-colors
                    ${isActive(to)
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                    }
                  `}
                >
                  <Icon className="w-4.5 h-4.5" strokeWidth={1.75} />
                  {label}
                </Link>
              ))}
              <Link
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 mt-3 px-4 py-3 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
              >
                New Analysis
                <ArrowRight className="w-4 h-4" />
              </Link>
            </nav>
          </div>
        )}
      </header>

      {/* ──────────────────────────────────────────
          MAIN CONTENT
      ────────────────────────────────────────── */}
      <main className="flex-grow flex flex-col w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* ──────────────────────────────────────────
          FOOTER
      ────────────────────────────────────────── */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">

            {/* Brand + tagline */}
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-600">
                <Zap className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 leading-none">ShopifyCRO</p>
                <p className="text-xs text-gray-500 leading-none mt-0.5">AI-Powered CRO Engine</p>
              </div>
            </div>

            {/* Footer links */}
            <nav className="flex items-center gap-5" aria-label="Footer navigation">
              <Link to="/" className="text-xs text-gray-500 hover:text-gray-900 transition-colors font-medium">
                Dashboard
              </Link>
              <Link to="/report" className="text-xs text-gray-500 hover:text-gray-900 transition-colors font-medium">
                Reports
              </Link>
            </nav>

            {/* Copyright */}
            <p className="text-xs text-gray-400">
              &copy; {new Date().getFullYear()} Shopify CRO Opportunity Engine. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
