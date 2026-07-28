import type { LucideIcon } from 'lucide-react'
import {
  Gauge,
  UserRound,
  PackageSearch,
  Banknote,
  Presentation,
  Stethoscope,
  SlidersHorizontal,
  LayoutDashboard,
  Users,
  Boxes,
  Wallet,
  GraduationCap,
  HeartPulse,
  Settings2,
  PieChart,
  CircleUserRound,
  PackageCheck,
  CircleDollarSign,
  Landmark,
  ClipboardPlus,
  Settings,
  ShoppingCart,
  BellRing,
  CalendarDays,
  Receipt,
  NotebookText,
  HandCoins,
  Target,
  TrendingUp,
  PiggyBank,
  ReceiptText,
  CreditCard,
  Coins,
} from 'lucide-react'

export type NavKey =
  | 'dashboard'
  | 'customers'
  | 'stock'
  | 'payments'
  | 'congresses'
  | 'doctorVisits'
  | 'sales'
  | 'cariHesap'
  | 'expenses'
  | 'budget'
  | 'reminders'
  | 'agenda'
  | 'settings'

export type IconVariant = 'outline' | 'bold' | '3d'

export interface IconSet {
  id: string
  label: string
  variant: IconVariant
  strokeWidth: number
  icons: Record<NavKey, LucideIcon>
}

export const iconSets: IconSet[] = [
  {
    id: 'klasik',
    label: 'Klasik (İnce)',
    variant: 'outline',
    strokeWidth: 1.75,
    icons: {
      dashboard: Gauge,
      customers: UserRound,
      stock: PackageSearch,
      payments: Banknote,
      congresses: Presentation,
      doctorVisits: Stethoscope,
      sales: ShoppingCart,
      cariHesap: Receipt,
      expenses: ReceiptText,
      budget: Target,
      reminders: BellRing,
      agenda: CalendarDays,
      settings: SlidersHorizontal,
    },
  },
  {
    id: 'modern',
    label: 'Modern (Kalın)',
    variant: 'bold',
    strokeWidth: 2.5,
    icons: {
      dashboard: LayoutDashboard,
      customers: Users,
      stock: Boxes,
      payments: Wallet,
      congresses: GraduationCap,
      doctorVisits: HeartPulse,
      sales: ShoppingCart,
      cariHesap: NotebookText,
      expenses: CreditCard,
      budget: TrendingUp,
      reminders: BellRing,
      agenda: CalendarDays,
      settings: Settings2,
    },
  },
  {
    id: '3d',
    label: '3D (Premium)',
    variant: '3d',
    strokeWidth: 2,
    icons: {
      dashboard: PieChart,
      customers: CircleUserRound,
      stock: PackageCheck,
      payments: CircleDollarSign,
      congresses: Landmark,
      doctorVisits: ClipboardPlus,
      sales: ShoppingCart,
      cariHesap: HandCoins,
      expenses: Coins,
      budget: PiggyBank,
      reminders: BellRing,
      agenda: CalendarDays,
      settings: Settings,
    },
  },
]

export const defaultIconSetId = 'klasik'

export function getIconSet(id: string | null | undefined): IconSet {
  return iconSets.find((s) => s.id === id) ?? iconSets[0]
}
