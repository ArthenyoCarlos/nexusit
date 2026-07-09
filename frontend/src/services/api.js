import axios from 'axios'
import { Capacitor } from '@capacitor/core'

// Dentro do app Android (Capacitor), os assets são servidos de uma origem local
// (https://localhost) sem relação com o backend real — a baseURL relativa '/api'
// (que funciona no navegador via proxy do nginx) precisa virar uma URL absoluta.
const baseURL = Capacitor.isNativePlatform()
  ? (import.meta.env.VITE_API_BASE_URL || 'https://nexus.local/api')
  : '/api'

const api = axios.create({ baseURL })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
