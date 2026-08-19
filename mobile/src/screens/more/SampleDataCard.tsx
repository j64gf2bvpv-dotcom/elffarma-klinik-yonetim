import * as React from 'react'
import { Text, View } from 'react-native'
import { DatabaseZap } from 'lucide-react-native'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useTheme } from '@/lib/ThemeContext'
import { useInsertSampleData, useDeleteSampleData } from '@/features/sampleData/hooks'

/**
 * Ayarlar > admin-only "Örnek Veri" kartı — kullanıcı isteğiyle
 * (2026-08-20) programı gerçek veri girmeden test edebilmek için 3 örnek
 * müşteri + bir sipariş/tahsilat/ziyaret ekliyor, hepsi "[ÖRNEK]"
 * etiketiyle işaretli. Silme butonu SADECE bu etiketi taşıyan kayıtları
 * arayıp temizliyor — başka hiçbir gerçek veriye dokunmuyor (bkz.
 * features/sampleData/api.ts).
 *
 * Onay için Alert.alert KULLANILMIYOR — react-native-web'de bu API sessizce
 * hiçbir şey yapmıyor (tıklayınca görünürde hiçbir tepki yok), bu da web
 * önizlemesinde "Verileri Sil" butonunu görünüşte bozuk gösteriyordu
 * (canlı testte bulundu, 2026-08-20). Bunun yerine iki adımlı, native/web
 * her ikisinde de aynı şekilde çalışan basit bir satır-içi onay kullanılıyor.
 */
export function SampleDataCard() {
  const theme = useTheme()
  const insertMutation = useInsertSampleData()
  const deleteMutation = useDeleteSampleData()
  const [confirming, setConfirming] = React.useState(false)

  React.useEffect(() => {
    if (!confirming) return
    const t = setTimeout(() => setConfirming(false), 5000)
    return () => clearTimeout(t)
  }, [confirming])

  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <DatabaseZap size={18} color={theme.colors.primary} />
        <Text style={{ color: theme.colors.foreground, fontWeight: '600' }}>Örnek Veri</Text>
      </View>
      <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>
        Programı denemek için "[ÖRNEK]" etiketli müşteri/sipariş/tahsilat/ziyaret ekler veya bu etiketli kayıtları temizler.
      </Text>

      {confirming ? (
        <View style={{ gap: 8 }}>
          <Text style={{ color: theme.colors.destructive, fontSize: theme.fontSizes.xs, fontWeight: '600' }}>
            "[ÖRNEK]" etiketli tüm kayıtlar silinecek. Emin misiniz?
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button variant="outline" onPress={() => setConfirming(false)} style={{ flex: 1 }}>
              Vazgeç
            </Button>
            <Button
              variant="destructive"
              onPress={() => {
                setConfirming(false)
                deleteMutation.mutate()
              }}
              loading={deleteMutation.isPending}
              style={{ flex: 1 }}
            >
              Evet, Sil
            </Button>
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button variant="outline" onPress={() => insertMutation.mutate()} loading={insertMutation.isPending} style={{ flex: 1 }}>
            Örnek Veriler Ekle
          </Button>
          <Button variant="destructive" onPress={() => setConfirming(true)} disabled={deleteMutation.isPending} style={{ flex: 1 }}>
            Verileri Sil
          </Button>
        </View>
      )}
    </Card>
  )
}
