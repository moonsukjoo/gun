import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { db, handleFirestoreError, OperationType } from '@/firebase';
import { collection, addDoc, query, where, onSnapshot, orderBy, doc, updateDoc, getDocs } from 'firebase/firestore';
import { LeaveRequest } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, ChevronRight } from 'lucide-react';
import { format, differenceInMonths, parseISO, differenceInDays } from 'date-fns';
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

  const [usedDays, setUsedDays] = useState(0);

  useEffect(() => {
    if (!profile) return;
    const q = query(
      collection(db, 'leaveRequests'),
      where('uid', '==', profile.uid)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allRequests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveRequest));
      setRequests(allRequests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      
      // Calculate used days from approved requests
      const approved = allRequests.filter(r => r.status === 'APPROVED');
      const totalUsed = approved.reduce((acc, curr) => {
        if (curr.type === 'ANNUAL') {
          const start = parseISO(curr.startDate);
          const end = parseISO(curr.endDate);
          return acc + differenceInDays(end, start) + 1;
        } else if (curr.type === 'AM_HALF' || curr.type === 'PM_HALF') {
          return acc + 0.5;
        } else if (curr.type === 'OUTING_1H' || curr.type === 'OUTING') {
          return acc + 0.125;
        } else if (curr.type === 'OUTING_2H') {
          return acc + 0.25;
        } else {
          return acc + 0.5;
        }
      }, 0);
      setUsedDays(totalUsed);
    });
    return () => unsubscribe();
  }, [profile]);

  const currentBalance = profile?.annualLeaveBalance ?? 0;
  const accruedDays = currentBalance + usedDays;

  const handleSubmit = async () => {
    if (!profile || !selectedRange.from || !reason.trim()) {
      toast.error('날짜와 사유를 모두 입력해주세요.');
      return;
    }

    const startDate = selectedRange.from;
    const endDate = leaveType === 'ANNUAL' ? (selectedRange.to || selectedRange.from) : selectedRange.from;

    let diffDays = 0;
    if (leaveType === 'ANNUAL') {
      diffDays = differenceInDays(endDate, startDate) + 1;
    } else if (leaveType === 'AM_HALF' || leaveType === 'PM_HALF') {
      diffDays = 0.5;
    } else if (leaveType === 'OUTING_1H' || leaveType === 'OUTING') {
      diffDays = 0.125;
    } else if (leaveType === 'OUTING_2H') {
      diffDays = 0.25;
    } else {
      diffDays = 0.5;
    }

    if (currentBalance < diffDays) {
      toast.error('잔여 연차가 부족합니다.');
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'leaveRequests'), {
        uid: profile.uid,
        displayName: profile.displayName,
        employeeId: profile.employeeId,
        type: leaveType,
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
        reason: reason.trim(),
        status: 'PENDING',
        createdAt: new Date().toISOString()
      });

      // We no longer manually update annualLeaveBalance in user doc 
      // as it's calculated dynamically now.

      const managersQuery = query(
        collection(db, 'users'),
        where('role', 'in', ['TEAM_LEADER', 'DIRECTOR', 'GENERAL_AFFAIRS'])
      );
      const managersSnapshot = await getDocs(managersQuery);
      const uniqueManagers = Array.from(new Set(managersSnapshot.docs.map(m => m.id)));
      
      const getLeaveLabel = (t: string) => {
        if (t === 'ANNUAL') return '연차';
        if (t === 'AM_HALF') return '오전반차';
        if (t === 'PM_HALF') return '오후반차';
        if (t === 'OUTING') return '외출';
        if (t === 'OUTING_1H') return '외출(1시간)';
        if (t === 'OUTING_2H') return '외출(2시간)';
        return '반차';
      };
      
      const typeLabel = getLeaveLabel(leaveType);

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
        <h2 className="text-3xl font-black tracking-tight text-foreground leading-tight">연차 관리</h2>
        <p className="text-muted-foreground font-bold">휴가와 반차를 신청하고 관리하세요</p>
      </header>

      <div className="space-y-6">
        <div className="bg-card p-6 rounded-2xl border border-border space-y-8">
          <div className="bg-muted/50 p-5 rounded-2xl flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">사용 가능 연차</span>
              <span className="text-2xl font-black text-foreground">{currentBalance}일</span>
              <span className="text-[10px] font-bold text-muted-foreground mt-1">
                (발생: {accruedDays}일 / 사용: {usedDays}일)
              </span>
            </div>
            <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center text-primary">
              <Calendar className="w-6 h-6" />
            </div>
          </div>

          <div className="space-y-4">
             <div className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-6 gap-1.5 p-1 bg-muted rounded-2xl">
                {['ANNUAL', 'AM_HALF', 'PM_HALF', 'OUTING', 'OUTING_1H', 'OUTING_2H'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setLeaveType(type as any)}
                    className={cn(
                      "h-12 rounded-xl text-[10px] sm:text-xs font-black transition-all",
                      leaveType === type ? "bg-card text-foreground shadow-lg border border-border/50" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {type === 'ANNUAL' ? '연차' : 
                     type === 'AM_HALF' ? '오전반차' : 
                     type === 'PM_HALF' ? '오후반차' : 
                     type === 'OUTING' ? '외출(기본)' : 
                     type === 'OUTING_1H' ? '외출 1시간' : '외출 2시간'}
                  </button>
                ))}
             </div>
          </div>

          <div className="space-y-4">
             <div className="bg-card border border-border rounded-2xl p-4 flex justify-center shadow-inner">
                 <style>{`
                  .rdp { --rdp-cell-size: 44px; margin: 0; width: 100%; }
                  .rdp-caption { padding-left: 12px; padding-right: 8px; margin-bottom: 8px; }
                  .rdp-caption_label { color: var(--foreground); font-weight: 900; font-size: 1rem; display: flex; align-items: center; justify-content: flex-start; gap: 4px; }
                  .rdp-head_cell { color: var(--muted-foreground); font-weight: 900; font-size: 0.7rem; }
                  .rdp-day { color: var(--foreground); font-weight: 700; font-size: 0.9rem; }
                  .rdp-day_selected { background-color: var(--primary) !important; color: var(--primary-foreground) !important; font-weight: 900; border-radius: 12px; }
                  .rdp-day_today { color: var(--primary) !important; font-weight: 900; }
                  .rdp-button:hover:not([disabled]):not(.rdp-day_selected) { background-color: var(--muted); border-radius: 12px; }
                  .rdp-nav_button { color: var(--foreground); }
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
              className="min-h-[120px] bg-muted/50 border-border rounded-2xl text-foreground font-bold placeholder:text-muted-foreground/30"
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
                     <p className="text-sm font-black text-foreground truncate">
                        {req.startDate}{req.startDate !== req.endDate ? ` ~ ${req.endDate}` : ''}
                     </p>
                     <div className="flex items-center gap-2">
                        <Badge className="bg-primary/20 text-primary border-none rounded-lg px-2 h-5 text-[10px] font-black">
                           {req.type === 'ANNUAL' ? '연차' : 
                            req.type === 'AM_HALF' ? '오전반차' : 
                            req.type === 'PM_HALF' ? '오후반차' : 
                            req.type === 'OUTING' ? '외출(기본)' : 
                            req.type === 'OUTING_1H' ? '외출 1시간' : 
                            req.type === 'OUTING_2H' ? '외출 2시간' : '기타'}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-bold truncate">{req.reason}</span>
                     </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground/20 shrink-0" />
               </div>
             ))}
           </div>
        </div>
      </div>
    </div>
  );
};
