import { useEffect, useState } from 'react'
import { db, collection, query, onSnapshot, where, orderBy, limit as firestoreLimit } from '../firebase'


/**
 * Real-time candidates hook using Firestore onSnapshot.
 * Candidates appear/update instantly without polling.
 */
export function useCandidates(filters = {}) {
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    let q = collection(db, 'candidates')
    const constraints = []

    if (filters.status) {
      constraints.push(where('status', '==', filters.status))
    }
    if (filters.jobId) {
      constraints.push(where('jobId', '==', filters.jobId))
    }

    constraints.push(orderBy('createdAt', 'desc'))

    if (filters.limit) {
      constraints.push(firestoreLimit(filters.limit))
    } else {
      constraints.push(firestoreLimit(100))
    }

    q = query(q, ...constraints)

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        setCandidates(docs)
        setLoading(false)
      },
      (err) => {
        console.error('Candidates snapshot error:', err)
        setError(err.message)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [filters.status, filters.jobId, filters.limit])

  return { candidates, loading, error }
}

export default useCandidates
