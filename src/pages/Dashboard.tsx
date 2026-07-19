import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/AuthProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, 
  CalendarDays,
  ShieldCheck,
  Activity,
  Bell,
  Plus,
  Megaphone,
  ShieldAlert,
  Info,
  Ship,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  TrendingUp,
  TrendingDown,
  LayoutDashboard,
  Building2,
  ListTodo,
  CheckCircle,
  Users,
  AlertTriangle,
  ClipboardList,
  Heart,
  Sparkles,
  Trophy,
  User as UserIcon,
  FileBox,
  CheckCircle2,
  XCircle,
  ArrowRightLeft,
  MapPin,
  RefreshCw,
  FileBarChart,
  Utensils,
  Lock,
  Thermometer,
  Ticket,
  Wallet,
  Volume2,
  MessageSquare
} from 'lucide-react';
import { db } from '@/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, limit, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { Attendance, Notice, Role, AccidentCase, LeaveRequest, Task, UserProfile } from '@/types';
import { format, startOfMonth, subMonths, differenceInDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { grantRandomShipPart } from '@/services/shipService';
import { sendPushNotification, requestNotificationPermission } from '@/services/notificationService';
import { calculateAttendanceHours } from '@/lib/attendance';
import { checkIsSpecialDay } from '@/lib/holidays';
import { useSafetySensor } from '@/components/SafetySensorProvider';

import { handleFirestoreError, OperationType } from '../lib/errorHandlers';
import { AlertSoundPlayer } from '../lib/sound';

export const Dashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null);
  const [weeklyAttendanceMap, setWeeklyAttendanceMap] = useState<Record<string, Attendance>>({});
  const [specialDates, setSpecialDates] = useState<Record<string, any>>({});
  const [recentNotices, setRecentNotices] = useState<Notice[]>([]);
  const [recentAccidents, setRecentAccidents] = useState<AccidentCase[]>([]);
  const [selectedAccident, setSelectedAccident] = useState<AccidentCase | null>(null);
  const [selectedDashboardAccident, setSelectedDashboardAccident] = useState<AccidentCase | null>(null);
  const [healthStatus, setHealthStatus] = useState<'GOOD' | 'NORMAL' | 'BAD'>('GOOD');
  const [isNoticeDialogOpen, setIsNoticeDialogOpen] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [newNotice, setNewNotice] = useState({ title: '', content: '', isImportant: false, shouldNotify: true });
  const [userTrend, setUserTrend] = useState<number>(0);
  const [isClockInHealthDialogOpen, setIsClockInHealthDialogOpen] = useState(false);
  const [isSOSLoading, setIsSOSLoading] = useState(false);
  const [isPresenceDialogOpen, setIsPresenceDialogOpen] = useState(false);
  const [selectedTeamIndex, setSelectedTeamIndex] = useState<number | null>(null);
  const [teamAttendance, setTeamAttendance] = useState<{
    teamName: string;
    total: number;
    present: number;
    presentList: { name: string; position: string; clockIn: string }[];
    absentList: { name: string; position: string }[];
  }[]>([]);
  const [bannerText, setBannerText] = useState('안전한 하루가 되세요');
  const [activeCategory, setActiveCategory] = useState<'ALL' | 'WORK' | 'HR' | 'WELFARE'>('ALL');

  const isInitialNotices = useRef(true);
  const isInitialAccidents = useRef(true);

  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [adminStats, setAdminStats] = useState({
    totalEmployees: 0,
    presentToday: 0,
    pendingLeaves: 0,
    openAccidents: 0
  });
  const [pendingTrainings, setPendingTrainings] = useState(0);
  const [isAppExited, setIsAppExited] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'specialDates'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dates: Record<string, any> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.date) {
          dates[data.date] = data;
        }
      });
      setSpecialDates(dates);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'specialDates');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Only intercept if we are on the primary home dashboard view to prevent random navigation capture
    // Check if back interceptor state has already been pushed to prevent duplicating junk history entries
    const currentState = window.history.state;
    const hasInterceptor = currentState && currentState.isBackInterceptor;

    if (!hasInterceptor) {
      window.history.pushState(
        { 
          ...(currentState || {}), 
          isBackInterceptor: true 
        }, 
        '', 
        window.location.href
      );
    }

    const handlePopState = (event: PopStateEvent) => {
      // Re-push immediately to keep the back interceptor active and preserve internal routing states
      const stateToRestore = window.history.state || {};
      window.history.pushState(
        { 
          ...stateToRestore, 
          isBackInterceptor: true 
        }, 
        '', 
        window.location.href
      );

      const now = Date.now();
      const lastBack = sessionStorage.getItem('last_back_clicked_time');
      const lastTime = lastBack ? parseInt(lastBack, 10) : 0;

      if (now - lastTime < 2000) {
        toast.error('애플리케이션을 종료합니다...', { duration: 1500 });
        sessionStorage.removeItem('last_back_clicked_time');
        setIsAppExited(true);
        setTimeout(() => {
          try {
            window.close();
          } catch (e) {
            // Safe fallback
          }
        }, 1000);
      } else {
        sessionStorage.setItem('last_back_clicked_time', now.toString());
        toast.warning('한 번 더 누르면 앱이 종료됩니다.', { duration: 1500 });
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Specific restrictions as requested: Hide for 조장, 반장, 사원
  const isExcludedRole = profile && (
    ['EMPLOYEE', 'WORKER'].includes(profile.role?.toUpperCase() || '') || 
    (['조장', '반장', '사원'].includes(profile.position?.trim() || '') && profile.role !== 'TEAM_LEADER') ||
    profile.employeeId?.trim()?.toLowerCase()?.includes('x66626') ||
    profile.displayName?.toLowerCase()?.includes('x66626') ||
    profile.email?.toLowerCase().includes('x66626') ||
    user?.email?.toLowerCase().includes('x66626') ||
    user?.email?.split('@')[0]?.toLowerCase() === 'x66626' ||
    (user?.email && user.email.toLowerCase().startsWith('x66626@')) ||
    (user?.displayName && user.displayName?.toLowerCase().includes('x66626'))
  );

  useEffect(() => {
    if (profile && profile.employeeId?.trim()?.toLowerCase() === 'x66626') {
      console.log("Excluded role detected in Dashboard:", profile.uid, profile.role, profile.employeeId);
    }
  }, [profile]);

  const isManager = profile && !profile.employeeId?.trim()?.toLowerCase()?.includes('x66626') && (
    ['CEO', 'DIRECTOR', 'GENERAL_MANAGER', 'SAFETY_MANAGER', 'GENERAL_AFFAIRS', 'TEAM_LEADER'].includes(profile.role) || 
    profile.permissions?.some(p => ['notice_mgmt', 'employee_mgmt', 'accident_mgmt', 'work_log_mgmt', 'attendance_mgmt', 'training_mgmt', 'admin'].includes(p)) ||
    (profile.position && ['팀장', '소장', '총무', '직장', '실장', '안전관리자', '대표'].some(p => profile.position?.includes(p)))
  );

  const isSupervisor = profile && (
    ['TEAM_LEADER', 'DIRECTOR', 'GENERAL_MANAGER', 'CEO'].includes(profile.role) ||
    (profile.position && ['팀장', '직장', '소장', '실장'].some(p => profile.position?.includes(p))) ||
    profile.permissions?.includes('team_work_log_approve')
  );

  const isExcludedFromAccidentReport = profile && (
    ['GROUP_LEADER', 'EMPLOYEE', 'WORKER'].includes(profile.role?.toUpperCase() || '') ||
    (profile.position && ['조장', '사원'].some(p => profile.position?.trim().includes(p)))
  );

  const canReportAccident = profile && !isExcludedFromAccidentReport && (
    ['CEO', 'DIRECTOR', 'GENERAL_AFFAIRS', 'GENERAL_MANAGER', 'CLERK', 'SAFETY_MANAGER', 'TEAM_LEADER'].includes(profile.role) || 
    profile.permissions?.includes('accident_mgmt') ||
    profile.permissions?.includes('admin') ||
    (profile.position && ['팀장', '직장', '소장', '서무', '총무', '실장', '안전관리자', '대표', '사장'].some(p => profile.position?.trim().includes(p)))
  );

  const canWriteHealth = profile && (
    ['CEO', 'DIRECTOR', 'GENERAL_MANAGER', 'CLERK', 'SAFETY_MANAGER', 'TEAM_LEADER'].includes(profile.role) ||
    profile.permissions?.includes('health_mgmt') ||
    (profile.position && ['반장', '조장', '팀장'].some(p => profile.position?.includes(p)))
  );

  const canRequestSnack = profile && (
    ['TEAM_LEADER', 'DIRECTOR', 'GENERAL_MANAGER', 'CEO'].includes(profile.role) ||
    (profile.position && ['팀장', '직장', '소장', '총무'].some(p => profile.position?.includes(p)))
  );

  const canManageMeal = profile && (
    ['GENERAL_MANAGER', 'CLERK'].includes(profile.role) ||
    (profile.position && ['실장', '서무'].some(p => profile.position?.includes(p)))
  );

  useEffect(() => {
    requestNotificationPermission();
    if (!profile) return;

    const today = format(new Date(), 'yyyy-MM-dd');
    const q = query(
      collection(db, 'attendance'), 
      where('uid', '==', profile.uid),
      where('date', '==', today),
      limit(1)
    );

    const unsubscribeAttendance = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const docData = snapshot.docs[0];
        setTodayAttendance({ id: docData.id, ...docData.data() } as Attendance);
      } else {
        setTodayAttendance(null);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'attendance');
    });

    // Fetch last 15 attendance entries to build a week view (No orderBy to avoid composite index requirement)
    const weeklyQ = query(
      collection(db, 'attendance'),
      where('uid', '==', profile.uid),
      limit(15)
    );
    const unsubscribeWeekly = onSnapshot(weeklyQ, (snapshot) => {
      const map: Record<string, Attendance> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data() as Attendance;
        map[data.date] = { id: doc.id, ...data };
      });
      setWeeklyAttendanceMap(map);
    }, (error) => {
      console.error("Error fetching weekly attendance map:", error);
    });

    // Notices for everyone
    const noticeQ = query(
      collection(db, 'notices'),
      orderBy('createdAt', 'desc'),
      limit(3)
    );

    const unsubscribeNotices = onSnapshot(noticeQ, (snapshot) => {
      setRecentNotices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notice)));
      if (!isInitialNotices.current) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data() as Notice;
            AlertSoundPlayer.trigger('notice', data.title);
          }
        });
      } else {
        isInitialNotices.current = false;
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notices');
    });

    // Accidents for everyone
    const accidentQ = query(
      collection(db, 'accidentCases'),
      orderBy('date', 'desc'),
      limit(3)
    );
    const unsubscribeAccidents = onSnapshot(accidentQ, (snapshot) => {
      setRecentAccidents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AccidentCase)));
      if (!isInitialAccidents.current) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data() as AccidentCase;
            AlertSoundPlayer.trigger('accident', data.title);
          }
        });
      } else {
        isInitialAccidents.current = false;
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'accidentCases');
    });

    let unsubscribeTrend = () => {};
    if (!isExcludedRole) {
      const trendQ = query(
        collection(db, 'safetyScoreLogs'),
        where('targetUid', '==', profile.uid)
      );
      unsubscribeTrend = onSnapshot(trendQ, (snapshot) => {
        const now = new Date();
        const currentMonthStart = startOfMonth(now);
        const prevMonthStart = startOfMonth(subMonths(now, 1));
        
        let currentMonthDelta = 0;
        let prevMonthDelta = 0;
        
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          const logDate = new Date(data.createdAt);
          if (logDate >= currentMonthStart) {
            currentMonthDelta += data.scoreDelta;
          } else if (logDate >= prevMonthStart && logDate < currentMonthStart) {
            prevMonthDelta += data.scoreDelta;
          }
        });
        setUserTrend(currentMonthDelta - prevMonthDelta);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'safetyScoreLogs');
      });
    }

    // Fetch My Tasks for employees
    const tasksQ = query(
      collection(db, 'tasks'),
      where('assignedToUid', '==', profile.uid),
      where('status', 'in', ['TODO', 'IN_PROGRESS']),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    const unsubscribeTasks = onSnapshot(tasksQ, (snapshot) => {
      setMyTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tasks');
    });

    // Fetch training status for employees
    const trainingQ = query(collection(db, 'trainings'), where('status', '==', 'PUBLISHED'));
    const resultQ = query(collection(db, 'trainingResults'), where('uid', '==', profile.uid));
    
    getDocs(trainingQ).then(tSnap => {
      getDocs(resultQ).then(rSnap => {
        const completedIds = new Set(rSnap.docs.map(doc => doc.data().trainingId));
        const pending = tSnap.docs.filter(doc => !completedIds.has(doc.id)).length;
        setPendingTrainings(pending);
      }).catch(err => {
        handleFirestoreError(err, OperationType.LIST, 'trainingResults');
      });
    }).catch(err => {
      handleFirestoreError(err, OperationType.LIST, 'trainings');
    });

    // Fetch Admin Stats if manager
    let unsubscribeAdminStats = () => {};
    // Ensure we only run these if profile is loaded and role is identified
    if (isManager && profile?.role && profile.role !== 'EMPLOYEE') {
      // 1. Total Employees
      getDocs(collection(db, 'users')).then(snap => {
        setAdminStats(prev => ({ ...prev, totalEmployees: snap.size }));
      }).catch(err => {
        handleFirestoreError(err, OperationType.LIST, 'users');
      });

      // 2. Present Today
      const todayInQ = query(collection(db, 'attendance'), where('date', '==', today));
      const unsubAttendance = onSnapshot(todayInQ, (snap) => {
        setAdminStats(prev => ({ ...prev, presentToday: snap.size }));
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'attendance_stats');
      });

      // 3. Pending Leaves
      const leaveQ = query(collection(db, 'leaveRequests'), where('status', '==', 'PENDING'));
      const unsubLeaves = onSnapshot(leaveQ, (snap) => {
        setAdminStats(prev => ({ ...prev, pendingLeaves: snap.size }));
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'leave_stats');
      });

      // 4. Open Accident Reports
      const accidentCheckQ = query(collection(db, 'accidentCases'), orderBy('createdAt', 'desc'), limit(10));
      const unsubAccidents = onSnapshot(accidentCheckQ, (snap) => {
        setAdminStats(prev => ({ ...prev, openAccidents: snap.size }));
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'accident_stats');
      });

      unsubscribeAdminStats = () => {
        unsubAttendance();
        unsubLeaves();
        unsubAccidents();
      };
    }

    const unsubscribeBanner = onSnapshot(doc(db, 'settings', 'banner'), (snapshot) => {
      if (snapshot.exists()) {
        setBannerText(snapshot.data().text || '안전한 하루가 되세요');
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/banner');
    });

    return () => {
      unsubscribeAttendance();
      unsubscribeWeekly();
      unsubscribeNotices();
      unsubscribeAccidents();
      unsubscribeTrend();
      unsubscribeTasks();
      unsubscribeAdminStats();
      unsubscribeBanner();
    };
  }, [profile, isManager]);

  const handleUpdateTaskStatus = async (taskId: string, newStatus: 'TODO' | 'IN_PROGRESS' | 'DONE') => {
    try {
      await updateDoc(doc(db, 'tasks', taskId), { status: newStatus });
      toast.success('작업 상태가 업데이트되었습니다.');
    } catch (error) {
      toast.error('상태 업데이트 중 오류가 발생했습니다.');
    }
  };

  const sendHealthNotification = async (status: 'GOOD' | 'NORMAL' | 'BAD') => {
    if (!profile) return;
    
    if (status === 'BAD') {
      sendPushNotification('⚠️ 건강상태 나쁨 알림', {
        body: `${profile?.displayName || '사용자'}님의 건강상태가 나쁨으로 보고되었습니다. 즉시 확인이 필요할 수 있습니다.`,
      });
    }

    if (status !== 'BAD') return; // Only notify managers if status is BAD

    try {
      const globalTargetRoles: Role[] = ['GENERAL_AFFAIRS', 'SAFETY_MANAGER', 'DIRECTOR', 'CLERK', 'GENERAL_MANAGER'];
      const managersQuery = query(collection(db, 'users'), where('role', 'in', globalTargetRoles));
      const teamLeaderQuery = query(
        collection(db, 'users'),
        where('role', '==', 'TEAM_LEADER'),
        where('jobRole', '==', profile.jobRole || '') // Match by jobRole (team)
      );

      const [managersSnap, teamLeaderSnap] = await Promise.all([
        getDocs(managersQuery),
        getDocs(teamLeaderQuery)
      ]).catch(err => {
        console.error("SOS management lookup error:", err);
        return [ { docs: [] }, { docs: [] } ] as any[];
      });

      const targetUids = new Set<string>();
      managersSnap.docs.forEach(doc => targetUids.add(doc.id));
      teamLeaderSnap.docs.forEach(doc => targetUids.add(doc.id));
      targetUids.delete(profile.uid);

      if (targetUids.size === 0) return;

      const healthLabels = { GOOD: '좋음', NORMAL: '보통', BAD: '나쁨' };
      const notificationPromises = Array.from(targetUids).map(uid => 
        addDoc(collection(db, 'notifications'), {
          uid,
          title: `[건강상태 알림] ${profile?.displayName || '사용자'}님`,
          message: `${profile?.displayName || '사용자'}님이 오늘 건강상태를 '${healthLabels[status]}'으로 보고했습니다.`,
          type: 'HEALTH_CHECK',
          isRead: false,
          createdAt: new Date().toISOString(),
          fromUid: profile.uid,
          fromName: profile?.displayName || '사용자'
        })
      );

      // Add HEALTH_BAD report in criticalIncidents
      const criticalIncidentPromise = addDoc(collection(db, 'criticalIncidents'), {
        type: 'HEALTH_BAD',
        typeName: '컨디션 나쁨',
        uid: profile.uid,
        displayName: profile.displayName || '이름없음',
        employeeId: profile.employeeId || '',
        departmentName: profile.departmentName || '미지정',
        jobRole: profile.jobRole || '',
        workplace: profile.workplace || '현장',
        status: 'PENDING',
        createdAt: new Date().toISOString()
      });

      await Promise.all([...notificationPromises, criticalIncidentPromise]);
    } catch (error) {
      console.error("Health notification error:", error);
    }
  };

  const handleUpdateHealth = async (status: 'GOOD' | 'NORMAL' | 'BAD') => {
    if (!profile) return;
    setHealthStatus(status);

    if (todayAttendance) {
      try {
        await updateDoc(doc(db, 'attendance', todayAttendance.id), { healthStatus: status });
        await sendHealthNotification(status);
        toast.success('건강상태 보고 완료', {
          description: `오늘의 건강상태를 '${status === 'GOOD' ? '좋음' : status === 'NORMAL' ? '보통' : '나쁨'}'으로 보고했습니다.`
        });
      } catch (error) {
        toast.error('건강상태 업데이트 중 오류가 발생했습니다.');
      }
    }
  };

  const handleClockIn = async () => {
    if (!profile) return;
    setIsClockInHealthDialogOpen(true);
  };

  const confirmClockIn = async (selectedHealth: 'GOOD' | 'NORMAL' | 'BAD') => {
    if (!profile) return;
    const now = new Date();
    const today = format(now, 'yyyy-MM-dd');
    const status = now.getHours() >= 9 && now.getMinutes() > 0 ? 'LATE' : 'PRESENT';

    try {
      const leaveQuery = query(
        collection(db, 'leaveRequests'),
        where('uid', '==', profile.uid),
        where('status', '==', 'APPROVED'),
        where('startDate', '<=', today),
        where('endDate', '>=', today)
      );
      const leaveSnapshot = await getDocs(leaveQuery);
      const leave = leaveSnapshot.empty ? null : leaveSnapshot.docs[0].data() as LeaveRequest;

      await addDoc(collection(db, 'attendance'), {
        uid: profile.uid,
        date: today,
        clockIn: now.toISOString(),
        status: leave?.type === 'ANNUAL' ? 'LEAVE' : status,
        healthStatus: selectedHealth,
        displayName: profile?.displayName || '이름없음',
        departmentId: profile.departmentId || '',
        departmentName: profile.departmentName || '미지정',
        leaveType: leave?.type || null
      });

      setHealthStatus(selectedHealth);
      await sendHealthNotification(selectedHealth);
      setIsClockInHealthDialogOpen(false);
      toast.success('출근 처리 완료', {
        description: `${format(now, 'HH:mm')}에 정상적으로 출근 처리되었습니다.`
      });
    } catch (error) {
      console.error("Clock-in error:", error);
      toast.error('출근 처리 중 오류가 발생했습니다.');
      handleFirestoreError(error, OperationType.WRITE, 'attendance');
    }
  };

  const handleClockOut = async () => {
    if (!todayAttendance || !profile) return;
    try {
      const now = new Date();
      const isSpecial = checkIsSpecialDay(new Date(todayAttendance.clockIn), specialDates).isSpecial;
      const { workHours, overtimeHours } = calculateAttendanceHours(todayAttendance.clockIn, now, isSpecial);
      await updateDoc(doc(db, 'attendance', todayAttendance.id), {
        clockOut: now.toISOString(),
        workHours,
        overtimeHours
      });
      toast.success('퇴근 처리 완료', {
        description: `${format(now, 'HH:mm')}에 안전하게 퇴근 처리되었습니다.`
      });
    } catch (error) {
      console.error("Clock-out error:", error);
      toast.error('퇴근 처리 중 오류가 발생했습니다.');
      handleFirestoreError(error, OperationType.WRITE, `attendance/${todayAttendance.id}`);
    }
  };

  const fetchTeamAttendance = async () => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const usersSnap = await getDocs(collection(db, 'users'));
      const attendanceSnap = await getDocs(query(collection(db, 'attendance'), where('date', '==', today)));
      
      const allUsers = usersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      const todayAttendance = attendanceSnap.docs.map(doc => doc.data() as Attendance);
      
      // Filter out users who are NOT active
      const activeUsers = allUsers.filter(u => u.status === 'ACTIVE' || (u.status === undefined && u.isActive !== false));

      const teams: Record<string, typeof teamAttendance[0]> = {};
      
      activeUsers.forEach(u => {
        const teamName = u.departmentName || '기타';
        if (!teams[teamName]) {
          teams[teamName] = {
            teamName,
            total: 0,
            present: 0,
            presentList: [],
            absentList: []
          };
        }
        
        teams[teamName].total++;
        const att = todayAttendance.find(a => a.uid === u.uid);
        if (att) {
          teams[teamName].present++;
          teams[teamName].presentList.push({
            name: u.displayName,
            position: u.position || '사원',
            clockIn: att.clockIn
          });
        } else {
          teams[teamName].absentList.push({
            name: u.displayName,
            position: u.position || '사원'
          });
        }
      });
      
      setTeamAttendance(Object.values(teams).sort((a, b) => a.teamName.localeCompare(b.teamName)));
      setSelectedTeamIndex(null);
      setIsPresenceDialogOpen(true);
    } catch (error) {
      toast.error('출근 현황을 불러오는 중 오류가 발생했습니다.');
    }
  };

  const handleSOS = async () => {
    if (!profile || isSOSLoading) return;
    setIsSOSLoading(true);
    
    try {
      const globalTargetRoles: Role[] = ['CEO', 'SAFETY_MANAGER', 'GENERAL_AFFAIRS'];
      const managersQuery = query(collection(db, 'users'), where('role', 'in', globalTargetRoles));
      const managersSnap = await getDocs(managersQuery);

      const notificationPromises = managersSnap.docs.map(doc => 
        addDoc(collection(db, 'notifications'), {
          uid: doc.id,
          title: `🚨 [긴급 SOS] ${profile?.displayName || '사용자'}님`,
          message: `${profile?.displayName || '사용자'}님이 현재 위치에서 긴급 상황을 보고했습니다! 즉시 대응이 필요합니다.`,
          type: 'EMERGENCY',
          isRead: false,
          createdAt: new Date().toISOString(),
          fromUid: profile.uid,
          fromName: profile?.displayName || '사용자',
          priority: 'high'
        })
      );

      await Promise.all(notificationPromises);
      sendPushNotification('긴급 SOS 요청 완료', { body: '관리자에게 알림이 전송되었습니다.' });
      toast.error('긴급 SOS 요청이 발송되었습니다!', {
        description: '관리자들이 즉시 확인 중입니다.',
        duration: 5000
      });
    } catch (error) {
      toast.error('SOS 발송 중 오류가 발생했습니다.');
    } finally {
      setIsSOSLoading(false);
    }
  };

  const handleAddNotice = async () => {
    if (!profile || !newNotice.title || !newNotice.content) {
      toast.error('제목과 내용을 입력해주세요.');
      return;
    }

    try {
      await addDoc(collection(db, 'notices'), {
        title: newNotice.title,
        content: newNotice.content,
        isImportant: newNotice.isImportant,
        authorUid: profile.uid,
        authorName: profile?.displayName || '사용자',
        createdAt: new Date().toISOString(),
        targetDept: 'ALL'
      });

      if (newNotice.shouldNotify) {
        const usersSnap = await getDocs(collection(db, 'users'));
        const notificationPromises = usersSnap.docs.map(uDoc => 
          addDoc(collection(db, 'notifications'), {
            uid: uDoc.id,
            title: newNotice.isImportant ? `🚨 [중요공지] ${newNotice.title}` : `📢 새 공지: ${newNotice.title}`,
            message: newNotice.content.substring(0, 80),
            type: newNotice.isImportant ? 'URGENT_NOTICE' : 'NOTICE',
            isRead: false,
            createdAt: new Date().toISOString(),
            fromUid: profile.uid,
            fromName: profile?.displayName || '사용자',
            priority: newNotice.isImportant ? 'high' : 'normal'
          })
        );
        await Promise.all(notificationPromises);
      }

      setIsNoticeDialogOpen(false);
      setNewNotice({ title: '', content: '', isImportant: false, shouldNotify: true });
      toast.success('공지사항이 등록되었습니다.');
    } catch (error) {
      toast.error('공지사항 등록 중 오류가 발생했습니다.');
    }
  };

  const workingDays = profile?.joinedAt ? differenceInDays(new Date(), new Date(profile.joinedAt)) + 1 : null;
  const { isMonitoring, startMonitoring } = useSafetySensor();

  if (isAppExited) {
    return (
      <div className="fixed inset-0 bg-black z-[9999] flex flex-col items-center justify-center text-white p-6">
        <div className="w-20 h-20 rounded-full bg-red-600/20 border border-red-500/30 flex items-center justify-center mb-6 animate-pulse">
          <span className="text-red-500 font-black text-xl">OFF</span>
        </div>
        <h2 className="text-2xl font-black mb-2">애플리케이션 종료됨</h2>
        <p className="text-sm text-zinc-500 font-bold max-w-xs text-center leading-relaxed mb-6">
          뒤로가기가 연속으로 감지되어 안전하게 전원이 꺼졌습니다. 브라우저 탭을 닫아주세요.
        </p>
        <Button 
          variant="outline"
          onClick={() => {
            sessionStorage.removeItem('last_back_clicked_time');
            setIsAppExited(false);
            window.location.reload();
          }} 
          className="bg-zinc-900 border-zinc-800 text-zinc-300 font-black px-6 h-12 rounded-2xl hover:bg-zinc-800 active:scale-95 transition-all text-xs cursor-pointer shadow-lg mt-2"
        >
          재접속 / 시스템 시작
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 pb-20 px-4 overflow-x-hidden bg-background">
      {/* 1. Welcoming Corporate User Banner (NAHAGO Style) */}
      <header className="pt-4 space-y-3">
        <div className="flex items-center justify-between gap-3 bg-card/45 backdrop-blur-md border border-border/40 p-4 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
          <div 
            onClick={() => navigate('/mypage')}
            className="flex items-center gap-3 cursor-pointer group flex-1"
          >
            <div className="w-13 h-13 rounded-full bg-muted border border-border/80 flex items-center justify-center text-muted-foreground shadow-inner shrink-0 relative group-hover:border-primary/40 transition-all duration-300">
              {user?.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt={profile?.displayName} 
                  className="w-full h-full rounded-full object-cover" 
                  referrerPolicy="no-referrer"
                />
              ) : (
                <UserIcon className="w-6 h-6 text-muted-foreground/60 group-hover:text-primary transition-colors duration-300" />
              )}
              <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-card rounded-full" />
            </div>
            <div className="space-y-0.5 min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <h1 className="text-lg font-black text-foreground tracking-tight group-hover:text-primary transition-colors flex items-center gap-1 truncate">
                  {profile?.displayName || '사용자'}
                  <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-300" />
                </h1>
              </div>
              <p className="text-xs font-bold text-muted-foreground/70 truncate tracking-tight">
                주식회사 건명기업 ({profile?.departmentName || '경영혁신부'})
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span className="text-xs font-black text-primary bg-primary/10 px-2.5 py-1 rounded-full border border-primary/15 shadow-sm">
              {profile?.position || '사원'} 🏢
            </span>
            {workingDays && (
              <span className="text-[11px] font-black text-muted-foreground/60 tracking-wider">
                D+{workingDays}
              </span>
            )}
          </div>
        </div>

        {/* Elegant Notice / Banner Ticker */}
        {bannerText && (
          <div className="bg-primary/[0.03] border border-primary/10 py-2.5 px-3.5 rounded-2xl flex items-center gap-2 overflow-hidden shadow-inner">
            <Megaphone className="w-4 h-4 text-primary shrink-0 animate-bounce" />
            <div className="flex-1 overflow-hidden relative h-4">
              <div className="flex whitespace-nowrap animate-marquee">
                <p className="inline-block text-xs font-bold text-foreground/80 px-2">
                  {bannerText} • Safety First • ALWAYS BE CAREFUL • {profile?.displayName}님 오늘도 안전한 하루 보내세요
                </p>
                <p className="inline-block text-xs font-bold text-foreground/80 px-2">
                  {bannerText} • Safety First • ALWAYS BE CAREFUL • {profile?.displayName}님 오늘도 안전한 하루 보내세요
                </p>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* IoT / Sensor Fast Status Bar */}
      <div className="flex items-center justify-between bg-card/30 border border-border/30 rounded-2xl p-2.5 px-3">
        <div className="flex items-center gap-2">
          <div className="relative flex h-2 w-2">
            <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", isMonitoring ? "bg-emerald-400" : "bg-red-400")}></span>
            <span className={cn("relative inline-flex rounded-full h-2 w-2", isMonitoring ? "bg-emerald-500" : "bg-red-500")}></span>
          </div>
          <span className="text-xs font-black text-muted-foreground/80 tracking-tight">
            {isMonitoring ? (
              <span className="text-emerald-500">안전 센서 작동중</span>
            ) : (
              <span className="text-red-500">안전 센서 꺼짐</span>
            )}
          </span>
        </div>
        {!isMonitoring ? (
          <Button 
            variant="outline" 
            size="sm" 
            className="h-7 text-xs font-black border-red-500/20 bg-red-500/10 text-red-600 rounded-full hover:bg-red-500/20 active:scale-95 transition-all cursor-pointer px-3"
            onClick={startMonitoring}
          >
            센서 켜기
          </Button>
        ) : (
          <Button 
            variant="outline" 
            size="sm" 
            className="h-7 text-xs font-black border-orange-500/20 bg-orange-500/10 text-orange-600 rounded-full hover:bg-orange-500/20 active:scale-95 transition-all cursor-pointer px-3"
            onClick={() => {
              if ((window as any).simulateSafetySensor) {
                (window as any).simulateSafetySensor('IMPACT');
              } else {
                toast.error('센서 기능이 준비되지 않았습니다.');
              }
            }}
          >
            ⚡ 센서 테스트
          </Button>
        )}
      </div>



      {/* 2. Weekly Timecard Card (NAHAGO Style) */}
      <section className="bg-card border border-border/60 rounded-3xl p-4 shadow-[0_4px_20px_rgba(0,0,0,0.02)] space-y-4">
        {/* Weekly Header Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <ChevronLeft className="w-4 h-4 text-muted-foreground/40 hover:text-foreground cursor-pointer transition-colors" />
            <h3 className="text-[15px] font-black text-foreground tracking-tight">
              {(() => {
                const now = new Date();
                const month = now.getMonth() + 1;
                // Calculate week of the month
                const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                const firstDayOfWeek = firstDayOfMonth.getDay(); 
                const offsetDate = now.getDate() + (firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1);
                const weekNum = Math.ceil(offsetDate / 7);
                return `${month}월 ${weekNum}주차 근무시간`;
              })()}
            </h3>
            <ChevronRight className="w-4 h-4 text-muted-foreground/40 hover:text-foreground cursor-pointer transition-colors" />
          </div>
          <button 
            onClick={() => navigate('/attendance')}
            className="text-xs font-black text-muted-foreground/60 hover:text-primary transition-colors flex items-center gap-0.5 cursor-pointer"
          >
            근무통계 조회 <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 7 Days Columns */}
        <div className="grid grid-cols-7 gap-1">
          {(() => {
            const daysKo = ['일', '월', '화', '수', '목', '금', '토'];
            const todayStr = format(new Date(), 'yyyy-MM-dd');
            
            // Get Monday to Sunday of the current week
            const current = new Date();
            const dayIdx = current.getDay();
            const distanceToMonday = dayIdx === 0 ? -6 : 1 - dayIdx;
            const monday = new Date(current);
            monday.setDate(current.getDate() + distanceToMonday);
            
            return Array.from({ length: 7 }).map((_, idx) => {
              const dayDate = new Date(monday);
              dayDate.setDate(monday.getDate() + idx);
              const dateStr = format(dayDate, 'yyyy-MM-dd');
              const isToday = dateStr === todayStr;
              
              const dayLabel = daysKo[dayDate.getDay()];
              const dateNum = format(dayDate, 'd');
              const att = weeklyAttendanceMap[dateStr];
              
              const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;
              
              let statusNode = null;
              if (att) {
                const inTime = att.clockIn ? format(new Date(att.clockIn), 'HH:mm') : '--:--';
                const outTime = att.clockOut ? format(new Date(att.clockOut), 'HH:mm') : '--:--';
                statusNode = (
                  <div className="flex flex-col gap-0.5 leading-[1.1]">
                    <span className="text-[10px] font-bold text-primary">{inTime}</span>
                    <span className="text-[10px] font-bold text-muted-foreground/70">{outTime}</span>
                  </div>
                );
              } else {
                if (isWeekend) {
                  statusNode = <span className="text-[10.5px] font-black text-muted-foreground/40">휴일</span>;
                } else if (dateStr === todayStr) {
                  statusNode = <span className="text-[10.5px] font-black text-primary animate-pulse">미출근</span>;
                } else if (dateStr < todayStr) {
                  statusNode = <span className="text-[10.5px] font-bold text-muted-foreground/35">결근</span>;
                } else {
                  statusNode = <span className="text-[10.5px] font-bold text-muted-foreground/25">대기</span>;
                }
              }

              return (
                <div 
                  key={idx}
                  className={cn(
                    "flex flex-col items-center gap-1.5 py-2.5 rounded-xl text-center border transition-all duration-300",
                    isToday 
                      ? "bg-primary/[0.05] border-primary/40 shadow-[0_2px_8px_rgba(37,99,235,0.06)]"
                      : "bg-card border-border/20"
                  )}
                >
                  <span className={cn(
                    "text-[10.5px] font-black tracking-tighter leading-none px-1.5 py-0.5 rounded-full",
                    isToday 
                      ? "bg-primary text-primary-foreground font-extrabold text-[10px]"
                      : isWeekend ? "text-muted-foreground/45" : "text-muted-foreground/70"
                  )}>
                    {isToday ? '오늘' : dayLabel}
                  </span>
                  
                  <span className={cn(
                    "text-[15px] font-black tracking-tight leading-none",
                    isToday ? "text-primary" : "text-foreground"
                  )}>
                    {dateNum}
                  </span>

                  <div className="min-h-5 flex items-center justify-center">
                    {statusNode}
                  </div>
                </div>
              );
            });
          })()}
        </div>

        {/* 3 Horizontal Action Buttons Group */}
        <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-border/40">
          <button 
            onClick={() => navigate('/attendance')}
            className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-muted/45 border border-border/40 hover:bg-muted active:scale-95 transition-all text-center cursor-pointer"
          >
            <Clock className="w-3.5 h-3.5 text-primary" />
            <span className="text-[12px] font-black text-foreground">근무조회</span>
          </button>

          {/* Interactive Core Punch In/Out */}
          {(() => {
            if (!todayAttendance) {
              return (
                <button 
                  onClick={handleClockIn}
                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition-all text-center cursor-pointer shadow-[0_4px_12px_rgba(37,99,235,0.25)]"
                >
                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white"></span>
                  </span>
                  <span className="text-[12px] font-black">출근등록</span>
                </button>
              );
            } else if (!todayAttendance.clockOut) {
              return (
                <button 
                  onClick={handleClockOut}
                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-600 text-white hover:bg-red-500 active:scale-95 transition-all text-center cursor-pointer shadow-[0_4px_12px_rgba(220,38,38,0.25)]"
                >
                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white"></span>
                  </span>
                  <span className="text-[12px] font-black">퇴근등록</span>
                </button>
              );
            } else {
              return (
                <button 
                  disabled
                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-muted border border-border/50 text-muted-foreground/50 text-center cursor-not-allowed"
                >
                  <CheckCircle className="w-3.5 h-3.5 text-muted-foreground/30" />
                  <span className="text-[12px] font-black">근무완료</span>
                </button>
              );
            }
          })()}

          <button 
            onClick={() => navigate('/leave')}
            className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-muted/45 border border-border/40 hover:bg-muted active:scale-95 transition-all text-center cursor-pointer"
          >
            <CalendarDays className="w-3.5 h-3.5 text-indigo-500" />
            <span className="text-[12px] font-black text-foreground">연차신청</span>
          </button>
        </div>
      </section>



      {/* 3. Services Layout (Categorized Bento Grid) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
            <h4 className="text-xs font-black text-muted-foreground/60 uppercase tracking-[0.15em]">
              업무 및 편의 서비스
            </h4>
          </div>
          <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
            카테고리별 모아보기
          </span>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {[
            { id: 'ALL', label: '전체 서비스' },
            { id: 'WORK', label: '🛠️ 안전/업무' },
            { id: 'HR', label: '📅 인사/근태' },
            { id: 'WELFARE', label: '🎁 복지/소통' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id as any)}
              className={cn(
                "px-3.5 py-2.5 rounded-2xl text-xs font-extrabold transition-all duration-300 whitespace-nowrap border cursor-pointer active:scale-95 flex-1 text-center",
                activeCategory === tab.id
                  ? "bg-primary text-primary-foreground border-primary shadow-[0_4px_12px_rgba(37,99,235,0.25)]"
                  : "bg-card border-border/60 text-muted-foreground/80 hover:text-foreground hover:bg-muted/45"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Dynamic Categorized Grid/List */}
        <div className="grid grid-cols-2 gap-3.5">
          {[
            // 1. 업무/안전 (WORK)
            { label: '작업일지', icon: ClipboardList, to: '/personal-work-log', bg: 'bg-gradient-to-br from-[#10b981] to-[#059669] text-white border-emerald-500/10', category: 'WORK', desc: '오늘의 조업 내용 기록' },
            { label: '업무/안전요청', icon: MessageSquare, to: '/request-center', bg: 'bg-gradient-to-br from-[#0284c7] to-[#0369a1] text-white border-sky-500/10', category: 'WORK', desc: '담당자 지정 실시간 요청' },
            { label: '체감온도', icon: Thermometer, to: '/perceived-temp', bg: 'bg-gradient-to-br from-[#f43f5e] to-[#e11d48] text-white border-rose-500/10', category: 'WORK', desc: '현재 체감 온도 체크' },
            { label: '보건보고', icon: Activity, to: '/health-mgmt', bg: 'bg-gradient-to-br from-[#ef4444] to-[#dc2626] text-white border-red-500/10', category: 'WORK', desc: '일일 건강 및 상태 진단' },
            { label: '교육센터', icon: BookOpen, to: '/training', bg: 'bg-gradient-to-br from-[#8b5cf6] to-[#7c3aed] text-white border-purple-500/10', category: 'WORK', desc: '의무 안전 보건 교육 이수' },
            { label: '안전랭킹', icon: Trophy, to: '/safety-leaderboard', bg: 'bg-gradient-to-br from-[#f59e0b] to-[#d97706] text-white border-amber-500/10', category: 'WORK', desc: '우수 안전 요원 랭킹' },
            
            // 2. 인사/근태 (HR)
            { label: '근태현황', icon: Clock, to: '/attendance', bg: 'bg-gradient-to-br from-[#3b82f6] to-[#2563eb] text-white border-blue-500/10', category: 'HR', desc: '나의 출퇴근 실적 현황' },
            { label: '연차신청', icon: CalendarDays, to: '/leave', bg: 'bg-gradient-to-br from-[#6366f1] to-[#4f46e5] text-white border-indigo-500/10', category: 'HR', desc: '연차 신청 및 휴가 결재' },
            
            // 3. 복지/소통 (WELFARE)
            { label: '식사신청', icon: Utensils, to: '/meal-request', bg: 'bg-gradient-to-br from-[#f97316] to-[#ea580c] text-white border-orange-500/10', category: 'WELFARE', desc: '중식/석식 간편 식사 신청' },
            { label: '칭찬하기', icon: Heart, to: '/praise-feed', bg: 'bg-gradient-to-br from-[#ec4899] to-[#db2777] text-white border-pink-500/10', category: 'WELFARE', desc: '서로를 응원하는 칭찬 피드' },
            { label: '선박게임', icon: Ship, to: '/ship-assembly', bg: 'bg-gradient-to-br from-[#0ea5e9] to-[#0284c7] text-white border-sky-500/10', category: 'WELFARE', desc: '선박 조립 퍼즐 게임' },
            { label: '현물보상', icon: Sparkles, to: '/redemption', bg: 'bg-gradient-to-br from-[#eab308] to-[#ca8a04] text-white border-yellow-500/10', category: 'WELFARE', desc: '포인트로 사내 현물 교환' },
            { label: '로또추첨', icon: Ticket, to: '/lotto', bg: 'bg-gradient-to-br from-[#a855f7] to-[#9333ea] text-white border-violet-500/10', category: 'WELFARE', desc: '행운의 번호 추출' },
            { label: '엔터놀이', icon: FileBox, to: '/entertainment', bg: 'bg-gradient-to-br from-[#14b8a6] to-[#0d9488] text-white border-teal-500/10', category: 'WELFARE', desc: '휴게 공간 엔터테인먼트' }
          ]
            .filter(item => activeCategory === 'ALL' || item.category === activeCategory)
            .map((item, idx) => (
              <Card 
                key={idx}
                onClick={() => navigate(item.to)}
                className={cn(
                  "border rounded-3xl p-4 cursor-pointer active:scale-95 transition-all duration-300 shadow-[0_4px_16px_rgba(0,0,0,0.04)] flex flex-col gap-4 justify-between relative overflow-hidden group hover:shadow-xl hover:-translate-y-0.5",
                  item.bg
                )}
              >
                {/* Clean glass reflection overlay */}
                <div className="absolute -right-3 -bottom-3 w-16 h-16 bg-white/10 rounded-full blur-xl group-hover:bg-white/20 group-hover:scale-125 transition-all duration-300" />
                <div className="absolute -left-6 -top-6 w-16 h-16 bg-black/5 rounded-full blur-xl group-hover:scale-125 transition-all duration-300" />
                
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-white border border-white/10 shadow-inner group-hover:scale-105 transition-all duration-300 shrink-0">
                    <item.icon className={cn("w-5 h-5", item.label === '칭찬하기' && "fill-current")} />
                  </div>
                  <ChevronRight className="w-4.5 h-4.5 text-white/50 group-hover:text-white group-hover:translate-x-0.5 transition-all duration-300" />
                </div>
                
                <div className="space-y-1.5 z-10">
                  <h3 className="text-[15.5px] font-black tracking-tight text-white flex items-center gap-1">
                    {item.label}
                  </h3>
                  <p className="text-[11.5px] font-medium text-white/75 truncate tracking-tight">
                    {item.desc}
                  </p>
                </div>
              </Card>
            ))}
        </div>
      </section>

      {/* 4. Notice Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
            <h4 className="text-xs font-black text-muted-foreground/60 uppercase tracking-[0.15em]">
              최근 공지사항
            </h4>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 text-xs font-black text-primary hover:bg-primary/5 rounded-full cursor-pointer px-2.5"
            onClick={() => navigate('/notices')}
          >
            더보기 <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
          </Button>
        </div>
        <Card className="bg-card border border-border/50 rounded-3xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
          <div className="divide-y divide-border/10">
            {recentNotices.length > 0 ? (
              recentNotices.map((notice) => (
                <div 
                  key={notice.id} 
                  className="p-3.5 hover:bg-muted/40 active:bg-muted/60 transition-colors cursor-pointer group"
                  onClick={() => setSelectedNotice(notice)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {notice.isImportant && (
                          <Badge className={cn(
                            "bg-rose-500 hover:bg-rose-600 text-[9.5px] font-black h-4 px-1.5 rounded-md shrink-0 leading-none",
                            (() => {
                              let createdAtDate: Date;
                              const createdRaw = notice.createdAt as any;
                              if (createdRaw) {
                                if (typeof createdRaw === 'string') {
                                  createdAtDate = new Date(createdRaw);
                                } else if (typeof createdRaw.toDate === 'function') {
                                  createdAtDate = createdRaw.toDate();
                                } else if (createdRaw.seconds) {
                                  createdAtDate = new Date(createdRaw.seconds * 1000);
                                } else {
                                  createdAtDate = new Date(createdRaw);
                                }
                              } else {
                                createdAtDate = new Date();
                              }
                              const isRecent = Date.now() - createdAtDate.getTime() < 7 * 24 * 60 * 60 * 1000;
                              const lastViewed = localStorage.getItem('lastViewedNoticesTime');
                              const isUnread = !lastViewed || createdAtDate.getTime() > new Date(lastViewed).getTime() + 1000;
                              return isRecent && isUnread ? "animate-glow-pulse" : "";
                            })()
                          )}>URGENT</Badge>
                        )}
                        <h3 className="text-[14.5px] font-bold text-foreground truncate group-hover:text-primary transition-colors leading-none">
                          {notice.title}
                        </h3>
                      </div>
                      <p className="text-xs text-muted-foreground/70 line-clamp-1">
                        {notice.content}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 self-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-8 h-8 rounded-full hover:bg-primary/10 text-muted-foreground hover:text-primary active:scale-90 transition-all cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          AlertSoundPlayer.trigger('notice', `${notice.title}. ${notice.content}`);
                        }}
                        title="음성으로 듣기"
                      >
                        <Volume2 className="w-4 h-4" />
                      </Button>
                      <span className="text-[11.5px] font-black text-muted-foreground/40 whitespace-nowrap font-mono">
                        {format(new Date(notice.createdAt), 'MM/dd')}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-muted-foreground/30 font-bold text-xs uppercase tracking-widest">
                No recent notices
              </div>
            )}
          </div>
        </Card>
      </section>

      {/* 4.5. Accident Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
            <h4 className="text-xs font-black text-muted-foreground/60 uppercase tracking-[0.15em]">
              최근 사고사례
            </h4>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 text-xs font-black text-primary hover:bg-primary/5 rounded-full cursor-pointer px-2.5"
            onClick={() => navigate('/accidents')}
          >
            더보기 <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
          </Button>
        </div>
        <Card className="bg-card border border-border/50 rounded-3xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
          <div className="divide-y divide-border/10">
            {recentAccidents.length > 0 ? (
              recentAccidents.map((accCase) => (
                <div 
                  key={accCase.id} 
                  className="p-3.5 hover:bg-muted/40 active:bg-muted/60 transition-colors cursor-pointer group"
                  onClick={() => setSelectedDashboardAccident(accCase)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge className={cn(
                          "text-[9.5px] font-black h-4 px-1.5 rounded-md shrink-0 border-none text-white leading-none",
                          accCase.severity === 'HIGH' ? "bg-red-500 animate-pulse" : accCase.severity === 'MEDIUM' ? "bg-orange-500" : "bg-emerald-500"
                        )}>
                          {accCase.severity === 'HIGH' ? '중대' : accCase.severity === 'MEDIUM' ? '경미' : '아차'}
                        </Badge>
                        <h3 className="text-[14.5px] font-bold text-foreground truncate group-hover:text-primary transition-colors leading-none">
                          {accCase.title}
                        </h3>
                      </div>
                      <p className="text-xs text-muted-foreground/70 line-clamp-1">
                        위치: {accCase.location} {accCase.description ? `• ${accCase.description}` : ''}
                      </p>
                    </div>
                    <span className="text-[11.5px] font-black text-muted-foreground/40 whitespace-nowrap font-mono mt-0.5">
                      {accCase.date ? format(new Date(accCase.date), 'MM/dd') : ''}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-muted-foreground/30 font-bold text-xs uppercase tracking-widest">
                등록된 사고사례가 없습니다
              </div>
            )}
          </div>
        </Card>
      </section>

      {/* 5. Special Admin Features (Manager/Supervisor only) */}
      {(isSupervisor || isManager || canManageMeal) && (
        <section className="space-y-3 pt-4 border-t border-border/10">
          <div className="flex items-center gap-1.5 px-0.5">
            <Lock className="w-3.5 h-3.5 text-rose-500" />
            <h4 className="text-xs font-black text-rose-500 uppercase tracking-[0.15em]">
              관리 지원 모듈
            </h4>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {isSupervisor && (
              <button 
                onClick={() => navigate('/work-instruction-mgmt')} 
                className="flex items-center gap-3 p-3.5 bg-card border border-border/40 rounded-2xl text-left hover:bg-muted transition-all cursor-pointer active:scale-95 shadow-sm"
              >
                <div className="w-9.5 h-9.5 bg-rose-500/10 border border-rose-500/10 rounded-xl flex items-center justify-center text-rose-500 shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <span className="text-xs font-black text-foreground/85 leading-tight">작업지시 관리</span>
              </button>
            )}
            {isManager && (
              <button 
                onClick={fetchTeamAttendance} 
                className="flex items-center gap-3 p-3.5 bg-card border border-border/40 rounded-2xl text-left hover:bg-muted transition-all cursor-pointer active:scale-95 shadow-sm"
              >
                <div className="w-9.5 h-9.5 bg-blue-500/10 border border-blue-500/10 rounded-xl flex items-center justify-center text-blue-500 shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <span className="text-xs font-black text-foreground/85 leading-tight">팀 출근 현황</span>
              </button>
            )}
            {isManager && (
              <button 
                onClick={() => setIsNoticeDialogOpen(true)} 
                className="flex items-center gap-3 p-3.5 bg-card border border-border/40 rounded-2xl text-left hover:bg-muted transition-all cursor-pointer active:scale-95 shadow-sm"
              >
                <div className="w-9.5 h-9.5 bg-emerald-500/10 border border-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500 shrink-0">
                  <Megaphone className="w-5 h-5" />
                </div>
                <span className="text-xs font-black text-foreground/85 leading-tight">공지사항 등록</span>
              </button>
            )}
            {canReportAccident && (
              <button 
                onClick={() => navigate('/accidents')} 
                className="flex items-center gap-3 p-3.5 bg-card border border-border/40 rounded-2xl text-left hover:bg-muted transition-all cursor-pointer active:scale-95 shadow-sm"
              >
                <div className="w-9.5 h-9.5 bg-rose-500/10 border border-rose-500/10 rounded-xl flex items-center justify-center text-rose-500 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <span className="text-xs font-black text-foreground/85 leading-tight">사고사례 등록</span>
              </button>
            )}
            {canManageMeal && (
              <button 
                onClick={() => navigate('/meal-mgmt')} 
                className="col-span-2 flex items-center justify-between p-3.5 bg-card border border-border/40 rounded-2xl hover:bg-muted transition-all cursor-pointer active:scale-98 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9.5 h-9.5 bg-orange-500/10 border border-orange-500/10 rounded-xl flex items-center justify-center text-orange-500 shrink-0">
                    <Utensils className="w-4.5 h-4.5" />
                  </div>
                  <span className="text-xs font-black text-foreground/85">식사·간식 신청 내역 관리</span>
                </div>
                <ChevronRight className="w-4.5 h-4.5 text-muted-foreground/30" />
              </button>
            )}
          </div>
        </section>
      )}

      {/* 6. Inline Quick Shortcut Links (Non-overlapping!) */}
      <section className="bg-card/60 backdrop-blur-md border border-border/60 rounded-3xl p-2.5 flex justify-around items-center gap-1 shadow-sm">
        <Button 
          variant="ghost" 
          className="flex-1 rounded-2xl h-9 text-xs font-black text-muted-foreground/80 hover:text-foreground active:bg-muted transition-all cursor-pointer px-1" 
          onClick={() => navigate('/notices')}
        >
          📢 공지사항
        </Button>
        <div className="w-px h-4 bg-border/20 self-center" />
        <Button 
          variant="ghost" 
          className="flex-1 rounded-2xl h-9 text-xs font-black text-muted-foreground/80 hover:text-foreground active:bg-muted transition-all cursor-pointer px-1" 
          onClick={() => navigate('/accidents')}
        >
          ⚠️ 사고사례
        </Button>
        <div className="w-px h-4 bg-border/20 self-center" />
        <Button 
          variant="ghost" 
          className="flex-1 rounded-2xl h-9 text-xs font-black text-muted-foreground/80 hover:text-foreground active:bg-muted transition-all cursor-pointer px-1" 
          onClick={() => navigate('/leave')}
        >
          📅 연차신청
        </Button>
      </section>

      {/* Dialogs */}
      <Dialog open={!!selectedNotice} onOpenChange={() => setSelectedNotice(null)}>
        <DialogContent className="bg-card border-border rounded-[2.5rem] max-w-lg w-[95%] p-0 overflow-hidden text-foreground">
          <DialogHeader className="p-8 pb-6 bg-muted/50 border-b border-border">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                <Megaphone className="w-6 h-6 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black tracking-tight">{selectedNotice?.title}</DialogTitle>
                <DialogDescription className="text-muted-foreground/60 font-bold text-xs uppercase tracking-widest mt-1">
                  작성일: {selectedNotice && format(new Date(selectedNotice.createdAt), 'yyyy.MM.dd HH:mm')}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="p-8 max-h-[60dvh] overflow-y-auto no-scrollbar">
            <div className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap font-medium">
              {selectedNotice?.content}
            </div>
          </div>
          <DialogFooter className="p-8 pt-4 bg-muted/50 border-t border-border flex flex-col sm:flex-row gap-2">
            <Button 
              variant="outline"
              className="flex-1 h-12 rounded-xl font-black border-primary/20 text-primary hover:bg-primary/5 flex items-center justify-center gap-1.5 cursor-pointer"
              onClick={() => {
                if (selectedNotice) {
                  AlertSoundPlayer.trigger('notice', `${selectedNotice.title}. ${selectedNotice.content}`);
                }
              }}
            >
              <Volume2 className="w-4 h-4 animate-pulse" />
              음성 방송 듣기
            </Button>
            <Button className="flex-1 h-12 rounded-xl font-black bg-foreground text-background hover:bg-foreground/90 cursor-pointer" onClick={() => setSelectedNotice(null)}>확인</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedDashboardAccident} onOpenChange={() => setSelectedDashboardAccident(null)}>
        <DialogContent className="bg-card border-border rounded-[2.5rem] max-w-lg w-[95%] p-0 overflow-hidden text-foreground">
          <DialogHeader className="p-8 pb-6 bg-muted/50 border-b border-border">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  {selectedDashboardAccident && (
                    <Badge className={cn(
                      "text-[9px] font-black h-5 px-2 rounded border-none text-white",
                      selectedDashboardAccident.severity === 'HIGH' ? "bg-red-500" : selectedDashboardAccident.severity === 'MEDIUM' ? "bg-orange-500" : "bg-emerald-500"
                    )}>
                      {selectedDashboardAccident.severity === 'HIGH' ? '중대사고' : selectedDashboardAccident.severity === 'MEDIUM' ? '경미사고' : '아차사고'}
                    </Badge>
                  )}
                  <span className="text-[10px] font-bold text-muted-foreground bg-muted-foreground/5 px-2 py-0.5 rounded">
                    {selectedDashboardAccident?.type === 'SAFE' ? '안전수칙' : selectedDashboardAccident?.type === 'INCIDENT' ? '잠재재해' : '사고사례'}
                  </span>
                </div>
                <DialogTitle className="text-xl font-black tracking-tight mt-1">{selectedDashboardAccident?.title}</DialogTitle>
                <DialogDescription className="text-muted-foreground/60 font-bold text-xs tracking-widest mt-1">
                  발생장소: {selectedDashboardAccident?.location} • 발생일: {selectedDashboardAccident?.date}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="p-8 max-h-[60dvh] overflow-y-auto no-scrollbar space-y-4">
            <div>
              <p className="text-xs font-black text-muted-foreground/60 uppercase tracking-widest pl-1 mb-1">상세 내용</p>
              <div className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap font-medium bg-muted/20 p-4 rounded-2xl">
                {selectedDashboardAccident?.description}
              </div>
            </div>
            {selectedDashboardAccident?.measures && (
              <div>
                <p className="text-xs font-black text-primary uppercase tracking-widest pl-1 mb-1">조치 결과</p>
                <div className="text-sm leading-relaxed text-primary/85 bg-primary/5 p-4 rounded-2xl border border-primary/10 font-bold font-sans">
                  {selectedDashboardAccident?.measures}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="p-8 pt-4 bg-muted/50 border-t border-border">
            <Button className="w-full h-12 rounded-xl font-black bg-foreground text-background hover:bg-foreground/90" onClick={() => setSelectedDashboardAccident(null)}>확인</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPresenceDialogOpen} onOpenChange={setIsPresenceDialogOpen}>
        <DialogContent className="bg-card border border-border rounded-[2.5rem] shadow-2xl max-w-lg w-[95%] p-0 overflow-hidden flex flex-col max-h-[90dvh] text-foreground">
          <DialogHeader className="p-8 pb-6 bg-muted/50 border-b border-border shrink-0">
            <div className="flex items-center gap-4">
              {selectedTeamIndex !== null && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="w-10 h-10 rounded-xl bg-muted text-muted-foreground/60 hover:text-foreground"
                  onClick={() => setSelectedTeamIndex(null)}
                >
                  <ChevronRight className="w-5 h-5 rotate-180" />
                </Button>
              )}
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-black tracking-tighter text-foreground">
                  {selectedTeamIndex !== null ? teamAttendance[selectedTeamIndex].teamName : '실시간 출근 현황'}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground/60 font-bold">
                  {selectedTeamIndex !== null ? '상세 인원 및 현황을 확인합니다.' : '팀별 현황을 선택하여 상세 내용을 확인합니다.'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-8 space-y-4 overflow-y-auto flex-grow no-scrollbar">
            {selectedTeamIndex === null ? (
              <div className="grid gap-3">
                {teamAttendance.map((team, idx) => (
                  <button 
                    key={idx} 
                    className="flex items-center justify-between p-5 bg-card rounded-2xl border border-border hover:bg-muted transition-all active:scale-[0.98] text-left"
                    onClick={() => setSelectedTeamIndex(idx)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-foreground">{team.teamName}</h3>
                        <p className="text-xs font-bold text-muted-foreground/40">총 {team.total}명</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-black text-primary">{team.present} / {team.total}</span>
                      <ChevronRight className="w-5 h-5 text-muted-foreground/30" />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-3">
                  <h4 className="text-xs font-black text-emerald-500 uppercase tracking-widest pl-1">출근 완료 ({teamAttendance[selectedTeamIndex].present}명)</h4>
                  <div className="grid gap-2">
                    {teamAttendance[selectedTeamIndex].presentList.map((person, pIdx) => (
                      <div key={`p-${pIdx}`} className="flex items-center justify-between p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          <div>
                            <span className="text-sm font-black text-foreground">{person.name}</span>
                            <span className="ml-2 text-[10px] font-bold text-muted-foreground/40">{person.position}</span>
                          </div>
                        </div>
                        <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                          {format(new Date(person.clockIn), 'HH:mm')} 출근
                        </span>
                      </div>
                    ))}
                    {teamAttendance[selectedTeamIndex].presentList.length === 0 && (
                      <p className="py-4 text-center text-muted-foreground/30 font-bold text-xs">출근 인원이 없습니다.</p>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-black text-red-500 uppercase tracking-widest pl-1">미출근 ({teamAttendance[selectedTeamIndex].absentList.length}명)</h4>
                  <div className="grid gap-2">
                    {teamAttendance[selectedTeamIndex].absentList.map((person, aIdx) => (
                      <div key={`a-${aIdx}`} className="flex items-center justify-between p-4 bg-red-500/5 rounded-xl border border-red-500/10">
                        <div className="flex items-center gap-3 opacity-50">
                          <XCircle className="w-4 h-4 text-red-500" />
                          <div>
                            <span className="text-sm font-black text-foreground">{person.name}</span>
                            <span className="ml-2 text-[10px] font-bold text-muted-foreground/40">{person.position}</span>
                          </div>
                        </div>
                        <span className="text-[10px] font-black text-red-500 bg-red-500/10 px-2 py-0.5 rounded-md">
                          미출근
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {teamAttendance.length === 0 && (
              <div className="py-20 text-center space-y-4">
                <Users className="w-16 h-16 mx-auto text-muted-foreground/10" />
                <p className="text-muted-foreground/30 font-black">데이터를 불러오는 중이거나 인원이 없습니다.</p>
              </div>
            )}
          </div>

          <DialogFooter className="p-8 pt-4 bg-muted/50 border-t border-border shrink-0">
            <Button 
              className="w-full h-14 bg-card border border-border rounded-2xl font-black text-foreground hover:bg-muted"
              onClick={() => setIsPresenceDialogOpen(false)}
            >
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isNoticeDialogOpen} onOpenChange={setIsNoticeDialogOpen}>
        <DialogContent className="bg-card border-border rounded-3xl text-foreground">
          <DialogHeader>
            <DialogTitle className="text-xl font-black flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-primary" /> 새 공지사항 등록
            </DialogTitle>
            <DialogDescription className="text-muted-foreground font-bold">전체 사원에게 공지합니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input 
              value={newNotice.title} 
              onChange={e => setNewNotice({...newNotice, title: e.target.value})}
              placeholder="제목" className="bg-muted border-border text-foreground rounded-xl h-12" 
            />
            <Textarea 
              value={newNotice.content}
              onChange={e => setNewNotice({...newNotice, content: e.target.value})}
              placeholder="내용" className="bg-muted border-border text-foreground rounded-xl min-h-[150px]" 
            />
            <div className="flex items-center gap-4">
               <div className="flex items-center gap-2">
                  <input type="checkbox" checked={newNotice.isImportant} onChange={e => setNewNotice({...newNotice, isImportant: e.target.checked})} className="rounded bg-muted border-border" />
                  <span className="text-xs font-bold">중요 공지</span>
               </div>
               <div className="flex items-center gap-2">
                  <input type="checkbox" checked={newNotice.shouldNotify} onChange={e => setNewNotice({...newNotice, shouldNotify: e.target.checked})} className="rounded bg-muted border-border" />
                  <span className="text-xs font-bold">푸시 알림</span>
               </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddNotice} className="w-full bg-primary text-primary-foreground font-black h-12 rounded-xl">등록하기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Clock-In Health Dialog */}
      <Dialog open={isClockInHealthDialogOpen} onOpenChange={setIsClockInHealthDialogOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-sm rounded-[2.5rem]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-center pt-4">오늘의 몸 상태는 어떠신가요?</DialogTitle>
            <DialogDescription className="text-center text-muted-foreground/40 font-bold">
              안전한 업무를 위해 현재 컨디션을 체크해주세요.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-3 py-6">
            <button
               onClick={() => confirmClockIn('GOOD')}
               className="flex flex-col items-center gap-3 p-4 bg-muted hover:bg-emerald-500/20 rounded-3xl border border-border transition-all group"
            >
               <span className="text-3xl">😊</span>
               <span className="text-xs font-black text-muted-foreground/60 group-hover:text-emerald-500">좋음</span>
            </button>
            <button
               onClick={() => confirmClockIn('NORMAL')}
               className="flex flex-col items-center gap-3 p-4 bg-muted hover:bg-amber-500/20 rounded-3xl border border-border transition-all group"
            >
               <span className="text-3xl">😐</span>
               <span className="text-xs font-black text-muted-foreground/60 group-hover:text-amber-500">보통</span>
            </button>
            <button
               onClick={() => confirmClockIn('BAD')}
               className="flex flex-col items-center gap-3 p-4 bg-muted hover:bg-rose-500/20 rounded-3xl border border-border transition-all group"
            >
               <span className="text-3xl">☹️</span>
               <span className="text-xs font-black text-muted-foreground/60 group-hover:text-rose-500">나쁨</span>
            </button>
          </div>
          <DialogFooter className="sm:justify-center">
            <Button variant="ghost" className="text-muted-foreground/20 hover:text-foreground" onClick={() => setIsClockInHealthDialogOpen(false)}>
              나중에 하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
