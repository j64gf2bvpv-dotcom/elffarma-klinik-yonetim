/**
 * Programın (Chromium) açamadığı görsel biçimlerini JPEG'e çevirir — kullanıcı
 * istekleri, 2026-10-23: "ruhsat fotoğrafında iki tane atınca açılmıyor" (iPhone
 * HEIC), "tüm resim formatlarını desteklesin". JPEG/PNG/WEBP/GIF/AVIF/BMP doğrudan
 * açılır; HEIC/HEIF, TIFF, PSD, kamera RAW (DNG, CR2, NEF, ARW…) gibi biçimler
 * bilgisayarın kendi aracıyla (macOS sips / Windows görsel çözücüsü) çevrilir.
 */

/** Dosya seçme pencerelerinde kabul edilen tüm görsel uzantıları. */
export const IMAGE_ACCEPT =
  'image/*,.heic,.heif,.hif,.tif,.tiff,.bmp,.webp,.avif,.gif,.jfif,.jpe,.ico,.psd,.dng,.cr2,.cr3,.nef,.arw,.orf,.rw2,.raf,.srw,.pef,.raw,.jp2,.jxl,.tga,.exr'

const EXT_RE = /\.(heic|heif|hif|tiff?|bmp|webp|avif|gif|jfif|jpe|ico|psd|dng|cr2|cr3|nef|arw|orf|rw2|raf|srw|pef|raw|jp2|jxl|tga|exr|jpe?g|png)$/i

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') || EXT_RE.test(file.name)
}

function canDecode(file: Blob): Promise<boolean> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img.naturalWidth > 0)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(false)
    }
    img.src = url
  })
}

export function bytesToBase64(buf: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  return btoa(bin)
}

export async function ensureReadableImage(file: File): Promise<File> {
  if (await canDecode(file)) return file
  const convert = window.electronAPI?.imageToJpeg
  if (convert) {
    const dataUrl = await convert(bytesToBase64(new Uint8Array(await file.arrayBuffer())))
    if (dataUrl) {
      const blob = await (await fetch(dataUrl)).blob()
      return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
    }
  }
  throw new Error(`"${file.name}" açılamadı — bu görsel biçimi desteklenmiyor, JPEG/PNG olarak kaydedip tekrar deneyin`)
}
