import { useQuery } from '@tanstack/react-query'
import { fetchCustomer, fetchCustomers, type InvoiceFilter } from './api'

export function useCustomers(search: string, invoiceFilter: InvoiceFilter = 'all', province?: string) {
  return useQuery({
    queryKey: ['customers', search, invoiceFilter, province],
    queryFn: () => fetchCustomers(search, invoiceFilter, province),
  })
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: ['customers', 'detail', id],
    queryFn: () => fetchCustomer(id as string),
    enabled: !!id,
  })
}
