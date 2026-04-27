import React, { useState, useEffect } from 'react';
import { useAuth } from '@/src/components/AuthProvider';
import { auth, db } from '@/src/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, increment, getDocs, deleteDoc, orderBy, limit } from 'firebase/firestore';
import { UserProfile, PraiseCoupon } from '@/src/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Coins, Trophy, RefreshCw, Ticket, ChevronRight, Minus, Plus, Flag } from 'lucide-react';
import confetti from 'canvas-confetti';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';

interface RouletteSetting {
  id: string;
  label: string;
  multiplier: number;
  probability: number;
  color: string;
}

const DEFAULT_ROULETTE_SETTINGS: RouletteSetting[] = [
  { id: '1', label: '꽝', multiplier: 0, probability: 0.4, color: '#1e293b' },
  { id: '2', label: '1배', multiplier: 1, probability: 0.3, color: '#3182f6' },
  { id: '3', label: '2배', multiplier: 2, probability: 0.2, color: '#10b981' },
  { id: '4', label: '5배', multiplier: 5, probability: 0.08, color: '#f59e0b' },
  { id: '5', label: '10배', multiplier: 10, probability: 0.02, color: '#ef4444' },
];

export const Entertainment: React.FC = () => {
  const { profile } = useAuth();
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [pointsToBet, setPointsToBet] = useState(1);
  const [gameHistory, setGameHistory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('roulette');

  // Snail Race state
  const [snailPositions, setSnailPositions] = useState([0, 0, 0, 0, 0]);
  const [snailStatus, setSnailStatus] = useState<'IDLE' | 'RACING' | 'FINISHED'>('IDLE');
  const [selectedSnail, setSelectedSnail] = useState<number | null>(null);

  useEffect(() => {
    if (!profile) return;
    const qGame = query(collection(db, 'lottoHistory'), where('uid', '==', profile.uid), orderBy('createdAt', 'desc'), limit(5));
    const unsubscribeGame = onSnapshot(qGame, (snapshot) => {
      setGameHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
    });
    return () => unsubscribeGame();
  }, [profile]);

  const spinRoulette = async () => {
    if (isSpinning || !profile || (profile.points || 0) < pointsToBet) {
      toast.error('포인트가 부족합니다.');
      return;
    }
    setIsSpinning(true);
    const rand = Math.random();
    let cumulativeProb = 0;
    let resultIndex = 0;
    for (let i = 0; i < DEFAULT_ROULETTE_SETTINGS.length; i++) {
      cumulativeProb += DEFAULT_ROULETTE_SETTINGS[i].probability;
      if (rand <= cumulativeProb) { resultIndex = i; break; }
    }
    const result = DEFAULT_ROULETTE_SETTINGS[resultIndex];
    const segmentAngle = 360 / DEFAULT_ROULETTE_SETTINGS.length;
    const targetRotation = (360 - (resultIndex * segmentAngle + segmentAngle / 2)) % 360;
    const currentRotationMod = rotation % 360;
    const extraShift = (targetRotation - currentRotationMod + 360) % 360;
    const finalRotation = rotation + (360 * 5) + extraShift;
    setRotation(finalRotation);

    setTimeout(async () => {
      setIsSpinning(false);
      const winPoints = Math.floor(pointsToBet * result.multiplier);
      try {
        await updateDoc(doc(db, 'users', profile.uid), { points: increment(winPoints - pointsToBet) });
        await addDoc(collection(db, 'lottoHistory'), {
          uid: profile.uid, label: result.label, winPoints, betPoints: pointsToBet, createdAt: new Date().toISOString()
        });
        if (result.multiplier > 1) {
          confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
          toast(`결과: ${result.label} 당첨! (+${winPoints}P)`);
        } else if (result.multiplier === 1) {
          toast(`결과: ${result.label} (본전입니다)`);
        } else {
          toast(`결과: ${result.label} (아쉽네요!)`);
        }
      } catch (e) { toast.error('실패'); }
    }, 4000);
  };

  const startSnailRace = async () => {
    if (snailStatus === 'RACING' || selectedSnail === null || !profile || (profile.points || 0) < pointsToBet) {
      toast.error('상태를 확인하세요 (포인트 부족 또는 달팽이 미선택)');
      return;
    }
    setSnailStatus('RACING');
    setSnailPositions([0, 0, 0, 0, 0]);
    try { await updateDoc(doc(db, 'users', profile.uid), { points: increment(-pointsToBet) }); } catch (e) { return; }
    const winRoll = Math.random();
    const targetWinnerIdx = winRoll < 0.2 ? selectedSnail : (selectedSnail + Math.floor(Math.random() * 4) + 1) % 5;
    const interval = setInterval(() => {
      setSnailPositions(prev => {
        if (prev.some(p => p >= 100)) {
          clearInterval(interval);
          const winnerIdx = prev.findIndex(p => p >= 100);
          finishRace(winnerIdx);
          return prev;
        }
        return prev.map((p, idx) => {
          const isTarget = idx === targetWinnerIdx;
          const move = Math.max(0.1, Math.random() * 2 + (isTarget ? 0.3 : 0));
          return Math.min(100, p + move);
        });
      });
    }, 100);
  };

  const finishRace = async (winnerIdx: number) => {
    if (!profile) return;
    setSnailStatus('FINISHED');
    const winPoints = winnerIdx === selectedSnail ? Math.floor(pointsToBet * 4.5) : 0;
    try {
      if (winPoints > 0) {
        await updateDoc(doc(db, 'users', profile.uid), { points: increment(winPoints) });
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        toast(`결과: ${winnerIdx + 1}번 우승! (+${winPoints}P)`);
      } else {
        toast(`결과: ${winnerIdx + 1}번 우승! (아쉽네요)`);
      }
      await addDoc(collection(db, 'lottoHistory'), {
        uid: profile.uid, label: `달팽이 레이스 (${winnerIdx + 1}번 우승)`, winPoints, betPoints: pointsToBet, createdAt: new Date().toISOString()
      });
    } catch (e) {}
  };

  return (
    <div className="space-y-6 pb-24 px-1">
      <header className="py-8 text-center space-y-2">
        <h2 className="text-3xl font-black tracking-tight text-white italic drop-shadow-lg uppercase">건명 놀이터</h2>
        <p className="text-[10px] font-black text-primary tracking-[0.3em] uppercase">프리미엄 3D 아케이드</p>
      </header>

      <div className="bg-card p-6 rounded-3xl border border-white/5 flex flex-col items-center gap-4 text-center shadow-xl">
         <div className="w-12 h-12 bg-yellow-500/10 rounded-2xl flex items-center justify-center border border-yellow-500/20">
            <Coins className="w-6 h-6 text-yellow-500" />
         </div>
         <div className="space-y-1">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">CURRENT BALANCE</p>
            <p className="text-4xl font-black italic text-white leading-none">{profile?.points?.toLocaleString() || 0} <span className="text-xl text-yellow-500 not-italic">P</span></p>
         </div>
      </div>

      <div className="bg-card p-1.5 rounded-[2rem] flex gap-2 border border-white/5 shadow-2xl relative overflow-hidden">
         <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 pointer-events-none" />
         {[{id:'roulette', label:'3D 룰렛'}, {id:'snail', label:'3D 달팽이'}].map(tab => (
           <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={cn("flex-1 h-14 rounded-2xl text-[11px] font-black transition-all relative z-10", activeTab === tab.id ? "bg-white text-black shadow-xl scale-[1.02]" : "text-muted-foreground hover:text-white hover:bg-white/5")}>
              {tab.label}
           </button>
         ))}
      </div>

      <div className="min-h-[460px]">
         <AnimatePresence mode="wait">
            {activeTab === 'roulette' && (
              <motion.div key="roulette" initial={{ opacity: 0, rotateY: -30 }} animate={{ opacity: 1, rotateY: 0 }} exit={{ opacity: 0, rotateY: 30 }} className="space-y-10 flex flex-col items-center pt-4">
                 {/* 3D Roulette Stage */}
                 <div className="relative w-80 h-80 flex items-center justify-center" style={{ perspective: '1200px' }}>
                    
                    {/* Floor Reflection */}
                    <div className="absolute -bottom-12 w-full h-12 bg-primary/20 blur-[50px] rounded-full pointer-events-none" />

                    {/* Wheel Base (Shadow/Depth) */}
                    <div className="absolute inset-[-15px] rounded-full bg-slate-900 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8)] border-b-[12px] border-black" style={{ transform: 'rotateX(30deg)' }} />

                    {/* The Spinning Wheel */}
                    <motion.div 
                      className="w-full h-full rounded-full relative z-0 shadow-[inset_0_0_50px_rgba(0,0,0,0.5)] border-[8px] border-slate-800" 
                      style={{ 
                        transform: 'rotateX(30deg)', 
                        transformStyle: 'preserve-3d',
                        background: 'radial-gradient(circle at center, #1e293b 0%, #020617 100%)'
                      }}
                      animate={{ rotate: rotation }} 
                      transition={{ duration: 4, ease: [0.12, 0, 0.1, 1] }}
                    >
                       <svg viewBox="0 0 100 100" className="w-full h-full">
                          {DEFAULT_ROULETTE_SETTINGS.map((s, i) => {
                             const angle = 360 / DEFAULT_ROULETTE_SETTINGS.length;
                             const sAngle = i * angle - 90;
                             const eAngle = (i + 1) * angle - 90;
                             const x1 = 50 + 50 * Math.cos((Math.PI * sAngle) / 180);
                             const y1 = 50 + 50 * Math.sin((Math.PI * sAngle) / 180);
                             const x2 = 50 + 50 * Math.cos((Math.PI * eAngle) / 180);
                             const y2 = 50 + 50 * Math.sin((Math.PI * eAngle) / 180);
                             return (
                               <g key={s.id}>
                                  <path 
                                    d={`M 50 50 L ${x1} ${y1} A 50 50 0 0 1 ${x2} ${y2} Z`} 
                                    fill={s.color} 
                                    className="transition-all"
                                    stroke="rgba(255,255,255,0.05)"
                                    strokeWidth="0.3"
                                  />
                                  <text 
                                    x="50" y="24" 
                                    transform={`rotate(${sAngle + angle/2 + 90}, 50, 50)`} 
                                    fill="white" 
                                    fillOpacity="0.9"
                                    className="text-[6px] font-black italic tracking-tighter" 
                                    textAnchor="middle"
                                    style={{ filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.8))' }}
                                  >
                                    {s.label}
                                  </text>
                               </g>
                             );
                          })}
                          {/* Inner Bezel */}
                          <circle cx="50" cy="50" r="15" fill="#0f172a" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                          <circle cx="50" cy="50" r="10" fill="#3182f6" fillOpacity="0.1" />
                          <circle cx="50" cy="50" r="4" fill="white" className="animate-pulse" />
                       </svg>
                    </motion.div>

                    {/* 3D Stopper/Indicator */}
                    <div className="absolute top-[-30px] left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
                       <div className="w-1 h-12 bg-gradient-to-b from-white via-white to-transparent opacity-50" />
                       <motion.div 
                         className="w-8 h-12 bg-primary rounded-t-full rounded-b-xl border-4 border-white shadow-[0_15px_30px_rgba(59,130,246,0.6)] relative overflow-hidden"
                         animate={{ rotate: isSpinning ? [-3, 3, -3] : 0 }}
                         transition={{ repeat: Infinity, duration: 0.1 }}
                       >
                          <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-black/20" />
                          <div className="absolute top-1 left-1.5 w-1.5 h-1.5 bg-white/60 rounded-full" />
                       </motion.div>
                    </div>
                 </div>

                 <div className="w-full max-w-sm space-y-6">
                    <div className="space-y-3">
                       <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] text-center italic">배팅 포인트 설정</p>
                       <div className="flex items-center gap-4">
                          <Button variant="ghost" className="h-16 w-16 rounded-[1.5rem] bg-white/5 text-white active:scale-90 border border-white/5" onClick={() => setPointsToBet(Math.max(1, pointsToBet - 10))}>
                            <Minus className="w-6 h-6"/>
                          </Button>
                          <div className="flex-1 relative group">
                             <Input type="number" value={pointsToBet} readOnly className="h-20 text-center text-4xl font-black bg-slate-900 border-2 border-white/5 rounded-[2rem] text-white shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] group-hover:border-primary/50 transition-colors" />
                             <Coins className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 opacity-20" />
                          </div>
                          <Button variant="ghost" className="h-16 w-16 rounded-[1.5rem] bg-white/5 text-white active:scale-90 border border-white/5" onClick={() => setPointsToBet(pointsToBet + 10)}>
                            <Plus className="w-6 h-6"/>
                          </Button>
                       </div>
                    </div>
                    <Button 
                      onClick={spinRoulette} 
                      disabled={isSpinning} 
                      className={cn(
                        "w-full h-22 text-white font-black text-2xl rounded-[2.5rem] shadow-[0_20px_40px_-10px_rgba(59,130,246,0.3)] transition-all relative overflow-hidden group border-b-8 active:border-b-0 active:translate-y-2",
                        isSpinning ? "bg-slate-800 border-slate-950" : "bg-gradient-to-r from-blue-600 to-indigo-700 border-indigo-900"
                      )}
                    >
                       {isSpinning ? (
                         <div className="flex items-center gap-4">
                            <RefreshCw className="w-8 h-8 animate-spin" />
                            <span className="italic">회전 중...</span>
                         </div>
                       ) : (
                         <span className="flex items-center gap-3 italic">
                           배팅하기 <ChevronRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
                         </span>
                       )}
                    </Button>
                 </div>
              </motion.div>
            )}

            {activeTab === 'snail' && (
              <motion.div key="snail" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="space-y-8">
                 {/* 3D Racing Track Container */}
                 <div className="relative h-[340px] w-full rounded-[3rem] bg-slate-950 border-4 border-white/10 shadow-[inner_0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col" style={{ perspective: '1200px' }}>
                    
                    {/* Background Stadium elements */}
                    <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-primary/20 to-transparent flex justify-between px-10 items-center opacity-40 pointer-events-none">
                       <Flag className="w-8 h-8 text-blue-400 animate-bounce" />
                       <div className="flex flex-col items-center">
                          <span className="text-[11px] font-black tracking-[0.6em] text-white italic">달팽이 그랑프리 2024</span>
                          <div className="h-[2px] w-24 bg-primary/50 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                       </div>
                       <Flag className="w-8 h-8 text-blue-400 animate-bounce" style={{ animationDelay: '0.5s' }} />
                    </div>

                    {/* The 3D Ground/Track */}
                    <div 
                      className="absolute inset-x-6 top-14 bottom-6 bg-slate-900 rounded-[2rem] border border-white/5 shadow-2xl flex flex-col justify-around p-4"
                      style={{ 
                         transform: 'rotateX(40deg) translateZ(0)',
                         transformStyle: 'preserve-3d'
                      }}
                    >
                       {[0,1,2,3,4].map(i => (
                         <div key={i} className="relative h-10 w-full flex items-center group cursor-pointer" onClick={() => snailStatus !== 'RACING' && setSelectedSnail(i)}>
                            {/* Lane marking */}
                            <div className="absolute inset-0 border-b border-white/10 flex items-center justify-end px-4">
                               <div className="text-[10px] font-black text-white/10 italic tracking-widest">{i+1}번 레인</div>
                            </div>
                            
                            {/* The Distance Bar (Under Snail) */}
                            <div className="absolute left-0 right-10 h-1.5 bg-black/50 rounded-full overflow-hidden blur-[1px]">
                               <motion.div 
                                 className="h-full bg-primary/40 shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                                 animate={{ width: `${snailPositions[i]}%` }}
                                 transition={{ type: 'spring', stiffness: 50, damping: 20 }}
                               />
                            </div>

                            {/* 3D Snail Element */}
                            <motion.div 
                              className="absolute z-10 flex flex-col items-center"
                              style={{ 
                                zIndex: 10 - i // Proper visual overlapping based on perspective
                              }}
                              animate={{ 
                                 left: `calc(${snailPositions[i]}% - 20px)`,
                                 z: snailStatus === 'RACING' ? [0, 15, 0] : 0,
                                 rotateY: snailStatus === 'RACING' ? (Math.random() > 0.5 ? 10 : -10) : 0
                              }}
                              transition={{ 
                                 left: { type: 'spring', stiffness: 40, damping: 15 },
                                 z: { repeat: Infinity, duration: 0.6 },
                                 rotateY: { repeat: Infinity, duration: 0.4 }
                              }}
                            >
                               {/* Shadow */}
                               <div className="absolute -bottom-1 w-14 h-4 bg-black/70 blur-md rounded-full" />
                               
                               {/* Snail Emoji with depth */}
                               <div className={cn(
                                 "text-3xl filter drop-shadow-[0_15px_10px_rgba(0,0,0,0.8)] transition-all",
                                 selectedSnail === i ? "scale-110 brightness-110 drop-shadow-[0_0_20px_rgba(59,130,246,0.7)]" : "brightness-75 opacity-80"
                               )}>
                                  🐌
                               </div>

                               {/* Selection Indicator */}
                               {selectedSnail === i && (
                                 <motion.div 
                                   layoutId="selection-bubble" 
                                   className="absolute -top-12 bg-primary text-white text-[9px] font-black px-3 py-1.5 rounded-full shadow-[0_10px_20px_rgba(59,130,246,0.6)] border border-white/20 whitespace-nowrap z-50 italic"
                                 >
                                    나의 선택
                                 </motion.div>
                               )}
                            </motion.div>

                            {/* Finish Line Indicator */}
                            <div className="absolute right-2 top-0 bottom-0 w-1 flex flex-col gap-1 py-1 opacity-30">
                               {[...Array(6)].map((_, j) => (
                                 <div key={j} className="w-full flex-1 bg-white" />
                               ))}
                               {snailPositions[i] >= 100 && (
                                 <motion.div initial={{ scale: 0 }} animate={{ scale: 1.5 }}>
                                    <Trophy className="w-8 h-8 text-yellow-400 absolute -right-10 -top-3 animate-bounce filter drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]" />
                                 </motion.div>
                               )}
                            </div>
                         </div>
                       ))}
                    </div>
                 </div>

                 {/* Controls Section */}
                 <div className="bg-card p-6 rounded-[2.5rem] border border-white/5 space-y-8 shadow-2xl relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent pointer-events-none" />
                    
                    <div className="flex justify-between items-center px-2">
                       <div className="flex flex-col">
                          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest text-left opacity-60">출전 달팽이 정보</span>
                          <h3 className="text-2xl font-black text-white italic tracking-tighter">우승 달팽이 선택</h3>
                       </div>
                       <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 rounded-full border border-white/10 shadow-inner">
                          <Coins className="w-4 h-4 text-yellow-500" />
                          <span className="text-sm font-black text-white italic">{pointsToBet} P</span>
                       </div>
                    </div>

                    <div className="grid grid-cols-5 gap-3">
                       {[0,1,2,3,4].map(idx => (
                         <button 
                           key={idx} 
                           onClick={() => snailStatus !== 'RACING' && setSelectedSnail(idx)} 
                           className={cn(
                              "h-24 rounded-3xl font-black transition-all relative flex flex-col items-center justify-center gap-2 border-2 shadow-lg group", 
                              selectedSnail === idx ? "bg-primary text-white border-white/20 shadow-primary/40 scale-105" : "bg-white/5 text-muted-foreground hover:bg-white/10 border-transparent active:scale-95"
                           )}
                         >
                            <span className="text-[11px] opacity-60 italic tracking-tighter">{idx + 1}호</span>
                            <span className={cn("text-3xl transition-transform group-hover:scale-110", selectedSnail === idx ? "animate-bounce" : "")}>🐌</span>
                         </button>
                       ))}
                    </div>

                    <div className="flex flex-col gap-4">
                       <Button 
                         onClick={startSnailRace} 
                         disabled={snailStatus === 'RACING' || selectedSnail === null} 
                         className={cn(
                           "w-full h-22 text-white font-black text-2xl rounded-[2.5rem] shadow-[0_20px_40px_-10px_rgba(59,130,246,0.4)] transition-all relative overflow-hidden group border-b-8 active:border-b-0 active:translate-y-2",
                           snailStatus === 'RACING' ? "bg-slate-800 border-slate-950" : "bg-gradient-to-r from-blue-600 to-indigo-700 border-indigo-900"
                         )}
                       >
                          {snailStatus === 'RACING' ? (
                             <div className="flex items-center gap-4">
                                <RefreshCw className="w-7 h-7 animate-spin" />
                                <span className="italic tracking-tighter uppercase font-bold">경주 진행 중...</span>
                             </div>
                          ) : (
                             <span className="tracking-tighter uppercase italic flex items-center gap-3 underline decoration-white/20 underline-offset-8 decoration-2 text-xl font-bold">
                               경주 열기 <ChevronRight className="w-7 h-7 group-hover:translate-x-2 transition-transform" />
                             </span>
                          )}
                       </Button>
                       <div className="flex justify-center items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_12px_rgba(16,185,129,0.7)]" />
                          <p className="text-[11px] font-bold text-muted-foreground italic tracking-tight">
                             예상 배당금: <span className="text-primary font-black uppercase tracking-wider">4.5배 보상</span>
                          </p>
                       </div>
                    </div>
                 </div>
              </motion.div>
            )}
         </AnimatePresence>
      </div>

      <div className="space-y-4 pt-10">
         <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-4">최근 행운 내역</h4>
         <div className="space-y-2">
            {gameHistory.map((h, i) => (
              <div key={i} className="bg-card p-4 rounded-2xl border border-white/5 flex justify-between items-center">
                 <div className="flex items-center gap-3">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", h.winPoints > 0 ? "bg-primary/20 text-primary" : "bg-white/5 text-white/20")}>
                       <Trophy className="w-5 h-5" />
                    </div>
                    <div>
                       <p className="text-sm font-black text-white">{h.label}</p>
                       <p className="text-[10px] text-muted-foreground font-bold">{format(new Date(h.createdAt), 'HH:mm:ss')}</p>
                    </div>
                 </div>
                 <span className={cn("text-lg font-black", h.winPoints > 0 ? "text-primary" : "text-white/20")}>{h.winPoints > 0 ? `+${h.winPoints}` : '0'}P</span>
              </div>
            ))}
         </div>
      </div>
    </div>
  );
};
