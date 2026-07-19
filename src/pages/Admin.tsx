import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/components/AuthProvider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { SHIP_PARTS } from '@/services/shipService';
import { 
  Users, 
  ShieldCheck, 
  Settings, 
  Megaphone, 
  ShieldAlert, 
  AlertTriangle,
  LayoutDashboard,
  BarChart3,
  CalendarDays, 
  Trophy,
  Search,
  CheckCircle2,
  ChevronRight,
  UserPlus,
  Zap,
  Save,
  Ship,
  Eye,
  EyeOff,
  HardHat,
  CircleDollarSign,
  Clock,
  ClipboardList,
  Radio,
  FileBarChart,
  Activity,
  Target,
  Anchor,
  Utensils,
  History,
  BookOpen,
  User
} from 'lucide-react';
import { db } from '@/firebase';
import { collection, query, onSnapshot, updateDoc, doc, setDoc, getDocs, where, addDoc, deleteDoc, orderBy, limit } from 'firebase/firestore';
import { UserProfile } from '@/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Link, useNavigate } from 'react-router-dom';

const PERMISSIONS = [
  { id: 'admin', label: '시스템 관리 접근', icon: Settings },
  { id: 'employee_mgmt', label: '인사등록 (사원/부서)', icon: Users },
  { id: 'notice_mgmt', label: '공지사항 관리', icon: Megaphone },
  { id: 'accident_mgmt', label: '사고즉보 관리', icon: ShieldAlert },
  { id: 'leave_mgmt', label: '연차/휴가 관리', icon: CalendarDays },
  { id: 'dept_mgmt', label: '조직 관리', icon: CheckCircle2 },
  { id: 'praise_coupon', label: '칭찬쿠폰/룰렛 관리', icon: Trophy },
  { id: 'redemption_mgmt', label: '현물 신청 관리', icon: CircleDollarSign },
  { id: 'attendance_mgmt', label: '근태 관리', icon: Clock },
  { id: 'work_log_mgmt', label: '작업일지 관리', icon: ClipboardList },
  { id: 'training_mgmt', label: '일반 교육/평가 관리', icon: HardHat },
  { id: 'statutory_training_mgmt', label: '법정 정기교육 관리', icon: ShieldCheck },
  { id: 'safety_score_admin', label: '안전지수 설정/관리', icon: ShieldCheck },
  { id: 'pc_dashboard', label: 'PC 통합 대시보드', icon: LayoutDashboard, color: 'bg-emerald-600' },
  { id: 'payslip_mgmt', label: '급여명세서 관리', icon: CircleDollarSign },
  { id: 'safety_ranking', label: '나의 안전지수/랭킹 조회', icon: BarChart3 },
  { id: 'qualification_mgmt', label: '자격/교육이력 관리', icon: ClipboardList },
  { id: 'high_work_monitor', label: '고소작업 총괄 현황', icon: BarChart3 },
  { id: 'emergency_rollcall', label: '비상 대피 롤콜 권한', icon: AlertTriangle },
  { id: 'health_mgmt', label: '보건관리(이상무) 보고 권한', icon: Activity },
  { id: 'report_mgmt', label: '통합 보고서 관리 권한', icon: FileBarChart },
  { id: 'team_work_log_approve', label: '팀원 작업일지 승인 권한', icon: CheckCircle2 },
  { id: 'meal_snack_mgmt', label: '도시락 및 간식 신청 관리', icon: Utensils }
];

import { GlowLoading } from '@/components/GlowLoading';

import { handleFirestoreError, OperationType } from '../lib/errorHandlers';

