import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Toast from 'react-native-toast-message'
import {
  fetchAllProductAttachments,
  fetchAttachments,
  fetchProductIdsWithAttachments,
  uploadAttachment,
  getAttachmentUrl,
  deleteAttachment,
} from './api'
import type { AttachmentOwnerType } from '@shared/types/database'

export function useAttachments(ownerType: AttachmentOwnerType, ownerId: string) {
  return useQuery({
    queryKey: ['attachments', ownerType, ownerId],
    queryFn: () => fetchAttachments(ownerType, ownerId),
    enabled: !!ownerId,
  })
}

export function useProductIdsWithAttachments() {
  return useQuery({ queryKey: ['attachments', 'product', 'ids'], queryFn: fetchProductIdsWithAttachments })
}

export function useAllProductAttachments() {
  return useQuery({ queryKey: ['attachments', 'product', 'all'], queryFn: fetchAllProductAttachments })
}

export function useUploadAttachment(ownerType: AttachmentOwnerType, ownerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ fileName, base64, contentType }: { fileName: string; base64: string; contentType?: string }) =>
      uploadAttachment(ownerType, ownerId, fileName, base64, contentType),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attachments', ownerType, ownerId] })
      Toast.show({ type: 'success', text1: 'Belge yüklendi' })
    },
    onError: () => Toast.show({ type: 'error', text1: 'Belge yüklenemedi' }),
  })
}

export function useAttachmentUrl() {
  return useMutation({ mutationFn: (path: string) => getAttachmentUrl(path) })
}

export function useDeleteAttachment(ownerType: AttachmentOwnerType, ownerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, filePath }: { id: string; filePath: string }) => deleteAttachment(id, filePath),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attachments', ownerType, ownerId] })
      Toast.show({ type: 'success', text1: 'Belge silindi' })
    },
    onError: () => Toast.show({ type: 'error', text1: 'Silinemedi' }),
  })
}
