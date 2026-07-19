import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/AuthProvider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  ChevronLeft, 
  CheckCircle2, 
  XCircle, 
  Utensils, 
  Coffee, 
  Search,
  Filter,
  User,
  Clock,
  Check,
  X
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '@/firebase';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { LunchRequest, SnackRequest } from '@/types';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { exportToExcel, exportToPDF } from '@/lib/exportUtils';
import { Download, FileText, Printer } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export const MealManagement: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'LUNCH' | 'SNACK'>('LUNCH');
  const [lunchRequests, setLunchRequests] = useState<LunchRequest[]>([]);
  const [snackRequests, setSnackRequests] = useState<SnackRequest[]>([]);
  const [filter, setFilter] = useState<'PENDING' | 'APPROVED' | 'ALL'>('PENDING');

  const handleExportExcel = () => {
    if (activeTab === 'LUNCH') {
      const data = lunchRequests.map(r => ({
        '성명': r.userName,
        '시작일': r.startDate,
        '종료일': r.endDate,
        '상태': r.status === 'APPROVED' ? '승인' : r.status === 'PENDING' ? '대기' : '반려',
        '신청일': format(new Date(r.createdAt), 'yyyy-MM-dd HH:mm'),
        '승인자': r.approvedByName || '-'
      }));
      exportToExcel(data, `식사신청내역_${format(new Date(), 'yyyyMMdd')}`, '식사');
    } else {
      const data = snackRequests.map(r => ({
        '성명': r.userName,
        '부서': r.departmentName,
        '수량': r.quantity,
        '배송일': r.deliveryDate,
        '상태': r.status === 'APPROVED' ? '확정' : r.status === 'PENDING' ? '대기' : '반려',
        '신청일': format(new Date(r.createdAt), 'yyyy-MM-dd HH:mm'),
        '승인자': r.approvedByName || '-'
      }));
      exportToExcel(data, `간식신청내역_${format(new Date(), 'yyyyMMdd')}`, '간식');
    }
  };

  const canManageMeal = profile && (
    ['GENERAL_MANAGER', 'CLERK', 'CEO'].includes(profile.role) ||
    profile.permissions?.includes('meal_snack_mgmt') ||
    (profile.position && ['실장', '서무'].some(p => profile.position?.includes(p)))
  );

  useEffect(() => {
    if (!canManageMeal) return;

    let lunchQ = query(collection(db, 'lunchRequests'), orderBy('createdAt', 'desc'));
    if (filter !== 'ALL') {
      lunchQ = query(collection(db, 'lunchRequests'), where('status', '==', filter), orderBy('createdAt', 'desc'));
    }

    const unsubLunch = onSnapshot(lunchQ, (snap) => {
      setLunchRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as LunchRequest)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'lunchRequests');
    });

    let snackQ = query(collection(db, 'snackRequests'), orderBy('createdAt', 'desc'));
    if (filter !== 'ALL') {
      snackQ = query(collection(db, 'snackRequests'), where('status', '==', filter), orderBy('createdAt', 'desc'));
    }

    const unsubSnack = onSnapshot(snackQ, (snap) => {
      setSnackRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as SnackRequest)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'snackRequests');
    });

    return () => {
      unsubLunch();
      unsubSnack();
    };
  }, [canManageMeal, filter]);

  const handleApprove = async (type: 'LUNCH' | 'SNACK', requestId: string) => {
    if (!profile) return;
    try {
      const collectionName = type === 'LUNCH' ? 'lunchRequests' : 'snackRequests';
      await updateDoc(doc(db, collectionName, requestId), {
        status: 'APPROVED',
        approvedBy: profile.uid,
        approvedByName: profile.displayName,
        approvedAt: new Date().toISOString()
      });
      toast.success('승인 처리가 완료되었습니다.');
    } catch (error) {
      toast.error('승인 처리 중 오류가 발생했습니다.');
    }
  };

  const handleReject = async (type: 'LUNCH' | 'SNACK', requestId: string) => {
    if (!profile) return;
    try {
      const collectionName = type === 'LUNCH' ? 'lunchRequests' : 'snackRequests';
      await updateDoc(doc(db, collectionName, requestId), {
        status: 'REJECTED',
        approvedBy: profile.uid,
        approvedByName: profile.displayName,
        approvedAt: new Date().toISOString()
      });
      toast.success('반려 처리가 완료되었습니다.');
    } catch (error) {
      toast.error('반려 처리 중 오류가 발생했습니다.');
    }
  };

  if (!canManageMeal) {
    return (
      <div className="p-8 text-center flex flex-col items-center gap-4">
        <XCircle className="w-16 h-16 text-red-500 opacity-20" />
        <h2 className="text-xl font-black text-white">관리자 전용 페이지입니다.</h2>
        <Button onClick={() => navigate('/')}>홈으로 돌아가기</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 px-1 max-w-5xl mx-auto">
      <div className="flex items-center justify-between py-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="rounded-full text-foreground">
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <div>
            <h1 className="text-2xl font-black text-foreground tracking-tight leading-none">식사/간식 신청 관리</h1>
            <p className="text-sm text-muted-foreground font-bold">서무 및 실장 승인대기 내역 확인</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={handleExportExcel}
            className="hidden sm:flex bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl gap-2 h-12 shadow-lg shadow-emerald-900/20"
          >
            <Download className="w-4 h-4" />
            통합 보고서 (EXCEL)
          </Button>
          <Button 
            variant="outline"
            onClick={() => window.print()}
            className="bg-muted border-border text-foreground font-black rounded-2xl gap-2 h-12 hover:bg-muted/80 transition-all"
          >
            <Printer className="w-4 h-4" />
            인쇄
          </Button>
        </div>
      </div>

      {/* Tabs & Filters */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="bg-muted p-1 rounded-2xl flex gap-1 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('LUNCH')}
            className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl transition-all font-black text-sm flex items-center gap-2 ${
              activeTab === 'LUNCH' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-muted-foreground hover:bg-muted/50'
            }`}
          >
            <Utensils className="w-4 h-4" />
            식사 신청
          </button>
          <button
            onClick={() => setActiveTab('SNACK')}
            className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl transition-all font-black text-sm flex items-center gap-2 ${
              activeTab === 'SNACK' ? 'bg-amber-500 text-white shadow-lg shadow-amber-900/20' : 'text-muted-foreground hover:bg-muted/50'
            }`}
          >
            <Coffee className="w-4 h-4" />
            간식 신청
          </button>
        </div>

        <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {(['PENDING', 'APPROVED', 'ALL'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-black transition-all ${
                filter === f ? 'bg-muted text-foreground border border-border' : 'bg-transparent text-muted-foreground border border-border/50 hover:bg-muted/50'
              }`}
            >
              {f === 'PENDING' ? '대기중' : f === 'APPROVED' ? '승인됨' : '전체보기'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeTab === 'LUNCH' ? (
          lunchRequests.length === 0 ? (
            <div className="col-span-full py-20 text-center bg-muted/20 rounded-3xl border-2 border-dashed border-border px-6">
              <p className="text-muted-foreground/30 font-black">선택한 조건의 식사 신청 내역이 없습니다.</p>
            </div>
          ) : (
            lunchRequests.map((req) => (
              <Card key={req.id} className="bg-card border-border rounded-3xl overflow-hidden hover:bg-muted/50 transition-all border shadow-none">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <CardTitle className="text-lg font-black text-foreground">{req.userName}</CardTitle>
                        <CardDescription className="text-[10px] font-bold text-muted-foreground/60">개인 식사 신청</CardDescription>
                      </div>
                    </div>
                    <Badge variant={req.status === 'PENDING' ? 'outline' : req.status === 'APPROVED' ? 'default' : 'destructive'} className="font-black text-[10px]">
                      {req.status === 'PENDING' ? '대기' : req.status === 'APPROVED' ? '승인' : '반려'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-muted/50 p-4 rounded-2xl space-y-2 border border-border">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest">신청 기간</span>
                      <Clock className="w-3 h-3 text-muted-foreground/40" />
                    </div>
                    <p className="text-sm font-black text-primary">
                      {req.startDate} ~ {req.endDate}
                    </p>
                  </div>
                  
                  {req.status === 'PENDING' && (
                    <div className="flex gap-2 pt-2">
                      <Button 
                        size="sm" 
                        onClick={() => handleApprove('LUNCH', req.id)}
                        className="flex-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white font-black rounded-xl gap-2 h-10"
                      >
                        <Check className="w-4 h-4" />
                        승인
                      </Button>
                      <Button 
                        size="sm"
                        variant="ghost" 
                        onClick={() => handleReject('LUNCH', req.id)}
                        className="flex-1 text-destructive/40 hover:text-destructive hover:bg-destructive/10 font-bold rounded-xl h-10"
                      >
                        <X className="w-4 h-4" />
                        반려
                      </Button>
                    </div>
                  )}

                  {req.status !== 'PENDING' && (
                    <div className="pt-2 text-[10px] font-bold text-muted-foreground/30 text-right">
                      처리: {req.approvedByName} ({format(new Date(req.approvedAt || req.createdAt), 'MM/dd HH:mm')})
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )
        ) : (
          snackRequests.length === 0 ? (
            <div className="col-span-full py-20 text-center bg-muted/20 rounded-3xl border-2 border-dashed border-border px-6">
              <p className="text-muted-foreground/30 font-black">선택한 조건의 간식 신청 내역이 없습니다.</p>
            </div>
          ) : (
            snackRequests.map((req) => (
              <Card key={req.id} className="bg-card border-border rounded-3xl overflow-hidden hover:bg-muted/50 transition-all border shadow-none">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500">
                        <Coffee className="w-5 h-5" />
                      </div>
                      <div>
                        <CardTitle className="text-lg font-black text-foreground">{req.userName}</CardTitle>
                        <CardDescription className="text-[10px] font-bold text-amber-500/60 uppercase tracking-tight">{req.departmentName}</CardDescription>
                      </div>
                    </div>
                    <Badge variant={req.status === 'PENDING' ? 'outline' : req.status === 'APPROVED' ? 'default' : 'destructive'} className="font-black text-[10px]">
                      {req.status === 'PENDING' ? '대기' : req.status === 'APPROVED' ? '확정' : '반려'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-muted/50 p-4 rounded-2xl space-y-2 border border-border">
                      <span className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest block">수량</span>
                      <p className="text-xl font-black text-amber-500">{req.quantity} <span className="text-xs text-muted-foreground/30">개</span></p>
                    </div>
                    <div className="bg-muted/50 p-4 rounded-2xl space-y-2 border border-border">
                      <span className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest block">수급일</span>
                      <p className="text-sm font-black text-foreground">{req.deliveryDate}</p>
                    </div>
                  </div>
                  
                  {req.status === 'PENDING' && (
                    <div className="flex gap-2 pt-2">
                      <Button 
                        size="sm" 
                        onClick={() => handleApprove('SNACK', req.id)}
                        className="flex-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white font-black rounded-xl gap-2 h-10"
                      >
                        <Check className="w-4 h-4" />
                        확정
                      </Button>
                      <Button 
                        size="sm"
                        variant="ghost" 
                        onClick={() => handleReject('SNACK', req.id)}
                        className="flex-1 text-destructive/40 hover:text-destructive hover:bg-destructive/10 font-bold rounded-xl h-10"
                      >
                        <X className="w-4 h-4" />
                        반려
                      </Button>
                    </div>
                  )}

                  {req.status !== 'PENDING' && (
                    <div className="pt-2 text-[10px] font-bold text-muted-foreground/30 text-right">
                      처리: {req.approvedByName} ({format(new Date(req.approvedAt || req.createdAt), 'MM/dd HH:mm')})
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )
        )}
      </div>
    </div>
  );
};
