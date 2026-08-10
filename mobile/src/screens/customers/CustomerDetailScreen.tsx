import * as React from 'react'
import { FlatList, Text, View } from 'react-native'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Screen } from '@/components/ui/Screen'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useTheme } from '@/lib/ThemeContext'
import { useCustomer } from '@/features/customers/hooks'
import { usePayments } from '@/features/payments/hooks'
import { useSales } from '@/features/sales/hooks'
import { useInvoices } from '@/features/invoices/hooks'
import type { CustomersStackParamList } from '@/navigation/types'

type Props = NativeStackScreenProps<CustomersStackParamList, 'CustomerDetail'>

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })
}

interface LedgerRow {
  key: string
  date: string
  type: 'Tahsilat' | 'Satış' | 'İade' | 'Fatura'
  description: string
  debit: number
  credit: number
}

/** Masaüstündeki CariHesapPage.tsx'in mobil karşılığı — aynı hareket
 * dökümü mantığı (tahsilat/satış/iade/fatura tek kronolojik listede). */
export function CustomerDetailScreen({ route, navigation }: Props) {
  const { customerId, customerName } = route.params
  const theme = useTheme()
  React.useLayoutEffect(() => navigation.setOptions({ title: customerName }), [navigation, customerName])

  const { data: customer } = useCustomer(customerId)
  const { data: payments = [] } = usePayments({ customerId })
  const { data: allSales = [] } = useSales()
  const { data: allInvoices = [] } = useInvoices()

  const sales = React.useMemo(() => allSales.filter((s) => s.customer_id === customerId), [allSales, customerId])
  const invoices = React.useMemo(() => allInvoices.filter((inv) => inv.customer_id === customerId), [allInvoices, customerId])

  const rows = React.useMemo<LedgerRow[]>(() => {
    const list: LedgerRow[] = []
    for (const p of payments) {
      list.push({ key: `pay-${p.id}`, date: p.paid_at, type: 'Tahsilat', description: p.description || 'Tahsilat', debit: 0, credit: Number(p.amount) })
    }
    for (const s of sales) {
      const amount = s.quantity * Number(s.unit_price)
      if (s.type === 'sale') {
        list.push({ key: `sale-${s.id}`, date: s.sale_date, type: 'Satış', description: s.product_name, debit: amount, credit: 0 })
      } else {
        list.push({ key: `sale-${s.id}`, date: s.sale_date, type: 'İade', description: s.product_name, debit: 0, credit: amount })
      }
    }
    for (const inv of invoices) {
      list.push({ key: `inv-${inv.id}`, date: inv.issue_date, type: 'Fatura', description: `Fatura No: ${inv.invoice_number}`, debit: Number(inv.amount), credit: 0 })
    }
    return list.sort((a, b) => b.date.localeCompare(a.date))
  }, [payments, sales, invoices])

  const totalDebit = rows.reduce((sum, r) => sum + r.debit, 0)
  const totalCredit = rows.reduce((sum, r) => sum + r.credit, 0)
  const balance = totalDebit - totalCredit

  return (
    <Screen>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.key}
        ListHeaderComponent={
          <View style={{ marginBottom: 16, gap: 12 }}>
            <Card>
              <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.lg, fontWeight: '700' }}>
                {customer?.full_name ?? customerName}
              </Text>
              {customer?.phone && (
                <Text style={{ color: theme.colors.mutedForeground, marginTop: 2 }}>{customer.phone}</Text>
              )}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
                <View>
                  <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>Borç</Text>
                  <Text style={{ color: theme.colors.foreground, fontWeight: '600' }}>{currency(totalDebit)}</Text>
                </View>
                <View>
                  <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>Alacak</Text>
                  <Text style={{ color: theme.colors.foreground, fontWeight: '600' }}>{currency(totalCredit)}</Text>
                </View>
                <View>
                  <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>Bakiye</Text>
                  <Badge variant={balance > 0 ? 'destructive' : 'secondary'}>{currency(balance)}</Badge>
                </View>
              </View>
            </Card>
            <Text style={{ color: theme.colors.foreground, fontWeight: '600' }}>Hareketler</Text>
          </View>
        }
        ListEmptyComponent={<Text style={{ color: theme.colors.mutedForeground }}>Hareket yok</Text>}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: theme.colors.border }} />}
        renderItem={({ item }) => (
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.foreground, fontWeight: '500' }}>{item.description}</Text>
              <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>
                {item.type} · {format(new Date(item.date), 'd MMM yyyy', { locale: trLocale })}
              </Text>
            </View>
            <Text style={{ color: item.debit > 0 ? theme.colors.destructive : theme.colors.success, fontWeight: '600' }}>
              {item.debit > 0 ? currency(item.debit) : `+${currency(item.credit)}`}
            </Text>
          </View>
        )}
      />
    </Screen>
  )
}
