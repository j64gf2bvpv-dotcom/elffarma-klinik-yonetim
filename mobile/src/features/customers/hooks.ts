import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createCustomer, fetchCustomer, fetchCustomers, type CreateCustomerInput, type InvoiceFilter } from './api'

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

export function useCreateCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateCustomerInput) => createCustomer(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers'] }),
  })
}
