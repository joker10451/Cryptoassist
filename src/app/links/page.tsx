'use client'

import { useEffect, useState } from 'react'

interface LinkProject {
  name: string
  slug: string
  referral_url: string
  category: string | null
  description: string | null
}

export default function LinksPage() {
  const [projects, setProjects] = useState<LinkProject[]>([])

  useEffect(() => {
    fetch('/api/referrals')
      .then((r) => r.json())
      .then((data) => {
        const withRef = (data.projects ?? []).filter(
          (p: { referral_url?: string | null }) => !!p.referral_url,
        )
        setProjects(withRef)
      })
      .catch(() => {})
  }, [])

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center px-4 py-12">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 mx-auto mb-4 flex items-center justify-center">
          <span className="text-2xl font-bold text-white">K</span>
        </div>
        <h1 className="text-xl font-bold text-white">KRIRIK | ZERO FILTER</h1>
        <p className="text-sm text-gray-400 mt-1">
          crypto farmer. alpha + referrals. repel NPCs, attract farmers.
        </p>
      </div>

      {/* Links */}
      <div className="w-full max-w-md space-y-3">
        {projects.map((p) => (
          <a
            key={p.slug}
            href={p.referral_url}
            target="_blank"
            rel="noreferrer"
            className="block w-full px-5 py-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-cyan-500/50 transition-all duration-200 group"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white group-hover:text-cyan-400 transition-colors">
                  {p.name}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {p.category === 'depin'
                    ? 'DePIN — earn passively'
                    : p.category === 'defi'
                      ? 'DeFi / Exchange'
                      : p.category ?? 'crypto'}
                </p>
              </div>
              <svg
                className="w-4 h-4 text-gray-600 group-hover:text-cyan-400 transition-colors"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </a>
        ))}

        {projects.length === 0 && (
          <p className="text-center text-gray-600 text-sm py-8">Loading...</p>
        )}
      </div>

      {/* Footer */}
      <div className="mt-12 text-center">
        <p className="text-xs text-gray-600">
          i farm before CT shills. follow{' '}
          <a
            href="https://x.com/Kririk97"
            target="_blank"
            rel="noreferrer"
            className="text-cyan-600 hover:text-cyan-400"
          >
            @Kririk97
          </a>
        </p>
      </div>
    </div>
  )
}
