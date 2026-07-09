import api from './api'

export const registerDeviceToken = (token, platform = 'android') =>
  api.post('/devices/register', { token, platform })

export const unregisterDeviceToken = (token) =>
  api.post('/devices/unregister', { token })
