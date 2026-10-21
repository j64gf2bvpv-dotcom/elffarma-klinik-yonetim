import { supabase } from '@/lib/supabaseClient'
import type { AIService } from '@/features/ai/AIService'
import { extractCongressInfo, type ExtractedCongressInfo } from './extractCongressInfo'
import { chatWithFallback } from '@/features/ai/chatWithFallback'

/**
 * Kongre web sitesinden kare küçük görsel + kısa Türkçe açıklama (kullanıcı
 * istekleri, 2026-10-21: "kongrelerin küçük resimlerini web sitelerinden çek,
 * uyumlu şekilde kare kısmına ekle", "kongreyle ilgili kısa açıklama olsun").
 * Görsel indirilip kareye uyarlanır (logo gibi geniş/uzun görseller kesilmeden
 * beyaz zemine sığdırılır, fotoğraflar ortadan kırpılır) ve programın kendi
 * deposuna (profile-images, public) yüklenir — site kapansa da kaybolmaz.
 */

export async function fetchWebsitePage(url: string): Promise<{ url: string; html: string } | null> {
  const viaMain = await window.electronAPI?.fetchPageHtml?.(url)
  if (viaMain) return viaMain
  try {
    const res = await fetch(url)
    if (res.ok) return { url: res.url, html: await res.text() }
  } catch {
    /* CORS — Electron dışında çoğu sitede olur */
  }
  return null
}

async function imageUrlToDataUrl(url: string): Promise<string | null> {
  const viaMain = await window.electronAPI?.fetchImageDataUrl?.(url)
  if (viaMain) return viaMain
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve) => {
      const fr = new FileReader()
      fr.onload = () => resolve(fr.result as string)
      fr.onerror = () => resolve(null)
      fr.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/** Kareye uyarla: oran 0.75–1.33 arasıysa ortadan kırp, değilse beyaz zemine sığdır. */
export async function squareImage(dataUrl: string, size = 480): Promise<Blob | null> {
  const img = new Image()
  img.src = dataUrl
  try {
    await img.decode()
  } catch {
    return null
  }
  const w = img.naturalWidth
  const h = img.naturalHeight
  if (!w || !h) return null
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, size, size)
  const ratio = w / h
  if (ratio >= 0.75 && ratio <= 1.33) {
    const side = Math.min(w, h)
    ctx.drawImage(img, (w - side) / 2, (h - side) / 2, side, side, 0, 0, size, size)
  } else {
    const pad = size * 0.06
    const scale = Math.min((size - pad * 2) / w, (size - pad * 2) / h)
    const dw = w * scale
    const dh = h * scale
    ctx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh)
  }
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.88))
}

export async function uploadSquareCongressImage(imageUrl: string): Promise<string | null> {
  const dataUrl = await imageUrlToDataUrl(imageUrl)
  if (!dataUrl) return null
  const blob = await squareImage(dataUrl)
  if (!blob) return null
  const path = `congress/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from('profile-images').upload(path, blob, { contentType: 'image/jpeg' })
  if (error) throw error
  return supabase.storage.from('profile-images').getPublicUrl(path).data.publicUrl
}

/** Sayfa metninden 1-2 cümlelik Türkçe özet; yapay zekâ olmazsa meta açıklama kısaltılır. */
export async function summarizeCongress(
  aiService: AIService | null,
  name: string,
  info: ExtractedCongressInfo,
  pageText: string,
): Promise<string | null> {
  const fallback = info.notes ? info.notes.replace(/\s+/g, ' ').slice(0, 220) : null
  if (!aiService) return fallback
  const prompt =
    `Aşağıda "${name}" adlı tıp kongresinin web sitesinden alınmış metin var. ` +
    `Bu kongreyi Türkçe, en fazla 2 kısa cümle (toplam 220 karakteri geçmeyecek) ile tanıt: konusu/alanı, kime yönelik ` +
    `olduğu ve öne çıkan bir özelliği. Tarih ve yer yazma (ayrıca gösteriliyor). Sadece açıklama metnini döndür, başka bir şey yazma.\n\n` +
    `Meta açıklama: ${info.notes ?? '-'}\n\nSayfa metni:\n${pageText.slice(0, 6000)}`
  try {
    const r = await chatWithFallback(aiService, [{ role: 'user', content: prompt }], { maxTokens: 4000 })
    const text = r.content.replace(/^["'\s]+|["'\s]+$/g, '').replace(/\s+/g, ' ').trim()
    if (text) return text.length > 260 ? `${text.slice(0, 257)}…` : text
  } catch {
    /* yapay zekâ yoksa / hata verirse meta açıklamaya düş */
  }
  return fallback
}

/** Sayfayı indir → bilgi + düz metin. */
export async function readCongressWebsite(url: string): Promise<{ info: ExtractedCongressInfo; text: string; finalUrl: string } | null> {
  const page = await fetchWebsitePage(url)
  if (!page) return null
  const info = extractCongressInfo(page.html, page.url)
  const doc = new DOMParser().parseFromString(page.html, 'text/html')
  doc.querySelectorAll('script, style, noscript, svg, nav, footer').forEach((n) => n.remove())
  const text = (doc.body?.textContent ?? '').replace(/\s+/g, ' ').trim()
  return { info, text, finalUrl: page.url }
}
