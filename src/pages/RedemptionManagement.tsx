import React, { useState, useEffect } from 'react';
import { useAuth } from '@/src/components/AuthProvider';
import { db } from '@/src/firebase';
import { collection, query, onSnapshot, orderBy, doc, updateDoc, increment, getDoc, addDoc } from 'firebase/firestore';
import { RedemptionRequest } from '@/src/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  History, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Search, 
  MoreVertical,
  Banknote,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  CircleDollarSign,
  Download
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

export const RedemptionManagement: React.FC = () => {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<RedemptionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReq, setSelectedReq] = useState<RedemptionRequest | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'COMPLETED' | 'REJECTED'>('PENDING');
  const [exportMonth, setExportMonth] = useState(format(new Date(), 'yyyy-MM'));

  useEffect(() => {
    const q = query(
      collection(db, 'redemptionRequests'),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setRequests(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RedemptionRequest)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleStatusUpdate = async (req: RedemptionRequest, newStatus: 'APPROVED' | 'REJECTED' | 'COMPLETED') => {
    if (!profile) return;
    
    try {
      const reqRef = doc(db, 'redemptionRequests', req.id);
      
      // If rejecting, return points to user
      if (newStatus === 'REJECTED' && req.status !== 'REJECTED') {
        const userRef = doc(db, 'users', req.uid);
        await updateDoc(userRef, {
          points: increment(req.pointsRequested)
        });
      }

      await updateDoc(reqRef, {
        status: newStatus,
        processedAt: new Date().toISOString(),
        processedBy: profile.uid,
        processedByName: profile.displayName
      });

      // Notify User
      await addDoc(collection(db, 'notifications'), {
        uid: req.uid,
        title: '현물 신청 상태 변경',
        message: `신청하신 ${req.pointsRequested}P 환불 신청이 ${newStatus === 'APPROVED' ? '승인' : newStatus === 'REJECTED' ? '반려' : '지급 완료'}되었습니다.`,
        type: 'SYSTEM',
        isRead: false,
        createdAt: new Date().toISOString(),
        fromUid: profile.uid,
        fromName: profile.displayName
      });

      toast.success(`${newStatus === 'APPROVED' ? '승인' : newStatus === 'REJECTED' ? '반려' : '지급 완료'} 처리되었습니다.`);
      setIsDetailOpen(false);
    } catch (error) {
      console.error(error);
      toast.error('오류가 발생했습니다.');
    }
  };

  const handleExportExcel = () => {
    const approvedRequests = requests.filter(r => 
      (r.status === 'APPROVED' || r.status === 'COMPLETED') && 
      r.createdAt.startsWith(exportMonth)
    );

    if (approvedRequests.length === 0) {
      toast.error('해당 월의 승인/지급 내역이 없습니다.');
      return;
    }

    const data = approvedRequests.map(r => ({
      '신청일': format(new Date(r.createdAt), 'yyyy-MM-dd HH:mm'),
      '성명': r.userName,
      '신청 포인트': r.pointsRequested,
      '지급 금액': r.amount,
      '상태': r.status === 'APPROVED' ? '승인됨' : '지급완료',
      '처리일': r.processedAt ? format(new Date(r.processedAt), 'yyyy-MM-dd HH:mm') : '-',
      '승인자': r.processedByName || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '현물신청내역');
    XLSX.writeFile(wb, `현물신청내역_${exportMonth}.xlsx`);
    toast.success(`${exportMonth} 내역이 다운로드되었습니다.`);
  };

  const statusMap = {
    'PENDING': { label: '대기중', color: 'text-amber-500', bgColor: 'bg-amber-500/10', icon: Clock },
    'APPROVED': { label: '승인됨', color: 'text-blue-500', bgColor: 'bg-blue-500/10', icon: CheckCircle2 },
    'REJECTED': { label: '반려됨', color: 'text-red-500', bgColor: 'bg-red-500/10', icon: XCircle },
    'COMPLETED': { label: '지급완료', color: 'text-emerald-500', bgColor: 'bg-emerald-500/10', icon: CheckCircle2 },
  };

  const filteredRequests = requests.filter(r => filter === 'ALL' || r.status === filter);

  return (
    <div className="space-y-6 pb-24 px-1">
      <header className="py-6 space-y-4">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-white leading-tight">현물 신청 관리</h2>
          <p className="text-muted-foreground font-bold">포인트 환전 신청을 승인하고 지급을 관리하세요</p>
        </div>

        {/* Filter Tabs */}
        <div className="flex bg-card p-1 rounded-2xl border border-white/5 overflow-x-auto scrollbar-hide">
          {(['PENDING', 'APPROVED', 'COMPLETED', 'REJECTED', 'ALL'] as const).map((tab) => (
             <Button
                key={tab}
                variant="ghost"
                className={cn(
                  "flex-1 h-10 font-black text-xs rounded-xl transition-all whitespace-nowrap px-4",
                  filter === tab ? "bg-white/5 text-primary" : "text-muted-foreground hover:text-white"
                )}
                onClick={() => setFilter(tab)}
             >
                {tab === 'PENDING' ? '대기중' : tab === 'APPROVED' ? '승인됨' : tab === 'COMPLETED' ? '지급완료' : tab === 'REJECTED' ? '반려됨' : '전체'}
                <span className="ml-1 opacity-50">({requests.filter(r => r.status === tab || tab === 'ALL').length})</span>
             </Button>
          ))}
        </div>

        {/* Excel Export Row */}
        <div className="flex gap-2">
           <div className="relative flex-1">
             <input 
               type="month" 
               value={exportMonth}
               onChange={(e) => setExportMonth(e.target.value)}
               className="w-full h-12 bg-card border border-white/5 rounded-xl px-4 text-xs font-black text-white focus:outline-none focus:ring-1 focus:ring-primary appearance-none"
               style={{ colorScheme: 'dark' }}
             />
           </div>
           <Button 
             variant="outline" 
             className="h-12 bg-primary/10 border-primary/20 text-primary font-black rounded-xl gap-2 text-xs"
             onClick={handleExportExcel}
           >
             <Download className="w-4 h-4" /> 엑셀 다운로드
           </Button>
        </div>
      </header>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 gap-3">
         <Card className="bg-card border-none rounded-2xl border border-white/5 overflow-hidden">
            <CardContent className="p-4 flex flex-col gap-1 items-center">
               <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">대기 총액</span>
               <span className="text-xl font-black text-amber-500">
                  {requests.filter(r => r.status === 'PENDING').reduce((acc, curr) => acc + curr.amount, 0).toLocaleString()} <span className="text-xs">원</span>
               </span>
            </CardContent>
         </Card>
         <Card className="bg-card border-none rounded-2xl border border-white/5 overflow-hidden">
            <CardContent className="p-4 flex flex-col gap-1 items-center">
               <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">금월 지급액</span>
               <span className="text-xl font-black text-emerald-500">
                  {requests.filter(r => r.status === 'COMPLETED').reduce((acc, curr) => acc + curr.amount, 0).toLocaleString()} <span className="text-xs">원</span>
               </span>
            </CardContent>
         </Card>
      </div>

      {/* List */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {filteredRequests.map((req) => {
            const statusInfo = statusMap[req.status];
            const StatusIcon = statusInfo.icon;
            return (
              <motion.div 
                key={req.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card p-5 rounded-2xl border border-white/5 flex items-center justify-between group active:scale-[0.99] transition-all cursor-pointer"
                onClick={() => {
                  setSelectedReq(req);
                  setIsDetailOpen(true);
                }}
              >
                <div className="flex gap-4">
                  <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", statusInfo.bgColor)}>
                    <StatusIcon className={cn("w-6 h-6", statusInfo.color)} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-white">{req.userName}</span>
                      <Badge className={cn("rounded-lg font-black text-[9px] border-none px-1.5 h-4", statusInfo.bgColor, statusInfo.color)}>
                        {statusInfo.label}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-bold">{format(new Date(req.createdAt), 'yyyy.MM.dd')}</p>
                    <p className="text-xs font-black text-primary">{req.amount.toLocaleString()}원 ({req.pointsRequested}P)</p>
                  </div>
                </div>
                <MoreVertical className="w-5 h-5 text-white/10" />
              </motion.div>
            );
          })}
        </AnimatePresence>

        {!loading && filteredRequests.length === 0 && (
          <div className="py-20 text-center opacity-20 bg-card rounded-2xl border border-dashed border-white/10">
            <p className="text-xs font-black">내역이 없습니다</p>
          </div>
        )}
      </div>

      {/* Action Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="bg-card border-none rounded-3xl text-white p-0 overflow-hidden max-w-sm">
          <DialogHeader className="p-8 pb-4">
            <DialogTitle className="text-xl font-black">신청 상세 정보</DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs font-bold">신청 내역을 확인하고 승인 여부를 결정하세요</DialogDescription>
          </DialogHeader>
          
          {selectedReq && (
            <>
              <div className="px-8 space-y-6">
                {/* Details card */}
                <div className="bg-white/5 rounded-2xl p-6 space-y-4">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground font-black uppercase">신청인</span>
                    <span className="text-white font-black">{selectedReq.userName}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground font-black uppercase">신청 포인트</span>
                    <span className="text-white font-black">{selectedReq.pointsRequested.toLocaleString()} P</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground font-black uppercase">지급 금액</span>
                    <span className="text-xl font-black text-primary">{selectedReq.amount.toLocaleString()}원</span>
                  </div>
                  <div className="pt-4 border-t border-white/5">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-muted-foreground font-black uppercase">신청일시</span>
                      <span className="text-white font-bold">{format(new Date(selectedReq.createdAt), 'yyyy.MM.dd HH:mm')}</span>
                    </div>
                  </div>
                </div>

                {/* Status-specific actions */}
                <div className="space-y-3 pb-8">
                  {selectedReq.status === 'PENDING' && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <Button 
                          className="h-14 bg-red-500/10 text-red-500 font-black rounded-2xl hover:bg-red-500 hover:text-white transition-all"
                          onClick={() => handleStatusUpdate(selectedReq, 'REJECTED')}
                        >
                          <ThumbsDown className="w-4 h-4 mr-2" /> 반려
                        </Button>
                        <Button 
                          className="h-14 bg-blue-500/10 text-blue-500 font-black rounded-2xl hover:bg-blue-500 hover:text-white transition-all"
                          onClick={() => handleStatusUpdate(selectedReq, 'APPROVED')}
                        >
                          <ThumbsUp className="w-4 h-4 mr-2" /> 승인
                        </Button>
                      </div>
                      <p className="text-[10px] text-center text-muted-foreground font-bold">승인 시 작업자에게 알림이 전송됩니다.</p>
                    </>
                  )}

                  {selectedReq.status === 'APPROVED' && (
                    <>
                      <Button 
                        className="w-full h-16 bg-emerald-500 text-white font-black rounded-2xl shadow-lg shadow-emerald-500/20 hover:scale-[1.01] active:scale-[0.98] transition-all"
                        onClick={() => handleStatusUpdate(selectedReq, 'COMPLETED')}
                      >
                        <CircleDollarSign className="w-5 h-5 mr-2" /> 지급 완료 처리
                      </Button>
                      <p className="text-[10px] text-center text-emerald-500/70 font-bold italic">실제 현금을 지급한 후 이 버튼을 눌러주세요.</p>
                    </>
                  )}

                  {(selectedReq.status === 'COMPLETED' || selectedReq.status === 'REJECTED') && (
                    <div className="bg-white/5 p-4 rounded-2xl flex items-center justify-center gap-3">
                       <AlertCircle className="w-4 h-4 text-muted-foreground" />
                       <p className="text-xs font-black text-muted-foreground">이미 처리가 완료된 신청건입니다.</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
