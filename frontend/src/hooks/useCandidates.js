import { useEffect, useState } from 'react'
import client from '../api/client'

/**
 * Real-time candidates hook using short-polling on GET /api/candidates.
 * Polls every 5 seconds to track backend processing states.
 */
export function useCandidates(filters = {}) {
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true

    const fetchCandidates = async (showLoading = false) => {
      if (showLoading) {
        setLoading(true)
      }
      try {
        const params = {}
        if (filters.status) params.status = filters.status
        if (filters.jobId) params.jobId = filters.jobId
        if (filters.limit) params.limit = filters.limit

        const response = await client.get('/candidates', { params })
        if (!active) return

        const list = response.data?.candidates || []
        setCandidates(list)
        setError(null)
      } catch (err) {
        if (!active) return
        console.error('Failed to fetch candidates:', err)
        setError(err.response?.data?.detail || err.message || 'Failed to fetch candidate data.')
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    // Initial fetch
    fetchCandidates(true)

    // Short-polling interval every 5 seconds
    const interval = setInterval(() => {
      fetchCandidates(false)
    }, 5000)

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [filters.status, filters.jobId, filters.limit])

  return {
    candidates,
    loading,
    error,
    empty: !loading && candidates.length === 0,
    isEmpty: !loading && candidates.length === 0
  }
}

export default useCandidates
