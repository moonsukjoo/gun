import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Search, 
  AlertTriangle, 
  Activity, 
  MapPin, 
  Clock, 
  ShieldAlert, 
  ShieldCheck, 
  Users, 
  HardHat,
  ArrowUpRight,
  Zap,
  Radio,
  Signal
} from 'lucide-react';
import { collection, query, getDocs, orderBy, limit, where } from 'firebase/firestore';
import { db } from '../firebase';
import PCAdminLayout from '../components/PCAdminLayout';
import { motion } from 'motion/react';

interface HighWorkGroup {
  id: string;
  section: string;
  leaderName: string;
  membersCount: number;
  altitude: number;
  status: 'critical' | 'warning' | 'stable';
  lastPing: any;
  startTime: string;
}

const PCAdminHighWork: React.FC = () => {
  const [activeGroups, setActiveGroups] = useState<HighWorkGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActiveGroups();
    const interval = setInterval(fetchActiveGroups, 5000); // 5초마다 갱신 (관제센터 컨셉)
    return () => clearInterval(interval);
  }, []);

  const fetchActiveGroups = async () => {
    // In a real app, this would query active sensor data
    setLoading(false);
    // Mocking real-time monitoring data
    setActiveGroups([
      { id: 'g1', section: '서해 6공구 A블럭', leaderName: '장동건', membersCount: 4, altitude: 24.5, status: 'stable', lastPing: new Date(), startTime: '08:00' },
      { id: 'g2', section: '동해 2공구 선실', leaderName: '이순신', membersCount: 2, altitude: 32.1, status: 'warning', lastPing: new Date(), startTime: '09:30' },
      { id: 'g3', section: '남해 4공구 엔진룸', leaderName: '강감찬', membersCount: 3, altitude: 48.9, status: 'critical', lastPing: new Date(), startTime: '10:15' },
      { id: 'g4', section: 'A공구 도장라인', leaderName: '을지문덕', membersCount: 5, altitude: 12.8, status: 'stable', lastPing: new Date(), startTime: '07:45' },
    ]);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical': return 'text-rose-500 bg-rose-100 ring-rose-500/50 shadow-rose-500/20';
      case 'warning': return 'text-amber-500 bg-amber-100 ring-amber-500/50 shadow-amber-500/20';
      default: return 'text-emerald-500 bg-emerald-100 ring-emerald-500/50 shadow-emerald-500/20';
    }
  };

  return (
    <PCAdminLayout title="고소작업 실시간 관제">
      <div className="max-w-[1700px] mx-auto space-y-10">
        <header className="flex justify-between items-end">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
               <div className="w-3 h-3 bg-rose-600 rounded-full animate-ping" />
               <h2 className="text-3xl font-black text-foreground tracking-tight uppercase tracking-tighter">Real-time High-Altitude Monitoring</h2>
            </div>
            <p className="text-muted-foreground font-medium italic">현재 모든 고공 작업 현장의 센서 데이터를 실시간으로 수집하고 있습니다.</p>
          </div>
          <div className="flex items-center gap-6 bg-slate-900 px-8 py-5 rounded-[2.5rem] shadow-2xl">
             <div className="flex items-center gap-3 pr-6 border-r border-slate-800">
                <Radio className="w-5 h-5 text-emerald-500 animate-pulse" />
                <span className="text-xs font-black text-white uppercase tracking-widest leading-none">System Status: Active</span>
             </div>
             <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-blue-400" />
                <span className="text-xs font-black text-white">Monitoring: 14 Workers</span>
             </div>
          </div>
        </header>

        {/* Global Alert if critical */}
        <div className="bg-rose-600 p-8 rounded-[2.5rem] text-white flex items-center justify-between shadow-2xl shadow-rose-600/30 overflow-hidden relative group">
           <div className="flex items-center gap-8 relative z-10">
              <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center border border-white/20">
                 <ShieldAlert className="w-12 h-12 text-white animate-bounce" />
              </div>
              <div className="space-y-2">
                 <h3 className="text-3xl font-black tracking-tight">CRITICAL ALERT: 남해 4공구 엔진룸</h3>
                 <p className="text-rose-100 font-medium">강감찬 팀장의 고도 센서 주위 풍속이 위험 수치(15m/s)를 감지했습니다. 즉시 연락 바랍니다.</p>
              </div>
           </div>
           <button className="px-10 py-5 bg-white text-rose-600 rounded-2xl font-black text-sm relative z-10 hover:bg-rose-50 transition-all shadow-xl">
              긴급 사이렌 가동
           </button>
           <Zap className="absolute -right-10 -bottom-10 w-64 h-64 text-white/5 rotate-12" />
        </div>

        {/* Monitoring Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
           {activeGroups.map((group) => (
             <motion.div 
               layout
               key={group.id} 
               className="bg-white border border-slate-200 rounded-[3rem] p-10 shadow-sm hover:shadow-2xl transition-all relative group"
             >
                <div className="flex justify-between items-start mb-8">
                   <div className="flex items-center gap-2">
                      <Signal className="w-4 h-4 text-blue-400 animate-pulse" />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Section {group.id.toUpperCase()}</span>
                   </div>
                   <div className={`px-4 py-1.5 rounded-full ring-4 ring-offset-0 ${getStatusColor(group.status)}`}>
                      <span className="text-[10px] font-black uppercase tracking-tighter">{group.status}</span>
                   </div>
                </div>

                <div className="space-y-6">
                   <div>
                      <h4 className="text-2xl font-black text-slate-900 tracking-tight leading-tight mb-2">{group.section}</h4>
                      <div className="flex items-center gap-2 text-xs font-black text-blue-600">
                         <MapPin className="w-3 h-3" />
                         {group.leaderName} 팀장 외 {group.membersCount}명
                      </div>
                   </div>

                   <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                      <div className="flex justify-between items-end mb-4">
                         <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Current Altitude</span>
                         <span className={`text-4xl font-black tracking-tighter ${group.status === 'critical' ? 'text-rose-600' : 'text-slate-900'}`}>
                            {group.altitude}m
                         </span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                         <div 
                           className={`h-full transition-all duration-1000 rounded-full ${
                             group.status === 'critical' ? 'bg-rose-500' : group.status === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'
                           }`} 
                           style={{ width: `${Math.min((group.altitude / 60) * 100, 100)}%` }} 
                         />
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1 p-4 bg-slate-50/50 rounded-2xl">
                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Start Time</span>
                         <span className="text-sm font-black text-slate-800">{group.startTime} AM</span>
                      </div>
                      <div className="flex flex-col gap-1 p-4 bg-slate-50/50 rounded-2xl">
                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Heartbeat</span>
                         <span className="text-sm font-black text-slate-800 italic">Connected</span>
                      </div>
                   </div>
                </div>

                <button className="w-full mt-8 py-5 bg-slate-900 text-white rounded-[1.5rem] font-black text-xs hover:bg-blue-600 transition-all flex items-center justify-center gap-3 group-hover:scale-[1.02] active:scale-95 shadow-xl shadow-slate-900/5">
                   <Radio className="w-4 h-4" />
                   실시간 통신 연결
                </button>

                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-[3rem]" />
             </motion.div>
           ))}
        </div>

        {/* Global Log Container */}
        <div className="bg-slate-900 rounded-[3rem] border border-slate-800 overflow-hidden shadow-2xl">
           <div className="px-10 py-8 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-4">
                 <Activity className="w-6 h-6 text-emerald-500" />
                 <h3 className="text-xl font-black text-white tracking-tight">System High-Altitude Activity Feed</h3>
              </div>
              <button className="px-5 py-2 bg-slate-800 text-slate-400 rounded-full text-[10px] font-black uppercase tracing-widest border border-slate-700 hover:text-white transition-all">
                 View Historical Analytics
              </button>
           </div>
           <div className="p-4 overflow-y-auto max-h-[300px] font-mono">
              {[
                { time: '14:22:15', msg: '남해 4공구 엔진룸: 센서 보정 완료. 고도 48.9m 안정화 시도.', type: 'info' },
                { time: '14:21:40', msg: '동해 2공구 선실: 이순신 님 안전밸트 고정 신호 수신.', type: 'success' },
                { time: '14:20:05', msg: '서해 6공구 A블럭: 장동건 팀 금일 2차 고소작업 개시 보고.', type: 'info' },
                { time: '14:18:50', msg: '시스템 알람: 전체 구역 통신 감도 체크... [정상]', type: 'system' },
                { time: '14:15:22', msg: '경고: 풍속 12m/s 초과 감지. 모든 야외 고소작업 예의주시 요망.', type: 'warning' },
              ].map((log, i) => (
                <div key={i} className="px-6 py-3 flex items-start gap-6 hover:bg-white/5 transition-all text-sm leading-relaxed border-b border-white/5 last:border-none">
                   <span className="text-slate-500 font-black shrink-0">{log.time}</span>
                   <span className={`font-medium ${log.type === 'warning' ? 'text-amber-400' : log.type === 'success' ? 'text-emerald-400' : 'text-slate-300'}`}>
                      {log.type === 'warning' && ' [WARNING] '}
                      {log.msg}
                   </span>
                </div>
              ))}
           </div>
        </div>
      </div>
    </PCAdminLayout>
  );
};

export default PCAdminHighWork;
