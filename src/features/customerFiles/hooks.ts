import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { deleteCustomerFile, fetchCustomerFiles, uploadCustomerFile } from './api'
import type { CustomerFile } from '@/types/database'

export function useCustomerFiles(customerId: string | undefined) {
  return useQuery({
    queryKey: ['customer_files', customerId],
    queryFn: () => fetchCustomerFiles(customerId as string),
    enabled: !!customerId,
  })
}

export function useUploadCustomerFile(customerId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => uploadCustomerFile(customerId, file),
    onSuccess: (created) => {
      queryClient.setQueryData<CustomerFile[]>(['customer_files', customerId], (old) =>
        old ? [created, ...old] : old,
      )
      queryClient.invalidateQueries({ queryKey: ['customer_files', customerId] })
      toast.success('Dosya yüklendi')
    },
    onError: (error: Error) => toast.error('Yüklenemedi', { description: error.message }),
  })
}

export function useDeleteCustomerFile(customerId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, filePath }: { id: string; filePath: string }) => deleteCustomerFile(id, filePath),
    onSuccess: (_data, { id }) => {
      queryClient.setQueryData<CustomerFile[]>(['customer_files', customerId], (old) =>
        old?.filter((f) => f.id !== id),
      )
      queryClient.invalidateQueries({ queryKey: ['customer_files', customerId] })
      toast.success('Dosya silindi')
    },
    onError: (error: Error) => toast.error('Silinemedi', { description: error.message }),
  })
}
