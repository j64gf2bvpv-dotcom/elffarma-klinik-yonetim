let audioCtx: AudioContext | null = null

/** İki kısa "bip" sesi çalar (dosya gerektirmez, Web Audio API ile üretilir). */
export function playAlertBeep() {
  try {
    const Ctx =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    if (!audioCtx) audioCtx = new Ctx()
    if (audioCtx.state === 'suspended') void audioCtx.resume()
    const ctx = audioCtx
    const now = ctx.currentTime
    for (const offset of [0, 0.24]) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.0001, now + offset)
      gain.gain.exponentialRampToValueAtTime(0.25, now + offset + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.2)
      osc.connect(gain).connect(ctx.destination)
      osc.start(now + offset)
      osc.stop(now + offset + 0.22)
    }
  } catch {
    // Ses çalınamadı (örn. tarayıcı otomatik oynatmayı engelledi) — sessizce geç.
  }
}
