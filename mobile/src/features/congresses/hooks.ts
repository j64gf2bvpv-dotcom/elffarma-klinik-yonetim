import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Toast from 'react-native-toast-message'
import {
  fetchCongresses,
  fetchParticipants,
  fetchParticipationsByDoctorName,
  createParticipant,
  updateAttendanceStatus,
  type CreateParticipantInput,
} from './api'
import type { AttendanceStatus } from '@shared/types/database'

export function useCongresses() {
  return useQuery({ queryKey: ['congresses'], queryFn: fetchCongresses })
}

export function useParticipants(congressId: string | undefined) {
  return useQuery({
    queryKey: ['congress_participants', congressId],
    queryFn: () => fetchParticipants(congressId as string),
    enabled: !!congressId,
  })
}

export function useParticipationsByDoctorName(doctorName: string | undefined) {
  return useQuery({
    queryKey: ['congress_participations', doctorName],
    queryFn: () => fetchParticipationsByDoctorName(doctorName as string),
    enabled: !!doctorName,
  })
}

export function useCreateParticipant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateParticipantInput) => createParticipant(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['congress_participants'] })
      Toast.show({ type: 'success', text1: 'Katılımcı eklendi' })
    },
    onError: () => Toast.show({ type: 'error', text1: 'Eklenemedi' }),
  })
}

export function useUpdateAttendanceStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: AttendanceStatus }) => updateAttendanceStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['congress_participants'] }),
    onError: () => Toast.show({ type: 'error', text1: 'Güncellenemedi' }),
  })
}
