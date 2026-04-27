import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { 
  Hammer, 
  Zap, 
  TrendingUp, 
  Ship, 
  Settings2, 
  Sparkles, 
  Fan, 
  UserCheck,
  Flag,
  HardHat,
  Construction
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export const ShipClicker = () => {
  const [progress, setProgress] = useState(0);
  const [points, setPoints] = useState(0);
  const [clickPower, setClickPower] = useState(1);
  const [autoPower, setAutoPower] = useState(0);
  const [level, setLevel] = useState(1);
  const [isClicking, setIsClicking] = useState(false);
  const [weldPoints, setWeldPoints] = useState<{ id: number; x: number; y: number }[]>([]);

  // Upgrades
  const [clickCost, setClickCost] = useState(10);
  const [autoCost, setAutoCost] = useState(50);

  // Auto-production
  useEffect(() => {
    if (autoPower > 0) {
      const interval = setInterval(() => {
        setProgress(prev => {
          const next = prev + (autoPower / 10);
          return next >= 100 ? 100 : next;
        });
      }, 100);
      return () => clearInterval(interval);
    }
  }, [autoPower]);

  // Handle Win/Reset
  useEffect(() => {
    if (progress >= 100) {
      toast.success('경축! 대형 유조선 건조 완료 및 진수식 거행! 🎆', {
        description: '다음 단계의 더 큰 선박 건조를 시작합니다.',
        style: { background: '#f59e0b', color: '#fff' }
      });
      setPoints(p => p + (level * 500));
      setTimeout(() => {
        setProgress(0);
        setLevel(l => l + 1);
      }, 3000);
    }
  }, [progress, level]);

  const handleTap = (e: React.MouseEvent | React.TouchEvent) => {
    setIsClicking(true);
    setProgress(prev => Math.min(100, prev + clickPower));
    setPoints(p => p + (clickPower * 2));
    
    // Add weld spark effect at click position
    const id = Date.now();
    setWeldPoints(prev => [...prev.slice(-5), { id, x: Math.random() * 200 - 100, y: Math.random() * 50 - 25 }]);
    
    setTimeout(() => {
      setIsClicking(false);
      setWeldPoints(prev => prev.filter(p => p.id !== id));
    }, 200);
  };

  const buyUpgrade = (type: 'CLICK' | 'AUTO') => {
    if (type === 'CLICK') {
      if (points >= clickCost) {
        setPoints(p => p - clickCost);
        setClickPower(cp => cp + 1);
        setClickCost(c => Math.floor(c * 1.6));
        toast.success('클릭 파워 강화! (용접 속도 상승)');
      } else toast.error('포인트가 부족합니다.');
    } else {
      if (points >= autoCost) {
        setPoints(p => p - autoCost);
        setAutoPower(ap => ap + 0.8);
        setAutoCost(c => Math.floor(c * 1.8));
        toast.success('자동 용접 로봇 배치 완료!');
      } else toast.error('포인트가 부족합니다.');
    }
  };

  // Logic: 5 Stages of Ship Evolution
  const stage = progress >= 100 ? 5 : progress >= 75 ? 4 : progress >= 50 ? 3 : progress >= 25 ? 2 : 1;

  return (
    <div className="flex flex-col gap-6 p-4 w-full h-full max-w-3xl mx-auto overflow-y-auto scrollbar-hide pb-24">
      
      {/* 1단계 (2): 진행 바 (Progress Bars) */}
      <div className="bg-card/50 backdrop-blur-xl p-6 rounded-[2.5rem] border border-white/10 shadow-2xl">
         <div className="flex justify-between items-end mb-3">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">SHIPYARD STATUS</span>
              <h2 className="text-2xl font-black text-white italic tracking-tighter">LV.{level} 조선소 가동 중</h2>
            </div>
            <div className="text-right">
               <p className="text-3xl font-black text-primary italic drop-shadow-lg">{Math.floor(progress)}%</p>
            </div>
         </div>
         {/* 이미지 설계도 1단계(2) Progress Bar 스타일 */}
         <div className="h-4 bg-slate-800 rounded-full border border-white/5 overflow-hidden shadow-inner p-1">
            <motion.div 
               initial={{ width: 0 }}
               animate={{ width: `${progress}%` }}
               className={cn(
                 "h-full rounded-full transition-colors duration-500",
                 progress < 50 ? "bg-slate-400" : progress < 100 ? "bg-orange-400" : "bg-primary"
               )}
            />
         </div>
         <div className="flex justify-between mt-4">
            <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/5">
               <Sparkles className="w-3 h-3 text-yellow-400" />
               <span className="text-[10px] font-black text-white/70 italic">{points.toLocaleString()} PTS</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/5">
                <Zap className="w-3 h-3 text-blue-400" />
                <span className="text-[10px] font-black text-white/70 italic">{(autoPower * 10).toFixed(1)}%/SEC</span>
            </div>
         </div>
      </div>

      {/* 5단계: 선박 진화 및 흐름 (Ship Evolution Stage) */}
      <div className="relative aspect-[16/10] bg-slate-950 rounded-[3rem] border-8 border-white/10 overflow-hidden shadow-[inset_0_20px_50px_rgba(0,0,0,0.5)]">
        
        {/* 4단계: 배경 방치형 애니메이션 루프 */}
        <div className="absolute inset-0 pointer-events-none opacity-40">
           {/* 연기 발생 루프 (4-3) */}
           {progress > 0 && [...Array(3)].map((_, i) => (
             <motion.div
               key={i}
               initial={{ y: 300, opacity: 0 }}
               animate={{ y: -50, opacity: [0, 0.4, 0], scale: [1, 2, 3] }}
               transition={{ duration: 4, repeat: Infinity, delay: i * 1.5 }}
               className="absolute bottom-20 left-1/4"
             >
                <div className="w-20 h-20 bg-slate-400/50 rounded-full blur-3xl" />
             </motion.div>
           ))}

           {/* 크레인 스캔 루프 (4-1) */}
           <motion.div 
             animate={{ x: [0, 100, 0] }} transition={{ duration: 15, repeat: Infinity }}
             className="absolute top-10 left-10 flex flex-col items-center"
           >
              <TrendingUp className="w-20 h-20 text-slate-700 rotate-180" />
              <div className="w-px h-40 bg-slate-700/50" />
           </motion.div>

           {/* 안전 요원 이동 루프 (4-2) */}
           {[...Array(3)].map((_, i) => (
             <motion.div
               key={i}
               initial={{ x: -100 }} animate={{ x: 900 }}
               transition={{ duration: 18, repeat: Infinity, delay: i * 6 }}
               className="absolute bottom-6 flex items-center gap-2 opacity-50"
             >
                <HardHat className="w-4 h-4 text-orange-400" />
                <div className="w-2 h-4 bg-yellow-500/50 rounded-sm" />
             </motion.div>
           ))}
        </div>

        {/* 선박 구현 (5단계 자산 재현) */}
        <div className="absolute inset-0 flex items-center justify-center p-12">
            <AnimatePresence mode="wait">
              <motion.div 
                key={stage}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.1 }}
                className="relative w-full h-full flex flex-col items-center justify-center"
              >
                 {/* Ship Base (Hull) */}
                 <div className="relative">
                    {/* 선체 (Stage 1+) */}
                    <div className={cn(
                      "w-72 h-20 bg-slate-700 rounded-b-[4rem] border-b-4 border-slate-900 shadow-2xl relative transition-all duration-700",
                      stage >= 1 ? "opacity-100" : "opacity-20"
                    )}>
                        {/* 3단계 (1,2) 융접 및 공정 애니메이션 */}
                        <AnimatePresence>
                          {weldPoints.map(p => (
                            <motion.div 
                              key={p.id}
                              initial={{ scale: 0, opacity: 1 }}
                              animate={{ scale: [1, 2, 0], opacity: 0 }}
                              className="absolute bg-yellow-300 w-4 h-4 rounded-full blur-md"
                              style={{ left: `calc(50% + ${p.x}px)`, top: `calc(50% + ${p.y}px)` }}
                            />
                          ))}
                        </AnimatePresence>
                    </div>

                    {/* 갑판 (Stage 2+) */}
                    {stage >= 2 && (
                      <motion.div 
                        initial={{ height: 0 }} animate={{ height: 10 }}
                        className="absolute -top-2 left-4 right-4 bg-slate-600 rounded-t-lg border-b border-white/5" 
                      />
                    )}

                    {/* 상부 구조 (Stage 3+) */}
                    {stage >= 3 && (
                      <motion.div 
                        initial={{ y: 20 }} animate={{ y: 0 }}
                        className="absolute -top-32 left-1/2 -ml-12 w-24 h-32 bg-slate-800 rounded-lg flex flex-col p-2 gap-2"
                      >
                         <div className="w-full h-4 bg-slate-700 rounded-sm" />
                         <div className="w-full h-4 bg-slate-700 rounded-sm" />
                         {/* 이미지 3(2) 크레인 작업 묘사 */}
                         <div className="absolute -top-10 -right-10">
                            <Construction className="w-12 h-12 text-slate-600" />
                         </div>
                      </motion.div>
                    )}

                    {/* 도색 및 상부 완료 (Stage 4+) */}
                    {stage >= 4 && (
                      <motion.div 
                         initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                         className="absolute inset-0 bg-primary/20 backdrop-blur-[2px] rounded-b-[4rem]" 
                      />
                    )}

                    {/* 진수식 (Stage 5) */}
                    {stage >= 5 && (
                      <div className="absolute -top-40 left-0 right-0 flex justify-center gap-4">
                         {[...Array(4)].map((_, i) => (
                           <motion.div 
                             key={i} 
                             animate={{ y: [0, -10, 0], rotate: [0, 5, -5, 0] }} 
                             transition={{ repeat: Infinity, duration: 2, delay: i * 0.3 }}
                           >
                              <Flag className="w-8 h-8 text-primary" />
                           </motion.div>
                         ))}
                      </div>
                    )}
                 </div>
              </motion.div>
            </AnimatePresence>
        </div>

        {/* 3단계: 애니메이션 로직 트리거 */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 text-center">
            {stage === 2 && <span className="text-[10px] font-black text-orange-400 animate-pulse">STEP 1: WELD COMPLETE (용접 완료)</span>}
            {stage === 3 && <span className="text-[10px] font-black text-blue-400 animate-pulse">STEP 2: CRANE WORK (상부 구조 정밀 작업)</span>}
            {stage === 4 && <span className="text-[10px] font-black text-emerald-400 animate-pulse">STEP 3: PAINTING (도색 및 마감 공정)</span>}
            {stage === 5 && <span className="text-sm font-black text-primary italic">MISSION COMPLETE: LAUNCH! 🚢</span>}
        </div>
      </div>

      {/* 1단계 (1): 클릭 버튼 (Click Buttons) */}
      <div className="flex flex-col gap-5">
          <Button 
            onPointerDown={handleTap}
            className={cn(
              "w-full h-36 rounded-[3rem] text-4xl font-black italic tracking-tighter shadow-2xl transition-all relative overflow-hidden",
              isClicking ? "bg-slate-700 scale-95 shadow-none translate-y-2" : "bg-primary shadow-[0_15px_0_#1e3a8a] hover:-translate-y-1"
            )}
          >
             <div className="flex flex-col items-center">
                <span className="text-sm opacity-50 mb-1 font-bold">{isClicking ? "CLICKED" : "TAP TO BUILD"}</span>
                {isClicking ? "건조중..." : "건조 시작"}
             </div>
             {/* 2단계 (2): 자동화 시각 효과 (용접봇 작동) */}
             {autoPower > 0 && (
                <div className="absolute top-4 right-4 flex gap-1">
                   <Fan className="w-6 h-6 text-white/20 animate-spin" />
                   <Settings2 className="w-6 h-6 text-white/20 animate-pulse" />
                </div>
             )}
          </Button>

          {/* 1단계 (3) & 2단계: 업그레이드 및 자동화 요소 */}
          <div className="grid grid-cols-2 gap-4">
             <button 
               onClick={() => buyUpgrade('CLICK')}
               className="bg-card hover:bg-card/80 p-5 rounded-[2rem] border border-white/5 flex flex-col gap-3 group transition-all active:scale-95"
             >
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                   <Hammer className="w-6 h-6 text-primary fill-current" />
                </div>
                <div className="text-left">
                   <h4 className="text-xs font-black text-white">클릭 파워 업그레이드</h4>
                   <p className="text-[10px] text-muted-foreground">공정 당 +1 진척도</p>
                </div>
                <div className="flex justify-between items-center mt-2">
                   <span className="text-xs font-black text-primary">{clickCost} PTS</span>
                   <span className="text-[9px] font-bold px-2 py-0.5 bg-white/5 rounded text-white/50">LV.{clickPower}</span>
                </div>
             </button>

             <button 
               onClick={() => buyUpgrade('AUTO')}
               className="bg-card hover:bg-card/80 p-5 rounded-[2rem] border border-white/5 flex flex-col gap-3 group transition-all active:scale-95"
             >
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                   <Settings2 className="w-6 h-6 text-emerald-400" />
                </div>
                <div className="text-left">
                   <h4 className="text-xs font-black text-white">자동 건조 로봇 배치</h4>
                   <p className="text-[10px] text-muted-foreground">초당 자동 건조 개시</p>
                </div>
                <div className="flex justify-between items-center mt-2">
                   <span className="text-xs font-black text-emerald-400">{autoCost} PTS</span>
                   <span className="text-[9px] font-bold px-2 py-0.5 bg-white/5 rounded text-white/50">LV.{(autoPower * 10).toFixed(0)}</span>
                </div>
             </button>
          </div>
      </div>

      <p className="text-center text-[9px] font-black text-white/30 uppercase tracking-[0.5em] italic mt-4">
        Ship Construction Clicker Logic System v2.0
      </p>
    </div>
  );
};
