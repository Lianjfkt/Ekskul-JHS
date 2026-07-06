import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '../components/shared/ProtectedRoute'
import DashboardLayout from '../components/shared/DashboardLayout'
import Login from '../pages/auth/Login'
import Register from '../pages/auth/Register'

// Lazy load components to optimize initial load bundle sizes
const AdminDashboard = lazy(() => import('../pages/admin/AdminDashboard'))
const UsersManagement = lazy(() => import('../pages/admin/UsersManagement'))
const EkskulManagement = lazy(() => import('../pages/admin/EkskulManagement'))
const EnrollmentManagement = lazy(() => import('../pages/admin/EnrollmentManagement'))
const RecapManagement = lazy(() => import('../pages/admin/RecapManagement'))
const CoachDashboard = lazy(() => import('../pages/coach/CoachDashboard'))
const CoachSessions = lazy(() => import('../pages/coach/CoachSessions'))
const CoachAttendances = lazy(() => import('../pages/coach/CoachAttendances'))
const CoachGrades = lazy(() => import('../pages/coach/CoachGrades'))
const StudentDashboard = lazy(() => import('../pages/student/StudentDashboard'))
const StudentExtracurriculars = lazy(() => import('../pages/student/StudentExtracurriculars'))
const StudentExtracurricularDetail = lazy(() => import('../pages/student/StudentExtracurricularDetail'))
const StudentAttendance = lazy(() => import('../pages/student/StudentAttendance'))
const StudentGrades = lazy(() => import('../pages/student/StudentGrades'))
const ParentDashboard = lazy(() => import('../pages/parent/ParentDashboard'))
const ParentExtracurriculars = lazy(() => import('../pages/parent/ParentExtracurriculars'))
const ParentExtracurricularDetail = lazy(() => import('../pages/parent/ParentExtracurricularDetail'))
const ParentAttendance = lazy(() => import('../pages/parent/ParentAttendance'))
const ParentGrades = lazy(() => import('../pages/parent/ParentGrades'))

export default function AppRouter() {
  return (
    <Suspense fallback={
      <div className="flex h-screen w-screen items-center justify-center bg-pixel-navy text-pixel-peach font-retro text-2xl">
        <span className="pixel-blink">LOADING SYSTEM...</span>
      </div>
    }>
      <Routes>
        <Route path="/" element={<Navigate to="/auth/login" replace />} />
        <Route path="/auth/login" element={<Login />} />
        <Route path="/auth/register" element={<Register />} />

        {/* Dashboard Layout Wrapper for Protected Routes */}
        <Route element={<DashboardLayout />}>
          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/users" element={<UsersManagement />} />
            <Route path="/admin/extracurriculars" element={<EkskulManagement />} />
            <Route path="/admin/enrollments" element={<EnrollmentManagement />} />
            <Route path="/admin/recap" element={<RecapManagement />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['coach']} />}>
            <Route path="/coach/dashboard" element={<CoachDashboard />} />
            <Route path="/coach/sessions" element={<CoachSessions />} />
            <Route path="/coach/attendances" element={<CoachAttendances />} />
            <Route path="/coach/grades" element={<CoachGrades />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['student']} />}>
            <Route path="/student/dashboard" element={<StudentDashboard />} />
            <Route path="/student/extracurriculars" element={<StudentExtracurriculars />} />
            <Route path="/student/extracurriculars/:id" element={<StudentExtracurricularDetail />} />
            <Route path="/student/attendance" element={<StudentAttendance />} />
            <Route path="/student/grades" element={<StudentGrades />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['parent']} />}>
            <Route path="/parent/dashboard" element={<ParentDashboard />} />
            <Route path="/parent/extracurriculars" element={<ParentExtracurriculars />} />
            <Route path="/parent/extracurriculars/:id" element={<ParentExtracurricularDetail />} />
            <Route path="/parent/attendance" element={<ParentAttendance />} />
            <Route path="/parent/grades" element={<ParentGrades />} />
          </Route>
        </Route>
        
        {/* Fallback route */}
        <Route path="*" element={<Navigate to="/auth/login" replace />} />
      </Routes>
    </Suspense>
  )
}
