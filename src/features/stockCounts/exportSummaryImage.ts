/**
 * Günlük Özet kartını (toplamlar + kalem kalem ürün/adet listesi) Canvas ile
 * çizip bir PNG dosyası olarak indirir — yeni bir kütüphane eklemeden,
 * doğrudan tarayıcının Canvas API'siyle.
 */
export function exportDailySummaryImage(
  countDateLabel: string,
  stats: { label: string; value: string }[],
  items: { label: string; value: string }[],
) {
  const width = 640
  const rowHeight = 30
  const headerHeight = 100
  const statsHeight = stats.length > 0 ? 80 : 0
  const itemsHeaderHeight = items.length > 0 ? 36 : 0
  const height = headerHeight + statsHeight + itemsHeaderHeight + items.length * rowHeight + 24

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.fillStyle = '#15121a'
  ctx.fillRect(0, 0, width, height)

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 24px "Segoe UI", sans-serif'
  ctx.fillText(`${countDateLabel} — Günlük Özet`, 32, 46)

  ctx.strokeStyle = '#3a3542'
  ctx.beginPath()
  ctx.moveTo(32, 66)
  ctx.lineTo(width - 32, 66)
  ctx.stroke()

  let y = headerHeight

  if (stats.length > 0) {
    const colWidth = (width - 64) / stats.length
    stats.forEach((s, i) => {
      const x = 32 + i * colWidth
      ctx.fillStyle = '#a8a2b3'
      ctx.font = '13px "Segoe UI", sans-serif'
      ctx.fillText(s.label, x, y)
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 20px "Segoe UI", sans-serif'
      ctx.fillText(s.value, x, y + 26)
    })
    y += statsHeight
    ctx.strokeStyle = '#3a3542'
    ctx.beginPath()
    ctx.moveTo(32, y - 16)
    ctx.lineTo(width - 32, y - 16)
    ctx.stroke()
  }

  if (items.length > 0) {
    ctx.fillStyle = '#a8a2b3'
    ctx.font = 'bold 13px "Segoe UI", sans-serif'
    ctx.fillText('ÜRÜN', 32, y)
    ctx.fillText('SON STOK', width - 140, y)
    y += itemsHeaderHeight

    for (const item of items) {
      ctx.fillStyle = '#ffffff'
      ctx.font = '15px "Segoe UI", sans-serif'
      ctx.fillText(item.label, 32, y)
      ctx.fillText(item.value, width - 140, y)
      ctx.strokeStyle = '#25212b'
      ctx.beginPath()
      ctx.moveTo(32, y + 10)
      ctx.lineTo(width - 32, y + 10)
      ctx.stroke()
      y += rowHeight
    }
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
