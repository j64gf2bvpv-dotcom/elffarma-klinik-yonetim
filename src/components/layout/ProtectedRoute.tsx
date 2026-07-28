import { Navigate, Outlet } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

import { useAuth } from '@/lib/auth'

export function ProtectedRoute() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!session) return <Navigate to="/giris" replace />

  return <Outlet />
}

export function AdminRoute() {
  const { staff } = useAuth()
  if (staff && staff.role !== 'admin') return <Navigate to="/" replace />
  return <Outlet />
}
