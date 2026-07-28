// Kurulabilir paket (Setup.exe / .dmg) üretmeden önce çalışır. Vite, Supabase
// URL/anon key'ini build ANINDA renderer bundle'ının içine gömer (import.meta.env) —
// çalışma zamanında .env okunmaz. Bu yüzden gerçek değerler olmadan paketlenen bir
// installer, kurulduğu her makinede sessizce "Supabase yapılandırılmamış" durumuna
// düşer. Bu script böyle bir installer'ın yanlışlıkla üretilip dağıtılmasını engeller.

import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)))

function loadDotEnvIfPresent() {
  const envPath = join(rootDir, '.env')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    if (process.env[key] === undefined) {
      process.env[key] = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '')
    }
  }
}

loadDotEnvIfPresent()

const required = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']
const placeholderPattern = /placeholder|your-project|xxx|<.*>/i

const problems = required.filter((key) => {
  const value = process.env[key]
  return !value || placeholderPattern.test(value)
})

if (problems.length > 0) {
  console.error(
    '\n[check-release-env] Paketleme durduruldu: ' +
      problems.join(', ') +
      ' tanımlı değil ya da placeholder görünüyor.\n' +
      'Kurulum paketi (Setup.exe / .dmg) bu değerleri build anında içine gömer; ' +
      'gerçek Supabase Project URL / anon key olmadan paketlenirse dağıtılan ' +
      'uygulama hiçbir veri işlemi yapamaz.\n' +
      'Yerelde: .env dosyasını gerçek değerlerle doldurun.\n' +
      'CI/CD (GitHub Actions) içinde: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY ' +
      'repository secrets olarak tanımlayın.\n',
  )
  process.exit(1)
}

console.log('[check-release-env] Supabase yapılandırması OK — paketleme devam ediyor.')
