import React, { useState, useEffect } from 'react';
import { useAuth } from '@/src/components/AuthProvider';
import { db } from '@/src/firebase';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, increment } from 'firebase/firestore';
import { UserProfile, PraiseCoupon } from '@/src/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Gift, Trophy, Settings, MapPin, Search, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';

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

export const Coupons: React.FC = () => {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [rouletteSettings, setRouletteSettings] = useState<RouletteSetting[]>(DEFAULT_ROULETTE_SETTINGS);
  const [isAuthorizedToGive, setIsAuthorizedToGive] = useState(false);
  
  const [giveCouponForm, setGiveCouponForm] = useState({
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0, 5),
    location: '',
    reason: '',
    points: 1
  });

  useEffect(() => {
    if (!profile) return;
    
    const isAuth = profile.role === 'CEO' || profile.role === 'SAFETY_MANAGER' || profile.permissions?.includes('praise_coupon');
    setIsAuthorizedToGive(isAuth);
    
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
    });

    return () => unsubscribeUsers();
  }, [profile]);

  const handleGiveCoupon = async () => {
    if (!isAuthorizedToGive) {
      toast.error('지급 권한이 없습니다.');
      return;
    }
    if (!selectedUser) {
      toast.error('사원을 선택해주세요.');
      return;
    }
    if (!giveCouponForm.location || !giveCouponForm.reason) {
      toast.error('장소와 사유를 입력해주세요.');
      return;
    }

    try {
      const couponData: PraiseCoupon = {
        id: Math.random().toString(36).substring(2, 9),
        senderUid: profile!.uid,
        senderName: profile!.displayName,
        senderRole: profile!.role,
        receiverUid: selectedUser,
        receiverName: users.find(u => u.uid === selectedUser)?.displayName || '알 수 없음',
        date: giveCouponForm.date,
        time: giveCouponForm.time,
        location: giveCouponForm.location,
        reason: giveCouponForm.reason,
        points: giveCouponForm.points,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'praiseCoupons'), couponData);
      await updateDoc(doc(db, 'users', selectedUser), { points: increment(giveCouponForm.points) });

      await addDoc(collection(db, 'notifications'), {
        uid: selectedUser,
        title: '칭찬쿠폰이 도착했습니다!',
        message: `${profile?.displayName}님께서 "${giveCouponForm.reason}" 사유로 ${giveCouponForm.points}P를 선물하셨습니다.`,
        type: 'COUPON',
        isRead: false,
        createdAt: new Date().toISOString()
      });

      toast.success('쿠폰이 성공적으로 지급되었습니다.');
      setSelectedUser('');
      setGiveCouponForm({ ...giveCouponForm, location: '', reason: '' });
    } catch (error) {
      toast.error('지급 중 오류가 발생했습니다.');
    }
  };

  const updateProbability = (id: string, val: string) => {
    const prob = parseFloat(val);
    if (isNaN(prob)) return;
    setRouletteSettings(prev => prev.map(s => s.id === id ? { ...s, probability: prob } : s));
  };

  if (!isAuthorizedToGive) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 px-6 text-center">
        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-2">
          <ShieldCheck className="w-10 h-10 text-slate-300" />
        </div>
        <h2 className="text-xl font-black text-slate-900 tracking-tight">접근 권한이 없습니다.</h2>
        <p className="text-sm text-slate-500 font-medium">이 페이지는 관리자 전용 공간입니다.</p>
      </div>
    );
  }

  const totalProb = rouletteSettings.reduce((a, s) => a + s.probability, 0);
  const isProbValid = Math.abs(totalProb - 1) < 0.001;

  return (
    <div className="w-full max-w-lg mx-auto space-y-12 pb-24 px-4 flex flex-col items-center">
      {/* Page Header */}
      <header className="flex flex-col gap-3 items-center text-center mt-6 w-full">
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex items-center gap-3 bg-white px-6 py-2.5 rounded-full shadow-lg border border-slate-100 ring-4 ring-primary/5"
        >
           <Trophy className="w-5 h-5 text-yellow-500 fill-yellow-500" />
           <h2 className="text-xl font-black tracking-tighter text-slate-900">칭찬쿠폰 & 룰렛 관리</h2>
        </motion.div>
        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.4em] leading-none">Administrative Controls</p>
      </header>

      {/* Give Coupon Section */}
      <section className="w-full space-y-6">
        <div className="flex items-center gap-3 px-1">
          <div className="w-1.5 h-4 bg-emerald-500 rounded-full" />
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">칭찬쿠폰 발급</h3>
        </div>

        <Card className="border-none shadow-2xl bg-white rounded-[2.5rem] overflow-hidden w-full">
          <CardHeader className="p-6 pb-2 text-center border-b border-slate-50">
             <CardTitle className="text-lg font-black flex items-center justify-center gap-2 text-emerald-600">
                <Gift className="w-5 h-5" /> 칭찬쿠폰 지급하기
             </CardTitle>
          </CardHeader>
          <CardContent className="p-6 sm:p-8 space-y-6">
             <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">받는 사람 (사원 선택)</label>
                  <Select value={selectedUser} onValueChange={setSelectedUser}>
                    <SelectTrigger className="h-14 bg-slate-50 border-slate-200 rounded-2xl font-black text-slate-900 shadow-sm">
                      <SelectValue placeholder="사원을 선택하세요" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-slate-200 rounded-2xl">
                      {users.filter(u => u.uid !== profile?.uid).map(user => (
                        <SelectItem key={user.uid} value={user.uid} className="font-bold py-3">
                          {user.displayName} ({user.departmentName || '부서미정'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">날짜</label>
                      <Input type="date" value={giveCouponForm.date} onChange={e => setGiveCouponForm({...giveCouponForm, date: e.target.value})} className="h-12 bg-slate-50 border-slate-200 rounded-2xl font-bold" />
                   </div>
                   <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">시간</label>
                      <Input type="time" value={giveCouponForm.time} onChange={e => setGiveCouponForm({...giveCouponForm, time: e.target.value})} className="h-12 bg-slate-50 border-slate-200 rounded-2xl font-bold" />
                   </div>
                </div>

                <div className="space-y-1.5">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">발생 장소</label>
                   <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <Input placeholder="사무실, 현장 등" value={giveCouponForm.location} onChange={e => setGiveCouponForm({...giveCouponForm, location: e.target.value})} className="h-12 pl-12 bg-slate-50 border-slate-200 rounded-2xl font-bold" />
                   </div>
                </div>

                <div className="space-y-1.5">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">보너스 포인트</label>
                   <Select value={String(giveCouponForm.points)} onValueChange={v => setGiveCouponForm({...giveCouponForm, points: parseInt(v)})}>
                      <SelectTrigger className="h-12 bg-slate-50 border-slate-200 rounded-2xl font-black">
                         <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white rounded-xl">
                         {[1, 2, 3, 5, 10].map(p => (
                           <SelectItem key={p} value={String(p)} className="font-bold">{p}P ({(p * 5000).toLocaleString()}원)</SelectItem>
                         ))}
                      </SelectContent>
                   </Select>
                </div>

                <div className="space-y-1.5">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">칭찬 사유</label>
                   <textarea 
                     placeholder="칭찬 사유를 정성껏 작성해주세요" 
                     value={giveCouponForm.reason} 
                     onChange={e => setGiveCouponForm({...giveCouponForm, reason: e.target.value})}
                     className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] font-bold text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                   />
                </div>

                <Button onClick={handleGiveCoupon} className="w-full h-16 rounded-[1.5rem] bg-emerald-500 hover:bg-emerald-600 text-white font-black text-lg shadow-xl shadow-emerald-100 transition-all active:scale-95">
                   칭찬쿠폰 즉시 발행
                </Button>
             </div>
          </CardContent>
        </Card>
      </section>

      {/* Roulette Settings Section */}
      <section className="w-full space-y-6">
        <div className="flex items-center gap-3 px-1">
          <div className="w-1.5 h-4 bg-slate-800 rounded-full" />
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">룰렛 확률 설정</h3>
        </div>

        <Card className="border-none shadow-2xl bg-white rounded-[2.5rem] overflow-hidden w-full">
          <CardHeader className="p-6 pb-2 text-center border-b border-slate-50">
             <CardTitle className="text-lg font-black flex items-center justify-center gap-2 text-slate-800">
                <Settings className="w-5 h-5" /> 룰렛 당첨 확률 구성
             </CardTitle>
          </CardHeader>
          <CardContent className="p-6 sm:p-8 space-y-6">
             <div className="space-y-4">
                {rouletteSettings.map((s) => (
                  <div key={s.id} className="flex flex-col sm:flex-row sm:items-center gap-4 bg-slate-50 p-5 rounded-[1.5rem] border border-slate-100">
                     <div className="flex items-center gap-4 flex-1">
                        <div className="w-8 h-8 rounded-full shadow-inner border-2 border-white flex-shrink-0" style={{ backgroundColor: s.color }} />
                        <div className="flex flex-col">
                           <span className="text-sm font-black text-slate-900 leading-tight">{s.label}</span>
                           <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{s.multiplier}x 배율 적용</span>
                        </div>
                     </div>
                     <div className="w-full sm:w-28 relative">
                        <Input 
                          type="number" 
                          step="0.01" 
                          value={s.probability} 
                          onChange={e => updateProbability(s.id, e.target.value)} 
                          className="h-11 bg-white border-slate-200 rounded-xl text-center font-black pr-8" 
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300">%</span>
                     </div>
                  </div>
                ))}
                
                <div className="pt-6">
                  <div className="p-6 bg-slate-900 rounded-[2rem] shadow-xl text-center space-y-3">
                     <div className="flex flex-col items-center gap-1">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">확률 총합 검증 (Sum of Probabilities)</span>
                        <div className="flex items-center gap-2">
                           <div className={cn("w-2 h-2 rounded-full", isProbValid ? "bg-emerald-500 animate-pulse" : "bg-red-500")} />
                           <span className={cn("text-xs font-bold", isProbValid ? "text-emerald-400" : "text-red-400")}>
                             {isProbValid ? "정상: 시스템 무결성 확인됨" : "오류: 총합이 100%가 아님"}
                           </span>
                        </div>
                     </div>
                     <div className={cn("text-3xl font-black transition-colors duration-500", isProbValid ? "text-white" : "text-red-500")}>
                        {(totalProb * 100).toFixed(0)}%
                     </div>
                  </div>
                  <p className="text-center text-[9px] text-slate-400 font-bold mt-4 uppercase tracking-[0.2em] italic">
                    확률의 총 합계는 반드시 100% (1.0) 가 되어야 합니다.
                  </p>
                </div>
             </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};
