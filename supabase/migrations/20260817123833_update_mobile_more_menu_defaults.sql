-- Kullanıcı isteğiyle (2026-08-17): mobil "Daha Fazla" varsayılan görünümü
-- sadeleşsin (mockup: Profil Bilgileri, Hedeflerim, Bildirimler, Dökümanlar,
-- Destek, Ayarlar, Çıkış Yap) — geri kalan modüller (Stok, Fırsatlar,
-- Teklifler, Kongreler, Görevler, Ziyaret Geçmişi, Harita, Aktiviteler,
-- Haftalık Rapor/Plan, Ekip Sohbeti, Ajanda, Kartvizit Tara, AI Analiz)
-- varsayılan olarak gizli — admin isterse Panel Yönetimi'nden (Ayarlar)
-- personel bazında geri açabilir. Bu, staff.mobile_hidden_panels'ın
-- sütun varsayılanını (yeni personel de aynı sade görünümle başlasın diye)
-- ve hâlâ eski boş varsayılanda duran (admin'in henüz özelleştirmediği)
-- satırları güncelliyor.
alter table public.staff
  alter column mobile_hidden_panels set default array[
    'Stok', 'Fırsat Yönetimi', 'Teklifler', 'Kongreler', 'Görevler',
    'Doktor Ziyaretleri', 'Harita', 'Aktiviteler', 'Haftalık Rapor',
    'Haftalık Plan', 'Ekip Sohbeti', 'Ajanda', 'Kartvizit Tara', 'AI Analiz'
  ];

update public.staff
set mobile_hidden_panels = array[
    'Stok', 'Fırsat Yönetimi', 'Teklifler', 'Kongreler', 'Görevler',
    'Doktor Ziyaretleri', 'Harita', 'Aktiviteler', 'Haftalık Rapor',
    'Haftalık Plan', 'Ekip Sohbeti', 'Ajanda', 'Kartvizit Tara', 'AI Analiz'
  ]
where mobile_hidden_panels = '{}';
