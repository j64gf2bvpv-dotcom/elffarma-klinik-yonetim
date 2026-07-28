import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fetchInvoices, createInvoice, deleteInvoice, type InvoiceInput, type InvoiceWithCustomer } from './api'

export function useInvoices() {
  return useQuery({ queryKey: ['invoices'], queryFn: fetchInvoices })
}

export function useCreateInvoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: InvoiceInput) => createInvoice(input),
    onSuccess: (created) => {
      queryClient.setQueryData<InvoiceWithCustomer[]>(['invoices'], (old) =>
        old ? [{ ...created, customers: null }, ...old] : old,
      )
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      toast.success('Fatura kaydedildi')
    },
    onError: (error: Error) => toast.error('Kaydedilemedi', { description: error.message }),
  })
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteInvoice(id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<InvoiceWithCustomer[]>(['invoices'], (old) => old?.filter((inv) => inv.id !== id))
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      toast.success('Fatura silindi')
    },
    onError: (error: Error) => toast.error('Silinemedi', { description: error.message }),
  })
}
