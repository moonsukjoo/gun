import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/AuthProvider';
import { NotificationHandler } from './components/NotificationHandler';
import { FontSizeManager } from './components/FontSizeManager';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { EmployeeManagement } from './pages/EmployeeManagement';
import { Attendance } from './pages/Attendance';
import { AccidentReport } from './pages/AccidentReport';
import { Notifications } from './pages/Notifications';
import { Notices } from './pages/Notices';
import { Leave } from './pages/Leave';
import { Coupons } from './pages/Coupons';
import { Entertainment } from './pages/Entertainment';
import { Lotto } from './pages/Lotto';
import { MyPage } from './pages/MyPage';
import { Qualification } from './pages/Qualification';
import { ShipAssembly } from './pages/ShipAssembly';
import { TrainingManagement } from './pages/TrainingManagement';
import { TrainingList } from './pages/TrainingList';
import { SafetyRanking } from './pages/SafetyRanking';
import { Redemption } from './pages/Redemption';
import { RedemptionManagement } from './pages/RedemptionManagement';
import { AttendanceManagement } from './pages/AttendanceManagement';
import { Admin } from './pages/Admin';
import { Toaster } from '@/components/ui/sonner';

const ProtectedRoute = ({ children, roles, permission }: { children: React.ReactNode, roles?: string[], permission?: string }) => {
  const { user, profile, loading } = useAuth();
  const location = window.location;

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-[#0a0a0a] space-y-12 p-6 overflow-hidden">
      <div className="relative flex items-center justify-center">
        {/* Outer Glow Ring */}
        <div className="absolute w-32 h-32 rounded-full border-2 border-primary/20 animate-[pulse_2s_infinite]" />
        
        {/* Rotating Spinner */}
        <div className="absolute w-28 h-28 border-[3px] border-transparent border-t-primary rounded-full animate-spin" />
        
        {/* Core Logo Container */}
        <div className="relative w-20 h-20 bg-white rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center justify-center p-5 z-10">
          <img src="/company_logo.png" alt="Company Logo" className="w-full h-full object-contain" />
        </div>
      </div>
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="space-y-1">
          <span className="font-black text-3xl tracking-tighter text-white leading-none block">건명기업</span>
        </div>
        <div className="flex gap-1.5">
           {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
        </div>
      </div>
    </div>
  );
  if (!user) return <Navigate to="/login" />;
  
  const hasAccess = (() => {
    if (!roles && !permission) return true;
    if (!profile) return false;
    if (roles && roles.includes(profile.role)) return true;
    if (permission && profile.permissions?.includes(permission)) return true;
    if (location.pathname === '/admin' && ['CEO', 'SAFETY_MANAGER'].includes(profile.role)) return true;
    return false;
  })();

  if (!hasAccess && (roles || permission)) return <Navigate to="/" />;

  return <Layout>{children}</Layout>;
};

export default function App() {
  return (
    <AuthProvider>
      <NotificationHandler />
      <FontSizeManager />
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute permission="admin"><Admin /></ProtectedRoute>} />
          <Route path="/personnel" element={<ProtectedRoute><EmployeeManagement /></ProtectedRoute>} />
          <Route path="/attendance" element={<ProtectedRoute><Attendance /></ProtectedRoute>} />
          <Route path="/accidents" element={<ProtectedRoute><AccidentReport /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
          <Route path="/notices" element={<ProtectedRoute><Notices /></ProtectedRoute>} />
          <Route path="/leave" element={<ProtectedRoute><Leave /></ProtectedRoute>} />
          <Route path="/coupons" element={<ProtectedRoute><Coupons /></ProtectedRoute>} />
          <Route path="/lotto" element={<ProtectedRoute><Lotto /></ProtectedRoute>} />
          <Route path="/entertainment" element={<ProtectedRoute><Entertainment /></ProtectedRoute>} />
          <Route path="/mypage" element={<ProtectedRoute><MyPage /></ProtectedRoute>} />
          <Route path="/redemption" element={<ProtectedRoute><Redemption /></ProtectedRoute>} />
          <Route path="/redemption-mgmt" element={<ProtectedRoute roles={['CEO', 'DIRECTOR', 'GENERAL_MANAGER']} permission="redemption_mgmt"><RedemptionManagement /></ProtectedRoute>} />
          <Route path="/attendance-mgmt" element={<ProtectedRoute roles={['CEO', 'DIRECTOR', 'GENERAL_MANAGER']} permission="attendance_mgmt"><AttendanceManagement /></ProtectedRoute>} />
          <Route path="/ship-assembly" element={<ProtectedRoute><ShipAssembly /></ProtectedRoute>} />
          <Route path="/qualification" element={<ProtectedRoute><Qualification /></ProtectedRoute>} />
          <Route path="/training" element={<ProtectedRoute><TrainingList /></ProtectedRoute>} />
          <Route path="/training-mgmt" element={<ProtectedRoute roles={['CEO', 'SAFETY_MANAGER']} permission="training_mgmt"><TrainingManagement /></ProtectedRoute>} />
          <Route path="/safety-score" element={<ProtectedRoute roles={['CEO', 'SAFETY_MANAGER']}><SafetyRanking /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
      <Toaster position="top-center" richColors />
    </AuthProvider>
  );
}
