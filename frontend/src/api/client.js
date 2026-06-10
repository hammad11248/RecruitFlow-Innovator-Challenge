import axios from 'axios'
import { auth } from '../firebase'

const baseURL = import.meta.env.DEV ? "http://localhost:8001/api" : "/api";

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || baseURL,
  timeout: 30000,
})

// Attach Firebase Auth token to all requests for authenticated HR users
client.interceptors.request.use(async (config) => {
  let token = null;
  const user = auth.currentUser;
  if (user) {
    token = await user.getIdToken();
  } else {
    const mockUserEmail = localStorage.getItem('mock_user');
    if (mockUserEmail) {
      token = 'mock-token';
    }
  }
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
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
