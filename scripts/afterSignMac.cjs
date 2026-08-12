// electron-builder'ın macOS paketleme adımından hemen sonra çalışır (afterSign hook).
//
// mac.identity: null olduğu için electron-builder kendi imzalama adımını atlıyor,
// ama .app paketi Electron'un kendi önceden derlenmiş şablonundan (npm paketinden
// indirilen, GitHub/Electron ekibi tarafından zaten imzalanmış Electron.app) geliyor.
// electron-builder üzerine app.asar/Resources/Info.plist gibi dosyaları KOPYALARKEN
// bu eski imzayı temizlemiyor — sonuç, gerçek içerikle uyuşmayan "hayalet" bir imza:
// macOS bunu "hasar görmüş, çöp sepetine taşı" diyerek tamamen reddediyor (sadece
// "tanımadığım geliştirici" uyarısı değil, gerçek bir açılış engeli).
//
// 2026-08-12'de gerçek bir kurulumda teşhis edildi: `codesign -v` "code has no
// resources but signature indicates they must be present" hatası veriyordu.
// Çözüm: eski imzayı tamamen kaldırıp yerel (ad-hoc, `-`) bir imzayla değiştirmek —
// bu Apple Developer imzası DEĞİL (hâlâ ilk açılışta "tanımadığım geliştirici"
// uyarısı çıkar, bkz. README "Bilinen sınırlamalar"), ama en azından iç tutarlılığı
// sağlayıp uygulamanın gerçekten açılmasına izin veriyor.
const { execFileSync } = require('node:child_process')
const path = require('node:path')

exports.default = async function afterSign(context) {
  if (context.electronPlatformName !== 'darwin') return

  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)

  console.log(`[afterSignMac] Kalıntı Electron imzası temizleniyor: ${appPath}`)
  execFileSync('codesign', ['--remove-signature', appPath])

  console.log('[afterSignMac] Yerel (ad-hoc) imza uygulanıyor...')
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath])

  console.log('[afterSignMac] Tamamlandı.')
}
