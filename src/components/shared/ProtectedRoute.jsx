import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'

export const ProtectedRoute = ({ allowedRoles }) => {
  const { user, role, isLoading } = useAuthStore()

  if (isLoading) {
    return <div className="flex h-screen w-screen items-center justify-center">Loading...</div>
  }

  if (!user) {
    return <Navigate to="/auth/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    // If logged in but wrong role, redirect to their appropriate dashboard
    return <Navigate to={`/${role}/dashboard`} replace />
  }

  return <Outlet />
}
