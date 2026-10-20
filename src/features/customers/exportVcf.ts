import { saveAs } from 'file-saver'

import { buildVCards } from '@/lib/vcard'
import type { Customer } from '@/types/database'

/**
 * Cari listesini telefon rehberine aktarılabilir vCard (.vcf) dosyası olarak
 * indirir (kullanıcı isteği, 2026-10-20: "cari kart dışa aktar kısmında vcard
 * da olsun"). Ekranda filtrelenmiş liste neyse o aktarılır. Telefon / cep /
 * WhatsApp numaraları, e-posta, hastane, il-ilçe-adres, Instagram ve not dahil.
 */
export function exportCustomersVcf(customers: Customer[], filename = 'cari-kart-rehber') {
  const vcf = buildVCards(
    customers.map((c) => ({
      fullName: c.full_name,
      phones: [
        { value: c.mobile_phone ?? '', type: 'CELL' as const },
        { value: c.phone ?? '', type: 'CELL' as const },
        { value: c.whatsapp_phone ?? '', type: 'CELL' as const },
      ],
      email: c.email,
      org: c.hospital_name,
      street: c.address,
      district: c.district,
      province: c.province,
      url: c.instagram ? `https://instagram.com/${c.instagram.replace(/^@/, '')}` : null,
      note: c.notes,
    })),
  )
  saveAs(new Blob([vcf], { type: 'text/vcard;charset=utf-8' }), `${filename}.vcf`)
}
