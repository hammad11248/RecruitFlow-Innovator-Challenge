import { useState } from 'react'
import StatusPill from './StatusPill'
import ScoreBar from './ScoreBar'
import ScoreRadar from './ScoreRadar'
import FactorBreakdownChart from './FactorBreakdownChart'
import TimelineStepper from './TimelineStepper'

/**
 * DrillDownDrawer — Enhanced slide-in panel for HR drill-down.
 * Tabbed interface: Overview | Dimensions | Assessment | Timeline
 *
 * Props:
 *   candidate — full HR drill-down candidate object
 *   open      — boolean, controls slide visibility
 *   onClose   — close callback
 */

const TABS = [
  { key: 'overview', label: 'Overview', icon: '📋' },
  { key: 'dimensions', label: 'Dimensions', icon: '📊' },
  { key: 'profile', label: 'Profile', icon: '👤' },
  { key: 'timeline', label: 'Timeline', icon: '📅' },
]

export default function DrillDownDrawer({ candidate, open, onClose }) {
  const [activeTab, setActiveTab] = useState('overview')

  if (!candidate) return null

  const tabs = [
    { key: 'overview', label: 'Overview', icon: '📋' },
    { key: 'dimensions', label: 'Dimensions', icon: '📊' },
    candidate.assessment && { key: 'assessment', label: 'Assessment', icon: '📝' },
    { key: 'profile', label: 'Profile', icon: '👤' },
    { key: 'timeline', label: 'Timeline', icon: '📅' },
  ].filter(Boolean)

  const dims = candidate.scoreDimensions || {}
  const stateHistory = candidate.stateHistory || []
  const parsedJson = candidate.parsedJson || {}
  const skills = parsedJson.skills || candidate.skills || []
  const inferredTech = parsedJson.inferredTechnologies || candidate.inferredTechnologies || []
  const experience = parsedJson.experience || candidate.experience || []
  const education = parsedJson.education || candidate.education || []

  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-fade-in"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed right-0 top-0 h-full w-full max-w-2xl bg-surface-900 border-l border-surface-700/30 shadow-2xl z-50 overflow-y-auto transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        id="drilldown-drawer"
      >
        {/* Header */}
        <div className="sticky top-0 bg-surface-900/95 backdrop-blur-xl border-b border-surface-700/30 p-6 z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500/20 to-violet-500/20 flex items-center justify-center text-primary-400 font-bold text-xl border border-primary-500/20">
                {candidate.name?.[0]?.toUpperCase() || '?'}
              </div>
              <div>
                <h2 className="text-xl font-bold text-surface-50">{candidate.name}</h2>
                <p className="text-surface-400 text-sm">{candidate.email}</p>
                {candidate.phone && (
                  <p className="text-surface-500 text-xs">{candidate.phone}</p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-surface-800 hover:bg-surface-700 flex items-center justify-center transition-colors"
              id="close-drilldown"
            >
              <svg className="w-5 h-5 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Status + Score summary */}
          <div className="flex items-center justify-between">
            <StatusPill status={candidate.status} size="lg" />
            <div className="text-right">
              <p className="text-surface-500 text-xs uppercase tracking-wider">Composite Score</p>
              <p className={`text-4xl font-extrabold tabular-nums ${
                (candidate.compositeScore || 0) >= 80 ? 'text-emerald-400' :
                (candidate.compositeScore || 0) >= 60 ? 'text-primary-400' :
                (candidate.compositeScore || 0) >= 40 ? 'text-amber-400' :
                'text-rose-400'
              }`}>
                {Math.round(candidate.compositeScore || 0)}
                <span className="text-surface-600 text-lg font-medium">/100</span>
              </p>
            </div>
          </div>

          {/* Tab navigation */}
          <div className="flex items-center gap-1 mt-4 -mb-6 pb-0">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2.5 rounded-t-xl text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.key
                    ? 'bg-surface-800 text-primary-400 border border-surface-700/30 border-b-surface-800'
                    : 'text-surface-500 hover:text-surface-300 hover:bg-surface-800/50'
                }`}
              >
                <span className="mr-1.5">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6 space-y-6">
          {/* === OVERVIEW TAB === */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-fade-in">
              {/* Radar chart */}
              {Object.keys(dims).length > 0 && (
                <div className="glass-card p-6">
                  <h3 className="text-sm font-semibold text-surface-300 uppercase tracking-wider mb-4">
                    6-Dimension Radar
                  </h3>
                  <ScoreRadar dimensions={dims} />
                </div>
              )}

              {/* Score cards grid */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Screening', value: candidate.screeningScore, icon: '🔍' },
                  { label: 'Assessment', value: candidate.assessmentScore, icon: '📝' },
                  { label: 'Composite', value: candidate.compositeScore, icon: '🏆' },
                ].map((item) => (
                  <div key={item.label} className="glass-card p-4 text-center">
                    <span className="text-xl">{item.icon}</span>
                    <p className={`text-2xl font-extrabold mt-1 tabular-nums ${
                      (item.value || 0) >= 80 ? 'text-emerald-400' :
                      (item.value || 0) >= 60 ? 'text-primary-400' :
                      (item.value || 0) >= 40 ? 'text-amber-400' :
                      'text-rose-400'
                    }`}>
                      {Math.round(item.value || 0)}
                    </p>
                    <p className="text-surface-500 text-xs mt-0.5">{item.label}</p>
                  </div>
                ))}
              </div>

              {/* Quick skills overview */}
              {skills.length > 0 && (
                <div className="glass-card p-5">
                  <h3 className="text-sm font-semibold text-surface-300 uppercase tracking-wider mb-3">Skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {skills.map((skill, idx) => (
                      <span key={idx} className="px-3 py-1 bg-primary-500/10 text-primary-300 rounded-lg text-sm border border-primary-500/20">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* === DIMENSIONS TAB === */}
          {activeTab === 'dimensions' && (
            <div className="space-y-6 animate-fade-in">
              <div className="glass-card p-6">
                <h3 className="text-sm font-semibold text-surface-300 uppercase tracking-wider mb-6">
                  All 6 Dimensions — Raw Scores & Breakdown
                </h3>
                <FactorBreakdownChart dimensions={dims} animated={true} />
              </div>

              {/* Dimension detail cards */}
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(dims).map(([key, dim]) => (
                  <div key={key} className="bg-surface-800/50 rounded-xl p-4 border border-surface-700/20 hover:border-primary-500/20 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-surface-300 text-xs font-semibold uppercase tracking-wider">{dim.label || key}</span>
                      <span className="text-surface-500 text-xs">W: {Math.round((dim.weight || 0) * 100)}%</span>
                    </div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`text-2xl font-extrabold tabular-nums ${
                        (dim.rawScore || 0) >= 80 ? 'text-emerald-400' :
                        (dim.rawScore || 0) >= 60 ? 'text-primary-400' :
                        (dim.rawScore || 0) >= 40 ? 'text-amber-400' :
                        'text-rose-400'
                      }`}>
                        {Math.round(dim.rawScore || 0)}
                      </span>
                      <div className="flex-1">
                        <ScoreBar score={dim.rawScore || 0} height="h-1.5" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-surface-500">Weighted: {(dim.weightedScore || 0).toFixed(1)}</span>
                    </div>
                    {dim.rationale && (
                      <p className="text-surface-500 text-xs mt-2 leading-relaxed border-t border-surface-700/20 pt-2">
                        {dim.rationale}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* === ASSESSMENT TAB === */}
          {activeTab === 'assessment' && candidate.assessment && (
            <div className="space-y-6 animate-fade-in text-slate-200">
              {/* Overall Assessment Score Summary */}
              <div className="p-5 bg-surface-800/40 border border-surface-700/30 rounded-xl flex items-center justify-between shadow-[0_0_15px_rgba(99,102,241,0.03)]">
                <div>
                  <p className="text-[10px] text-surface-500 uppercase font-bold tracking-wider">Assessment Status</p>
                  <p className={`text-xs font-bold mt-1 ${candidate.assessment.passed ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {candidate.assessment.passed ? '✓ PASSED' : '⏱ EVALUATED / NOT PASSED'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-surface-500 uppercase font-bold tracking-wider">Assessment Score</p>
                  <p className="text-2xl font-extrabold text-primary-400 mt-0.5">
                    {Math.round(candidate.assessment.score || 0)}
                    <span className="text-surface-500 text-xs font-normal"> / 100</span>
                  </p>
                </div>
              </div>

              {/* Question Breakdown List */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-surface-400 uppercase tracking-wider">Question Breakdown</h4>
                {candidate.assessment.questions?.map((q, idx) => {
                  const ansEntry = candidate.assessment.answers?.find(a => (a.questionId === q.id || a.question_id === q.id));
                  const scoreEntry = candidate.assessment.scoreBreakdown?.find(sb => (sb.questionId === q.id || sb.question_id === q.id));

                  return (
                    <div key={q.id} className="p-4 bg-surface-800/20 border border-surface-700/30 rounded-xl space-y-3">
                      {/* Header: Question Number and Type */}
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-surface-200 font-bold">
                          Q{idx + 1}: {q.type === 'mcq' ? '📝 Multiple Choice' : q.type === 'coding' ? '💻 Coding' : '📖 Open-Ended'}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          (scoreEntry?.score || 0) >= 70 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15' :
                          (scoreEntry?.score || 0) >= 40 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/15' :
                          'bg-red-500/10 text-red-400 border border-red-500/15'
                        }`}>
                          Score: {Math.round(scoreEntry?.score || 0)}/100
                        </span>
                      </div>

                      {/* Question Prompt */}
                      <p className="text-xs text-surface-350 leading-relaxed font-medium">
                        {q.prompt}
                      </p>

                      {/* Candidate Answer */}
                      <div className="bg-surface-950/40 border border-surface-800 rounded-lg p-3 space-y-1">
                        <p className="text-[9px] text-surface-500 uppercase font-bold tracking-wider">Submitted Answer</p>
                        {q.type === 'coding' ? (
                          <pre className="text-[11px] font-mono text-cyan-400 whitespace-pre-wrap overflow-x-auto leading-normal bg-surface-950/60 p-2.5 rounded border border-surface-800">
                            {ansEntry?.answer || '# No code submitted'}
                          </pre>
                        ) : (
                          <p className="text-xs text-surface-200 leading-normal font-semibold">
                            {ansEntry?.answer || 'No answer submitted'}
                          </p>
                        )}
                      </div>

                      {/* Correct Answer for MCQ */}
                      {q.type === 'mcq' && q.correctAnswer && (
                        <p className="text-[10px] text-surface-450 font-medium">
                          Correct Option: <span className="text-emerald-400 font-bold">{q.correctAnswer}</span>
                        </p>
                      )}

                      {/* Evaluation Feedback */}
                      {scoreEntry?.feedback && (
                        <div className="border-t border-surface-800/60 pt-2.5">
                          <p className="text-[9px] text-primary-400 uppercase font-bold tracking-wider mb-1">AI Evaluation Remarks</p>
                          <p className="text-xs text-surface-400 leading-relaxed">
                            {scoreEntry.feedback}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* === PROFILE TAB === */}
          {activeTab === 'profile' && (
            <div className="space-y-5 animate-fade-in">
              {/* Seniority & Years */}
              <div className="glass-card p-5">
                <h3 className="text-sm font-semibold text-surface-300 uppercase tracking-wider mb-3">Background</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-surface-500 text-xs">Seniority Level</p>
                    <p className="text-surface-100 font-semibold">{parsedJson.seniorityLevel || candidate.seniorityLevel || '—'}</p>
                  </div>
                  <div>
                    <p className="text-surface-500 text-xs">Total Experience</p>
                    <p className="text-surface-100 font-semibold">{parsedJson.totalYearsExperience || candidate.totalYearsExperience || 0} years</p>
                  </div>
                </div>
              </div>

              {/* Skills */}
              {skills.length > 0 && (
                <div className="glass-card p-5">
                  <h3 className="text-sm font-semibold text-surface-300 uppercase tracking-wider mb-3">Skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {skills.map((skill, idx) => (
                      <span key={idx} className="px-3 py-1 bg-primary-500/10 text-primary-300 rounded-lg text-sm border border-primary-500/20">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Inferred Technologies */}
              {inferredTech.length > 0 && (
                <div className="glass-card p-5">
                  <h3 className="text-sm font-semibold text-surface-300 uppercase tracking-wider mb-3">Inferred Technologies</h3>
                  <div className="flex flex-wrap gap-2">
                    {inferredTech.map((tech, idx) => (
                      <span key={idx} className="px-3 py-1 bg-cyan-500/10 text-cyan-300 rounded-lg text-sm border border-cyan-500/20">
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Experience */}
              {experience.length > 0 && (
                <div className="glass-card p-5">
                  <h3 className="text-sm font-semibold text-surface-300 uppercase tracking-wider mb-3">Experience</h3>
                  <div className="space-y-4">
                    {experience.map((exp, idx) => (
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

              {/* Education */}
              {education.length > 0 && (
                <div className="glass-card p-5">
                  <h3 className="text-sm font-semibold text-surface-300 uppercase tracking-wider mb-3">Education</h3>
                  <ul className="space-y-2">
                    {education.map((edu, idx) => (
                      <li key={idx} className="text-surface-200 text-sm flex items-center gap-2">
                        <span className="text-primary-400">🎓</span>
                        {typeof edu === 'string' ? edu : edu.institution || edu.degree || JSON.stringify(edu)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* CV Download */}
              {candidate.cvDownloadUrl && (
                <a
                  href={candidate.cvDownloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="glass-button-secondary block text-center"
                  id="download-cv-hr"
                >
                  📄 Download CV
                </a>
              )}
            </div>
          )}

          {/* === TIMELINE TAB === */}
          {activeTab === 'timeline' && (
            <div className="animate-fade-in">
              <div className="glass-card p-6">
                <h3 className="text-sm font-semibold text-surface-300 uppercase tracking-wider mb-6">
                  Pipeline Progress
                </h3>
                <TimelineStepper
                  currentStatus={candidate.status}
                  stateHistory={stateHistory}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
