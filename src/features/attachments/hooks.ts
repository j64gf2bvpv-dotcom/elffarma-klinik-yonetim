import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { deleteAttachment, fetchAttachments, uploadAttachment } from './api'
import type { Attachment, AttachmentOwnerType } from '@/types/database'

export function useAttachments(ownerType: AttachmentOwnerType, ownerId: string | undefined) {
  return useQuery({
    queryKey: ['attachments', ownerType, ownerId],
    queryFn: () => fetchAttachments(ownerType, ownerId as string),
    enabled: !!ownerId,
  })
}

export function useUploadAttachment(ownerType: AttachmentOwnerType, ownerId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => uploadAttachment(ownerType, ownerId, file),
    onSuccess: (created) => {
      queryClient.setQueryData<Attachment[]>(['attachments', ownerType, ownerId], (old) =>
        old ? [created, ...old] : old,
      )
      queryClient.invalidateQueries({ queryKey: ['attachments', ownerType, ownerId] })
      toast.success('Belge yüklendi')
    },
    onError: (error: Error) => toast.error('Yüklenemedi', { description: error.message }),
  })
}

export function useDeleteAttachment(ownerType: AttachmentOwnerType, ownerId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (attachment: Attachment) => deleteAttachment(attachment.id, attachment.file_path),
    onSuccess: (_data, attachment) => {
      queryClient.setQueryData<Attachment[]>(['attachments', ownerType, ownerId], (old) =>
        old?.filter((a) => a.id !== attachment.id),
      )
      queryClient.invalidateQueries({ queryKey: ['attachments', ownerType, ownerId] })
      toast.success('Belge silindi')
    },
    onError: (error: Error) => toast.error('Silinemedi', { description: error.message }),
  })
}
