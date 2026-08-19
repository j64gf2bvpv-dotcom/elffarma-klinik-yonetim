import * as React from 'react'
import { Alert, Text, View } from 'react-native'
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
 */
export function SampleDataCard() {
  const theme = useTheme()
  const insertMutation = useInsertSampleData()
  const deleteMutation = useDeleteSampleData()

  function onDeleteConfirm() {
    Alert.alert(
      'Örnek Verileri Sil',
      '"[ÖRNEK]" etiketli tüm müşteri, sipariş, tahsilat, ziyaret ve teklif kayıtları silinecek. Bu işlem geri alınamaz.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Sil', style: 'destructive', onPress: () => deleteMutation.mutate() },
      ],
    )
  }

  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <DatabaseZap size={18} color={theme.colors.primary} />
        <Text style={{ color: theme.colors.foreground, fontWeight: '600' }}>Örnek Veri</Text>
      </View>
      <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>
        Programı denemek için "[ÖRNEK]" etiketli müşteri/sipariş/tahsilat/ziyaret ekler veya bu etiketli kayıtları temizler.
      </Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button
          variant="outline"
          onPress={() => insertMutation.mutate()}
          loading={insertMutation.isPending}
          style={{ flex: 1 }}
        >
          Örnek Veriler Ekle
        </Button>
        <Button
          variant="destructive"
          onPress={onDeleteConfirm}
          loading={deleteMutation.isPending}
          style={{ flex: 1 }}
        >
          Verileri Sil
        </Button>
      </View>
    </Card>
  )
}
