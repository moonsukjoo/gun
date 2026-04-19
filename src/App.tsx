/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/AuthProvider';
import { FontSizeManager } from './components/FontSizeManager';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { EmployeeManagement } from './pages/EmployeeManagement';
import { Attendance } from './pages/Attendance';
import { AccidentReport } from './pages/AccidentReport';
import { Notifications } from './pages/Notifications';
import { Leave } from './pages/Leave';
import { Coupons } from './pages/Coupons';
import { Entertainment } from './pages/Entertainment';
import { Lotto } from './pages/Lotto';
import { MyPage } from './pages/MyPage';
import { Qualification } from './pages/Qualification';
import { Admin } from './pages/Admin';
import { Toaster } from '@/components/ui/sonner';

const ProtectedRoute = ({ children, roles, permission }: { children: React.ReactNode, roles?: string[], permission?: string }) => {
  const { user, profile, loading } = useAuth();

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-[#F8FAFC] space-y-4">
      <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      <div className="flex flex-col items-center">
        <span className="font-black text-xl tracking-tighter">건명기업 HRM</span>
        <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Kunmyung Enterprise</span>
      </div>
    </div>
  );
  if (!user) return <Navigate to="/login" />;
  
  // Permission check
  const hasAccess = (() => {
    if (!roles && !permission) return true;
    if (!profile) return false;
    
    // CEO and SAFETY_MANAGER bypass many things, but let's be strict if they are specified
    if (roles && roles.includes(profile.role)) return true;
    if (permission && profile.permissions?.includes(permission)) return true;
    
    // Default admin roles for /admin
    if (location.pathname === '/admin' && ['CEO', 'SAFETY_MANAGER'].includes(profile.role)) return true;

    return false;
  })();

  if (!hasAccess && (roles || permission)) return <Navigate to="/" />;

  return <Layout>{children}</Layout>;
};

export default function App() {
  return (
    <AuthProvider>
      <FontSizeManager />
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute permission="admin">
                <Admin />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/personnel" 
            element={
              <ProtectedRoute>
                <EmployeeManagement />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/attendance" 
            element={
              <ProtectedRoute>
                <Attendance />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/accidents" 
            element={
              <ProtectedRoute>
                <AccidentReport />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/notifications" 
            element={
              <ProtectedRoute>
                <Notifications />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/leave" 
            element={
              <ProtectedRoute>
                <Leave />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/coupons" 
            element={
              <ProtectedRoute>
                <Coupons />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/lotto" 
            element={
              <ProtectedRoute>
                <Lotto />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/entertainment" 
            element={
              <ProtectedRoute>
                <Entertainment />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/mypage" 
            element={
              <ProtectedRoute>
                <MyPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/qualification" 
            element={
              <ProtectedRoute>
                <Qualification />
              </ProtectedRoute>
            } 
          />
          {/* Add other routes as needed */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
      <Toaster position="top-center" richColors />
    </AuthProvider>
  );
}

