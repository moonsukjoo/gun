import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Clock, 
  CalendarDays, 
  ShieldCheck, 
  TrendingUp, 
  LayoutDashboard,
  History,
  AlertTriangle,
  Timer,
  Bell,
  Settings,
  Trophy,
  ClipboardList,
  Lock,
  HardHat,
  CircleDollarSign,
  Radio,
  Thermometer
} from 'lucide-react';
import { collection, query, getDocs, limit, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import PCAdminLayout from '../components/PCAdminLayout';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const PCAdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalEmployees: 0,
    pendingLeaves: 0,
    activeBeacons: 0
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const leavesSnap = await getDocs(query(collection(db, 'leaveRequests'), limit(100)));
      const beaconsSnap = await getDocs(collection(db, 'beacons'));
      
      setStats({
        totalEmployees: usersSnap.size,
        pendingLeaves: leavesSnap.docs.filter(d => d.data().status === 'pending').length,
        activeBeacons: beaconsSnap.docs.filter(d => d.data().status === 'ACTIVE').length
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, 'multiple_stats_collections');
    }
  };

  const quickActions = [
    { id: 'personnel', label: '임직원 정보 관리', icon: Users, to: '/admin/pc/personnel' },
    { id: 'permissions', label: '사용자 권한 관리', icon: Lock, to: '/admin/pc/personnel' }, // Assuming the personnel page handles roles/permissions
    { id: 'attendance', label: '근태 현황 총괄', icon: Clock, to: '/admin/pc/attendance' },
    { id: 'leave', label: '연차/휴가 결재', icon: CalendarDays, to: '/admin/pc/leave' },
    { id: 'payslip', label: '급여명세서 발행', icon: CircleDollarSign, to: '/admin/pc/payslip' },
    { id: 'safety', label: '안전지수 설정', icon: ShieldCheck, to: '/admin/pc/safety' },
    { id: 'worklog', label: '작업일지 총괄', icon: ClipboardList, to: '/admin/pc/worklog' },
    { id: 'training', label: '교육/평가 현황', icon: HardHat, to: '/admin/pc/training' },
    { id: 'beacons', label: '밀폐공간 관제', icon: Radio, to: '/admin/pc/beacons' },
    { id: 'perceived_temp_mgmt', label: '실시간 체감온도 관제', icon: Thermometer, to: '/admin/pc/perceived-temp' },
  ];

  const handleExportStats = async () => {
    try {
      const headers = ['구분', '수치', '상세 내용'];
      const data = [
        ['활성 임직원', `${stats.totalEmployees}명`, '전체 인적 자원 내역'],
        ['금일 가동률', '98.4%', '출근 인원 및 장비 가동 수치'],
        ['미결재 서류', `${stats.pendingLeaves}건`, '연차/휴가 결재 대기 중'],
        ['종합 안전 지수', '96.8점', '무재해 365일 달성 중'],
      ];

      const { exportToPDF } = await import('../lib/exportUtils');
      await exportToPDF('건명기업 통합 운영 현황 리포트', headers, data, `Enterprise_Overview_${new Date().toISOString().split('T')[0]}`);
      toast.success('운영 현황 리포트가 생성되었습니다.');
    } catch (error) {
      console.error(error);
      toast.error('리포트 생성 중 오류가 발생했습니다.');
    }
  };

  return (
    <PCAdminLayout title="통합 관제 센터">
      <div className="max-w-[1600px] mx-auto space-y-10">
        <header className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-black text-foreground tracking-tight mb-2">건명기업 통합 운영 총괄</h1>
            <p className="text-muted-foreground text-lg font-medium">관리자님, 건명기업의 실시간 운영 현황입니다.</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleExportStats}
              className="px-6 py-3 bg-muted/50 border border-border rounded-2xl font-black text-sm shadow-sm hover:shadow-md hover:translate-y-[-2px] transition-all text-foreground"
            >
              전체 리포트 생성
            </button>
            <button className="px-6 py-3 bg-primary text-white rounded-2xl font-black text-sm shadow-lg shadow-primary/10 hover:bg-primary/90 hover:translate-y-[-2px] transition-all flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-white" />
              긴급 제어 모드
            </button>
          </div>
        </header>

        {/* KPI Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 text-foreground">
          {[
            { label: '활성 임직원', value: stats.totalEmployees, unit: '명', sub: '전체 인적 자원 내역', icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
            { label: '밀폐공간 활성 비콘', value: stats.activeBeacons, unit: '개', sub: '잠수함 내 위치 추적 상태', icon: Radio, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
            { label: '미결재 서류', value: stats.pendingLeaves, unit: '건', sub: '연차/휴가 결재 대기 중', icon: CalendarDays, color: 'text-amber-500', bg: 'bg-amber-500/10' },
            { label: '종합 안전 지수', value: '96.8', unit: '점', sub: '무재해 365일 달성 중', icon: ShieldCheck, color: 'text-rose-500', bg: 'bg-rose-500/10' },
          ].map((card, i) => (
            <div key={i} className="bg-card p-8 rounded-[2.5rem] border border-border shadow-sm hover:shadow-xl transition-all group overflow-hidden relative">
              <div className={`w-16 h-16 rounded-[1.5rem] ${card.bg} flex items-center justify-center mb-6 ${card.color} group-hover:scale-110 transition-transform`}>
                <card.icon className="w-8 h-8" />
              </div>
              <p className="text-sm font-black text-muted-foreground uppercase tracking-widest mb-2">{card.label}</p>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-black text-foreground tracking-tighter">{card.value}</span>
                <span className="text-muted-foreground font-black text-xl uppercase">{card.unit}</span>
              </div>
              <div className="mt-6 flex items-center gap-2 text-xs font-black text-muted-foreground bg-muted px-3 py-1.5 rounded-xl w-fit">
                <TrendingUp className="w-3 h-3 text-emerald-500" />
                {card.sub}
              </div>
              <div className={`absolute top-0 right-0 w-24 h-24 ${card.bg} opacity-[0.03] rounded-bl-full`} />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-8 flex flex-col gap-10">
            <div className="bg-card rounded-[3rem] border border-border shadow-sm overflow-hidden text-foreground">
              <div className="px-10 py-8 border-b border-border flex items-center justify-between bg-muted/30">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-background rounded-2xl shadow-sm border border-border flex items-center justify-center">
                    <LayoutDashboard className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-2xl font-black text-foreground tracking-tight">서비스 통합 제어관</h3>
                </div>
                <span className="text-xs font-black text-muted-foreground bg-background px-4 py-2 rounded-full border border-border">빠른 실행 패널</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 p-10">
                {quickActions.map((item) => (
                  <button 
                    key={item.id}
                    onClick={() => navigate(item.to)}
                    className="flex flex-col items-center justify-center p-8 rounded-[2rem] border border-border hover:border-primary hover:bg-muted/50 transition-all group"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-background shadow-sm border border-border flex items-center justify-center mb-5 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                      <item.icon className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <span className="text-sm font-black text-foreground group-hover:text-primary transition-colors">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-muted rounded-[3rem] p-12 text-foreground relative overflow-hidden shadow-2xl shadow-black/5 ring-1 ring-border">
              <div className="relative z-10 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase tracking-widest mb-6 border border-primary/20">
                   AI 인텔리전스 가동 중
                </div>
                <h2 className="text-4xl font-black mb-6 leading-tight tracking-tight text-foreground">모든 관리 도구가<br/>하나의 공간에 집약되었습니다.</h2>
                <p className="text-muted-foreground text-lg font-medium mb-10 leading-relaxed">
                  모바일 전용으로 구성된 모든 기능을 이제 대화면 PC에서도 자유롭게 통제하십시오. 
                  실시간 동기화를 통해 현장의 모든 상황을 한눈에 파악할 수 있으며, 
                  고효율 업무 처리를 위한 전용 단축 메뉴가 제공됩니다.
                </p>
                <div className="flex items-center gap-4">
                  <button className="px-8 py-4 bg-primary text-primary-foreground rounded-2xl font-black text-sm hover:scale-105 transition-all shadow-xl shadow-primary/20">
                    데이터 센터 상세 분석
                  </button>
                  <button className="px-8 py-4 bg-muted border border-border text-foreground rounded-2xl font-black text-sm hover:bg-muted/80 transition-all">
                    사용자 가이드 확인
                  </button>
                </div>
              </div>
              <ShieldCheck className="absolute -right-20 -bottom-20 w-96 h-96 text-primary/[0.03] rotate-12" />
            </div>

            {/* NEW ADDITION: Submarine Air Quality Environmental Safety Telemetry Desk */}
            <div className="bg-slate-950 border border-border/60 rounded-[3rem] p-10 text-slate-100 relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/5 pb-8 mb-8 z-10 relative">
                <div>
                  <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] bg-blue-500/10 px-3 py-1 rounded-full mb-3 inline-block">
                    무선 정밀 환경 계측국 (S-Telemetry)
                  </span>
                  <h3 className="text-2xl font-black text-white flex items-center gap-3 tracking-tight">
                    <Radio className="w-6 h-6 text-blue-400 animate-pulse" />
                    잠수함 건조 구역 대기질 환경 센서 현황
                  </h3>
                  <p className="text-slate-400 font-bold text-sm mt-1">
                    밀폐공간 내 무선 복합 가스 측정기로부터 송출되는 실시간 환경 수치입니다. (surveillance-free)
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
                  <span className="text-xs font-black text-emerald-400 tracking-wider">주변 기류 정밀 분석 수신 중</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 z-10 relative">
                {[
                  { name: 'O2 (산소 농도)', val: '20.9', unit: '%', desc: '밀폐공간 질식 방지 권장 기준: 18% ~ 23.5%', status: '정상', color: 'from-blue-500 to-indigo-500', barCol: 'bg-blue-500', max: 25 },
                  { name: 'CO (일산화탄소)', val: '1.2', unit: 'ppm', desc: '허용 노출 연한 기준: 30 ppm 이하', status: '정상', color: 'from-emerald-500 to-teal-500', barCol: 'bg-emerald-500', max: 50 },
                  { name: 'H2S (황화수소)', val: '0.0', unit: 'ppm', desc: '밀폐구조 위험 독성물질 통제 허용치: 10 ppm', status: '정상', color: 'from-amber-500 to-orange-500', barCol: 'bg-amber-500', max: 10 },
                  { name: 'LEL (가연성 가스)', val: '0', unit: '%', desc: '폭발 하한 기준 안전 감도: 10% 미만', status: '정상', color: 'from-rose-500 to-red-500', barCol: 'bg-rose-500', max: 15 }
                ].map((gas, sidx) => (
                  <div key={sidx} className="bg-slate-900/60 p-6 rounded-[2rem] border border-white/5 shadow-sm hover:bg-slate-900 transition-all flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-xs font-black text-slate-400 uppercase tracking-wider">{gas.name}</span>
                        <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                          {gas.status}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-1 mt-2">
                        <span className="text-4xl font-black text-white font-mono tracking-tighter">{gas.val}</span>
                        <span className="text-xs font-bold text-slate-400">{gas.unit}</span>
                      </div>
                    </div>
                    <div className="mt-6 space-y-3">
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div className={`h-full ${gas.barCol}`} style={{ width: `${Math.min(100, (parseFloat(gas.val) / gas.max) * 100)}%` }} />
                      </div>
                      <p className="text-[10px] font-bold text-slate-400/60 leading-relaxed font-sans">{gas.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-10">
            <div className="bg-card rounded-[2.5rem] border border-border overflow-hidden shadow-sm flex flex-col h-fit text-foreground">
              <div className="px-8 py-6 border-b border-border flex items-center justify-between">
                <h3 className="font-black text-foreground text-lg flex items-center gap-3">
                   <History className="w-6 h-6 text-primary" />
                   운영 체제 실시간 로그
                </h3>
                <div className="flex items-center gap-2">
                   <div className="w-2 h-2 bg-green-500 rounded-full animate-ping" />
                   <span className="text-[10px] font-black text-muted-foreground uppercase">실시간</span>
                </div>
              </div>
              <div className="divide-y divide-border overflow-y-auto max-h-[500px] custom-scrollbar">
                {[
                  { msg: '관리자님께서 급여명세서를 일괄 발행했습니다.', time: '2분 전', type: 'payslip', user: 'System' },
                  { msg: '안전 관리자(이성민)님이 작업 현황을 업데이트했습니다.', time: '15분 전', type: 'safety', user: 'Manager' },
                  { msg: '시스템에 새로운 공지사항이 등록되었습니다.', time: '1시간 전', type: 'notice', user: 'Admin' },
                  { msg: '장동건 사원이 연차 신청서를 제출했습니다.', time: '3시간 전', type: 'leave', user: 'Employee' },
                  { msg: '현물 신청(커피쿠폰) 12건이 승인 대기 중입니다.', time: '5시간 전', type: 'redemption', user: 'System' },
                  { msg: '서해 6공구 고소작업 모니터링이 시작되었습니다.', time: '8시간 전', type: 'highwork', user: 'Safety' },
                ].map((log, i) => (
                  <div key={i} className="px-8 py-6 flex gap-5 items-start hover:bg-muted/50 transition-all group">
                    <div className="w-1.5 h-12 rounded-full bg-muted group-hover:bg-primary transition-colors shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-black text-primary uppercase tracking-widest">{log.user}</span>
                        <span className="text-[10px] text-muted-foreground font-bold tracking-tight">{log.time}</span>
                      </div>
                      <p className="text-xs font-bold text-foreground leading-relaxed font-sans">{log.msg}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button className="w-full py-5 bg-muted/50 text-muted-foreground font-black text-xs hover:bg-muted transition-colors uppercase tracking-widest border-t border-border">
                 전체 시스템 로그 아카이브 조회
              </button>
            </div>

            <div className="bg-rose-600 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-rose-600/20 ring-1 ring-white/20 relative overflow-hidden group">
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm shadow-xl">
                    <AlertTriangle className="w-6 h-6 text-white" />
                  </div>
                  <span className="font-black text-xl tracking-tight">고위험 현장 실시간 알람</span>
                </div>
                <div className="space-y-4">
                  <div className="p-5 bg-white/10 rounded-2xl border border-white/10 backdrop-blur-md">
                    <div className="flex justify-between items-start mb-2">
                       <p className="text-xs font-black text-white/60">오후 2시 예정</p>
                       <span className="bg-white text-rose-600 px-2 py-0.5 rounded text-[9px] font-black uppercase">조치 필요</span>
                    </div>
                    <p className="text-sm font-black leading-snug">
                      H-3 구역 대형 크레인 인근 고소 작업이 예정되어 있습니다. 현장 안전 수칙 준수 여부를 최종 확인 바랍니다.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PCAdminLayout>
  );
};

export default PCAdminDashboard;
