/**
 * Herhangi bir çözünürlük/boyuttaki bir resmi, tarayıcının native görsel
 * çözücüsüyle okuyup en uzun kenarı `maxDimension`'ı aşmayacak şekilde
 * küçültülmüş bir JPEG blob'a çevirir — kongre/workshop görseli, temsilci
 * fotoğrafı gibi küçük önizleme görsellerinde büyük/orijinal dosyaları
 * olduğu gibi Storage'a yüklememek için kullanılır.
 */
export async function resizeImageFile(file: File, maxDimension = 480, quality = 0.85): Promise<Blob> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('Dosya okunamadı'))
    reader.readAsDataURL(file)
  })

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Görsel okunamadı'))
    img.src = dataUrl
  })

  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height))
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas oluşturulamadı')
  ctx.drawImage(image, 0, 0, width, height)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Görsel sıkıştırılamadı'))), 'image/jpeg', quality)
  })
}
