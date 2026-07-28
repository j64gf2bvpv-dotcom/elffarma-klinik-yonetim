/**
 * Serbest formatta girilen bir Türkiye telefon numarasını kanonik
 * "+90XXXXXXXXXX" biçimine çevirir. "0532 123 45 67", "532 123 45 67",
 * "+90 532 123 45 67" gibi girdilerin hepsini kabul eder.
 *
 * Geçerli bir 10 haneli numara değilse null döner — mobil önek (5)
 * doğrulaması yapılır ama sabit hatları sert biçimde reddetmez, sadece
 * `isMobile: false` ile işaretler.
 */
export interface PhoneNormalizeResult {
  /** +90XXXXXXXXXX biçiminde kanonik numara */
  canonical: string
  /** wa.me linkleri için ülke koduyla birlikte, + işaretsiz, boşluksuz hane */
  waDigits: string
  isMobile: boolean
}

export function normalizeTrPhone(input: string): PhoneNormalizeResult | null {
  const digitsOnly = input.replace(/\D/g, '')
  if (!digitsOnly) return null

  let local = digitsOnly
  if (local.startsWith('90') && local.length === 12) {
    local = local.slice(2)
  } else if (local.startsWith('0') && local.length === 11) {
    local = local.slice(1)
  }

  if (local.length !== 10) return null

  return {
    canonical: `+90${local}`,
    waDigits: `90${local}`,
    isMobile: local.startsWith('5'),
  }
}

export function formatTrPhoneForDisplay(canonical: string): string {
  const digits = canonical.replace(/\D/g, '')
  const local = digits.startsWith('90') ? digits.slice(2) : digits
  if (local.length !== 10) return canonical
  return `0${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6, 8)} ${local.slice(8, 10)}`
}
