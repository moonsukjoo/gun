import React, { useState, useEffect } from 'react';
import { useAuth } from '@/src/components/AuthProvider';
import { db } from '@/src/firebase';
import { collection, addDoc, query, where, onSnapshot, orderBy, doc, updateDoc, getDocs } from 'firebase/firestore';
import { LeaveRequest } from '@/src/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';
import { DayPicker } from 'react-day-picker';
import { cn } from '@/lib/utils';

export const Leave: React.FC = () => {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [selectedRange, setSelectedRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [leaveType, setLeaveType] = useState<LeaveRequest['type']>('ANNUAL');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const q = query(
      collection(db, 'leaveRequests'),
      where('uid', '==', profile.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveRequest)));
    });
    return () => unsubscribe();
  }, [profile]);

  const handleSubmit = async () => {
    if (!profile || !selectedRange.from || !reason.trim()) {
      toast.error('날짜와 사유를 모두 입력해주세요.');
      return;
    }

    const startDate = selectedRange.from;
    const endDate = leaveType === 'ANNUAL' ? (selectedRange.to || selectedRange.from) : selectedRange.from;

    let diffDays = 0;
    if (leaveType === 'ANNUAL') {
      const diffTime = Math.abs((endDate || startDate).getTime() - startDate.getTime());
      diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    } else {
      diffDays = 0.5;
    }

    if ((profile.annualLeaveBalance || 0) < diffDays) {
      toast.error('잔여 연차가 부족합니다.');
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'leaveRequests'), {
        uid: profile.uid,
        type: leaveType,
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate || startDate, 'yyyy-MM-dd'),
        reason: reason.trim(),
        status: 'APPROVED',
        createdAt: new Date().toISOString()
      });

      await updateDoc(doc(db, 'users', profile.uid), {
        annualLeaveBalance: (profile.annualLeaveBalance || 0) - diffDays
      });

      const managersQuery = query(
        collection(db, 'users'),
        where('role', 'in', ['CEO', 'DIRECTOR', 'GENERAL_AFFAIRS', 'GENERAL_MANAGER'])
      );
      const managersSnapshot = await getDocs(managersQuery);
      const uniqueManagers = Array.from(new Set(managersSnapshot.docs.map(m => m.id)));
      const typeLabel = leaveType === 'ANNUAL' ? '연차' : '반차';

      for (const managerId of uniqueManagers) {
        if (managerId === profile.uid) continue;
        await addDoc(collection(db, 'notifications'), {
          uid: managerId,
          title: `${typeLabel} 신청 알림`,
          message: `${profile.displayName}님이 ${format(startDate, 'MM/dd')} ${typeLabel}를 사용합니다.`,
          type: 'LEAVE_REMINDER',
          isRead: false,
          createdAt: new Date().toISOString()
        });
      }

      toast.success('신청이 완료되었습니다.');
      setSelectedRange({ from: undefined, to: undefined });
      setReason('');
    } catch (error) {
      toast.error('연차 신청 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-24 px-1">
      <header className="py-6">
        <h2 className="text-3xl font-black tracking-tight text-white leading-tight">연차 관리</h2>
        <p className="text-muted-foreground font-bold">휴가와 반차를 신청하고 관리하세요</p>
      </header>

      <div className="space-y-6">
        <div className="bg-card p-6 rounded-2xl border border-white/5 space-y-8">
          <div className="bg-white/5 p-5 rounded-2xl flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">사용 가능 연차</span>
              <span className="text-2xl font-black text-white">{profile?.annualLeaveBalance || 0}일</span>
            </div>
            <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center text-primary">
              <Calendar className="w-6 h-6" />
            </div>
          </div>

          <div className="space-y-4">
             <div className="grid grid-cols-3 gap-2 p-1 bg-white/5 rounded-2xl">
                {['ANNUAL', 'AM_HALF', 'PM_HALF'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setLeaveType(type as any)}
                    className={cn(
                      "h-12 rounded-xl text-xs font-black transition-all",
                      leaveType === type ? "bg-white text-black shadow-lg" : "text-muted-foreground hover:text-white"
                    )}
                  >
                    {type === 'ANNUAL' ? '연차' : type === 'AM_HALF' ? '오전반차' : '오후반차'}
                  </button>
                ))}
             </div>
          </div>

          <div className="space-y-4">
             <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex justify-center">
                <style>{`
                  .rdp { --rdp-cell-size: 44px; margin: 0; width: 100%; }
                  .rdp-caption { padding-left: 12px; padding-right: 8px; }
                  .rdp-caption_label { color: #fff; font-weight: 900; font-size: 1rem; display: flex; align-items: center; justify-content: flex-start; gap: 4px; }
                  .rdp-head_cell { color: #ffffff40; font-weight: 900; font-size: 0.7rem; }
                  .rdp-day { color: #ffffff; font-weight: 700; font-size: 0.9rem; }
                  .rdp-day_selected { background-color: var(--color-primary) !important; color: white !important; font-weight: 900; border-radius: 12px; }
                  .rdp-day_today { color: var(--color-primary) !important; }
                  .rdp-button:hover:not([disabled]):not(.rdp-day_selected) { background-color: #ffffff10; border-radius: 12px; }
                `}</style>
                {leaveType === 'ANNUAL' ? (
                  <DayPicker 
                    mode="range"
                    selected={selectedRange as any}
                    onSelect={(range: any) => setSelectedRange({ from: range?.from, to: range?.to })}
                    locale={ko}
                  />
                ) : (
                  <DayPicker 
                    mode="single"
                    selected={selectedRange.from}
                    onSelect={(date: any) => setSelectedRange({ from: date, to: date })}
                    locale={ko}
                  />
                )}
             </div>
          </div>

          <div className="space-y-4">
            <Textarea 
              placeholder="사유를 입력해 주세요"
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="min-h-[120px] bg-white/5 border-white/10 rounded-2xl text-white font-bold placeholder:text-muted-foreground/30"
            />
          </div>

          <Button 
            className="w-full h-16 bg-primary text-white font-black rounded-3xl text-lg shadow-lg shadow-primary/20 active:scale-[0.98] transition-all"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? '처리 중' : '신청하기'}
          </Button>
        </div>

        <div className="space-y-4">
           <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest px-1">최근 내역</h3>
           <div className="space-y-2">
             {requests.map(req => (
               <div key={req.id} className="bg-card p-5 rounded-2xl border border-white/5 flex items-center justify-between">
                  <div className="space-y-1 overflow-hidden">
                     <p className="text-sm font-black text-white truncate">
                        {req.startDate}{req.startDate !== req.endDate ? ` ~ ${req.endDate}` : ''}
                     </p>
                     <div className="flex items-center gap-2">
                        <Badge className="bg-primary/20 text-primary border-none rounded-lg px-2 h-5 text-[10px] font-black">
                           {req.type === 'ANNUAL' ? '연차' : '반차'}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-bold truncate">{req.reason}</span>
                     </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-white/10 shrink-0" />
               </div>
             ))}
           </div>
        </div>
      </div>
    </div>
  );
};
