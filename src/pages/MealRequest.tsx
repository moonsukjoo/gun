import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/AuthProvider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  ChevronLeft, 
  Utensils, 
  Coffee, 
  Calendar, 
  CheckCircle2, 
  Plus, 
  Minus,
  AlertCircle,
  Archive
} from 'lucide-react';
import { db } from '@/firebase';
import { collection, addDoc, query, where, orderBy, onSnapshot, limit, getDocs } from 'firebase/firestore';
import { LunchRequest, SnackRequest } from '@/types';
import { format, differenceInDays, addDays } from 'date-fns';
import { toast } from 'sonner';

import { handleFirestoreError, OperationType } from '@/lib/errorHandlers';

export const MealRequest: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'LUNCH' | 'SNACK'>('LUNCH');
  const [loading, setLoading] = useState(false);

  // Lunch state
  const [lunchDates, setLunchDates] = useState({
    start: format(new Date(), 'yyyy-MM-dd'),
    end: format(addDays(new Date(), 30), 'yyyy-MM-dd')
  });
  const [myLunchRequests, setMyLunchRequests] = useState<LunchRequest[]>([]);
  const [showAllLunch, setShowAllLunch] = useState(false);

  // Snack state
  const [snackForm, setSnackForm] = useState({
    quantity: 1,
    deliveryDate: format(addDays(new Date(), 1), 'yyyy-MM-dd')
  });
  const [mySnackRequests, setMySnackRequests] = useState<SnackRequest[]>([]);
  const [showAllSnacks, setShowAllSnacks] = useState(false);

  const canRequestSnack = profile && (
    ['TEAM_LEADER', 'DIRECTOR', 'GENERAL_MANAGER', 'CEO'].includes(profile.role) ||
    (profile.position && ['팀장', '직장', '소장', '총무'].some(p => profile.position?.includes(p)))
  );

  const canManageMeal = profile && (
    ['GENERAL_MANAGER', 'CLERK', 'CEO'].includes(profile.role) ||
    profile.permissions?.includes('meal_snack_mgmt') ||
    (profile.position && ['실장', '서무'].some(p => profile.position?.includes(p)))
  );

  useEffect(() => {
    if (!profile) return;
    
    // If user cannot request snacks but somehow was on that tab (e.g. reload), switch to LUNCH
    if (activeTab === 'SNACK' && !canRequestSnack) {
      setActiveTab('LUNCH');
    }

    // Fetch my lunch requests
    const lunchQ = query(
      collection(db, 'lunchRequests'),
      where('uid', '==', profile.uid),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    const unsubLunch = onSnapshot(lunchQ, (snap) => {
      setMyLunchRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as LunchRequest)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'lunchRequests'));

    // Fetch my snack requests (if allowed)
    let unsubSnack = () => {};
    if (canRequestSnack) {
      const snackQ = query(
        collection(db, 'snackRequests'),
        where('uid', '==', profile.uid),
        orderBy('createdAt', 'desc'),
        limit(10)
      );
      unsubSnack = onSnapshot(snackQ, (snap) => {
        setMySnackRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as SnackRequest)));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'snackRequests'));
    }

    return () => {
      unsubLunch();
      unsubSnack();
    };
  }, [profile, canRequestSnack]);

  const handleLunchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    if (differenceInDays(new Date(lunchDates.end), new Date(lunchDates.start)) < 0) {
      toast.error('종료일이 시작일보다 빠를 수 없습니다.');
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'lunchRequests'), {
        uid: profile.uid,
        userName: profile.displayName,
        startDate: lunchDates.start,
        endDate: lunchDates.end,
        status: 'PENDING',
        createdAt: new Date().toISOString()
      });

      // Notify Clerk and General Manager
      const managersQuery = query(
        collection(db, 'users'),
        where('role', 'in', ['CLERK', 'GENERAL_MANAGER'])
      );
      const managersSnapshot = await getDocs(managersQuery);
      for (const mDoc of managersSnapshot.docs) {
        await addDoc(collection(db, 'notifications'), {
          uid: mDoc.id,
          title: '🍱 도시락 신청 알림',
          message: `${profile.displayName}님이 도시락 수급을 신청했습니다 (${lunchDates.start} ~ ${lunchDates.end})`,
          type: 'SYSTEM',
          isRead: false,
          createdAt: new Date().toISOString(),
          fromUid: profile.uid,
          fromName: profile.displayName
        });
      }

      toast.success('도시락 신청이 완료되었습니다.');
    } catch (error) {
      console.error(error);
      toast.error('신청 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSnackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setLoading(true);
    try {
      await addDoc(collection(db, 'snackRequests'), {
        uid: profile.uid,
        userName: profile.displayName,
        departmentName: profile.departmentName || '기타',
        quantity: snackForm.quantity,
        deliveryDate: snackForm.deliveryDate,
        status: 'PENDING',
        createdAt: new Date().toISOString()
      });

      // Notify Clerk and General Manager
      const managersQuery = query(
        collection(db, 'users'),
        where('role', 'in', ['CLERK', 'GENERAL_MANAGER'])
      );
      const managersSnapshot = await getDocs(managersQuery);
      for (const mDoc of managersSnapshot.docs) {
        await addDoc(collection(db, 'notifications'), {
          uid: mDoc.id,
          title: '☕ 간식 신청 알림',
          message: `${profile.displayName}님이 간식 ${snackForm.quantity}개를 신청했습니다 (희망일: ${snackForm.deliveryDate})`,
          type: 'SYSTEM',
          isRead: false,
          createdAt: new Date().toISOString(),
          fromUid: profile.uid,
          fromName: profile.displayName
        });
      }

      toast.success('간식 신청이 완료되었습니다.');
      setSnackForm(prev => ({ ...prev, quantity: 1 }));
    } catch (error) {
      console.error(error);
      toast.error('신청 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-24 px-1 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 border-b border-border/50">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="rounded-full text-foreground hover:bg-muted">
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <div>
            <h1 className="text-2xl font-black text-foreground tracking-tight leading-none">식사 및 간식 신청</h1>
            <p className="text-sm text-muted-foreground font-bold mt-1">개인 식사 및 팀 간식 신청</p>
          </div>
        </div>

        {canManageMeal && (
          <Button 
            onClick={() => navigate('/meal-mgmt')}
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl h-11 px-5 text-xs shadow-lg shadow-emerald-950/20 flex gap-2 items-center"
          >
            <CheckCircle2 className="w-4 h-4" />
            도시락·간식 승인/관리 🍱
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-muted p-1 rounded-2xl flex gap-1">
        <button
          onClick={() => setActiveTab('LUNCH')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all font-black text-sm ${
            activeTab === 'LUNCH' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-muted-foreground hover:bg-muted/50'
          }`}
        >
          <Utensils className="w-4 h-4" />
          식사 신청 (개인)
        </button>
        {canRequestSnack && (
          <button
            onClick={() => setActiveTab('SNACK')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all font-black text-sm ${
              activeTab === 'SNACK' ? 'bg-amber-500 text-white shadow-lg shadow-amber-900/20' : 'text-muted-foreground hover:bg-muted/50'
            }`}
          >
            <Coffee className="w-4 h-4" />
            간식 신청 (팀장 전용)
          </button>
        )}
      </div>

      {activeTab === 'LUNCH' ? (
        <div className="space-y-6">
          <Card className="bg-card border-border rounded-3xl overflow-hidden shadow-none border">
            <CardHeader>
              <CardTitle className="text-xl font-black text-foreground flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                기간 선택
              </CardTitle>
              <CardDescription className="text-muted-foreground/60 font-bold">식사 신청 기간을 설정해 주세요.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLunchSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-black text-muted-foreground/40 uppercase">시작일</Label>
                    <Input 
                      type="date"
                      value={lunchDates.start}
                      onChange={e => setLunchDates(prev => ({ ...prev, start: e.target.value }))}
                      className="bg-muted border-border rounded-xl h-12 font-bold text-foreground"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-black text-muted-foreground/40 uppercase">종료일</Label>
                    <Input 
                      type="date"
                      value={lunchDates.end}
                      onChange={e => setLunchDates(prev => ({ ...prev, end: e.target.value }))}
                      className="bg-muted border-border rounded-xl h-12 font-bold text-foreground"
                    />
                  </div>
                </div>

                <div className="bg-primary/5 rounded-2xl p-4 border border-primary/20 flex gap-3">
                  <AlertCircle className="w-5 h-5 text-primary shrink-0 mt-1" />
                  <p className="text-xs font-bold text-primary/80 leading-relaxed">
                    식사는 지정된 기간 동안 매일 전달되는 시스템입니다. <br/>
                    서무 또는 실장이 최종 확인 후 전달이 시작됩니다.
                  </p>
                </div>

                <Button 
                  type="submit" 
                  disabled={loading}
                  className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground font-black text-lg rounded-2xl shadow-lg shadow-primary/20"
                >
                  {loading ? '처리 중...' : '식사 신청하기'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h3 className="text-lg font-black text-foreground flex items-center gap-2 ml-2">
              <Archive className="w-5 h-5 text-muted-foreground/20" />
              최근 신청 내역
            </h3>
            <div className="space-y-3">
              {myLunchRequests.length === 0 ? (
                <div className="py-12 text-center border-2 border-dashed border-border rounded-3xl bg-muted/20">
                  <p className="text-muted-foreground/20 font-bold">최근 신청 내역이 없습니다.</p>
                </div>
              ) : (
                <>
                  {(showAllLunch ? myLunchRequests : myLunchRequests.slice(0, 3)).map(req => (
                    <div key={req.id} className="bg-card border border-border p-5 rounded-2xl flex items-center justify-between hover:bg-muted/30 transition-all shadow-none">
                      <div className="space-y-1">
                        <p className="text-sm font-black text-foreground">
                          {req.startDate} ~ {req.endDate}
                        </p>
                        <p className="text-[10px] text-muted-foreground/40 font-bold">신청일: {format(new Date(req.createdAt), 'yyyy-MM-dd')}</p>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-[10px] font-black ${
                        req.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-500' :
                        req.status === 'REJECTED' ? 'bg-red-500/20 text-red-500' :
                        'bg-amber-500/20 text-amber-500'
                      }`}>
                        {req.status === 'APPROVED' ? '승인완료' : req.status === 'REJECTED' ? '반려' : '대기중'}
                      </div>
                    </div>
                  ))}
                  {myLunchRequests.length > 3 && (
                    <Button
                      variant="ghost"
                      onClick={() => setShowAllLunch(!showAllLunch)}
                      className="w-full h-11 text-xs font-black bg-muted/30 hover:bg-muted/60 border border-border rounded-2xl transition-all"
                    >
                      {showAllLunch ? '접기' : `신청내역 더보기 (${myLunchRequests.length - 3}개 더 있음)`}
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {!canRequestSnack ? (
            <Card className="bg-destructive/5 border-destructive/10 rounded-3xl p-8 text-center flex flex-col items-center gap-4 shadow-none">
              <div className="w-16 h-16 bg-destructive/20 rounded-full flex items-center justify-center text-destructive">
                <AlertCircle className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-black text-foreground">권한이 없습니다</h3>
                <p className="text-sm text-muted-foreground font-bold leading-relaxed">
                  간식 신청은 팀장, 직장, 소장, 총무만 가능합니다.<br/>
                  팀 단위 신청을 위해 소속 팀장님께 문의해 주세요.
                </p>
              </div>
            </Card>
          ) : (
            <>
              <Card className="bg-card border-border rounded-3xl overflow-hidden shadow-none border">
                <CardHeader>
                  <CardTitle className="text-xl font-black text-foreground flex items-center gap-2">
                    <Coffee className="w-5 h-5 text-amber-500" />
                    간식 대량 신청
                  </CardTitle>
                  <CardDescription className="text-muted-foreground/60 font-bold">{profile?.departmentName} 소속 간식 신청</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSnackSubmit} className="space-y-8">
                    <div className="space-y-4">
                      <Label className="text-xs font-black text-muted-foreground/40 uppercase tracking-widest">수량 설정</Label>
                      <div className="flex items-center justify-between bg-muted/50 p-4 rounded-2xl border border-border">
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => setSnackForm(prev => ({ ...prev, quantity: Math.max(1, prev.quantity - 1) }))}
                          className="w-12 h-12 bg-muted rounded-xl text-foreground hover:bg-muted/80 active:scale-95 transition-all"
                        >
                          <Minus className="w-6 h-6" />
                        </Button>
                        <div className="text-center">
                          <span className="text-4xl font-black text-foreground">{snackForm.quantity}</span>
                          <span className="text-lg font-bold text-muted-foreground/40 ml-2">개</span>
                        </div>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => setSnackForm(prev => ({ ...prev, quantity: prev.quantity + 1 }))}
                          className="w-12 h-12 bg-muted rounded-xl text-foreground hover:bg-muted/80 active:scale-95 transition-all"
                        >
                          <Plus className="w-6 h-6" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <Label className="text-xs font-black text-muted-foreground/40 uppercase tracking-widest">수급 희망일</Label>
                      <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/20 group-focus-within:text-amber-500 transition-colors">
                          <Calendar className="w-5 h-5" />
                        </div>
                        <Input 
                          type="date"
                          value={snackForm.deliveryDate}
                          onChange={e => setSnackForm(prev => ({ ...prev, deliveryDate: e.target.value }))}
                          className="bg-muted border-border rounded-2xl h-14 pl-12 font-black text-lg focus:ring-amber-500/20 text-foreground"
                        />
                      </div>
                    </div>

                    <div className="bg-amber-500/5 rounded-2xl p-4 border border-amber-500/20 flex gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-1" />
                      <p className="text-xs font-bold text-amber-500/80 leading-relaxed">
                        간식은 실장 및 서무 승인 후 해당 일자에 배송됩니다. <br/>
                        팀원 수에 맞춰 정확한 수량을 입력해 주세요.
                      </p>
                    </div>

                    <Button 
                      type="submit" 
                      disabled={loading}
                      className="w-full h-14 bg-amber-500 hover:bg-amber-600 text-white font-black text-lg rounded-2xl shadow-lg shadow-amber-900/20"
                    >
                      {loading ? '처리 중...' : '간식 신청하기'}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <h3 className="text-lg font-black text-foreground flex items-center gap-2 ml-2">
                  <Archive className="w-5 h-5 text-muted-foreground/20" />
                  팀 간식 신청 내역
                </h3>
                <div className="space-y-3">
                  {mySnackRequests.length === 0 ? (
                    <div className="py-12 text-center border-2 border-dashed border-border rounded-3xl bg-muted/20">
                      <p className="text-muted-foreground/20 font-bold">최근 신청 내역이 없습니다.</p>
                    </div>
                  ) : (
                    <>
                      {(showAllSnacks ? mySnackRequests : mySnackRequests.slice(0, 3)).map(req => (
                        <div key={req.id} className="bg-card border border-border p-5 rounded-2xl flex items-center justify-between hover:bg-muted/30 transition-all shadow-none">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                               <span className="text-sm font-black text-foreground">{req.deliveryDate}</span>
                               <span className="text-[10px] font-black bg-amber-500/10 text-amber-500 px-2 rounded-md">{req.quantity}개</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground/40 font-bold">신청자: {req.userName} | {req.departmentName}</p>
                          </div>
                          <div className={`px-3 py-1 rounded-full text-[10px] font-black ${
                            req.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-500' :
                            req.status === 'REJECTED' ? 'bg-red-500/20 text-red-500' :
                            'bg-amber-500/20 text-amber-500'
                           }`}>
                            {req.status === 'APPROVED' ? '배송확정' : req.status === 'REJECTED' ? '반려' : '대기중'}
                          </div>
                        </div>
                      ))}
                      {mySnackRequests.length > 3 && (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setShowAllSnacks(!showAllSnacks)}
                          className="w-full h-11 text-xs font-black bg-muted/30 hover:bg-muted/60 border border-border rounded-2xl transition-all"
                        >
                          {showAllSnacks ? '접기' : `신청내역 더보기 (${mySnackRequests.length - 3}개 더 있음)`}
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
