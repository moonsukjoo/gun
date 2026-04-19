import React, { useState, useEffect } from 'react';
import { db } from '@/src/firebase';
import { collection, onSnapshot, addDoc, query, orderBy, Timestamp } from 'firebase/firestore';
import { AccidentCase } from '@/src/types';
import { useAuth } from '@/src/components/AuthProvider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  ShieldAlert, 
  Plus, 
  Calendar, 
  MapPin, 
  AlertTriangle,
  FileText,
  Search,
  ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

export const AccidentReport: React.FC = () => {
  const { profile } = useAuth();
  const [cases, setCases] = useState<AccidentCase[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [newCase, setNewCase] = useState({
    title: '',
    date: new Date().toISOString().split('T')[0],
    location: '',
    description: '',
    severity: 'LOW' as AccidentCase['severity'],
    type: 'SAFE' as AccidentCase['type'],
    measures: '',
    imageUrl: '',
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

    try {
      await addDoc(collection(db, 'accidentCases'), {
        ...newCase,
        reportedBy: profile?.displayName || 'Unknown',
        reportedByUid: profile?.uid || 'Unknown',
        createdAt: new Date().toISOString()
      });
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
      });
      toast.success('사고보고서가 등록되었습니다.');
    } catch (error) {
      toast.error('등록 중 오류가 발생했습니다.');
    }
  };

  const filteredCases = cases.filter(c => 
    c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getSeverityBadge = (severity: AccidentCase['severity']) => {
    switch (severity) {
      case 'HIGH': return <Badge className="bg-red-500 text-white font-black">중대</Badge>;
      case 'MEDIUM': return <Badge className="bg-orange-500 text-white font-black">경미</Badge>;
      case 'LOW': return <Badge className="bg-emerald-500 text-white font-black">아차사고</Badge>;
    }
  };

  const getTypeLabel = (type: AccidentCase['type']) => {
    switch (type) {
      case 'ACCIDENT': return '건설재해';
      case 'INCIDENT': return 'Near Miss';
      case 'SAFE': return '기술안전';
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-6 bg-red-500 rounded-full" />
            <h2 className="text-3xl font-black tracking-tighter text-slate-900">사고 즉보</h2>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger 
              render={
                <Button className="h-10 rounded-xl bg-red-500 hover:bg-red-600 shadow-lg shadow-red-200 gap-2 font-black">
                  <Plus className="w-4 h-4" /> 제보하기
                </Button>
              } 
            />
            <DialogContent className="bg-white rounded-[2.5rem] border-none shadow-2xl max-w-lg w-[95%] p-0 overflow-hidden">
              <DialogHeader className="p-8 pb-4 bg-slate-50 border-b border-slate-100">
                <DialogTitle className="text-2xl font-black tracking-tighter flex items-center gap-2">
                  <ShieldAlert className="w-6 h-6 text-red-500" /> 사고/위험 보고
                </DialogTitle>
                <DialogDescription className="text-slate-500 font-bold">발견하신 현장의 위험요소나 사고 내용을 작성해주세요.</DialogDescription>
              </DialogHeader>
              <div className="p-8 space-y-5 max-h-[60vh] overflow-y-auto">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">사고명 *</label>
                  <Input 
                    value={newCase.title}
                    onChange={(e) => setNewCase({...newCase, title: e.target.value})}
                    placeholder="사고 명칭을 입력하세요"
                    className="h-12 bg-slate-50 border-slate-200 rounded-xl font-bold"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">사고 일시 *</label>
                  <Input 
                    type="date"
                    value={newCase.date}
                    onChange={(e) => setNewCase({...newCase, date: e.target.value})}
                    className="h-12 bg-slate-50 border-slate-200 rounded-xl font-bold"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">발생 장소 *</label>
                  <div className="relative">
                    <Input 
                      value={newCase.location}
                      onChange={(e) => setNewCase({...newCase, location: e.target.value})}
                      placeholder="공종/위치"
                      className="h-12 pl-10 bg-slate-50 border-slate-200 rounded-xl font-bold"
                    />
                    <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">위험도 (심각성)</label>
                  <div className="flex gap-2">
                    {['LOW', 'MEDIUM', 'HIGH'].map((s) => (
                      <Button
                        key={s}
                        variant="outline"
                        type="button"
                        onClick={() => setNewCase({...newCase, severity: s as any})}
                        className={cn(
                          "flex-1 h-10 rounded-xl font-black text-xs transition-all",
                          newCase.severity === s 
                            ? (s === 'HIGH' ? "bg-red-500 text-white border-red-500" : s === 'MEDIUM' ? "bg-orange-500 text-white border-orange-500" : "bg-emerald-500 text-white border-emerald-500")
                            : "bg-white text-slate-400 border-slate-200 hover:bg-slate-50"
                        )}
                      >
                        {s === 'HIGH' ? '중대' : s === 'MEDIUM' ? '경미' : '아차'}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">사고 내용</label>
                  <Textarea 
                    value={newCase.description}
                    onChange={(e) => setNewCase({...newCase, description: e.target.value})}
                    placeholder="자세한 상황 설명..."
                    className="min-h-[100px] bg-slate-50 border-slate-200 rounded-xl font-bold resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">조치 내역</label>
                  <Textarea 
                    value={newCase.measures}
                    onChange={(e) => setNewCase({...newCase, measures: e.target.value})}
                    placeholder="즉시 조치 또는 향후 계획..."
                    className="min-h-[80px] bg-slate-50 border-slate-200 rounded-xl font-bold resize-none"
                  />
                </div>
              </div>
              <DialogFooter className="p-8 pt-4 bg-slate-50 border-t border-slate-100 flex flex-row gap-3">
                <Button variant="outline" className="flex-1 h-12 rounded-xl font-black border-slate-200" onClick={() => setIsAddOpen(false)}>취소</Button>
                <Button className="flex-1 h-12 rounded-xl bg-red-500 hover:bg-red-600 font-black shadow-lg shadow-red-100" onClick={handleAddCase}>보고서 제출</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <p className="text-[11px] text-slate-500 font-bold uppercase tracking-[0.2em] ml-4">실시간 사고 사례 및 보고 시스템</p>
      </header>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-3">
        {['HIGH', 'MEDIUM', 'LOW'].map((s) => {
          const count = cases.filter(c => c.severity === s).length;
          return (
            <Card key={s} className="border-none shadow-sm bg-white rounded-2xl overflow-hidden">
              <CardContent className="p-4 flex flex-col items-center gap-1">
                <div className={cn(
                  "w-2 h-2 rounded-full mb-1",
                  s === 'HIGH' ? "bg-red-500" : s === 'MEDIUM' ? "bg-orange-500" : "bg-emerald-500"
                )} />
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  {s === 'HIGH' ? '중대사고' : s === 'MEDIUM' ? '경미사고' : '아차사고'}
                </span>
                <span className="text-xl font-black tracking-tighter">{count}</span>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Input 
          placeholder="사고 내용 또는 위치 검색" 
          className="h-12 pl-11 bg-white border-slate-200 rounded-2xl text-sm font-bold shadow-sm focus:ring-red-500/10 text-slate-900 placeholder:text-slate-500"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
      </div>

      {/* Cases List */}
      <div className="space-y-4">
        {filteredCases.map((c) => (
          <Card key={c.id} className="border-none shadow-sm bg-white rounded-[2rem] overflow-hidden card-hover">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 mb-1">
                    {getSeverityBadge(c.severity)}
                    <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">{getTypeLabel(c.type)}</span>
                  </div>
                  <h4 className="text-lg font-black tracking-tight text-slate-900 leading-tight">
                    {c.title}
                  </h4>
                </div>
                <div className="text-[10px] font-bold text-slate-400 text-right">
                  {format(new Date(c.date), 'yyyy.MM.dd', { locale: ko })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500 bg-slate-50 px-3 py-2 rounded-xl">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {c.location}
                </div>
                <p className="text-sm font-medium text-slate-600 line-clamp-2 px-1">
                  {c.description}
                </p>
              </div>

              {c.measures && (
                <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100/50">
                  <div className="flex items-center gap-1.5 text-[9px] font-black text-blue-500 uppercase tracking-widest mb-1.5">
                    <ShieldAlert className="w-3 h-3" /> 조치 사항
                  </div>
                  <p className="text-xs font-bold text-blue-700 leading-relaxed">
                    {c.measures}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-slate-100 rounded-lg flex items-center justify-center text-[10px] font-black text-slate-400 uppercase">
                    {c.reportedBy?.charAt(0) || 'U'}
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reports: {c.reportedBy}</span>
                </div>
                <Button variant="ghost" size="sm" className="h-8 rounded-lg text-primary font-black gap-1 text-[10px] uppercase tracking-widest">
                  상세보기 <ChevronDown className="w-3 h-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

    </div>
  );
};
