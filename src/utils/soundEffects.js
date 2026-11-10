// 8-bit Retro Web Audio API Synthesizer
// Zero external files, zero latency, retro gaming chiptune audio

let audioCtx = null

function getAudioContext() {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (AudioContextClass) {
      audioCtx = new AudioContextClass()
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
  return audioCtx
}

// Global sound preference state
let isMuted = typeof window !== 'undefined' ? localStorage.getItem('ekskul_sound_enabled') === 'false' : false
const listeners = new Set()

export const soundManager = {
  isMuted() {
    return isMuted
  },
  toggleMute() {
    isMuted = !isMuted
    if (typeof window !== 'undefined') {
      localStorage.setItem('ekskul_sound_enabled', (!isMuted).toString())
    }
    listeners.forEach(fn => fn(isMuted))
    if (!isMuted) {
      this.playBlip()
    }
    return !isMuted
  },
  setMuted(muted) {
    isMuted = !!muted
    if (typeof window !== 'undefined') {
      localStorage.setItem('ekskul_sound_enabled', (!isMuted).toString())
    }
    listeners.forEach(fn => fn(isMuted))
  },
  subscribe(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  // 1. Subtle UI click/blip
  playBlip() {
    if (isMuted) return
    const ctx = getAudioContext()
    if (!ctx) return

    try {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      
      const now = ctx.currentTime
      osc.frequency.setValueAtTime(600, now)
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.04)

      gain.gain.setValueAtTime(0.06, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now)
      osc.stop(now + 0.05)
    } catch (e) {
      // AudioContext error ignored
    }
  },

  // 2. Tab or toggle switch sound
  playSwitch() {
    if (isMuted) return
    const ctx = getAudioContext()
    if (!ctx) return

    try {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'

      const now = ctx.currentTime
      osc.frequency.setValueAtTime(520, now)
      osc.frequency.setValueAtTime(660, now + 0.03)

      gain.gain.setValueAtTime(0.08, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now)
      osc.stop(now + 0.06)
    } catch (e) {
      // AudioContext error ignored
    }
  },

  // 3. Success / Fanfare (3-tone ascending arpeggio)
  playSuccess() {
    if (isMuted) return
    const ctx = getAudioContext()
    if (!ctx) return

    try {
      const now = ctx.currentTime
      const notes = [523.25, 659.25, 783.99, 1046.50] // C5, E5, G5, C6
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'square'
        
        const noteStart = now + i * 0.07
        osc.frequency.setValueAtTime(freq, noteStart)

        gain.gain.setValueAtTime(0.07, noteStart)
        gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.12)

        osc.connect(gain)
        gain.connect(ctx.destination)

        osc.start(noteStart)
        osc.stop(noteStart + 0.13)
      })
    } catch (e) {
      // AudioContext error ignored
    }
  },

  // 4. Coin / XP chime (Classic 2-tone arcade pickup)
  playCoin() {
    if (isMuted) return
    const ctx = getAudioContext()
    if (!ctx) return

    try {
      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'

      osc.frequency.setValueAtTime(987.77, now) // B5
      osc.frequency.setValueAtTime(1318.51, now + 0.08) // E6

      gain.gain.setValueAtTime(0.08, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now)
      osc.stop(now + 0.25)
    } catch (e) {
      // AudioContext error ignored
    }
  },

  // 5. Error buzzer
  playError() {
    if (isMuted) return
    const ctx = getAudioContext()
    if (!ctx) return

    try {
      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sawtooth'

      osc.frequency.setValueAtTime(180, now)
      osc.frequency.linearRampToValueAtTime(110, now + 0.18)

      gain.gain.setValueAtTime(0.1, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now)
      osc.stop(now + 0.2)
    } catch (e) {
      // AudioContext error ignored
    }
  },

  // 6. Pop / modal open
  playPop() {
    if (isMuted) return
    const ctx = getAudioContext()
    if (!ctx) return

    try {
      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'

      osc.frequency.setValueAtTime(350, now)
      osc.frequency.exponentialRampToValueAtTime(750, now + 0.06)

      gain.gain.setValueAtTime(0.09, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now)
      osc.stop(now + 0.08)
    } catch (e) {
      // AudioContext error ignored
    }
  }
}
