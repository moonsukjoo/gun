import React, { useState, useEffect } from 'react';
import { useAuth } from '@/src/components/AuthProvider';
import { db } from '@/src/firebase';
import { collection, addDoc, query, where, onSnapshot, orderBy, doc, updateDoc, increment } from 'firebase/firestore';
import { RedemptionRequest } from '@/src/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Wallet, History, AlertCircle, ChevronRight, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export const Redemption: React.FC = () => {
  const { profile } = useAuth();
  const [pointsToRedeem, setPointsToRedeem] = useState<string>('');
  const [requests, setRequests] = useState<RedemptionRequest[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const q = query(
      collection(db, 'redemptionRequests'),
      where('uid', '==', profile.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setRequests(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RedemptionRequest)));
    });
    return () => unsubscribe();
  }, [profile]);

  const handleRequest = async () => {
    if (!profile) return;
    const points = parseInt(pointsToRedeem);
    if (isNaN(points) || points <= 0) {
      toast.error('올바른 포인트를 입력해주세요.');
      return;
    }
    if (points > (profile.points || 0)) {
      toast.error('보유 포인트가 부족합니다.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Create redemption request
      await addDoc(collection(db, 'redemptionRequests'), {
        uid: profile.uid,
        userName: profile.displayName,
        pointsRequested: points,
        amount: points * 5000,
        status: 'PENDING',
        createdAt: new Date().toISOString()
      });

      // 2. Deduct points from user profile
      await updateDoc(doc(db, 'users', profile.uid), {
        points: increment(-points)
      });

      toast.success('현물 신청이 완료되었습니다.');
      setPointsToRedeem('');
    } catch (error) {
      console.error(error);
      toast.error('신청 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusMap = {
    'PENDING': { label: '대기중', color: 'text-amber-500', bgColor: 'bg-amber-500/10', icon: Clock },
    'APPROVED': { label: '승인됨', color: 'text-blue-500', bgColor: 'bg-blue-500/10', icon: CheckCircle2 },
    'REJECTED': { label: '반려됨', color: 'text-red-500', bgColor: 'bg-red-500/10', icon: XCircle },
    'COMPLETED': { label: '지급완료', color: 'text-emerald-500', bgColor: 'bg-emerald-500/10', icon: CheckCircle2 },
  };

  return (
    <div className="space-y-6 pb-24 px-1">
      <header className="py-6">
        <h2 className="text-3xl font-black tracking-tight text-white leading-tight">현물 신청</h2>
        <p className="text-muted-foreground font-bold">보유 포인트를 현금으로 환전 신청하세요</p>
      </header>

      {/* Points Summary */}
      <Card className="border-none shadow-none bg-card rounded-2xl overflow-hidden border border-white/5">
        <CardContent className="p-8 flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-3xl flex items-center justify-center text-primary">
            <Wallet className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest text-center">현재 보유 포인트</p>
            <p className="text-4xl font-black text-white">{(profile?.points || 0).toLocaleString()}P</p>
            <p className="text-xs font-bold text-primary">환전 가능 금액: {((profile?.points || 0) * 5000).toLocaleString()}원</p>
          </div>
        </CardContent>
      </Card>

      {/* Form Section */}
      <div className="bg-card p-6 rounded-2xl border border-white/5 space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">신청 포인트</label>
            <div className="relative">
              <Input 
                type="number"
                placeholder="환전할 포인트를 입력하세요"
                value={pointsToRedeem}
                onChange={e => setPointsToRedeem(e.target.value)}
                className="h-16 bg-white/5 border-white/10 rounded-2xl text-xl font-black text-white placeholder:text-muted-foreground/30 pr-12"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-muted-foreground">P</span>
            </div>
            {pointsToRedeem && !isNaN(parseInt(pointsToRedeem)) && (
              <p className="text-xs font-bold text-emerald-500 ml-1">
                신청 금액: {(parseInt(pointsToRedeem) * 5000).toLocaleString()}원
              </p>
            )}
          </div>

          <div className="bg-amber-500/10 p-4 rounded-xl flex gap-3 border border-amber-500/20">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
            <p className="text-xs font-bold text-amber-200/70 leading-relaxed">
              신청 시 포인트가 즉시 차감됩니다. 실장님 승인 후 실제 현금으로 지급되며, 반려 시 포인트는 다시 복구됩니다.
            </p>
          </div>

          <Button 
            className="w-full h-16 bg-primary text-white font-black rounded-3xl text-lg shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-[0.98] transition-all"
            disabled={isSubmitting || !pointsToRedeem}
            onClick={handleRequest}
          >
            {isSubmitting ? '처리 중...' : '환전 신청하기'}
          </Button>
        </div>
      </div>

      {/* History Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <History className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-black text-muted-foreground uppercase tracking-widest">신청 내역</h3>
        </div>

        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {requests.map((req) => {
              const statusInfo = statusMap[req.status];
              const StatusIcon = statusInfo.icon;
              return (
                <motion.div 
                  key={req.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-card p-5 rounded-2xl border border-white/5 flex items-center justify-between group active:scale-[0.99] transition-all"
                >
                  <div className="flex gap-4">
                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", statusInfo.bgColor)}>
                      <StatusIcon className={cn("w-6 h-6", statusInfo.color)} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-white">{req.pointsRequested.toLocaleString()}P 환전</span>
                        <Badge className={cn("rounded-lg font-black text-[9px] border-none px-1.5 h-4", statusInfo.bgColor, statusInfo.color)}>
                          {statusInfo.label}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground font-bold">{format(new Date(req.createdAt), 'yyyy.MM.dd HH:mm')}</p>
                      <p className="text-xs font-black text-white/50">{req.amount.toLocaleString()}원</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-white/10 group-hover:text-primary transition-colors" />
                </motion.div>
              );
            })}
          </AnimatePresence>

          {requests.length === 0 && (
            <div className="py-20 text-center opacity-20 bg-card rounded-2xl border border-dashed border-white/10">
              <p className="text-sm font-black">신청 내역이 없습니다</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
