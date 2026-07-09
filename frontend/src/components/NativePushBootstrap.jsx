import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { StatusBar, Style } from '@capacitor/status-bar'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { registerDeviceToken } from '../services/devices'
import { playAlertSound } from '../utils/alertSound'

// Só existe dentro do app Android: cuida da barra de status, registra o
// dispositivo pra receber push notification de verdade (Firebase) e trata
// toque na notificação.
export default function NativePushBootstrap() {
  const { isAuthenticated } = useAuth()
  const { add: addToast } = useToast()
  const navigate = useNavigate()

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    StatusBar.setStyle({ style: Style.Dark }).catch(() => {})
    StatusBar.setBackgroundColor({ color: '#12151b' }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !isAuthenticated) return

    let cancelled = false

    async function setup() {
      const current = await PushNotifications.checkPermissions()
      let status = current.receive
      if (status === 'prompt' || status === 'prompt-with-rationale') {
        status = (await PushNotifications.requestPermissions()).receive
      }
      if (status !== 'granted' || cancelled) return
      await PushNotifications.register()
    }

    const registrationListener = PushNotifications.addListener('registration', (token) => {
      localStorage.setItem('fcm_token', token.value)
      registerDeviceToken(token.value).catch(() => {})
    })

    const receivedListener = PushNotifications.addListener('pushNotificationReceived', (notification) => {
      addToast(notification.title ? `${notification.title}: ${notification.body ?? ''}` : (notification.body ?? 'Nova notificação'), 'info')
      playAlertSound(3)
    })

    const tapListener = PushNotifications.addListener('pushNotificationActionPerformed', () => {
      navigate('/support-crm')
    })

    setup()

    return () => {
      cancelled = true
      registrationListener.remove()
      receivedListener.remove()
      tapListener.remove()
    }
  }, [isAuthenticated, addToast, navigate])

  return null
}
