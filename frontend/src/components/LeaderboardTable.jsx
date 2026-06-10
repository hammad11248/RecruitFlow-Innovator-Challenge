import { useMemo, useState } from 'react'
import StatusPill from './StatusPill'

/**
 * LeaderboardTable — Interactive sortable candidate ranking table for HR portal.
 *
 * Props:
 *   candidates        — array of leaderboard candidate objects
 *   onSelectCandidate — callback when a row is clicked
 *   sortBy            — current sort field
 *   sortDir           — current sort direction
 *   onSort            — callback (field) to change sort
 */

const DIMENSION_LABELS = {
  technicalSkills: { short: 'Tech', color: 'from-blue-500 to-cyan-400' },
  experienceSeniority: { short: 'Exp', color: 'from-violet-500 to-purple-400' },
  assessmentPerformance: { short: 'Assess', color: 'from-emerald-500 to-teal-400' },
  cvQuality: { short: 'CV', color: 'from-amber-500 to-yellow-400' },
  culturalFit: { short: 'Fit', color: 'from-pink-500 to-rose-400' },
  engagement: { short: 'Eng', color: 'from-indigo-500 to-blue-400' },
}

const RANK_BADGES = {
  1: { bg: 'bg-gradient-to-r from-yellow-500 to-amber-400', text: 'text-yellow-900', shadow: 'shadow-yellow-500/30' },
  2: { bg: 'bg-gradient-to-r from-gray-300 to-gray-400', text: 'text-gray-800', shadow: 'shadow-gray-400/30' },
  3: { bg: 'bg-gradient-to-r from-orange-400 to-amber-600', text: 'text-orange-900', shadow: 'shadow-orange-500/30' },
}

