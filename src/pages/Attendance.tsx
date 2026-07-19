import React, { useState, useEffect, useMemo } from 'react';
import { db } from '@/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  doc 
} from 'firebase/firestore';
import { Attendance as AttendanceType } from '@/types';
import { useAuth } from '@/components/AuthProvider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { grantRandomShipPart } from '@/services/shipService';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  isSameDay, 
  parseISO,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { 
  Clock, 
  LogIn,
  LogOut,
  Calendar as CalendarIcon,
  Activity,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DayPicker, DayProps } from 'react-day-picker';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { calculateAttendanceHours } from '@/lib/attendance';
import { checkIsSpecialDay } from '@/lib/holidays';
import { handleFirestoreError, OperationType } from '../lib/errorHandlers';

export const Attendance: React.FC = () => {
  const { profile } = useAuth();
  const [month, setMonth] = useState<Date>(new Date());
  const [attendanceData, setAttendanceData] = useState<AttendanceType[]>([]);
  const [specialDates, setSpecialDates] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const [now, setNow] = useState(new Date());
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyMonth, setHistoryMonth] = useState<Date>(new Date());
  const [historyData, setHistoryData] = useState<AttendanceType[]>([]);

  useEffect(() => {
    if (!profile || !isHistoryOpen) return;
    const start = startOfMonth(historyMonth);
    const end = endOfMonth(historyMonth);
    const q = query(
      collection(db, 'attendance'),
      where('uid', '==', profile.uid),
      where('date', '>=', format(start, 'yyyy-MM-dd')),
      where('date', '<=', format(end, 'yyyy-MM-dd'))
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setHistoryData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceType)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'attendance_history'));
    return () => unsubscribe();
  }, [profile, historyMonth, isHistoryOpen]);

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
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  
  const todayAttendance = useMemo(() => 
    attendanceData.find(a => a.date === todayStr) || null
  , [attendanceData, todayStr]);

  useEffect(() => {
    if (!profile) return;
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    const q = query(
      collection(db, 'attendance'),
      where('uid', '==', profile.uid),
      where('date', '>=', format(start, 'yyyy-MM-dd')),
      where('date', '<=', format(end, 'yyyy-MM-dd'))
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceType));
      setAttendanceData(docs);
      setLoading(false);

      // Auto clock-out for previous days
      docs.forEach(async (att) => {
        if (att.clockIn && !att.clockOut && att.date < todayStr) {
          const clockInDate = new Date(att.clockIn);
          const autoOut = new Date(clockInDate);
          autoOut.setHours(17, 0, 0, 0);
          
          const isSpecialVal = checkIsSpecialDay(clockInDate, specialDates).isSpecial;
          const { workHours, overtimeHours } = calculateAttendanceHours(att.clockIn, autoOut, isSpecialVal);
          
          try {
            await updateDoc(doc(db, 'attendance', att.id), {
              clockOut: autoOut.toISOString(),
              workHours,
              overtimeHours
            });
          } catch (e) {
            console.error("Auto clock-out failed", e);
          }
        }
      });
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'attendance_monthly'));
    return () => unsubscribe();
  }, [profile, month, todayStr]);

  const handleClockIn = async () => {
    if (!profile) return;
    const dt = new Date();
    const ds = format(dt, 'yyyy-MM-dd');
    const id = `${profile.uid}_${ds}`;
    try {
      await setDoc(doc(db, 'attendance', id), {
        uid: profile.uid,
        date: ds,
        clockIn: dt.toISOString(),
        status: 'PRESENT',
        workHours: 0,
        overtimeHours: 0,
        createdAt: dt.toISOString()
      });
      // 출근 시 유령 가드 자동 활성화
      await updateDoc(doc(db, 'users', profile.uid), {
        ghostGuardEnabled: true,
        lastMovementAt: dt.toISOString(),
        isImmobile: false
      });
      toast.success('출근 완료 (유령 가드 활성화)');
      if (profile?.uid) grantRandomShipPart(profile.uid, '출근');
    } catch (error) { toast.error('실패'); }
  };

  const handleClockOut = async () => {
    if (!profile || !todayAttendance) return;
    try {
      const dt = new Date();
      const isSpecialVal = checkIsSpecialDay(new Date(todayAttendance.clockIn), specialDates).isSpecial;
      const { workHours, overtimeHours } = calculateAttendanceHours(todayAttendance.clockIn, dt, isSpecialVal);
      await updateDoc(doc(db, 'attendance', todayAttendance.id), {
        clockOut: dt.toISOString(),
        workHours,
        overtimeHours
      });
      // 퇴근 시 유령 가드 자동 비활성화
      await updateDoc(doc(db, 'users', profile.uid), {
        ghostGuardEnabled: false,
        isImmobile: false
      });
      toast.success('퇴근 완료 (유령 가드 종료)');
    } catch (error) { toast.error('실패'); }
  };

  const stats = useMemo(() => {
    let hrs = 0; let ot = 0;
    attendanceData.forEach(a => {
      if (a.clockIn && a.clockOut) {
        const isSpecialVal = checkIsSpecialDay(new Date(a.clockIn), specialDates).isSpecial;
        const { workHours, overtimeHours } = calculateAttendanceHours(a.clockIn, new Date(a.clockOut), isSpecialVal);
        hrs += workHours; ot += overtimeHours;
      }
    });
    return { total: hrs, ot };
  }, [attendanceData, specialDates]);

  const chartData = useMemo(() => {
    return [...attendanceData]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-7)
      .map(a => {
        const isSpecialVal = a.clockIn ? checkIsSpecialDay(new Date(a.clockIn), specialDates).isSpecial : false;
        const { workHours } = a.clockIn && (a.clockOut || a.date === todayStr) 
          ? calculateAttendanceHours(a.clockIn, a.clockOut ? new Date(a.clockOut) : now, isSpecialVal)
          : { workHours: 0 };
        return { day: format(parseISO(a.date), 'd일'), hours: workHours };
      });
  }, [attendanceData, todayStr, now, specialDates]);

  const CustomDay = (props: DayProps) => {
    const { day, modifiers, className, style, ...rest } = props;
    const date = day.date;
    const dateStr = format(date, 'yyyy-MM-dd');
    const att = attendanceData.find(a => a.date === dateStr);
    const isToday = isSameDay(date, now);
    const specialInfo = checkIsSpecialDay(date, specialDates);
    const isSpecial = specialInfo.isSpecial;

    return (
      <td {...rest} className={cn("p-0.5 relative align-top", className)}>
        <div className={cn(
          "flex flex-col items-center justify-center min-h-[48px] rounded-lg transition-all p-0.5",
          isToday ? "bg-primary shadow-lg shadow-primary/20" : "bg-card border border-border"
        )}>
          <span className={cn(
            "text-[9px] font-black", 
            isToday 
              ? "text-primary-foreground" 
              : (date.getDay() === 6 ? "text-blue-500" : isSpecial ? "text-red-500" : "text-muted-foreground")
          )}>
            {format(date, 'd')}
          </span>
          {isSpecial && !isToday && (
            <span className={cn(
              "text-[7px] font-bold p-0.5 rounded px-1 scale-90 truncate max-w-full text-center block leading-none select-none",
              date.getDay() === 6
                ? "text-blue-500 bg-blue-500/10"
                : "text-red-500 bg-red-500/10"
            )}>
              {specialInfo.label}
            </span>
          )}
          {att && att.clockIn ? (
            <div className="mt-1 flex flex-col items-center gap-0.5">
              <span className={cn("text-[9px] font-black", isToday ? "text-primary-foreground" : "text-emerald-500")}>
                {att.workHours ? `${att.workHours.toFixed(1)}h` : att.clockOut ? '0.0h' : '근무중'}
              </span>
              {att.overtimeHours ? (
                <span className={cn("text-[8px] font-black", isToday ? "text-primary-foreground/80" : "text-primary")}>
                  +{att.overtimeHours.toFixed(1)}h
                </span>
              ) : (
                <div className={cn("w-1 h-1 rounded-full", isToday ? "bg-primary-foreground" : "bg-emerald-500")} />
              )}
            </div>
          ) : (
              <div className="h-2" />
          )}
        </div>
      </td>
    );
  };

  return (
    <div className="space-y-3 pb-20 px-2">
      <header className="py-3 space-y-0.5">
          <p className="text-[9px] font-black text-muted-foreground/80 uppercase tracking-[0.2em]">근태 모니터링</p>
          <h2 className="text-lg font-black tracking-tight text-foreground leading-tight">근태 관리</h2>
          <p className="text-xs font-bold text-muted-foreground">{format(now, 'yyyy.MM.dd EEEE', { locale: ko })}</p>
          <style>{`
            .rdp { --rdp-cell-size: 100%; margin: 0; width: 100%; }
            .rdp-table { width: 100%; border-collapse: separate; border-spacing: 4px; }
            .rdp-caption_label { color: var(--foreground); font-weight: 900; font-size: 1rem; display: flex; align-items: center; justify-content: center; gap: 4px; }
            .rdp-head_cell { color: var(--muted-foreground); opacity: 0.8; font-weight: 900; font-size: 0.7rem; text-align: center; padding-bottom: 8px; }
          `}</style>
        </header>

      {/* Clocking Unit */}
      <Card className="bg-card border border-border/50 rounded-3xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.03)] relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-[50px] -mr-12 -mt-12" />
        <CardContent className="p-5 space-y-5 relative z-10">
           <div className="flex flex-col items-center gap-1.5">
              <div className="flex items-center gap-2 px-3 py-1 bg-muted rounded-full border border-border/45">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">실시간 근무 모니터링</span>
              </div>
              <span className="text-4xl font-black text-foreground tabular-nums tracking-tighter drop-shadow-sm font-mono">{format(now, 'HH:mm:ss')}</span>
           </div>
           
           <div className="grid grid-cols-2 gap-3.5">
              <button 
                disabled={!!todayAttendance?.clockIn}
                onClick={handleClockIn}
                className={cn(
                  "h-18 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95 shadow-md border-b-[4px] cursor-pointer",
                  todayAttendance?.clockIn 
                    ? "bg-muted text-muted-foreground/30 border-border"
                    : "bg-blue-600 text-white border-blue-700 hover:bg-blue-500 hover:border-blue-600 shadow-blue-500/10"
                )}
              >
                <LogIn className="w-5 h-5" />
                <span className="font-black text-xs">출근 완료</span>
              </button>

              <button 
                disabled={!todayAttendance?.clockIn || !!todayAttendance?.clockOut}
                onClick={handleClockOut}
                className={cn(
                  "h-18 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95 shadow-md border-b-[4px] cursor-pointer",
                  (!todayAttendance?.clockIn || !!todayAttendance?.clockOut)
                    ? "bg-muted text-muted-foreground/30 border-border"
                    : "bg-rose-600 text-white border-rose-700 hover:bg-rose-500 hover:border-rose-600 shadow-rose-500/10"
                )}
              >
                <LogOut className="w-5 h-5" />
                <span className="font-black text-xs">퇴근 완료</span>
              </button>
           </div>

           {todayAttendance?.clockIn && (
             <div className="bg-muted/60 backdrop-blur-sm rounded-2xl p-3.5 flex justify-between items-center border border-border/50">
                <div className="flex gap-6">
                   <div className="flex flex-col">
                      <span className="text-[9px] font-black text-muted-foreground/50 uppercase">출근 시각</span>
                      <span className="text-xs font-black text-blue-500">{format(parseISO(todayAttendance.clockIn), 'HH:mm')}</span>
                   </div>
                   {todayAttendance.clockOut && (
                      <div className="flex flex-col">
                         <span className="text-[9px] font-black text-muted-foreground/50 uppercase">퇴근 시각</span>
                         <span className="text-xs font-black text-rose-500">{format(parseISO(todayAttendance.clockOut), 'HH:mm')}</span>
                      </div>
                   )}
                </div>
                {todayAttendance.clockIn && !todayAttendance.clockOut && (
                  <Badge className="bg-emerald-500/15 text-emerald-500 border-none px-3 py-1 font-black animate-pulse rounded-xl">
                    현재 근무 중
                  </Badge>
                )}
             </div>
           )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3.5">
         <div className="bg-card border border-border/50 p-4 rounded-3xl flex flex-col gap-1 items-start shadow-[0_2px_12px_rgba(0,0,0,0.01)] relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/5 rounded-full blur-xl group-hover:bg-blue-500/10 transition-colors" />
            <div className="w-8 h-8 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500 mb-1 border border-blue-500/10">
              <Clock className="w-4 h-4" />
            </div>
            <span className="text-[8px] font-black text-blue-500/80 uppercase tracking-widest leading-none">이달의 누적 근무</span>
            <span className="text-xl font-black text-foreground">{stats.total.toFixed(0)}<span className="text-[10px] font-bold text-muted-foreground/40 ml-0.5 font-sans">H</span></span>
         </div>
         <div className="bg-card border border-border/50 p-4 rounded-3xl flex flex-col gap-1 items-start shadow-[0_2px_12px_rgba(0,0,0,0.01)] relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/5 rounded-full blur-xl group-hover:bg-amber-500/10 transition-colors" />
            <div className="w-8 h-8 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500 mb-1 border border-amber-500/10">
              <Activity className="w-4 h-4" />
            </div>
            <span className="text-[8px] font-black text-amber-600/80 uppercase tracking-widest leading-none">초과 근무 시간</span>
            <span className="text-xl font-black text-amber-600">{stats.ot.toFixed(0)}<span className="text-[10px] font-bold text-amber-600/40 ml-0.5 font-sans">H</span></span>
         </div>
      </div>

      <Card className="bg-card border border-border/50 rounded-3xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.01)]">
         <CardContent className="p-4">
            <div className="flex items-center gap-1.5 mb-3">
               <Activity className="w-3.5 h-3.5 text-primary" />
               <span className="text-xs font-black text-foreground">최근 근무 트렌드</span>
            </div>
            <div className="h-[140px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: 'var(--muted-foreground)', opacity: 0.5, fontSize: 10}} />
                  <Tooltip cursor={{fill: 'var(--muted)', opacity: 0.2}} contentStyle={{backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '10px'}} />
                  <Bar dataKey="hours" fill="var(--primary)" radius={[6, 6, 0, 0]} barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            </div>
         </CardContent>
      </Card>

      <Card className="border-none shadow-none bg-card rounded-2xl overflow-hidden border border-border">
        <CardContent className="p-3 pt-5">
           <style>{`
             .rdp { --rdp-cell-size: 34px; margin: 0 auto; width: 100%; }
             .rdp-caption_label { color: var(--foreground); font-weight: 900; }
             .rdp-nav_button { color: var(--muted-foreground); opacity: 0.8; }
             .rdp-head_cell { color: var(--muted-foreground); opacity: 0.6; font-size: 10px; font-weight: 900; }
           `}</style>
           <DayPicker 
              mode="single" 
              month={month} 
              onMonthChange={setMonth} 
              locale={ko} 
              components={{ Day: CustomDay }}
           />
        </CardContent>
      </Card>

      {/* Daily History List */}
      <div className="space-y-3">
         <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
               <Clock className="w-3.5 h-3.5 text-primary" />
               <span className="text-xs font-black text-foreground">상세 내역 (최근 5건)</span>
            </div>
            <Button 
               variant="ghost" 
               size="sm" 
               className="text-[10px] font-black text-primary hover:text-primary/80 h-auto p-0"
               onClick={() => {
                  setHistoryMonth(month);
                  setIsHistoryOpen(true);
               }}
            >
               더보기
            </Button>
         </div>
         <div className="space-y-2">
            {[...attendanceData]
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 5)
              .map((att) => (
               <div key={att.id} className="bg-card p-3 rounded-xl border border-border flex items-center justify-between">
                  <div className="flex flex-col">
                     <span className="text-[11px] font-black text-foreground">{format(parseISO(att.date), 'MM월 dd일 (EEEE)', { locale: ko })}</span>
                     <div className="flex gap-2 text-[9px] font-bold text-muted-foreground mt-0.5">
                        <span>{att.clockIn ? format(parseISO(att.clockIn), 'HH:mm') : '--:--'}</span>
                        <span>-</span>
                        <span>{att.clockOut ? format(parseISO(att.clockOut), 'HH:mm') : (att.date === todayStr ? '근무중' : '--:--')}</span>
                     </div>
                  </div>
                  <div className="text-right">
                     <div className="flex flex-col items-end">
                        <span className="text-xs font-black text-foreground">
                           기본 {att.workHours ? `${att.workHours.toFixed(1)}시간` : (att.clockIn && !att.clockOut && att.date === todayStr ? '계산중' : '0시간')}
                        </span>
                        {att.overtimeHours > 0 && (
                           <span className="text-[9px] font-black text-primary">잔업 {att.overtimeHours.toFixed(1)}시간</span>
                        )}
                     </div>
                  </div>
               </div>
            ))}
            {attendanceData.length === 0 && (
               <div className="py-10 text-center opacity-20">
                  <p className="text-xs font-black">내역이 없습니다</p>
               </div>
            )}
         </div>
      </div>

      {/* Full History Dialog */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
         <DialogContent className="bg-background border border-border rounded-t-[32px] sm:rounded-3xl p-0 h-[85vh] sm:h-[80vh] flex flex-col overflow-hidden bottom-0 sm:bottom-auto translate-y-0 sm:-translate-y-1/2 max-w-2xl w-full">
            <DialogHeader className="p-8 pb-4 flex-shrink-0">
               <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <DialogTitle className="text-2xl font-black text-foreground whitespace-nowrap">근태 상세 내역</DialogTitle>
                  <div className="flex items-center gap-3 bg-muted rounded-xl px-4 py-2 w-full sm:w-auto justify-between sm:justify-start">
                     <Button 
                        variant="ghost" size="icon" 
                        className="w-8 h-8 text-muted-foreground/40 hover:text-foreground"
                        onClick={() => setHistoryMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1))}
                     >
                        <ChevronLeft className="w-4 h-4" />
                     </Button>
                     <span className="text-sm font-black text-foreground px-2 whitespace-nowrap">
                        {format(historyMonth, 'yyyy년 MM월')}
                     </span>
                     <Button 
                        variant="ghost" size="icon" 
                        className="w-8 h-8 text-muted-foreground/40 hover:text-foreground"
                        onClick={() => setHistoryMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1))}
                     >
                        <ChevronRight className="w-4 h-4" />
                     </Button>
                  </div>
               </div>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-3">
               {[...historyData]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((att) => (
                  <div key={att.id} className="bg-card p-5 rounded-2xl border border-border flex items-center justify-between gap-4">
                     <div className="flex flex-col min-w-0">
                        <span className="text-sm font-black text-foreground whitespace-nowrap">{format(parseISO(att.date), 'MM월 dd일 (EEEE)', { locale: ko })}</span>
                        <div className="flex gap-2 text-xs font-bold text-muted-foreground mt-1 whitespace-nowrap">
                           <span>{att.clockIn ? format(parseISO(att.clockIn), 'HH:mm') : '--:--'}</span>
                           <span>-</span>
                           <span>{att.clockOut ? format(parseISO(att.clockOut), 'HH:mm') : (att.date === todayStr ? '근무중' : '--:--')}</span>
                        </div>
                     </div>
                     <div className="text-right shrink-0">
                        <div className="flex flex-col items-end">
                           <span className="text-base font-black text-foreground whitespace-nowrap">
                              기본 {att.workHours ? `${att.workHours.toFixed(1)}시간` : (att.clockIn && !att.clockOut && att.date === todayStr ? '계산중' : '0시간')}
                           </span>
                           {att.overtimeHours > 0 && (
                              <p className="text-xs font-black text-primary whitespace-nowrap">잔업 {att.overtimeHours.toFixed(1)}시간</p>
                           )}
                        </div>
                     </div>
                  </div>
               ))}
               {historyData.length === 0 && (
                  <div className="py-40 text-center opacity-20">
                     <p className="text-sm font-black">내역이 없습니다</p>
                  </div>
               )}
            </div>
            <div className="p-6 pt-2 bg-gradient-to-t from-background flex-shrink-0">
               <Button 
                  className="w-full h-14 bg-card border border-border hover:bg-muted text-foreground font-black rounded-2xl" 
                  onClick={() => setIsHistoryOpen(false)}
               >
                  닫기
               </Button>
            </div>
         </DialogContent>
      </Dialog>
    </div>
  );
};
