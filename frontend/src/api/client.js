import axios from 'axios'
import { auth } from '../firebase'

const defaultBaseURL = window.location.port === '5173'
  ? 'http://localhost:8000/api'
  : '/api';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || defaultBaseURL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})


// Attach Firebase Auth token to all requests for authenticated HR users
client.interceptors.request.use(async (config) => {
  const user = auth.currentUser
  if (user) {
    const token = await user.getIdToken()
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default client
