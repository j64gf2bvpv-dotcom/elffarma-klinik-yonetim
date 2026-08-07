import { useQuery } from '@tanstack/react-query'
import { fetchInvoices } from './api'

export function useInvoices() {
  return useQuery({ queryKey: ['invoices'], queryFn: fetchInvoices })
}
