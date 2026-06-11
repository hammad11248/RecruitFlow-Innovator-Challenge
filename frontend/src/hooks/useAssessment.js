import { useEffect, useState } from 'react'
import client from '../api/client'


/**
 * Assessment hook — fetches assessment by token from Firestore
 * with real-time updates, and handles submission via FastAPI.
 */
export function useAssessment(token) {
  const [assessment, setAssessment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }

    let active = true
    const fetchAssessment = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await client.get(`/assessments/${token}`)
        if (active) {
          setAssessment(response.data)
        }
      } catch (err) {
        if (active) {
          setError(err.response?.data?.detail || err.message || 'Assessment not found')
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    fetchAssessment()
    return () => {
      active = false
    }
  }, [token])

  const submitAnswers = async (answers) => {
    setSubmitting(true)
    try {
      const response = await client.post('/assessments/submit', {
        token,
        answers,
      })
      return response.data
    } catch (err) {
      setError(err.response?.data?.detail || err.message)
      throw err
    } finally {
      setSubmitting(false)
    }
  }

  return { assessment, loading, error, submitting, submitAnswers }
}

export default useAssessment
