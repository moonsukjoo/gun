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
import { Coins, Trophy, RefreshCw, Ticket, Ship, ChevronRight, Minus, Plus } from 'lucide-react';
import confetti from 'canvas-confetti';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { ShipAssembly } from './ShipAssembly';

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
          toast.success(`${result.label} 당첨! ${winPoints}P 획득!`);
        } else if (result.multiplier === 1) {
          toast.info('본전입니다.');
        } else {
          toast.error('아쉽게도 꽝입니다.');
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
        toast.success(`우승! ${winPoints}P 획득!`);
      } else {
        toast.error(`${winnerIdx + 1}번 달팽이 우승. 아깝네요!`);
      }
      await addDoc(collection(db, 'lottoHistory'), {
        uid: profile.uid, label: `달팽이 레이스 (${winnerIdx + 1}번 우승)`, winPoints, betPoints: pointsToBet, createdAt: new Date().toISOString()
      });
    } catch (e) {}
  };

  return (
    <div className="space-y-6 pb-24 px-1">
      <header className="py-8 text-center space-y-2">
        <h2 className="text-3xl font-black tracking-tight text-white">건명기업 놀이터</h2>
      </header>

      <div className="bg-card p-6 rounded-3xl border border-white/5 flex flex-col items-center gap-4 text-center">
         <div className="w-12 h-12 bg-yellow-500/10 rounded-2xl flex items-center justify-center">
            <Coins className="w-6 h-6 text-yellow-500" />
         </div>
         <div className="space-y-1">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">보유 포인트</p>
            <p className="text-4xl font-black text-primary">{(profile?.points || 0).toLocaleString()}P</p>
         </div>
      </div>

      <div className="bg-card p-1 rounded-2xl flex gap-1 border border-white/5">
         {[{id:'roulette', label:'룰렛'}, {id:'snail', label:'달팽이'}, {id:'ship', label:'선박 조립'}].map(tab => (
           <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={cn("flex-1 h-12 rounded-xl text-xs font-black transition-all", activeTab === tab.id ? "bg-white text-black shadow-lg" : "text-muted-foreground hover:text-white")}>
              {tab.label}
           </button>
         ))}
      </div>

      <div className="min-h-[400px]">
         <AnimatePresence mode="wait">
            {activeTab === 'roulette' && (
              <motion.div key="roulette" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-10 flex flex-col items-center">
                 <div className="relative w-72 h-72 flex items-center justify-center">
                    <div className="absolute inset-[-8px] rounded-full border-[6px] border-card shadow-2xl z-10" />
                    <motion.div className="w-full h-full rounded-full relative z-0" animate={{ rotate: rotation }} transition={{ duration: 4, ease: [0.15, 0.0, 0.1, 1.0] }}>
                       <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-2xl">
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
                                  <path d={`M 50 50 L ${x1} ${y1} A 50 50 0 0 1 ${x2} ${y2} Z`} fill={s.color} className="transition-all" />
                                  <text x="50" y="20" transform={`rotate(${sAngle + angle/2 + 90}, 50, 50)`} fill="white" className="text-[6px] font-black" textAnchor="middle">{s.label}</text>
                               </g>
                             );
                          })}
                          <circle cx="50" cy="50" r="10" fill="#000" />
                       </svg>
                    </motion.div>
                    <div className="absolute top-[-15px] left-1/2 -translate-x-1/2 z-20">
                       <div className="w-4 h-8 bg-yellow-500 rounded-full border-2 border-white shadow-lg" />
                    </div>
                 </div>

                 <div className="w-full max-w-sm space-y-4">
                    <div className="space-y-2">
                       <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest text-center">배팅 포인트</p>
                       <div className="flex items-center gap-2">
                          <Button variant="ghost" className="h-14 w-14 rounded-2xl bg-white/5 text-white" onClick={() => setPointsToBet(Math.max(1, pointsToBet - 1))}><Minus className="w-5 h-5"/></Button>
                          <Input type="number" value={pointsToBet} readOnly className="h-16 text-center text-2xl font-black bg-card border-none rounded-2xl text-white" />
                          <Button variant="ghost" className="h-14 w-14 rounded-2xl bg-white/5 text-white" onClick={() => setPointsToBet(pointsToBet + 1)}><Plus className="w-5 h-5"/></Button>
                       </div>
                    </div>
                    <Button onClick={spinRoulette} disabled={isSpinning} className="w-full h-16 bg-primary text-white font-black text-lg rounded-2xl shadow-lg shadow-primary/20">{isSpinning ? '운명에 맡기는 중...' : '롤렛 돌리기'}</Button>
                 </div>
              </motion.div>
            )}

            {activeTab === 'snail' && (
              <motion.div key="snail" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
                 <div className="space-y-1">
                    {[0,1,2,3,4].map(i => (
                      <div key={i} onClick={() => snailStatus !== 'RACING' && setSelectedSnail(i)} className={cn("h-12 bg-white/5 rounded-xl relative overflow-hidden border border-white/5 transition-all", selectedSnail === i && "border-primary/50 bg-primary/5")}>
                         <div className="absolute left-0 top-0 bottom-0 bg-primary/20 transition-all duration-100" style={{ width: `${snailPositions[i]}%` }} />
                         <div className="absolute top-1/2 -translate-y-1/2 flex items-center px-4 gap-3 transition-all duration-100" style={{ left: `${snailPositions[i]}%` }}>
                            <span className="text-xl">🐌</span>
                            <span className="text-[9px] font-black text-white/50">{i + 1}번</span>
                         </div>
                      </div>
                    ))}
                 </div>
                 <div className="bg-card p-6 rounded-3xl border border-white/5 space-y-6">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest text-center">우승 달팽이 예측</p>
                    <div className="flex gap-2">
                       {[0,1,2,3,4].map(i => (
                         <button key={i} onClick={() => setSelectedSnail(i)} className={cn("flex-1 h-12 rounded-xl font-black text-sm transition-all", selectedSnail === i ? "bg-primary text-white" : "bg-white/5 text-muted-foreground")}>{i + 1}번</button>
                       ))}
                    </div>
                    <Button onClick={startSnailRace} disabled={snailStatus === 'RACING'} className="w-full h-16 bg-primary text-white font-black text-lg rounded-2xl">
                       {snailStatus === 'RACING' ? '치열한 경주 중...' : '경기 시작'}
                    </Button>
                 </div>
              </motion.div>
            )}

            {activeTab === 'ship' && <ShipAssembly />}
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
