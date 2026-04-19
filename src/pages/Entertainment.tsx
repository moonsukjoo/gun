import React, { useState, useEffect } from 'react';
import { useAuth } from '@/src/components/AuthProvider';
import { db } from '@/src/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, increment, limit, getDocs, deleteDoc, orderBy } from 'firebase/firestore';
import { UserProfile, PraiseCoupon } from '@/src/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Gift, Trophy, Play, Coins, Sparkles, ArrowDown, MapPin, CalendarDays, Ticket, History, RefreshCw, Info } from 'lucide-react';
import confetti from 'canvas-confetti';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';

interface RouletteSetting {
  id: string;
  label: string;
  multiplier: number;
  probability: number;
  color: string;
}

const DEFAULT_ROULETTE_SETTINGS: RouletteSetting[] = [
  { id: '1', label: '꽝', multiplier: 0, probability: 0.4, color: '#94a3b8' },
  { id: '2', label: '1배', multiplier: 1, probability: 0.3, color: '#3b82f6' },
  { id: '3', label: '2배', multiplier: 2, probability: 0.2, color: '#10b981' },
  { id: '4', label: '5배', multiplier: 5, probability: 0.08, color: '#f59e0b' },
  { id: '5', label: '10배', multiplier: 10, probability: 0.02, color: '#ef4444' },
];

