import React, { useState, useEffect, useRef } from 'react';
import { collection, query, getDocs, addDoc, deleteDoc, doc, updateDoc, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../firebase';
import PCAdminLayout from '../components/PCAdminLayout';
import { 
  Radio, 
  Plus, 
  Trash2, 
  Edit2, 
  AlertCircle, 
  CheckCircle2, 
  Waves,
  MapPin,
  ArrowRight,
  Battery,
  User,
  History,
  Settings,
  Play,
  Square,
  RotateCcw,
  Sparkles,
  Cpu,
  Layers,
  Loader2,
  ShieldAlert,
  Clock,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

interface Beacon {
  id: string;
  docId: string;
  name: string;
  submarineName: string;
  location: string;
  order: number;
  status: 'ACTIVE' | 'INACTIVE' | 'ERROR';
  batteryLevel: number;
  lastSeenAt?: string;
  createdAt: string;
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

const PCAdminBeacons: React.FC = () => {
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

  const [beacons, setBeacons] = useState<Beacon[]>([]);
  const [logs, setLogs] = useState<BeaconLog[]>([]);
  const [activeTab, setActiveTab] = useState<'infrastructure' | 'rules' | 'monitoring'>('infrastructure');
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Intelligent simulation settings
  const [isGenerating, setIsGenerating] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [selectedSubMonitor, setSelectedSubMonitor] = useState('건명-701함');
  const [simWorkers, setSimWorkers] = useState<Record<string, { beaconIndex: number; subIndex: number }>>({});
  const simIntervalRef = useRef<any>(null);

  const [newBeacon, setNewBeacon] = useState({
    id: '',
    name: '',
    submarineName: '',
    location: '',
    order: 1
  });

  const [rules, setRules] = useState([
    { id: 1, name: '장기 체류 알림', description: '동일 지점 30분 이상 체류 시 관리자 호출', enabled: true, threshold: 30, unit: 'min' },
    { id: 2, name: '심박수/자세 동시 모니터링', description: '비콘 신호와 스마트워치 생체 데이터 연동', enabled: true },
    { id: 3, name: '비정상 경로 진입', description: '설정된 순서 외 비정상 진입 시 경보', enabled: false },
    { id: 4, name: '배터리 부족 알림', description: '비콘 배터리 10% 미만 시 교체 알림', enabled: true, threshold: 10, unit: '%' },
  ]);

  useEffect(() => {
    const q = query(collection(db, 'beacons'), orderBy('submarineName'), orderBy('order'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ ...doc.data(), docId: doc.id } as Beacon));
      setBeacons(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'beacons');
    });

    const lq = query(collection(db, 'beaconLogs'), orderBy('detectedAt', 'desc'), limit(50));
    const unsubscribeLogs = onSnapshot(lq, (snap) => {
      const data = snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as BeaconLog));
      setLogs(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'beaconLogs');
    });

    return () => {
      unsubscribe();
      unsubscribeLogs();
    };
  }, []);

  // Deploy 30 Simulated Beacons Bulk
  const handleGenerateSimulatedData = async () => {
    setIsGenerating(true);
    try {
      // Clean previous
      const bSnap = await getDocs(collection(db, 'beacons'));
      for (const d of bSnap.docs) {
        await deleteDoc(doc(db, 'beacons', d.id));
      }

      const subs = ["건명-701함", "건명-702함", "건명-703함"];
      const locations = [
        { name: "수밀 도어 해치 입구 🚪", idSuffix: "HATCH" },
        { name: "진입용 수직 메커니컬 사다리 🪜", idSuffix: "LADR" },
        { name: "제1갑판 기기 우회 통로 🕳️", idSuffix: "PASS1" },
        { name: "배관 정비 및 보조 보일러실 ⚙️", idSuffix: "BOIL" },
        { name: "고압 밀폐 밸브 탱크 챔버 🛢️", idSuffix: "TANK" },
        { name: "메인 추진 동력 디젤 격실 🎰", idSuffix: "ENGN" },
        { name: "함중 전기 배선 중앙 타수실 🔌", idSuffix: "ELEC" },
        { name: "산소 결핍 주의 내벽 코팅 구역 🎨", idSuffix: "COAT" },
        { name: "용접 마감 격벽 샌드블라스트 🩹", idSuffix: "WELD" },
        { name: "종단 안전 비상 대피 격실 🛡️", idSuffix: "ESCP" }
      ];

      let count = 0;
      for (const sub of subs) {
        for (let i = 0; i < locations.length; i++) {
          const order = i + 1;
          const subIdx = subs.indexOf(sub) + 1;
          const beaconId = `KB-0${subIdx}-${order.toString().padStart(2, '0')}-${locations[i].idSuffix}`;
          const name = `${sub} 비콘 ${order}`;

          await addDoc(collection(db, 'beacons'), {
            id: beaconId,
            name: name,
            submarineName: sub,
            location: locations[i].name,
            order: order,
            status: 'ACTIVE',
            batteryLevel: Math.floor(Math.random() * 20) + 80,
            createdAt: new Date().toISOString()
          });
          count++;
        }
      }
      toast.success(`3개 잠수함 구역에 총 ${count}개의 블루투스 비콘 인프라가 임베디드 완성되었습니다!`);
    } catch (err) {
      console.error(err);
      toast.error("비콘 벌크 인프라 생성 중 에러가 발생했습니다.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Reset database values
  const handleClearAllBeaconsAndLogs = async () => {
    if (!window.confirm("주의: 모든 비콘 인프라 및 실시간 신호 로그를 영구히 초기화하겠습니까?")) return;
    setIsClearing(true);
    setIsSimulating(false);
    try {
      const bSnap = await getDocs(collection(db, 'beacons'));
      for (const d of bSnap.docs) {
        await deleteDoc(doc(db, 'beacons', d.id));
      }
      const lSnap = await getDocs(collection(db, 'beaconLogs'));
      for (const d of lSnap.docs) {
        await deleteDoc(doc(db, 'beaconLogs', d.id));
      }
      toast.success("블루투스 비콘 데이터 정밀 삭제가 완료되었습니다.");
    } catch (err) {
      console.error(err);
      toast.error("데이터 삭제 도중 실패가 발생했습니다.");
    } finally {
      setIsClearing(false);
    }
  };

  const workersList = [
    "김동건", "이만용", "박태준", "최현수", "정기선", "고영태", "안미정", "황선우", "도강석", "조수명"
  ];

  // Start movement simulator
  const startWorkerMovementSimulation = () => {
    if (isSimulating) {
      setIsSimulating(false);
      toast.info("실시간 모의 이동 검출이 비활성화되었습니다.");
      return;
    }

    if (beacons.length === 0) {
      toast.error("비콘 인프라가 미수립된 상태입니다. '30개 가상 비콘 즉시 구축'을 우선 완성하세요.");
      return;
    }

    setIsSimulating(true);
    toast.success("무선 스마트밴드 연동 작업자 시뮬레이션이 활성화되었습니다!");

    const initialPositions: Record<string, { beaconIndex: number; subIndex: number }> = {};
    workersList.forEach((worker) => {
      initialPositions[worker] = {
        beaconIndex: Math.floor(Math.random() * 4), 
        subIndex: Math.floor(Math.random() * 3) 
      };
    });
    setSimWorkers(initialPositions);
  };

  useEffect(() => {
    if (isSimulating && beacons.length > 0) {
      const subs = ["건명-701함", "건명-702함", "건명-703함"];
      
      const interval = setInterval(async () => {
        const workersToMove = [...workersList].sort(() => 0.5 - Math.random()).slice(0, 3);

        for (const workerName of workersToMove) {
          setSimWorkers((prev) => {
            const current = prev[workerName] || { beaconIndex: 0, subIndex: 0 };
            const subName = subs[current.subIndex];
            const subBeacons = beacons.filter(b => b.submarineName === subName).sort((a,b) => a.order - b.order);

            if (subBeacons.length === 0) return prev;

            let nextIndex = current.beaconIndex;
            const direction = Math.random() > 0.45 ? 1 : -1;
            nextIndex += direction;

            if (nextIndex >= subBeacons.length) nextIndex = subBeacons.length - 1;
            if (nextIndex < 0) nextIndex = 0;

            const targetBeacon = subBeacons[nextIndex];

            // Append live telemetry trace in db
            addDoc(collection(db, 'beaconLogs'), {
              beaconId: targetBeacon.id,
              beaconLocation: targetBeacon.location,
              uid: `sim_worker_${workerName.replace(/\s+/g, '')}`,
              userName: workerName,
              rssi: Math.floor(Math.random() * 25) - 62,
              detectedAt: new Date().toISOString()
            }).catch(e => console.error(e));

            return {
              ...prev,
              [workerName]: { ...current, beaconIndex: nextIndex }
            };
          });
        }
      }, 4000);

      simIntervalRef.current = interval;
    } else {
      if (simIntervalRef.current) {
        clearInterval(simIntervalRef.current);
      }
    }

    return () => {
      if (simIntervalRef.current) {
        clearInterval(simIntervalRef.current);
      }
    };
  }, [isSimulating, beacons]);

  const handleAddBeacon = async () => {
    if (!newBeacon.id || !newBeacon.submarineName || !newBeacon.location) {
      toast.error('모든 필드를 입력해 주세요.');
      return;
    }

    try {
      await addDoc(collection(db, 'beacons'), {
        ...newBeacon,
        status: 'ACTIVE',
        batteryLevel: 100,
        createdAt: new Date().toISOString()
      });
      toast.success('비콘이 성공적으로 등록되었습니다.');
      setShowAddModal(false);
      setNewBeacon({ id: '', name: '', submarineName: '', location: '', order: beacons.length + 1 });
    } catch (e) {
      console.error(e);
      toast.error('비콘 등록 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteBeacon = async (docId: string) => {
    if (!window.confirm('이 비콘을 삭제하시겠습니까?')) return;
    try {
      await deleteDoc(doc(db, 'beacons', docId));
      toast.success('비콘이 삭제되었습니다.');
    } catch (e) {
      toast.error('삭제 중 오류가 발생했습니다.');
    }
  };

  const groupedBeacons = beacons.reduce((acc, beacon) => {
    if (!acc[beacon.submarineName]) acc[beacon.submarineName] = [];
    acc[beacon.submarineName].push(beacon);
    return acc;
  }, {} as Record<string, Beacon[]>);

  // Parse list of live workers inside selected submarine
  const getSubmarineActiveWorkers = (subName: string) => {
    const workerLatestLogMap: Record<string, BeaconLog> = {};
    const sortedLogs = [...logs].reverse();
    
    sortedLogs.forEach(log => {
      const b = beacons.find(beacon => beacon.id === log.beaconId);
      if (b && b.submarineName === subName) {
        workerLatestLogMap[log.uid] = log;
      }
    });

    return Object.values(workerLatestLogMap);
  };

  return (
    <PCAdminLayout title="밀폐공간 위치관제 (비콘 관리)">
      <div className="max-w-[1600px] mx-auto space-y-8">
        
        {/* S-Simulator Intelligent Control Center Ribbon */}
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5 md:p-8 text-slate-100 flex flex-col lg:flex-row items-center justify-between gap-6 shadow-2xl relative overflow-hidden transition-all hover:border-slate-700/80">
          <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-5">
            <div className="w-12 h-12 md:w-14 md:h-14 bg-indigo-505/20 rounded-[1.25rem] flex items-center justify-center text-indigo-400 shrink-0 shadow-lg shadow-indigo-950/20 border border-indigo-500/10">
              <Cpu className="w-6 h-6 md:w-7 md:h-7" />
            </div>
            <div>
              <div className="flex flex-wrap justify-center sm:justify-start items-center gap-2">
                <span className="text-[9px] font-black text-amber-400 uppercase tracking-[0.2em] bg-amber-500/10 px-2 py-0.5 rounded-full mb-1">SIMULATOR ENG.</span>
                <span className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em] bg-indigo-500/10 px-2 py-0.5 rounded-full mb-1">VER 1.2.9</span>
              </div>
              <h3 className="text-base md:text-lg font-black text-white flex items-center justify-center sm:justify-start gap-1.5 break-keep">
                <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
                지능형 밀폐공간 위치관제 시뮬레이터 (S-Simulator)
              </h3>
              <p className="text-slate-400 font-semibold text-[11px] md:text-xs mt-1 break-keep">
                실제 무선 스마트밴드나 블루투스 하드웨어 비콘이 없어도 수집국과 가상 근로자 이동 로그를 실시간 구축-연계하는 장치입니다.
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-3 shrink-0 w-full lg:w-auto">
            {beacons.length < 30 ? (
              <button
                onClick={handleGenerateSimulatedData}
                disabled={isGenerating}
                className="flex-1 lg:flex-initial px-5 py-3 md:px-6 md:py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs shadow-lg shadow-emerald-950/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap"
              >
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4 shrink-0" />}
                30개 가상 비콘 즉시 구축
              </button>
            ) : (
              <button
                onClick={handleClearAllBeaconsAndLogs}
                disabled={isClearing}
                className="flex-1 lg:flex-initial px-5 py-3 md:px-6 md:py-4 bg-slate-900 hover:bg-slate-800 text-rose-450 border border-slate-800 rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 shadow-md whitespace-nowrap"
              >
                {isClearing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4 shrink-0" />}
                시뮬레이션 데이터 완전 초기화
              </button>
            )}

            {beacons.length >= 30 && (
              <button
                onClick={startWorkerMovementSimulation}
                className={`flex-1 lg:flex-initial px-5 py-3 md:px-6 md:py-4 rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xl whitespace-nowrap ${
                  isSimulating
                    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-950/20'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-950/20'
                }`}
              >
                {isSimulating ? (
                  <>
                    <Square className="w-4 h-4 fill-white text-white shrink-0" />
                    작업자 이동 중지
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white text-white shrink-0" />
                    실시간 작업 탐지 구동
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <h2 className="text-2xl md:text-3xl font-black text-foreground tracking-tight">스마트 비콘 시스템 설정</h2>
            <p className="text-muted-foreground font-bold text-sm md:text-base break-keep">잠수함 내부 밀폐공간 위치 추적을 위한 블루투스 비콘 인프라를 관리합니다. (surveillance-free)</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto no-scrollbar">
                <button 
                  onClick={() => setActiveTab('infrastructure')}
                  className={`px-4 md:px-6 py-2 rounded-xl font-black text-xs whitespace-nowrap transition-all ${activeTab === 'infrastructure' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  비콘 인프라
                </button>
                <button 
                  onClick={() => setActiveTab('rules')}
                  className={`px-4 md:px-6 py-2 rounded-xl font-black text-xs whitespace-nowrap transition-all ${activeTab === 'rules' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  안전 로직 설정
                </button>
                <button 
                  onClick={() => setActiveTab('monitoring')}
                  className={`px-4 md:px-6 py-2 rounded-xl font-black text-xs whitespace-nowrap transition-all ${activeTab === 'monitoring' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  실시간 위치 관제
                </button>
            </div>
            {activeTab === 'infrastructure' && (
              <button 
                onClick={() => setShowAddModal(true)}
                className="px-6 py-3.5 bg-indigo-600 text-white rounded-2xl font-black text-xs md:text-sm flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-95 whitespace-nowrap"
              >
                <Plus className="w-4 h-4 animate-pulse" />
                신규 비콘 등록
              </button>
            )}
          </div>
        </div>

        {activeTab === 'infrastructure' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main List Area */}
            <div className="lg:col-span-2 space-y-6">
              {Object.keys(groupedBeacons).length === 0 ? (
                <div className="bg-card rounded-3xl p-10 md:p-20 border border-border border-dashed flex flex-col items-center justify-center text-center">
                   <div className="w-20 h-20 bg-muted/60 rounded-2xl flex items-center justify-center mb-6 text-indigo-400 border border-border">
                      <Radio className="w-10 h-10 animate-bounce" />
                   </div>
                   <h3 className="text-lg font-black text-foreground break-keep">등록된 비콘 수집 지점이 없습니다.</h3>
                   <p className="text-slate-450 mt-2 mb-6 text-xs font-semibold break-keep">수동으로 신규 비콘을 생성하거나 지능형 S-Simulator 벌크 옵션을 사용해보세요.</p>
                   <button
                     onClick={handleGenerateSimulatedData}
                     disabled={isGenerating}
                     className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs flex items-center gap-2 shadow-xl shadow-emerald-600/15"
                   >
                     {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
                     30개 가상 비콘 즉시 일괄 생성
                   </button>
                </div>
              ) : (
                Object.entries(groupedBeacons).map(([submarine, submarineBeacons]) => (
                  <div key={submarine} className="bg-card rounded-3xl p-5 md:p-8 border border-border shadow-sm transition-all hover:border-blue-500/30">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-border">
                      <div className="flex items-center gap-3 md:gap-4">
                        <div className="w-10 h-10 md:w-12 md:h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400 shrink-0">
                          <Waves className="w-6 h-6 md:w-7 md:h-7" />
                        </div>
                        <div>
                          <h3 className="text-lg md:text-xl font-black text-foreground leading-tight">{submarine}</h3>
                          <p className="text-muted-foreground font-bold text-xs">임계 영역 {submarineBeacons.length}개의 수집 지점</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-black text-indigo-400 bg-indigo-500/10 px-3.5 py-1.5 rounded-full border border-indigo-500/20 self-start sm:self-auto whitespace-nowrap">운영 중</span>
                    </div>

                    <div className="space-y-3">
                      {submarineBeacons.sort((a,b) => a.order - b.order).map((beacon, idx) => (
                        <div key={beacon.docId} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 p-4 md:p-5 bg-muted rounded-2xl border border-border/40 group hover:border-blue-500/40 hover:bg-blue-500/5 transition-all relative">
                          
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-card rounded-xl flex items-center justify-center font-black text-muted-foreground border border-border shadow-sm group-hover:text-blue-400 group-hover:border-blue-500/30 shrink-0 transition-all text-sm">
                              {beacon.order}
                            </div>
                            <div className="sm:hidden flex-1 min-w-0">
                              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">수집 구역명</p>
                              <p className="font-black text-foreground flex items-center gap-1.5 text-sm break-keep">
                                <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                {beacon.location}
                              </p>
                            </div>
                          </div>

                          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
                            <div className="hidden sm:block">
                              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">수집 구역명</p>
                              <p className="font-black text-foreground flex items-center gap-1.5 text-xs md:text-sm break-keep">
                                <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 align-middle" />
                                <span className="align-middle text-foreground">{beacon.location}</span>
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">수집 노드 ID</p>
                              <p className="font-mono text-xs font-bold text-muted-foreground bg-card px-2.5 py-1 rounded-lg border border-border w-fit truncate max-w-full">{beacon.id}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">송신기 상태</p>
                              <div className="flex items-center gap-2">
                                {beacon.status === 'ACTIVE' ? (
                                  <span className="flex items-center gap-1 text-[11px] font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 whitespace-nowrap">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> 정상 작동
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1 text-[11px] font-black text-rose-455 bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/20 whitespace-nowrap">
                                    <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" /> 장애 유실
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2.5">
                               <Battery className={`w-5 h-5 shrink-0 ${beacon.batteryLevel < 20 ? 'text-rose-500 animate-pulse' : 'text-emerald-400'}`} />
                               <span className="text-xs font-black text-foreground whitespace-nowrap">{beacon.batteryLevel}%</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-2 mt-4 sm:mt-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-border sm:opacity-0 sm:group-hover:opacity-100 transition-all">
                            <button className="p-2.5 bg-muted text-muted-foreground border border-border rounded-xl hover:text-blue-400 hover:border-blue-550 transition-all shadow-sm">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => handleDeleteBeacon(beacon.docId)}
                              className="p-2.5 bg-muted text-muted-foreground border border-border rounded-xl hover:text-rose-400 hover:border-rose-550 transition-all shadow-sm"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Visual Route Indicator */}
                    <div className="mt-8 p-4 bg-slate-900 rounded-2xl flex items-center gap-4 overflow-x-auto no-scrollbar shadow-xl border border-slate-800">
                      <span className="shrink-0 text-[9px] font-black text-blue-500 uppercase tracking-widest px-3 border-r border-slate-700 whitespace-nowrap">인프라 트랙 링크</span>
                      {submarineBeacons.sort((a,b) => a.order - b.order).map((b, i) => (
                        <React.Fragment key={b.docId}>
                          <div className="flex flex-col items-center shrink-0">
                            <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-[9px] font-black text-white border border-slate-700">
                              {b.order}
                            </div>
                            <span className="text-[9px] font-bold text-slate-400 mt-1 whitespace-nowrap break-keep">{b.location}</span>
                          </div>
                          {i < submarineBeacons.length - 1 && <ArrowRight className="w-3 h-3 text-slate-700 shrink-0" />}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Real-time Side Log Area */}
            <div className="space-y-8">
              <div className="bg-card rounded-[3rem] p-10 border border-border shadow-sm flex flex-col h-[800px]">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400">
                      <History className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-foreground tracking-tight">수신 실시간 로그</h3>
                      <p className="text-[10px] font-bold text-muted-foreground mt-0.5">블루투스 단말 신호 검출 현황</p>
                    </div>
                  </div>
                  <span className="flex items-center gap-1 text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-505">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" /> 실시간 수신 중
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar no-scrollbar">
                  {logs.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center py-20">
                      <History className="w-10 h-10 text-muted-foreground mb-4" />
                      <p className="text-sm font-bold text-muted-foreground">현재 감지된 신호가 없습니다.</p>
                      <p className="text-xs text-muted-foreground/80 mt-1.5">상단 시뮬레이터를 켜시면 가상 로그가 수집됩니다.</p>
                    </div>
                  ) : (
                    logs.map((log) => (
                      <div key={log.id} className="p-5 bg-muted rounded-2xl border border-border/40 space-y-3 relative overflow-hidden group hover:border-blue-500/40 transition-all hover:bg-card">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2.5">
                             <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center shadow-sm text-white font-black text-xs">
                               {log.userName.charAt(0)}
                             </div>
                             <div>
                                <p className="text-sm font-black text-foreground leading-none">{log.userName} 작업원</p>
                                <p className="text-[10px] font-bold text-muted-foreground mt-1.5">{safeFormatTime(log.detectedAt, 'HH:mm:ss')}</p>
                             </div>
                          </div>
                          <div className="text-right">
                             <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">RSSI</p>
                             <p className="text-xs font-black text-blue-400">{log.rssi} dBm</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground bg-card p-2.5 rounded-xl border border-border">
                           <MapPin className="w-3.5 h-3.5 text-rose-500 animate-bounce" />
                           <span>{log.beaconLocation} 통과 검출</span>
                        </div>
                        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500 rounded-full blur-[40px] opacity-0 group-hover:opacity-10 transition-opacity" />
                      </div>
                    ))
                  )}
                </div>
              </div>
              
              {/* System Status Summary */}
              <div className="bg-slate-900 rounded-3xl p-6 text-white border border-slate-800 shadow-xl">
                 <h4 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-4 border-b border-white/10 pb-3 flex items-center gap-1.5">
                   <Cpu className="w-4 h-4 text-emerald-400" /> Network Status
                 </h4>
                 <div className="space-y-4 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-bold">활성 비콘</span>
                      <span className="text-sm font-black">{beacons.filter(b => b.status === 'ACTIVE').length} Units</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-bold">장애 발생</span>
                      <span className="text-sm font-black text-rose-500">{beacons.filter(b => b.status !== 'ACTIVE').length} Units</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-bold">평균 배터리</span>
                      <span className="text-sm font-black text-emerald-400">
                        {beacons.length > 0 ? Math.round(beacons.reduce((a, b) => a + b.batteryLevel, 0) / beacons.length) : 0}%
                      </span>
                    </div>
                 </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'rules' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             {rules.map(rule => (
                <div key={rule.id} className="bg-card rounded-3xl p-6 md:p-8 border border-border shadow-sm flex flex-col justify-between hover:border-blue-500/30 transition-all">
                   <div>
                     <div className="flex justify-between items-start mb-6 gap-4">
                       <h3 className="text-xl md:text-2xl font-black text-foreground break-keep">{rule.name}</h3>
                       <button className={`w-12 h-7 rounded-full relative transition-all shrink-0 ${rule.enabled ? 'bg-indigo-600' : 'bg-muted'}`}>
                         <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full transition-all ${rule.enabled ? 'left-5.5' : 'left-0.5'}`} />
                       </button>
                     </div>
                     <p className="text-muted-foreground font-semibold text-sm md:text-base mb-6 break-keep">{rule.description}</p>
                     
                     {rule.threshold && (
                       <div className="bg-muted p-4 md:p-5 rounded-2xl border border-border flex items-center justify-between gap-4">
                          <span className="text-xs md:text-sm font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap">임계값 설정</span>
                          <div className="flex items-center gap-2">
                             <input type="number" defaultValue={rule.threshold} className="w-16 md:w-20 bg-card border border-border text-foreground px-3 py-1.5 rounded-xl text-right font-black text-sm md:text-base outline-none focus:border-indigo-500" />
                             <span className="text-xs md:text-sm font-black text-muted-foreground whitespace-nowrap">{rule.unit}</span>
                          </div>
                       </div>
                     )}
                   </div>
                   
                   <div className="mt-8 pt-5 border-t border-border flex gap-3">
                      <button className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs transition-all shadow-md whitespace-nowrap">설정 저장</button>
                      <button className="px-5 py-3.5 border border-border rounded-xl text-muted-foreground hover:text-foreground transition-all shrink-0 bg-muted">
                         <Settings className="w-4 h-4" />
                      </button>
                   </div>
                </div>
             ))}
          </div>
        )}

        {activeTab === 'monitoring' && (
          <div className="space-y-6">
            {/* Target Sub Selection */}
            <div className="bg-card rounded-2xl p-4 md:p-6 border border-border shadow-sm flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
              <div className="space-y-0.5">
                <h3 className="text-lg md:text-xl font-black text-foreground flex items-center gap-2">
                  <Waves className="w-5 h-5 text-indigo-400 animate-pulse" />
                  실시간 위치관제 잠수함 선단 선택
                </h3>
                <p className="text-muted-foreground font-bold text-xs">도면에 설계된 비콘 수집기 노드를 바탕으로 위치를 실시간 모킹 도식화합니다.</p>
              </div>
              <div className="flex bg-muted p-1 rounded-2xl border border-border shadow-inner overflow-x-auto no-scrollbar shrink-0">
                {["건명-701함", "건명-702함", "건명-703함"].map(sub => (
                  <button
                    key={sub}
                    onClick={() => setSelectedSubMonitor(sub)}
                    className={`px-4 md:px-6 py-2 rounded-xl font-black text-[11px] md:text-xs transition-all whitespace-nowrap ${
                      selectedSubMonitor === sub 
                        ? 'bg-indigo-650 text-white shadow' 
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            </div>

            {beacons.filter(b => b.submarineName === selectedSubMonitor).length === 0 ? (
              <div className="bg-card rounded-3xl p-10 md:p-20 border border-border border-dashed text-center">
                <Radio className="w-12 h-12 text-muted-foreground mx-auto mb-4 animate-pulse" />
                <h3 className="text-base md:text-lg font-black text-foreground break-keep">선택한 함체에 배치된 비콘 센서 인프라가 없습니다.</h3>
                <p className="text-muted-foreground mt-1 mb-6 text-xs md:text-sm break-keep">원활한 3차원 위치 추적을 위해 시뮬레이터 30개 가상 비콘 구축을 먼저 시행해 보세요.</p>
                <button
                  onClick={handleGenerateSimulatedData}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs shadow-xl shadow-indigo-600/15"
                >
                  30개 가상 비콘 개설하기
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Visual Connected Track Map */}
                <div className="lg:col-span-2 bg-slate-950 border border-slate-850 rounded-3xl p-5 md:p-8 text-white relative overflow-hidden shadow-2xl">
                  <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
                  
                  <div className="flex items-center justify-between border-b border-white/5 pb-5 mb-5 gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400 shrink-0">
                        <Cpu className="w-4 h-4 animate-spin" />
                      </div>
                      <div>
                        <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest leading-none block">Confined space track</span>
                        <h4 className="text-lg font-black text-white mt-0.5 break-keep">{selectedSubMonitor} 대원 대피/작업 고해상도 도선</h4>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping shrink-0" />
                      <span className="text-[10px] md:text-xs font-black text-emerald-400 whitespace-nowrap">모바일 장치 수집 활성화</span>
                    </div>
                  </div>

                  {/* Nodes Stack */}
                  <div className="space-y-4 relative pl-3">
                    <div className="absolute left-5 top-6 bottom-6 w-0.5 bg-slate-800 border-dashed" />

                    {beacons
                      .filter(b => b.submarineName === selectedSubMonitor)
                      .sort((a,b) => a.order - b.order)
                      .map((b, idx) => {
                        const nodeWorkers = getSubmarineActiveWorkers(selectedSubMonitor).filter(w => w.beaconId === b.id);
                        return (
                          <div
                            key={b.id}
                            className={`flex items-start gap-4 p-4 rounded-xl border transition-all relative z-10 ${
                              nodeWorkers.length > 0 
                                ? 'bg-slate-900 border-blue-500/30 shadow-md shadow-blue-500/5' 
                                : 'bg-slate-900/40 border-slate-850'
                            }`}
                          >
                            <div className={`w-10 h-10 rounded-lg border font-mono font-black text-xs flex items-center justify-center shrink-0 transition-all ${
                              nodeWorkers.length > 0
                                ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/30'
                                : 'bg-slate-800 border-slate-705 text-slate-550'
                            }`}>
                              {b.order}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div>
                                  <p className="text-sm font-black text-slate-200 flex items-center gap-1.5 leading-none break-keep">
                                    <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                    {b.location}
                                  </p>
                                  <span className="text-[9px] font-mono text-slate-550 mt-1 block">UUID: {b.id}</span>
                                </div>
                                <div className="flex items-center gap-3 shrink-0 self-start sm:self-auto">
                                  <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-bold bg-slate-850 px-2.5 py-1 rounded">
                                    <Battery className="w-3 h-3 text-emerald-400 shrink-0" />
                                    {b.batteryLevel}%
                                  </div>
                                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded whitespace-nowrap ${
                                    nodeWorkers.length > 0 ? 'bg-indigo-505/20 text-indigo-400 animate-pulse' : 'bg-slate-800 text-slate-500'
                                  }`}>
                                    {nodeWorkers.length > 0 ? `실시간 감지 (${nodeWorkers.length}명)` : '대기 수신'}
                                  </span>
                                </div>
                              </div>

                              {/* Workers tag stack */}
                              {nodeWorkers.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap gap-2 animate-fade-in">
                                  {nodeWorkers.map(w => (
                                    <div
                                      key={w.uid}
                                      className="bg-slate-855 border border-blue-500/25 pl-1 pr-2.5 py-1 rounded-lg flex items-center gap-1.5"
                                    >
                                      <div className="w-5 h-5 rounded bg-indigo-600 font-black text-[10px] text-white flex items-center justify-center shrink-0">
                                        {w.userName.charAt(0)}
                                      </div>
                                      <div className="text-left whitespace-nowrap">
                                        <p className="text-[10px] font-black text-white">{w.userName} 대원</p>
                                        <p className="text-[8px] font-mono text-indigo-400/90 leading-none mt-0.5">RSSI {w.rssi} dBm</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Sub Active Workers Stats */}
                <div className="space-y-6">
                  <div className="bg-card rounded-3xl p-5 md:p-6 border border-border shadow-sm flex flex-col h-[500px] md:h-[650px]">
                    <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400 shrink-0">
                          <User className="w-5 h-5 animate-pulse" />
                        </div>
                        <div>
                          <h4 className="text-base font-black text-foreground leading-none">선제 체류자 총람</h4>
                          <p className="text-[10px] font-semibold text-muted-foreground mt-1">현재 함체 내 진입자</p>
                        </div>
                      </div>
                      <span className="font-mono text-xs font-black text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/25 whitespace-nowrap">
                        {getSubmarineActiveWorkers(selectedSubMonitor).length}명 탐지
                      </span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 pr-1 no-scrollbar">
                      {getSubmarineActiveWorkers(selectedSubMonitor).length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center">
                          <ShieldCheck className="w-10 h-10 text-slate-200 mb-3" />
                          <p className="text-xs font-bold text-slate-400 break-keep">현재 함체 내 진입 대원이 없습니다.</p>
                          {isSimulating ? (
                             <p className="text-[10px] text-blue-500 mt-1 font-black animate-pulse">디바이스 신호 연동 대기...</p>
                          ) : (
                             <p className="text-[10px] text-slate-400 mt-1 break-keep">상단 시뮬레이터를 켜시면 가상 대원이 배치됩니다.</p>
                          )}
                        </div>
                      ) : (
                        getSubmarineActiveWorkers(selectedSubMonitor).map(worker => {
                          const currentBeacon = beacons.find(b => b.id === worker.beaconId);
                          return (
                            <div
                              key={worker.uid}
                              className="p-4 bg-muted/65 rounded-2xl border border-border/40 space-y-2.5 relative overflow-hidden group hover:border-indigo-500/30 transition-all hover:bg-card"
                            >
                              <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 bg-slate-800 text-white rounded-lg flex items-center justify-center font-black text-xs shrink-0">
                                    {worker.userName.charAt(0)}
                                  </div>
                                  <div>
                                    <p className="font-black text-foreground text-xs">{worker.userName} 작업원</p>
                                    <p className="text-[10px] font-bold text-muted-foreground flex items-center gap-1 mt-1">
                                      <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
                                      {safeFormatTime(worker.detectedAt, 'HH:mm:ss')} 통과
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right whitespace-nowrap">
                                  <span className="text-xs font-black text-indigo-400">{worker.rssi} dBm</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground bg-card p-2.5 rounded-xl border border-border shadow-sm">
                                <MapPin className="w-3.5 h-3.5 text-rose-500 animate-bounce shrink-0" />
                                <span className="font-bold text-foreground truncate break-keep">{currentBeacon?.location || worker.beaconLocation}</span>
                                <span className="text-[9px] font-mono text-muted-foreground bg-muted border border-border px-1.5 py-0.5 rounded ml-auto shrink-0">노드 {currentBeacon?.order || 0}</span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Scientific Status block */}
                  <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-[3rem] p-8 text-white border border-slate-800 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-[40px] pointer-events-none" />
                    <div className="flex justify-between items-center mb-6">
                       <h4 className="text-xs font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                          <Zap className="w-4 h-4 text-emerald-400 animate-pulse" />
                          Simulator Diagnostics
                       </h4>
                       <span className="text-[9px] font-mono text-slate-500">v1.2.9</span>
                    </div>
                    <div className="space-y-4 font-sans text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-bold">시물레이션 엔진 가동</span>
                        <span className={`font-black font-mono tracking-wider ${isSimulating ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`}>
                          {isSimulating ? '● SIM_RUNNING' : '■ STANDBY'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-bold">수신 비콘 센서 인프라</span>
                        <span className="font-black font-mono text-white">{beacons.length} EA</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-bold">인계 실시간 신호 로그</span>
                        <span className="font-black font-mono text-yellow-400">{logs.length} EA</span>
                      </div>
                    </div>
                  </div>

                </div>

              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-0">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setShowAddModal(false)} />
          <div className="bg-card w-full max-w-xl rounded-[3rem] p-10 relative shadow-2xl overflow-hidden border border-border">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500 rounded-full blur-[100px] opacity-10 -mr-32 -mt-32" />
            
            <div className="relative">
              <h3 className="text-3xl font-black text-foreground tracking-tight mb-2">비콘 신규 등록</h3>
              <p className="text-muted-foreground font-bold mb-8">잠수함 내부의 특정 지점에 설치될 비콘 정보를 입력하세요.</p>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">식별 번호 (Address)</label>
                    <input 
                      type="text" 
                      value={newBeacon.id}
                      onChange={(e) => setNewBeacon({...newBeacon, id: e.target.value})}
                      placeholder="예시: B1:C2:D3:E4"
                      className="w-full bg-muted border border-border rounded-2xl px-6 py-4 text-foreground font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-sm placeholder:text-muted-foreground/60" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">비콘 이름</label>
                    <input 
                      type="text" 
                      value={newBeacon.name}
                      onChange={(e) => setNewBeacon({...newBeacon, name: e.target.value})}
                      placeholder="예시: Entrance-01"
                      className="w-full bg-muted border border-border rounded-2xl px-6 py-4 text-foreground font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-sm placeholder:text-muted-foreground/60" 
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">함명 (Submarine Name)</label>
                  <input 
                    type="text" 
                    value={newBeacon.submarineName}
                    onChange={(e) => setNewBeacon({...newBeacon, submarineName: e.target.value})}
                    placeholder="예시: 건명-701함"
                    className="w-full bg-muted border border-border rounded-2xl px-6 py-4 text-foreground font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-sm placeholder:text-muted-foreground/60" 
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">설치 위치</label>
                    <input 
                      type="text" 
                      value={newBeacon.location}
                      onChange={(e) => setNewBeacon({...newBeacon, location: e.target.value})}
                      placeholder="예시: 입구 사다리"
                      className="w-full bg-muted border border-border rounded-2xl px-6 py-4 text-foreground font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-sm placeholder:text-muted-foreground/60" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">진입 순서 (Order)</label>
                    <input 
                      type="number" 
                      value={newBeacon.order}
                      onChange={(e) => setNewBeacon({...newBeacon, order: parseInt(e.target.value)})}
                      className="w-full bg-muted border border-border rounded-2xl px-6 py-4 text-foreground font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-sm" 
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-6">
                   <button 
                     onClick={() => setShowAddModal(false)}
                     className="flex-1 px-8 py-5 bg-muted text-muted-foreground rounded-2xl font-black text-sm hover:bg-muted/80 transition-all border border-border"
                   >
                     취소
                   </button>
                   <button 
                     onClick={handleAddBeacon}
                     className="flex-[2] px-8 py-5 bg-indigo-600 text-white rounded-2xl font-black text-sm hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-650/20 active:scale-95"
                   >
                     비콘 등록 완료
                   </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </PCAdminLayout>
  );
};

export default PCAdminBeacons;
