/**
 * Günlük Özet kartını (Canvas ile çizilip) bir PNG dosyası olarak indirir —
 * yeni bir kütüphane eklemeden, doğrudan tarayıcının Canvas API'siyle.
 */
export function exportDailySummaryImage(countDateLabel: string, stats: { label: string; value: string }[]) {
  const canvas = document.createElement('canvas')
  const width = 640
  const height = 110 + stats.length * 68
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.fillStyle = '#15121a'
  ctx.fillRect(0, 0, width, height)

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 26px "Segoe UI", sans-serif'
  ctx.fillText(`${countDateLabel} — Günlük Özet`, 32, 52)

  ctx.strokeStyle = '#3a3542'
  ctx.beginPath()
  ctx.moveTo(32, 72)
  ctx.lineTo(width - 32, 72)
  ctx.stroke()

  let y = 116
  for (const s of stats) {
    ctx.fillStyle = '#a8a2b3'
    ctx.font = '15px "Segoe UI", sans-serif'
    ctx.fillText(s.label, 32, y)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 24px "Segoe UI", sans-serif'
    ctx.fillText(s.value, 32, y + 30)
    y += 68
  }

  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gunluk-ozet-${countDateLabel}.png`
    a.click()
    URL.revokeObjectURL(url)
  }, 'image/png')
}
