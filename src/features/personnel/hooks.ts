import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createPersonnel,
  deletePersonnel,
  deletePersonnelDocument,
  fetchPersonnel,
  fetchPersonnelDocuments,
  savePersonnelDocument,
  updatePersonnel,
  type PersonnelDocumentInput,
  type PersonnelInput,
} from './api'
import type { Personnel, PersonnelDocument } from '@/types/database'

export function usePersonnel() {
  return useQuery({ queryKey: ['personnel'], queryFn: fetchPersonnel })
}

export function usePersonnelDocuments(personnelId?: string) {
  return useQuery({ queryKey: ['personnel_documents', personnelId ?? 'all'], queryFn: () => fetchPersonnelDocuments(personnelId) })
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['personnel'] })
  qc.invalidateQueries({ queryKey: ['personnel_documents'] })
}

export function useSavePersonnel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: PersonnelInput }) => (id ? updatePersonnel(id, input) : createPersonnel(input)),
    onSuccess: (_d, { id }) => {
      invalidate(qc)
      toast.success(id ? 'Personel güncellendi' : 'Personel eklendi')
    },
    onError: (e: Error) => toast.error('Kaydedilemedi', { description: e.message }),
  })
}

export function useDeletePersonnel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ person, docs }: { person: Personnel; docs: PersonnelDocument[] }) => deletePersonnel(person, docs),
    onSuccess: () => {
      invalidate(qc)
      toast.success('Personel silindi')
    },
    onError: (e: Error) => toast.error('Silinemedi', { description: e.message }),
  })
}

export function useSavePersonnelDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: PersonnelDocumentInput }) => savePersonnelDocument(id, input),
    onSuccess: (_d, { id }) => {
      invalidate(qc)
      toast.success(id ? 'Evrak güncellendi' : 'Evrak eklendi')
    },
    onError: (e: Error) => toast.error('Kaydedilemedi', { description: e.message }),
  })
}

export function useDeletePersonnelDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (doc: PersonnelDocument) => deletePersonnelDocument(doc),
    onSuccess: () => {
      invalidate(qc)
      toast.success('Evrak silindi')
    },
    onError: (e: Error) => toast.error('Silinemedi', { description: e.message }),
  })
}
