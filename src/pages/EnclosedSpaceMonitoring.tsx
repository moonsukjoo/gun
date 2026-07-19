import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, where, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../components/AuthProvider';
import { 
  Radio, 
  User, 
  MapPin, 
  AlertTriangle, 
  Activity, 
  ChevronRight,
  Waves,
  Clock,
  ShieldCheck,
  Search
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

interface Beacon {
  id: string;
  name: string;
  submarineName: string;
  location: string;
  order: number;
  status: string;
}

interface BeaconLog {
  id: string;
  beaconId: string;
  beaconLocation: string;
  uid: string;
  userName: string;
  rssi: number;
  detectedAt: string;
}

import { handleFirestoreError, OperationType } from '../lib/errorHandlers';

const EnclosedSpaceMonitoring: React.FC = () => {
  const { profile } = useAuth();
  const [beacons, setBeacons] = useState<Beacon[]>([]);
  const [logs, setLogs] = useState<BeaconLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // 비콘 인프라 정보 조회
    const bQuery = query(collection(db, 'beacons'), orderBy('order', 'asc'));
    const unsubscribeBeacons = onSnapshot(bQuery, (snap) => {
      setBeacons(snap.docs.map(d => d.data() as Beacon));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'beacons');
    });

    // 실시간 로그 조회 (최근 100개)
    const lQuery = query(collection(db, 'beaconLogs'), orderBy('detectedAt', 'desc'), limit(100));
    const unsubscribeLogs = onSnapshot(lQuery, (snap) => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as BeaconLog)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'beaconLogs');
    });

    return () => {
      unsubscribeBeacons();
      unsubscribeLogs();
    };
  }, []);

  // 함체별로 데이터 그룹화
  const submarines = Array.from(new Set(beacons.map(b => b.submarineName)));
  
  // 특정 작업자의 최신 위치 찾기
  const getLatestPosition = (uid: string) => {
    return logs.find(l => l.uid === uid);
  };

  // 현재 함체 내에 있는 고유 작업자 목록 추출
  const activeWorkers = Array.from(new Set(logs.map(l => l.uid))).map(uid => {
    const latest = logs.find(l => l.uid === uid);
    return latest;
  }).filter(Boolean) as BeaconLog[];

  // Safe date formatting helper to avoid fatal RangeError crash
  const safeFormatTime = (dateStr: any, pattern: string = 'HH:mm:ss') => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'N/A';
      return format(d, pattern);
    } catch (e) {
      return 'N/A';
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-24 font-sans">
      {/* Header */}
      <header className="p-6 pt-12 bg-muted/30 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-6 bg-blue-500 rounded-full" />
            <h1 className="text-2xl font-black tracking-tight">밀폐공간 실시간 관제</h1>
          </div>
          <div className="flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">실시간</span>
          </div>
        </div>
        <p className="text-muted-foreground font-bold text-sm">잠수함 내부 작업자 위치 및 안전 상태</p>
      </header>

      <div className="px-6 space-y-6">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
          <input 
            type="text" 
            placeholder="작업자 이름 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-14 bg-muted border border-border rounded-2xl pl-12 pr-4 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-foreground"
          />
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted p-5 rounded-[2rem] border border-border">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">현재 작업 인원</p>
            <p className="text-2xl font-black text-foreground">{activeWorkers.length}명</p>
          </div>
          <div className="bg-rose-500/10 p-5 rounded-[2rem] border border-rose-500/20">
            <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">위험 감지</p>
            <p className="text-2xl font-black text-rose-500">0건</p>
          </div>
        </div>

        {/* Submarine List */}
        {submarines.map((subName) => (
          <div key={subName} className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <Waves className="w-5 h-5 text-blue-400" />
                <h3 className="font-black text-lg">{subName}</h3>
              </div>
            </div>

            <div className="space-y-3">
              {activeWorkers
                .filter(w => beacons.find(b => b.id === w.beaconId)?.submarineName === subName)
                .filter(w => w.userName.includes(searchTerm))
                .map((worker) => (
                <motion.div 
                  layout
                  key={worker.uid}
                  className="bg-card p-5 rounded-[2.5rem] border border-border shadow-xl relative overflow-hidden"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary font-black text-xl">
                        {worker.userName.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-black text-foreground">{worker.userName}</h4>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground mt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>{safeFormatTime(worker.detectedAt, 'HH:mm:ss')} 감지</span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-[10px] font-black text-emerald-500">안전</span>
                    </div>
                  </div>

                  {/* Route Visualizer */}
                  <div className="relative pt-6">
                    <div className="absolute top-[34px] left-0 right-0 h-0.5 bg-muted" />
                    <div className="flex justify-between relative z-10">
                      {beacons
                        .filter(b => b.submarineName === subName)
                        .sort((a,b) => a.order - b.order)
                        .map((b) => {
                          const isHere = worker.beaconId === b.id;
                          return (
                            <div key={b.id} className="flex flex-col items-center gap-2">
                              <div className={cn(
                                "w-4 h-4 rounded-full border-2 transition-all duration-500 transform",
                                isHere ? "bg-blue-500 border-foreground scale-125 shadow-[0_0_10px_rgba(59,130,246,0.8)]" : "bg-muted border-border"
                              )} />
                              <span className={cn(
                                "text-[8px] font-black uppercase tracking-tighter text-center max-w-[40px] leading-tight",
                                isHere ? "text-blue-500" : "text-muted-foreground/60"
                              )}>
                                {b.location}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* Intensity Overlay */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500 rounded-full blur-[60px] opacity-[0.03]" />
                </motion.div>
              ))}

              {activeWorkers.length === 0 && (
                <div className="py-20 text-center bg-muted/30 rounded-[2.5rem] border border-dashed border-border">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <Activity className="w-8 h-8 text-muted-foreground/20" />
                  </div>
                  <p className="text-muted-foreground font-bold text-sm">현재 탐지된 작업자가 없습니다.</p>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Emergency Alert Section */}
        <section className="mt-8 space-y-4">
          <div className="flex items-center gap-2 px-2">
            <AlertTriangle className="w-5 h-5 text-rose-500" />
            <h3 className="font-black text-lg">보안 및 이상 징후</h3>
          </div>
          <div className="bg-rose-500/5 p-6 rounded-[2.5rem] border border-rose-500/10 flex items-center justify-between group active:scale-95 transition-all">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-rose-500/10 rounded-2xl flex items-center justify-center">
                <Radio className="w-6 h-6 text-rose-500" />
              </div>
              <div>
                <h4 className="font-black text-sm text-rose-200">미등록 비콘 신호 감지</h4>
                <p className="text-[10px] font-bold text-rose-500/60 uppercase tracking-widest mt-0.5">외부 신호가 감지되었습니다</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-rose-500/30" />
          </div>
        </section>
      </div>

      {/* Floating Action Button (Admin ONLY) */}
      <div className="fixed bottom-28 right-6">
        <button 
           onClick={() => window.location.href = '/admin/pc/beacons'}
           className="w-16 h-16 bg-indigo-600 rounded-2xl shadow-2xl shadow-indigo-600/40 flex items-center justify-center text-white border-t border-white/20 active:scale-90 transition-all"
        >
          <Radio className="w-8 h-8" />
        </button>
      </div>
    </div>
  );
};

export default EnclosedSpaceMonitoring;
