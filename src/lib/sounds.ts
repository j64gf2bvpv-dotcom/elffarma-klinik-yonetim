/**
 * Klavye/bildirim sesleri gerçek bir ses dosyası GEREKTİRMİYOR — Web Audio
 * API ile anında sentezleniyor (kısa bir osilatör + zarf). Arka plan müziği
 * (gerçek klasik müzik parçaları) bunun aksine gerçek ses dosyası gerektiriyor
 * — bkz. useBackgroundMusic.ts, orada sentezlemek yerine public/audio/
 * altındaki dosyalar çalınıyor.
 */
let sharedContext: AudioContext | null = null

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!sharedContext) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    sharedContext = new Ctor()
  }
  if (sharedContext.state === 'suspended') sharedContext.resume().catch(() => {})
  return sharedContext
}

function playTone(freq: number, durationMs: number, type: OscillatorType, peakGain: number) {
  const ctx = getContext()
  if (!ctx) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0, ctx.currentTime)
  gain.gain.linearRampToValueAtTime(peakGain, ctx.currentTime + 0.005)
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs / 1000)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + durationMs / 1000 + 0.02)
}

/** Kısa, hafif bir tık sesi — klavyeye her basışta. */
export function playClickSound() {
  playTone(720, 35, 'square', 0.04)
}

/** İki notalı, yumuşak bir "ding" — yeni bir bildirim/uyarı belirdiğinde. */
export function playNotificationSound() {
  playTone(880, 120, 'sine', 0.08)
  setTimeout(() => playTone(1320, 160, 'sine', 0.06), 90)
}
