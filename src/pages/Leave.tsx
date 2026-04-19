import React, { useState, useEffect } from 'react';
import { useAuth } from '@/src/components/AuthProvider';
import { db } from '@/src/firebase';
import { collection, addDoc, query, where, onSnapshot, orderBy, doc, updateDoc, getDocs } from 'firebase/firestore';
import { LeaveRequest, UserProfile, Notification } from '@/src/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from 'lucide-react';
import { format, addDays, subDays, startOfDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
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

    // Handle single day selection (to can be undefined)
    const startDate = selectedRange.from;
    const endDate = leaveType === 'ANNUAL' ? (selectedRange.to || selectedRange.from) : selectedRange.from;

    // Calculate days
    let diffDays = 0;
    if (leaveType === 'ANNUAL') {
      const diffTime = Math.abs((endDate || startDate).getTime() - startDate.getTime());
      diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    } else if (leaveType === 'AM_HALF' || leaveType === 'PM_HALF') {
      diffDays = 0.5;
    }

    if ((profile.annualLeaveBalance || 0) < diffDays) {
      toast.error('잔여 연차가 부족합니다.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Create Leave Request
      await addDoc(collection(db, 'leaveRequests'), {
        uid: profile.uid,
        type: leaveType,
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate || startDate, 'yyyy-MM-dd'),
        reason: reason.trim(),
        status: 'APPROVED',
        createdAt: new Date().toISOString()
      });

      // 2. Deduct from balance
      await updateDoc(doc(db, 'users', profile.uid), {
        annualLeaveBalance: (profile.annualLeaveBalance || 0) - diffDays
      });

      // 3. Send notifications to managers
      const managersQuery = query(
        collection(db, 'users'),
        where('role', 'in', ['CEO', 'DIRECTOR', 'GENERAL_AFFAIRS', 'GENERAL_MANAGER'])
      );
      const managersSnapshot = await getDocs(managersQuery);
      
      const uniqueManagers = Array.from(new Set(managersSnapshot.docs.map(m => m.id)));

      const typeLabel = leaveType === 'ANNUAL' ? '연차' : leaveType === 'AM_HALF' ? '오전반차' : '오후반차';

      for (const managerId of uniqueManagers) {
        if (managerId === profile.uid) continue;
        await addDoc(collection(db, 'notifications'), {
          uid: managerId,
          title: `${typeLabel} 신청 알림`,
          message: `${profile.displayName}님이 ${format(startDate, 'MM/dd')}${leaveType === 'ANNUAL' && startDate !== endDate ? ' ~ ' + format(endDate!, 'MM/dd') : ''} ${typeLabel}를 사용합니다. (사유: ${reason.trim()})`,
          type: 'LEAVE_REMINDER',
          isRead: false,
          createdAt: new Date().toISOString(),
          fromUid: profile.uid,
          fromName: profile.displayName
        });
      }

      toast.success(`${typeLabel} 신청이 완료되었습니다.`);
      setSelectedRange({ from: undefined, to: undefined });
      setReason('');
    } catch (error) {
      console.error("Error submitting leave:", error);
      toast.error('연차 신청 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 space-y-8 pb-10">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <div className="w-2 h-6 bg-primary rounded-full" />
          <h2 className="text-3xl font-black tracking-tighter text-slate-900">연차 관리</h2>
        </div>
        <p className="text-[11px] text-slate-500 font-bold uppercase tracking-[0.2em] ml-4">연차 현황 및 신청 관리</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden">
            <CardHeader className="p-6 pb-2">
              <CardTitle className="text-lg font-black tracking-tight flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" /> 연차 신청
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="bg-slate-100 p-4 rounded-2xl flex items-center justify-between border border-slate-200">
                <span className="text-xs font-black text-slate-500 uppercase tracking-widest">나의 잔여 연차</span>
                <span className="text-2xl font-black text-primary tracking-tighter">{profile?.annualLeaveBalance || 0}일</span>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">신청 종류</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'ANNUAL', label: '연차' },
                    { id: 'AM_HALF', label: '오전반차' },
                    { id: 'PM_HALF', label: '오후반차' },
                  ].map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setLeaveType(type.id as any)}
                      className={cn(
                        "py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2",
                        leaveType === type.id 
                          ? "bg-primary border-primary text-white shadow-lg" 
                          : "bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100 hover:border-slate-200"
                      )}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">날짜 선택</label>
                <div className="border border-slate-200 rounded-3xl p-1 sm:p-4 bg-white flex justify-center overflow-x-auto">
                  {leaveType === 'ANNUAL' ? (
                    <DayPicker
                      mode="range"
                      selected={{ from: selectedRange.from, to: selectedRange.to }}
                      onSelect={(range) => setSelectedRange({ from: range?.from, to: range?.to })}
                      locale={ko}
                      className="m-0 max-w-full"
                      modifiersStyles={{
                        selected: { backgroundColor: 'var(--color-primary)', color: 'white' }
                      }}
                    />
                  ) : (
                    <DayPicker
                      mode="single"
                      selected={selectedRange.from}
                      onSelect={(day) => setSelectedRange({ from: day, to: day })}
                      locale={ko}
                      className="m-0 max-w-full"
                      modifiersStyles={{
                        selected: { backgroundColor: 'var(--color-primary)', color: 'white' }
                      }}
                    />
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">사용 목적</label>
                <Textarea 
                  placeholder="연차 사용 목적을 입력해주세요."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="min-h-[100px] bg-slate-50 border-slate-200 rounded-2xl font-bold text-sm focus:ring-primary/10 text-slate-900"
                />
              </div>

              <Button 
                className="w-full h-14 rounded-2xl font-black text-base shadow-lg shadow-primary/20 active:scale-95 transition-all"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? '처리 중...' : '연차 신청 및 저장하기'}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">최근 신청 내역</h3>
            <div className="h-px flex-1 bg-slate-200 ml-4" />
          </div>

          <div className="space-y-4">
            {requests.length > 0 ? (
              requests.map((req) => (
                <Card key={req.id} className="border-none shadow-sm bg-white rounded-2xl overflow-hidden card-hover">
                  <CardContent className="p-5 flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="font-black text-slate-900 tracking-tight flex items-center gap-2 text-sm sm:text-base">
                        {req.startDate} {req.startDate !== req.endDate && `~ ${req.endDate}`}
                        <span className={cn(
                          "text-[9px] px-2 py-0.5 rounded-full",
                          req.type === 'AM_HALF' ? "bg-blue-100 text-blue-600" :
                          req.type === 'PM_HALF' ? "bg-orange-100 text-orange-600" :
                          "bg-slate-100 text-slate-600"
                        )}>
                          {req.type === 'ANNUAL' ? '연차' : req.type === 'AM_HALF' ? '오전반차' : req.type === 'PM_HALF' ? '오후반차' : '기타'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 font-bold">{req.reason}</div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      <div className="text-[10px] font-black text-emerald-600 bg-emerald-100 px-2 py-1 rounded-full uppercase tracking-widest">
                        {req.status === 'APPROVED' ? '승인됨' : req.status}
                      </div>
                      <div className="text-[9px] text-slate-400 font-bold mt-1">
                        {format(new Date(req.createdAt), 'yyyy.MM.dd')}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="py-20 text-center space-y-4 bg-white rounded-3xl border border-dashed border-slate-200">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-300">
                  <Calendar className="w-8 h-8" />
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">신청 내역이 없습니다</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
