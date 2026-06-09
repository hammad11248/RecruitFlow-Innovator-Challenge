import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { RefreshCw, Users, ShieldAlert } from 'lucide-react'

export default function Dashboard({ refreshTrigger }) {
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchCandidates = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await axios.get('http://127.0.0.1:8001/api/candidates', {
        headers: {
          'Authorization': 'Bearer mock-token'
        }
      })
      const list = response.data?.candidates || []
      setCandidates(list)
    } catch (err) {
      if (err.code === "ERR_NETWORK") {
        setError("Server Offline: Could not connect to the API server at http://127.0.0.1:8001. Please ensure the backend is running.")
      } else {
        setError(err.response?.data?.detail || err.message || "Failed to fetch candidates.")
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCandidates()
  }, [refreshTrigger])

  const getStatusColor = (status) => {
    switch (status) {
      case "SCREENING_PENDING":
        return "bg-amber-500/10 text-amber-500 border-amber-500/20"
      case "PROCESSING":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20"
      case "PARSE_FAILED":
        return "bg-rose-500/10 text-rose-500 border-rose-500/20"
      default:
        return "bg-slate-500/10 text-slate-500 border-slate-500/20"
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl text-slate-200">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-500" />
          <h2 className="text-lg font-semibold text-slate-200">Candidate Pipeline</h2>
        </div>
        <button
          onClick={fetchCandidates}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 mb-6">
          <ShieldAlert className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {loading && candidates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-500">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
          <p className="text-sm">Loading candidates...</p>
        </div>
      ) : candidates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 border border-dashed border-slate-800 rounded-lg text-slate-500">
          <Users className="w-10 h-10 text-slate-700 mb-3" />
          <p className="text-sm">No candidates processed yet</p>
          <p className="text-xs text-slate-600 mt-1">Upload a CV on the left to start the ingestion pipeline</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-850 text-slate-400 text-xs font-semibold uppercase bg-slate-950/40">
                <th className="py-3.5 px-4">Candidate</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-center">Tech</th>
                <th className="py-3.5 px-4 text-center">Exp</th>
                <th className="py-3.5 px-4 text-center">Assess</th>
                <th className="py-3.5 px-4 text-center">Comm</th>
                <th className="py-3.5 px-4 text-center">Fit</th>
                <th className="py-3.5 px-4 text-center">Eng</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((cand) => (
                <tr key={cand.id} className="border-b border-slate-850 hover:bg-slate-850/20 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-slate-200">{cand.full_name || cand.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{cand.email}</div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(cand.funnel_status || cand.status)}`}>
                      {cand.funnel_status || cand.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center font-semibold text-slate-300">
                    {cand.scores?.technical_skills ?? 0}
                  </td>
                  <td className="py-3.5 px-4 text-center font-semibold text-slate-300">
                    {cand.scores?.experience ?? 0}
                  </td>
                  <td className="py-3.5 px-4 text-center font-semibold text-slate-300">
                    {cand.scores?.assessment ?? 0}
                  </td>
                  <td className="py-3.5 px-4 text-center font-semibold text-slate-300">
                    {cand.scores?.communication ?? 0}
                  </td>
                  <td className="py-3.5 px-4 text-center font-semibold text-slate-300">
                    {cand.scores?.cultural_fit ?? 0}
                  </td>
                  <td className="py-3.5 px-4 text-center font-semibold text-slate-300">
                    {cand.scores?.engagement ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
