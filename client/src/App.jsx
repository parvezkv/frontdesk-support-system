import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import CreateTicketModal from './components/CreateTicketModal';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import TicketListPage from './pages/TicketListPage';
import TicketDetailPage from './pages/TicketDetailPage';

// Protected App Layout Wrapper
function MainLayout({ children, onOpenNewTicket }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-xs text-slate-500 font-medium">
        Loading Frontdesk Support Platform...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Determine dynamic title for header
  let pageTitle = 'Dashboard';
  let pageSubtitle = 'Operational overview, real-time SLA metrics, and queue status';

  if (location.pathname.startsWith('/tickets/')) {
    pageTitle = 'Ticket Details';
    pageSubtitle = 'Two-column resolution workspace, SLA countdown, and conversation history';
  } else if (location.pathname.startsWith('/tickets')) {
    pageTitle = 'Tickets Queue';
    pageSubtitle = 'Enterprise ticket table, multi-parameter filtering, and triage';
  }

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-900 overflow-hidden">
      {/* Dark Navy Sidebar */}
      <Sidebar onOpenNewTicket={onOpenNewTicket} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header title={pageTitle} subtitle={pageSubtitle} />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleTicketCreated = (newTicket) => {
    navigate(`/tickets/${newTicket.id}`);
  };

  return (
    <>
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />}
        />

        <Route
          path="/dashboard"
          element={
            <MainLayout onOpenNewTicket={() => setShowCreateModal(true)}>
              <DashboardPage onOpenNewTicket={() => setShowCreateModal(true)} />
            </MainLayout>
          }
        />

        <Route
          path="/tickets"
          element={
            <MainLayout onOpenNewTicket={() => setShowCreateModal(true)}>
              <TicketListPage onOpenNewTicket={() => setShowCreateModal(true)} />
            </MainLayout>
          }
        />

        <Route
          path="/tickets/:id"
          element={
            <MainLayout onOpenNewTicket={() => setShowCreateModal(true)}>
              <TicketDetailPage />
            </MainLayout>
          }
        />

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>

      {/* Global New Ticket Modal */}
      <CreateTicketModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleTicketCreated}
      />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
