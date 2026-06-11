import axios from 'axios'
import { auth } from '../firebase'
import { API_BASE_URL } from '../config/api'

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
})

// Attach Firebase Auth token to all requests for authenticated HR users
client.interceptors.request.use(async (config) => {
  let token = null
  const user = auth.currentUser
  if (user && typeof user.getIdToken === 'function') {
    try {
      token = await user.getIdToken()
    } catch {
      token = null
    }
  }
  if (token === 'mock-token' || !token) {
    const mockUserEmail = localStorage.getItem('mock_user')
    if (mockUserEmail) {
      token = `mock-token:${mockUserEmail}`
    }
  }
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  // Let the browser set multipart boundary for FormData uploads
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }

  return config
})

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthEndpoint = error.config?.url?.includes('/auth/')
    if (error.response?.status === 401 && !isAuthEndpoint) {
      localStorage.removeItem('user_role')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default client