export default function LeaderboardTable({
  candidates = [],
  onSelectCandidate,
  sortBy = 'compositeScore',
  sortDir = 'desc',
  onSort,
}) {
  if (candidates.length === 0) {
    return (
      <div className="glass-card p-16 text-center">
        <div className="text-6xl mb-4">🏆</div>
        <p className="text-surface-200 font-semibold text-xl">No candidates yet</p>
        <p className="text-surface-500 text-sm mt-2">
          Candidates will appear here ranked by their composite score
        </p>
      </div>
    )
  }

  const handleHeaderClick = (field) => {
    if (onSort) onSort(field)
  }

  const SortIcon = ({ field }) => {
    if (sortBy !== field) return <span className="text-surface-600 ml-1">↕</span>
    return <span className="text-primary-400 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <div className="glass-card overflow-hidden" id="leaderboard-table">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-700/30 bg-surface-900/50">
              <th className="table-header text-center px-3 py-4 w-16">#</th>
              <th
                className="table-header text-left px-4 py-4 cursor-pointer hover:text-surface-200 transition-colors select-none"
                onClick={() => handleHeaderClick('name')}
              >
                Candidate <SortIcon field="name" />
              </th>
              <th className="table-header text-left px-3 py-4">Status</th>
              <th
                className="table-header text-center px-3 py-4 cursor-pointer hover:text-surface-200 transition-colors select-none"
                onClick={() => handleHeaderClick('compositeScore')}
              >
                Score <SortIcon field="compositeScore" />
              </th>
              {/* 6-dimension mini columns */}
              {Object.entries(DIMENSION_LABELS).map(([key, { short }]) => (
                <th key={key} className="table-header text-center px-2 py-4 hidden xl:table-cell">
                  {short}
                </th>
              ))}
              <th className="table-header text-left px-3 py-4 hidden lg:table-cell">Skills</th>
              <th
                className="table-header text-center px-3 py-4 cursor-pointer hover:text-surface-200 transition-colors select-none"
                onClick={() => handleHeaderClick('createdAt')}
              >
                Applied <SortIcon field="createdAt" />
              </th>
              <th className="table-header text-right px-4 py-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((candidate) => {
              const rankBadge = RANK_BADGES[candidate.rank]
              const dims = candidate.dimensions || {}
              const createdAt = candidate.createdAt
                ? new Date(candidate.createdAt)
                : null

              return (
                <tr
                  key={candidate.id}
                  className="table-row cursor-pointer group"
                  onClick={() => onSelectCandidate?.(candidate)}
                  id={`leaderboard-row-${candidate.id}`}
                >
                  {/* Rank */}
                  <td className="px-3 py-4 text-center">
                    {rankBadge ? (
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-extrabold shadow-lg ${rankBadge.bg} ${rankBadge.text} ${rankBadge.shadow}`}>
                        {candidate.rank}
                      </span>
                    ) : (
                      <span className="text-surface-500 font-semibold text-sm">{candidate.rank}</span>
                    )}
                  </td>

                  {/* Candidate info */}
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500/20 to-violet-500/20 flex items-center justify-center text-primary-400 font-bold text-sm border border-primary-500/20 group-hover:border-primary-500/40 transition-colors">
                        {candidate.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-surface-100 text-sm truncate group-hover:text-primary-300 transition-colors">
                          {candidate.name || 'Unknown'}
                        </p>
                        <p className="text-surface-500 text-xs truncate">{candidate.email}</p>
                      </div>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-3 py-4">
                    <StatusPill status={candidate.status} size="sm" />
                  </td>

                  {/* Composite Score */}
                  <td className="px-3 py-4 text-center">
                    <div className="flex flex-col items-center">
                      <span className={`text-xl font-extrabold tabular-nums ${
                        candidate.compositeScore >= 80 ? 'text-emerald-400' :
                        candidate.compositeScore >= 60 ? 'text-primary-400' :
                        candidate.compositeScore >= 40 ? 'text-amber-400' :
                        'text-rose-400'
                      }`}>
                        {Math.round(candidate.compositeScore || 0)}
                      </span>
                      {/* Mini progress bar */}
                      <div className="w-12 h-1 bg-surface-700/50 rounded-full mt-1 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            candidate.compositeScore >= 80 ? 'bg-emerald-400' :
                            candidate.compositeScore >= 60 ? 'bg-primary-400' :
                            candidate.compositeScore >= 40 ? 'bg-amber-400' :
                            'bg-rose-400'
                          }`}
                          style={{ width: `${Math.min(100, candidate.compositeScore || 0)}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* 6-Dimension mini scores */}
                  {Object.entries(DIMENSION_LABELS).map(([key, { color }]) => {
                    const dimScore = dims[key]?.rawScore || 0
                    return (
                      <td key={key} className="px-2 py-4 text-center hidden xl:table-cell">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs font-bold text-surface-300 tabular-nums">{Math.round(dimScore)}</span>
                          <div className="w-8 h-1 bg-surface-700/50 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full bg-gradient-to-r ${color}`}
                              style={{ width: `${Math.min(100, dimScore)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    )
                  })}

                  {/* Skills tags */}
                  <td className="px-3 py-4 hidden lg:table-cell">
                    <div className="flex flex-wrap gap-1 max-w-[180px]">
                      {(candidate.skills || []).slice(0, 3).map((skill, idx) => (
                        <span key={idx} className="px-1.5 py-0.5 bg-primary-500/10 text-primary-300 rounded text-[10px] font-medium border border-primary-500/15">
                          {skill}
                        </span>
                      ))}
                      {(candidate.skills || []).length > 3 && (
                        <span className="text-surface-500 text-[10px] font-medium px-1">
                          +{candidate.skills.length - 3}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Applied date */}
                  <td className="px-3 py-4 text-center text-surface-400 text-xs">
                    {createdAt
                      ? createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      : '—'
                    }
                  </td>

                  {/* Action */}
                  <td className="px-4 py-4 text-right">
                    <button className="text-primary-400 hover:text-primary-300 text-sm font-medium transition-colors opacity-0 group-hover:opacity-100">
                      Details →
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
