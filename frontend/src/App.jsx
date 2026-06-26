import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import SystemsPage from './pages/SystemsPage'
import InventoryPage from './pages/InventoryPage'
import MonitoringPage from './pages/MonitoringPage'
import TvDashboardPage from './pages/TvDashboardPage'
import TicketsPage from './pages/TicketsPage'
import NotesPage from './pages/NotesPage'
import PlanningPage from './pages/PlanningPage'
import NetworkDocsPage from './pages/NetworkDocsPage'
import ProfilePage from './pages/ProfilePage'
import SettingsPage from './pages/SettingsPage'
import NotFoundPage from './pages/NotFoundPage'
import SystemDetailPage from './pages/SystemDetailPage'
import InventoryDetailPage from './pages/InventoryDetailPage'
import ProtectedRoute from './components/ProtectedRoute'

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard/tv" element={<TvDashboardPage />} />

            {/* Protected routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard"  element={<DashboardPage />} />
              <Route path="/monitoring" element={<MonitoringPage />} />
              <Route path="/systems"        element={<SystemsPage />} />
              <Route path="/systems/:id"   element={<SystemDetailPage />} />
              <Route path="/inventory"     element={<InventoryPage />} />
              <Route path="/inventory/:id" element={<InventoryDetailPage />} />
              <Route path="/tickets"    element={<TicketsPage />} />
              <Route path="/notes"      element={<NotesPage />} />
              <Route path="/planning"   element={<PlanningPage />} />
              <Route path="/network"    element={<NetworkDocsPage />} />
              <Route path="/profile"    element={<ProfilePage />} />
              <Route path="/settings"   element={<SettingsPage />} />
              <Route path="/"           element={<Navigate to="/dashboard" replace />} />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}
