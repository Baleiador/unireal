import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { Dashboard } from './pages/Dashboard';
import { Ranking } from './pages/Ranking';
import { Transfer } from './pages/Transfer';
import { Admin } from './pages/Admin';
import { Investments } from './pages/Investments';
import { MyQRCode } from './pages/MyQRCode';
import { Maintenance } from './pages/Maintenance';
import { AnnouncementModal } from './components/AnnouncementModal';
import { supabase } from './lib/supabase';

function MaintenanceGuard({ children }: { children: React.ReactNode }) {
  const { profile, loading: authLoading } = useAuth();
  const [maintenance, setMaintenance] = React.useState({ active: false, message: '' });
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function checkMaintenance() {
      try {
        const { data } = await supabase
          .from('settings')
          .select('key, value');
        
        if (data) {
          const active = data.find(s => s.key === 'maintenance_mode')?.value === true;
          const message = data.find(s => s.key === 'maintenance_message')?.value || '';
          setMaintenance({ active, message });
        }
      } catch (err) {
        console.error("Maint check error:", err);
      } finally {
        setLoading(false);
      }
    }

    checkMaintenance();
  }, [profile]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-gray">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-orange"></div>
      </div>
    );
  }

  // If maintenance is ON and user is NOT admin -> Block
  if (maintenance.active && profile && !profile.is_admin) {
    return <Maintenance message={maintenance.message} />;
  }

  return <>{children}</>;
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-gray">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-orange"></div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  React.useEffect(() => {
    // 1. Listen for the PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        window.location.hash = '#/reset-password';
      }
    });

    // 2. Check if we landed with recovery parameters but event didn't fire yet
    if (window.location.href.includes('type=recovery') || window.location.hash.includes('access_token=')) {
      if (!window.location.hash.includes('/reset-password')) {
        // Only redirect if we are not already going there
        setTimeout(() => {
          window.location.hash = '#/reset-password';
        }, 500);
      }
    }

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <MaintenanceGuard>
                  <AnnouncementModal />
                  <Layout />
                </MaintenanceGuard>
              </PrivateRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="ranking" element={<Ranking />} />
            <Route path="transfer" element={<Transfer />} />
            <Route path="investments" element={<Investments />} />
            <Route path="admin" element={<Admin />} />
            <Route path="my-qr" element={<MyQRCode />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}
