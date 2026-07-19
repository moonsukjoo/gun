import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '@/firebase';
import { collection, onSnapshot, addDoc, query, orderBy, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { AccidentCase } from '@/types';
import { useAuth } from '@/components/AuthProvider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { grantRandomShipPart } from '@/services/shipService';
import { 
  ShieldAlert, 
  Plus, 
  MapPin, 
  Search,
  ChevronRight,
  Trash2,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

import { GlowLoading } from '@/components/GlowLoading';

export const AccidentReport: React.FC = () => {
  const { profile } = useAuth();
  const [cases, setCases] = useState<AccidentCase[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [caseToDelete, setCaseToDelete] = useState<string | null>(null);
  const [selectedCase, setSelectedCase] = useState<AccidentCase | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [newCase, setNewCase] = useState({
    title: '',
    date: new Date().toISOString().split('T')[0],
    location: '',
    description: '',
    severity: 'LOW' as AccidentCase['severity'],
    type: 'SAFE' as AccidentCase['type'],
    measures: '',
    imageUrl: '',
    shouldNotify: true,
  });

  useEffect(() => {
    const minLoadTime = new Promise(resolve => setTimeout(resolve, 800));
    const q = query(collection(db, 'accidentCases'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      setCases(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AccidentCase)));
      await minLoadTime;
      setPageLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'accidentCases');
      setPageLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAddCase = async () => {
    if (!newCase.title || !newCase.date || !newCase.location) {
      toast.error('필수 항목을 모두 입력해주세요.');
      return;
    }
    setLoading(true);
    try {
      await addDoc(collection(db, 'accidentCases'), {
        ...newCase,
        reportedBy: profile?.displayName || 'Unknown',
        reportedByUid: profile?.uid || 'Unknown',
        createdAt: new Date().toISOString()
      });

      if (newCase.severity === 'HIGH' || newCase.severity === 'CRITICAL' || newCase.shouldNotify) {
        const usersSnap = await getDocs(collection(db, 'users'));
        const notificationPromises = usersSnap.docs.map(uDoc => 
          addDoc(collection(db, 'notifications'), {
            uid: uDoc.id,
            title: `🚨 [사고즉보] ${newCase.title}`,
            message: `[${newCase.location}] ${newCase.description.substring(0, 50)}...`,
            type: 'EMERGENCY',
            isRead: false,
            createdAt: new Date().toISOString(),
          })
        );
        await Promise.all(notificationPromises);
      }

      setIsAddOpen(false);
      setNewCase({
        title: '',
        date: new Date().toISOString().split('T')[0],
        location: '',
        description: '',
        severity: 'LOW',
        type: 'SAFE',
        measures: '',
        imageUrl: '',
        shouldNotify: true,
      });
      toast.success('보고 완료');
      if (profile?.uid) grantRandomShipPart(profile.uid, '사고 즉보');
    } catch (error) { 
      console.error(error);
      toast.error('등록 실패'); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleDeleteCase = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'accidentCases', id));
      toast.success('사고 사례가 삭제되었습니다.');
      setIsDeleteOpen(false);
      setCaseToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `accidentCases/${id}`);
    }
  };

  const canRegisterAccident = (() => {
    if (!profile) return false;
    
    // 조장 or 사원 are strictly forbidden from writing (even if they have some other role, they can only view)
    const position = profile.position?.trim() || '';
    if (['조장', '사원'].some(p => position.includes(p))) {
      return false;
    }
    
    // Explicitly check for allowed positions in user request:
    // 팀장, 직장, 서무, 실장, 안전관리자, 총무, 소장, 대표 + 사장, CEO
    const allowedPositions = ['팀장', '직장', '서무', '실장', '안전관리자', '총무', '소장', '대표', '사장'];
    if (allowedPositions.some(p => position.includes(p))) {
      return true;
    }
    
    // Check standard managing roles
    if (['CEO', 'DIRECTOR', 'GENERAL_MANAGER', 'SAFETY_MANAGER', 'TEAM_LEADER', 'GENERAL_AFFAIRS', 'CLERK'].includes(profile.role)) {
      return true;
    }
    
    if (profile.permissions?.includes('admin') || profile.permissions?.includes('accident_mgmt')) {
      return true;
    }
    
    if (profile.email === 'tjrwnfjqm1@gmail.com') {
      return true;
    }
    
    return false;
  })();

  const isSafetyManager = canRegisterAccident;

  const filteredCases = cases.filter(c => 
    c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (pageLoading) return <GlowLoading message="SECURITY" subMessage="Accessing Accident Logs..." />;

  return (
    <div className="space-y-6 pb-24 px-2 overflow-x-hidden">
      <header className="py-6 flex justify-between items-end">
        <div>
           <h2 className="text-3xl font-black tracking-tight text-foreground leading-tight">사고 즉보</h2>
           <p className="text-muted-foreground font-bold">현장의 위험 요소를 즉시 보고하세요</p>
        </div>
        <div className="flex gap-2">
          {isSafetyManager && (
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger 
                className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-red-500 hover:bg-red-600 px-4 h-12 text-white font-black shadow-lg shadow-red-500/20 gap-2 active:scale-95 transition-all"
              >
                 <Plus className="w-4 h-4" /> 제보
              </DialogTrigger>
              <DialogContent className="bg-card border border-border rounded-3xl text-foreground max-w-xl p-8 space-y-6 overflow-y-auto max-h-[90vh]">
                 <DialogHeader>
                    <DialogTitle className="text-xl font-black tracking-tight text-foreground">사고 제보하기</DialogTitle>
                 </DialogHeader>
                 <div className="space-y-4">
                    <div className="space-y-2">
                       <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest ml-1">사고명</p>
                       <Input value={newCase.title} onChange={e => setNewCase({...newCase, title: e.target.value})} className="bg-muted border-none h-12 rounded-xl text-foreground" placeholder="예: 낙하 위험 감지" />
                    </div>
                    <div className="space-y-2">
                       <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest ml-1">발생 장소</p>
                       <div className="relative">
                          <Input value={newCase.location} onChange={e => setNewCase({...newCase, location: e.target.value})} className="bg-muted border-none h-12 rounded-xl pl-10 text-foreground" placeholder="위치 정보" />
                          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/30" />
                       </div>
                    </div>
                    <div className="space-y-2">
                       <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest ml-1">심각도</p>
                       <div className="grid grid-cols-3 gap-2">
                          {['LOW', 'MEDIUM', 'HIGH'].map(s => (
                            <button key={s} onClick={() => setNewCase({...newCase, severity: s as any})} className={cn(
                              "h-10 rounded-xl text-[10px] font-black transition-all",
                              newCase.severity === s ? "bg-red-500 text-white shadow-lg shadow-red-500/20" : "bg-muted text-muted-foreground border border-border"
                            )}>
                               {s === 'LOW' ? '아차' : s === 'MEDIUM' ? '경미' : '중대'}
                            </button>
                          ))}
                       </div>
                    </div>
                    <div className="space-y-2">
                       <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest ml-1">상세 내용</p>
                       <Textarea value={newCase.description} onChange={e => setNewCase({...newCase, description: e.target.value})} className="bg-muted border-none rounded-xl min-h-[100px] text-foreground" placeholder="상세 설명을 적어주세요" />
                    </div>
                 </div>
                 <Button className="w-full h-14 bg-rose-500 hover:bg-rose-600 text-white font-black rounded-2xl" onClick={handleAddCase} disabled={loading}>
                    {loading ? '등록 중...' : '보고서 제출'}
                 </Button>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </header>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
        <Input placeholder="사고 사례 검색..." className="bg-card border border-border h-14 pl-12 rounded-2xl font-bold text-foreground placeholder:text-muted-foreground/30" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      </div>

      <div className="grid grid-cols-3 gap-3">
         {['HIGH', 'MEDIUM', 'LOW'].map(s => (
           <div key={s} className="bg-card p-4 rounded-2xl border border-border flex flex-col items-center gap-1">
              <span className={cn("w-1.5 h-1.5 rounded-full mb-1", s === 'HIGH' ? "bg-red-500" : s === 'MEDIUM' ? "bg-orange-500" : "bg-emerald-500")} />
              <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">
                {s === 'HIGH' ? '중대' : s === 'MEDIUM' ? '경미' : '아차'}
              </span>
              <span className="text-lg font-black text-foreground">{cases.filter(c => c.severity === s).length}</span>
           </div>
         ))}
      </div>

      <div className="space-y-3">
         {filteredCases.map(c => (
           <div 
             key={c.id} 
             className="bg-card p-6 rounded-3xl border border-border space-y-4 active:scale-[0.98] transition-transform cursor-pointer"
             onClick={() => setSelectedCase(c)}
           >
              <div className="flex justify-between items-start">
                 <div className="space-y-1">
                    <Badge className={cn(
                      "bg-opacity-20 border-none rounded-lg px-2 text-[10px] font-black",
                      c.severity === 'HIGH' ? "bg-red-500 text-red-500" : c.severity === 'MEDIUM' ? "bg-orange-500 text-orange-500" : "bg-emerald-500 text-emerald-500"
                    )}>
                      {c.severity === 'HIGH' ? '중대사고' : c.severity === 'MEDIUM' ? '경미사고' : '아차사고'}
                    </Badge>
                    <h4 className="text-lg font-black text-foreground leading-tight">{c.title}</h4>
                 </div>
                 <div className="flex flex-col items-end gap-2">
                   <span className="text-[10px] font-bold text-muted-foreground">{format(new Date(c.date), 'yyyy.MM.dd')}</span>
                   {isSafetyManager && (
                     <Button 
                       variant="ghost" 
                       size="icon" 
                       className="w-8 h-8 rounded-lg text-muted-foreground/30 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                       onClick={(e) => {
                         e.stopPropagation();
                         setCaseToDelete(c.id);
                         setIsDeleteOpen(true);
                       }}
                     >
                       <Trash2 className="w-4 h-4" />
                     </Button>
                   )}
                 </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground bg-muted p-3 rounded-xl">
                 <MapPin className="w-3.5 h-3.5 opacity-50" />
                 {c.location}
              </div>
              <p className="text-sm font-bold text-muted-foreground/80 line-clamp-2 px-1">{c.description}</p>
              {c.measures && (
                <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10">
                   <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-1">조치 내역</p>
                   <p className="text-xs font-bold text-primary/80 leading-relaxed">{c.measures}</p>
                </div>
              )}
           </div>
         ))}
      </div>
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="bg-card border-none rounded-[2rem] shadow-2xl max-w-sm w-[90%] p-8 overflow-hidden text-foreground">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center">
              <Trash2 className="w-8 h-8 text-red-500" />
            </div>
            <div className="space-y-1">
              <DialogTitle className="text-xl font-black text-foreground">사고 사례 삭제</DialogTitle>
              <DialogDescription className="text-muted-foreground font-bold text-xs text-center">
                이 사고 사례 보고를 정말 삭제하시겠습니까?<br />이 작업은 되돌릴 수 없습니다.
              </DialogDescription>
            </div>
          </div>
          <div className="flex flex-col gap-3 pt-6">
            <Button 
              className="w-full h-14 bg-rose-500 hover:bg-rose-600 text-white font-black rounded-xl"
              onClick={() => caseToDelete && handleDeleteCase(caseToDelete)}
            >
              삭제하기
            </Button>
            <Button 
              variant="ghost"
              className="w-full h-10 text-muted-foreground font-black hover:text-foreground"
              onClick={() => setIsDeleteOpen(false)}
            >
              취소
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={!!selectedCase} onOpenChange={(open) => !open && setSelectedCase(null)}>
        <DialogContent className="bg-card border-none rounded-3xl text-foreground max-w-xl overflow-y-auto max-h-[90vh] p-0 focus:outline-none">
          {selectedCase && (
            <div className="flex flex-col">
              {/* Header Image or Placeholder */}
              <div className="h-32 bg-red-500/10 flex items-center justify-center relative">
                <div className={cn(
                  "absolute inset-0 opacity-20",
                  selectedCase.severity === 'HIGH' ? "bg-red-500" : selectedCase.severity === 'MEDIUM' ? "bg-orange-500" : "bg-emerald-500"
                )} />
                <ShieldAlert className={cn(
                  "w-12 h-12 relative z-10",
                  selectedCase.severity === 'HIGH' ? "text-red-500" : selectedCase.severity === 'MEDIUM' ? "text-orange-500" : "text-emerald-500"
                )} />
                <button 
                  onClick={() => setSelectedCase(null)}
                  className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white/60 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge className={cn(
                      "bg-opacity-20 border-none rounded-lg px-2 text-[10px] font-black",
                      selectedCase.severity === 'HIGH' ? "bg-red-500 text-red-500" : selectedCase.severity === 'MEDIUM' ? "bg-orange-500 text-orange-500" : "bg-emerald-500 text-emerald-500"
                    )}>
                      {selectedCase.severity === 'HIGH' ? '중대사고' : selectedCase.severity === 'MEDIUM' ? '경미사고' : '아차사고'}
                    </Badge>
                    <span className="text-[10px] font-bold text-muted-foreground">{format(new Date(selectedCase.date), 'yyyy.MM.dd')}</span>
                  </div>
                  <h3 className="text-xl font-black text-foreground leading-tight">{selectedCase.title}</h3>
                  <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                    <MapPin className="w-3 h-3" />
                    {selectedCase.location}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">상세 내용</p>
                    <div className="bg-muted p-4 rounded-2xl border border-border">
                      <p className="text-sm font-bold text-foreground leading-relaxed whitespace-pre-wrap">{selectedCase.description}</p>
                    </div>
                  </div>

                  {selectedCase.measures && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest pl-1">후속 조치 및 대책</p>
                      <div className="bg-emerald-500/5 p-4 rounded-2xl border border-emerald-500/10">
                        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400/90 leading-relaxed whitespace-pre-wrap">{selectedCase.measures}</p>
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t border-border flex items-center justify-between text-[10px] font-bold text-muted-foreground">
                    <span>제보자: {selectedCase.reportedBy}</span>
                    <span>등록일: {format(new Date(selectedCase.createdAt), 'yyyy.MM.dd HH:mm')}</span>
                  </div>
                </div>

                <Button 
                  className="w-full h-14 bg-muted hover:bg-muted/80 text-foreground font-black rounded-2xl transition-all"
                  onClick={() => setSelectedCase(null)}
                >
                  확인 완료
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
