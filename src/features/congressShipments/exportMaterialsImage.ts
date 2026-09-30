/**
 * Kongre/workshop malzeme listesini (sarf / afiş-katalog-broşür / ekstra)
 * çıktı alınabilir bir PNG olarak indirir — beyaz zemin, her satırda durum
 * kutusu (✓ tamam / ✗ yok / boş), malzeme adı ve adet. Günlük Özet'teki
 * gibi yeni kütüphane eklemeden doğrudan Canvas API ile çiziliyor; işaretler
 * yazı tipi glifine güvenmeden çizgiyle çiziliyor.
 */
export type MaterialMark = 'done' | 'missing' | 'none'

export interface MaterialImageSection {
  title: string
  rows: { name: string; quantity: number; mark: MaterialMark }[]
}

const WIDTH = 900
const PAD = 40
const ROW_H = 34
const FONT = '"Segoe UI", "Helvetica Neue", Arial, sans-serif'

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let t = text
  while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1)
  return t + '…'
}

function drawMark(ctx: CanvasRenderingContext2D, x: number, y: number, mark: MaterialMark) {
  const s = 18
  ctx.lineWidth = 1.5
  ctx.strokeStyle = '#9a9aa2'
  ctx.strokeRect(x, y - s + 3, s, s)
  if (mark === 'none') return
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.beginPath()
  if (mark === 'done') {
    ctx.strokeStyle = '#15803d'
    ctx.moveTo(x + 4, y - 6)
    ctx.lineTo(x + 8, y - 1)
    ctx.lineTo(x + 15, y - 11)
  } else {
    ctx.strokeStyle = '#b91c1c'
    ctx.moveTo(x + 4, y - 11)
    ctx.lineTo(x + 14, y - 1)
    ctx.moveTo(x + 14, y - 11)
    ctx.lineTo(x + 4, y - 1)
  }
  ctx.stroke()
}

export function exportMaterialsImage(heading: string, subheading: string, sections: MaterialImageSection[], filename: string) {
  const visible = sections.filter((s) => s.rows.length > 0)
  const bodyHeight = visible.reduce((sum, s) => sum + 58 + s.rows.length * ROW_H + 18, 0)
  const height = 110 + Math.max(bodyHeight, 40) + 50
  const scale = 2 // baskıda net çıksın

  const canvas = document.createElement('canvas')
  canvas.width = WIDTH * scale
  canvas.height = height * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.scale(scale, scale)

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, WIDTH, height)

  ctx.fillStyle = '#111114'
  ctx.font = `bold 24px ${FONT}`
  ctx.fillText(fitText(ctx, heading, WIDTH - PAD * 2), PAD, 50)
  ctx.fillStyle = '#5b5b66'
  ctx.font = `14px ${FONT}`
  ctx.fillText(fitText(ctx, subheading, WIDTH - PAD * 2), PAD, 76)
  ctx.strokeStyle = '#111114'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(PAD, 92)
  ctx.lineTo(WIDTH - PAD, 92)
  ctx.stroke()

  let y = 110
  if (visible.length === 0) {
    ctx.fillStyle = '#5b5b66'
    ctx.font = `15px ${FONT}`
    ctx.fillText('Henüz malzeme eklenmedi.', PAD, y + 24)
  }

  for (const section of visible) {
    const done = section.rows.filter((r) => r.mark === 'done').length
    const missing = section.rows.filter((r) => r.mark === 'missing').length
    ctx.fillStyle = '#111114'
    ctx.font = `bold 17px ${FONT}`
    ctx.fillText(section.title, PAD, y + 24)
    ctx.fillStyle = '#5b5b66'
    ctx.font = `13px ${FONT}`
    ctx.textAlign = 'right'
    ctx.fillText(
      `${section.rows.length} kalem · ${done} tamam${missing > 0 ? ` · ${missing} yok` : ''}`,
      WIDTH - PAD,
      y + 24,
    )
    ctx.textAlign = 'left'

    ctx.fillStyle = '#f1f1f4'
    ctx.fillRect(PAD, y + 34, WIDTH - PAD * 2, 24)
    ctx.fillStyle = '#5b5b66'
    ctx.font = `bold 11px ${FONT}`
    ctx.fillText('DURUM', PAD + 8, y + 50)
    ctx.fillText('MALZEME', PAD + 70, y + 50)
    ctx.textAlign = 'right'
    ctx.fillText('ADET', WIDTH - PAD - 8, y + 50)
    ctx.textAlign = 'left'
    y += 58

    for (const row of section.rows) {
      const base = y + 23
      drawMark(ctx, PAD + 12, base, row.mark)
      ctx.font = `15px ${FONT}`
      ctx.fillStyle = row.mark === 'missing' ? '#b91c1c' : '#111114'
      ctx.fillText(fitText(ctx, row.name + (row.mark === 'missing' ? '  (yok)' : ''), WIDTH - PAD * 2 - 170), PAD + 70, base)
      ctx.fillStyle = '#111114'
      ctx.font = `bold 15px ${FONT}`
      ctx.textAlign = 'right'
      ctx.fillText(`${row.quantity} adet`, WIDTH - PAD - 8, base)
      ctx.textAlign = 'left'
      ctx.strokeStyle = '#e2e2e8'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(PAD, y + ROW_H)
      ctx.lineTo(WIDTH - PAD, y + ROW_H)
      ctx.stroke()
      y += ROW_H
    }
    y += 18
  }

  ctx.fillStyle = '#8a8a94'
  ctx.font = `11px ${FONT}`
  ctx.fillText(`Elffarma Paket Programı · ${new Date().toLocaleString('tr-TR')}`, PAD, height - 22)

  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.png`
    a.click()
    URL.revokeObjectURL(url)
  }, 'image/png')
}
