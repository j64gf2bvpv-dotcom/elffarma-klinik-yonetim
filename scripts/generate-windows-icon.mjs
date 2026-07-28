// Windows (NSIS installer/uninstaller + .exe) yalnızca gerçek .ico dosyalarını kabul
// eder — build/icons/icon.png doğrudan verildiğinde NSIS "invalid icon file" hatasıyla
// derlemeyi durdurur. Bu script mevcut PNG'den build/icons/icon.ico üretir; ikon
// değiştiğinde yeniden çalıştırılmalıdır (elle çalıştırılır, build sırasında otomatik
// tetiklenmez — ikon nadiren değişir).
import pngToIco from 'png-to-ico'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)))
const source = join(rootDir, 'build/icons/icon.png')
const target = join(rootDir, 'build/icons/icon.ico')

const buffer = await pngToIco(source)
writeFileSync(target, buffer)
console.log(`[generate-windows-icon] ${target} oluşturuldu.`)
