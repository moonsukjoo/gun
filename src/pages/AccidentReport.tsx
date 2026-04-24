import React, { useState, useEffect } from 'react';
import { db } from '@/src/firebase';
import { collection, onSnapshot, addDoc, query, orderBy, getDocs } from 'firebase/firestore';
import { AccidentCase } from '@/src/types';
import { useAuth } from '@/src/components/AuthProvider';
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
import { grantRandomShipPart } from '@/src/services/shipService';
import { 
  ShieldAlert, 
  Plus, 
  MapPin, 
  Search,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

export const AccidentReport: React.FC = () => {
  const { profile } = useAuth();
  const [cases, setCases] = useState<AccidentCase[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
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
    const q = query(collection(db, 'accidentCases'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCases(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AccidentCase)));
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
    } catch (error) { toast.error('실패'); } finally { setLoading(false); }
  };

  const filteredCases = cases.filter(c => 
    c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-24 px-1">
      <header className="py-6 flex justify-between items-end">
        <div>
           <h2 className="text-3xl font-black tracking-tight text-white leading-tight">사고 즉보</h2>
           <p className="text-muted-foreground font-bold">현장의 위험 요소를 즉시 보고하세요</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger 
            className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-red-500 hover:bg-red-600 px-4 h-12 text-white font-black shadow-lg shadow-red-500/20 gap-2 active:scale-95 transition-all"
          >
             <Plus className="w-4 h-4" /> 제보
          </DialogTrigger>
          <DialogContent className="bg-card border-none rounded-3xl text-white max-w-sm p-8 space-y-6 overflow-y-auto max-h-[90vh]">
             <DialogHeader>
                <DialogTitle className="text-xl font-black tracking-tight">사고 제보하기</DialogTitle>
             </DialogHeader>
             <div className="space-y-4">
                <div className="space-y-2">
                   <p className="text-[10px] uppercase font-black text-white/40 tracking-widest ml-1">사고명</p>
                   <Input value={newCase.title} onChange={e => setNewCase({...newCase, title: e.target.value})} className="bg-white/5 border-none h-12 rounded-xl" placeholder="예: 낙하 위험 감지" />
                </div>
                <div className="space-y-2">
                   <p className="text-[10px] uppercase font-black text-white/40 tracking-widest ml-1">발생 장소</p>
                   <div className="relative">
                      <Input value={newCase.location} onChange={e => setNewCase({...newCase, location: e.target.value})} className="bg-white/5 border-none h-12 rounded-xl pl-10" placeholder="위치 정보" />
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                   </div>
                </div>
                <div className="space-y-2">
                   <p className="text-[10px] uppercase font-black text-white/40 tracking-widest ml-1">심각도</p>
                   <div className="grid grid-cols-3 gap-2">
                      {['LOW', 'MEDIUM', 'HIGH'].map(s => (
                        <button key={s} onClick={() => setNewCase({...newCase, severity: s as any})} className={cn(
                          "h-10 rounded-xl text-[10px] font-black transition-all",
                          newCase.severity === s ? "bg-red-500 text-white" : "bg-white/5 text-muted-foreground"
                        )}>
                           {s === 'LOW' ? '아차' : s === 'MEDIUM' ? '경미' : '중대'}
                        </button>
                      ))}
                   </div>
                </div>
                <div className="space-y-2">
                   <p className="text-[10px] uppercase font-black text-white/40 tracking-widest ml-1">상세 내용</p>
                   <Textarea value={newCase.description} onChange={e => setNewCase({...newCase, description: e.target.value})} className="bg-white/5 border-none rounded-xl min-h-[100px]" placeholder="상세 설명을 적어주세요" />
                </div>
             </div>
             <Button className="w-full h-14 bg-red-500 hover:bg-red-600 text-white font-black rounded-2xl" onClick={handleAddCase} disabled={loading}>
                {loading ? '등록 중...' : '보고서 제출'}
             </Button>
          </DialogContent>
        </Dialog>
      </header>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
        <Input placeholder="사고 사례 검색..." className="bg-card border border-white/5 h-14 pl-12 rounded-2xl font-bold" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      </div>

      <div className="grid grid-cols-3 gap-3">
         {['HIGH', 'MEDIUM', 'LOW'].map(s => (
           <div key={s} className="bg-card p-4 rounded-2xl border border-white/5 flex flex-col items-center gap-1">
              <span className={cn("w-1.5 h-1.5 rounded-full mb-1", s === 'HIGH' ? "bg-red-500" : s === 'MEDIUM' ? "bg-orange-500" : "bg-emerald-500")} />
              <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">
                {s === 'HIGH' ? '중대' : s === 'MEDIUM' ? '경미' : '아차'}
              </span>
              <span className="text-lg font-black text-white">{cases.filter(c => c.severity === s).length}</span>
           </div>
         ))}
      </div>

      <div className="space-y-3">
         {filteredCases.map(c => (
           <div key={c.id} className="bg-card p-6 rounded-3xl border border-white/5 space-y-4">
              <div className="flex justify-between items-start">
                 <div className="space-y-1">
                    <Badge className={cn(
                      "bg-opacity-20 border-none rounded-lg px-2 text-[10px] font-black",
                      c.severity === 'HIGH' ? "bg-red-500 text-red-500" : c.severity === 'MEDIUM' ? "bg-orange-500 text-orange-500" : "bg-emerald-500 text-emerald-500"
                    )}>
                      {c.severity === 'HIGH' ? '중대사고' : c.severity === 'MEDIUM' ? '경미사고' : '아차사고'}
                    </Badge>
                    <h4 className="text-lg font-black text-white leading-tight">{c.title}</h4>
                 </div>
                 <span className="text-[10px] font-bold text-muted-foreground">{format(new Date(c.date), 'yyyy.MM.dd')}</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground bg-white/5 p-3 rounded-xl">
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
    </div>
  );
};
