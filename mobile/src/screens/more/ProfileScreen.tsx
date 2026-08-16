import * as React from 'react'
import { Text, View } from 'react-native'
import { UserRound } from 'lucide-react-native'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Card } from '@/components/ui/Card'
import { TextField } from '@/components/ui/TextField'
import { Button } from '@/components/ui/Button'
import { useTheme } from '@/lib/ThemeContext'
import { useAuth } from '@/lib/auth'
import { useUpdateStaff } from '@/features/staff/hooks'

/**
 * Pazarlama görselindeki "Profil Bilgileri" — kullanıcının kendi staff
 * kaydını (ad, telefon, görev unvanı) görüntüleyip düzenlediği ekran.
 * E-posta salt okunur (auth.users'tan geliyor, staff.email ayrı bir alan
 * ve burada değiştirilmesi oturum e-postasını değiştirmez — kafa
 * karışıklığı olmasın diye düzenlenebilir yapılmadı).
 */
export function ProfileScreen() {
  const theme = useTheme()
  const { staff } = useAuth()
  const updateStaff = useUpdateStaff()
  const [fullName, setFullName] = React.useState(staff?.full_name ?? '')
  const [phone, setPhone] = React.useState(staff?.phone ?? '')
  const [jobTitle, setJobTitle] = React.useState(staff?.job_title ?? '')
  const [dirty, setDirty] = React.useState(false)

  React.useEffect(() => {
    if (!dirty && staff) {
      setFullName(staff.full_name)
      setPhone(staff.phone ?? '')
      setJobTitle(staff.job_title ?? '')
    }
  }, [staff, dirty])

  if (!staff) return null

  async function onSave() {
    await updateStaff.mutateAsync({
      id: staff!.id,
      patch: { full_name: fullName.trim(), phone: phone.trim() || null, job_title: jobTitle.trim() || null },
    })
    setDirty(false)
  }

  return (
    <Screen scroll style={{ gap: 16 }}>
      <ScreenHeader title="Profil Bilgileri" />

      <View style={{ alignItems: 'center', gap: 8, paddingVertical: 8 }}>
        <View
          style={{
            width: 76,
            height: 76,
            borderRadius: 38,
            backgroundColor: theme.colors.primary + '22',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <UserRound size={34} color={theme.colors.primary} />
        </View>
        <Text style={{ color: theme.colors.foreground, fontWeight: '700', fontSize: theme.fontSizes.lg }}>
          {staff.full_name}
        </Text>
        <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.sm }}>
          {staff.role === 'admin' ? 'Yönetici' : 'Satış Temsilcisi'}
        </Text>
      </View>

      <Card style={{ gap: 14 }}>
        <TextField
          label="Ad Soyad"
          value={fullName}
          onChangeText={(v) => {
            setFullName(v)
            setDirty(true)
          }}
        />
        <TextField
          label="Görev Unvanı"
          value={jobTitle}
          onChangeText={(v) => {
            setJobTitle(v)
            setDirty(true)
          }}
          placeholder="Ör. Bölge Satış Temsilcisi"
        />
        <TextField
          label="Telefon"
          value={phone}
          onChangeText={(v) => {
            setPhone(v)
            setDirty(true)
          }}
          keyboardType="phone-pad"
        />
        <TextField label="E-posta" value={staff.email ?? ''} editable={false} />
        {dirty && (
          <Button onPress={onSave} loading={updateStaff.isPending}>
            Kaydet
          </Button>
        )}
      </Card>
    </Screen>
  )
}
