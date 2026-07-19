import React, { useLayoutEffect, useEffect, Component, ErrorInfo, ReactNode, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/AuthProvider';
import { SafetySensorProvider } from './components/SafetySensorProvider';
import { Layout } from './components/Layout';
import { Toaster, toast } from 'sonner';
import { GlowLoading } from './components/GlowLoading';
import { AlertCircle } from 'lucide-react';
import { EmergencyOverlay } from './components/EmergencyOverlay';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { App as CapApp } from '@capacitor/app';

// Lazy load components to reduce initial bundle size with auto-retry and cache-busting self-healing
const lazyWithRetry = <T extends React.ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> => {
  return lazy(() =>
    componentImport().catch((error) => {
      console.warn("Dynamic import failed. Attempting to recover dynamically...", error);
      return new Promise<{ default: T }>((resolve, reject) => {
        // Retry shortly
        setTimeout(() => {
          componentImport()
            .then(resolve)
            .catch((err) => {
              console.error("Recovery failed, performing cache-busting reload...", err);
              // append cache-busting parameter to URL and force reload the page to get the fresh bundles
              const url = new URL(window.location.href);
              url.searchParams.set('reload_ts', Date.now().toString());
              window.location.replace(url.toString());
              reject(err);
            });
        }, 1000);
      });
    })
  );
};

const Admin = lazyWithRetry(() => import('./pages/Admin').then(m => ({ default: m.Admin })));
const EmployeeManagement = lazyWithRetry(() => import('./pages/EmployeeManagement').then(m => ({ default: m.EmployeeManagement })));
const Attendance = lazyWithRetry(() => import('./pages/Attendance').then(m => ({ default: m.Attendance })));
const AccidentReport = lazyWithRetry(() => import('./pages/AccidentReport').then(m => ({ default: m.AccidentReport })));
const Notifications = lazyWithRetry(() => import('./pages/Notifications').then(m => ({ default: m.Notifications })));
const Notices = lazyWithRetry(() => import('./pages/Notices').then(m => ({ default: m.Notices })));
const Leave = lazyWithRetry(() => import('./pages/Leave').then(m => ({ default: m.Leave })));
const LeaveManagement = lazyWithRetry(() => import('./pages/LeaveManagement').then(m => ({ default: m.LeaveManagement })));
const Coupons = lazyWithRetry(() => import('./pages/Coupons').then(m => ({ default: m.Coupons })));
const Entertainment = lazyWithRetry(() => import('./pages/Entertainment').then(m => ({ default: m.Entertainment })));
const Lotto = lazyWithRetry(() => import('./pages/Lotto').then(m => ({ default: m.Lotto })));
const MyPage = lazyWithRetry(() => import('./pages/MyPage').then(m => ({ default: m.MyPage })));
const ShipAssembly = lazyWithRetry(() => import('./pages/ShipAssembly').then(m => ({ default: m.ShipAssembly })));
const SafetyRanking = lazyWithRetry(() => import('./pages/SafetyRanking').then(m => ({ default: m.SafetyRanking })));
const SafetyLeaderboard = lazyWithRetry(() => import('./pages/SafetyLeaderboard').then(m => ({ default: m.SafetyLeaderboard })));
const Redemption = lazyWithRetry(() => import('./pages/Redemption').then(m => ({ default: m.Redemption })));
const RedemptionManagement = lazyWithRetry(() => import('./pages/RedemptionManagement').then(m => ({ default: m.RedemptionManagement })));
const AttendanceManagement = lazyWithRetry(() => import('./pages/AttendanceManagement').then(m => ({ default: m.AttendanceManagement })));
const WorkLog = lazyWithRetry(() => import('./pages/WorkLog').then(m => ({ default: m.WorkLog })));
const WorkLogManagement = lazyWithRetry(() => import('./pages/WorkLogManagement').then(m => ({ default: m.WorkLogManagement })));
const PersonalWorkLog = lazyWithRetry(() => import('./pages/PersonalWorkLog').then(m => ({ default: m.PersonalWorkLog })));
const PraiseFeed = lazyWithRetry(() => import('./pages/PraiseFeed').then(m => ({ default: m.PraiseFeed })));
const MealRequest = lazyWithRetry(() => import('./pages/MealRequest').then(m => ({ default: m.MealRequest })));
const MealManagement = lazyWithRetry(() => import('./pages/MealManagement').then(m => ({ default: m.MealManagement })));
const HighWorkMonitoring = lazyWithRetry(() => import('./pages/HighWorkMonitoring').then(m => ({ default: m.HighWorkMonitoring })));
const Qualification = lazyWithRetry(() => import('./pages/Qualification').then(m => ({ default: m.Qualification })));
const TrainingManagement = lazyWithRetry(() => import('./pages/TrainingManagement').then(m => ({ default: m.TrainingManagement })));
const TrainingList = lazyWithRetry(() => import('./pages/TrainingList').then(m => ({ default: m.TrainingList })));
const MyPayslip = lazyWithRetry(() => import('./pages/MyPayslip'));
const PayslipManagement = lazyWithRetry(() => import('./pages/PayslipManagement'));
const PCAdminDashboard = lazyWithRetry(() => import('./pages/PCAdminDashboard'));
const PCAdminPersonnel = lazyWithRetry(() => import('./pages/PCAdminPersonnel'));
const PCAdminAttendance = lazyWithRetry(() => import('./pages/PCAdminAttendance'));
const PCAdminLeave = lazyWithRetry(() => import('./pages/PCAdminLeave'));
const PCAdminPayslip = lazyWithRetry(() => import('./pages/PCAdminPayslip'));
const PCAdminSafety = lazyWithRetry(() => import('./pages/PCAdminSafety'));
const PCAdminNotices = lazyWithRetry(() => import('./pages/PCAdminNotices'));
const PCAdminWorkLog = lazyWithRetry(() => import('./pages/PCAdminWorkLog'));
const PCAdminTraining = lazyWithRetry(() => import('./pages/PCAdminTraining'));
const MobileStatutoryTraining = lazyWithRetry(() => import('./pages/MobileStatutoryTraining'));
const PCAdminRedemption = lazyWithRetry(() => import('./pages/PCAdminRedemption'));
const PCAdminCoupons = lazyWithRetry(() => import('./pages/PCAdminCoupons'));
const PCAdminHighWork = lazyWithRetry(() => import('./pages/PCAdminHighWork'));
const PCAdminNotifications = lazyWithRetry(() => import('./pages/PCAdminNotifications'));
const PCAdminBeacons = lazyWithRetry(() => import('./pages/PCAdminBeacons'));
const PCAdminEvacuationHistory = lazyWithRetry(() => import('./pages/PCAdminEvacuationHistory'));
const EvacuationHistory = lazyWithRetry(() => import('./pages/EvacuationHistory'));
const HealthManagement = lazyWithRetry(() => import('./pages/HealthManagement'));
const UnifiedReportCenter = lazyWithRetry(() => import('./pages/UnifiedReportCenter'));
const EnclosedSpaceMonitoring = lazyWithRetry(() => import('./pages/EnclosedSpaceMonitoring'));
const AdminAttendanceStatus = lazyWithRetry(() => import('./pages/AdminAttendanceStatus').then(m => ({ default: m.AdminAttendanceStatus })));
const WorkInstructionReport = lazyWithRetry(() => import('./pages/WorkInstructionReport').then(m => ({ default: m.WorkInstructionReportPage })));
const WorkInstructionManagement = lazyWithRetry(() => import('./pages/WorkInstructionManagement').then(m => ({ default: m.WorkInstructionManagement })));
const PerceivedTemp = lazyWithRetry(() => import('./pages/PerceivedTemp').then(m => ({ default: m.PerceivedTemp })));
const PCAdminPerceivedTemp = lazyWithRetry(() => import('./pages/PCAdminPerceivedTemp'));
const RequestCenter = lazyWithRetry(() => import('./pages/RequestCenter').then(m => ({ default: m.RequestCenter })));

const ProtectedRoute = ({ children, roles, permission, permissions }: { children: React.ReactNode, roles?: string[], permission?: string, permissions?: string[] }) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return <GlowLoading />;
  if (!user) return <Navigate to="/login" />;
  
  const isExcludedRole = profile && (
    ['EMPLOYEE', 'WORKER'].includes(profile.role?.toUpperCase() || '') || 
    (['조장', '반장', '사원'].includes(profile.position?.trim() || '') && profile.role !== 'TEAM_LEADER') ||
    profile.employeeId?.trim()?.includes('x66626')
  );

  const hasAccess = (() => {
    if (!profile) return false;
    
    if (profile.email?.toLowerCase() === 'tjrwnfjqm1@gmail.com') return true;

    if (isExcludedRole) {
      const restrictedPaths = ['/admin', '/personnel', '/work-log-mgmt', '/leave-mgmt', '/attendance-mgmt', '/training-mgmt', '/redemption-mgmt', '/payslip-mgmt'];
      if (permission && profile.permissions?.includes(permission)) return true;
      if (permissions && permissions.some(p => profile.permissions?.includes(p))) return true;
      if (roles || restrictedPaths.some(path => location.pathname === path || location.pathname.startsWith(path + '/'))) {
        return false;
      }
    }

    if (!roles && !permission && !permissions) return true;
    if (roles && roles.includes(profile.role)) return true;
    if (permission && profile.permissions?.includes(permission)) return true;
    if (permissions && permissions.some(p => profile.permissions?.includes(p))) return true;
    if (location.pathname === '/admin' && ['CEO', 'SAFETY_MANAGER', 'DIRECTOR', 'GENERAL_MANAGER'].includes(profile.role)) return true;
    return false;
  })();

  if (!hasAccess && (roles || permission || permissions)) return <Navigate to="/" />;

  if (location.pathname.startsWith('/admin/pc')) {
    return <>{children}</>;
  }

  return <Layout>{children}</Layout>;
};

