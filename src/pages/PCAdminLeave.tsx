import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, doc, updateDoc, where, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { LeaveRequest } from '../types';
import PCAdminLayout from '../components/PCAdminLayout';
import { useAuth } from '../components/AuthProvider';
import { format } from 'date-fns';
import { 
  Calendar, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Search, 
  Filter,
  FileText,
  User,
  ExternalLink,
  CalendarDays
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

const PCAdminLeave: React.FC = () => {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'all'>('PENDING');
  const [activeViewMode, setActiveViewMode] = useState<'LIST' | 'CALENDAR'>('CALENDAR');
  const [selectedDayDetail, setSelectedDayDetail] = useState<{ dayStr: string; leaves: LeaveRequest[] } | null>(null);

  // Calendar States & Helpers
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());

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
    fetchRequests();
    const fetchUsers = async () => {
      try {
        const snap = await getDocs(collection(db, 'users'));
        setUsers(snap.docs.map(doc => ({ uid: doc.id, ...doc.data() })));
      } catch (err) {
        console.error(err);
      }
    };
    fetchUsers();
  }, [filter]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      let q;
      if (filter === 'all') {
        q = query(collection(db, 'leaveRequests'), orderBy('createdAt', 'desc'));
      } else {
        q = query(
          collection(db, 'leaveRequests'), 
          where('status', '==', filter),
          orderBy('createdAt', 'desc')
        );
      }
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any } as LeaveRequest));
      setRequests(data);
    } catch (error) {
      console.error('Error fetching leave requests:', error);
      toast.error('결재 대기 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

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

  const handleStatusChange = async (requestId: string, newStatus: 'APPROVED' | 'REJECTED') => {
    try {
      const reqRef = doc(db, 'leaveRequests', requestId);
      const reqSnap = await getDoc(reqRef);
      if (!reqSnap.exists()) {
        toast.error('신청 내역을 찾을 수 없습니다.');
        return;
      }
      const reqData = reqSnap.data() as LeaveRequest;
      const originalStatus = reqData.status;

      // Update progress/status
      await updateDoc(reqRef, {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });

      // Deduction on approval from PENDING (or REJECTED)
      if (newStatus === 'APPROVED' && originalStatus !== 'APPROVED') {
        const diffDays = getLeaveDays(reqData.type, reqData.startDate, reqData.endDate);
        const userRef = doc(db, 'users', reqData.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          const currentBalance = userData.annualLeaveBalance || 0;
          await updateDoc(userRef, {
            annualLeaveBalance: Number((currentBalance - diffDays).toFixed(3))
          });
        }
      } 
      // Recovery when transition from APPROVED to REJECTED (if allowed/triggered)
      else if (newStatus === 'REJECTED' && originalStatus === 'APPROVED') {
        const diffDays = getLeaveDays(reqData.type, reqData.startDate, reqData.endDate);
        const userRef = doc(db, 'users', reqData.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          const currentBalance = userData.annualLeaveBalance || 0;
          await updateDoc(userRef, {
            annualLeaveBalance: Number((currentBalance + diffDays).toFixed(3))
          });
        }
      }

      toast.success(newStatus === 'APPROVED' ? '승인되었습니다.' : '반려되었습니다.');
      fetchRequests();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('처리 중 오류가 발생했습니다.');
    }
  };

  return (
    <PCAdminLayout title="연차/휴가 결재 관리">
      <div className="max-w-[1600px] mx-auto space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Status Filter Tabs */}
          <div className="flex bg-card p-1.5 rounded-[4rem] border border-border shadow-sm w-fit">
            {[
              { id: 'PENDING', label: '승인 대기', count: requests.length, color: 'text-orange-500', bg: 'bg-orange-500/10' },
              { id: 'APPROVED', label: '최종 승인', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
              { id: 'REJECTED', label: '반려 내역', color: 'text-rose-500', bg: 'bg-rose-500/10' },
              { id: 'all', label: '전체 목록', color: 'text-foreground', bg: 'bg-muted' },
            ].map((tab) => (
              <button
                key={tab.id}
                disabled={activeViewMode === 'CALENDAR'}
                onClick={() => setFilter(tab.id as any)}
                className={`px-8 py-3 rounded-[4rem] text-sm font-black transition-all flex items-center gap-2 ${
                  activeViewMode === 'CALENDAR'
                  ? 'opacity-40 cursor-not-allowed text-muted-foreground'
                  : filter === tab.id 
                  ? `${tab.bg} ${tab.color} shadow-sm border border-border` 
                  : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
                {tab.id === 'PENDING' && <span className="w-5 h-5 bg-orange-600 text-white rounded-full text-[10px] flex items-center justify-center">{tab.count}</span>}
              </button>
            ))}
          </div>

          {/* View Mode Toggle */}
          <div className="flex bg-card p-1.5 rounded-[4rem] border border-border shadow-sm w-fit">
            {[
              { id: 'CALENDAR', label: '월간 달력 현황 캘린더', icon: CalendarDays },
              { id: 'LIST', label: '결재 대기 목록 리스트', icon: FileText }
            ].map((mode) => (
              <button
                key={mode.id}
                onClick={() => setActiveViewMode(mode.id as any)}
                className={`px-8 py-3 rounded-[4rem] text-sm font-black transition-all flex items-center gap-2 ${
                  activeViewMode === mode.id 
                  ? 'bg-blue-500/10 text-blue-500 shadow-sm border border-border' 
                  : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <mode.icon className="w-4 h-4" />
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        {/* Requests List or Calendar */}
        {activeViewMode === 'CALENDAR' ? (
           <div className="bg-card text-foreground rounded-[3rem] border border-border shadow-sm p-10 space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
                <div>
                  <h3 className="text-2xl font-black text-foreground flex items-center gap-3">
                     <CalendarDays className="w-7 h-7 text-blue-500" />
                     {isAllViewAuthorized ? "전 사원 통합 연차/외출 현황 캘린더" : `${profile?.departmentName || '소속'} 팀원 연차/외출 현황`}
                  </h3>
                  <p className="text-sm font-bold text-muted-foreground mt-1">
                     {isAllViewAuthorized 
                       ? "대표이사/보건/총무/서무/실장/소장 등 전사 권한 조회 레벨입니다." 
                       : "부서 팀장/직장 권한으로 소속 팀원들의 현황만 조회 중입니다."}
                  </p>
                </div>

                <div className="flex items-center gap-3 bg-muted p-1.5 rounded-2xl self-end sm:self-auto">
                   <button 
                     onClick={handlePrevMonth}
                     className="w-10 h-10 rounded-xl text-foreground bg-card shadow-sm hover:bg-muted/80 flex items-center justify-center font-bold active:scale-95 transition-all outline-none border border-border"
                   >
                     &lt;
                   </button>
                   <span className="font-black text-lg px-4 text-foreground min-w-[120px] text-center">
                     {currentYear}년 {currentMonth + 1}월
                   </span>
                   <button 
                     onClick={handleNextMonth}
                     className="w-10 h-10 rounded-xl text-foreground bg-card shadow-sm hover:bg-muted/80 flex items-center justify-center font-bold active:scale-95 transition-all outline-none border border-border"
                   >
                     &gt;
                   </button>
                </div>
              </div>

              {/* Grid Header */}
              <div className="grid grid-cols-7 gap-2 text-center border-b border-border pb-3">
                 {['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'].map((day, idx) => (
                   <span key={day} className={`text-xs font-black tracking-wider uppercase ${
                     idx === 0 ? 'text-red-500' : idx === 6 ? 'text-blue-500' : 'text-muted-foreground'
                   }`}>
                      {day}
                   </span>
                 ))}
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 gap-3 min-h-[450px]">
                 {getDaysInMonth(currentYear, currentMonth).map((day, i) => {
                   const formattedStr = format(day.date, 'yyyy-MM-dd');
                   const isToday = format(new Date(), 'yyyy-MM-dd') === formattedStr;

                   const dayApprovedLeaves = calendarRequests.filter(req => {
                     return req.status === 'APPROVED' && formattedStr >= req.startDate && formattedStr <= req.endDate;
                   });

                   const dayPendingLeaves = calendarRequests.filter(req => {
                     return req.status === 'PENDING' && formattedStr >= req.startDate && formattedStr <= req.endDate;
                   });

                   return (
                     <div 
                       key={i} onClick={() => setSelectedDayDetail({ dayStr: formattedStr, leaves: [...dayApprovedLeaves, ...dayPendingLeaves] })} className={`min-h-[140px] bg-slate-900 border border-border rounded-3xl p-3 flex flex-col space-y-2 transition-all hover:bg-muted/55 cursor-pointer active:scale-[0.98] select-none ${
                         !day.isCurrentMonth ? 'opacity-30' : ''
                       } ${
                         isToday ? 'bg-indigo-950/80 border-indigo-550/60 ring-1 ring-indigo-500/50' : ''
                       }`}
                     >
                        <div className="flex items-center justify-between">
                           <span className={`text-[13px] font-black ${
                             day.date.getDay() === 0 ? 'text-red-500' : day.date.getDay() === 6 ? 'text-blue-500' : 'text-foreground'
                           } ${
                             isToday ? 'bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs' : ''
                           }`}>
                             {day.date.getDate()}
                           </span>
                        </div>

                        <div className="flex-1 space-y-1.5 overflow-y-auto max-h-[100px] scrollbar-none">
                           {dayApprovedLeaves.map(leave => (
                             <div key={leave.id} className={`text-[11px] font-black px-2.5 py-1 rounded-xl flex items-center justify-between ${
                               leave.type === 'ANNUAL' ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/25' :
                               ['OUTING', 'OUTING_1H', 'OUTING_2H'].includes(leave.type) ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25' :
                               'bg-teal-500/15 text-teal-400 border border-teal-500/25'
                             }`}>
                               <span className="truncate max-w-[80px]">{leave.displayName}</span>
                               <span className="opacity-70 text-[9px] font-bold">
                                 {leave.type === 'ANNUAL' ? '연차' : leave.type === 'OUTING' ? '외출' : leave.type === 'OUTING_1H' ? '외출 1H' : leave.type === 'OUTING_2H' ? '외출 2H' : '반차'}
                               </span>
                             </div>
                           ))}

                           {dayPendingLeaves.map(leave => (
                             <div key={leave.id} className={`text-[11px] font-black px-2.5 py-1 rounded-xl flex items-center justify-between border border-dashed border-border/60 ${
                               leave.type === 'ANNUAL' ? 'bg-indigo-500/5 text-indigo-400/80 border-indigo-500/25' :
                               ['OUTING', 'OUTING_1H', 'OUTING_2H'].includes(leave.type) ? 'bg-amber-500/5 text-amber-400/80 border-amber-500/25' :
                               'bg-teal-500/5 text-teal-400/80 border-teal-500/25'
                             }`}>
                               <span className="truncate max-w-[80px]">{leave.displayName}</span>
                               <span className="opacity-70 text-[9px] font-bold">대기</span>
                             </div>
                           ))}
                        </div>
                     </div>
                   );
                 })}
              </div>

              {/* Legend guide info */}
              <div className="flex items-center gap-4 text-xs font-black justify-end text-muted-foreground uppercase tracking-widest pt-4 border-t border-border">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-indigo-500/10 border border-indigo-500/20" /> 연차사용</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-teal-500/10 border border-teal-500/20" /> 오전/오후 반차</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-500/10 border border-amber-500/20" /> 외출</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full border border-dashed border-muted-foreground" /> 결재 대기 건</span>
              </div>
           </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <AnimatePresence mode="popLayout">
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <div key={i} className="h-64 bg-card rounded-[2.5rem] animate-pulse border border-border" />
                ))
              ) : requests.length === 0 ? (
                <div className="col-span-full py-32 bg-card rounded-[3rem] border border-border text-center flex flex-col items-center justify-center">
                   <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-4">
                      <FileText className="w-10 h-10 text-muted-foreground/30" />
                   </div>
                   <p className="text-xl font-bold text-muted-foreground">조회된 결재 신청 건이 없습니다.</p>
                </div>
              ) : (
                requests.map((req) => (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    key={req.id} 
                    className="bg-card rounded-[2.5rem] border border-border shadow-sm hover:shadow-xl transition-all overflow-hidden flex flex-col text-foreground"
                  >
                    <div className="p-8 flex justify-between items-start">
                      <div className="flex gap-5">
                        <div className="w-16 h-16 bg-muted rounded-2xl overflow-hidden border border-border">
                          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${req.uid}`} alt="profile" />
                        </div>
                        <div>
                          <h4 className="text-xl font-black text-foreground tracking-tight flex items-center gap-2">
                             {req.displayName || '사용자'} 
                             <span className="text-xs font-bold text-muted-foreground px-2 py-0.5 bg-muted rounded-lg">{req.type === 'ANNUAL' ? '연차' : req.type === 'OUTING' ? '외출' : (req.type === 'AM_HALF' || req.type === 'PM_HALF') ? '반차' : '병가/기타'}</span>
                          </h4>
                          <div className="mt-2 space-y-1">
                             <p className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-blue-500" />
                                {req.startDate} ~ {req.endDate}
                             </p>
                             <p className="text-xs font-bold text-muted-foreground/80">신청일: {new Date(req.createdAt).toLocaleDateString()} {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                        </div>
                      </div>
                      <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                        req.status === 'PENDING' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                        req.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}>
                        {req.status === 'PENDING' ? '결재 대기' : req.status === 'APPROVED' ? '최종 승인' : '반려됨'}
                      </div>
                    </div>

                    <div className="px-8 py-6 bg-muted/30 border-t border-border flex-1">
                      <p className="text-sm font-bold text-foreground/90 leading-relaxed italic border-l-4 border-blue-500/40 pl-4">
                        "{req.reason}"
                      </p>
                    </div>

                    {req.status === 'PENDING' && (
                      <div className="p-8 flex gap-4 bg-card border-t border-border">
                        <button 
                          onClick={() => handleStatusChange(req.id!, 'REJECTED')}
                          className="flex-1 py-4 bg-muted border border-rose-500/20 text-rose-400 rounded-2xl font-black text-sm hover:bg-rose-500/15 transition-all flex items-center justify-center gap-2"
                        >
                           <XCircle className="w-5 h-5" />
                           반려 처리
                        </button>
                        <button 
                          onClick={() => handleStatusChange(req.id!, 'APPROVED')}
                          className="flex-3 py-4 bg-blue-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                        >
                           <CheckCircle className="w-5 h-5" />
                           최종 승인하기
                        </button>
                      </div>
                    )}
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Calendar Day Detail Modal */}
      {selectedDayDetail && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setSelectedDayDetail(null)}>
          <div className="bg-card border border-border rounded-[2.5rem] w-full max-w-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh] text-foreground" onClick={(e) => e.stopPropagation()}>
            <div className="px-8 py-6 border-b border-border flex items-center justify-between bg-muted/20">
              <div>
                <h3 className="text-xl font-black text-foreground flex items-center gap-2">
                  <span className="w-1.5 h-6 bg-blue-600 rounded-full" />
                  {format(new Date(selectedDayDetail.dayStr), 'yyyy년 MM월 dd일')} 현황
                </h3>
                <p className="text-xs font-bold text-muted-foreground mt-1">이 날짜의 연차 및 외출/반차 신청 총 {selectedDayDetail.leaves.length}건</p>
              </div>
              <button
                onClick={() => setSelectedDayDetail(null)}
                className="w-10 h-10 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-all text-lg font-black"
              >
                ✕
              </button>
            </div>

            <div className="p-8 overflow-y-auto space-y-4 flex-1">
              {selectedDayDetail.leaves.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground text-base font-bold flex flex-col items-center justify-center">
                   <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3 text-muted-foreground/40">
                     📎
                   </div>
                   이 날짜에 등록된 연차/외출/반차 내역이 없습니다.
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
                    <div key={leave.id} className="border border-border rounded-3xl p-5 space-y-4 bg-muted/10 hover:bg-muted/20 transition-all">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-blue-500/10 overflow-hidden flex items-center justify-center font-black text-sm text-blue-400 border border-blue-500/20">
                            {leave.displayName?.charAt(0) || '사'}
                          </div>
                          <div>
                            <p className="text-sm font-black text-foreground">{leave.displayName || '사원'}</p>
                            <p className="text-[11px] text-muted-foreground font-bold">신청일: {format(new Date(leave.createdAt), 'MM/dd HH:mm')}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`text-[11px] font-black px-3 py-1 rounded-xl ${
                            leave.type === 'ANNUAL' ? "bg-indigo-500/15 text-indigo-400 border border-indigo-500/25" :
                            ['OUTING', 'OUTING_1H', 'OUTING_2H'].includes(leave.type) ? "bg-amber-500/15 text-amber-400 border border-amber-500/25" :
                            "bg-teal-500/15 text-teal-400 border border-teal-500/25"
                          }`}>
                            {getKoreanType(leave.type)}
                          </span>

                          <span className={`text-[11px] font-black px-3 py-1 rounded-xl border ${
                            leave.status === 'APPROVED' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                            leave.status === 'PENDING' ? "bg-orange-500/10 text-orange-400 border-orange-500/20" :
                            "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          }`}>
                            {leave.status === 'APPROVED' ? '승인' : leave.status === 'PENDING' ? '결재대기' : '반려'}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="px-4 py-3 bg-card border border-border rounded-2xl space-y-1">
                          <p className="text-[10px] font-black text-muted-foreground">신청 기간</p>
                          <p className="text-xs font-black text-foreground">{leave.startDate} ~ {leave.endDate}</p>
                        </div>

                        <div className="px-4 py-3 bg-card border border-border rounded-2xl space-y-1">
                          <p className="text-[10px] font-black text-muted-foreground font-sans">사유</p>
                          <p className="text-xs font-black text-foreground truncate" title={leave.reason}>{leave.reason}</p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="px-8 py-5 border-t border-border flex justify-end bg-muted/25">
              <button onClick={() => setSelectedDayDetail(null)} className="h-12 px-8 rounded-2xl font-black bg-blue-600 shadow-md shadow-blue-500/10 hover:bg-blue-700 text-white text-xs transition-all active:scale-95 outline-none">
                승인/현황창 닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </PCAdminLayout>
  );
};

export default PCAdminLeave;
