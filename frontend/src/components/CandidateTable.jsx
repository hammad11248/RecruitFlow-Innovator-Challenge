import StatusPill from './StatusPill'
import ScoreBar from './ScoreBar'

export default function CandidateTable({ candidates, onSelectCandidate }) {
  if (candidates.length === 0) {
    return (
      <div className="glass-card p-12 text-center">
        <div className="text-5xl mb-4">👥</div>
        <p className="text-surface-300 font-medium text-lg">No candidates found</p>
        <p className="text-surface-500 text-sm mt-1">Candidates will appear here in real-time as they apply</p>
      </div>
    )
  }

  return (
    <div className="glass-card overflow-hidden" id="candidates-table">
      <table className="w-full">
        <thead>
          <tr className="border-b border-surface-700/30">
            <th className="table-header text-left px-6 py-4">Candidate</th>
            <th className="table-header text-left px-4 py-4">Status</th>
            <th className="table-header text-left px-4 py-4">Screening</th>
            <th className="table-header text-left px-4 py-4">Composite</th>
            <th className="table-header text-left px-4 py-4">Applied</th>
            <th className="table-header text-right px-6 py-4">Action</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((candidate) => {
            const createdAt = candidate.createdAt?.toDate
              ? candidate.createdAt.toDate()
              : candidate.createdAt
                ? new Date(candidate.createdAt)
                : null

            return (
              <tr
                key={candidate.id}
                className="table-row cursor-pointer"
                onClick={() => onSelectCandidate(candidate)}
                id={`candidate-row-${candidate.id}`}
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500/20 to-violet-500/20 flex items-center justify-center text-primary-400 font-bold text-sm border border-primary-500/20">
                      {candidate.name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <p className="font-medium text-surface-100">{candidate.name || 'Unknown'}</p>
                      <p className="text-surface-500 text-sm">{candidate.email || ''}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <StatusPill status={candidate.status} />
                </td>
                <td className="px-4 py-4">
                  <ScoreBar score={candidate.screeningScore || 0} label="" />
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <span className={`text-lg font-bold ${(candidate.compositeScore || 0) >= 60 ? 'text-emerald-400' : (candidate.compositeScore || 0) >= 40 ? 'text-amber-400' : 'text-rose-400'}`}>
                      {Math.round(candidate.compositeScore || 0)}
                    </span>
                    <span className="text-surface-600 text-sm">/100</span>
                  </div>
                </td>
                <td className="px-4 py-4 text-surface-400 text-sm">
                  {createdAt ? createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="text-primary-400 hover:text-primary-300 text-sm font-medium transition-colors">
                    View →
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
