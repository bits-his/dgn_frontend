import axios from 'axios'

// In dev, use the page hostname so phones on the LAN can reach the API
// (localhost on a phone points at the phone itself, not your machine).
const apiHost =
  typeof window !== 'undefined' ? window.location.hostname || 'localhost' : 'localhost'

export const api = axios.create({
  baseURL: import.meta.env.DEV
    ? `http://${apiHost}:34567/api/v1`
    : 'https://server.brainstorm.ng/dgn_backend/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('dgn_token')
  if (token) {
    config.headers.Authorization = token.startsWith('Bearer ')
      ? token
      : `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
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
