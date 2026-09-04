import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import TicketListPage from './pages/TicketListPage'
import TicketNewPage from './pages/TicketNewPage'
import TicketDetailPage from './pages/TicketDetailPage'
import DashboardPage from './pages/DashboardPage'
import AdminUsersPage from './pages/AdminUsersPage'
import LegalPage from './pages/LegalPage'
import ImprintPage from './pages/ImprintPage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<LoginPage initialMode="register" />} />
        <Route path="/tickets" element={<TicketListPage />} />
        <Route path="/tickets/new" element={<TicketNewPage />} />
        <Route path="/tickets/:id" element={<TicketDetailPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/admin/users" element={<AdminUsersPage />} />
        <Route path="/datenschutz" element={<LegalPage />} />
        <Route path="/impressum" element={<ImprintPage />} />
      </Route>
    </Routes>
  )
}
