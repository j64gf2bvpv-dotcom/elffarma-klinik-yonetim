import type { SaleStatus } from '@shared/types/database'
import type { BadgeVariant } from '@/components/ui/Badge'

export const SALE_STATUS_LABEL: Record<SaleStatus, string> = {
  bekleyen: 'Bekleyen',
  onaylandi: 'Onaylandı',
  tamamlandi: 'Tamamlandı',
}

export const SALE_STATUS_BADGE_VARIANT: Record<SaleStatus, BadgeVariant> = {
  bekleyen: 'destructive',
  onaylandi: 'success',
  tamamlandi: 'default',
}
