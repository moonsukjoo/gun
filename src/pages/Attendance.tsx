import React, { useState, useEffect, useMemo } from 'react';
import { db } from '@/src/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  doc 
} from 'firebase/firestore';
import { Attendance as AttendanceType } from '@/src/types';
import { useAuth } from '@/src/components/AuthProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  isSameDay, 
  differenceInMinutes,
  parseISO,
  startOfDay,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { 
  Clock, 
  TrendingUp,
  AlertCircle,
  LogIn,
  LogOut,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { DayPicker, DayProps } from 'react-day-picker';

import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';

import { calculateAttendanceHours } from '@/src/lib/attendance';

export const Attendance: React.FC = () => {
  const { profile } = useAuth();
  const [month, setMonth] = useState<Date>(new Date());
  const [attendanceData, setAttendanceData] = useState<AttendanceType[]>([]);
  const [loading, setLoading] = useState(true);
  
  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const [now, setNow] = useState(new Date());

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
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceType));
      setAttendanceData(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile, month]);

  const handleClockIn = async () => {
    if (!profile) return;
    const now = new Date();
    const dateStr = format(now, 'yyyy-MM-dd');

    const attendanceId = `${profile.uid}_${dateStr}`;
    
    try {
      await setDoc(doc(db, 'attendance', attendanceId), {
        uid: profile.uid,
        date: dateStr,
        clockIn: now.toISOString(),
        status: 'PRESENT',
        workHours: 0,
        overtimeHours: 0,
        createdAt: now.toISOString()
      });
      toast.success('출근 등록되었습니다. 좋은 하루 되세요!');
    } catch (error) {
      toast.error('출근 등록 실패');
    }
  };

  const handleClockOut = async () => {
    if (!profile || !todayAttendance) return;
    try {
      const now = new Date();
      const { workHours, overtimeHours } = calculateAttendanceHours(todayAttendance.clockIn, now);

      await updateDoc(doc(db, 'attendance', todayAttendance.id), {
        clockOut: now.toISOString(),
        workHours,
        overtimeHours
      });
      toast.success('퇴근 등록되었습니다. 수고하셨습니다!');
    } catch (error) {
      console.error("Clock-out error:", error);
      toast.error('퇴근 등록 실패');
    }
  };

  const { totalMonthlyHours, totalOvertimeHours, lateCount, leaveCount } = useMemo(() => {
    let regular = 0;
    let overtime = 0;
    let lates = 0;
    let leaves = 0;

    attendanceData.forEach(a => {
      // Recalculate everything based on clockIn/Out to ensure historical data follows current rules
      const currentDayStr = format(now, 'yyyy-MM-dd');
      const clockOutTime = a.clockOut || (a.date === currentDayStr ? now : null);
      
      if (a.clockIn && clockOutTime) {
        const { workHours, overtimeHours } = calculateAttendanceHours(a.clockIn, clockOutTime);
        regular += workHours;
        overtime += overtimeHours;

        // Calculate late (assuming 09:00 as start time)
        const clockInDate = parseISO(a.clockIn);
        const workStartTime = startOfDay(clockInDate);
        workStartTime.setHours(9, 0, 0, 0);
        if (clockInDate > workStartTime) {
          lates++;
        }
      }

      if (a.leaveType) {
        leaves += (a.leaveType === 'ANNUAL' ? 1 : 0.5);
      }
    });

    return {
      totalMonthlyHours: regular + overtime,
      totalOvertimeHours: overtime,
      lateCount: lates,
      leaveCount: leaves
    };
  }, [attendanceData, now]);

  const chartData = useMemo(() => {
    // Sort attendance data by date
    const sorted = [...attendanceData].sort((a, b) => a.date.localeCompare(b.date));
    
    return sorted.map(a => {
      const clockOutTime = a.clockOut || (a.date === todayStr ? now : null);
      let work = 0;
      let overtime = 0;

      if (a.clockIn && clockOutTime) {
        const hours = calculateAttendanceHours(a.clockIn, clockOutTime);
        work = hours.workHours;
        overtime = hours.overtimeHours;
      }

      return {
        day: format(parseISO(a.date), 'd일'),
        기본근무: work,
        연장근무: overtime,
        휴가체크: a.leaveType ? 1 : 0,
        isLeave: !!a.leaveType,
        leaveLabel: a.leaveType === 'AM_HALF' ? '오전반차' : a.leaveType === 'PM_HALF' ? '오후반차' : a.leaveType === 'ANNUAL' ? '연차' : null
      };
    });
  }, [attendanceData, now, todayStr]);

  // Custom Day component to show attendance info
  const CustomDay = (props: DayProps) => {
    const { day, modifiers, className, style, ...rest } = props;
    const date = day.date;
    const dateStr = format(date, 'yyyy-MM-dd');
    const attendance = attendanceData.find(a => a.date === dateStr);
    const isToday = isSameDay(date, now);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;

    // Helper to format time if it's an ISO string
    const formatTime = (timeStr: string) => {
      if (!timeStr) return '';
      if (timeStr.includes('T')) {
        try {
          return format(parseISO(timeStr), 'HH:mm');
        } catch (e) {
          return timeStr.slice(11, 16);
        }
      }
      return timeStr;
    };

    return (
      <td 
        {...rest}
        className={cn("p-0.5 relative align-top", className)}
        style={style}
      >
        <div 
          className={cn(
            "flex flex-col items-center justify-start w-full min-h-[70px] p-1 gap-1 relative rounded-xl transition-colors hover:bg-slate-50 border border-transparent",
            isToday && "bg-primary/5 border-primary/20 shadow-sm"
          )}
        >
          <span className={cn(
            "text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-lg shrink-0",
            isToday ? "bg-primary text-white" : isWeekend ? "text-red-400" : "text-slate-600"
          )}>
            {format(date, 'd')}
          </span>
          
          {attendance && (
            <div className="flex flex-col gap-0.5 w-full">
              {attendance.leaveType && (
                <div className={cn(
                  "flex items-center justify-center gap-0.5 py-0.5 px-1 rounded text-[7px] font-black tracking-tighter leading-none border",
                  attendance.leaveType === 'AM_HALF' ? "bg-blue-50 text-blue-700 border-blue-100" :
                  attendance.leaveType === 'PM_HALF' ? "bg-orange-50 text-orange-700 border-orange-100" :
                  "bg-slate-100 text-slate-700 border-slate-200"
                )}>
                  <span>{attendance.leaveType === 'AM_HALF' ? '오전반차' : attendance.leaveType === 'PM_HALF' ? '오후반차' : '연차'}</span>
                </div>
              )}
              {attendance.clockIn && (
                <div className="flex items-center justify-center gap-0.5 bg-emerald-50 text-emerald-700 py-0.5 px-1 rounded text-[7px] font-black tracking-tighter leading-none border border-emerald-100">
                  <span>출</span>
                  <span>{formatTime(attendance.clockIn)}</span>
                </div>
              )}
              {attendance.clockOut && (
                <div className="flex items-center justify-center gap-0.5 bg-orange-50 text-orange-700 py-0.5 px-1 rounded text-[7px] font-black tracking-tighter leading-none border border-orange-100">
                  <span>퇴</span>
                  <span>{formatTime(attendance.clockOut)}</span>
                </div>
              )}
              {attendance.workHours > 0 && (
                <div className="text-[7px] font-black text-slate-400 mt-0.5 text-center leading-none">
                  총 {calculateAttendanceHours(attendance.clockIn, attendance.clockOut || now).workHours + calculateAttendanceHours(attendance.clockIn, attendance.clockOut || now).overtimeHours}시간
                </div>
              )}
            </div>
          )}
        </div>
      </td>
    );
  };

  return (
    <div className="space-y-6 pb-24">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <div className="w-2 h-6 bg-primary rounded-full" />
          <h2 className="text-3xl font-black tracking-tighter text-slate-900">근태 관리</h2>
        </div>
        <p className="text-[11px] text-slate-500 font-bold uppercase tracking-[0.2em] ml-4">일일 근태 관리 기록</p>
      </header>

      {/* Action Card */}
      <Card className="border-none shadow-xl bg-white rounded-[2.5rem] overflow-hidden">
        <CardContent className="p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">오늘의 기록</p>
              <h3 className="text-2xl font-black tracking-tighter text-slate-900">{format(now, 'yyyy년 MM월 dd일')}</h3>
            </div>
            <Badge className={cn(
              "font-black text-xs px-4 py-1.5 rounded-2xl shadow-sm",
              todayAttendance?.clockOut ? "bg-slate-100 text-slate-500" : todayAttendance?.clockIn ? "bg-emerald-500 text-white" : "bg-primary/10 text-primary border-none"
            )}>
              {todayAttendance?.clockOut ? '근무 종료' : todayAttendance?.clockIn ? '근무 중' : '출근 전'}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <Button 
                onClick={handleClockIn}
                disabled={!!todayAttendance?.clockIn}
                className={cn(
                  "w-full h-16 rounded-3xl gap-3 font-black text-lg transition-all active:scale-95 shadow-lg",
                  todayAttendance?.clockIn ? "bg-slate-100 text-slate-300 border-none shadow-none" : "bg-primary hover:bg-primary-hover text-white shadow-primary/20"
                )}
              >
                <LogIn className="w-6 h-6" /> 출근
              </Button>
              {todayAttendance?.clockIn && (
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">출근 시간</span>
                  <span className="text-sm font-black text-slate-900">{todayAttendance.clockIn}</span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Button 
                onClick={handleClockOut}
                disabled={!todayAttendance?.clockIn || !!todayAttendance?.clockOut}
                className={cn(
                  "w-full h-16 rounded-3xl gap-3 font-black text-lg transition-all active:scale-95 shadow-lg",
                  (!todayAttendance?.clockIn || !!todayAttendance?.clockOut) ? "bg-slate-100 text-slate-300 border-none shadow-none" : "bg-orange-500 hover:bg-orange-600 text-white shadow-orange-100"
                )}
              >
                <LogOut className="w-6 h-6" /> 퇴근
              </Button>
              {todayAttendance?.clockOut && (
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">퇴근 시간</span>
                  <span className="text-sm font-black text-slate-900">{todayAttendance.clockOut}</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <Info className="w-4 h-4 text-primary" /> {format(month, 'MM월')} 근무 요약
          </h3>
          <span className="text-[10px] font-bold text-slate-400">실시간 기준</span>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden group hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex flex-col gap-1">
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 w-fit px-2 py-0.5 rounded-lg border border-slate-100">
                <Clock className="w-3 h-3 text-primary" /> 총 근무 시간
              </div>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-black text-slate-900 tracking-tighter">{totalMonthlyHours}</span>
                <span className="text-[10px] font-black text-slate-400">시간</span>
              </div>
              <div className="w-full h-1 bg-slate-50 rounded-full mt-2 overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full transition-all duration-1000" 
                  style={{ width: `${Math.min((totalMonthlyHours / 160) * 100, 100)}%` }}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden group hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex flex-col gap-1">
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-orange-50 w-fit px-2 py-0.5 rounded-lg border border-orange-100">
                <TrendingUp className="w-3 h-3 text-orange-500" /> 연장 근무
              </div>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-black text-slate-900 tracking-tighter">{totalOvertimeHours}</span>
                <span className="text-[10px] font-black text-slate-400">시간</span>
              </div>
              <div className="w-full h-1 bg-orange-50 rounded-full mt-2 overflow-hidden">
                <div 
                  className="h-full bg-orange-400 rounded-full transition-all duration-1000" 
                  style={{ width: `${Math.min((totalOvertimeHours / 40) * 100, 100)}%` }}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden group hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex flex-col gap-1">
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-red-50 w-fit px-2 py-0.5 rounded-lg border border-red-100">
                <AlertCircle className="w-3 h-3 text-red-500" /> 지각 횟수
              </div>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-black text-slate-900 tracking-tighter">{lateCount}</span>
                <span className="text-[10px] font-black text-slate-400">회</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden group hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex flex-col gap-1">
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-emerald-50 w-fit px-2 py-0.5 rounded-lg border border-emerald-100">
                <CalendarIcon className="w-3 h-3 text-emerald-500" /> 휴가 사용
              </div>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-black text-slate-900 tracking-tighter">{leaveCount}</span>
                <span className="text-[10px] font-black text-slate-400">일</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Statistics Chart */}
      <Card className="border-none shadow-sm bg-white rounded-[2.5rem] overflow-hidden">
        <CardHeader className="p-8 pb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 border border-emerald-100">
              <TrendingUp className="w-5 h-5" />
            </div>
            <CardTitle className="text-xl font-black tracking-tight text-slate-900">월간 근무 분석</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="h-[300px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="day" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                />
                <Tooltip 
                  cursor={{ fill: '#f1f5f9', opacity: 0.4 }}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-4 rounded-2xl shadow-2xl border border-slate-100 flex flex-col gap-2 min-w-[120px]">
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                            <span>{label}</span>
                            {data.isLeave && (
                              <Badge className="bg-orange-50 text-orange-600 border-orange-100 text-[8px] h-4 px-1 rounded">
                                {data.leaveLabel}
                              </Badge>
                            )}
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                                <span className="text-[10px] font-black text-slate-500">기본 근무</span>
                              </div>
                              <span className="text-xs font-black text-slate-900">{data.기본근무}시간</span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                                <span className="text-[10px] font-black text-slate-500">연장 근무</span>
                              </div>
                              <span className="text-xs font-black text-slate-900">{data.연장근무}시간</span>
                            </div>
                            <div className="pt-1 mt-1 border-t border-slate-50 flex items-center justify-between">
                              <span className="text-[10px] font-black text-slate-400">총 합계</span>
                              <span className="text-xs font-black text-primary">{data.기본근무 + data.연장근무}시간</span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend 
                  verticalAlign="top" 
                  align="right" 
                  iconType="circle"
                  formatter={(value) => <span className="text-[10px] font-black text-slate-600">{value}</span>}
                  wrapperStyle={{ paddingBottom: '20px' }}
                />
                <Bar 
                  dataKey="기본근무" 
                  fill="#2563eb" 
                  radius={[4, 4, 0, 0]} 
                  barSize={12}
                />
                <Bar 
                  dataKey="연장근무" 
                  fill="#f97316" 
                  radius={[4, 4, 0, 0]} 
                  barSize={12}
                />
                <Bar 
                  dataKey="휴가체크" 
                  name="휴가/반차"
                  fill="#94a3b8" 
                  opacity={0.3}
                  radius={[10, 10, 10, 10]} 
                  barSize={4}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Calendar Card */}
      <Card className="border-none shadow-sm bg-white rounded-[2.5rem] overflow-hidden">
        <CardHeader className="p-8 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-primary border border-slate-100">
                <CalendarIcon className="w-5 h-5" />
              </div>
              <CardTitle className="text-xl font-black tracking-tight text-slate-900">연간 근태 캘린더</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-2 sm:p-6 flex flex-col items-center">
          <div className="w-full max-w-full overflow-hidden">
            <style>{`
              .rdp {
                --rdp-cell-size: 54px;
                --rdp-accent-color: var(--color-primary);
                --rdp-background-color: var(--color-primary);
                margin: 0;
                width: 100%;
              }
              .rdp-months { width: 100%; display: block; }
              .rdp-month { width: 100%; }
              .rdp-table { width: 100%; max-width: 100%; border-collapse: separate; border-spacing: 2px; table-layout: fixed; }
              .rdp-day { border-radius: 12px; }
              .rdp-button:hover:not([disabled]):not(.rdp-day_selected) {
                background-color: #f8fafc;
              }
              .rdp-caption { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; padding: 0 10px; }
              .rdp-caption_label { font-size: 1.25rem; font-weight: 900; letter-spacing: -0.05em; color: #0f172a; }
              .rdp-nav { display: flex; gap: 8px; }
              .rdp-head_cell { font-size: 10px; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; padding-bottom: 12px; }
            `}</style>
            <DayPicker
              mode="single"
              month={month}
              onMonthChange={setMonth}
              locale={ko}
              className="w-full"
              components={{
                Day: CustomDay
              }}
            />
          </div>

          <div className="mt-6 w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-slate-400" />
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">캘린더 범례</p>
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-7 h-4 bg-emerald-50 text-emerald-700 rounded text-[8px] font-black border border-emerald-100">출</div>
                <span className="text-[10px] font-bold text-slate-600">출근 기록</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-7 h-4 bg-orange-50 text-orange-700 rounded text-[8px] font-black border border-orange-100">퇴</div>
                <span className="text-[10px] font-bold text-slate-600">퇴근 기록</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-blue-50 border border-blue-100" />
                <span className="text-[10px] font-bold text-slate-600">오전반차</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-orange-50 border border-orange-100" />
                <span className="text-[10px] font-bold text-slate-600">오후반차</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{totalMonthlyHours}시간</span>
                <span className="text-[10px] font-bold text-slate-600">이달의 총 근무</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
