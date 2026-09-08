import axios from 'axios'
import { queryClient } from './queryClient'

export const api = axios.create({
  baseURL: import.meta.env.DEV
    ? 'http://localhost:34567/api/v1'
    : 'https://server.brainstorm.ng/dgn_backend/api/v1',
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('dgn_token')
  if (token) {
    config.headers.Authorization = token.startsWith('Bearer ')
      ? token
      : `Bearer ${token}`
  }

  // Prevent any browser or mobile proxy from caching GET requests
  if (config.method?.toLowerCase() === 'get') {
    config.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    config.headers['Pragma'] = 'no-cache'
    config.headers['Expires'] = '0'
    // Append unique timestamp param to guarantee fresh response
    config.params = {
      ...config.params,
      _t: Date.now(),
    }
  }

  return config
})

api.interceptors.response.use(
  (response) => {
    // Whenever a mutation succeeds, automatically invalidate all queries so every screen
    // across mobile and desktop immediately gets fresh data without manual page refresh.
    const method = response.config.method?.toLowerCase()
    if (method && ['post', 'put', 'patch', 'delete'].includes(method)) {
      queryClient.invalidateQueries()
    }
    return response
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('dgn_token')
      localStorage.removeItem('dgn_user')
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  },
)
