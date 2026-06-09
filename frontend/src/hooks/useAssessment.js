import { useEffect, useState } from 'react'
import { db, doc, onSnapshot } from '../firebase'
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

    setLoading(true)
    setError(null)

    const docRef = doc(db, 'assessments', token)
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setAssessment({ id: snapshot.id, ...snapshot.data() })
        } else {
          setError('Assessment not found')
        }
        setLoading(false)
      },
      (err) => {
        console.error('Assessment snapshot error:', err)
        setError(err.message)
        setLoading(false)
      }
    )

    return unsubscribe
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
