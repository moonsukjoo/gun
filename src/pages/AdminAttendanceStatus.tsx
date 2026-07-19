import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/components/AuthProvider';
import PCAdminLayout from '@/components/PCAdminLayout';
import { db, handleFirestoreError, OperationType } from '@/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { UserProfile, Attendance, AttendanceLog } from '@/types';
import { format, subDays } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  ChevronLeft, 
  Search, 
  Clock, 
  CheckCircle2, 
  Timer,
  Bell,
  HardHat,
  Filter,
  CheckCircle,
  TrendingUp,
  Briefcase,
  Layers,
  Calendar,
  FileText,
  RefreshCw,
  PieChart as PieIcon,
  BarChart3 as BarIcon,
  Activity
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  AreaChart, 
  Area 
} from 'recharts';

export const AdminAttendanceStatus: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();

  // State Variables
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'PRESENT' | 'LATE' | 'ABSENT' | 'LEAVE'>('ALL');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [timeZone, setTimeZone] = useState(format(new Date(), 'yyyy-MM-dd HH:mm:ss'));

  // Interactive UI Sound Synth
  const playSound = (type: 'success' | 'click' | 'pop') => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'success') {
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } else if (type === 'click') {
        osc.frequency.setValueAtTime(440, ctx.currentTime); // A4
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } else if (type === 'pop') {
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.03, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      }
    } catch (e) {
      // restricted or failed silent
    }
  };

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    setLoading(true);

    // Refresh clock
    const timer = setInterval(() => {
      setTimeZone(format(new Date(), 'yyyy-MM-dd HH:mm:ss'));
    }, 1000);

    // 1. Fetch raw active rosters
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const roster = snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setUsers(roster);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    // 2. Stream standard check-in attendance lists
    const attQ = query(collection(db, 'attendance'), where('date', '==', todayStr));
    const unsubAtt = onSnapshot(attQ, (snap) => {
      const dayAtts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Attendance));
      setTodayAttendance(dayAtts);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'attendance');
      setLoading(false);
    });

    return () => {
      clearInterval(timer);
      unsubUsers();
      unsubAtt();
    };
  }, [todayStr]);

  const handleManualRefresh = () => {
    playSound('success');
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success('실시간 근태 데이터 갱신이 성공적으로 통계화되었습니다.');
    }, 800);
  };

  // Safe dashboard statistics computations
  const getDashboardStats = () => {
    const totalCount = users.filter(u => u.status === 'ACTIVE').length || 1;
    const presentCount = todayAttendance.filter(a => a.status === 'PRESENT').length;
    const lateCount = todayAttendance.filter(a => a.status === 'LATE').length;
    const leaveCount = todayAttendance.filter(a => a.status === 'LEAVE').length;
    const absentCount = Math.max(0, totalCount - presentCount - lateCount - leaveCount);
    const attendanceRate = Math.round(((presentCount + lateCount) / totalCount) * 100);

    return { totalCount, presentCount, lateCount, leaveCount, absentCount, attendanceRate };
  };

  const stats = getDashboardStats();

  // Extraction of unique departments
  const departments = ['ALL', ...Array.from(new Set(users.map(u => u.departmentName).filter((name): name is string => !!name)))];

  // Construct Data for Charts
  // 1. Distribution Ratio Pie Chart Data
  const pieChartData = [
    { name: '정상출근', value: stats.presentCount, color: '#10b981' },
    { name: '지각', value: stats.lateCount, color: '#f59e0b' },
    { name: '휴가자', value: stats.leaveCount, color: '#38bdf8' },
    { name: '미출근', value: stats.absentCount, color: '#f43f5e' }
  ].filter(item => item.value > 0);

  // 2. Departmental Breakdown Performance Data
  const getDepartmentStats = () => {
    return departments.filter(d => d !== 'ALL').map(dept => {
      const deptMembers = users.filter(u => u.status === 'ACTIVE' && u.departmentName === dept);
      const totalDept = deptMembers.length || 1;
      const deptPresent = todayAttendance.filter(a => {
        const user = users.find(u => u.uid === a.uid);
        return user?.departmentName === dept && (a.status === 'PRESENT' || a.status === 'LATE');
      }).length;
      
      const rate = Math.round((deptPresent / totalDept) * 100);
      return {
        name: dept,
        members: totalDept,
        onDuty: deptPresent,
        rate: rate
      };
    }).sort((a, b) => b.rate - a.rate);
  };

  const deptChartData = getDepartmentStats();

  // 3. Hourly Arrival slots
  const getHourlyDistribution = () => {
    const hours = ['07:00', '07:30', '08:00', '08:30', '09:00', '09:30'];
    return hours.map(timeLabel => {
      const count = todayAttendance.filter(a => {
        if (!a.clockIn) return false;
        // Simple string comparisons
        return a.clockIn.startsWith(timeLabel.substring(0, 2));
      }).length;
      return { time: timeLabel, 인원: count };
    });
  };

  const hourlyData = getHourlyDistribution();

  // Filter roster items
  const filteredRoster = users.filter(user => {
    if (user.status !== 'ACTIVE') return false;
    
    // search matching
    const matchesSearch = 
      user.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.employeeId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.departmentName?.toLowerCase().includes(searchQuery.toLowerCase());

    // department matching
    const matchesDept = selectedDept === 'ALL' || user.departmentName === selectedDept;

    // attendance status matching
    const userAtt = todayAttendance.find(a => a.uid === user.uid);
    let matchedStatus = false;
    if (activeFilter === 'ALL') matchedStatus = true;
    else if (activeFilter === 'PRESENT') matchedStatus = userAtt?.status === 'PRESENT';
    else if (activeFilter === 'LATE') matchedStatus = userAtt?.status === 'LATE';
    else if (activeFilter === 'LEAVE') matchedStatus = userAtt?.status === 'LEAVE';
    else if (activeFilter === 'ABSENT') matchedStatus = !userAtt;

    return matchesSearch && matchesDept && matchedStatus;
  });

  const location = useLocation();
  const isPC = location.pathname.startsWith('/admin/pc');
  const innerContent = (
    <div className="bg-[#070b13] text-foreground p-3 sm:p-6 lg:p-8 space-y-6 md:space-y-8 font-sans pb-24 rounded-[2.5rem]">
      {/* Top Floating Glass Navigation Panel */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/40 backdrop-blur-xl border border-white/5 p-4 sm:p-5 rounded-3xl shadow-2xl">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => { playSound('click'); navigate(isPC ? '/admin/pc-dashboard' : '/admin'); }}
            className="w-11 h-11 rounded-full bg-white/5 text-slate-300 hover:bg-white/10"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase text-teal-400 tracking-[0.25em] bg-teal-500/10 px-2.5 py-1 rounded-full">
                건명 스마트 안전 지휘본부
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white mt-1 tracking-tight flex items-center gap-2">
              <Users className="w-6 h-6 text-teal-400" />
              전사 출근 통합관제 대시보드
            </h1>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3 w-full sm:w-auto">
          <div className="text-right sm:text-zinc-400 font-mono text-[11px] font-bold">
            <span className="text-teal-400">대시보드 실시시간 기준: </span> {timeZone}
          </div>
          <Button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="w-full sm:w-auto h-11 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-black rounded-xl gap-2 transition-all active:scale-95"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-teal-400' : ''}`} />
            실시간 지표 리프레시
          </Button>
        </div>
      </div>

      {/* Main Grid: Left Statistics Visualizers, Right Employee Roster (lg:col-span-12) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
        
        {/* Left Column: Interactive Analytics and Trends (lg:col-span-6) */}
        <div className="lg:col-span-6 space-y-6 md:space-y-8">
          
          {/* Card 1: Attendance Proportion Visual */}
          <Card className="bg-slate-950 border border-white/5 rounded-[2.5rem] relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 w-44 h-44 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />
            <CardHeader className="pb-2 border-b border-white/5 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-black text-white flex items-center gap-2">
                  <PieIcon className="w-4 h-4 text-emerald-400" />
                  금일 출근 현황 점유 분율 (Proportion)
                </CardTitle>
                <CardDescription className="text-slate-400/80 font-medium">실시간 오늘 하루 사원들의 근태 상태 점유율입니다.</CardDescription>
              </div>
              <Activity className="w-5 h-5 text-emerald-500 animate-pulse" />
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                {/* Visual Ring Chart */}
                <div className="md:col-span-5 h-48 w-full flex items-center justify-center relative">
                  {pieChartData.length === 0 ? (
                    <div className="text-slate-500 text-xs font-bold">출근 데이터 없음</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieChartData}
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {pieChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                          labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                          itemStyle={{ fontSize: '11px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                  {/* Absolute Center Rate % */}
                  <div className="absolute flex flex-col items-center justify-center pointer-events-none mb-1">
                    <span className="text-[10px] uppercase tracking-widest text-slate-400/80 font-black">출근률</span>
                    <span className="text-2xl font-black text-white">{stats.attendanceRate}%</span>
                  </div>
                </div>

                {/* Legend list with Interactive Sound Trigger buttons */}
                <div className="md:col-span-7 space-y-2.5">
                  {[
                    { label: '정상출근 완료', value: stats.presentCount, percentage: Math.round((stats.presentCount / stats.totalCount) * 100) || 0, color: 'bg-emerald-500', text: 'text-emerald-400' },
                    { label: '지각(주의 발생)', value: stats.lateCount, percentage: Math.round((stats.lateCount / stats.totalCount) * 100) || 0, color: 'bg-amber-500', text: 'text-amber-400' },
                    { label: '휴가 및 파견', value: stats.leaveCount, percentage: Math.round((stats.leaveCount / stats.totalCount) * 100) || 0, color: 'bg-sky-500', text: 'text-sky-400' },
                    { label: '미등록/미출근', value: stats.absentCount, percentage: Math.max(0, 100 - (Math.round((stats.presentCount / stats.totalCount) * 100) || 0) - (Math.round((stats.lateCount / stats.totalCount) * 100) || 0) - (Math.round((stats.leaveCount / stats.totalCount) * 100) || 0)), color: 'bg-rose-500', text: 'text-rose-400' }
                  ].map((item, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => playSound('pop')}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/10 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                        <span className="text-xs font-black text-slate-300 group-hover:text-white transition-colors">{item.label}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-slate-400/80">{item.value}명</span>
                        <span className={`text-xs font-black font-mono px-2 py-0.5 rounded-md bg-white/5 ${item.text}`}>{item.percentage}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Department Attendance Rate Progress bar analysis */}
          <Card className="bg-slate-950 border border-white/5 rounded-[2.5rem] relative overflow-hidden shadow-2xl">
            <CardHeader className="pb-2 border-b border-white/5">
              <CardTitle className="text-base font-black text-white flex items-center gap-2">
                <BarIcon className="w-4 h-4 text-teal-400" />
                부서별 출근 가동률 순위 (Metrics Chart)
              </CardTitle>
              <CardDescription className="text-slate-400/80 font-medium">각 부서의 가동 성공 비율과 소속 사원수를 비교 분석합니다.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              
              {/* Interactive custom visual graph representing departments */}
              {deptChartData.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">설정된 부서 정보가 부재합니다.</div>
              ) : (
                deptChartData.map((dept, idx) => (
                  <div 
                    key={dept.name} 
                    className="p-3.5 rounded-2xl bg-slate-900/50 hover:bg-slate-900 border border-white/5 hover:border-teal-500/10 transition-all relative group cursor-pointer"
                    onClick={() => {
                      playSound('click');
                      setSelectedDept(dept.name);
                      toast.info(`[${dept.name}] 소속 ${dept.members}명 중 ${dept.onDuty}명 출근 완료`);
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] w-5 h-5 rounded-md flex items-center justify-center bg-teal-500/10 text-teal-400 font-bold font-mono">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-black text-white group-hover:text-teal-400 transition-colors">
                          {dept.name}
                        </span>
                        <span className="text-[10px] text-slate-400/50 font-bold">
                          ({dept.onDuty}/{dept.members}명)
                        </span>
                      </div>
                      <span className="text-xs font-black text-emerald-400 font-mono">
                        {dept.rate}%
                      </span>
                    </div>

                    <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden relative">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${dept.rate}%` }}
                        transition={{ duration: 0.8, delay: idx * 0.1 }}
                        className={`h-full rounded-full bg-gradient-to-r ${
                          dept.rate >= 90 ? 'from-emerald-500 to-teal-400' :
                          dept.rate >= 70 ? 'from-amber-500 to-yellow-400' :
                          'from-rose-500 to-orange-400'
                        }`}
                      />
                    </div>
                  </div>
                ))
              )}

            </CardContent>
          </Card>

          {/* Card 3: Hourly Arrival Density LineChart Area */}
          <Card className="bg-slate-950 border border-white/5 rounded-[2.5rem] relative overflow-hidden shadow-2xl">
            <CardHeader className="pb-2 border-b border-white/5">
              <CardTitle className="text-base font-black text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                시간대별 입실 및 출근 집중 밀도
              </CardTitle>
              <CardDescription className="text-slate-400/80 font-medium">당일 오전 시간대별 누적 출근 피크 시간 분포를 제공합니다.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={hourlyData}>
                    <defs>
                      <linearGradient id="colorArrivals" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" stroke="#475569" fontSize={10} tickLine={false} />
                    <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                      labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                      itemStyle={{ color: '#818cf8', fontWeight: 'bold', fontSize: '11px' }}
                    />
                    <Area type="monotone" dataKey="인원" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorArrivals)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[10px] font-bold text-slate-400/60 mt-4 text-center">
                * 위 차트는 출근 시 등록된 기내 단말 및 비콘 수신 시각을 추정해 반영한 시계열 분석입니다.
              </p>
            </CardContent>
          </Card>

        </div>

        {/* Right Column: Attendance Statistics Filters, Search & Workers Feed (lg:col-span-6) */}
        <div className="lg:col-span-6 space-y-6">

          {/* Interactive Statistics Tabs Bar with Live Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-5 bg-slate-950 p-2 border border-white/5 rounded-3xl gap-2 shadow-2xl">
            {[
              { id: 'ALL', label: '전 사원', count: stats.totalCount, color: 'text-slate-300', bg: 'bg-white/5' },
              { id: 'PRESENT', label: '정상출근', count: stats.presentCount, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
              { id: 'LATE', label: '지각', count: stats.lateCount, color: 'text-amber-400', bg: 'bg-amber-500/10' },
              { id: 'LEAVE', label: '휴가자', count: stats.leaveCount, color: 'text-sky-400', bg: 'bg-sky-500/10' },
              { id: 'ABSENT', label: '미출근', count: stats.absentCount, color: 'text-rose-400', bg: 'bg-rose-500/10' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => { playSound('click'); setActiveFilter(tab.id as any); }}
                className={`py-3 px-2 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer ${
                  activeFilter === tab.id 
                    ? `${tab.bg} border border-white/10 ring-1 ring-white/10 scale-102` 
                    : 'hover:bg-white/5 border border-transparent'
                }`}
              >
                <span className={`text-[10px] font-black tracking-wider uppercase mb-1 ${tab.color}`}>{tab.label}</span>
                <span className={`text-2xl font-black ${tab.color}`}>{tab.count}</span>
              </button>
            ))}
          </div>

          {/* Search & Dept Selector bar */}
          <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-950 p-4 border border-white/5 rounded-3xl shadow-2xl">
            <div className="relative w-full group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-teal-400 transition-colors" />
              <Input
                type="text"
                placeholder="성명, 사번, 부서명 검색..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-11 h-12 bg-slate-900 border-none rounded-xl text-xs font-black placeholder-slate-500 focus-visible:ring-1 focus-visible:ring-teal-500 text-white"
              />
            </div>

            <div className="relative w-full sm:w-60 flex items-center bg-slate-900 rounded-xl px-3 border border-transparent focus-within:border-teal-500/30">
              <Filter className="w-4 h-4 text-slate-500 mr-2 shrink-0" />
              <select
                value={selectedDept}
                onChange={e => { playSound('click'); setSelectedDept(e.target.value); }}
                className="w-full h-12 bg-transparent border-none text-xs font-black text-slate-300 focus:outline-none cursor-pointer"
              >
                {departments.map(dept => (
                  <option key={dept} value={dept} className="bg-slate-900 border-none text-white text-xs py-2">
                    {dept === 'ALL' ? '전체 부서 필터' : dept}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Roster & Feed Display */}
          <Card className="bg-slate-950 border border-white/5 p-4 rounded-[2.5rem] shadow-2xl relative">
            <CardHeader className="p-4 border-b border-white/5 flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-black text-white flex items-center gap-2">
                  <HardHat className="w-4 h-4 text-teal-400" />
                  실시간 연동 현장 근무자 리스트
                </CardTitle>
                <CardDescription className="text-xs text-slate-400/80">실시간 조건에 부합하는 사원 {filteredRoster.length}명 검색됨</CardDescription>
              </div>
              <span className="text-[10px] font-black text-slate-400 bg-white/5 py-1 px-3.5 rounded-full">
                이름 역순 정렬 지원
              </span>
            </CardHeader>
            <CardContent className="p-0 overflow-y-auto max-h-[580px] mt-4 space-y-2 pr-1.5 custom-scrollbar">
              {filteredRoster.length === 0 ? (
                <div className="py-16 text-center text-slate-500 font-bold border border-dashed border-white/5 rounded-3xl m-4">
                  <span className="block mb-2 text-slate-400 text-sm">해당 조건의 근로자를 찾을 수 없습니다.</span>
                  <span className="block text-xs text-slate-600">성명 또는 부서 필터를 다시 확인해 주십시오.</span>
                </div>
              ) : (
                filteredRoster.map((user, idx) => {
                  const isAtt = todayAttendance.find(a => a.uid === user.uid);
                  return (
                    <motion.div
                      key={user.uid}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: Math.min(idx * 0.04, 0.4) }}
                      className="group flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-slate-900/40 hover:bg-slate-900 border border-white/5 rounded-2xl gap-3 transition-all hover:border-teal-500/10 cursor-pointer m-2 relative animate-fade-in"
                      onClick={() => {
                        playSound('click');
                        toast.info(`사번: ${user.employeeId || '미배정'} | 부서: ${user.departmentName || '공무부'} | 근태 확인`);
                      }}
                    >
                      {/* Worker info details */}
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm relative ${
                          isAtt?.status === 'PRESENT' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/35' :
                          isAtt?.status === 'LATE' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/35' :
                          'bg-slate-800/50 text-slate-400 border border-white/5'
                        }`}>
                          {user.displayName?.slice(0, 2)}
                          <span className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border border-slate-900 ${
                            user.status === 'ACTIVE' ? 'bg-green-500' : 'bg-red-500'
                          }`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-white group-hover:text-teal-400 transition-colors">
                              {user.displayName}
                            </span>
                            <span className="text-[10px] font-black text-slate-400/80 bg-slate-800 px-2 rounded-full py-0.5 border border-white/5">
                              {user.position || '사원'}
                            </span>
                          </div>
                          <p className="text-[10px] font-bold text-slate-400/60 mt-0.5">
                            사번: {user.employeeId || 'X00000'} | 부서: {user.departmentName || '미지정'}
                          </p>
                        </div>
                      </div>

                      {/* On-duty / Late / Absent interactive tag widget */}
                      <div className="flex items-center gap-3 self-end sm:self-center">
                        <div className="text-right">
                          <p className="text-xs font-black text-slate-300">
                            {isAtt?.clockIn ? `${isAtt.clockIn} 출근` : '미등록'}
                          </p>
                          {isAtt?.clockOut && (
                            <p className="text-[10px] text-slate-400/50 font-medium">퇴근: {isAtt.clockOut}</p>
                          )}
                        </div>
                        <div className={`px-3 py-1.5 rounded-xl text-[10px] font-black border transition-colors ${
                          isAtt?.status === 'PRESENT' ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' :
                          isAtt?.status === 'LATE' ? 'bg-amber-500/10 border-amber-500/25 text-amber-500 animate-pulse' :
                          isAtt?.status === 'LEAVE' ? 'bg-sky-500/10 border-sky-500/25 text-sky-400' :
                          'bg-rose-500/10 border-rose-500/25 text-rose-400'
                        }`}>
                          {isAtt?.status === 'PRESENT' ? '정상 출근' :
                           isAtt?.status === 'LATE' ? '지각' :
                           isAtt?.status === 'LEAVE' ? '휴가/연차' : '미출근'}
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );

  if (isPC) {
    return (
      <PCAdminLayout title="전사 출근 통합관제 대시보드">
        <div className="max-w-[1600px] mx-auto text-foreground">
          {innerContent}
        </div>
      </PCAdminLayout>
    );
  }

  return innerContent;
};
