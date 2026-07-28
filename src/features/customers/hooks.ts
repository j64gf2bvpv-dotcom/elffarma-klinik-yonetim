import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createCustomer,
  createPendingProduct,
  deleteCustomer,
  deletePendingProduct,
  fetchAllPendingProducts,
  fetchCustomer,
  fetchCustomers,
  fetchHospitalNames,
  fetchPendingProducts,
  updateCustomer,
  type CustomerInput,
  type InvoiceFilter,
  type PendingProductInput,
} from './api'
import type { Customer, CustomerPendingProduct } from '@/types/database'

const customerListPredicate = (query: { queryKey: readonly unknown[] }) =>
  query.queryKey[1] !== 'hospital_names' && query.queryKey[1] !== 'detail'

export function useCustomers(search: string, invoiceFilter: InvoiceFilter = 'all', province?: string) {
  return useQuery({
    queryKey: ['customers', search, invoiceFilter, province],
    queryFn: () => fetchCustomers(search, invoiceFilter, province),
  })
}

export function useHospitalNames() {
  return useQuery({ queryKey: ['customers', 'hospital_names'], queryFn: fetchHospitalNames })
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
    mutationFn: (input: CustomerInput) => createCustomer(input),
    onSuccess: (created) => {
      queryClient.setQueriesData<Customer[]>({ queryKey: ['customers'], predicate: customerListPredicate }, (old) =>
        old ? [...old, created].sort((a, b) => a.full_name.localeCompare(b.full_name, 'tr')) : old,
      )
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      toast.success('Doktor eklendi')
    },
    onError: (error: Error) => toast.error('Doktor eklenemedi', { description: error.message }),
  })
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CustomerInput }) => updateCustomer(id, input),
    onSuccess: (updated, { id }) => {
      queryClient.setQueriesData<Customer[]>({ queryKey: ['customers'], predicate: customerListPredicate }, (old) =>
        old?.map((c) => (c.id === id ? { ...c, ...updated } : c)),
      )
      queryClient.setQueryData<Customer>(['customers', 'detail', id], (old) => (old ? { ...old, ...updated } : old))
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      toast.success('Doktor güncellendi')
    },
    onError: (error: Error) => toast.error('Güncellenemedi', { description: error.message }),
  })
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteCustomer(id),
    onSuccess: (_data, id) => {
      queryClient.setQueriesData<Customer[]>({ queryKey: ['customers'], predicate: customerListPredicate }, (old) =>
        old?.filter((c) => c.id !== id),
      )
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      toast.success('Doktor silindi')
    },
    onError: (error: Error) => toast.error('Silinemedi', { description: error.message }),
  })
}

export function usePendingProducts(customerId: string | undefined) {
  return useQuery({
    queryKey: ['customer_pending_products', customerId],
    queryFn: () => fetchPendingProducts(customerId as string),
    enabled: !!customerId,
  })
}

export function useAllPendingProducts() {
  return useQuery({ queryKey: ['customer_pending_products', 'all'], queryFn: fetchAllPendingProducts })
}

export function useCreatePendingProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PendingProductInput) => createPendingProduct(input),
    onSuccess: (created) => {
      queryClient.setQueriesData<CustomerPendingProduct[]>({ queryKey: ['customer_pending_products'] }, (old) =>
        old ? [...old, created] : old,
      )
      queryClient.invalidateQueries({ queryKey: ['customer_pending_products'] })
      toast.success('Eksik ürün eklendi')
    },
    onError: (error: Error) => toast.error('Eklenemedi', { description: error.message }),
  })
}

export function useDeletePendingProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deletePendingProduct(id),
    onSuccess: (_data, id) => {
      queryClient.setQueriesData<CustomerPendingProduct[]>({ queryKey: ['customer_pending_products'] }, (old) =>
        old?.filter((p) => p.id !== id),
      )
      queryClient.invalidateQueries({ queryKey: ['customer_pending_products'] })
      toast.success('Ürün kaldırıldı')
    },
    onError: (error: Error) => toast.error('Silinemedi', { description: error.message }),
  })
}
