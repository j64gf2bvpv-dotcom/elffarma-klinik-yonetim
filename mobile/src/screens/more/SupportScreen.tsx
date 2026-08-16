import * as React from 'react'
import { Linking, Text, View } from 'react-native'
import { Phone, Mail, MessageCircle, LifeBuoy } from 'lucide-react-native'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { ListItemCard } from '@/components/ui/ListItemCard'
import { useTheme } from '@/lib/ThemeContext'

// Masaüstündeki src/lib/companyInfo.ts ile aynı iletişim bilgileri.
const COMPANY_PHONE = '0(312) 309 79 79'
const COMPANY_EMAIL = 'info@elffarma.com'
const COMPANY_WHATSAPP = '905065145477'

export function SupportScreen() {
  const theme = useTheme()

  return (
    <Screen style={{ gap: 16 }}>
      <ScreenHeader title="Destek" subtitle="Bir sorun mu var, yardım mı lazım?" />

      <View style={{ alignItems: 'center', gap: 8, paddingVertical: 8 }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: theme.colors.primary + '22',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <LifeBuoy size={30} color={theme.colors.primary} />
        </View>
        <Text style={{ color: theme.colors.mutedForeground, textAlign: 'center', fontSize: theme.fontSizes.sm }}>
          Uygulamayla ilgili bir sorun, öneri ya da destek talebiniz için bize aşağıdaki kanallardan ulaşabilirsiniz.
        </Text>
      </View>

      <View style={{ gap: 8 }}>
        <ListItemCard
          icon={Phone}
          title="Telefon"
          subtitle={COMPANY_PHONE}
          onPress={() => Linking.openURL(`tel:${COMPANY_PHONE.replace(/\D/g, '')}`)}
        />
        <ListItemCard
          icon={MessageCircle}
          iconColor={theme.colors.success}
          title="WhatsApp"
          subtitle="Destek hattı"
          onPress={() => Linking.openURL(`https://wa.me/${COMPANY_WHATSAPP}`)}
        />
        <ListItemCard
          icon={Mail}
          title="E-posta"
          subtitle={COMPANY_EMAIL}
          onPress={() => Linking.openURL(`mailto:${COMPANY_EMAIL}`)}
        />
      </View>
    </Screen>
  )
}
