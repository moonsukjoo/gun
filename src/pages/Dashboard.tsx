import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/src/components/AuthProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, 
  Calendar, 
  CalendarDays,
  ShieldCheck,
  Activity,
  Bell
} from 'lucide-react';
import { db } from '@/src/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, limit, orderBy } from 'firebase/firestore';
import { Attendance, Notice, Role, Notification, AccidentCase, LeaveRequest } from '@/src/types';
import { format, differenceInMinutes } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getDocs } from 'firebase/firestore';
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
import { Plus, Megaphone, ShieldAlert, AlertCircle, Info, InfoIcon } from 'lucide-react';

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
  const [newNotice, setNewNotice] = useState({ title: '', content: '', isImportant: false });

  const isManager = profile && (['CEO', 'SAFETY_MANAGER'].includes(profile.role) || profile.permissions?.includes('notice_mgmt'));
  const canReportAccident = profile && (['CEO', 'SAFETY_MANAGER'].includes(profile.role) || profile.permissions?.includes('accident_mgmt'));

  useEffect(() => {
    if (!profile) return;

    // Fetch today's attendance for current user
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
    });

    // Fetch recent notices
    const noticeQ = query(
      collection(db, 'notices'),
      orderBy('createdAt', 'desc'),
      limit(3)
    );

    const unsubscribeNotices = onSnapshot(noticeQ, (snapshot) => {
      setRecentNotices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notice)));
    });

    // Fetch recent accidents
    const accidentQ = query(
      collection(db, 'accidentCases'),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    const unsubscribeAccidents = onSnapshot(accidentQ, (snapshot) => {
      setRecentAccidents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AccidentCase)));
    });

    return () => {
      unsubscribeAttendance();
      unsubscribeNotices();
      unsubscribeAccidents();
    };
  }, [profile]);

  const sendHealthNotification = async (status: 'GOOD' | 'NORMAL' | 'BAD') => {
    if (!profile) return;
    
    try {
      // Roles to notify as requested: General Affairs, Safety Manager
      const globalTargetRoles: Role[] = ['GENERAL_AFFAIRS', 'SAFETY_MANAGER'];
      
      // Fetch global managers
      const managersQuery = query(
        collection(db, 'users'),
        where('role', 'in', globalTargetRoles)
      );
      
      // Fetch department team leader (Team Leader)
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
      
      // Remove self
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
        await updateDoc(doc(db, 'attendance', todayAttendance.id), {
          healthStatus: status
        });
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
    
    // Check if late (after 09:00)
    const status = now.getHours() >= 9 && now.getMinutes() > 0 ? 'LATE' : 'PRESENT';

    try {
      // Check for approved leave today
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
      console.error("Clock-in error:", error);
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
      console.error("Clock-out error:", error);
      toast.error('퇴근 처리 중 오류가 발생했습니다.');
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

      setIsNoticeDialogOpen(false);
      setNewNotice({ title: '', content: '', isImportant: false });
      toast.success('공지사항이 등록되었습니다.');
    } catch (error) {
      toast.error('공지사항 등록 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto space-y-8 pb-32 px-4 flex flex-col items-center">
      <header className="flex items-center justify-between bg-white p-6 rounded-[2.5rem] shadow-2xl border border-slate-100 w-full ring-4 ring-primary/5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black text-primary uppercase tracking-[0.2em] bg-primary/10 px-2.5 py-0.5 rounded-full">대시보드</span>
          </div>
          <h2 className="text-2xl font-black tracking-tighter text-slate-900 leading-tight">
            {profile?.displayName}<span className="text-slate-400 ml-1 font-bold">님</span>
          </h2>
          <div className="flex items-center gap-1.5 pt-1">
            <Badge variant="outline" className="text-[8px] font-black border-none bg-slate-100 text-slate-500 px-2.5 py-0.5 rounded-full uppercase tracking-widest leading-none">
              {profile?.departmentName || '부서 미지정'}
            </Badge>
            <Badge variant="outline" className="text-[8px] font-black border-none bg-primary text-white px-2.5 py-0.5 rounded-full uppercase tracking-widest leading-none">
              {profile?.position || '직위 미지정'}
            </Badge>
          </div>
        </div>
        <div className="text-right flex flex-col items-end">
          <div className="w-11 h-11 bg-slate-50 rounded-2xl flex items-center justify-center mb-1.5 border border-slate-200/50 shadow-inner">
            <Calendar className="w-5 h-5 text-primary" />
          </div>
          <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">{format(new Date(), 'EEEE', { locale: ko })}</div>
          <div className="text-sm font-black text-slate-900 tracking-tighter leading-none">{format(new Date(), 'MM.dd')}</div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4 w-full">
        <Card className="border-none shadow-xl bg-white rounded-[2rem] hover:shadow-2xl transition-all border border-slate-100/50">
          <CardContent className="p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">출근</span>
              <div className="w-6 h-6 bg-primary/10 rounded-lg flex items-center justify-center">
                <Clock className="w-3.5 h-3.5 text-primary" />
              </div>
            </div>
            <div className="text-2xl font-black tracking-tighter text-slate-900">
              {todayAttendance ? format(new Date(todayAttendance.clockIn), 'HH:mm') : '--:--'}
            </div>
            <div className={cn(
              "text-[9px] font-black px-2 py-0.5 rounded-full w-fit uppercase tracking-wider",
              todayAttendance?.status === 'LATE' ? "bg-red-50 text-red-500" : "bg-emerald-50 text-emerald-500"
            )}>
              {todayAttendance ? (todayAttendance.status === 'LATE' ? '지각' : '정상') : '대기 중'}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl bg-white rounded-[2rem] hover:shadow-2xl transition-all border border-slate-100/50">
          <CardContent className="p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">연차</span>
              <div className="w-6 h-6 bg-blue-50 rounded-lg flex items-center justify-center">
                <CalendarDays className="w-3.5 h-3.5 text-blue-500" />
              </div>
            </div>
            <div className="text-2xl font-black tracking-tighter text-slate-900">{profile?.annualLeaveBalance || 0}<span className="text-sm text-slate-400 ml-1 font-bold tracking-tight">일</span></div>
            <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none">연차 잔액</div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-2xl bg-primary text-white overflow-hidden relative active:scale-[0.99] transition-all rounded-[3rem] w-full group">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl group-hover:bg-white/20 transition-all duration-700" />
        <CardContent className="p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20">
                <Activity className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-white/60 uppercase tracking-widest leading-none mb-1">건명 통합 시스템</span>
                <span className="text-lg font-black tracking-tighter leading-none whitespace-nowrap">실시간 근태 체크인</span>
              </div>
            </div>
            <Badge className="bg-white/20 backdrop-blur-md text-white border-none px-3 py-1 font-black text-[9px] uppercase tracking-widest">
              {todayAttendance?.clockIn ? (todayAttendance.clockOut ? '업무 종료' : '근무 중') : '근무 전'}
            </Badge>
          </div>
          
          <div className="space-y-6">
            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50 text-center">오늘의 건강상태 보고</p>
              <div className="grid grid-cols-3 gap-3">
                {(['GOOD', 'NORMAL', 'BAD'] as const).map((status) => (
                  <button
                    key={status}
                    className={cn(
                      "h-16 rounded-3xl font-black text-xs transition-with-all flex flex-col items-center justify-center gap-1 border-2",
                      (todayAttendance?.healthStatus || healthStatus) === status 
                        ? "bg-white text-primary border-white shadow-2xl scale-105" 
                        : "bg-white/5 text-white border-white/10 hover:bg-white/10"
                    )}
                    onClick={() => handleUpdateHealth(status)}
                  >
                    <span className="text-xl">{status === 'GOOD' ? '😊' : status === 'NORMAL' ? '😐' : '☹️'}</span>
                    <span className="uppercase tracking-widest text-[9px]">{status === 'GOOD' ? '좋음' : status === 'NORMAL' ? '보통' : '나쁨'}</span>
                  </button>
                ))}
              </div>
            </div>

            {!todayAttendance ? (
              <Button 
                className="w-full h-16 bg-white text-primary hover:bg-slate-50 font-black text-xl rounded-[2rem] shadow-2xl transition-all active:scale-95"
                onClick={handleClockIn}
              >
                출근하기
              </Button>
            ) : !todayAttendance.clockOut ? (
              <Button 
                className="w-full h-16 bg-white text-primary hover:bg-slate-50 font-black text-xl rounded-[2rem] shadow-2xl transition-all active:scale-95"
                onClick={handleClockOut}
              >
                퇴근하기
              </Button>
            ) : (
              <div className="w-full h-16 flex items-center justify-center bg-white/10 backdrop-blur-md rounded-[2rem] font-black text-base border border-white/20 text-white/80">
                수고하셨습니다!
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm bg-white rounded-2xl overflow-hidden w-full">
        <CardHeader className="p-5 pb-2 flex flex-row items-center justify-between bg-slate-50/50 border-b border-slate-100">
          <CardTitle className="text-sm font-black flex items-center gap-2 tracking-tight whitespace-nowrap">
            <div className="w-1.5 h-4 bg-primary rounded-full" />
            공지사항
          </CardTitle>
          <div className="flex items-center gap-2">
            {isManager && (
              <Dialog open={isNoticeDialogOpen} onOpenChange={setIsNoticeDialogOpen}>
                <DialogTrigger render={
                  <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg text-primary hover:bg-primary/5">
                    <Plus className="w-4 h-4" />
                  </Button>
                } />
                <DialogContent className="bg-white border-none rounded-[2rem] shadow-2xl max-w-lg w-[95%] p-0 overflow-hidden">
                  <DialogHeader className="p-8 pb-4 bg-slate-50 border-b border-slate-100">
                    <DialogTitle className="text-2xl font-black tracking-tighter flex items-center gap-2">
                      <Megaphone className="w-6 h-6 text-primary" /> 공지사항 등록
                    </DialogTitle>
                    <DialogDescription className="text-slate-500 font-bold">전 사원에게 전달할 내용을 입력하세요.</DialogDescription>
                  </DialogHeader>
                  <div className="p-8 space-y-5">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">제목</label>
                      <Input 
                        value={newNotice.title}
                        onChange={(e) => setNewNotice({...newNotice, title: e.target.value})}
                        placeholder="공지 제목을 입력하세요"
                        className="h-12 bg-slate-50 border-slate-200 rounded-xl font-bold"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">내용</label>
                      <Textarea 
                        value={newNotice.content}
                        onChange={(e) => setNewNotice({...newNotice, content: e.target.value})}
                        placeholder="공지 내용을 입력하세요"
                        className="min-h-[150px] bg-slate-50 border-slate-200 rounded-xl font-bold"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        id="important" 
                        checked={newNotice.isImportant}
                        onChange={(e) => setNewNotice({...newNotice, isImportant: e.target.checked})}
                        className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                      />
                      <label htmlFor="important" className="text-xs font-black text-slate-600">긴급 공지로 설정</label>
                    </div>
                  </div>
                  <DialogFooter className="p-8 pt-4 bg-slate-50 border-t border-slate-100 flex flex-row gap-3">
                    <Button variant="outline" className="flex-1 h-12 rounded-xl font-black border-slate-200" onClick={() => setIsNoticeDialogOpen(false)}>취소</Button>
                    <Button className="flex-1 h-12 rounded-xl font-black shadow-lg" onClick={handleAddNotice}>등록 완료</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
            <Button variant="link" className="h-auto p-0 text-primary font-black text-[10px] uppercase tracking-widest opacity-0 pointer-events-none">전체보기</Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            {recentNotices.length > 0 ? recentNotices.map(notice => (
              <div key={notice.id} className="p-5 active:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      {notice.isImportant && (
                        <span className="px-2 py-0.5 bg-red-500 text-white text-[8px] font-black rounded-full uppercase tracking-widest shadow-sm shadow-red-200">긴급</span>
                      )}
                      <h4 className="font-black text-sm text-slate-900 leading-tight tracking-tight">{notice.title}</h4>
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-1 font-bold">{notice.content}</p>
                  </div>
                  <span className="text-[10px] font-black text-slate-500 whitespace-nowrap pt-1 uppercase">{format(new Date(notice.createdAt), 'MM.dd')}</span>
                </div>
              </div>
            )) : (
              <div className="p-10 text-center text-slate-500 text-xs font-black uppercase tracking-widest">공지사항이 없습니다.</div>
            )}
          </div>
        </CardContent>
      </Card>
      
      <Card className="border-none shadow-sm bg-white rounded-2xl overflow-hidden w-full">
        <CardHeader className="p-5 pb-2 flex flex-row items-center justify-between bg-slate-50/50 border-b border-slate-100">
          <div className="flex items-center justify-between w-full">
            <CardTitle className="text-sm font-black flex items-center gap-2 tracking-tight whitespace-nowrap">
              <div className="w-1.5 h-4 bg-red-500 rounded-full" />
              사고즉보 (실시간 사고사례)
            </CardTitle>
            {canReportAccident && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 text-[10px] font-black uppercase tracking-widest text-primary gap-1"
                onClick={() => navigate('/accidents')}
              >
                <Plus className="w-3 h-3" /> 사고 보고
              </Button>
            )}
            <ShieldAlert className="w-4 h-4 text-red-500 animate-pulse ml-2" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            {recentAccidents.length > 0 ? recentAccidents.map(accident => (
              <div 
                key={accident.id} 
                className="p-5 active:bg-slate-50 transition-colors cursor-pointer"
                onClick={() => setSelectedAccident(accident)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={cn(
                        "text-[8px] font-black border-none px-2 py-0.5 rounded-full uppercase tracking-widest",
                        accident.severity === 'CRITICAL' ? "bg-red-500 text-white" :
                        accident.severity === 'HIGH' ? "bg-orange-500 text-white" :
                        accident.severity === 'MEDIUM' ? "bg-yellow-500 text-white" : "bg-blue-500 text-white"
                      )}>
                        {accident.severity === 'CRITICAL' ? '심각' : accident.severity === 'HIGH' ? '높음' : accident.severity === 'MEDIUM' ? '보통' : '낮음'}
                      </Badge>
                      <h4 className="font-black text-sm text-slate-900 leading-tight tracking-tight">{accident.title}</h4>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-bold">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {accident.date}</span>
                      <span className="flex items-center gap-1"><Info className="w-3 h-3" /> {accident.location}</span>
                    </div>
                  </div>
                  <Plus className="w-4 h-4 text-slate-300 group-hover:text-primary" />
                </div>
              </div>
            )) : (
              <div className="p-10 text-center text-slate-500 text-xs font-black uppercase tracking-widest">사고 기록이 없습니다.</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Accident Detail Dialog */}
      <Dialog open={!!selectedAccident} onOpenChange={(open) => !open && setSelectedAccident(null)}>
        <DialogContent className="bg-white border-none rounded-[2rem] shadow-2xl max-w-lg w-[95%] p-0 overflow-hidden">
          {selectedAccident && (
            <>
              <DialogHeader className="p-8 pb-4 bg-slate-50 border-b border-slate-100">
                <div className="flex items-center gap-2 mb-2">
                   <Badge className={cn(
                    "text-[10px] font-black uppercase tracking-widest px-3 py-1",
                    selectedAccident.severity === 'CRITICAL' ? "bg-red-600" :
                    selectedAccident.severity === 'HIGH' ? "bg-orange-500" :
                    selectedAccident.severity === 'MEDIUM' ? "bg-yellow-500" : "bg-blue-500"
                  )}>
                    {selectedAccident.severity === 'CRITICAL' ? '심각' : selectedAccident.severity === 'HIGH' ? '높음' : selectedAccident.severity === 'MEDIUM' ? '보통' : '낮음'}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest px-3 py-1">
                    {selectedAccident.type}
                  </Badge>
                </div>
                <DialogTitle className="text-2xl font-black tracking-tighter text-slate-900">
                  {selectedAccident.title}
                </DialogTitle>
                <DialogDescription className="text-slate-500 font-bold">
                  {selectedAccident.date} | {selectedAccident.location}
                </DialogDescription>
              </DialogHeader>
              <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto">
                <div className="space-y-3">
                  <h5 className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">사고 내용</h5>
                  <div className="p-5 bg-slate-50 rounded-2xl text-sm font-bold text-slate-700 leading-relaxed whitespace-pre-wrap border border-slate-100">
                    {selectedAccident.description}
                  </div>
                </div>
                
                {selectedAccident.measures && (
                  <div className="space-y-3">
                    <h5 className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em]">조치 사항</h5>
                    <div className="p-5 bg-emerald-50 rounded-2xl text-sm font-bold text-emerald-800 leading-relaxed whitespace-pre-wrap border border-emerald-100">
                      {selectedAccident.measures}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">보고자</p>
                    <p className="font-bold text-slate-900">{selectedAccident.reportedBy}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">보고시간</p>
                    <p className="font-bold text-slate-900">{format(new Date(selectedAccident.createdAt), 'yyyy.MM.dd HH:mm')}</p>
                  </div>
                </div>
              </div>
              <DialogFooter className="p-8 pt-4 bg-slate-50 border-t border-slate-100">
                <Button className="w-full h-12 rounded-xl font-black shadow-lg" onClick={() => setSelectedAccident(null)}>
                  닫기
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
