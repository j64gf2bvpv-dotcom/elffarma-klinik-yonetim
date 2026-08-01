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
  Building2,
  Building,
  Hospital,
  Percent,
  BadgePercent,
  Award,
  FlaskConical,
  TestTube,
  Beaker,
  Handshake,
  Users2,
  UserCheck,
  Sparkles,
  BrainCircuit,
  Bot,
  LayoutPanelLeft,
  Contact,
  Gem,
  Syringe,
  Archive,
  WalletCards,
  ShoppingBag,
  FileSpreadsheet,
  LineChart,
  AlarmClock,
  Cog,
  User,
  TestTubes,
  UsersRound,
  Wand2,
  Package,
  Mic2,
  ClipboardList,
  Store,
  BookOpen,
  Bell,
  Calendar,
  AtSign,
  Camera,
  UserSearch,
  Contact2,
} from 'lucide-react'

export type NavKey =
  | 'dashboard'
  | 'customers'
  | 'clinics'
  | 'commissions'
  | 'samples'
  | 'crm'
  | 'aiInsights'
  | 'instagramLeads'
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

export type IconVariant = 'outline' | 'bold' | '3d' | 'duotone' | 'thin'

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
      clinics: Building2,
      commissions: Percent,
      samples: FlaskConical,
      crm: Handshake,
      aiInsights: Sparkles,
      instagramLeads: AtSign,
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
      clinics: Building,
      commissions: BadgePercent,
      samples: TestTube,
      crm: Users2,
      aiInsights: BrainCircuit,
      instagramLeads: Camera,
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
      clinics: Hospital,
      commissions: Award,
      samples: Beaker,
      crm: UserCheck,
      aiInsights: Bot,
      instagramLeads: UserSearch,
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
  {
    id: 'duotone',
    label: 'Duotone (Premium)',
    variant: 'duotone',
    strokeWidth: 1.75,
    icons: {
      dashboard: LayoutPanelLeft,
      customers: Contact,
      clinics: Building2,
      commissions: Gem,
      samples: Syringe,
      crm: Handshake,
      aiInsights: Sparkles,
      instagramLeads: AtSign,
      stock: Archive,
      payments: WalletCards,
      congresses: Presentation,
      doctorVisits: Stethoscope,
      sales: ShoppingBag,
      cariHesap: FileSpreadsheet,
      expenses: Wallet,
      budget: LineChart,
      reminders: AlarmClock,
      agenda: CalendarDays,
      settings: Cog,
    },
  },
  {
    id: 'thin',
    label: 'İnce Çizgi (Minimal)',
    variant: 'thin',
    strokeWidth: 1.25,
    icons: {
      dashboard: LayoutDashboard,
      customers: User,
      clinics: Hospital,
      commissions: Percent,
      samples: TestTubes,
      crm: UsersRound,
      aiInsights: Wand2,
      instagramLeads: Contact2,
      stock: Package,
      payments: CreditCard,
      congresses: Mic2,
      doctorVisits: ClipboardList,
      sales: Store,
      cariHesap: BookOpen,
      expenses: Receipt,
      budget: Target,
      reminders: Bell,
      agenda: Calendar,
      settings: Settings,
    },
  },
]

export const defaultIconSetId = 'klasik'

export function getIconSet(id: string | null | undefined): IconSet {
  return iconSets.find((s) => s.id === id) ?? iconSets[0]
}
