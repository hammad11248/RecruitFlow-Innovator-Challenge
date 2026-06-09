import StatusPill from './StatusPill'
import ScoreBar from './ScoreBar'
import ScoreRadar from './ScoreRadar'

export default function CandidateDrawer({ candidate, open, onClose }) {
  if (!candidate) return null

  const dims = candidate.scoreDimensions || {}
  const stateHistory = candidate.stateHistory || []
  const parsedJson = candidate.parsedJson || {}

  return (
    <>
      {/* Overlay */}
      {open && <div className="drawer-overlay animate-fade-in" onClick={onClose} />}

      {/* Panel */}
      <div className={`drawer-panel transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`} id="candidate-drawer">
        {/* Header */}
        <div className="sticky top-0 bg-surface-900/95 backdrop-blur-xl border-b border-surface-700/30 p-6 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500/20 to-violet-500/20 flex items-center justify-center text-primary-400 font-bold text-xl border border-primary-500/20">
                {candidate.name?.[0]?.toUpperCase() || '?'}
              </div>
              <div>
                <h2 className="text-xl font-bold text-surface-50">{candidate.name}</h2>
                <p className="text-surface-400 text-sm">{candidate.email}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-10 h-10 rounded-xl bg-surface-800 hover:bg-surface-700 flex items-center justify-center transition-colors" id="close-drawer">
              <svg className="w-5 h-5 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-8">
          {/* Status & Score Header */}
          <div className="flex items-center justify-between">
            <StatusPill status={candidate.status} size="lg" />
            <div className="text-right">
              <p className="text-surface-500 text-xs uppercase tracking-wider">Composite Score</p>
              <p className={`text-4xl font-bold ${(candidate.compositeScore || 0) >= 60 ? 'text-emerald-400' : (candidate.compositeScore || 0) >= 40 ? 'text-amber-400' : 'text-rose-400'}`}>
                {Math.round(candidate.compositeScore || 0)}
                <span className="text-surface-600 text-lg">/100</span>
              </p>
            </div>
          </div>

          {/* 6-Dimension Radar Chart */}
          {Object.keys(dims).length > 0 && (
            <div className="glass-card p-6">
              <h3 className="text-sm font-semibold text-surface-300 uppercase tracking-wider mb-4">Scoring Breakdown</h3>
              <ScoreRadar dimensions={dims} />

              {/* Dimension Score Cards */}
              <div className="grid grid-cols-2 gap-3 mt-6">
                {Object.entries(dims).map(([key, dim]) => (
                  <div key={key} className="bg-surface-800/50 rounded-xl p-3 border border-surface-700/20">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-surface-400 text-xs font-medium">{dim.label || key}</span>
                      <span className="text-xs text-surface-500">{Math.round((dim.weight || 0) * 100)}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-lg font-bold ${(dim.rawScore || 0) >= 70 ? 'text-emerald-400' : (dim.rawScore || 0) >= 40 ? 'text-amber-400' : 'text-rose-400'}`}>
                        {Math.round(dim.rawScore || 0)}
                      </span>
                      <ScoreBar score={dim.rawScore || 0} height="h-1.5" />
                    </div>
                    {dim.rationale && (
                      <p className="text-surface-500 text-xs mt-1 line-clamp-2">{dim.rationale}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Screening Score */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-surface-300 uppercase tracking-wider">Screening Score</h3>
              <span className="text-2xl font-bold text-primary-400">{Math.round(candidate.screeningScore || 0)}</span>
            </div>
            <ScoreBar score={candidate.screeningScore || 0} showLabel />
          </div>

          {/* Parsed CV Data */}
          {parsedJson.skills?.length > 0 && (
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-surface-300 uppercase tracking-wider mb-3">Skills</h3>
              <div className="flex flex-wrap gap-2">
                {parsedJson.skills.map((skill, idx) => (
                  <span key={idx} className="px-3 py-1 bg-primary-500/10 text-primary-300 rounded-lg text-sm border border-primary-500/20">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {parsedJson.inferredTechnologies?.length > 0 && (
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-surface-300 uppercase tracking-wider mb-3">Inferred Technologies</h3>
              <div className="flex flex-wrap gap-2">
                {parsedJson.inferredTechnologies.map((tech, idx) => (
                  <span key={idx} className="px-3 py-1 bg-cyan-500/10 text-cyan-300 rounded-lg text-sm border border-cyan-500/20">
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Experience */}
          {parsedJson.experience?.length > 0 && (
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-surface-300 uppercase tracking-wider mb-3">Experience</h3>
              <div className="space-y-4">
                {parsedJson.experience.map((exp, idx) => (
                  <div key={idx} className="border-l-2 border-primary-500/30 pl-4">
                    <p className="font-medium text-surface-100">{exp.role}</p>
                    <p className="text-primary-400 text-sm">{exp.company}</p>
                    <p className="text-surface-500 text-xs">{exp.duration}</p>
                    {exp.description && <p className="text-surface-400 text-sm mt-1">{exp.description}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* State History Timeline */}
          {stateHistory.length > 0 && (
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-surface-300 uppercase tracking-wider mb-4">State History</h3>
              <div className="space-y-0">
                {stateHistory.map((entry, idx) => {
                  const ts = entry.timestamp?.toDate
                    ? entry.timestamp.toDate()
                    : entry.timestamp ? new Date(entry.timestamp) : null

                  return (
                    <div key={idx} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-3 h-3 rounded-full bg-primary-500/60 border-2 border-primary-500 mt-1" />
                        {idx < stateHistory.length - 1 && <div className="w-0.5 h-8 bg-surface-700" />}
                      </div>
                      <div className="pb-4">
                        <div className="flex items-center gap-2">
                          <StatusPill status={entry.state} size="sm" />
                          {ts && <span className="text-surface-500 text-xs">{ts.toLocaleString()}</span>}
                        </div>
                        {entry.meta && Object.keys(entry.meta).length > 0 && (
                          <p className="text-surface-500 text-xs mt-1">{JSON.stringify(entry.meta)}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* CV Download Link */}
          {candidate.cvDownloadUrl && (
            <a href={candidate.cvDownloadUrl} target="_blank" rel="noopener noreferrer" className="glass-button-secondary block text-center" id="download-cv">
              📄 Download CV
            </a>
          )}
        </div>
      </div>
    </>
  )
}
