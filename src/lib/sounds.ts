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
 * (kullanıcı isteğiyle, 2026-08-23; "daha kaliteli, daha yumuşak" geri
 * bildirimiyle 2026-08-23'te ikinci kez yumuşatıldı). Gerçek iOS sesi bir
 * dosya değil, filtrelenmiş gürültü patlaması + kısa alçak "tok" gövdesinden
 * oluşan bir tık karakteri — ama sert/dijital durmasın diye: gürültünün tepe
 * seviyesi düşük tutuluyor, ani başlangıç yerine birkaç milisaniyelik yumuşak
 * bir atak var, bant geçiren filtreye ek bir alçak geçiren filtre eklenip
 * tiz/sert uçlar yuvarlatılıyor.
 */
export function playClickSound() {
  const ctx = getContext()
  if (!ctx) return
  const now = ctx.currentTime

  const duration = 0.024
  const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration))
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1
  }
  const noise = ctx.createBufferSource()
  noise.buffer = buffer

  const bandpass = ctx.createBiquadFilter()
  bandpass.type = 'bandpass'
  bandpass.frequency.value = 2100
  bandpass.Q.value = 0.7

  const lowpass = ctx.createBiquadFilter()
  lowpass.type = 'lowpass'
  lowpass.frequency.value = 4500

  const noiseGain = ctx.createGain()
  noiseGain.gain.setValueAtTime(0.0001, now)
  noiseGain.gain.linearRampToValueAtTime(0.16, now + 0.003)
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

  noise.connect(bandpass)
  bandpass.connect(lowpass)
  lowpass.connect(noiseGain)
  noiseGain.connect(ctx.destination)
  noise.start(now)
  noise.stop(now + duration + 0.005)

  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(200, now)
  osc.frequency.exponentialRampToValueAtTime(100, now + 0.04)
  const oscGain = ctx.createGain()
  oscGain.gain.setValueAtTime(0.0001, now)
  oscGain.gain.linearRampToValueAtTime(0.08, now + 0.005)
  oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045)
  osc.connect(oscGain)
  oscGain.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + 0.05)
}

/** İki notalı, yumuşak bir "ding" — yeni bir bildirim/uyarı belirdiğinde. */
export function playNotificationSound() {
  playTone(880, 120, 'sine', 0.08)
  setTimeout(() => playTone(1320, 160, 'sine', 0.06), 90)
}