export const Entertainment: React.FC = () => {
  const { profile } = useAuth();
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [rouletteSettings, setRouletteSettings] = useState<RouletteSetting[]>(DEFAULT_ROULETTE_SETTINGS);
  const [pointsToBet, setPointsToBet] = useState(1);
  const [showWinOverlay, setShowWinOverlay] = useState(false);
  const [winMultiplier, setWinMultiplier] = useState<number | null>(null);
  const [praiseHistory, setPraiseHistory] = useState<PraiseCoupon[]>([]);
  const [gameHistory, setGameHistory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('roulette');
  const [lastResult, setLastResult] = useState<{ label: string; multiplier: number; winPoints: number } | null>(null);

  // Result Overlay State
  const [resultOverlay, setResultOverlay] = useState<{
    isOpen: boolean;
    type: 'win' | 'loss' | 'info';
    title: string;
    message: string;
    amount?: number;
  } | null>(null);

  // Snail Race state
  const [snailPositions, setSnailPositions] = useState([0, 0, 0, 0, 0]);
  const [snailStatus, setSnailStatus] = useState<'IDLE' | 'RACING' | 'FINISHED'>('IDLE');
  const [selectedSnail, setSelectedSnail] = useState<number | null>(null);
  const [raceWinner, setRaceWinner] = useState<number | null>(null);
  const [snailWinPr, setSnailWinPr] = useState<number[]>([1, 1, 1, 1, 1]);
  
  // Daily Chest & Scratch
  const [chestLastOpened, setChestLastOpened] = useState<string | null>(null);
  const [isOpeningChest, setIsOpeningChest] = useState(false);
  const [isScratching, setIsScratching] = useState(false);

  // Lotto state
  const [lottoHistory, setLottoHistory] = useState<any[]>([]);
  const [currentLottoLines, setCurrentLottoLines] = useState<number[][]>([]);
  const [isGeneratingLotto, setIsGeneratingLotto] = useState(false);
  const LOTTO_COST = 0.2;

  useEffect(() => {
    if (!profile) return;
    
    // Check daily chest
    const today = new Date().toISOString().split('T')[0];
    const stored = localStorage.getItem(`chest_${profile.uid}_${today}`);
    setChestLastOpened(stored);

    // Fetch praise history (received)
    const qPraise = query(collection(db, 'praiseCoupons'), where('receiverUid', '==', profile.uid));
    const unsubscribePraise = onSnapshot(qPraise, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PraiseCoupon));
      setPraiseHistory(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    });

    // Fetch Game Settings
    const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'entertainment'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.snailProbabilities) {
          setSnailWinPr(data.snailProbabilities);
        }
      }
    });

    // Fetch game history
    const qGame = query(collection(db, 'lottoHistory'), where('uid', '==', profile.uid));
    const unsubscribeGame = onSnapshot(qGame, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      const sorted = data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      // Separate lotto and roulette/chest game history
      const lottoOnly = sorted.filter(h => h.lines);
      const otherGames = sorted.filter(h => !h.lines);
      setLottoHistory(lottoOnly.slice(0, 5));
      setGameHistory(otherGames.slice(0, 5));
    });

    return () => {
      unsubscribePraise();
      unsubscribeGame();
      unsubscribeSettings();
    };
  }, [profile]);

  const addHistoryItem = async (data: any) => {
    if (!profile) return;
    try {
      await addDoc(collection(db, 'lottoHistory'), {
        ...data,
        createdAt: new Date().toISOString()
      });
      
      // Prune history to keep only last 5 for EACH category (Lotto vs Games)
      // fetch all for user and prune both categories
      const qAll = query(
        collection(db, 'lottoHistory'), 
        where('uid', '==', profile.uid), 
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(qAll);
      const docs = snapshot.docs;
      
      const lottoDocs = docs.filter(d => d.data().lines);
      const gameDocs = docs.filter(d => !d.data().lines);
      
      const deletions: any[] = [];
      if (lottoDocs.length > 5) lottoDocs.slice(5).forEach(d => deletions.push(deleteDoc(d.ref)));
      if (gameDocs.length > 5) gameDocs.slice(5).forEach(d => deletions.push(deleteDoc(d.ref)));
      
      if (deletions.length > 0) await Promise.all(deletions);
    } catch (e) {
      console.error("History error:", e);
    }
  };

  const spinRoulette = async () => {
    if (isSpinning) return;
    if (!profile || (profile.points || 0) < pointsToBet) {
      toast.error('보유 포인트가 부족합니다.');
      return;
    }

    setIsSpinning(true);
    const rand = Math.random();
    let cumulativeProb = 0;
    let resultIndex = 0;
    
    for (let i = 0; i < rouletteSettings.length; i++) {
      cumulativeProb += rouletteSettings[i].probability;
      if (rand <= cumulativeProb) {
        resultIndex = i;
        break;
      }
    }

    const result = rouletteSettings[resultIndex];
    const segmentAngle = 360 / rouletteSettings.length;
    const resultCenterAngle = (resultIndex * segmentAngle) + (segmentAngle / 2);
    const targetRotation = (360 - resultCenterAngle) % 360;
    const currentRotationMod = rotation % 360;
    const extraShift = (targetRotation - currentRotationMod + 360) % 360;
    const finalRotation = rotation + 1800 + extraShift;
    
    setRotation(finalRotation);
    setLastResult(null);
    setShowWinOverlay(false);

    setTimeout(async () => {
      setIsSpinning(false);
      const winPoints = Math.floor(pointsToBet * result.multiplier);
      const netChange = winPoints - pointsToBet;
      
      setLastResult({ label: result.label, multiplier: result.multiplier, winPoints });
      setWinMultiplier(result.multiplier);
      setShowWinOverlay(true);
      
      try {
        await addHistoryItem({
          uid: profile.uid,
          label: result.label,
          multiplier: result.multiplier,
          winPoints,
          betPoints: pointsToBet
        });
        
        await updateDoc(doc(db, 'users', profile.uid), {
          points: increment(netChange)
        });

        if (result.multiplier > 1) {
          confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
          setResultOverlay({
            isOpen: true,
            type: 'win',
            title: '축하합니다!',
            message: `${result.label} 당첨!`,
            amount: winPoints
          });
        } else if (result.multiplier === 1) {
          setResultOverlay({
            isOpen: true,
            type: 'info',
            title: '본전입니다',
            message: '베팅 포인트를 돌려받았습니다.',
            amount: winPoints
          });
        } else {
          setResultOverlay({
            isOpen: true,
            type: 'loss',
            title: '아쉽네요...',
            message: '다음 기회를 노려보세요!',
            amount: 0
          });
        }
      } catch (error) {
        toast.error('오류가 발생했습니다.');
      }
    }, 4000);
  };

  const openDailyChest = async () => {
    if (!profile || chestLastOpened) return;
    setIsOpeningChest(true);
    const bonus = Math.floor(Math.random() * 5) + 1;
    setTimeout(async () => {
      try {
        await updateDoc(doc(db, 'users', profile.uid), { points: increment(bonus) });
        await addHistoryItem({
          uid: profile.uid,
          label: '데일리 보물상자',
          winPoints: bonus,
          betPoints: 0
        });
        const today = new Date().toISOString().split('T')[0];
        localStorage.setItem(`chest_${profile.uid}_${today}`, today);
        setChestLastOpened(today);
        confetti({ particleCount: 50, spread: 30, origin: { y: 0.8 } });
        setResultOverlay({
          isOpen: true,
          type: 'win',
          title: '데일리 보너스',
          message: '상자에서 포인트가 나왔습니다!',
          amount: bonus
        });
      } catch (e) {
        toast.error('오류 발생');
      } finally { setIsOpeningChest(false); }
    }, 1500);
  };

  const handleScratch = async () => {
    if (!profile || (profile.points || 0) < 2) {
      toast.error('포인트 부족 (2P 필요)');
      return;
    }
    setIsScratching(true);
    const win = Math.random() > 0.8 ? 10 : (Math.random() > 0.5 ? 2 : 0);
    setTimeout(async () => {
      try {
        await updateDoc(doc(db, 'users', profile.uid), { points: increment(win - 2) });
        await addHistoryItem({
          uid: profile.uid,
          label: '행운의 스크래치',
          winPoints: win,
          betPoints: 2
        });
        if (win > 0) {
          confetti({ particleCount: 80, spread: 40, origin: { y: 0.7 } });
          setResultOverlay({
            isOpen: true,
            type: 'win',
            title: '스크래치 당첨!',
            message: '행운의 주인공입니다!',
            amount: win
          });
        } else { 
          setResultOverlay({
            isOpen: true,
            type: 'loss',
            title: '꽝!',
            message: '아쉽게도 빈 칸입니다.',
            amount: 0
          });
        }
      } catch (e) { toast.error('오류 발생'); } finally { setIsScratching(false); }
    }, 1000);
  };

  const handleGenerateLotto = async () => {
    if (!profile) return;
    if ((profile?.points || 0) < LOTTO_COST) {
       toast.error(`포인트 부족 (${LOTTO_COST}P 필요)`);
       return;
    }
    setIsGeneratingLotto(true);
    
    setTimeout(async () => {
      const lines: number[][] = [];
      for (let i = 0; i < 5; i++) {
        const nums = new Set<number>();
        while(nums.size < 7) { nums.add(Math.floor(Math.random() * 45) + 1); }
        const sorted = Array.from(nums).slice(0, 6).sort((a,b) => a-b);
        lines.push([...sorted, Array.from(nums)[6]]);
      }
      setCurrentLottoLines(lines);

      try {
        await updateDoc(doc(db, 'users', profile.uid), { points: increment(-LOTTO_COST) });
        await addHistoryItem({
          uid: profile.uid,
          lines: lines.map(line => line.join(',')),
        });
        setResultOverlay({
          isOpen: true,
          type: 'win',
          title: '로또 발권 완료',
          message: '5세트 번호가 생성되었습니다. 행운을 빕니다!',
        });
      } catch (e) { toast.error('저장 오류'); }
      finally { setIsGeneratingLotto(false); }
    }, 1000);
  };

  const getBallColor = (num: number) => {
    if (num <= 10) return 'bg-yellow-400';
    if (num <= 20) return 'bg-blue-400';
    if (num <= 30) return 'bg-red-400';
    if (num <= 40) return 'bg-slate-400';
    return 'bg-emerald-400';
  };

  const startSnailRace = async () => {
    if (snailStatus === 'RACING') return;
    if (selectedSnail === null) {
      toast.error('배팅할 달팽이를 선택해주세요!');
      return;
    }
    if (!profile || (profile.points || 0) < pointsToBet) {
      toast.error('보유 포인트가 부족합니다.');
      return;
    }

    setSnailStatus('RACING');
    setSnailPositions([0, 0, 0, 0, 0]);
    setRaceWinner(null);

    // Initial deduction logic is usually handled with the win. 
    // But for a race, let's deduct immediately to be safe.
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        points: increment(-pointsToBet)
      });
    } catch (error) {
      toast.error('포인트 차감 중 오류가 발생했습니다.');
      setSnailStatus('IDLE');
      return;
    }

    const winRoll = Math.random();
    // 10% chance to win if selectedSnail is targetWinner
    const targetWinnerIdx = winRoll < 0.1 
      ? selectedSnail 
      : (selectedSnail + Math.floor(Math.random() * 4) + 1) % 5;

    const interval = setInterval(() => {
      setSnailPositions(prev => {
        const newPos = prev.map((p, idx) => {
          if (p >= 100) return p;
          
          // Weighted speed based on whether they are the target winner
          // The target winner gets a guaranteed speed advantage
          const isTarget = idx === targetWinnerIdx;
          const baseSpeed = isTarget ? 3.0 : 1.5;
          const randomSpeed = Math.random() * 3.0;
          
          const weight = snailWinPr[idx] || 1;
          const move = (baseSpeed + randomSpeed) * (weight / 1);
          
          return Math.min(100, p + move);
        });

        const winnerIndex = newPos.findIndex(p => p >= 100);
        if (winnerIndex !== -1) {
          clearInterval(interval);
          finishRace(winnerIndex);
          return newPos;
        }
        return newPos;
      });
    }, 100);
  };

  const finishRace = async (winnerIdx: number) => {
    if (!profile) return;
    setSnailStatus('FINISHED');
    setRaceWinner(winnerIdx);

    const winMultiplier = 4.5; // 4.5x for picking the right one out of 5
    const winPoints = winnerIdx === selectedSnail ? Math.floor(pointsToBet * winMultiplier) : 0;

    try {
      if (winPoints > 0) {
        await updateDoc(doc(db, 'users', profile.uid), {
          points: increment(winPoints)
        });
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        setResultOverlay({
          isOpen: true,
          type: 'win',
          title: '우승 적중!',
          message: `${winnerIdx + 1}번 달팽이가 승리했습니다!`,
          amount: winPoints
        });
      } else {
        setResultOverlay({
          isOpen: true,
          type: 'loss',
          title: '적중 실패',
          message: `${winnerIdx + 1}번 달팽이가 1등으로 들어왔습니다.`,
          amount: 0
        });
      }
      
      await addHistoryItem({
        uid: profile.uid,
        label: `달팽이 레이스 (${winnerIdx + 1}번 승리)`,
        winPoints,
        betPoints: pointsToBet
      });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto pb-32 flex flex-col items-center font-sans px-4">
      <header className="flex flex-col gap-3 items-center text-center py-8 w-full">
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex items-center gap-4 bg-white px-8 py-3 rounded-full shadow-xl border border-slate-100 ring-2 ring-primary/5"
        >
          <div className="w-2.5 h-2.5 bg-primary rounded-full animate-pulse shadow-[0_0_10px_rgba(37,99,235,0.5)]" />
          <h2 className="text-2xl font-black tracking-tighter text-slate-900 italic">건명 놀이터</h2>
        </motion.div>
        <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-[0.4em] leading-none">건명 엔터테인먼트</p>
      </header>

      {/* Point Status Card */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="w-full max-w-sm"
      >
        <Card className="border-none shadow-2xl bg-white rounded-[2.5rem] overflow-hidden w-full ring-1 ring-slate-100">
          <CardContent className="p-8 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-14 h-14 bg-yellow-50 rounded-2xl flex items-center justify-center shadow-inner">
                <Coins className="w-7 h-7 text-yellow-500" />
            </div>
            <div className="space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1 block">자산 현황</span>
                <div className="flex flex-col items-center">
                  <span className="text-4xl font-black text-primary tracking-tighter">{(profile?.points || 0).toLocaleString()}P</span>
                  <div className="flex items-center gap-2 mt-2 bg-slate-50 px-3 py-1 rounded-full border border-slate-100 text-[9px] font-bold text-slate-500">
                    현금 가치: <span className="text-slate-900 font-black">{((profile?.points || 0) * 5000).toLocaleString()}원</span>
                  </div>
                </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Custom Tabs Navigation */}
      <div className="w-full mt-12 px-2 flex justify-center z-40">
        <div className="bg-white p-1.5 rounded-[2.5rem] flex items-center w-full max-w-[420px] shadow-2xl border border-slate-50">
          {[
            { id: 'roulette', label: '룰렛' },
            { id: 'lotto', label: '로또' },
            { id: 'snail', label: '달팽이' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex-1 py-3 px-1 rounded-full font-black text-[12px] sm:text-sm tracking-tight transition-all duration-300",
                activeTab === tab.id 
                  ? "bg-primary text-white shadow-lg scale-105 z-10" 
                  : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full mt-10 min-h-[550px] flex flex-col items-center">
        <AnimatePresence mode="wait">
          {activeTab === 'roulette' && (
            <motion.div
              key="roulette"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center w-full space-y-10"
            >
              <Card className="border-none shadow-2xl bg-white rounded-[3rem] overflow-hidden w-full max-w-[340px] ring-1 ring-slate-100">
                <CardContent className="p-8 flex flex-col items-center space-y-8">
                  <div className="relative flex flex-col items-center w-full">
                    <div className="absolute top-[-10px] z-30">
                      <ArrowDown className="w-10 h-10 text-yellow-500 fill-yellow-500 animate-bounce" />
                    </div>
                    
                    <motion.div 
                      className="w-60 h-60 rounded-full border-[10px] border-slate-900 relative overflow-hidden shadow-2xl bg-slate-900"
                      animate={{ rotate: rotation }}
                      transition={{ duration: 4, ease: [0.15, 0, 0.1, 1] }}
                    >
                      {rouletteSettings.map((s, i) => {
                        const angle = 360 / rouletteSettings.length;
                        return (
                          <div key={s.id} className="absolute top-0 left-1/2 w-1/2 h-full origin-left flex items-start justify-center pt-6"
                            style={{ 
                              transform: `rotate(${i * angle}deg)`, 
                              backgroundColor: s.color, 
                              clipPath: `polygon(0 0, 100% 0, 100% ${Math.tan((angle * Math.PI) / 360) * 100}%, 0 50%)` 
                            }}>
                            <span 
                              className="text-white font-black text-[9px] tracking-tight" 
                              style={{ transform: `rotate(${angle / 2}deg) translateY(-2px)` }}
                            >
                              {s.label}
                            </span>
                          </div>
                        );
                      })}
                    </motion.div>

                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
                      <div className="w-16 h-16 rounded-full bg-slate-900 border-2 border-slate-800 flex flex-col items-center justify-center shadow-2xl">
                        <div className="text-white font-black text-lg tracking-tighter">
                          {isSpinning ? "회전" : (showWinOverlay ? `${winMultiplier}x` : "시작")}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="w-full space-y-4">
                    <div className="relative">
                      <Coins className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input 
                        type="number" 
                        value={pointsToBet} 
                        onChange={(e) => setPointsToBet(Math.max(1, parseInt(e.target.value) || 1))} 
                        className="pl-12 h-14 rounded-2xl bg-slate-50 border-slate-200 font-black text-center" 
                      />
                    </div>
                    <Button 
                      onClick={spinRoulette} 
                      disabled={isSpinning || (profile?.points || 0) < pointsToBet} 
                      className="w-full h-14 rounded-2xl font-black bg-primary text-white text-lg shadow-xl shadow-primary/20 transition-all active:scale-95"
                    >
                      {isSpinning ? "회전 중..." : "룰렛 돌리기"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="w-full max-w-sm space-y-4">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">최근 게임 내역</h3>
                <div className="grid gap-2 px-2">
                  {gameHistory.map((h, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                      <div className="flex items-center gap-3">
                         <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", h.winPoints > 0 ? "bg-emerald-50 text-emerald-500" : "bg-slate-50 text-slate-300")}>
                            <Trophy className="w-4 h-4" />
                         </div>
                         <div className="flex flex-col text-left">
                            <span className="text-xs font-black text-slate-800">{h.label}</span>
                            <span className="text-[9px] font-bold text-slate-400">{format(new Date(h.createdAt), 'HH:mm:ss')}</span>
                         </div>
                      </div>
                      <div className="text-right">
                        <div className={cn("text-base font-black tracking-tight", h.winPoints > 0 ? "text-emerald-500" : "text-slate-900")}>
                          {h.winPoints > 0 ? `+${h.winPoints}P` : "꽝"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'lotto' && (
            <motion.div
              key="lotto"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center w-full space-y-8"
            >
              <Card className="border-none shadow-2xl bg-white rounded-[3rem] overflow-hidden w-full max-w-sm ring-1 ring-slate-100">
                <CardHeader className="p-8 pb-4 text-center">
                   <CardTitle className="text-xl font-black flex items-center justify-center gap-2 text-slate-800">
                      <Ticket className="w-6 h-6 text-purple-600" /> 행운의 로또
                   </CardTitle>
                </CardHeader>
                <CardContent className="p-8 space-y-8 flex flex-col items-center">
                   <div className="w-full bg-slate-50 p-6 rounded-[2rem] text-center space-y-2 border border-slate-100 shadow-inner">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">로또 5게임 세트</p>
                      <p className="text-lg font-black text-slate-900 leading-none">비용: 0.2P <span className="text-purple-600 ml-1">1,000원</span></p>
                   </div>
                   
                   <div className="w-full flex flex-col gap-3 py-2 min-h-[220px] justify-center items-center">
                      {currentLottoLines.map((line, i) => (
                        <div key={i} className="flex gap-1.5 justify-center items-center">
                           {line.slice(0, 6).map((n, idx) => (
                             <div key={idx} className={cn("w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-black text-white shadow-md", getBallColor(n))}>{n}</div>
                           ))}
                           <div className="text-slate-300 font-bold text-sm">+</div>
                           <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-black text-white shadow-md", getBallColor(line[6]))}>{line[6]}</div>
                        </div>
                      ))}
                      {!currentLottoLines.length && !isGeneratingLotto && (
                        <div className="flex flex-col items-center opacity-30">
                          <Ticket className="w-10 h-10 mb-2 text-slate-300" />
                          <p className="text-[10px] font-black text-slate-400">행운의 번호 발급</p>
                        </div>
                      )}
                      {isGeneratingLotto && <RefreshCw className="w-10 h-10 animate-spin text-purple-200" />}
                   </div>

                   <Button onClick={handleGenerateLotto} disabled={isGeneratingLotto} className="w-full h-16 rounded-[1.5rem] bg-purple-600 text-white font-black text-xl active:scale-95 shadow-lg shadow-purple-100">
                      {isGeneratingLotto ? "생성 중..." : "로또 발급하기"}
                   </Button>
                </CardContent>
              </Card>

              <div className="w-full max-w-sm space-y-4 px-2">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">최근 로또 생성 내역</h3>
                  <div className="grid gap-3">
                    {lottoHistory.map((h, i) => (
                      <Card key={i} className="border-none shadow-sm bg-white rounded-2xl p-5 border border-slate-100">
                         <div className="flex justify-between items-center mb-4">
                            <span className="text-[9px] font-black text-purple-600 bg-purple-50 px-2.5 py-1 rounded-full uppercase">Ticket #{i+1}</span>
                            <span className="text-[9px] font-bold text-slate-400">{format(new Date(h.createdAt), 'MM.dd HH:mm')}</span>
                         </div>
                         <div className="flex flex-wrap gap-1 justify-center">
                            {h.lines[0].split(',').map((n: string, idx: number) => (
                              <div key={idx} className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-black text-white", getBallColor(parseInt(n)))}>{n}</div>
                            ))}
                         </div>
                      </Card>
                    ))}
                  </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'snail' && (
            <motion.div
              key="snail"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center w-full space-y-8"
            >
              <Card className="border-none shadow-2xl bg-white rounded-[3rem] overflow-hidden w-full max-w-sm ring-1 ring-slate-100">
                <CardHeader className="p-8 pb-4 text-center">
                   <CardTitle className="text-xl font-black flex items-center justify-center gap-2 text-slate-800">
                      🐌 달팽이 레이스
                   </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-8">
                  <div className="bg-slate-900 p-6 rounded-[2rem] space-y-4 relative overflow-hidden">
                    <div className="absolute right-4 top-0 bottom-0 w-px bg-white/20 border-r border-dashed border-white/40 z-0" />
                    
                    {[0, 1, 2, 3, 4].map((idx) => (
                      <div key={idx} className="relative h-8 flex items-center bg-white/5 rounded-full px-2">
                        <motion.div 
                          className="absolute left-0 flex items-center justify-center text-2xl z-10"
                          animate={{ left: `${snailPositions[idx]}%` }}
                          transition={{ type: 'spring', damping: 20, stiffness: 60 }}
                          style={{ marginLeft: '-15px' }}
                        >
                          <span className={cn(
                            "filter transition-all",
                            snailStatus === 'RACING' ? "drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" : ""
                          )}>🐌</span>
                          <span className="absolute -top-4 text-[8px] font-black text-white opacity-50">{idx + 1}번</span>
                        </motion.div>
                        <div className="w-full h-px bg-white/10" />
                      </div>
                    ))}
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-5 gap-2">
                      {[0, 1, 2, 3, 4].map((idx) => (
                        <button
                          key={idx}
                          disabled={snailStatus === 'RACING'}
                          onClick={() => setSelectedSnail(idx)}
                          className={cn(
                            "h-12 rounded-2xl font-black text-xs transition-all border-2",
                            selectedSnail === idx 
                              ? "bg-primary border-primary text-white shadow-lg scale-105" 
                              : "bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100"
                          )}
                        >
                          {idx + 1}번
                        </button>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Coins className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input 
                          type="number" 
                          value={pointsToBet} 
                          disabled={snailStatus === 'RACING'}
                          onChange={(e) => setPointsToBet(Math.max(1, parseInt(e.target.value) || 1))} 
                          className="pl-12 h-14 rounded-2xl bg-slate-50 border-slate-200 font-black text-center" 
                        />
                      </div>
                      <Button 
                        onClick={startSnailRace} 
                        disabled={snailStatus === 'RACING' || (profile?.points || 0) < pointsToBet}
                        className="h-14 px-8 rounded-2xl font-black bg-emerald-500 text-white shadow-xl shadow-emerald-100 active:scale-95"
                      >
                        {snailStatus === 'RACING' ? "경주 중..." : "START"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="w-full max-w-sm space-y-4 px-2">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">레이스 규칙</h3>
                <Card className="border-none shadow-sm bg-white rounded-3xl p-5 space-y-3">
                   <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center text-primary">
                        <Info className="w-4 h-4" />
                      </div>
                      <p className="text-xs font-bold text-slate-600">선택한 달팽이가 1등으로 들어오면 배팅액의 <span className="text-primary font-black">4.5배</span>를 획득합니다!</p>
                   </div>
                </Card>
              </div>
            </motion.div>
          ) /* Snail Race end */}

          {activeTab === 'daily' && (
            <motion.div
              key="daily"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center w-full space-y-6"
            >
              <Card className="border-none shadow-2xl bg-white rounded-[3rem] overflow-hidden w-full max-w-sm text-center ring-1 ring-slate-100">
                <CardContent className="p-12 flex flex-col items-center space-y-8">
                  <div className="w-20 h-20 bg-primary/5 rounded-3xl flex items-center justify-center text-primary shadow-inner">
                    <Gift className={cn("w-10 h-10", isOpeningChest && "animate-bounce")} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-black text-slate-900 leading-none">데일리 상자</h3>
                    <p className="text-[11px] font-bold text-slate-400 italic">오늘의 행운 포인트</p>
                  </div>
                  <Button disabled={isOpeningChest || !!chestLastOpened} onClick={openDailyChest} className="w-full h-16 rounded-[1.5rem] font-black text-xl shadow-xl shadow-primary/10 transition-all active:scale-95">
                    {chestLastOpened ? "이미 완료" : "상자 열기"}
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-none shadow-2xl bg-white rounded-[3rem] overflow-hidden w-full max-w-sm text-center ring-1 ring-slate-100">
                <CardContent className="p-12 flex flex-col items-center space-y-8">
                  <div className="w-20 h-20 bg-yellow-50 rounded-3xl flex items-center justify-center text-yellow-500 shadow-inner">
                    <Sparkles className={cn("w-10 h-10", isScratching && "animate-pulse")} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-black text-slate-900 leading-none">행운 스크래치</h3>
                    <p className="text-[11px] font-bold text-slate-400 italic">베타 테스트 (2P)</p>
                  </div>
                  <Button disabled={isScratching || (profile?.points || 0) < 2} onClick={handleScratch} className="w-full h-16 rounded-[1.5rem] font-black text-xl bg-yellow-400 text-white shadow-xl shadow-yellow-100 transition-all active:scale-95">
                    {isScratching ? "긁는 중..." : "스크래치"}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {activeTab === 'shop' && (
            <motion.div
              key="shop"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center w-full space-y-10"
            >
              <Card className="border-none shadow-2xl bg-slate-900 rounded-[2.5rem] p-8 w-full max-w-sm">
                <div className="flex justify-between items-end mb-6">
                   <div className="flex flex-col gap-1 text-left">
                     <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">전사 포인트 목표</span>
                     <span className="text-white text-base font-black italic">레벨 4 달성도</span>
                   </div>
                   <span className="text-yellow-500 text-2xl font-black italic">78%</span>
                </div>
                <div className="h-3 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700 w-full mb-4">
                  <motion.div initial={{ width: 0 }} animate={{ width: '78%' }} className="h-full bg-gradient-to-r from-primary to-emerald-400 rounded-full shadow-[0_0_15px_rgba(37,99,235,0.4)]" />
                </div>
                <p className="text-[8px] text-slate-500 font-bold text-center">100% 달성 시 전 사원 보너스!</p>
              </Card>

              <div className="grid grid-cols-2 gap-4 w-full max-w-sm px-2">
                {[
                  { name: '스타벅스 커피', price: 1, icon: '☕' },
                  { name: '주유권 (2만)', price: 4, icon: '⛽' },
                  { name: '조퇴권 (1H)', price: 10, icon: '🏠' },
                  { name: '치킨 기프티콘', price: 6, icon: '🍗' },
                  { name: 'CGV 영화권', price: 3, icon: '🎬' },
                  { name: '휴가 하루!', price: 20, icon: '🏖️' },
                ].map((item, i) => (
                  <Card key={i} className="border-none bg-white rounded-[2rem] p-6 flex flex-col items-center text-center space-y-2 opacity-80 group hover:opacity-100 transition-all shadow-sm">
                    <span className="text-3xl group-hover:scale-110 transition-transform">{item.icon}</span>
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-slate-800 block truncate leading-none">{item.name}</span>
                      <Badge className="bg-slate-50 text-primary border-none font-black text-[9px] px-2 py-0">+{item.price}P</Badge>
                    </div>
                  </Card>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

       {/* Received Praise History */}
       <div className="w-full max-w-sm mx-auto mt-20 space-y-6">
          <div className="flex items-center gap-2 px-4 justify-center">
            <div className="w-1.5 h-4 bg-emerald-400 rounded-full" />
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest leading-none">나의 칭찬 훈장함</h3>
          </div>
          <div className="grid gap-3 px-2">
            {praiseHistory.length > 0 ? praiseHistory.map((p) => (
              <Card key={p.id} className="border-none shadow-sm bg-white rounded-[2.5rem] overflow-hidden border border-slate-100">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex flex-col text-left">
                       <span className="text-[11px] font-black text-slate-900 tracking-tight leading-none mb-1">{p.senderName} ({p.senderRole})</span>
                       <span className="text-[8px] font-bold text-slate-400">{format(new Date(p.createdAt), 'MM.dd HH:mm')}</span>
                    </div>
                    <Badge className="bg-emerald-50 text-emerald-500 border-none font-black text-[10px]">+{p.points}P</Badge>
                  </div>
                  <p className="text-sm font-bold text-slate-600 border-l-4 border-emerald-400 pl-4 py-1.5 italic text-left leading-relaxed">"{p.reason}"</p>
                  <div className="mt-4 flex items-center gap-2 text-[9px] text-slate-400 font-bold uppercase tracking-widest border-t border-slate-50 pt-3">
                     <MapPin className="w-3 h-3 text-emerald-400" /> {p.location}
                  </div>
                </CardContent>
              </Card>
            )) : (
              <div className="py-20 bg-white rounded-[3rem] text-center opacity-30 flex flex-col items-center border-2 border-dashed border-slate-100 mx-4">
                 <Trophy className="w-10 h-10 mb-3" />
                 <span className="text-[10px] font-black uppercase tracking-widest">내역이 없습니다.</span>
              </div>
            )}
          </div>
       </div>
       <GameResultOverlay result={resultOverlay} onClose={() => setResultOverlay(null)} />
    </div>
  );
};

const GameResultOverlay = ({ result, onClose }: { result: any, onClose: () => void }) => {
  return (
    <AnimatePresence>
      {result?.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
          <motion.div
            initial={{ scale: 0.5, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.5, opacity: 0, y: 20 }}
            className="bg-white rounded-[3rem] p-8 max-w-sm w-full shadow-2xl text-center space-y-6 relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {result.type === 'win' && (
              <div className="absolute inset-0 bg-emerald-500/5 animate-pulse pointer-events-none" />
            )}
            
            <div className="relative z-10 space-y-6">
              <div className={cn(
                "w-20 h-20 mx-auto rounded-3xl flex items-center justify-center shadow-lg",
                result.type === 'win' ? "bg-emerald-500 text-white" : 
                result.type === 'loss' ? "bg-slate-200 text-slate-400" : "bg-primary text-white"
              )}>
                {result.type === 'win' ? <Trophy className="w-10 h-10" /> : 
                  result.type === 'loss' ? <div className="text-4xl font-black">?</div> : <Sparkles className="w-10 h-10" />}
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-black text-slate-900 tracking-tighter">{result.title}</h3>
                <p className="text-sm font-bold text-slate-500">{result.message}</p>
              </div>

              {result.amount !== undefined && result.amount > 0 && (
                  <div className="py-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-4xl font-black text-primary tracking-tighter">+{result.amount.toLocaleString()}P</span>
                  </div>
              )}

              <Button 
                onClick={onClose}
                className={cn(
                  "w-full h-14 rounded-2xl font-black text-lg shadow-xl transition-all active:scale-95",
                  result.type === 'win' ? "bg-emerald-500 hover:bg-emerald-600" : 
                  result.type === 'loss' ? "bg-slate-900" : "bg-primary"
                )}
              >
                확인
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
