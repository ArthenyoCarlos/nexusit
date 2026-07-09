let permissionRequested = false

export function isNotificationSupported() {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function requestNotificationPermission() {
  if (!isNotificationSupported() || permissionRequested) return
  permissionRequested = true
  if (Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {})
  }
}

// Shows a native OS notification, but only when the user isn't already
// looking at the tab (the in-app toast/sound already covers that case).
export function showDesktopNotification(title, { body, tag, onClick } = {}) {
  if (!isNotificationSupported()) return
  if (Notification.permission !== 'granted') return
  if (document.visibilityState === 'visible' && document.hasFocus()) return
  try {
    const notification = new Notification(title, { body, tag, icon: '/favicon.svg' })
    notification.onclick = () => {
      window.focus()
      notification.close()
      onClick?.()
    }
  } catch {
    // Some browsers throw if notifications are blocked/unsupported mid-session.
  }
}
