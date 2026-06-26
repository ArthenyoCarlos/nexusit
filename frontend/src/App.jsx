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
import VaultPage from './pages/VaultPage'
import LicensesPage from './pages/LicensesPage'
import OnboardingPage from './pages/OnboardingPage'
import OnboardingDetailPage from './pages/OnboardingDetailPage'
import UrlMonitorPage from './pages/UrlMonitorPage'
import ContractsPage from './pages/ContractsPage'
import WikiPage from './pages/WikiPage'
import WikiArticlePage from './pages/WikiArticlePage'
import MaintenanceSchedulePage from './pages/MaintenanceSchedulePage'
import FinancialPage from './pages/FinancialPage'
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
              <Route path="/settings"        element={<SettingsPage />} />
              <Route path="/vault"           element={<VaultPage />} />
              <Route path="/licenses"        element={<LicensesPage />} />
              <Route path="/onboarding"      element={<OnboardingPage />} />
              <Route path="/onboarding/:id"  element={<OnboardingDetailPage />} />
              <Route path="/url-monitor"          element={<UrlMonitorPage />} />
              <Route path="/contracts"            element={<ContractsPage />} />
              <Route path="/wiki"                 element={<WikiPage />} />
              <Route path="/wiki/:id"             element={<WikiArticlePage />} />
              <Route path="/maintenance-schedule" element={<MaintenanceSchedulePage />} />
              <Route path="/financial"            element={<FinancialPage />} />
              <Route path="/"               element={<Navigate to="/dashboard" replace />} />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}