function BackButtonHandler() {
  const navigate = useNavigate();
  const location = useLocation();
  const lastBackPressedRef = React.useRef<number>(0);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    let isMounted = true;
    let activeListener: any = null;

    CapApp.addListener('backButton', (data) => {
      const currentPath = location.pathname;
      
      // If we are on home/dashboard or login page, exit on double back press
      if (currentPath === '/' || currentPath === '/login' || currentPath === '/admin/pc-dashboard') {
        const now = Date.now();
        if (now - lastBackPressedRef.current < 2000) {
          CapApp.exitApp();
        } else {
          lastBackPressedRef.current = now;
          toast.info('뒤로 가기 버튼을 한 번 더 누르면 앱이 종료됩니다.', {
            position: 'bottom-center',
            duration: 2000,
          });
        }
      } else {
        // Go back in history
        navigate(-1);
      }
    }).then(l => {
      if (isMounted) {
        activeListener = l;
      } else {
        l.remove();
      }
    });

    return () => {
      isMounted = false;
      if (activeListener) {
        activeListener.remove();
      }
    };
  }, [location.pathname, navigate]);

  return null;
}

function AppContent() {
  const { profile } = useAuth();
  
  // Request Geolocation permissions automatically on app startup
  useEffect(() => {
    const requestInitialLocationPermission = async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          // Native app: check and request Geolocation permissions using Capacitor Geolocation
          const status = await Geolocation.checkPermissions();
          if (status.location !== 'granted' && status.coarseLocation !== 'granted') {
            await Geolocation.requestPermissions();
          }
        } else {
          // Web Browers: prompt for location permission gently with a dummy fast query
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              () => {},
              () => {},
              { enableHighAccuracy: false, timeout: 5000 }
            );
          }
        }
      } catch (err) {
        console.warn('Silent startup location permission request failed:', err);
      }
    };

    requestInitialLocationPermission();
  }, []);
  
  useLayoutEffect(() => {
    if (profile?.lightTheme) {
      document.documentElement.classList.add('light-theme');
      document.documentElement.style.setProperty('color-scheme', 'light');
    } else {
      document.documentElement.classList.remove('light-theme');
      document.documentElement.style.setProperty('color-scheme', 'dark');
    }

    if (profile?.elderlyMode) {
      document.documentElement.classList.add('elderly-mode');
    } else {
      document.documentElement.classList.remove('elderly-mode');
    }
  }, [profile?.lightTheme, profile?.elderlyMode]);

  return (
    <Router>
      <BackButtonHandler />
      <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
        <Suspense fallback={<GlowLoading />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute permission="admin"><Admin /></ProtectedRoute>} />
            <Route path="/admin/evacuation-history" element={<ProtectedRoute permission="admin"><EvacuationHistory /></ProtectedRoute>} />
            <Route path="/admin/reports" element={<ProtectedRoute permission="admin"><UnifiedReportCenter /></ProtectedRoute>} />
            <Route path="/admin/pc/reports" element={<ProtectedRoute permission="admin"><UnifiedReportCenter /></ProtectedRoute>} />
            <Route path="/health-mgmt" element={<ProtectedRoute><HealthManagement /></ProtectedRoute>} />
            <Route path="/admin/pc/health-mgmt" element={<ProtectedRoute><HealthManagement /></ProtectedRoute>} />
            <Route path="/pc-admin/evacuation-history" element={<ProtectedRoute permission="admin"><PCAdminEvacuationHistory /></ProtectedRoute>} />
            <Route path="/admin/pc/evacuation-history" element={<ProtectedRoute permission="admin"><PCAdminEvacuationHistory /></ProtectedRoute>} />
            <Route path="/personnel" element={<ProtectedRoute roles={['CEO', 'DIRECTOR', 'GENERAL_MANAGER']} permission="employee_mgmt"><EmployeeManagement /></ProtectedRoute>} />
            <Route path="/attendance" element={<ProtectedRoute><Attendance /></ProtectedRoute>} />
            <Route path="/accidents" element={<ProtectedRoute><AccidentReport /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
            <Route path="/notices" element={<ProtectedRoute><Notices /></ProtectedRoute>} />
            <Route path="/leave" element={<ProtectedRoute><Leave /></ProtectedRoute>} />
            <Route path="/leave-mgmt" element={<ProtectedRoute roles={['CEO', 'DIRECTOR', 'GENERAL_MANAGER']} permission="leave_mgmt"><LeaveManagement /></ProtectedRoute>} />
            <Route path="/coupons" element={<ProtectedRoute><Coupons /></ProtectedRoute>} />
            <Route path="/lotto" element={<ProtectedRoute><Lotto /></ProtectedRoute>} />
            <Route path="/entertainment" element={<ProtectedRoute><Entertainment /></ProtectedRoute>} />
            <Route path="/mypage" element={<ProtectedRoute><MyPage /></ProtectedRoute>} />
            <Route path="/redemption" element={<ProtectedRoute><Redemption /></ProtectedRoute>} />
            <Route path="/redemption-mgmt" element={<ProtectedRoute roles={['CEO', 'DIRECTOR', 'GENERAL_MANAGER']} permission="redemption_mgmt"><RedemptionManagement /></ProtectedRoute>} />
            <Route path="/attendance-mgmt" element={<ProtectedRoute roles={['CEO', 'DIRECTOR', 'GENERAL_MANAGER']} permission="attendance_mgmt"><AttendanceManagement /></ProtectedRoute>} />
            <Route path="/high-work-monitor" element={<ProtectedRoute roles={['CEO', 'DIRECTOR', 'GENERAL_MANAGER', 'SAFETY_MANAGER']} permission="high_work_monitor"><HighWorkMonitoring /></ProtectedRoute>} />
            <Route path="/ship-assembly" element={<ProtectedRoute><ShipAssembly /></ProtectedRoute>} />
            <Route path="/mypage/payslip" element={<ProtectedRoute><MyPayslip /></ProtectedRoute>} />
            <Route path="/admin/pc-dashboard" element={<ProtectedRoute roles={['CEO', 'DIRECTOR', 'GENERAL_MANAGER']} permission="admin"><PCAdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/pc/personnel" element={<ProtectedRoute roles={['CEO', 'DIRECTOR', 'GENERAL_MANAGER']} permission="admin"><PCAdminPersonnel /></ProtectedRoute>} />
            <Route path="/admin/pc/attendance" element={<ProtectedRoute roles={['CEO', 'DIRECTOR', 'GENERAL_MANAGER']} permission="admin"><PCAdminAttendance /></ProtectedRoute>} />
            <Route path="/admin/pc/leave" element={<ProtectedRoute roles={['CEO', 'DIRECTOR', 'GENERAL_MANAGER']} permission="admin"><PCAdminLeave /></ProtectedRoute>} />
            <Route path="/admin/pc/payslip" element={<ProtectedRoute roles={['CEO', 'DIRECTOR', 'GENERAL_MANAGER']} permission="admin"><PCAdminPayslip /></ProtectedRoute>} />
            <Route path="/admin/pc/safety" element={<ProtectedRoute roles={['CEO']} permission="admin"><PCAdminSafety /></ProtectedRoute>} />
            <Route path="/admin/pc/attendance-status" element={<ProtectedRoute roles={['CEO', 'DIRECTOR', 'GENERAL_MANAGER', 'SAFETY_MANAGER']} permission="admin"><AdminAttendanceStatus /></ProtectedRoute>} />
            <Route path="/admin/pc/notices" element={<ProtectedRoute roles={['CEO', 'DIRECTOR', 'GENERAL_MANAGER']} permission="admin"><PCAdminNotices /></ProtectedRoute>} />
            <Route path="/admin/pc/worklog" element={<ProtectedRoute roles={['CEO', 'DIRECTOR', 'GENERAL_MANAGER', 'SAFETY_MANAGER']} permission="admin"><PCAdminWorkLog /></ProtectedRoute>} />
            <Route path="/admin/pc/training" element={<ProtectedRoute roles={['CEO', 'DIRECTOR', 'GENERAL_MANAGER', 'SAFETY_MANAGER']} permissions={['admin', 'training_mgmt', 'statutory_training_mgmt']}><PCAdminTraining /></ProtectedRoute>} />
            <Route path="/admin/statutory-training" element={<ProtectedRoute roles={['CEO', 'DIRECTOR', 'GENERAL_MANAGER', 'SAFETY_MANAGER']} permissions={['admin', 'training_mgmt', 'statutory_training_mgmt']}><MobileStatutoryTraining /></ProtectedRoute>} />
            <Route path="/admin/pc/redemption" element={<ProtectedRoute roles={['CEO', 'DIRECTOR', 'GENERAL_MANAGER']} permission="admin"><PCAdminRedemption /></ProtectedRoute>} />
            <Route path="/admin/pc/coupons" element={<ProtectedRoute roles={['CEO', 'DIRECTOR', 'GENERAL_MANAGER']} permission="admin"><PCAdminCoupons /></ProtectedRoute>} />
            <Route path="/admin/pc/highwork" element={<ProtectedRoute roles={['CEO', 'DIRECTOR', 'GENERAL_MANAGER', 'SAFETY_MANAGER']} permission="admin"><PCAdminHighWork /></ProtectedRoute>} />
            <Route path="/admin/pc/beacons" element={<ProtectedRoute roles={['CEO', 'DIRECTOR', 'GENERAL_MANAGER', 'SAFETY_MANAGER']} permission="admin"><PCAdminBeacons /></ProtectedRoute>} />
            <Route path="/enclosed-monitoring" element={<ProtectedRoute roles={['CEO', 'DIRECTOR', 'GENERAL_MANAGER', 'SAFETY_MANAGER']}><EnclosedSpaceMonitoring /></ProtectedRoute>} />
            <Route path="/admin/pc/notifications" element={<ProtectedRoute roles={['CEO', 'DIRECTOR', 'GENERAL_MANAGER']} permission="admin"><PCAdminNotifications /></ProtectedRoute>} />
            <Route path="/payslip-mgmt" element={<ProtectedRoute roles={['CEO', 'DIRECTOR', 'GENERAL_MANAGER']} permission="payslip_mgmt"><PayslipManagement /></ProtectedRoute>} />
             <Route path="/praise-feed" element={<ProtectedRoute><PraiseFeed /></ProtectedRoute>} />
            <Route path="/work-log" element={<ProtectedRoute><WorkLog /></ProtectedRoute>} />
            <Route path="/work-instruction" element={<ProtectedRoute><WorkInstructionReport /></ProtectedRoute>} />
            <Route path="/work-instruction-mgmt" element={<ProtectedRoute roles={['CEO', 'DIRECTOR', 'GENERAL_MANAGER', 'SAFETY_MANAGER', 'CLERK', 'GENERAL_AFFAIRS', 'TEAM_LEADER']}><WorkInstructionManagement /></ProtectedRoute>} />
            <Route path="/personal-work-log" element={<ProtectedRoute><PersonalWorkLog /></ProtectedRoute>} />
            <Route path="/perceived-temp" element={<ProtectedRoute><PerceivedTemp /></ProtectedRoute>} />
            <Route path="/request-center" element={<ProtectedRoute><RequestCenter /></ProtectedRoute>} />
            <Route path="/admin/pc/perceived-temp" element={<ProtectedRoute roles={['CEO', 'DIRECTOR', 'GENERAL_MANAGER', 'SAFETY_MANAGER']} permission="admin"><PCAdminPerceivedTemp /></ProtectedRoute>} />
            <Route path="/meal-request" element={<ProtectedRoute><MealRequest /></ProtectedRoute>} />
            <Route path="/meal-mgmt" element={<ProtectedRoute roles={['CEO', 'DIRECTOR', 'GENERAL_MANAGER', 'CLERK']} permission="meal_snack_mgmt"><MealManagement /></ProtectedRoute>} />
            <Route path="/work-log-mgmt" element={<ProtectedRoute roles={['CEO', 'DIRECTOR', 'GENERAL_MANAGER', 'SAFETY_MANAGER', 'CLERK', 'GENERAL_AFFAIRS', 'TEAM_LEADER']} permission="team_work_log_approve"><WorkLogManagement /></ProtectedRoute>} />
            <Route path="/qualification" element={<ProtectedRoute permission="qualification_mgmt"><Qualification /></ProtectedRoute>} />
            <Route path="/training" element={<ProtectedRoute><TrainingList /></ProtectedRoute>} />
            <Route path="/training-mgmt" element={<ProtectedRoute roles={['CEO', 'SAFETY_MANAGER']} permission="training_mgmt"><TrainingManagement /></ProtectedRoute>} />
            <Route path="/safety-score" element={<ProtectedRoute roles={['CEO']}><SafetyRanking /></ProtectedRoute>} />
            <Route path="/safety-leaderboard" element={<ProtectedRoute><SafetyLeaderboard /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Suspense>
        <EmergencyOverlay />
        <Toaster position="top-center" richColors />
      </div>
    </Router>
  );
}

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("App Error caught by Boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-full flex flex-col items-center justify-center bg-background text-foreground p-10 text-center">
          <div className="w-20 h-20 bg-destructive/10 rounded-3xl flex items-center justify-center text-destructive mb-6">
            <AlertCircle className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-black mb-4">문제가 발생했습니다</h1>
          <p className="text-muted-foreground mb-6 font-bold text-sm max-w-md mx-auto">{this.state.error?.message}</p>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button 
              onClick={() => window.location.reload()}
              className="h-14 bg-primary text-primary-foreground rounded-2xl font-black shadow-lg shadow-primary/20"
            >
              새로고침
            </button>
            <button 
              onClick={() => window.location.href = '/'}
              className="h-14 bg-muted text-foreground rounded-2xl font-black border border-border"
            >
              처음으로 돌아가기
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <SafetySensorProvider>
          <AppContent />
        </SafetySensorProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
