import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { db, handleFirestoreError, OperationType } from '@/firebase';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  doc, 
  updateDoc, 
  getDocs 
} from 'firebase/firestore';
import { UserProfile, WorkRequest } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  Send, 
  Inbox, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Search, 
  Plus, 
  ArrowRight, 
  CornerDownRight, 
  Filter,
  Megaphone,
  User,
  ShieldAlert,
  Briefcase
} from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { AlertSoundPlayer } from '@/lib/sound';

export const RequestCenter: React.FC = () => {
  const { profile } = useAuth();
  
  // Real-time states
  const [requests, setRequests] = useState<WorkRequest[]>([]);
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<'RECEIVED' | 'SENT'>('RECEIVED');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'SAFETY' | 'WORK'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'RESOLVED' | 'REJECTED'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Dialog states
  const [isNewRequestOpen, setIsNewRequestOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [selectedRequestToReject, setSelectedRequestToReject] = useState<WorkRequest | null>(null);
  
  // Form fields
  const [receiverUid, setReceiverUid] = useState('');
  const [requestCategory, setRequestCategory] = useState<'SAFETY' | 'WORK'>('WORK');
  const [isUrgent, setIsUrgent] = useState(false);
  const [requestContent, setRequestContent] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Custom Autocomplete Search States
  const [recipientSearch, setRecipientSearch] = useState('');
  const selectedRecipient = employees.find(emp => emp.uid === receiverUid) || null;

  // Reset search when dialog opens/closes
  useEffect(() => {
    if (!isNewRequestOpen) {
      setRecipientSearch('');
    }
  }, [isNewRequestOpen]);

  // Fetch employees
  useEffect(() => {
    const q = collection(db, 'users');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs
        .map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile))
        .filter(emp => {
          const isNotMe = emp.uid !== profile?.uid;
          const isActive = emp.isActive !== false;
          return isNotMe && isActive;
        });
      
      // Sort alphabetically by displayName
      list.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || '', 'ko'));
      setEmployees(list);
    }, (error) => {
      console.error("Error fetching employees:", error);
    });

    return () => unsubscribe();
  }, [profile?.uid]);

  // Fetch requests (Real-time listener for ALL requests where sender or receiver is me)
  useEffect(() => {
    if (!profile) return;

    const q = query(
      collection(db, 'workRequests'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allRequests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkRequest));
      
      // Filter locally to ensure fast updates and handle security rules gracefully
      const filtered = allRequests.filter(req => 
        req.senderUid === profile.uid || req.receiverUid === profile.uid
      );
      
      setRequests(filtered);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching requests:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile]);

  // Handle request creation
  const handleCreateRequest = async () => {
    if (!profile) return;
    if (!receiverUid) {
      toast.error('요청을 보낼 담당자를 선택해 주세요.');
      return;
    }
    if (!requestContent.trim()) {
      toast.error('요청 사항 내용을 상세히 입력해 주세요.');
      return;
    }

    const selectedEmployee = employees.find(emp => emp.uid === receiverUid);
    if (!selectedEmployee) {
      toast.error('올바른 담당자를 선택해 주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      const receiverName = selectedEmployee.displayName || '담당자';
      const receiverPos = selectedEmployee.position ? ` (${selectedEmployee.position})` : '';

      const docRef = await addDoc(collection(db, 'workRequests'), {
        senderUid: profile.uid,
        senderName: profile.displayName || '이름없음',
        senderPosition: profile.position || '',
        receiverUid: receiverUid,
        receiverName: receiverName,
        receiverNameAndPosition: `${receiverName}${receiverPos}`,
        content: requestContent.trim(),
        isUrgent: isUrgent,
        category: requestCategory,
        status: 'PENDING',
        createdAt: new Date().toISOString()
      });

      // Send alarm notification
      const urgencyLabel = isUrgent ? '🚨 [긴급 요청]' : '📢 [일반 요청]';
      const categoryLabel = requestCategory === 'SAFETY' ? '안전 조치' : '업무 요청';
      
      await addDoc(collection(db, 'notifications'), {
        uid: receiverUid,
        title: `${urgencyLabel} ${categoryLabel}`,
        message: `${profile.displayName || '팀원'} 님이 요청을 등록했습니다: "${requestContent.substring(0, 30)}${requestContent.length > 30 ? '...' : ''}"`,
        type: 'NOTICE',
        isRead: false,
        createdAt: new Date().toISOString(),
        fromUid: profile.uid,
        fromName: profile.displayName || '팀원'
      });

      toast.success('업무/안전 요청 사항이 성공적으로 등록되었습니다.');
      
      // Reset form
      setReceiverUid('');
      setRequestCategory('WORK');
      setIsUrgent(false);
      setRequestContent('');
      setIsNewRequestOpen(false);

      // Play sound
      AlertSoundPlayer.playChime();
    } catch (error) {
      console.error("Error creating request:", error);
      toast.error('요청 사항을 등록하는 도중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle request status update (Complete)
  const handleResolveRequest = async (request: WorkRequest) => {
    if (!profile) return;

    try {
      const requestRef = doc(db, 'workRequests', request.id);
      await updateDoc(requestRef, {
        status: 'RESOLVED',
        resolvedAt: new Date().toISOString()
      });

      // Notify the sender
      await addDoc(collection(db, 'notifications'), {
        uid: request.senderUid,
        title: `✅ [해결 완료] ${request.category === 'SAFETY' ? '안전 조치' : '업무 요청'} 완료`,
        message: `${profile.displayName} 님이 귀하의 요청사항을 해결 처리하였습니다.`,
        type: 'SYSTEM',
        isRead: false,
        createdAt: new Date().toISOString(),
        fromUid: profile.uid,
        fromName: profile.displayName
      });

      toast.success('요청을 해결 완료 처리하였습니다.');
      AlertSoundPlayer.playChime();
    } catch (error) {
      console.error("Error resolving request:", error);
      toast.error('상태를 업데이트하는 도중 오류가 발생했습니다.');
    }
  };

  // Handle request status update (Reject)
  const handleRejectRequestSubmit = async () => {
    if (!profile || !selectedRequestToReject) return;
    if (!rejectReason.trim()) {
      toast.error('반려/거절 사유를 입력해 주세요.');
      return;
    }

    try {
      const requestRef = doc(db, 'workRequests', selectedRequestToReject.id);
      await updateDoc(requestRef, {
        status: 'REJECTED',
        remarks: rejectReason.trim(),
        resolvedAt: new Date().toISOString()
      });

      // Notify the sender
      await addDoc(collection(db, 'notifications'), {
        uid: selectedRequestToReject.senderUid,
        title: `❌ [요청 반려] ${selectedRequestToReject.category === 'SAFETY' ? '안전 조치' : '업무 요청'} 반려`,
        message: `${profile.displayName} 님이 요청을 반려했습니다: "${rejectReason.trim()}"`,
        type: 'SYSTEM',
        isRead: false,
        createdAt: new Date().toISOString(),
        fromUid: profile.uid,
        fromName: profile.displayName
      });

      toast.error('요청을 반려 처리하였습니다.');
      
      // Reset
      setIsRejectOpen(false);
      setSelectedRequestToReject(null);
      setRejectReason('');
    } catch (error) {
      console.error("Error rejecting request:", error);
      toast.error('상태를 업데이트하는 도중 오류가 발생했습니다.');
    }
  };

  // Filter requests
  const filteredRequests = requests.filter(req => {
    // 1. Tab check (sent vs received)
    if (activeTab === 'RECEIVED' && req.receiverUid !== profile?.uid) return false;
    if (activeTab === 'SENT' && req.senderUid !== profile?.uid) return false;

    // 2. Category check
    if (categoryFilter !== 'ALL' && req.category !== categoryFilter) return false;

    // 3. Status check
    if (statusFilter !== 'ALL' && req.status !== statusFilter) return false;

    // 4. Search term check
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      const matchContent = req.content.toLowerCase().includes(term);
      const matchSender = req.senderName.toLowerCase().includes(term);
      const matchReceiver = req.receiverName.toLowerCase().includes(term);
      return matchContent || matchSender || matchReceiver;
    }

    return true;
  });

  return (
    <div className="space-y-6 pb-24 px-1">
      {/* Page Header */}
      <header className="py-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-foreground leading-tight">📞 업무 및 안전 요청</h2>
          <p className="text-muted-foreground font-bold text-sm mt-1">현장 및 안전 관리 담당자에게 빠르게 도움과 조치를 요청하세요</p>
        </div>
        <Button 
          onClick={() => setIsNewRequestOpen(true)}
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-black text-sm h-12 rounded-2xl flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition-transform shrink-0 md:w-auto w-full cursor-pointer"
        >
          <Plus className="w-4.5 h-4.5" />
          신규 요청 등록
        </Button>
      </header>

      {/* Tabs list (Received vs Sent) */}
      <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-2xl">
        <button
          onClick={() => {
            setActiveTab('RECEIVED');
            setStatusFilter('ALL');
          }}
          className={cn(
            "h-12 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center justify-center gap-2",
            activeTab === 'RECEIVED' ? "bg-card text-foreground shadow-lg border border-border/50" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Inbox className="w-4 h-4" />
          나에게 온 요청
          {requests.filter(r => r.receiverUid === profile?.uid && r.status === 'PENDING').length > 0 && (
            <Badge className="bg-red-500 text-white border-none text-[9px] font-black h-4 px-1.5 rounded-full min-w-4 flex items-center justify-center">
              {requests.filter(r => r.receiverUid === profile?.uid && r.status === 'PENDING').length}
            </Badge>
          )}
        </button>
        <button
          onClick={() => {
            setActiveTab('SENT');
            setStatusFilter('ALL');
          }}
          className={cn(
            "h-12 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center justify-center gap-2",
            activeTab === 'SENT' ? "bg-card text-foreground shadow-lg border border-border/50" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Send className="w-4 h-4" />
          내가 보낸 요청
        </button>
      </div>

      {/* Filter and Search Layout */}
      <div className="bg-card/40 border border-border/50 p-4 rounded-[2rem] space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-muted-foreground/40" />
            <Input
              type="text"
              placeholder="내용 또는 사람 이름으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-10 bg-muted/50 border-border/40 focus:border-primary/50 text-xs font-semibold rounded-2xl text-foreground"
            />
          </div>

          {/* Quick Category filter tabs */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {[
              { id: 'ALL', label: '전체' },
              { id: 'SAFETY', label: '🛡️ 안전' },
              { id: 'WORK', label: '🛠️ 업무' }
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(cat.id as any)}
                className={cn(
                  "px-3.5 h-10 rounded-2xl text-xs font-black transition-all border whitespace-nowrap cursor-pointer",
                  categoryFilter === cat.id
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-muted/40 border-border/30 text-muted-foreground hover:bg-muted/60"
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Status Filter buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 border-t border-border/10">
          <span className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-0.5"><Filter className="w-3 h-3" /> 상태:</span>
          {[
            { id: 'ALL', label: '전체' },
            { id: 'PENDING', label: '⏳ 대기중' },
            { id: 'RESOLVED', label: '✅ 완료됨' },
            { id: 'REJECTED', label: '❌ 반려됨' }
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setStatusFilter(st.id as any)}
              className={cn(
                "px-3 py-1.5 rounded-full text-[11px] font-black transition-all cursor-pointer",
                statusFilter === st.id
                  ? "bg-foreground text-background"
                  : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/40"
              )}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Requests List */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-12 text-sm text-muted-foreground font-bold">요청 리스트를 로딩 중입니다...</div>
        ) : filteredRequests.length === 0 ? (
          <Card className="bg-card border-dashed border-border/70 rounded-[2.5rem] py-16 px-4 text-center">
            <CardContent className="flex flex-col items-center justify-center p-0 space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-muted flex items-center justify-center text-muted-foreground/40">
                <Inbox className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-black text-foreground">요청 내역이 없습니다</h4>
                <p className="text-xs text-muted-foreground/50 font-bold max-w-xs mx-auto">
                  {searchTerm || categoryFilter !== 'ALL' || statusFilter !== 'ALL'
                    ? "지정한 검색 조건에 해당하는 요청이 없습니다."
                    : activeTab === 'RECEIVED' 
                      ? "다른 팀원들로부터 나에게 온 업무/안전 요청 사항이 없습니다."
                      : "동료들에게 보낸 업무/안전 요청 내역이 없습니다. 신규 버튼을 눌러 첫 요청을 등록해 보세요!"}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredRequests.map((req) => (
              <Card 
                key={req.id} 
                className={cn(
                  "bg-card border border-border/50 rounded-[2rem] shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:shadow-lg transition-all overflow-hidden flex flex-col justify-between",
                  req.isUrgent && req.status === 'PENDING' ? "border-red-500/30 bg-red-500/[0.01]" : ""
                )}
              >
                {/* Header */}
                <div className="p-5 pb-4 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    {/* Tags */}
                    <div className="flex items-center gap-1.5">
                      {req.isUrgent ? (
                        <Badge className="bg-red-500 hover:bg-red-600 text-white font-black text-[10px] py-1 px-2.5 rounded-full flex items-center gap-1 animate-pulse border-none">
                          <AlertTriangle className="w-3 h-3" />
                          긴급 요청
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[10px] py-1 px-2.5 rounded-full flex items-center gap-1 border-none">
                          일반 요청
                        </Badge>
                      )}

                      {req.category === 'SAFETY' ? (
                        <Badge variant="outline" className="border-amber-500/30 text-amber-500 bg-amber-500/5 font-black text-[10px] py-1 px-2.5 rounded-full flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3" />
                          안전
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-blue-500/30 text-blue-500 bg-blue-500/5 font-black text-[10px] py-1 px-2.5 rounded-full flex items-center gap-1">
                          <Briefcase className="w-3 h-3" />
                          업무
                        </Badge>
                      )}
                    </div>

                    {/* Status Badge */}
                    <div>
                      {req.status === 'PENDING' && (
                        <Badge className="bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 font-black text-[10.5px] py-1 px-2.5 rounded-full border border-yellow-500/20">
                          ⏳ 대기 중
                        </Badge>
                      )}
                      {req.status === 'RESOLVED' && (
                        <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 font-black text-[10.5px] py-1 px-2.5 rounded-full border border-emerald-500/20">
                          ✅ 완료됨
                        </Badge>
                      )}
                      {req.status === 'REJECTED' && (
                        <Badge className="bg-red-500/10 text-red-500 hover:bg-red-500/20 font-black text-[10.5px] py-1 px-2.5 rounded-full border border-red-500/20">
                          ❌ 반려됨
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Flow info (Sender -> Receiver) */}
                  <div className="flex items-center gap-2 bg-muted/40 p-3 rounded-2xl text-xs font-black border border-border/30">
                    <div className="flex items-center gap-1 min-w-0">
                      <div className="w-5 h-5 bg-foreground/5 rounded-md flex items-center justify-center shrink-0">
                        <User className="w-3 h-3 text-foreground/50" />
                      </div>
                      <span className="text-foreground/80 truncate">
                        {req.senderName}
                        {req.senderPosition ? ` (${req.senderPosition})` : ''}
                      </span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0" />
                    <div className="flex items-center gap-1 min-w-0">
                      <div className="w-5 h-5 bg-primary/10 rounded-md flex items-center justify-center shrink-0 text-primary">
                        <User className="w-3 h-3" />
                      </div>
                      <span className="text-primary font-bold truncate">
                        {req.receiverNameAndPosition || req.receiverName}
                      </span>
                    </div>
                  </div>

                  {/* Message Content */}
                  <div className="text-[14px] font-medium leading-relaxed text-foreground/85 px-0.5 whitespace-pre-wrap pt-1">
                    {req.content}
                  </div>
                </div>

                {/* Footer details or actions */}
                <div className="bg-muted/20 px-5 py-4 border-t border-border/40 flex flex-col xs:flex-row xs:items-center justify-between gap-3 text-[11px] text-muted-foreground/50 font-bold">
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> 등록: {format(new Date(req.createdAt), 'yyyy.MM.dd HH:mm', { locale: ko })}</span>
                  
                  {/* Action buttons (If PENDING and I am the receiver) */}
                  {req.status === 'PENDING' && activeTab === 'RECEIVED' ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedRequestToReject(req);
                          setIsRejectOpen(true);
                        }}
                        className="h-8 rounded-full text-xs font-black border-red-500/20 text-red-500 hover:bg-red-500/5 cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5 mr-1" />
                        반려
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleResolveRequest(req)}
                        className="h-8 rounded-full text-xs font-black bg-emerald-500 hover:bg-emerald-600 text-white shadow-md cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        해결 완료
                      </Button>
                    </div>
                  ) : (
                    /* Display resolution information */
                    (req.status === 'RESOLVED' || req.status === 'REJECTED') && (
                      <div className="flex flex-col text-right items-end gap-1 font-bold">
                        <span className="text-[10px] text-muted-foreground/40">
                          처리: {req.resolvedAt ? format(new Date(req.resolvedAt), 'yyyy.MM.dd HH:mm', { locale: ko }) : '확인불가'}
                        </span>
                        {req.status === 'REJECTED' && req.remarks && (
                          <div className="flex items-start gap-1 text-left bg-red-500/5 text-red-500/80 p-2 rounded-xl border border-red-500/10 text-[10px] max-w-xs mt-1">
                            <CornerDownRight className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red-400" />
                            <span>반려사유: {req.remarks}</span>
                          </div>
                        )}
                      </div>
                    )
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 1. Register New Request Dialog */}
      <Dialog open={isNewRequestOpen} onOpenChange={setIsNewRequestOpen}>
        <DialogContent className="bg-card border border-border text-foreground max-w-md rounded-[2.5rem] p-6 shadow-2xl">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-xl font-black text-center flex items-center justify-center gap-2">
              📞 신규 요청사항 등록
            </DialogTitle>
            <DialogDescription className="text-center text-muted-foreground/60 text-xs font-bold">
              현장 담당자를 지정하고 실시간 업무/안전 알림을 보냅니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Recipient */}
            <div className="space-y-1.5 relative">
              <label className="text-xs font-black text-muted-foreground/75 px-1 flex items-center justify-between">
                <span>👤 수신 담당자 지정</span>
                {selectedRecipient && (
                  <button 
                    type="button" 
                    onClick={() => {
                      setReceiverUid('');
                      setRecipientSearch('');
                    }}
                    className="text-[10px] text-red-500 font-bold hover:underline cursor-pointer"
                  >
                    다른 사람 검색
                  </button>
                )}
              </label>

              {selectedRecipient ? (
                // Selected state
                <div className="flex items-center justify-between p-3 bg-primary/5 border border-primary/25 rounded-2xl">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                    <div className="text-left min-w-0">
                      <div className="text-xs font-black text-foreground flex items-center gap-1.5">
                        <span className="truncate">{selectedRecipient.displayName}</span>
                        {selectedRecipient.position && (
                          <span className="text-[10px] text-muted-foreground/70 bg-muted px-1.5 py-0.5 rounded-md shrink-0">
                            {selectedRecipient.position}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground/60 font-medium truncate mt-0.5">
                        {selectedRecipient.departmentName || selectedRecipient.workplace || '소속 부서 없음'}
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-primary text-primary-foreground border-none text-[10px] font-black h-5 px-2 rounded-full shrink-0">
                    선택됨
                  </Badge>
                </div>
              ) : (
                // Search Input state
                <div className="space-y-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-3.5 w-4 h-4 text-muted-foreground/45" />
                    <Input
                      type="text"
                      placeholder="이름을 입력하여 검색 (예: 김, 이, 박)"
                      value={recipientSearch}
                      onChange={(e) => setRecipientSearch(e.target.value)}
                      className="pl-9 h-11 bg-muted/60 border-border/50 focus:border-primary/50 text-xs font-semibold rounded-2xl text-foreground"
                    />
                  </div>

                  {recipientSearch.trim() && (
                    <Card className="absolute left-0 right-0 z-50 bg-card border border-border/70 rounded-2xl shadow-xl max-h-48 overflow-y-auto divide-y divide-border/10 mt-1">
                      {employees.filter(emp => 
                        (emp.displayName || '').toLowerCase().includes(recipientSearch.toLowerCase()) ||
                        (emp.position || '').toLowerCase().includes(recipientSearch.toLowerCase()) ||
                        (emp.departmentName || '').toLowerCase().includes(recipientSearch.toLowerCase()) ||
                        (emp.workplace || '').toLowerCase().includes(recipientSearch.toLowerCase())
                      ).length === 0 ? (
                        <div className="text-center py-4 text-xs text-muted-foreground/50 font-bold">
                          '{recipientSearch}'에 해당하는 사원이 없습니다.
                        </div>
                      ) : (
                        employees.filter(emp => 
                          (emp.displayName || '').toLowerCase().includes(recipientSearch.toLowerCase()) ||
                          (emp.position || '').toLowerCase().includes(recipientSearch.toLowerCase()) ||
                          (emp.departmentName || '').toLowerCase().includes(recipientSearch.toLowerCase()) ||
                          (emp.workplace || '').toLowerCase().includes(recipientSearch.toLowerCase())
                        ).map((emp) => (
                          <button
                            key={emp.uid}
                            type="button"
                            onClick={() => {
                              setReceiverUid(emp.uid);
                              setRecipientSearch('');
                            }}
                            className="w-full text-left p-2.5 hover:bg-primary/5 flex items-center justify-between gap-2 transition-all cursor-pointer group"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors shrink-0">
                                <User className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-foreground flex items-center gap-1">
                                  <span className="truncate">{emp.displayName}</span>
                                  {emp.position && (
                                    <span className="text-[9px] text-muted-foreground/75 bg-muted px-1.5 py-0.2 rounded shrink-0">
                                      {emp.position}
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-muted-foreground/50 truncate block mt-0.5">
                                  {emp.departmentName || emp.workplace || '부서 미정'}
                                </span>
                              </div>
                            </div>
                            <span className="text-[10px] text-primary opacity-0 group-hover:opacity-100 font-bold transition-all mr-1 shrink-0">
                              선택
                            </span>
                          </button>
                        ))
                      )}
                    </Card>
                  )}
                </div>
              )}
            </div>

            {/* Category / Urgency row */}
            <div className="grid grid-cols-2 gap-3">
              {/* Category */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-muted-foreground/75 px-1">🏷️ 요청 구분</label>
                <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-2xl h-11">
                  <button
                    type="button"
                    onClick={() => setRequestCategory('WORK')}
                    className={cn(
                      "rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1 cursor-pointer",
                      requestCategory === 'WORK' ? "bg-card text-foreground shadow-sm border border-border/30" : "text-muted-foreground"
                    )}
                  >
                    🛠️ 업무
                  </button>
                  <button
                    type="button"
                    onClick={() => setRequestCategory('SAFETY')}
                    className={cn(
                      "rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1 cursor-pointer",
                      requestCategory === 'SAFETY' ? "bg-card text-foreground shadow-sm border border-border/30" : "text-muted-foreground"
                    )}
                  >
                    🛡️ 안전
                  </button>
                </div>
              </div>

              {/* Urgency */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-muted-foreground/75 px-1">🚨 중요도 구분</label>
                <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-2xl h-11">
                  <button
                    type="button"
                    onClick={() => setIsUrgent(false)}
                    className={cn(
                      "rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1 cursor-pointer",
                      !isUrgent ? "bg-card text-emerald-500 shadow-sm border border-border/30" : "text-muted-foreground"
                    )}
                  >
                    일반
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsUrgent(true)}
                    className={cn(
                      "rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1 cursor-pointer",
                      isUrgent ? "bg-card text-red-500 shadow-sm border border-border/30 font-black" : "text-muted-foreground"
                    )}
                  >
                    🚨 긴급
                  </button>
                </div>
              </div>
            </div>

            {/* Request Content */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-muted-foreground/75 px-1">📝 요청사항 내용</label>
              <Textarea
                placeholder="예) 문석주 조장님, 현장 휴게실에 생수가 모자랍니다. 조치 부탁드립니다."
                value={requestContent}
                onChange={(e) => setRequestContent(e.target.value)}
                className="w-full h-28 text-[12.5px] font-medium bg-muted/60 hover:bg-muted/80 focus:bg-background border border-border/50 focus:border-primary/50 rounded-2xl p-3 resize-none outline-none transition-all placeholder:text-muted-foreground/35 text-foreground"
              />
            </div>
          </div>

          <DialogFooter className="sm:justify-between gap-2.5">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsNewRequestOpen(false)}
              className="flex-1 h-11 rounded-2xl text-xs font-black cursor-pointer"
            >
              취소
            </Button>
            <Button
              type="button"
              disabled={isSubmitting}
              onClick={handleCreateRequest}
              className="flex-1 h-11 rounded-2xl text-xs font-black bg-primary text-primary-foreground hover:bg-primary/95 shadow-md cursor-pointer"
            >
              {isSubmitting ? '전송 중...' : '요청 전송하기'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2. Reject Reason Dialog */}
      <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
        <DialogContent className="bg-card border border-border text-foreground max-w-sm rounded-[2.5rem] p-6 shadow-2xl">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-lg font-black text-center text-red-500">
              ❌ 요청 반려 사유 입력
            </DialogTitle>
            <DialogDescription className="text-center text-muted-foreground/60 text-xs font-bold">
              요청을 반려 처리하는 사유를 작성해 주세요.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2.5">
            <Textarea
              placeholder="예) 재고 부족으로 인해 내일 오전에 배송 예정입니다."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full h-24 text-[12px] font-medium bg-muted/60 hover:bg-muted/80 focus:bg-background border border-border/50 focus:border-primary/50 rounded-2xl p-3 resize-none outline-none transition-all text-foreground"
            />
          </div>

          <DialogFooter className="sm:justify-between gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsRejectOpen(false);
                setSelectedRequestToReject(null);
                setRejectReason('');
              }}
              className="flex-1 h-10 rounded-2xl text-xs font-black cursor-pointer"
            >
              취소
            </Button>
            <Button
              type="button"
              onClick={handleRejectRequestSubmit}
              className="flex-1 h-10 rounded-2xl text-xs font-black bg-red-500 text-white hover:bg-red-600 shadow-md cursor-pointer"
            >
              반려 처리완료
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
