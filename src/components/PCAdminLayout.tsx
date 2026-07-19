import React, { useState } from 'react';
import { 
  Users, 
  Clock, 
  CalendarDays, 
  ShieldCheck, 
  CircleDollarSign, 
  ClipboardList, 
  Lock,
  HardHat, 
  BarChart3, 
  Bell, 
  Settings,
  Search,
  LogOut,
  Menu,
  X,
  Trophy,
  History,
  FileText,
  LayoutDashboard,
  Zap,
  Radio,
  FileBarChart,
  Activity,
  Thermometer
} from 'lucide-react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { auth } from '../firebase';
import { CompanyLogo } from './CompanyLogo';
import { CriticalIncidentAlertCenter } from './CriticalIncidentAlertCenter';

interface PCAdminLayoutProps {
  children: React.ReactNode;
  title: string;
}

const PCAdminLayout: React.FC<PCAdminLayoutProps> = ({ children, title }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const isExcludedRole = profile && (
    ['EMPLOYEE', 'TEAM_LEADER', 'WORKER'].includes(profile.role?.toUpperCase() || '') || 
    ['조장', '반장', '사원'].includes(profile.position?.trim() || '') ||
    profile.employeeId?.trim().toLowerCase().includes('x66626') ||
    profile.displayName?.toLowerCase().includes('x66626') ||
    profile.email?.toLowerCase().includes('x66626') ||
    user?.email?.toLowerCase().includes('x66626') ||
    user?.email?.split('@')[0]?.toLowerCase() === 'x66626' ||
    (user?.email && user.email.toLowerCase().startsWith('x66626@')) ||
    (user?.displayName && user.displayName.toLowerCase().includes('x66626'))
  );

  if (isExcludedRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-10">
        <div className="max-w-md w-full bg-white p-10 rounded-[2rem] shadow-xl text-center border border-slate-200">
          <ShieldCheck className="w-16 h-16 text-rose-500 mx-auto mb-6" />
          <h1 className="text-2xl font-black text-slate-900 mb-4">접근 권한이 없습니다</h1>
          <p className="text-slate-500 font-medium mb-8">관리자 전용 페이지입니다. 일반 사원 계정인 {profile?.displayName}님은 이 페이지에 접근할 수 없습니다.</p>
          <button 
            onClick={() => navigate('/')}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-slate-800 transition-all"
          >
            메인 페이지로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  const navGroups = [
    {
      group: '종합 관제 대시보드',
      items: [
        { id: 'dashboard', label: '엔터프라이즈 개요', icon: LayoutDashboard, to: '/admin/pc-dashboard' },
        { id: 'unified_reports', label: '통합 보고서 센터', icon: FileBarChart, to: '/admin/pc/reports' },
      ]
    },
    {
      group: '실시간 현장 관제',
      items: [
        { id: 'highwork', label: '고소작업 실시간 관제', icon: BarChart3, to: '/admin/pc/highwork' },
        { id: 'beacons', label: '밀폐공간 위치 관제', icon: Radio, to: '/admin/pc/beacons' },
        { id: 'perceived_temp_mgmt', label: '실시간 체감온도 관제', icon: Thermometer, to: '/admin/pc/perceived-temp' },
        { id: 'health_reports_status', label: '실시간 보건현황(이상무)', icon: Activity, to: '/admin/pc/health-mgmt' },
        { id: 'evacuation_history', label: '비상 대피 및 롤콜 이력', icon: History, to: '/admin/pc/evacuation-history' },
      ]
    },
    {
      group: '조업 및 근태 관리',
      items: [
        { id: 'attendance_status', label: '실시간 출근현황', icon: Clock, to: '/admin/pc/attendance-status' },
        { id: 'attendance', label: '월간 근태 현황 총괄', icon: Clock, to: '/admin/pc/attendance' },
        { id: 'leave', label: '연차/휴가 신청 결재', icon: CalendarDays, to: '/admin/pc/leave' },
        { id: 'worklog', label: '작업일지 총괄 관리', icon: ClipboardList, to: '/admin/pc/worklog' },
      ]
    },
    {
      group: '인사 및 조직 관리',
      items: [
        { id: 'personnel', label: '임직원 정보 관리', icon: Users, to: '/admin/pc/personnel' },
        { id: 'permissions', label: '사용자 관리 권한 설정', icon: Lock, to: '/admin/pc/personnel?tab=permissions' },
        { id: 'payslip', label: '급여명세서 일괄 발행', icon: CircleDollarSign, to: '/admin/pc/payslip' },
      ]
    },
    {
      group: '안전 보건 교육 및 포상',
      items: [
        { id: 'safety', label: '지표별 안전지수 설정', icon: ShieldCheck, to: '/admin/pc/safety' },
        { id: 'training', label: '법정 안전교육 관리', icon: HardHat, to: '/admin/pc/training' },
        { id: 'redemption', label: '포상 현물 신청 관리', icon: Settings, to: '/admin/pc/redemption' },
        { id: 'coupons', label: '안전 포상/쿠폰 관리', icon: Trophy, to: '/admin/pc/coupons' },
      ]
    },
    {
      group: '소통 및 전산 공지',
      items: [
        { id: 'notice', label: '전사 공지사항 관리', icon: Bell, to: '/admin/pc/notices' },
        { id: 'notifications', label: '푸시 알림 통합 발송', icon: Zap, to: '/admin/pc/notifications' },
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-background flex font-sans text-foreground select-text overflow-hidden">
      {/* Sidebar */}
      <aside 
        className={`${isSidebarOpen ? 'w-72' : 'w-20'} bg-[#1E293B] transition-all duration-300 flex flex-col z-50 text-slate-300 shadow-2xl shrink-0 no-print`}
      >
        <div className="p-8 flex items-center justify-between border-b border-slate-700/50 gap-2">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 flex items-center justify-center active:scale-95 transition-all shrink-0">
              <CompanyLogo className="w-full h-full" />
            </div>
            {isSidebarOpen && (
              <div className="flex flex-col min-w-0">
                <span className="font-black text-lg tracking-tighter text-white block leading-none truncate">건명기업</span>
                <span className="text-[10px] font-bold text-blue-400 mt-1 block uppercase tracking-wider whitespace-nowrap">PC ADMIN</span>
              </div>
            )}
          </div>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
            className="p-2 hover:bg-slate-700/50 rounded-xl transition-colors shrink-0"
          >
            {isSidebarOpen ? <X className="w-5 h-5 text-white" /> : <Menu className="w-5 h-5 text-white" />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-8 custom-scrollbar">
          {navGroups.map((group, idx) => (
            <div key={idx} className="space-y-2">
              {isSidebarOpen && (
                <div className="px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 select-none">
                  {group.group}
                </div>
              )}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const itemPath = item.to.split('?')[0];
                  const itemQuery = item.to.split('?')[1] || '';
                  const pathnameMatch = location.pathname === itemPath;
                  const searchParams = new URLSearchParams(location.search);
                  const hasTabParam = itemQuery.includes('tab=');
                  const isTabActive = hasTabParam 
                    ? searchParams.get('tab') === new URLSearchParams(itemQuery).get('tab')
                    : !searchParams.get('tab');
                  const isActive = pathnameMatch && isTabActive;
                  return (
                    <Link
                      key={item.id}
                      to={item.to}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all group relative ${
                        isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <item.icon className={`w-5 h-5 shrink-0 transition-transform ${isActive ? '' : 'group-hover:scale-110'}`} />
                      {isSidebarOpen && <span className="text-sm font-bold">{item.label}</span>}
                      {!isSidebarOpen && (
                        <div className="absolute left-full ml-4 px-3 py-1.5 bg-slate-800 text-white text-xs font-bold rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-[100] border border-slate-700">
                          {item.label}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-6 border-t border-slate-700/50 text-center">
            <button 
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-all w-full group"
            >
              <LogOut className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
              {isSidebarOpen && <span className="text-sm font-bold">로그아웃</span>}
            </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-background">
        {/* Header */}
        <header className="h-20 bg-card border-b border-border px-10 flex items-center justify-between shrink-0 shadow-sm z-40 no-print">
          <div className="flex items-center gap-4">
             <h2 className="text-2xl font-black text-foreground tracking-tight">{title}</h2>
          </div>

          <div className="flex items-center gap-8">
            <div className="hidden xl:flex flex-col items-end border-r border-border pr-8">
              <span className="text-xs font-black text-muted-foreground uppercase tracking-widest">{new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</span>
              <span className="text-lg font-black text-foreground tracking-tight">{new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
            </div>

              <div className="flex flex-col items-end">
                <p className="text-sm font-black text-foreground leading-none">{profile?.displayName || '관리자'}</p>
                <p className="text-[10px] font-black text-blue-500 mt-1.5 px-2 py-0.5 bg-blue-500/10 rounded-full uppercase tracking-tight">
                  {profile?.role === 'CEO' ? '대표이사' : 
                   profile?.role === 'DIRECTOR' ? '이사/직장' :
                   profile?.role === 'GENERAL_MANAGER' ? '부장' :
                   profile?.role === 'SAFETY_MANAGER' ? '안전관리자' :
                   profile?.role === 'TEAM_LEADER' ? '팀장' :
                   profile?.role === 'GROUP_LEADER' ? '조장' :
                   profile?.role === 'EMPLOYEE' ? '사원' : profile?.role || '관리자'}
                </p>
              </div>
              <div className="w-12 h-12 bg-muted rounded-2xl overflow-hidden ring-4 ring-muted shadow-sm border border-border">
                 <img src={user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`} alt="profile" className="w-full h-full object-cover" />
              </div>
            </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar bg-background/50 no-scrollbar">
          {children}
        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.05); border-radius: 20px; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); }
        aside .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); }
        aside:hover .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); }

        @media print {
          aside, header, nav, .no-print, button, .no-print-col, [class*="no-print"] {
            display: none !important;
            opacity: 0 !important;
            visibility: hidden !important;
            height: 0 !important;
            width: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `}</style>
      <CriticalIncidentAlertCenter />
    </div>
  );
};

export default PCAdminLayout;
