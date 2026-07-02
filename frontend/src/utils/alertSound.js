let audioContext = null
let unlocked = false

function getAudioContext() {
  if (typeof window === 'undefined') return null
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  if (!audioContext || audioContext.state === 'closed') audioContext = new Ctx()
  return audioContext
}

export function unlockAlertSound() {
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume()
    unlocked = true
  } catch {}
}

export function playAlertSound(severity = 4) {
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    const t = ctx.currentTime
    const sev = Number(severity) || 3
    gain.gain.setValueAtTime(0, t)

    if (sev >= 5) {
      osc.type = 'square'
      osc.frequency.setValueAtTime(880, t)
      ;[0, 0.25, 0.5].forEach(offset => {
        gain.gain.linearRampToValueAtTime(0.38, t + offset + 0.01)
        gain.gain.linearRampToValueAtTime(0, t + offset + 0.18)
      })
      osc.start(t)
      osc.stop(t + 0.85)
    } else if (sev >= 4) {
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(740, t)
      ;[0, 0.28].forEach(offset => {
        gain.gain.linearRampToValueAtTime(0.3, t + offset + 0.01)
        gain.gain.linearRampToValueAtTime(0, t + offset + 0.2)
      })
      osc.start(t)
      osc.stop(t + 0.65)
    } else {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(520, t)
      gain.gain.linearRampToValueAtTime(0.18, t + 0.01)
      gain.gain.linearRampToValueAtTime(0, t + 0.28)
      osc.start(t)
      osc.stop(t + 0.35)
    }

    osc.onended = () => {
      try { osc.disconnect(); gain.disconnect() } catch {}
    }
  } catch {
    // Browsers can block audio before user interaction; keep UI functional.
  }
}

export function isAlertSoundUnlocked() {
  return unlocked
}
