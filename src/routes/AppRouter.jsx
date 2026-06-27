import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '../components/shared/ProtectedRoute'
import DashboardLayout from '../components/shared/DashboardLayout'
import Login from '../pages/auth/Login'
import Register from '../pages/auth/Register'
import AdminDashboard from '../pages/admin/AdminDashboard'
import UsersManagement from '../pages/admin/UsersManagement'
import EkskulManagement from '../pages/admin/EkskulManagement'
import EnrollmentManagement from '../pages/admin/EnrollmentManagement'
import RecapManagement from '../pages/admin/RecapManagement'
import CoachDashboard from '../pages/coach/CoachDashboard'
import CoachSessions from '../pages/coach/CoachSessions'
import CoachAttendances from '../pages/coach/CoachAttendances'
import CoachGrades from '../pages/coach/CoachGrades'
import StudentDashboard from '../pages/student/StudentDashboard'
import StudentExtracurriculars from '../pages/student/StudentExtracurriculars'
import StudentExtracurricularDetail from '../pages/student/StudentExtracurricularDetail'
import StudentAttendance from '../pages/student/StudentAttendance'
import StudentGrades from '../pages/student/StudentGrades'
import ParentDashboard from '../pages/parent/ParentDashboard'
import ParentExtracurriculars from '../pages/parent/ParentExtracurriculars'
import ParentExtracurricularDetail from '../pages/parent/ParentExtracurricularDetail'
import ParentAttendance from '../pages/parent/ParentAttendance'
import ParentGrades from '../pages/parent/ParentGrades'

export default function AppRouter() {
  return (
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
  )
}
