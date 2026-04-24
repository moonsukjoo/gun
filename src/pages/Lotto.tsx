import React, { useState, useEffect } from 'react';
import { useAuth } from '@/src/components/AuthProvider';
import { db } from '@/src/firebase';
import { collection, addDoc, query, where, onSnapshot, orderBy, doc, updateDoc, increment } from 'firebase/firestore';
import { LottoHistory } from '@/src/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Ticket, History, Sparkles, Coins, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export const Lotto: React.FC = () => {
  const { profile } = useAuth();
  const [history, setHistory] = useState<LottoHistory[]>([]);
  const [currentLines, setCurrentLines] = useState<number[][]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const COST_PER_USE = 0.2; // 1000 won (since 1 point = 5000 won)

  useEffect(() => {
    if (!profile) return;

    const q = query(
      collection(db, 'lottoHistory'),
      where('uid', '==', profile.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LottoHistory));
      setHistory(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }, (error) => {
      console.error("Lotto history subscription error:", error);
    });

    return () => unsubscribe();
  }, [profile]);

  const generateLottoNumbers = () => {
    const lines: number[][] = [];
    for (let i = 0; i < 5; i++) {
      const numbers = new Set<number>();
      while (numbers.size < 7) {
        numbers.add(Math.floor(Math.random() * 45) + 1);
      }
      const sortedNumbers = Array.from(numbers).slice(0, 6).sort((a, b) => a - b);
      const bonus = Array.from(numbers)[6];
      lines.push([...sortedNumbers, bonus]);
    }
    return lines;
  };

  const handleGenerate = async () => {
    if (!profile) return;
    if ((profile.points || 0) < COST_PER_USE) {
      toast.error('포인트가 부족합니다. (1회 이용: 0.2P / 1,000원)');
      return;
    }

    setIsGenerating(true);
    
    // Simulate generation effect
    setTimeout(async () => {
      const newLines = generateLottoNumbers();
      setCurrentLines(newLines);

      try {
        // 1. Deduct points
        await updateDoc(doc(db, 'users', profile.uid), {
          points: increment(-COST_PER_USE)
        });

        // 2. Save to history
        const linesToSave = newLines.map(line => line.join(','));
        await addDoc(collection(db, 'lottoHistory'), {
          uid: profile.uid,
          lines: linesToSave,
          createdAt: new Date().toISOString()
        });

        toast.success('로또 번호가 생성 및 저장되었습니다! (-0.2P)');
      } catch (error) {
        console.error("Error saving lotto:", error);
        toast.error('저장 중 오류가 발생했습니다.');
      } finally {
        setIsGenerating(false);
      }
    }, 1500);
  };

  const getBallColor = (num: number) => {
    if (num <= 10) return 'bg-yellow-400';
    if (num <= 20) return 'bg-blue-400';
    if (num <= 30) return 'bg-red-400';
    if (num <= 40) return 'bg-slate-400';
    return 'bg-emerald-400';
  };

  return (
    <div className="space-y-8 pb-10">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <div className="w-2 h-6 bg-primary rounded-full" />
          <h2 className="text-3xl font-black tracking-tighter text-white">로또 번호 생성기</h2>
        </div>
      </header>

      <div className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <Card className="border-none shadow-none bg-card rounded-3xl overflow-hidden border border-white/5">
            <CardHeader className="p-6 pb-2">
              <CardTitle className="text-lg font-black tracking-tight flex items-center gap-2 text-white">
                <Sparkles className="w-5 h-5 text-yellow-500" /> 번호 생성 (1,000원 / 0.2P)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="bg-white/5 p-4 rounded-2xl flex items-center justify-between border border-white/5">
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-primary" />
                  <span className="text-xs font-black text-muted-foreground uppercase tracking-widest">나의 포인트</span>
                </div>
                <span className="text-xl font-black text-primary tracking-tighter">{(profile?.points || 0).toFixed(1)}P</span>
              </div>

              <div className="space-y-4 min-h-[400px] flex flex-col justify-center">
                <AnimatePresence mode="wait">
                  {currentLines.length > 0 ? (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="space-y-3"
                    >
                      {currentLines.map((line, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-black/20 rounded-2xl border border-white/5">
                          <div className="flex gap-1.5">
                            {line.slice(0, 6).map((num, nIdx) => (
                              <div 
                                key={nIdx} 
                                className={cn(
                                  "w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black text-white shadow-sm",
                                  getBallColor(num)
                                )}
                              >
                                {num}
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-[10px] font-black text-white/20">+</div>
                            <div className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black text-white shadow-sm",
                              getBallColor(line[6])
                            )}>
                              {line[6]}
                            </div>
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                      <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center">
                        <Ticket className="w-10 h-10 text-white/20" />
                      </div>
                      <p className="text-xs font-black text-muted-foreground uppercase tracking-widest leading-relaxed">
                        버튼을 눌러 행운의 번호를<br />생성해보세요!
                      </p>
                    </div>
                  )}
                </AnimatePresence>
              </div>

              <Button 
                className="w-full h-14 rounded-2xl bg-primary text-white font-black text-lg shadow-xl shadow-primary/20 gap-2 hover:bg-primary/90"
                onClick={handleGenerate}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <Sparkles className="w-5 h-5 fill-current" />
                )}
                {isGenerating ? '번호 생성 중...' : '행운의 번호 뽑기'}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
              <History className="w-4 h-4" /> 최근 생성 기록
            </h3>
            <div className="h-px flex-1 bg-white/5 ml-4" />
          </div>

          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 scrollbar-hide">
            {history.filter(item => item.lines && item.lines.length > 0).length > 0 ? (
              history.filter(item => item.lines && item.lines.length > 0).map((item) => (
                <Card key={item.id} className="border-none shadow-none bg-card rounded-2xl overflow-hidden border border-white/5">
                  <CardHeader className="p-4 pb-0 flex flex-row items-center justify-between">
                    <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">
                      {format(new Date(item.createdAt), 'yyyy.MM.dd HH:mm')}
                    </span>
                  </CardHeader>
                  <CardContent className="p-4 pt-2 space-y-2">
                    {item.lines?.map((lineStr, lIdx) => {
                      const numbers = lineStr.split(',').map(Number);
                      return (
                        <div key={lIdx} className="flex items-center justify-between scale-[0.85] origin-left">
                          <div className="flex gap-1">
                            {numbers.slice(0, 6).map((num, nIdx) => (
                              <div 
                                key={nIdx} 
                                className={cn(
                                  "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black text-white shadow-sm",
                                  getBallColor(num)
                                )}
                              >
                                {num}
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="text-[9px] font-black text-white/20">+</div>
                            <div className={cn(
                              "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black text-white shadow-sm",
                              getBallColor(numbers[6])
                            )}>
                              {numbers[6]}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="py-20 text-center space-y-4 bg-card rounded-3xl border border-dashed border-white/10">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto text-white/10">
                  <History className="w-8 h-8" />
                </div>
                <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">기록이 없습니다</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
