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

/**
 * iPhone klavyesindeki "tık" sesine benzeyen kısa ses — klavyeye her basışta
 * (kullanıcı isteğiyle, 2026-08-23). Gerçek iOS sesi bir dosya değil, filtrelenmiş
 * gürültü patlaması + kısa alçak "tok" gövdesinden oluşan bir tık karakteri —
 * saf bir square-wave "bip" (önceki hâli) buna hiç benzemiyordu, o yüzden burada
 * da aynı yöntemle (gürültü + bant geçiren filtre + hızlı sönümlenen zarf) sentezleniyor.
 */
export function playClickSound() {
  const ctx = getContext()
  if (!ctx) return
  const now = ctx.currentTime

  const duration = 0.018
  const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration))
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize)
  }
  const noise = ctx.createBufferSource()
  noise.buffer = buffer

  const bandpass = ctx.createBiquadFilter()
  bandpass.type = 'bandpass'
  bandpass.frequency.value = 3000
  bandpass.Q.value = 1.2

  const noiseGain = ctx.createGain()
  noiseGain.gain.setValueAtTime(0.5, now)
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration)

  noise.connect(bandpass)
  bandpass.connect(noiseGain)
  noiseGain.connect(ctx.destination)
  noise.start(now)
  noise.stop(now + duration + 0.005)

  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(180, now)
  osc.frequency.exponentialRampToValueAtTime(90, now + 0.03)
  const oscGain = ctx.createGain()
  oscGain.gain.setValueAtTime(0, now)
  oscGain.gain.linearRampToValueAtTime(0.12, now + 0.003)
  oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03)
  osc.connect(oscGain)
  oscGain.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + 0.035)
}

/** İki notalı, yumuşak bir "ding" — yeni bir bildirim/uyarı belirdiğinde. */
export function playNotificationSound() {
  playTone(880, 120, 'sine', 0.08)
  setTimeout(() => playTone(1320, 160, 'sine', 0.06), 90)
}
