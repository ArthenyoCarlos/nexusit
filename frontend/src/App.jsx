import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { ThemeProvider } from './contexts/ThemeContext'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ExecutiveDashboardPage from './pages/ExecutiveDashboardPage'
import SystemsPage from './pages/SystemsPage'
import DependencyMapPage from './pages/DependencyMapPage'
import InventoryPage from './pages/InventoryPage'
import MonitoringPage from './pages/MonitoringPage'
import UnifiApMonitoringPage from './pages/UnifiApMonitoringPage'
import TvDashboardPage from './pages/TvDashboardPage'
import TicketsPage from './pages/TicketsPage'
import NotesPage from './pages/NotesPage'
import MeetingsPage from './pages/MeetingsPage'
import AuditPage from './pages/AuditPage'
import ReportsPage from './pages/ReportsPage'
import PlanningPage from './pages/PlanningPage'
import NetworkDocsPage from './pages/NetworkDocsPage'
import ProfilePage from './pages/ProfilePage'
import SettingsPage from './pages/SettingsPage'
import NotFoundPage from './pages/NotFoundPage'
import SystemDetailPage from './pages/SystemDetailPage'
import InventoryDetailPage from './pages/InventoryDetailPage'
import VaultPage from './pages/VaultPage'
import SshConsolePage from './pages/SshConsolePage'
import NexusDeskPage from './pages/NexusDeskPage'
import SupportCrmPage from './pages/SupportCrmPage'
import SupportBotDashboardPage from './pages/SupportBotDashboardPage'
import BroadcastPage from './pages/BroadcastPage'
import TeamTrackingPage from './pages/TeamTrackingPage'
import LicensesPage from './pages/LicensesPage'
import OnboardingPage from './pages/OnboardingPage'
import OnboardingDetailPage from './pages/OnboardingDetailPage'
import OnboardingTemplatesPage from './pages/OnboardingTemplatesPage'
import UrlMonitorPage from './pages/UrlMonitorPage'
import ContractsPage from './pages/ContractsPage'
import WikiPage from './pages/WikiPage'
import WikiArticlePage from './pages/WikiArticlePage'
import MaintenanceSchedulePage from './pages/MaintenanceSchedulePage'
import FinancialPage from './pages/FinancialPage'
import TermosPage from './pages/TermosPage'
import TermoNovoPage from './pages/TermoNovoPage'
import TermoDetalhePage from './pages/TermoDetalhePage'
import TermoAssinarPage from './pages/TermoAssinarPage'
import TermoTemplatePage from './pages/TermoTemplatePage'
import HermesPage from './pages/HermesPage'
import ProtectedRoute from './components/ProtectedRoute'
import NativePushBootstrap from './components/NativePushBootstrap'

const isNative = Capacitor.isNativePlatform()

export default function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          {isNative && <NativePushBootstrap />}
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />

            {isNative ? (
              // App mobile: só o CRM de Suporte, sem o restante do NexusIT.
              <Route element={<ProtectedRoute />}>
                <Route path="/support-crm" element={<SupportCrmPage />} />
                <Route path="*" element={<Navigate to="/support-crm" replace />} />
              </Route>
            ) : (
              <>
                <Route path="/dashboard/tv" element={<TvDashboardPage />} />

                {/* Protected routes */}
                <Route element={<ProtectedRoute />}>
                  <Route path="/dashboard"  element={<DashboardPage />} />
                  <Route path="/dashboard/executive" element={<ExecutiveDashboardPage />} />
                  <Route path="/hermes"     element={<HermesPage />} />
                  <Route path="/monitoring" element={<MonitoringPage />} />
                  <Route path="/monitoring/aps" element={<UnifiApMonitoringPage />} />
                  <Route path="/systems"        element={<SystemsPage />} />
                  <Route path="/dependency-map" element={<DependencyMapPage />} />
                  <Route path="/systems/:id"   element={<SystemDetailPage />} />
                  <Route path="/inventory"     element={<InventoryPage />} />
                  <Route path="/inventory/:id" element={<InventoryDetailPage />} />
                  <Route path="/tickets"    element={<TicketsPage />} />
                  <Route path="/notes"      element={<NotesPage />} />
                  <Route path="/meetings"   element={<MeetingsPage />} />
                  <Route path="/audit"      element={<AuditPage />} />
                  <Route path="/reports"    element={<ReportsPage />} />
                  <Route path="/planning"   element={<PlanningPage />} />
                  <Route path="/network"    element={<NetworkDocsPage />} />
                  <Route path="/profile"    element={<ProfilePage />} />
                  <Route path="/settings"        element={<SettingsPage />} />
                  <Route path="/vault"           element={<VaultPage />} />
                  <Route path="/ssh-console"     element={<SshConsolePage />} />
                  <Route path="/nexusdesk"       element={<NexusDeskPage />} />
                  <Route path="/support-crm"     element={<SupportCrmPage />} />
                  <Route path="/support-bot"     element={<SupportBotDashboardPage />} />
                  <Route path="/broadcast"       element={<BroadcastPage />} />
                  <Route path="/team-tracking"   element={<TeamTrackingPage />} />
                  <Route path="/licenses"        element={<LicensesPage />} />
                  <Route path="/onboarding"           element={<OnboardingPage />} />
                  <Route path="/onboarding/templates" element={<OnboardingTemplatesPage />} />
                  <Route path="/onboarding/:id"       element={<OnboardingDetailPage />} />
                  <Route path="/url-monitor"          element={<UrlMonitorPage />} />
                  <Route path="/contracts"            element={<ContractsPage />} />
                  <Route path="/wiki"                 element={<WikiPage />} />
                  <Route path="/wiki/:id"             element={<WikiArticlePage />} />
                  <Route path="/maintenance-schedule" element={<MaintenanceSchedulePage />} />
                  <Route path="/financial"            element={<FinancialPage />} />
                  <Route path="/termos"               element={<TermosPage />} />
                  <Route path="/termos/novo"          element={<TermoNovoPage />} />
                  <Route path="/termos/template"      element={<TermoTemplatePage />} />
                  <Route path="/termos/:id"           element={<TermoDetalhePage />} />
                  <Route path="/termos/:id/assinar"   element={<TermoAssinarPage />} />
                  <Route path="/"               element={<Navigate to="/dashboard" replace />} />
                </Route>

                <Route path="*" element={<NotFoundPage />} />
              </>
            )}
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
    </ThemeProvider>
  )
}