export const Admin: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [isShipSettingsOpen, setIsShipSettingsOpen] = useState(false);
  const [isBannerSettingsOpen, setIsBannerSettingsOpen] = useState(false);
  const [isShipRaceSettingsOpen, setIsShipRaceSettingsOpen] = useState(false);
  const [isSnailRaceSettingsOpen, setIsSnailRaceSettingsOpen] = useState(false);
  const [isFishingSettingsOpen, setIsFishingSettingsOpen] = useState(false);
  const [isRouletteSettingsOpen, setIsRouletteSettingsOpen] = useState(false);
  const [isPermissionSettingsOpen, setIsPermissionSettingsOpen] = useState(false);
  const [isSafetySensorSettingsOpen, setIsSafetySensorSettingsOpen] = useState(false);
  const [isSafetyTimeoutSettingsOpen, setIsSafetyTimeoutSettingsOpen] = useState(false);
  const [isEmergencyOpen, setIsEmergencyOpen] = useState(false);
  const [isDBResetOpen, setIsDBResetOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<'hr' | 'safety' | 'system'>('hr');

  // Emergency Incident History states
  const [isIncidentHistoryOpen, setIsIncidentHistoryOpen] = useState(false);
  const [incidentHistory, setIncidentHistory] = useState<any[]>([]);
  const [historyTypeFilter, setHistoryTypeFilter] = useState<string>('ALL');
  const [historySearchTerm, setHistorySearchTerm] = useState('');

  const [shipRaceProbs, setShipRaceProbs] = useState<number[]>([1, 1, 1, 1, 1]);
  const [snailRaceProbs, setSnailRaceProbs] = useState<number[]>([1, 1, 1, 1, 1]);
  const [fishingSettings, setFishingSettings] = useState([
    { id: 'small', name: '작은 물고기', multiplier: 2, probability: 0.5, icon: '🐟' },
    { id: 'medium', name: '큰 물고기', multiplier: 5, probability: 0.3, icon: '🐠' },
    { id: 'rare', name: '희귀 고기', multiplier: 20, probability: 0.15, icon: '🐡' },
    { id: 'boss', name: '보스 상어', multiplier: 100, probability: 0.04, icon: '🦈' },
    { id: 'legend', name: '황금 전설 고기', multiplier: 500, probability: 0.01, icon: '👑' }
  ]);
  const [rouletteProbs, setRouletteProbs] = useState<number[]>([0.35, 0.3, 0.2, 0.1, 0.03, 0.02]);

  const isExcludedRole = profile && (
    ['EMPLOYEE', 'WORKER'].includes(profile.role?.toUpperCase() || '') || 
    (['조장', '반장', '사원'].includes(profile.position?.trim() || '') && profile.role !== 'TEAM_LEADER') ||
    profile.employeeId?.trim()?.toLowerCase()?.includes('x66626') ||
    profile.displayName?.toLowerCase()?.includes('x66626') ||
    profile.email?.toLowerCase()?.includes('x66626') ||
    user?.email?.toLowerCase()?.includes('x66626') ||
    user?.email?.split('@')[0]?.toLowerCase() === 'x66626' ||
    (user?.email && user.email.toLowerCase().startsWith('x66626@')) ||
    (user?.displayName && user.displayName.toLowerCase().includes('x66626'))
  );

  const [shipSettings, setShipSettings] = useState({
    probability: 0.3,
    disabledParts: [] as string[]
  });
  const [safetySensorSettings, setSafetySensorSettings] = useState({
    sensitivityLevel: 3,
    impactThreshold: 110.0,
    fallThreshold: 2.5,
    fallDuration: 250,
    sosTimeout: 15
  });
  const [bannerText, setBannerText] = useState('안전한 하루가 되세요');
  const [evacuationStatus, setEvacuationStatus] = useState<any>(null);
  const [evacuationCheckins, setEvacuationCheckins] = useState<any[]>([]);

  useEffect(() => {
    if (!profile) return;
    
    const unsubEvacuation = onSnapshot(doc(db, 'evacuation', 'status'), (snap) => {
      if (snap.exists()) {
        setEvacuationStatus(snap.data());
      } else {
        setEvacuationStatus(null);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'evacuation/status');
    });

    return () => unsubEvacuation();
  }, [profile]);

  useEffect(() => {
    if (evacuationStatus?.isActive) {
      const q = query(collection(db, 'evacuations', evacuationStatus.id, 'checkins'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setEvacuationCheckins(snapshot.docs.map(doc => doc.data()));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'evacuation_checkins');
      });
      return () => unsubscribe();
    } else {
      setEvacuationCheckins([]);
    }
  }, [evacuationStatus?.isActive, evacuationStatus?.id]);

  useEffect(() => {
    if (!profile) return;
    
    const minLoadTime = new Promise(resolve => setTimeout(resolve, 800));
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const data = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      await minLoadTime;
      setUsers(data);
      setFilteredUsers(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
      setLoading(false);
    });
    return () => unsubscribe();
  }, [profile]);

  useEffect(() => {
    if (!profile) return;

    const unsubBanner = onSnapshot(doc(db, 'settings', 'banner'), (snapshot) => {
      if (snapshot.exists()) {
        setBannerText(snapshot.data().text || '안전한 하루가 되세요');
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/banner');
    });

    const unsubShipRace = onSnapshot(doc(db, 'settings', 'entertainment'), (snap) => {
       if (snap.exists()) {
          const data = snap.data();
          setShipRaceProbs(data.shipRaceProbabilities || [1, 1, 1, 1, 1]);
          setSnailRaceProbs(data.snailRaceProbabilities || [1, 1, 1, 1, 1]);
          if (data.fishingSettings) {
            setFishingSettings(data.fishingSettings);
          } else if (data.fishingProbabilities) {
            // Migration: convert old array to new structure
            const migrated = [...fishingSettings];
            data.fishingProbabilities.forEach((p: number, i: number) => {
              if (migrated[i]) migrated[i].probability = p;
            });
            setFishingSettings(migrated);
          }
          setRouletteProbs(data.rouletteProbabilities || [0.35, 0.3, 0.2, 0.1, 0.03, 0.02]);
       }
    }, (error) => {
       handleFirestoreError(error, OperationType.GET, 'settings/entertainment');
    });

    const unsubSafetySensors = onSnapshot(doc(db, 'settings', 'safety_sensors'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setSafetySensorSettings({
          sensitivityLevel: data.sensitivityLevel || 2,
          impactThreshold: data.impactThreshold || 40.0,
          fallThreshold: data.fallThreshold || 3.0,
          fallDuration: data.fallDuration || 150,
          sosTimeout: data.sosTimeout || 15
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/safety_sensors');
    });

    return () => {
      unsubBanner();
      unsubShipRace();
      unsubSafetySensors();
    };
  }, [profile]);

  // Fetch resolved emergency critical incidents logs
  const fetchIncidentHistory = async () => {
    try {
      const q = query(
        collection(db, 'criticalIncidents'),
        where('status', '==', 'RESOLVED'),
        orderBy('resolvedAt', 'desc'),
        limit(150)
      );
      const snapshot = await getDocs(q);
      const historyList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setIncidentHistory(historyList);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'criticalIncidents_history');
      toast.error("이력 데이터를 가져오는 중 오류가 발생했습니다.");
    }
  };

  useEffect(() => {
    const filtered = users.filter(user => 
      user.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.employeeId?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredUsers(filtered);
  }, [searchTerm, users]);

  const handleTogglePermission = async (userId: string, permissionId: string) => {
    if (profile?.role !== 'CEO') {
      toast.error('대표이사 직급만 권한 관리가 가능합니다.');
      return;
    }
    const user = users.find(u => u.uid === userId);
    if (!user) return;
    const current = user.permissions || [];
    const updated = current.includes(permissionId) ? current.filter(p => p !== permissionId) : [...current, permissionId];
    try {
      await updateDoc(doc(db, 'users', userId), { permissions: updated });
      toast.success('권한 업데이트 완료');
    } catch (e) { toast.error('권한 업데이트 실패'); }
  };

  const handleResetData = async () => {
    if (resetConfirmText !== '초기화 실행') {
      toast.error("'초기화 실행'을 정확히 입력해주세요.");
      return;
    }
    
    setIsResetting(true);
    const toastId = toast.loading('데이터 초기화를 시작합니다...');

    const collectionsToReset = [
      'attendance',
      'praiseCoupons',
      'praises',
      'safetyScoreLogs',
      'workInstructionReports',
      'workLogs',
      'teamWorkLogs',
      'personalWorkLogs',
      'lunchRequests',
      'snackRequests',
      'healthReports',
      'criticalIncidents',
      'emergencyLogs',
      'notifications',
      'lottoHistory',
      'trainingResults',
      'trainingRecords',
      'statutoryCompletions',
      'redemptionRequests',
      'payslips',
      'beaconLogs',
      'accidentCases',
      'leaveRequests',
      'userShipParts'
    ];

    try {
      // 1. Delete all documents in transactional collections
      for (const colName of collectionsToReset) {
        try {
          const q = collection(db, colName);
          const snap = await getDocs(q);
          const deletePromises = snap.docs.map(docRef => deleteDoc(doc(db, colName, docRef.id)));
          await Promise.all(deletePromises);
        } catch (err) {
          console.error(`Failed to clear collection ${colName}:`, err);
        }
      }

      // 2. Reset user attributes
      const usersSnap = await getDocs(collection(db, 'users'));
      const userResetPromises = usersSnap.docs.map(userDoc => {
        return updateDoc(doc(db, 'users', userDoc.id), {
          points: 0,
          safetyScore: 100,
          kudosCount: 0,
          monthlyKudosCount: 0,
          currentAltitude: 0,
          isImmobile: false,
          ghostGuardEnabled: false,
          altitudeUpdatedAt: null,
          lastMovementAt: null
        });
      });
      await Promise.all(userResetPromises);

      toast.success('실운영을 위한 트랜잭션 데이터 초기화가 성공적으로 완료되었습니다.', { id: toastId });
      setIsDBResetOpen(false);
      setResetConfirmText('');
    } catch (e) {
      console.error(e);
      toast.error('데이터 초기화 중 오류가 발생했습니다.', { id: toastId });
    } finally {
      setIsResetting(false);
    }
  };

  const categorizedLinks = {
    hr: [
      { to: '/personnel', label: '인사등록', icon: UserPlus, permission: 'employee_mgmt', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
      { to: '/attendance-mgmt', label: '근태 관리', icon: Clock, permission: 'attendance_mgmt', color: 'text-indigo-400', bgColor: 'bg-indigo-500/20' },
      { to: '/leave-mgmt', label: '연차/휴가 관리', icon: CalendarDays, permission: 'leave_mgmt', color: 'text-sky-400', bgColor: 'bg-sky-500/20' },
      { to: '/payslip-mgmt', label: '급여명세서 관리', icon: CircleDollarSign, permission: 'payslip_mgmt', color: 'text-cyan-400', bgColor: 'bg-cyan-500/20' },
      { to: '/work-log-mgmt', label: '작업일지 관리', icon: ClipboardList, permission: 'work_log_mgmt', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' },
      { to: '/qualification', label: '자격/교육이력 관리', icon: ClipboardList, permission: 'qualification_mgmt', color: 'text-teal-400', bgColor: 'bg-teal-500/20' },
      { to: '/redemption-mgmt', label: '현물 신청 관리', icon: CircleDollarSign, permission: 'redemption_mgmt', color: 'text-green-400', bgColor: 'bg-green-500/20' },
      { to: '/admin/reports', label: '통합 보고서 관리', icon: FileBarChart, permission: 'admin', color: 'text-blue-300', bgColor: 'bg-blue-500/20' },
    ],
    safety: [
      { to: '/admin/pc/attendance-status', label: '실시간 출근현황', icon: Users, permission: 'admin', color: 'text-teal-400', bgColor: 'bg-teal-500/20', requiresCEO: true },
      { onClick: () => navigate('/high-work-monitor'), label: '고소작업 현황', icon: BarChart3, permission: 'high_work_monitor', color: 'text-rose-400', bgColor: 'bg-rose-500/20' },
      { onClick: () => setIsEmergencyOpen(true), label: '비상 대피 (롤콜)', icon: AlertTriangle, permission: 'emergency_rollcall', color: 'text-red-400', bgColor: 'bg-red-500/20' },
      { onClick: () => { fetchIncidentHistory(); setIsIncidentHistoryOpen(true); }, label: '긴급 이력/대처 조회', icon: History, permission: 'admin', color: 'text-amber-400', bgColor: 'bg-amber-500/20' },
      { to: '/accidents', label: '사고즉보 관리', icon: ShieldAlert, permission: 'accident_mgmt', color: 'text-orange-400', bgColor: 'bg-orange-500/20' },
      { to: '/health-mgmt', label: '보건관리 보고', icon: Activity, permission: 'health_mgmt', color: 'text-pink-400', bgColor: 'bg-pink-500/20' },
      { to: '/enclosed-monitoring', label: '밀폐공간 관제', icon: Radio, permission: 'admin', color: 'text-rose-300', bgColor: 'bg-rose-500/20' },
      { onClick: () => setIsSafetyTimeoutSettingsOpen(true), label: '충격 SOS 대기 설정', icon: Clock, permission: 'admin', color: 'text-rose-400', bgColor: 'bg-rose-500/20', requiresCEO: true },
      { to: '/admin/statutory-training', label: '법정 정기교육 관리', icon: ShieldCheck, permissions: ['training_mgmt', 'statutory_training_mgmt'], color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' },
      { to: '/training-mgmt', label: '교육/평가 관리', icon: HardHat, permission: 'training_mgmt', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
      { to: '/safety-score', label: '안전지수 설정', icon: ShieldCheck, permission: 'safety_score_admin', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20', requiresCEO: true },
    ],
    system: [
      { to: '/admin/pc-dashboard', label: 'PC 대시보드', icon: LayoutDashboard, permission: 'admin', newTab: true, color: 'text-slate-300', bgColor: 'bg-slate-500/30' },
      { to: '/notifications', label: '공지사항 관리', icon: Megaphone, permission: 'notice_mgmt', color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
      { onClick: () => setIsBannerSettingsOpen(true), label: '배너 문구 설정', icon: Megaphone, permission: 'admin', color: 'text-violet-400', bgColor: 'bg-violet-500/20' },
      { to: '/coupons', label: '포상/룰렛 관리', icon: Trophy, permission: 'praise_coupon', color: 'text-amber-400', bgColor: 'bg-amber-500/20' },
      { onClick: () => setIsShipRaceSettingsOpen(true), label: '조선소 레이싱 확률 설정', icon: Radio, permission: 'admin', color: 'text-orange-400', bgColor: 'bg-orange-500/20', requiresCEO: true },
      { onClick: () => setIsSnailRaceSettingsOpen(true), label: '달팽이 레이스 확률 설정', icon: Radio, permission: 'admin', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20', requiresCEO: true },
      { onClick: () => setIsFishingSettingsOpen(true), label: '건명 낚시 확률 설정', icon: Anchor, permission: 'admin', color: 'text-cyan-400', bgColor: 'bg-cyan-500/20', requiresCEO: true },
      { onClick: () => setIsRouletteSettingsOpen(true), label: '건명 룰렛 확률 설정', icon: Target, permission: 'admin', color: 'text-rose-400', bgColor: 'bg-rose-500/20', requiresCEO: true },
      { onClick: () => setIsSafetySensorSettingsOpen(true), label: '충격 감지 감도 설정', icon: ShieldAlert, permission: 'admin', color: 'text-red-400', bgColor: 'bg-red-500/20', requiresCEO: true },
      { onClick: () => setIsShipSettingsOpen(true), label: '함선 파츠 확률', icon: Ship, permission: 'admin', color: 'text-blue-300', bgColor: 'bg-blue-500/20', requiresCEO: true },
      { onClick: () => setIsPermissionSettingsOpen(true), label: '사용자 권한 관리', icon: ShieldCheck, permission: 'admin', color: 'text-slate-300', bgColor: 'bg-slate-500/20', requiresCEO: true },
      { onClick: () => setIsDBResetOpen(true), label: '실운영 데이터 일괄 초기화', icon: AlertTriangle, permission: 'admin', color: 'text-rose-500', bgColor: 'bg-rose-500/20', requiresCEO: true },
    ]
  };

  const renderLink = (link: any, idx: number) => {
    if (isExcludedRole) {
      if (link.label === '공지사항 관리' || link.label === '사고즉보 관리' || link.label === '나의 안전지수/랭킹 조회') {
        return null;
      }
    }

    if (link.requiresCEO && profile?.role !== 'CEO') {
      return null;
    }

    const isAllowed = isAdminMode || 
      (link.roles && profile && link.roles.includes(profile.role)) ||
      (link.permission && profile && profile.permissions?.includes(link.permission)) ||
      (link.permissions && profile && link.permissions.some((p: string) => profile.permissions?.includes(p)));

    if (!isAllowed) return null;

    const Content = (
      <div className="bg-card p-4 rounded-3xl border border-border flex items-center gap-4 active:scale-95 transition-all w-full text-left hover:bg-muted group shadow-sm">
        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110", link.bgColor || "bg-primary/10")}>
          <link.icon className={cn("w-6 h-6", link.color || "text-primary")} />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-black text-foreground leading-tight truncate">{link.label}</span>
        </div>
        <div className="ml-auto w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground/20 group-hover:text-muted-foreground/60 transition-colors">
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>
    );

    return 'to' in link ? (
      <Link 
        key={idx} 
        to={link.to} 
        className="w-full"
        target={link.newTab ? "_blank" : undefined}
        rel={link.newTab ? "noopener noreferrer" : undefined}
      >
        {Content}
      </Link>
    ) : (
      <button key={idx} onClick={link.onClick} className="w-full">{Content}</button>
    );
  };

  if (loading) return <GlowLoading message="관리자 시스템" subMessage="접속 권한 확인 중..." />;

  const isAdminMode = profile && !isExcludedRole && (
    profile.role === 'CEO' || 
    profile.permissions?.includes('admin') ||
    profile.email === 'tjrwnfjqm1@gmail.com'
  );

  return (
    <div className="space-y-8 pb-24 px-1 text-foreground">
      <header className="py-6">
        <h2 className="text-3xl font-black tracking-tight text-foreground leading-tight">관리자 시스템</h2>
        <p className="text-muted-foreground font-bold">건명기업 시스템의 코어 설정을 제어합니다</p>
      </header>

      {/* Category Tabs - Grid for fixed size */}
      <div className="grid grid-cols-3 gap-1 bg-muted p-1.5 rounded-3xl border border-border mx-1">
        {[
          { id: 'hr', label: '인사/기획', icon: Users, color: 'text-blue-500' },
          { id: 'safety', label: '안전/관제', icon: HardHat, color: 'text-rose-500' },
          { id: 'system', label: '시스템/보상', icon: Settings, color: 'text-amber-500' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveCategory(tab.id as any)}
            className={cn(
              "flex-1 min-w-[100px] flex items-center justify-center gap-2 py-3.5 rounded-2xl transition-all duration-500",
              activeCategory === tab.id 
                ? "bg-card text-foreground shadow-md scale-[1.02] border border-border" 
                : "text-muted-foreground/60 hover:text-muted-foreground/90"
            )}
          >
            <tab.icon className={cn("w-4 h-4", activeCategory === tab.id ? tab.color : "text-muted-foreground/60")} />
            <span className="text-[11px] font-black uppercase tracking-widest">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Menus Content */}
      <motion.div 
        key={activeCategory}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="space-y-4 px-1"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {categorizedLinks[activeCategory].map((link, idx) => renderLink(link, idx))}
        </div>
      </motion.div>

      <Dialog open={isSafetySensorSettingsOpen} onOpenChange={setIsSafetySensorSettingsOpen}>
        <DialogContent className="bg-card border border-border rounded-3xl text-foreground max-w-sm p-6 overflow-hidden flex flex-col shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-black text-xl">긴급 충격 감지 감도 설정</DialogTitle>
            <DialogDescription className="text-xs font-bold text-muted-foreground">
              추락 및 강한 충격 감지 기준을 설정합니다. (1단계: 매우 예민, 5단계: 매우 둔감)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-6 border-y border-border my-4">
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <Label className="text-[10px] font-black text-primary uppercase tracking-widest">감도 단계</Label>
                <span className="text-xl font-black text-foreground">{safetySensorSettings.sensitivityLevel}단계</span>
              </div>
              
              <div className="grid grid-cols-4 gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((level) => (
                  <button
                    key={level}
                    onClick={() => {
                      const thresholds = [
                        { impact: 22.0, fall: 3.5, duration: 120, sos: 15 }, 
                        { impact: 38.0, fall: 3.0, duration: 180, sos: 15 }, 
                        { impact: 58.0, fall: 2.5, duration: 250, sos: 15 }, 
                        { impact: 85.0, fall: 2.2, duration: 300, sos: 15 }, 
                        { impact: 130.0, fall: 2.0, duration: 350, sos: 15 },
                        { impact: 190.0, fall: 1.8, duration: 400, sos: 15 },
                        { impact: 280.0, fall: 1.6, duration: 450, sos: 15 },
                        { impact: 400.0, fall: 1.5, duration: 500, sos: 15 }
                      ];
                      const selected = thresholds[level - 1];
                      setSafetySensorSettings({
                        sensitivityLevel: level,
                        impactThreshold: selected.impact,
                        fallThreshold: selected.fall,
                        fallDuration: selected.duration,
                        sosTimeout: safetySensorSettings.sosTimeout || selected.sos
                      });
                    }}
                    className={cn(
                      "h-12 rounded-xl text-sm font-black transition-all",
                      safetySensorSettings.sensitivityLevel === level
                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                        : "bg-muted text-foreground hover:bg-muted/80"
                    )}
                  >
                    {level}
                  </button>
                ))}
              </div>

              <div className="p-4 bg-muted rounded-2xl space-y-3">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="font-black text-muted-foreground uppercase">관리 기준 (시뮬레이션)</span>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-black text-foreground">
                    {safetySensorSettings.sensitivityLevel === 1 && "1단계: 매우 민감 (일상적인 일시적 부딪힘도 감지 가능)"}
                    {safetySensorSettings.sensitivityLevel === 2 && "2단계: 민감 (약 1m 높이에서의 가벼운 추락/충격)"}
                    {safetySensorSettings.sensitivityLevel === 3 && "3단계: 보통 (일상적인 작업 중 발생 가능한 충격)"}
                    {safetySensorSettings.sensitivityLevel === 4 && "4단계: 약간 둔감 (강한 기계적 접촉이나 추락 상황)"}
                    {safetySensorSettings.sensitivityLevel === 5 && "5단계: 둔감 (강한 장비 충돌 수준의 충격)"}
                    {safetySensorSettings.sensitivityLevel === 6 && "6단계: 매우 둔감 (차량 접촉 사고 수준의 극심한 충격)"}
                    {safetySensorSettings.sensitivityLevel === 7 && "7단계: 극도로 둔감 (기계적 파손이 동반되는 수준의 충격)"}
                    {safetySensorSettings.sensitivityLevel === 8 && "8단계: 최소 민감도 (특수 산업 현장/극심한 사고 전용)"}
                  </p>

                  <p className="text-[10px] font-bold text-muted-foreground leading-relaxed italic">
                    * 설정값: 충격 가속도 {safetySensorSettings.impactThreshold.toFixed(1)}m/s², 추락 판정 {safetySensorSettings.fallDuration}ms
                  </p>
                </div>
              </div>
            </div>

            <p className="text-[10px] font-bold text-red-500 text-center italic">
              * 설정 시 모든 사용자의 충격 감지 기준이 실시간으로 변경됩니다.
            </p>
          </div>

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="flex-1 h-12 rounded-2xl border-border text-foreground font-black"
              onClick={() => setIsSafetySensorSettingsOpen(false)}
            >
              취소
            </Button>
            <Button 
              className="flex-1 h-12 bg-primary text-primary-foreground font-black rounded-2xl shadow-lg shadow-primary/20 hover:bg-primary/90"
              onClick={async () => {
                try {
                  await setDoc(doc(db, 'settings', 'safety_sensors'), {
                    ...safetySensorSettings,
                    updatedAt: new Date().toISOString(),
                    updatedBy: profile?.uid
                  }, { merge: true });
                  toast.success('충격 감지 감도 설정이 저장되었습니다.');
                  setIsSafetySensorSettingsOpen(false);
                } catch (e) {
                  toast.error('설정 저장 중 오류가 발생했습니다.');
                }
              }}
            >
              설정 저장
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isSafetyTimeoutSettingsOpen} onOpenChange={setIsSafetyTimeoutSettingsOpen}>
        <DialogContent className="bg-card border border-border rounded-[32px] text-foreground max-w-sm w-[95%] p-8 overflow-hidden flex flex-col shadow-2xl">
          <DialogHeader className="space-y-3">
            <DialogTitle className="font-black text-2xl text-rose-500 tracking-tight">SOS 대기 시간</DialogTitle>
            <DialogDescription className="text-sm font-bold text-muted-foreground leading-relaxed">
              위험 감지 후 긴급 SOS가 자동 발송되기 전까지의 대기 시간을 설정합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-10 py-10 my-4">
            <div className="space-y-8">
              <div className="flex justify-between items-baseline">
                <Label className="text-xs font-black text-rose-500 uppercase tracking-widest">대기 시간</Label>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-black text-foreground tabular-nums">{safetySensorSettings.sosTimeout}</span>
                  <span className="text-xl font-bold text-muted-foreground">초</span>
                </div>
              </div>
              
              <div className="px-1">
                <input 
                  type="range"
                  min="5"
                  max="120"
                  step="5"
                  value={safetySensorSettings.sosTimeout}
                  onChange={(e) => setSafetySensorSettings(prev => ({ ...prev, sosTimeout: parseInt(e.target.value) }))}
                  className="w-full accent-rose-500 h-2.5 bg-muted rounded-full appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-black text-muted-foreground mt-4 opacity-40">
                  <span>5초</span>
                  <span>60초</span>
                  <span>120초</span>
                </div>
              </div>

              <div className="p-6 bg-rose-50/50 light-theme:bg-rose-50 rounded-3xl border border-rose-100 flex gap-4">
                <ShieldAlert className="w-6 h-6 text-rose-500 shrink-0" />
                <div className="space-y-1.5">
                  <p className="text-xs font-black text-rose-600">작동 원리</p>
                  <p className="text-[11px] font-bold text-foreground/70 leading-relaxed">
                    위험 감지 시 즉시 경보가 울립니다. 대기 시간 내에 <span className="text-foreground font-black">'괜찮아요'</span> 버튼을 누르지 않으면 관리자에게 위치 정보와 함께 즉시 알림이 발송됩니다.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button 
              variant="outline" 
              className="flex-1 h-14 rounded-2xl border-border text-foreground font-black hover:bg-muted"
              onClick={() => setIsSafetyTimeoutSettingsOpen(false)}
            >
              취소
            </Button>
            <Button 
              className="flex-1 h-14 bg-rose-500 text-white font-black rounded-2xl shadow-xl shadow-rose-200 hover:bg-rose-600 transition-all active:scale-95"
              onClick={async () => {
                try {
                  await setDoc(doc(db, 'settings', 'safety_sensors'), {
                    sosTimeout: safetySensorSettings.sosTimeout,
                    updatedAt: new Date().toISOString(),
                    updatedBy: profile?.uid
                  }, { merge: true });
                  toast.success('SOS 대기 시간 설정이 완료되었습니다.');
                  setIsSafetyTimeoutSettingsOpen(false);
                } catch (e) {
                  toast.error('설정 저장 중 오류가 발생했습니다.');
                }
              }}
            >
              전체 적용
            </Button>
          </div>
        </DialogContent>
      </Dialog>


      <Dialog open={isShipSettingsOpen} onOpenChange={setIsShipSettingsOpen}>
        <DialogContent className="bg-card border border-border rounded-3xl text-foreground max-w-md overflow-y-auto max-h-[85vh] p-6 focus:outline-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">함선 파츠 확률 설정</DialogTitle>
            <DialogDescription className="text-xs font-bold text-muted-foreground mt-1">
              활동(근태, 작업 등) 완료 시 파츠가 지급될 기본 확률과 특정 파츠의 지급 여부를 설정합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-6 border-y border-border my-4">
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <Label className="text-[10px] font-black text-primary uppercase tracking-widest">기본 지급 확률</Label>
                <span className="text-xl font-black text-foreground">{(shipSettings.probability * 100).toFixed(0)}%</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.05" 
                value={shipSettings.probability} 
                onChange={e => setShipSettings(prev => ({ ...prev, probability: parseFloat(e.target.value) }))}
                className="w-full h-2 bg-muted rounded-full appearance-none accent-primary" 
              />
              <p className="text-[10px] font-bold text-muted-foreground text-center italic">
                * 100% 설정 시 모든 활동 완료 시 확정적으로 지급됩니다.
              </p>
            </div>

            <div className="space-y-4">
              <Label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">파츠 활성화 관리</Label>
              <div className="grid grid-cols-2 gap-2">
                {SHIP_PARTS.map(part => {
                  const isDisabled = shipSettings.disabledParts.includes(part.id);
                  return (
                    <button
                      key={part.id}
                      onClick={() => {
                        const newDisabled = isDisabled 
                          ? shipSettings.disabledParts.filter(id => id !== part.id)
                          : [...shipSettings.disabledParts, part.id];
                        setShipSettings(prev => ({ ...prev, disabledParts: newDisabled }));
                      }}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                        isDisabled 
                          ? "bg-red-500/5 border-red-500/20 text-red-500 grayscale" 
                          : "bg-background border-border text-foreground"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                        isDisabled ? "bg-red-500/10" : "bg-primary/10"
                      )}>
                        <Ship className={cn("w-4 h-4", isDisabled ? "text-red-500" : "text-primary")} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-black truncate">{part.name}</p>
                        <p className={cn("text-[9px] font-bold", isDisabled ? "text-red-500/60" : "text-muted-foreground")}>
                          {isDisabled ? '중지됨' : '정상지급'}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="flex-1 h-14 rounded-2xl border-border text-foreground font-black"
              onClick={() => setIsShipSettingsOpen(false)}
            >
              취소
            </Button>
            <Button 
              className="flex-1 h-14 bg-primary text-primary-foreground font-black rounded-2xl shadow-lg shadow-primary/20"
              onClick={async () => {
                try {
                  await setDoc(doc(db, 'settings', 'shipParts'), {
                    probability: shipSettings.probability,
                    disabledParts: shipSettings.disabledParts,
                    updatedAt: new Date().toISOString(),
                    updatedBy: profile?.uid
                  }, { merge: true });
                  toast.success('함선 파츠 확률 설정이 저장되었습니다.');
                  setIsShipSettingsOpen(false);
                } catch (e) {
                  toast.error('설정 저장 중 오류가 발생했습니다.');
                }
              }}
            >
              설정 저장
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isFishingSettingsOpen} onOpenChange={setIsFishingSettingsOpen}>
        <DialogContent className="bg-card border border-border rounded-3xl text-foreground max-w-sm p-6 overflow-hidden flex flex-col shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-black text-xl text-foreground">건명 낚시 (OVERHAUL) 설정</DialogTitle>
            <DialogDescription className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              물고기 종류별 이름, 배당률(Multiplier), 출현 확률을 관리합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 border-y border-border my-4 overflow-y-auto max-h-[60vh]">
            {fishingSettings.map((fish, index) => (
              <div key={fish.id} className="p-4 bg-muted/30 rounded-2xl border border-border space-y-3 shadow-sm">
                 <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                       <span className="text-xl">{fish.icon}</span>
                       <Input 
                         value={fish.name} 
                         onChange={(e) => {
                           const updated = [...fishingSettings];
                           updated[index].name = e.target.value;
                           setFishingSettings(updated);
                         }}
                         className="h-8 bg-transparent border-none font-black text-sm p-0 w-32 focus-visible:ring-0 text-foreground"
                       />
                    </div>
                    <div className="flex items-center gap-1">
                       <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">배당</span>
                       <Input 
                         type="number" 
                         value={fish.multiplier}
                         onChange={(e) => {
                           const updated = [...fishingSettings];
                           updated[index].multiplier = parseFloat(e.target.value) || 0;
                           setFishingSettings(updated);
                         }}
                         className="h-8 w-16 bg-muted border-none font-black text-right text-emerald-500"
                       />
                       <span className="text-[10px] font-black text-foreground">x</span>
                    </div>
                 </div>

                 <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                       <span className="text-primary">확률</span>
                       <span className="text-foreground">{(fish.probability * 100).toFixed(1)}%</span>
                    </div>
                    <input 
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={fish.probability}
                      onChange={(e) => {
                        const updated = [...fishingSettings];
                        updated[index].probability = parseFloat(e.target.value);
                        setFishingSettings(updated);
                      }}
                      className="w-full h-1.5 bg-muted rounded-full appearance-none accent-primary"
                    />
                 </div>
              </div>
            ))}

            <div className="p-4 bg-primary/10 border border-primary/20 rounded-2xl">
               <p className="text-[10px] font-black text-primary text-center uppercase tracking-widest leading-relaxed">
                  확률 합계: {fishingSettings.reduce((a, b) => a + b.probability, 0).toFixed(2)} (1.0 권장)
               </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="flex-1 h-12 rounded-2xl border-border text-foreground font-black hover:bg-muted"
              onClick={() => setIsFishingSettingsOpen(false)}
            >
              취소
            </Button>
            <Button 
              className="flex-1 h-12 bg-primary text-primary-foreground font-black rounded-2xl shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
              onClick={async () => {
                try {
                  await setDoc(doc(db, 'settings', 'entertainment'), { 
                    fishingSettings: fishingSettings,
                    updatedAt: new Date().toISOString(),
                    updatedBy: profile?.uid
                  }, { merge: true });
                  toast.success('낚시 설정이 전역 저장되었습니다.');
                  setIsFishingSettingsOpen(false);
                } catch (e) {
                  toast.error('설정 저장 중 오류가 발생했습니다.');
                }
              }}
            >
              전역 적용
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isRouletteSettingsOpen} onOpenChange={setIsRouletteSettingsOpen}>
        <DialogContent className="bg-card border border-border rounded-3xl text-foreground max-w-sm p-6 overflow-hidden flex flex-col shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-black text-xl text-foreground">건명 룰렛 확률 설정</DialogTitle>
            <DialogDescription className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              룰렛 각 칸의 당첨 확률을 실시간으로 조절합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 border-y border-border my-4 overflow-y-auto max-h-[60vh]">
            {[
              { label: '꽝 (0배)', index: 0 },
              { label: '1배 당첨', index: 1 },
              { label: '2배 당첨', index: 2 },
              { label: '꽝 (0배) [2]', index: 3 },
              { label: '5배 당첨', index: 4 },
              { label: '10배 당첨', index: 5 }
            ].map((item) => (
              <div key={item.index} className="space-y-2">
                <div className="flex justify-between items-center text-[10px] font-black text-rose-500 uppercase tracking-widest">
                   <span>{item.label}</span>
                   <span className="text-foreground">{(rouletteProbs[item.index] * 100).toFixed(1)}%</span>
                </div>
                <input 
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={rouletteProbs[item.index]}
                  onChange={(e) => {
                    const updated = [...rouletteProbs];
                    updated[item.index] = parseFloat(e.target.value);
                    setRouletteProbs(updated);
                  }}
                  className="w-full accent-rose-500 h-1.5 bg-muted rounded-lg appearance-none cursor-pointer"
                />
              </div>
            ))}

            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
               <p className="text-[10px] font-black text-emerald-600 text-center uppercase tracking-widest">
                  확률 합계: {rouletteProbs.reduce((a, b) => a + b, 0).toFixed(2)} (1.0 권장)
               </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="flex-1 h-12 rounded-2xl border-border text-foreground font-black hover:bg-muted"
              onClick={() => setIsRouletteSettingsOpen(false)}
            >
              취소
            </Button>
            <Button 
              className="flex-1 h-12 bg-rose-500 text-white font-black rounded-2xl shadow-lg shadow-rose-500/20 hover:bg-rose-600 transition-all"
              onClick={async () => {
                try {
                  await setDoc(doc(db, 'settings', 'entertainment'), { 
                    rouletteProbabilities: rouletteProbs,
                    updatedAt: new Date().toISOString(),
                    updatedBy: profile?.uid
                  }, { merge: true });
                  toast.success('룰렛 확률 설정이 저장되었습니다.');
                  setIsRouletteSettingsOpen(false);
                } catch (e) {
                  toast.error('설정 저장 중 오류가 발생했습니다.');
                }
              }}
            >
              설정 저장
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isShipRaceSettingsOpen} onOpenChange={setIsShipRaceSettingsOpen}>
        <DialogContent className="bg-card border border-border rounded-3xl text-foreground max-w-sm p-6 shadow-2xl">
           <DialogHeader><DialogTitle className="font-black text-xl text-foreground">조선소 레이싱 확률 설정</DialogTitle></DialogHeader>
           <div className="space-y-4 py-4">
              {shipRaceProbs.map((p, i) => (
                <div key={i} className="flex flex-col gap-2 p-4 bg-muted/30 rounded-2xl border border-border">
                   <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      <span>{['컨테이너', 'LNG선', '유조선', '벌크선', '화학선'][i]} (스피드 계수)</span>
                      <span className="text-primary">{p.toFixed(1)}x</span>
                   </div>
                   <input 
                     type="range" 
                     min="0.5" 
                     max="3" 
                     step="0.1" 
                     value={p} 
                     onChange={e => {
                        const updated = [...shipRaceProbs]; 
                        updated[i] = parseFloat(e.target.value); 
                        setShipRaceProbs(updated);
                     }} 
                     className="w-full h-2 bg-muted rounded-full appearance-none accent-primary" 
                   />
                </div>
              ))}
              <p className="text-[10px] font-bold text-muted-foreground text-center italic">
                * 계수가 높을수록 해당 선박이 승리할 확률이 높아집니다.
              </p>
           </div>
           <Button className="w-full h-14 bg-primary text-primary-foreground font-black rounded-2xl shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all" onClick={async () => {
             try {
               await setDoc(doc(db, 'settings', 'entertainment'), { 
                 shipRaceProbabilities: shipRaceProbs,
                 updatedAt: new Date().toISOString(),
                 updatedBy: profile?.uid
               }, { merge: true });
               toast.success('조선소 레이싱 설정이 저장되었습니다.');
               setIsShipRaceSettingsOpen(false);
             } catch (e) {
               toast.error('설정 저장 중 오류가 발생했습니다.');
             }
           }}>
              설정 저장
           </Button>
        </DialogContent>
      </Dialog>

       <Dialog open={isSnailRaceSettingsOpen} onOpenChange={setIsSnailRaceSettingsOpen}>
        <DialogContent className="bg-card border border-border rounded-3xl text-foreground max-w-sm p-6 shadow-2xl">
           <DialogHeader><DialogTitle className="font-black text-xl text-foreground">달팽이 레이스 확률 설정</DialogTitle></DialogHeader>
           <div className="space-y-4 py-4">
              {snailRaceProbs.map((p, i) => (
                <div key={i} className="flex flex-col gap-2 p-4 bg-muted/30 rounded-2xl border border-border">
                   <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      <span>달팽이 {i + 1} (스피드 계수)</span>
                      <span className="text-primary">{p.toFixed(1)}x</span>
                   </div>
                   <input 
                     type="range" 
                     min="0.5" 
                     max="3" 
                     step="0.1" 
                     value={p} 
                     onChange={e => {
                        const updated = [...snailRaceProbs]; 
                        updated[i] = parseFloat(e.target.value); 
                        setSnailRaceProbs(updated);
                     }} 
                     className="w-full h-2 bg-muted rounded-full appearance-none accent-primary" 
                   />
                </div>
              ))}
              <p className="text-[10px] font-bold text-muted-foreground text-center italic">
                * 계수가 높을수록 해당 달팽이가 승리할 확률이 높아집니다.
              </p>
           </div>
           <Button className="w-full h-14 bg-primary text-primary-foreground font-black rounded-2xl shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all" onClick={async () => {
             try {
               await setDoc(doc(db, 'settings', 'entertainment'), { 
                 snailRaceProbabilities: snailRaceProbs,
                 updatedAt: new Date().toISOString(),
                 updatedBy: profile?.uid
               }, { merge: true });
               toast.success('달팽이 레이스 설정이 저장되었습니다.');
               setIsSnailRaceSettingsOpen(false);
             } catch (e) {
               toast.error('설정 저장 중 오류가 발생했습니다.');
             }
           }}>
              설정 저장
           </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={isBannerSettingsOpen} onOpenChange={setIsBannerSettingsOpen}>
        <DialogContent className="bg-card border border-border rounded-3xl text-foreground max-w-sm p-6 shadow-2xl">
           <DialogHeader><DialogTitle className="font-black text-foreground">메인 배너 관리</DialogTitle></DialogHeader>
           <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">배너 문구</Label>
                <Input 
                  value={bannerText} 
                  onChange={(e) => setBannerText(e.target.value)}
                  className="bg-muted border border-border h-12 rounded-xl text-foreground font-bold"
                  placeholder="예: 안전한 하루가 되세요"
                />
              </div>
           </div>
           <Button className="w-full h-14 bg-primary text-primary-foreground font-black rounded-2xl shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all" onClick={async () => {
             await setDoc(doc(db, 'settings', 'banner'), { 
               text: bannerText,
               updatedAt: new Date().toISOString(),
               updatedBy: profile?.uid
             }, { merge: true });
             toast.success('배너 문구가 저장되었습니다.'); 
             setIsBannerSettingsOpen(false);
           }}>저장하기</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={isPermissionSettingsOpen} onOpenChange={setIsPermissionSettingsOpen}>
        <DialogContent className="bg-card border border-border rounded-3xl text-foreground max-w-md p-0 overflow-hidden flex flex-col max-h-[80vh] shadow-2xl">
           <div className="p-8 pb-4">
              <DialogTitle className="font-black mb-4 text-foreground">권한 관리</DialogTitle>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
                <Input 
                  placeholder="사용자 검색..." 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
                  className="bg-muted border border-border h-12 pl-11 rounded-xl text-foreground" 
                />
              </div>
           </div>
           <div className="p-4 flex-1 overflow-y-auto space-y-2">
              {(() => {
                const activeUser = selectedUser ? users.find(u => u.uid === selectedUser.uid) || selectedUser : null;
                
                if (activeUser) {
                   return (
                     <div className="space-y-4">
                        <div className="bg-muted/50 p-4 rounded-2xl flex items-center justify-between border border-border">
                           <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-primary/20 text-primary rounded-xl flex items-center justify-center font-black">
                                {activeUser.displayName.charAt(0)}
                              </div>
                              <div>
                                <p className="font-black text-sm text-foreground">{activeUser.displayName}</p>
                                <p className="text-[10px] text-muted-foreground">{activeUser.employeeId}</p>
                              </div>
                           </div>
                           <Button variant="ghost" className="text-xs text-muted-foreground hover:bg-muted" onClick={() => setSelectedUser(null)}>변경</Button>
                        </div>
                        <div className="space-y-2">
                           {PERMISSIONS.map(p => {
                             const isGranted = activeUser.permissions?.includes(p.id);
                             return (
                               <div key={p.id} className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border shadow-sm">
                                  <div className="flex items-center gap-3">
                                    <p.icon className="w-4 h-4 text-primary" />
                                    <span className="text-xs font-bold text-foreground">{p.label}</span>
                                  </div>
                                  <div 
                                    className={cn(
                                      "w-10 h-5 rounded-full p-1 cursor-pointer transition-all duration-200", 
                                      isGranted ? "bg-primary" : "bg-muted"
                                    )} 
                                    onClick={() => handleTogglePermission(activeUser.uid, p.id)}
                                  >
                                     <div className={cn(
                                       "w-3 h-3 bg-white rounded-full transition-transform duration-200", 
                                       isGranted ? "translate-x-5" : "translate-x-0"
                                     )} />
                                  </div>
                               </div>
                             );
                           })}
                        </div>
                     </div>
                   );
                }

                return filteredUsers.slice(0, 10).map(u => (
                  <div 
                    key={u.uid} 
                    className="bg-muted/30 p-4 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-muted/60 active:scale-95 transition-all border border-border shadow-sm" 
                    onClick={() => setSelectedUser(u)}
                  >
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-muted rounded-xl flex items-center justify-center font-black text-sm text-muted-foreground border border-border">
                          {u.displayName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-black text-sm text-foreground">{u.displayName}</p>
                          <p className="text-[10px] text-muted-foreground">{u.employeeId}</p>
                        </div>
                     </div>
                     <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
                  </div>
                ));
              })()}
           </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDBResetOpen} onOpenChange={setIsDBResetOpen}>
        <DialogContent className="bg-card border border-border rounded-[32px] text-foreground max-w-sm w-[95%] p-6 overflow-hidden flex flex-col shadow-2xl max-h-[85vh]">
          <DialogHeader className="space-y-3 shrink-0">
            <DialogTitle className="font-neutral text-xl text-rose-500 tracking-tight flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
              실운영 대비 데이터 초기화
            </DialogTitle>
            <DialogDescription className="text-xs font-semibold text-muted-foreground leading-relaxed">
              사원 정보 및 조직도를 제외한 모든 테스트용 트랜잭션 데이터를 공장 초기화합니다. 이 작업은 취소할 수 없습니다.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-4 my-2 pr-1 border-y border-border text-xs scrollbar-thin">
            <div>
              <p className="font-extrabold text-rose-500 uppercase tracking-wider mb-2">삭제 대상 목록 (완전 삭제)</p>
              <ul className="grid grid-cols-2 gap-1.5 text-[11px] text-foreground/80 font-bold">
                <li className="flex items-center gap-1">❌ 근무시간 / 출퇴근 기록</li>
                <li className="flex items-center gap-1">❌ 칭찬쿠폰 지급내역</li>
                <li className="flex items-center gap-1">❌ 칭찬 릴레이 피드 / 댓글</li>
                <li className="flex items-center gap-1">❌ 안전지수 점수 변동이력</li>
                <li className="flex items-center gap-1">❌ 일일 작업지시서 / TBM</li>
                <li className="flex items-center gap-1">❌ 작업일지 (개인/팀)</li>
                <li className="flex items-center gap-1">❌ 도시락 및 간식 신청내역</li>
                <li className="flex items-center gap-1">❌ 보건진단 / 이상무 보고</li>
                <li className="flex items-center gap-1">❌ 센서 충격/낙하 경보이력</li>
                <li className="flex items-center gap-1">❌ 비상 SOS / 대피 이력</li>
                <li className="flex items-center gap-1">❌ 교육 퀴즈 / 평가 이력</li>
                <li className="flex items-center gap-1">❌ 법정교육서명 / 완료증서</li>
                <li className="flex items-center gap-1">❌ 급여명세서 등록 데이터</li>
                <li className="flex items-center gap-1">❌ 포인트 교환(현물) 내역</li>
                <li className="flex items-center gap-1">❌ BLE 비콘 출입 기록</li>
                <li className="flex items-center gap-1">❌ 보유 조선소 함선 파츠</li>
                <li className="flex items-center gap-1">❌ 사고즉보 보고내역</li>
                <li className="flex items-center gap-1">❌ 연차 / 휴가 신청내역</li>
              </ul>
            </div>

            <div>
              <p className="font-extrabold text-emerald-600 uppercase tracking-wider mb-2">보존 대상 (유지)</p>
              <ul className="grid grid-cols-2 gap-1.5 text-[11px] text-foreground/80 font-bold">
                <li className="flex items-center gap-1">✅ 등록된 사원 프로필</li>
                <li className="flex items-center gap-1">✅ 부서 / 직무 / 직급</li>
                <li className="flex items-center gap-1">✅ 배치 비콘 마스터 기기</li>
                <li className="flex items-center gap-1">✅ 교육 교안 자료 / 공지사항</li>
              </ul>
            </div>

            <div className="p-3 bg-blue-500/5 rounded-2xl border border-blue-500/10">
              <p className="font-extrabold text-blue-500 uppercase tracking-wider mb-1">사원 수치 일괄 리셋</p>
              <p className="text-[10px] font-medium text-muted-foreground leading-normal">
                사원 점수는 <span className="font-black text-blue-600">0 P</span>, 안전지수 점수는 <span className="font-black text-blue-600">100 점</span>으로 초기화됩니다.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-extrabold text-rose-500 uppercase tracking-wider">
                승인 코드 입력
              </Label>
              <Input 
                placeholder="'초기화 실행'을 정확히 입력해 주세요"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                className="bg-muted border border-border h-11 rounded-xl text-foreground font-black text-center text-xs"
              />
            </div>
          </div>

          <div className="flex gap-2 shrink-0 pt-2">
            <Button 
              variant="outline" 
              className="flex-1 h-11 rounded-xl border-border text-foreground text-xs font-black hover:bg-muted"
              onClick={() => {
                setIsDBResetOpen(false);
                setResetConfirmText('');
              }}
              disabled={isResetting}
            >
              취소
            </Button>
            <Button 
              className="flex-1 h-11 bg-rose-500 hover:bg-rose-600 text-white text-xs font-black rounded-xl shadow-lg shadow-rose-200 transition-all disabled:opacity-50"
              onClick={handleResetData}
              disabled={isResetting || resetConfirmText !== '초기화 실행'}
            >
              {isResetting ? '초기화 중...' : '초기화 실행'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isEmergencyOpen} onOpenChange={setIsEmergencyOpen}>
        <DialogContent className="bg-card border border-border rounded-3xl text-foreground max-w-lg p-0 overflow-hidden flex flex-col max-h-[90vh] shadow-2xl">
          <div className="p-8 pb-4">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-red-600/20 text-red-600 rounded-xl flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <DialogTitle className="font-black text-xl text-foreground">비상 대피 실시간 인원 파악</DialogTitle>
                  <DialogDescription className="font-bold text-muted-foreground">현장 인원들의 안전을 실시간으로 확인합니다.</DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-y-auto p-8 pt-0 space-y-6">
            {evacuationStatus?.isActive ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted/50 p-6 rounded-2xl border border-border text-center flex flex-col items-center justify-center shadow-inner">
                    <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-2">출근 인원 대비</p>
                    <div className="relative">
                      <p className="text-4xl font-black text-blue-600">{evacuationCheckins.length}</p>
                      <p className="text-[10px] font-bold text-blue-600/40 absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
                        / {evacuationStatus.totalClockedIn || '-'} 명
                      </p>
                    </div>
                  </div>
                  <div className="bg-muted/50 p-6 rounded-2xl border border-border text-center flex flex-col items-center justify-center shadow-inner">
                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2">전체 인원 대비</p>
                    <div className="relative">
                      <p className="text-4xl font-black text-emerald-600">{evacuationCheckins.length}</p>
                      <p className="text-[10px] font-bold text-emerald-600/40 absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
                        / {evacuationStatus.totalWorkers || users.length} 명
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 space-y-2">
                  <p className="text-[10px] font-black text-red-600/60 uppercase tracking-widest px-1">미확인 인원: {Math.max(0, (evacuationStatus.totalWorkers || users.length) - evacuationCheckins.length)}명</p>
                  <div className="bg-muted h-4 rounded-full overflow-hidden border border-border shadow-inner">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(evacuationCheckins.length / (evacuationStatus.totalWorkers || users.length)) * 100}%` }}
                      className="h-full bg-primary"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-black text-foreground px-1">미확인 인원 명단</h4>
                  <div className="grid grid-cols-1 gap-2">
                    {users
                      .filter(u => !evacuationCheckins.some(c => c.uid === u.uid))
                      .map(user => (
                        <div key={user.uid} className="flex items-center justify-between p-4 bg-red-600/5 border border-red-600/10 rounded-xl">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-red-600/20 text-red-600 rounded-lg flex items-center justify-center font-black text-xs">
                              {user.displayName.charAt(0)}
                            </div>
                            <div>
                              <p className="font-black text-sm text-red-600">{user.displayName}님</p>
                              <p className="text-[10px] text-red-400 font-bold">{user.departmentName || '소속 없음'}</p>
                            </div>
                          </div>
                          <Badge className="bg-red-600/20 text-red-600 border-none font-black text-[10px]">미확인</Badge>
                        </div>
                      ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button 
                    variant="outline" 
                    className="flex-1 h-14 rounded-2xl border-border text-foreground font-black hover:bg-muted"
                    onClick={() => setIsEmergencyOpen(false)}
                  >
                    닫기
                  </Button>
                  <Button 
                    className="flex-1 h-14 rounded-2xl bg-slate-900 text-white font-black border border-white/5 hover:bg-slate-800 transition-all opacity-80 hover:opacity-100"
                    onClick={async () => {
                      if (window.confirm('대피 상황을 종료하시겠습니까?')) {
                        const now = new Date().toISOString();
                        const endedBy = profile?.displayName || user?.displayName || user?.email || 'Admin';
                        
                        await setDoc(doc(db, 'evacuation', 'status'), { 
                          isActive: false,
                          endedAt: now,
                          endedBy: endedBy
                        }, { merge: true });

                        if (evacuationStatus?.id) {
                          await setDoc(doc(db, 'evacuations', evacuationStatus.id), {
                            isActive: false,
                            status: 'FINISHED',
                            finishedAt: now,
                            endedAt: now,
                            endedBy: endedBy,
                            confirmedCount: evacuationCheckins.length
                          }, { merge: true });
                        }

                        // Auto-resolve pending FIRE critical incidents to keep dashboard clear
                        try {
                          const fireQuery = query(
                            collection(db, 'criticalIncidents'),
                            where('type', '==', 'FIRE'),
                            where('status', '==', 'PENDING')
                          );
                          const fireSnap = await getDocs(fireQuery);
                          for (const fireDoc of fireSnap.docs) {
                            await updateDoc(doc(db, 'criticalIncidents', fireDoc.id), {
                              status: 'RESOLVED',
                              resolvedAt: now,
                              resolvedByUid: profile?.uid || 'admin',
                              resolvedByName: profile?.displayName || '관리자',
                              resolutionText: '대피령 일괄 해제 / 상황 종료됨'
                            });
                          }
                        } catch (err) {
                          console.error("Failed to clear pending fire incidents:", err);
                        }

                        toast.success('대피 상황이 종료되었습니다.');
                      }
                    }}
                  >
                    상황 종료
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6 pt-4">
                <div className="flex justify-between items-center px-1">
                  <p className="text-sm font-black text-foreground">최근 대피 이력</p>
                  <Button 
                    variant="ghost" 
                    className="text-xs text-primary font-black p-0 h-auto hover:bg-transparent"
                    onClick={() => navigate('/admin/evacuation-history')}
                  >
                   전체 보기 <ChevronRight className="w-3 h-3 ml-1" />
                  </Button>
                </div>

                <div className="p-6 bg-red-600/10 rounded-3xl border border-red-600/20 text-center space-y-2 shadow-inner">
                  <p className="text-sm font-black text-red-600">현재 활성화된 대피령이 없습니다.</p>
                  <p className="text-xs font-bold text-red-400">비상 상황 발생 시 아래 버튼을 눌러 대피령을 발동하세요.</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">대피 공지 사유</Label>
                  <Input 
                    placeholder="예: 제3도크 화재 발생, 즉시 대피 바랍니다."
                    className="bg-muted border border-border h-14 rounded-2xl font-bold text-foreground"
                    id="emergency-reason"
                  />
                </div>

                <Button 
                  className="w-full h-16 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl text-lg shadow-xl shadow-red-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  onClick={async () => {
                    const reason = (document.getElementById('emergency-reason') as HTMLInputElement)?.value || '긴급 상황이 발생했습니다.';
                    const id = new Date().getTime().toString();
                    const now = new Date().toISOString();
                    
                    const today = new Date().toISOString().split('T')[0];
                    const attSnap = await getDocs(query(collection(db, 'attendance'), where('date', '==', today)));
                    const clockedInCount = attSnap.docs.filter(doc => !doc.data().clockOut).length;

                    const evData = {
                      id,
                      isActive: true,
                      activatedAt: now,
                      activatedByUid: profile?.uid,
                      activatedByName: profile?.displayName,
                      reason,
                      totalWorkers: users.length,
                      totalClockedIn: clockedInCount || users.length, 
                      confirmedCount: 0
                    };

                    await setDoc(doc(db, 'evacuation', 'status'), evData);
                    await setDoc(doc(db, 'evacuations', id), {
                      ...evData,
                      status: 'ACTIVE'
                    });

                    // Add FIRE alert to criticalIncidents
                    await addDoc(collection(db, 'criticalIncidents'), {
                      type: 'FIRE',
                      typeName: '화재 대피령',
                      uid: profile?.uid || 'admin',
                      displayName: profile?.displayName || '관리자',
                      employeeId: profile?.employeeId || '',
                      departmentName: profile?.departmentName || '안전관리실',
                      jobRole: profile?.jobRole || '관리단',
                      workplace: reason || '전체 구역',
                      status: 'PENDING',
                      createdAt: now
                    });
                    
                    toast.error('비상 대피령이 발동되었습니다!');
                  }}
                >
                  비상 대피령 발동 (인원 파악 시작)
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 긴급 이력 및 안전 조치 이력 조회 Dialog */}
      <Dialog open={isIncidentHistoryOpen} onOpenChange={setIsIncidentHistoryOpen}>
        <DialogContent className="bg-card border border-border text-foreground max-w-lg w-[95vw] rounded-[2rem] p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader className="mb-4">
            <DialogTitle className="font-extrabold text-lg flex items-center gap-2 text-foreground">
              <BookOpen className="w-5 h-5 text-amber-500" />
              긴급 이상 및 안전 조치 이력
            </DialogTitle>
            <DialogDescription className="text-xs font-semibold text-muted-foreground">
              안전 센서 및 비상 리포트 조치 완료 이력을 조회합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 mb-4">
            <div className="flex flex-wrap gap-1.5">
              {['ALL', 'FALL', 'IMPACT', 'SOS', 'FIRE', 'HEALTH_BAD'].map((type) => {
                const labelMap: Record<string, string> = {
                  ALL: '전체',
                  FALL: '추락',
                  IMPACT: '충격',
                  SOS: 'SOS',
                  FIRE: '화재 대피',
                  HEALTH_BAD: '컨디션 나쁨'
                };
                return (
                  <button
                    key={type}
                    onClick={() => setHistoryTypeFilter(type)}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-black transition-all border ${
                      historyTypeFilter === type 
                        ? 'bg-amber-500/10 text-amber-500 border-amber-500/40' 
                        : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
                    }`}
                  >
                    {labelMap[type]}
                  </button>
                );
              })}
            </div>

            <div className="relative">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-muted-foreground/50" />
              <input
                type="text"
                value={historySearchTerm}
                onChange={(e) => setHistorySearchTerm(e.target.value)}
                placeholder="대상자 이름 또는 사번 검색..."
                className="w-full h-10 pl-9 pr-4 bg-muted/60 border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground/45 outline-none focus:border-amber-500/50"
              />
            </div>
          </div>

          <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
            {incidentHistory.filter(inc => {
              const matchesType = historyTypeFilter === 'ALL' || inc.type === historyTypeFilter;
              const matchesSearch = !historySearchTerm.trim() || 
                (inc.displayName && inc.displayName.toLowerCase().includes(historySearchTerm.toLowerCase())) ||
                (inc.employeeId && inc.employeeId.toLowerCase().includes(historySearchTerm.toLowerCase()));
              return matchesType && matchesSearch;
            }).length === 0 ? (
              <div className="py-12 text-center text-muted-foreground/45 text-xs font-medium font-sans">
                조치 완료 이력이 없습니다.
              </div>
            ) : (
              incidentHistory.filter(inc => {
                const matchesType = historyTypeFilter === 'ALL' || inc.type === historyTypeFilter;
                const matchesSearch = !historySearchTerm.trim() || 
                  (inc.displayName && inc.displayName.toLowerCase().includes(historySearchTerm.toLowerCase())) ||
                  (inc.employeeId && inc.employeeId.toLowerCase().includes(historySearchTerm.toLowerCase()));
                return matchesType && matchesSearch;
              }).map((inc) => (
                <div 
                  key={inc.id}
                  className="p-4 bg-muted/40 border border-border rounded-2.5xl space-y-3 text-xs font-sans"
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-black ${
                      inc.type === 'FALL' ? 'bg-red-500/15 text-red-600 border border-red-500/30' :
                      inc.type === 'IMPACT' ? 'bg-orange-500/15 text-orange-600 border border-orange-500/30' :
                      inc.type === 'SOS' ? 'bg-rose-500/15 text-rose-600 border border-rose-500/40' :
                      inc.type === 'FIRE' ? 'bg-red-600/15 text-red-600 border border-red-600/30' :
                      'bg-amber-500/15 text-amber-600 border border-amber-500/30'
                    }`}>
                      {inc.typeName || inc.type}
                    </span>
                    <span className="text-[10px] text-muted-foreground/60 font-semibold font-mono">
                      {inc.createdAt ? new Date(inc.createdAt).toLocaleString('ko-KR') : '-'}
                    </span>
                  </div>

                  <div className="flex justify-between font-bold">
                    <span className="text-foreground">{inc.displayName} ({inc.employeeId || '사번없음'})</span>
                    <span className="text-muted-foreground/75 text-[10px]">{inc.departmentName} · {inc.jobRole}</span>
                  </div>

                  {inc.workplace && (
                    <div className="text-[11px] text-muted-foreground">
                      위치: <span className="text-foreground font-semibold">{inc.workplace}</span>
                    </div>
                  )}

                  <div className="bg-emerald-500/5 border border-emerald-500/20 p-3 rounded-xl space-y-1.5 mt-2">
                    <div className="flex justify-between items-center text-[10px] font-black text-emerald-600">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        상급자 확인 완료
                      </span>
                      <span className="font-mono">
                        시간: {inc.resolvedAt ? new Date(inc.resolvedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </span>
                    </div>
                    <p className="text-[11px] font-extrabold text-foreground leading-relaxed pl-1">
                      {inc.resolutionText || inc.comment || '이상 없음 확인 및 상황 종료'}
                    </p>
                    <div className="text-[9px] text-muted-foreground/75 pl-1 pt-1 flex items-center gap-1 font-sans">
                      <User className="w-3 h-3 text-muted-foreground/50" />
                      확인자: {inc.resolvedByName || '시스템 관리자'} ({inc.resolvedByRole || '상급 대처원'})
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <DialogFooter className="mt-4">
            <Button 
              className="w-full h-11 bg-zinc-900 border border-zinc-800 text-foreground text-xs font-black rounded-xl hover:bg-zinc-800"
              onClick={() => setIsIncidentHistoryOpen(false)}
            >
              확인 닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
