import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { db, handleFirestoreError, OperationType } from '@/firebase';
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy, 
  doc, 
  updateDoc, 
  addDoc, 
  getDoc,
  where,
  getDocs
} from 'firebase/firestore';
import { LeaveRequest, UserProfile } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, 
  XCircle, 
  CalendarDays, 
  Clock, 
  UserPlus, 
  MinusCircle, 
  PlusCircle,
  Search,
  Download,
  FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

import { GlowLoading } from '@/components/GlowLoading';
import { exportToExcel, exportToPDF } from '@/lib/exportUtils';

export const LeaveManagement: React.FC = () => {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'PENDING' | 'HISTORY' | 'CALENDAR' | 'EMPLOYEES'>('CALENDAR');
  const [loading, setLoading] = useState(true);
  const [selectedDayDetail, setSelectedDayDetail] = useState<{ dayStr: string; leaves: LeaveRequest[] } | null>(null);

  // Calendar States & Helpers
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth()); // 0-indexed

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const getDaysInMonth = (year: number, month: number) => {
    const date = new Date(year, month, 1);
    const days = [];
    const firstDayIndex = date.getDay();
    const prevMonthDate = new Date(year, month, 0);
    const prevMonthDaysCount = prevMonthDate.getDate();

    for (let i = firstDayIndex - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthDaysCount - i),
        isCurrentMonth: false
      });
    }

    const currentMonthDate = new Date(year, month + 1, 0);
    const currentMonthDaysCount = currentMonthDate.getDate();
    for (let i = 1; i <= currentMonthDaysCount; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true
      });
    }

    const totalSlots = Math.ceil(days.length / 7) * 7;
    const nextMonthDaysCount = totalSlots - days.length;
    for (let i = 1; i <= nextMonthDaysCount; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false
      });
    }

    return days;
  };

  // Authority levels: Diff level of permissions explicitly handled
  const isAllViewAuthorized = !!profile && (
    ['CEO', 'DIRECTOR', 'GENERAL_AFFAIRS', 'CLERK', 'GENERAL_MANAGER', 'SAFETY_MANAGER'].includes(profile.role) || 
    profile.permissions?.includes('leave_mgmt') ||
    profile.permissions?.includes('admin') ||
    (profile.position && ['소장', '총무', '서무', '실장', '안전관리자', '대표', '사장'].some(p => profile.position?.includes(p)))
  );

  const isTeamViewAuthorized = !!profile && (
    profile.role === 'TEAM_LEADER' || 
    (profile.position && ['팀장', '직장'].some(p => profile.position?.includes(p))) ||
    profile.permissions?.includes('team_work_log_approve')
  );

  const calendarRequests = requests.filter(req => {
    if (isAllViewAuthorized) return true;
    if (isTeamViewAuthorized) {
      const reqUser = users.find(u => u.uid === req.uid);
      if (!reqUser) return false;
      return reqUser.departmentName === profile?.departmentName || reqUser.departmentId === profile?.departmentId;
    }
    return req.uid === profile?.uid;
  });

  useEffect(() => {
    const minLoadTime = new Promise(resolve => setTimeout(resolve, 800));
    const q = query(collection(db, 'leaveRequests'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveRequest)));
      await minLoadTime;
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'leaveRequests');
      setLoading(false);
    });

    const uQ = query(collection(db, 'users'));
    const unsubscribeUsers = onSnapshot(uQ, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

    return () => {
      unsubscribe();
      unsubscribeUsers();
    };
  }, []);

  const getLeaveDays = (type: string, startDate: string, endDate: string): number => {
    if (type === 'ANNUAL') {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    } else if (type === 'AM_HALF' || type === 'PM_HALF') {
      return 0.5;
    } else if (type === 'OUTING_1H' || type === 'OUTING') {
      return 0.125;
    } else if (type === 'OUTING_2H') {
      return 0.25;
    }
    return 0.5;
  };

  const handleApprove = async (request: LeaveRequest) => {
    try {
      if (!request.id) return;
      const reqRef = doc(db, 'leaveRequests', request.id);
      const reqSnap = await getDoc(reqRef);
      if (!reqSnap.exists()) {
        toast.error('신청 내역을 찾을 수 없습니다.');
        return;
      }
      const reqData = reqSnap.data() as LeaveRequest;
      const originalStatus = reqData.status;

      await updateDoc(reqRef, { 
        status: 'APPROVED',
        updatedAt: new Date().toISOString()
      });

      // Deduction on approval from PENDING (or REJECTED)
      if (originalStatus !== 'APPROVED') {
        const diffDays = getLeaveDays(reqData.type, reqData.startDate, reqData.endDate);
        const userRef = doc(db, 'users', reqData.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data() as UserProfile;
          const currentBalance = userData.annualLeaveBalance || 0;
          await updateDoc(userRef, {
            annualLeaveBalance: Number((currentBalance - diffDays).toFixed(3))
          });
        }
      }
      
      await addDoc(collection(db, 'notifications'), {
        uid: request.uid,
        title: '연차 승인 알림',
        message: `${request.startDate} 연차 신청이 승인되었습니다.`,
        type: 'LEAVE_RESPONSE',
        isRead: false,
        createdAt: new Date().toISOString()
      });

      // Final Report to Clerk, GM, and GA
      const finalsQuery = query(
        collection(db, 'users'),
        where('role', 'in', ['CLERK', 'GENERAL_MANAGER', 'GENERAL_AFFAIRS'])
      );
      const finalsSnapshot = await getDocs(finalsQuery);
      for (const fDoc of finalsSnapshot.docs) {
        if (fDoc.id === profile.uid) continue;
        await addDoc(collection(db, 'notifications'), {
          uid: fDoc.id,
          title: '📋 연차 승인 최종 보고',
          message: `${request.displayName}님의 연차(${request.startDate})가 최종 승인되었습니다.`,
          type: 'SYSTEM',
          isRead: false,
          createdAt: new Date().toISOString(),
          fromUid: profile.uid,
          fromName: profile.displayName
        });
      }

      toast.success('승인 완료');
    } catch (e) {
      console.error(e);
      toast.error('오류 발생');
    }
  };

  const handleReject = async (request: LeaveRequest) => {
    try {
      if (!request.id) return;
      const reqRef = doc(db, 'leaveRequests', request.id);
      const reqSnap = await getDoc(reqRef);
      if (!reqSnap.exists()) {
        toast.error('신청 내역을 찾을 수 없습니다.');
        return;
      }
      const reqData = reqSnap.data() as LeaveRequest;
      const originalStatus = reqData.status;

      await updateDoc(reqRef, { 
        status: 'REJECTED',
        updatedAt: new Date().toISOString()
      });
      
      // Return balance only if it was already in APPROVED state
      if (originalStatus === 'APPROVED') {
        const diffDays = getLeaveDays(reqData.type, reqData.startDate, reqData.endDate);
        const userRef = doc(db, 'users', reqData.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data() as UserProfile;
          const currentBalance = userData.annualLeaveBalance || 0;
          await updateDoc(userRef, {
            annualLeaveBalance: Number((currentBalance + diffDays).toFixed(3))
          });
        }
      }

      await addDoc(collection(db, 'notifications'), {
        uid: request.uid,
        title: '연차 반려 알림',
        message: `${request.startDate} 연차 신청이 반려되었습니다.`,
        type: 'LEAVE_RESPONSE',
        isRead: false,
        createdAt: new Date().toISOString()
      });

      toast.info('반려 처리 완료');
    } catch (e) {
      console.error(e);
      toast.error('오류 발생');
    }
  };

  const adjustBalance = async (userId: string, amount: number) => {
    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const currentBalance = userSnap.data().annualLeaveBalance || 0;
        await updateDoc(userRef, { annualLeaveBalance: currentBalance + amount });
        toast.success(`연차가 ${amount > 0 ? '+' : ''}${amount}일 조정되었습니다.`);
      }
    } catch (e) {
      toast.error('조정 실패');
    }
  };

  const pendingRequests = requests.filter(r => r.status === 'PENDING');
  const historyRequests = requests.filter(r => r.status !== 'PENDING').slice(0, 50);
  const filteredUsers = users.filter(u => 
    (u.displayName || '').includes(searchTerm) || u.employeeId?.includes(searchTerm)
  ).sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));

  const handleExportExcel = () => {
    if (requests.length === 0) {
      toast.error('내보낼 데이터가 없습니다.');
      return;
    }
    const data = requests.map(req => ({
      '신청일': format(new Date(req.createdAt), 'yyyy-MM-dd'),
      '사원명': req.displayName,
      '사번': req.employeeId,
      '구분': req.type === 'ANNUAL' ? '연차' : '반차',
      '기간': `${req.startDate} ~ ${req.endDate}`,
      '사유': req.reason,
      '상태': req.status === 'APPROVED' ? '승인' : req.status === 'REJECTED' ? '반려' : '대기'
    }));
    exportToExcel(data, `연차신청내역_${format(new Date(), 'yyyyMMdd')}`, '연차휴가기록');
  };

  const handleExportPDF = async () => {
    if (requests.length === 0) {
      toast.error('내보낼 데이터가 없습니다.');
      return;
    }
    const headers = ['사원명', '구분', '시작일', '종료일', '상태'];
    const data = requests.map(req => [
      req.displayName,
      req.type === 'ANNUAL' ? '연차' : '반차',
      req.startDate,
      req.endDate,
      req.status === 'APPROVED' ? '승인' : req.status === 'REJECTED' ? '반려' : '대기'
    ]);
    await exportToPDF('연차/휴가 신청 통합 보고서', headers, data, `연차보고서_${format(new Date(), 'yyyyMMdd')}`);
  };

  return (
    <div className="space-y-6 pb-24 px-1">
      <header className="py-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-foreground leading-tight">연차/휴가 통합 관리</h2>
          <p className="text-xs font-bold text-muted-foreground">사원들의 휴가 신청을 검토하고 연차를 관리하세요</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleExportExcel}
            className="h-10 rounded-xl bg-muted border-border text-foreground font-black text-[10px] gap-2 hover:bg-muted/80"
          >
            <Download className="w-3.5 h-3.5 text-emerald-500" /> EXCEL
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleExportPDF}
            className="h-10 rounded-xl bg-muted border-border text-foreground font-black text-[10px] gap-2 hover:bg-muted/80"
          >
            <FileText className="w-3.5 h-3.5 text-rose-500" /> PDF
          </Button>
        </div>
      </header>

      <div className="flex p-1 bg-muted/50 rounded-2xl gap-1">
        {(['PENDING', 'HISTORY', 'CALENDAR', 'EMPLOYEES'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 h-12 rounded-xl text-xs font-black transition-all",
              activeTab === tab ? "bg-card text-foreground shadow-lg" : "text-muted-foreground/60 hover:text-muted-foreground/90"
            )}
          >
            {tab === 'PENDING' ? `승인대기 (${pendingRequests.length})` : tab === 'HISTORY' ? '처리내역' : tab === 'CALENDAR' ? '캘린더' : '연차조정'}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {activeTab === 'CALENDAR' && (
          <Card className="border border-border rounded-3xl bg-card shadow-none p-6 space-y-6">
            <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="font-black text-base text-foreground flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-primary" />
                  {isAllViewAuthorized ? "전 사원 연차/외출 현황 캘린더" : `${profile?.departmentName || '소속'} 팀원 연차/외출 현황`}
                </h3>
                <p className="text-[10px] font-bold text-muted-foreground">
                  {isAllViewAuthorized 
                    ? "대표/소장/총무/서무/실장/안전관리자 권한으로 전사원의 현황을 조회 중입니다." 
                    : "소속 팀장/직장 권한으로 부서원들의 신청 현황만 조회 중입니다."}
                </p>
              </div>

              <div className="flex items-center gap-1.5 bg-muted p-1 rounded-xl self-end xs:self-auto">
                <button 
                  onClick={handlePrevMonth}
                  className="w-8 h-8 rounded-lg text-foreground bg-card shadow-sm hover:bg-card/80 flex items-center justify-center font-bold active:scale-95 transition-all text-xs"
                >
                  &lt;
                </button>
                <span className="font-black text-xs px-2 text-foreground min-w-[70px] text-center">
                  {currentYear}년 {currentMonth + 1}월
                </span>
                <button 
                  onClick={handleNextMonth}
                  className="w-8 h-8 rounded-lg text-foreground bg-card shadow-sm hover:bg-card/80 flex items-center justify-center font-bold active:scale-95 transition-all text-xs"
                >
                  &gt;
                </button>
              </div>
            </div>

            {/* Calendar Grid headers */}
            <div className="grid grid-cols-7 gap-1 text-center border-b border-border pb-2">
              {['일', '월', '화', '수', '목', '금', '토'].map((day, idx) => (
                <span key={day} className={cn(
                  "text-[10px] font-black uppercase tracking-wider",
                  idx === 0 ? "text-red-500" : idx === 6 ? "text-indigo-400" : "text-muted-foreground"
                )}>
                  {day}
                </span>
              ))}
            </div>

            {/* Days in Month Grid */}
            <div className="grid grid-cols-7 gap-1.5 min-h-[300px]">
              {getDaysInMonth(currentYear, currentMonth).map((day, i) => {
                const formattedStr = format(day.date, 'yyyy-MM-dd');
                const isToday = format(new Date(), 'yyyy-MM-dd') === formattedStr;
                
                // Get approved requests for this date
                const dayApprovedLeaves = calendarRequests.filter(req => {
                  return req.status === 'APPROVED' && formattedStr >= req.startDate && formattedStr <= req.endDate;
                });

                // Get pending requests for this date
                const dayPendingLeaves = calendarRequests.filter(req => {
                  return req.status === 'PENDING' && formattedStr >= req.startDate && formattedStr <= req.endDate;
                });

                const allDayRequests = [...dayApprovedLeaves, ...dayPendingLeaves];

                return (
                  <div 
                    key={i} 
                    onClick={() => {
                      setSelectedDayDetail({ dayStr: formattedStr, leaves: allDayRequests });
                    }}
                    className={cn(
                      "min-h-[85px] bg-muted/20 border border-border/40 rounded-xl p-1 flex flex-col space-y-1 transition-all cursor-pointer hover:bg-muted/40 hover:border-muted-foreground/30 active:scale-[0.98] select-none",
                      !day.isCurrentMonth && "opacity-30",
                      isToday && "bg-primary/5 border-primary/30 shadow-sm"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className={cn(
                        "text-[10px] font-black",
                        day.date.getDay() === 0 ? "text-red-500" : day.date.getDay() === 6 ? "text-indigo-400" : "text-foreground",
                        isToday && "bg-primary text-primary-foreground w-4 h-4 rounded-full flex items-center justify-center my-0.5 text-[8px]"
                      )}>
                        {day.date.getDate()}
                      </span>
                    </div>

                    <div className="flex-1 space-y-0.5 overflow-y-auto max-h-[60px] scrollbar-none">
                      {dayApprovedLeaves.map(leave => (
                        <div key={leave.id} className={cn(
                          "text-[9px] font-black px-1 py-0.5 rounded flex items-center justify-between",
                          leave.type === 'ANNUAL' ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/10" :
                          ['OUTING', 'OUTING_1H', 'OUTING_2H'].includes(leave.type) ? "bg-amber-500/10 text-amber-500 border border-amber-500/10" :
                          "bg-teal-500/10 text-teal-400 border border-teal-500/10"
                        )}>
                          <span className="truncate max-w-[34px]">{leave.displayName}</span>
                          <span className="opacity-75 font-bold scale-[0.8] origin-right shrink-0 font-mono">
                            {leave.type === 'ANNUAL' ? '연' : 
                             leave.type === 'OUTING_1H' ? '외1' : 
                             leave.type === 'OUTING_2H' ? '외2' : '외'}
                          </span>
                        </div>
                      ))}

                      {dayPendingLeaves.map(leave => (
                        <div key={leave.id} className={cn(
                          "text-[9px] font-black px-1 py-0.5 rounded flex items-center justify-between border border-dashed",
                          leave.type === 'ANNUAL' ? "bg-indigo-500/5 text-indigo-400/70 border-indigo-500/30" :
                          ['OUTING', 'OUTING_1H', 'OUTING_2H'].includes(leave.type) ? "bg-amber-500/5 text-amber-500/70 border-amber-500/30" :
                          "bg-teal-500/5 text-teal-400/70 border-teal-500/30"
                        )}>
                          <span className="truncate max-w-[34px]">{leave.displayName}</span>
                          <span className="opacity-75 font-bold scale-[0.8] origin-right shrink-0">대기</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend guide info */}
            <div className="flex flex-wrap gap-3 pt-2 text-[10px] font-black justify-end text-muted-foreground uppercase tracking-widest border-t border-border/50">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500/10 border border-indigo-500/20" /> 연차</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-teal-500/10 border border-teal-500/20" /> 오전/오후반차</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500/10 border border-amber-500/20" /> 외출</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full border border-dashed border-gray-450" /> 승인 대기중</span>
            </div>
          </Card>
        )}

        {activeTab === 'PENDING' && (
          pendingRequests.length > 0 ? (
            pendingRequests.map(req => (
              <Card key={req.id} className="bg-card border-border rounded-2xl overflow-hidden border shadow-none">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center font-black">
                         {req.displayName?.charAt(0) || '사'}
                       </div>
                       <div>
                         <p className="text-sm font-black text-foreground">{req.displayName}</p>
                         <p className="text-[10px] text-muted-foreground font-bold">{req.employeeId || 'ID 미지정'}</p>
                       </div>
                    </div>
                    <Badge className="bg-muted text-muted-foreground border-none px-2 py-0.5 rounded-lg text-[10px] font-black shadow-none">
                      {req.type === 'ANNUAL' ? '연차' : '반차'}
                    </Badge>
                  </div>

                  <div className="bg-muted/50 p-4 rounded-xl space-y-2 border border-border/50">
                    <div className="flex items-center gap-2 text-primary">
                      <CalendarDays className="w-4 h-4" />
                      <span className="text-sm font-black tracking-tight">
                        {req.startDate}{req.startDate !== req.endDate ? ` ~ ${req.endDate}` : ''}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-bold leading-relaxed">{req.reason}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <Button 
                      variant="ghost" 
                      className="bg-muted hover:bg-destructive/10 text-destructive font-black h-12 rounded-xl border border-border shadow-none"
                      onClick={() => handleReject(req)}
                    >
                      <XCircle className="w-4 h-4 mr-2" /> 반려
                    </Button>
                    <Button 
                      className="bg-primary text-primary-foreground hover:bg-primary/90 font-black h-12 rounded-xl shadow-lg shadow-primary/20"
                      onClick={() => handleApprove(req)}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" /> 승인
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="py-20 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-primary/20 mx-auto" />
              <p className="text-sm font-bold text-muted-foreground">대기 중인 신청이 없습니다.</p>
            </div>
          )
        )}

        {activeTab === 'HISTORY' && (
          <div className="space-y-3">
            {historyRequests.map(req => (
              <div key={req.id} className="bg-card p-5 rounded-2xl border border-border flex items-center justify-between group shadow-none">
                <div className="flex items-center gap-4 overflow-hidden">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                    req.status === 'APPROVED' ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
                  )}>
                    {req.status === 'APPROVED' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                  </div>
                  <div className="overflow-hidden">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-foreground truncate">{req.displayName}</span>
                      <span className="text-[10px] text-muted-foreground font-bold">{req.startDate}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-bold truncate opacity-60">
                      {req.reason}
                    </p>
                  </div>
                </div>
                <Badge className={cn(
                  "border-none rounded-lg px-2 h-5 text-[9px] font-black shrink-0",
                  req.status === 'APPROVED' ? "bg-emerald-500/20 text-emerald-500" : "bg-red-500/20 text-red-500"
                )}>
                  {req.status === 'APPROVED' ? '승인' : '반려'}
                </Badge>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'EMPLOYEES' && (
          <div className="space-y-4">
             <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/30" />
                <Input 
                  placeholder="사원 검색..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="bg-muted border-border h-14 pl-12 rounded-2xl text-foreground font-bold border" 
                />
             </div>

             <div className="space-y-3">
                {filteredUsers.map(user => (
                  <Card key={user.uid} className="bg-card border-border rounded-2xl overflow-hidden border shadow-none">
                    <CardContent className="p-5 flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-muted text-muted-foreground rounded-xl flex items-center justify-center font-black">
                            {user.displayName.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-black text-foreground">{user.displayName}</p>
                            <p className="text-[10px] text-muted-foreground font-bold">{user.employeeId || 'ID 없음'}</p>
                          </div>
                       </div>
                       
                       <div className="flex items-center gap-4">
                          <div className="text-right">
                             <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">잔여 연차</p>
                             <p className="text-lg font-black text-foreground">{user.annualLeaveBalance || 0}일</p>
                          </div>
                          <div className="flex gap-1">
                             <button 
                                onClick={() => adjustBalance(user.uid, -1)}
                                className="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center active:scale-90 transition-all"
                             >
                               <MinusCircle className="w-4 h-4" />
                             </button>
                             <button 
                                onClick={() => adjustBalance(user.uid, 1)}
                                className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center active:scale-90 transition-all"
                             >
                               <PlusCircle className="w-4 h-4" />
                             </button>
                          </div>
                       </div>
                    </CardContent>
                  </Card>
                ))}
             </div>
          </div>
        )}
      </div>

      {/* Calendar Day Detail Modal */}
      {selectedDayDetail && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setSelectedDayDetail(null)}>
          <div className="bg-card border border-border rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-border flex items-center justify-between bg-muted/30">
              <div>
                <h3 className="text-base font-black text-foreground">
                  {format(new Date(selectedDayDetail.dayStr), 'yyyy년 MM월 dd일')} 현황
                </h3>
                <p className="text-[10px] font-bold text-muted-foreground mt-0.5">이 날짜의 연차 및 외출/반차 신청 총 {selectedDayDetail.leaves.length}건</p>
              </div>
              <button
                onClick={() => setSelectedDayDetail(null)}
                className="w-8 h-8 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-all text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 max-h-[350px] overflow-y-auto space-y-4">
              {selectedDayDetail.leaves.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-xs font-bold">
                   이 날짜에 신청된 결재 내역이 없습니다.
                </div>
              ) : (
                selectedDayDetail.leaves.map((leave) => {
                  const getKoreanType = (t: string) => {
                    if (t === 'ANNUAL') return '연차';
                    if (t === 'AM_HALF') return '오전반차';
                    if (t === 'PM_HALF') return '오후반차';
                    if (t === 'OUTING') return '외출(기본)';
                    if (t === 'OUTING_1H') return '외출 1시간';
                    if (t === 'OUTING_2H') return '외출 2시간';
                    return '반차/휴가';
                  };
                  return (
                    <div key={leave.id} className="border border-border/60 rounded-2xl p-4 space-y-3 bg-muted/10">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-primary/10 overflow-hidden flex items-center justify-center font-black text-xs text-primary">
                            {leave.displayName?.charAt(0) || '사'}
                          </div>
                          <div>
                            <p className="text-xs font-black text-foreground">{leave.displayName || '미상'}</p>
                            <p className="text-[9px] text-muted-foreground font-bold">신청일: {format(new Date(leave.createdAt), 'MM/dd HH:mm')}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className={cn(
                            "text-[9px] font-black px-1.5 py-0.5 rounded",
                            leave.type === 'ANNUAL' ? "bg-indigo-500/10 text-indigo-500 border border-indigo-500/10" :
                            ['OUTING', 'OUTING_1H', 'OUTING_2H'].includes(leave.type) ? "bg-amber-500/10 text-amber-500 border border-amber-500/10" :
                            "bg-teal-500/10 text-teal-500 border border-teal-500/10"
                          )}>
                            {getKoreanType(leave.type)}
                          </span>

                          <span className={cn(
                            "text-[9px] font-black px-1.5 py-0.5 rounded border",
                            leave.status === 'APPROVED' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                            leave.status === 'PENDING' ? "bg-orange-500/10 text-orange-500 border-orange-500/20" :
                            "bg-red-500/10 text-red-500 border-red-500/20"
                          )}>
                            {leave.status === 'APPROVED' ? '승인' : leave.status === 'PENDING' ? '대기' : '반려'}
                          </span>
                        </div>
                      </div>

                      <div className="px-3 py-2 bg-muted/50 rounded-xl space-y-0.5">
                        <p className="text-[9px] font-black text-muted-foreground">신청 기간</p>
                        <p className="text-xs font-bold text-foreground">{leave.startDate} ~ {leave.endDate}</p>
                      </div>

                      <div className="px-3 py-2 bg-muted/30 rounded-xl space-y-0.5">
                        <p className="text-[9px] font-black text-muted-foreground">신청 사유</p>
                        <p className="text-xs font-bold text-foreground leading-relaxed">"{leave.reason}"</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 border-t border-border flex justify-end bg-muted/20">
              <Button onClick={() => setSelectedDayDetail(null)} className="h-10 px-6 rounded-xl font-black bg-primary text-white text-xs">
                닫기
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
