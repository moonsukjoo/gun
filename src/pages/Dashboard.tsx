import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/src/components/AuthProvider';
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
  BookOpen,
  TrendingUp,
  TrendingDown,
  LayoutDashboard,
  ListTodo,
  CheckCircle,
  Users,
  AlertTriangle
} from 'lucide-react';
import { db } from '@/src/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, limit, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { Attendance, Notice, Role, AccidentCase, LeaveRequest, Task } from '@/src/types';
import { format, startOfMonth, subMonths } from 'date-fns';
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
import { grantRandomShipPart } from '@/src/services/shipService';
import { sendPushNotification, requestNotificationPermission } from '@/src/services/notificationService';
import { calculateAttendanceHours } from '@/src/lib/attendance';

export const Dashboard: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null);
  const [recentNotices, setRecentNotices] = useState<Notice[]>([]);
  const [recentAccidents, setRecentAccidents] = useState<AccidentCase[]>([]);
  const [selectedAccident, setSelectedAccident] = useState<AccidentCase | null>(null);
  const [healthStatus, setHealthStatus] = useState<'GOOD' | 'NORMAL' | 'BAD'>('GOOD');
  const [isNoticeDialogOpen, setIsNoticeDialogOpen] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [newNotice, setNewNotice] = useState({ title: '', content: '', isImportant: false, shouldNotify: true });
  const [userTrend, setUserTrend] = useState<number>(0);
  const [isSOSLoading, setIsSOSLoading] = useState(false);

  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [adminStats, setAdminStats] = useState({
    totalEmployees: 0,
    presentToday: 0,
    pendingLeaves: 0,
    openAccidents: 0
  });
  const [pendingTrainings, setPendingTrainings] = useState(0);

  const isManager = profile && (['CEO', 'DIRECTOR', 'GENERAL_MANAGER', 'SAFETY_MANAGER', 'GENERAL_AFFAIRS'].includes(profile.role) || profile.permissions?.includes('notice_mgmt'));
  const canReportAccident = profile && (['CEO', 'SAFETY_MANAGER'].includes(profile.role) || profile.permissions?.includes('accident_mgmt'));

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
    }, (error) => console.error("Attendance listener error:", error));

    const noticeQ = query(
      collection(db, 'notices'),
      orderBy('createdAt', 'desc'),
      limit(3)
    );

    const unsubscribeNotices = onSnapshot(noticeQ, (snapshot) => {
      setRecentNotices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notice)));
    }, (error) => console.error("Notices listener error:", error));

    const accidentQ = query(
      collection(db, 'accidentCases'),
      orderBy('createdAt', 'desc'),
      limit(3)
    );
    const unsubscribeAccidents = onSnapshot(accidentQ, (snapshot) => {
      setRecentAccidents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AccidentCase)));
    }, (error) => console.error("Accidents listener error:", error));

    const trendQ = query(
      collection(db, 'safetyScoreLogs'),
      where('targetUid', '==', profile.uid)
    );
    const unsubscribeTrend = onSnapshot(trendQ, (snapshot) => {
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
    }, (error) => console.error("Trend listener error:", error));

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
    }, (error) => console.error("Tasks listener error:", error));

    // Fetch training status for employees
    const trainingQ = query(collection(db, 'trainings'), where('status', '==', 'PUBLISHED'));
    const resultQ = query(collection(db, 'trainingResults'), where('uid', '==', profile.uid));
    
    getDocs(trainingQ).then(tSnap => {
      getDocs(resultQ).then(rSnap => {
        const completedIds = new Set(rSnap.docs.map(doc => doc.data().trainingId));
        const pending = tSnap.docs.filter(doc => !completedIds.has(doc.id)).length;
        setPendingTrainings(pending);
      });
    });

    // Fetch Admin Stats if manager
    let unsubscribeAdminStats = () => {};
    // Ensure we only run these if profile is loaded and role is identified
    if (isManager && profile?.role && profile.role !== 'EMPLOYEE') {
      // 1. Total Employees
      getDocs(collection(db, 'users')).then(snap => {
        setAdminStats(prev => ({ ...prev, totalEmployees: snap.size }));
      }).catch(err => console.error("Users list error", err));

      // 2. Present Today
      const todayInQ = query(collection(db, 'attendance'), where('date', '==', today));
      const unsubAttendance = onSnapshot(todayInQ, (snap) => {
        setAdminStats(prev => ({ ...prev, presentToday: snap.size }));
      }, (err) => console.error("Attendance stats error", err));

      // 3. Pending Leaves
      const leaveQ = query(collection(db, 'leaveRequests'), where('status', '==', 'PENDING'));
      const unsubLeaves = onSnapshot(leaveQ, (snap) => {
        setAdminStats(prev => ({ ...prev, pendingLeaves: snap.size }));
      }, (err) => console.error("Leave stats error", err));

      // 4. Open Accident Reports
      const accidentCheckQ = query(collection(db, 'accidentCases'), orderBy('createdAt', 'desc'), limit(10));
      const unsubAccidents = onSnapshot(accidentCheckQ, (snap) => {
        setAdminStats(prev => ({ ...prev, openAccidents: snap.size }));
      }, (err) => console.error("Accident stats error", err));

      unsubscribeAdminStats = () => {
        unsubAttendance();
        unsubLeaves();
        unsubAccidents();
      };
    }

    return () => {
      unsubscribeAttendance();
      unsubscribeNotices();
      unsubscribeAccidents();
      unsubscribeTrend();
      unsubscribeTasks();
      unsubscribeAdminStats();
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
        body: `${profile.displayName}님의 건강상태가 나쁨으로 보고되었습니다. 즉시 확인이 필요할 수 있습니다.`,
      });
    }

    try {
      const globalTargetRoles: Role[] = ['GENERAL_AFFAIRS', 'SAFETY_MANAGER'];
      const managersQuery = query(collection(db, 'users'), where('role', 'in', globalTargetRoles));
      const teamLeaderQuery = query(
        collection(db, 'users'),
        where('role', '==', 'TEAM_LEADER'),
        where('departmentId', '==', profile.departmentId || '')
      );

      const [managersSnap, teamLeaderSnap] = await Promise.all([
        getDocs(managersQuery),
        getDocs(teamLeaderQuery)
      ]);

      const targetUids = new Set<string>();
      managersSnap.docs.forEach(doc => targetUids.add(doc.id));
      teamLeaderSnap.docs.forEach(doc => targetUids.add(doc.id));
      targetUids.delete(profile.uid);

      if (targetUids.size === 0) return;

      const healthLabels = { GOOD: '좋음', NORMAL: '보통', BAD: '나쁨' };
      const notificationPromises = Array.from(targetUids).map(uid => 
        addDoc(collection(db, 'notifications'), {
          uid,
          title: `[건강상태 알림] ${profile.displayName}님`,
          message: `${profile.displayName}님이 오늘 건강상태를 '${healthLabels[status]}'으로 보고했습니다.`,
          type: 'HEALTH_CHECK',
          isRead: false,
          createdAt: new Date().toISOString(),
          fromUid: profile.uid,
          fromName: profile.displayName
        })
      );

      await Promise.all(notificationPromises);
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
        healthStatus,
        displayName: profile.displayName,
        departmentId: profile.departmentId || '',
        departmentName: profile.departmentName || '미지정',
        leaveType: leave?.type
      });

      await sendHealthNotification(healthStatus);
      toast.success('출근 처리 완료', {
        description: `${format(now, 'HH:mm')}에 정상적으로 출근 처리되었습니다.`
      });
    } catch (error) {
      toast.error('출근 처리 중 오류가 발생했습니다.');
    }
  };

  const handleClockOut = async () => {
    if (!todayAttendance || !profile) return;
    try {
      const now = new Date();
      const { workHours, overtimeHours } = calculateAttendanceHours(todayAttendance.clockIn, now);
      await updateDoc(doc(db, 'attendance', todayAttendance.id), {
        clockOut: now.toISOString(),
        workHours,
        overtimeHours
      });
      toast.success('퇴근 처리 완료', {
        description: `${format(now, 'HH:mm')}에 안전하게 퇴근 처리되었습니다.`
      });
    } catch (error) {
      toast.error('퇴근 처리 중 오류가 발생했습니다.');
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
          title: `🚨 [긴급 SOS] ${profile.displayName}님`,
          message: `${profile.displayName}님이 현재 위치에서 긴급 상황을 보고했습니다! 즉시 대응이 필요합니다.`,
          type: 'EMERGENCY',
          isRead: false,
          createdAt: new Date().toISOString(),
          fromUid: profile.uid,
          fromName: profile.displayName
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
        authorName: profile.displayName,
        createdAt: new Date().toISOString(),
        targetDept: 'ALL'
      });

      if (newNotice.shouldNotify) {
        const usersSnap = await getDocs(collection(db, 'users'));
        const notificationPromises = usersSnap.docs.map(uDoc => 
          addDoc(collection(db, 'notifications'), {
            uid: uDoc.id,
            title: `📢 새 공지: ${newNotice.title}`,
            message: newNotice.content.substring(0, 50) + '...',
            type: 'NOTICE',
            isRead: false,
            createdAt: new Date().toISOString(),
            fromUid: profile.uid,
            fromName: profile.displayName
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

  return (
    <div className="w-full max-w-xl mx-auto space-y-6 pb-24 px-4 overflow-x-hidden">
      {/* Toss-style Greeting Header */}
      <div className="py-8 space-y-2">
        <p className="text-muted-foreground font-black text-lg">
          {profile?.displayName}님,
        </p>
        <h1 className="text-3xl font-black text-white tracking-tight leading-tight whitespace-nowrap">
          안전한 하루가 되세요
        </h1>
      </div>

      {/* Admin Dashboard Statistics */}
      {isManager && (
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-card border-white/5 rounded-2xl p-4 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-3 opacity-10">
              <Users className="w-10 h-10 text-primary" />
            </div>
            <p className="text-[10px] font-black text-muted-foreground mb-1 uppercase tracking-widest">출근 현황</p>
            <p className="text-2xl font-black text-white">
              {adminStats.presentToday} <span className="text-xs font-bold text-muted-foreground">/ {adminStats.totalEmployees}</span>
            </p>
          </Card>
          <Card className="bg-card border-white/5 rounded-2xl p-4 overflow-hidden relative" onClick={() => navigate('/leave')} style={{ cursor: 'pointer' }}>
            <div className="absolute top-0 right-0 p-3 opacity-10">
              <CalendarDays className="w-10 h-10 text-amber-500" />
            </div>
            <p className="text-[10px] font-black text-muted-foreground mb-1 uppercase tracking-widest">연차 승인 대기</p>
            <p className="text-2xl font-black text-amber-500">{adminStats.pendingLeaves}</p>
          </Card>
        </div>
      )}

      {/* Employee Task List */}
      {!isManager && (
        <Card className="bg-card border-white/5 rounded-2xl overflow-hidden">
          <div className="p-5 flex items-center justify-between border-b border-white/5">
             <div className="flex items-center gap-2">
                <ListTodo className="w-4 h-4 text-primary" />
                <h4 className="text-sm font-black text-white">오늘의 할 일</h4>
             </div>
             {myTasks.length > 0 && <span className="text-[10px] font-black bg-primary/20 text-primary px-2 py-0.5 rounded-full">{myTasks.length}건</span>}
          </div>
          <CardContent className="p-0">
            {myTasks.length > 0 ? (
              <div className="divide-y divide-white/5">
                {myTasks.map(task => (
                  <div key={task.id} className="p-4 flex items-center justify-between group hover:bg-white/5 transition-colors">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-bold text-white leading-tight">{task.title}</span>
                      <span className="text-[10px] text-muted-foreground font-medium">{task.description}</span>
                    </div>
                    <button 
                      onClick={() => handleUpdateTaskStatus(task.id, 'DONE')}
                      className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-muted-foreground hover:bg-primary/20 hover:text-primary transition-all active:scale-90"
                    >
                      <CheckCircle className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center bg-white/5 flex flex-col items-center gap-2">
                <CheckCircle className="w-8 h-8 text-muted-foreground opacity-20" />
                <p className="text-xs font-bold text-muted-foreground">현재 예정된 작업이 없습니다.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Attendance & Leave Quick Actions */}
      <div className="space-y-3">
        <Card 
          className="border-none shadow-none bg-card rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-all border border-white/5"
          onClick={() => navigate('/attendance')}
        >
          <CardContent className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                <Clock className="w-6 h-6" />
              </div>
              <div className="flex flex-col overflow-hidden">
                <h4 className="text-base font-black text-white leading-tight tracking-tight">오늘의 출근</h4>
                <p className="text-sm text-muted-foreground font-bold truncate">
                  {todayAttendance ? `${format(new Date(todayAttendance.clockIn), 'HH:mm')} 출근` : '아직 출근 전이에요'}
                </p>
              </div>
            </div>
            <Button size="sm" className="bg-primary text-white font-black rounded-xl px-4 py-0 h-9 shrink-0">
              {todayAttendance ? '내역보기' : '체크인'}
            </Button>
          </CardContent>
        </Card>

        <Card 
          className="border-none shadow-none bg-card rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-all border border-white/5"
          onClick={() => navigate('/leave')}
        >
          <CardContent className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-500">
                <CalendarDays className="w-6 h-6" />
              </div>
              <div className="flex flex-col overflow-hidden">
                <h4 className="text-base font-black text-white leading-tight tracking-tight">남은 연차</h4>
                <p className="text-sm text-muted-foreground font-bold truncate">{profile?.annualLeaveBalance || 0}일 사용할 수 있어요</p>
              </div>
            </div>
            <div className="flex items-center shrink-0">
               <span className="text-lg font-black text-white mr-2">{profile?.annualLeaveBalance || 0}일</span>
               <ChevronRight className="w-5 h-5 text-muted-foreground opacity-30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Features Grid Panel */}
      <div className="bg-card rounded-2xl overflow-hidden border border-white/5">
        <div className="p-6 pb-2">
          <h4 className="text-xs font-black text-muted-foreground uppercase tracking-widest">통합 관리 서비스</h4>
        </div>
        
        <div className="divide-y divide-white/5">
          <div 
            className="p-6 py-5 flex items-center justify-between group active:bg-white/5 transition-colors cursor-pointer"
            onClick={() => navigate('/ship-assembly')}
          >
            <div className="flex items-center gap-4 overflow-hidden">
              <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center text-blue-500 shrink-0">
                <Ship className="w-5 h-5" />
              </div>
              <span className="text-base font-black text-white tracking-tight truncate">선박 조립 게임</span>
            </div>
            <div className="flex items-center gap-2">
               <span className="text-sm font-black text-blue-500">{profile?.shipParts?.length || 0}개</span>
               <ChevronRight className="w-5 h-5 text-muted-foreground opacity-30" />
            </div>
          </div>

          <div 
            className="p-6 py-5 flex items-center justify-between group active:bg-white/5 transition-colors cursor-pointer"
            onClick={() => navigate('/training')}
          >
            <div className="flex items-center gap-4 overflow-hidden">
              <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-500 shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-base font-black text-white tracking-tight truncate">직무 교육</span>
                <span className="text-xs text-emerald-500 font-bold">{profile?.jobRole || '안전 교육'}</span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground opacity-30" />
          </div>

          <div 
            className="p-6 py-5 flex items-center justify-between group active:bg-white/5 transition-colors cursor-pointer"
            onClick={() => navigate('/safety-score')}
          >
            <div className="flex items-center gap-4 overflow-hidden">
              <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center text-amber-500 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-base font-black text-white tracking-tight">나의 안전 지수</span>
                <span className="text-xs text-muted-foreground font-bold truncate">점수 랭킹 확인</span>
              </div>
            </div>
            <div className="text-right flex flex-col items-end shrink-0">
              <span className="text-lg font-black text-amber-500">{profile?.safetyScore ?? 100}점</span>
              {userTrend !== 0 && (
                <span className={cn("text-[10px] font-black", userTrend > 0 ? "text-emerald-500" : "text-red-500")}>
                  {userTrend > 0 ? <TrendingUp className="w-3 h-3 inline" /> : <TrendingDown className="w-3 h-3 inline" />} {Math.abs(userTrend)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center p-2 bg-white/5">
          <button 
            onClick={() => navigate('/notices')}
            className="flex-1 py-3 text-sm font-black text-muted-foreground hover:text-white transition-colors"
          >
            공지사항
          </button>
          <div className="w-px h-4 bg-white/10" />
          <button 
            onClick={() => navigate('/leave')}
            className="flex-1 py-3 text-sm font-black text-muted-foreground hover:text-white transition-colors"
          >
            연차신청
          </button>
          <div className="w-px h-4 bg-white/10" />
          <button 
            onClick={() => navigate('/accidents')}
            className="flex-1 py-3 text-sm font-black text-muted-foreground hover:text-white transition-colors"
          >
            사고사례
          </button>
        </div>
      </div>

      {/* Health Check & Clock Control */}
      <Card className="border-none shadow-none bg-card rounded-2xl overflow-hidden border border-white/5">
        <CardContent className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
              <h4 className="text-sm font-black text-white opacity-60">오늘의 컨디션</h4>
            </div>
            <Badge className="bg-primary/20 text-primary border-none px-3 py-1 font-black text-[10px] tracking-widest shrink-0">
              {todayAttendance ? (todayAttendance.clockOut ? 'WORK END' : 'WORKING') : 'BEFORE WORK'}
            </Badge>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {(['GOOD', 'NORMAL', 'BAD'] as const).map((status) => (
              <button
                key={status}
                className={cn(
                  "h-20 rounded-2xl font-black text-xs transition-all flex flex-col items-center justify-center gap-1 border border-white/5",
                  (todayAttendance?.healthStatus || healthStatus) === status 
                    ? "bg-primary/20 text-primary border-primary/30" 
                    : "bg-white/5 text-muted-foreground hover:bg-white/10"
                )}
                onClick={() => handleUpdateHealth(status)}
              >
                <span className="text-2xl">{status === 'GOOD' ? '😊' : status === 'NORMAL' ? '😐' : '☹️'}</span>
                <span className="tracking-tight text-[10px] font-black">{status === 'GOOD' ? '좋음' : status === 'NORMAL' ? '보통' : '나쁨'}</span>
              </button>
            ))}
          </div>

          {!todayAttendance ? (
            <Button 
              className="w-full h-14 bg-primary text-white hover:bg-primary/90 font-black text-lg rounded-2xl transition-all shadow-lg shadow-primary/20"
              onClick={handleClockIn}
            >
              출근하기
            </Button>
          ) : !todayAttendance.clockOut ? (
            <Button 
              className="w-full h-14 bg-card text-white hover:bg-white/5 border border-white/10 font-black text-lg rounded-2xl transition-all"
              onClick={handleClockOut}
            >
              퇴근하기
            </Button>
          ) : (
            <div className="w-full h-14 flex items-center justify-center bg-white/5 rounded-2xl font-black text-base text-muted-foreground">
              평안한 저녁 되세요!
            </div>
          )}
        </CardContent>
      </Card>

      {/* SOS & Notifications */}
      <div className="flex gap-4">
        <Button 
          variant="outline" 
          className="flex-1 h-14 rounded-2xl bg-white/5 border-white/10 text-white font-black text-sm gap-2"
          onClick={() => navigate('/notifications')}
        >
          <Bell className="w-4 h-4 text-primary" />
          알림
        </Button>
        <Button 
          variant="outline" 
          className="flex-1 h-14 rounded-2xl bg-red-500/10 border-red-500/20 text-red-500 font-black text-sm gap-2"
          onClick={handleSOS}
          disabled={isSOSLoading}
        >
          <ShieldAlert className="w-4 h-4" />
          {isSOSLoading ? '발생 중' : '긴급 SOS'}
        </Button>
      </div>

      {/* Admin Quick Actions */}
      {isManager && (
        <div className="flex flex-col gap-3 pt-6">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest text-center">관리자 바로가기</p>
          <div className="flex gap-3">
             <Button 
                variant="ghost" 
                className="flex-1 bg-white/5 border border-white/5 rounded-2xl h-12 text-xs font-black text-white"
                onClick={() => setIsNoticeDialogOpen(true)}
             >
               공지등록
             </Button>
             <Button 
                variant="ghost" 
                className="flex-1 bg-white/5 border border-white/5 rounded-2xl h-12 text-xs font-black text-white"
                onClick={() => navigate('/accidents')}
             >
               사고보고
             </Button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <Dialog open={isNoticeDialogOpen} onOpenChange={setIsNoticeDialogOpen}>
        <DialogContent className="bg-card border-white/10 rounded-3xl text-white">
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
              placeholder="제목" className="bg-white/5 border-white/10 text-white rounded-xl h-12" 
            />
            <Textarea 
              value={newNotice.content}
              onChange={e => setNewNotice({...newNotice, content: e.target.value})}
              placeholder="내용" className="bg-white/5 border-white/10 text-white rounded-xl min-h-[150px]" 
            />
            <div className="flex items-center gap-4">
               <div className="flex items-center gap-2">
                  <input type="checkbox" checked={newNotice.isImportant} onChange={e => setNewNotice({...newNotice, isImportant: e.target.checked})} className="rounded bg-white/10 border-white/10" />
                  <span className="text-xs font-bold">중요 공지</span>
               </div>
               <div className="flex items-center gap-2">
                  <input type="checkbox" checked={newNotice.shouldNotify} onChange={e => setNewNotice({...newNotice, shouldNotify: e.target.checked})} className="rounded bg-white/10 border-white/10" />
                  <span className="text-xs font-bold">푸시 알림</span>
               </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddNotice} className="w-full bg-primary text-white font-black h-12 rounded-xl">등록하기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
