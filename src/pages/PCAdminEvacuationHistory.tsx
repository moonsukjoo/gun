import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import PCAdminLayout from '../components/PCAdminLayout';
import { 
  History, 
  Users, 
  MapPin, 
  Clock, 
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Search,
  ChevronRight,
  FileSpreadsheet,
  Calendar
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { exportToExcel } from '../lib/exportUtils';
import { Button } from '@/components/ui/button';

const PCAdminEvacuationHistory: React.FC = () => {
  const [evacuations, setEvacuations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvacuation, setSelectedEvacuation] = useState<any | null>(null);
  const [checkins, setCheckins] = useState<any[]>([]);
  const [checkinsLoading, setCheckinsLoading] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'evacuations'), orderBy('activatedAt', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snap) => {
      setEvacuations(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (err) => {
      console.error(err);
      toast.error('대피 이력을 불러오는데 실패했습니다.');
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (selectedEvacuation) {
      setCheckinsLoading(true);
      const q = query(collection(db, 'evacuations', selectedEvacuation.id, 'checkins'), orderBy('confirmedAt', 'asc'));
      const unsubscribe = onSnapshot(q, (snap) => {
        setCheckins(snap.docs.map(doc => doc.data()));
        setCheckinsLoading(false);
      });
      return () => unsubscribe();
    } else {
      setCheckins([]);
    }
  }, [selectedEvacuation]);

  const handleExport = (ev: any, checkinsList: any[]) => {
    if (checkinsList.length === 0) {
      toast.error('확인된 인원이 없습니다.');
      return;
    }

    const data = checkinsList.map(c => ({
      '성명': c.displayName,
      '소속': c.departmentName,
      '확인시간': format(new Date(c.confirmedAt), 'yyyy-MM-dd HH:mm:ss')
    }));

    exportToExcel(data, `비상대피_롤콜_${ev.id}`, '안전확인명단');
    toast.success('엑셀 파일이 생성되었습니다.');
  };

  return (
    <PCAdminLayout title="비상 대피 및 롤콜 이력">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-[1600px] mx-auto p-4 lg:p-8 text-foreground pb-20">
        
        {/* Left: Evacuation Events List */}
        <div className="lg:col-span-5 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-foreground flex items-center gap-2">
              <History className="w-5 h-5 text-blue-500" />
              대피령 발동 이력
            </h3>
            <span className="px-2.5 py-1 text-xs font-bold border border-border bg-muted text-foreground rounded-full">{evacuations.length}건 선조회</span>
          </div>

          <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-250px)] pr-2 scrollbar-hide">
            {loading ? (
              <div className="p-12 text-center bg-card rounded-2xl border border-border">
                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-muted-foreground font-bold">이력 검색 중...</p>
              </div>
            ) : evacuations.length > 0 ? (
              evacuations.map(ev => (
                <div 
                  key={ev.id}
                  onClick={() => setSelectedEvacuation(ev)}
                  className={`p-6 rounded-3xl cursor-pointer transition-all border-2 ${
                    selectedEvacuation?.id === ev.id 
                      ? 'border-blue-500 bg-blue-500/10' 
                      : 'border-border bg-card hover:border-blue-500/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="space-y-1 overflow-hidden">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${ev.status === 'ACTIVE' ? 'bg-red-500/25 text-red-400 border-red-500/30' : 'bg-muted text-muted-foreground border-transparent'}`}>
                          {ev.status === 'ACTIVE' ? '진행중' : '종료됨'}
                        </span>
                        <span className="text-[10px] font-bold text-muted-foreground/80">ID: {ev.id}</span>
                      </div>
                      <h4 className="font-black text-foreground truncate tracking-tight">{ev.reason}</h4>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-black text-blue-400">{ev.confirmedCount || 0} / {ev.totalClockedIn || ev.totalWorkers || 0}</div>
                      <div className="text-[10px] font-bold text-muted-foreground capitalize whitespace-nowrap">Confirmed / Target</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/80">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs font-bold text-muted-foreground/85">
                        {format(new Date(ev.activatedAt), 'MM/dd HH:mm')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                      <Users className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs font-bold text-muted-foreground/85">{ev.activatedByName}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-12 bg-card rounded-3xl text-center border-2 border-dashed border-border">
                <AlertTriangle className="w-10 h-10 text-muted-foreground/45 mx-auto mb-4" />
                <p className="text-muted-foreground font-bold">이력이 존재하지 않습니다.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Roll Call Detail */}
        <div className="lg:col-span-7 space-y-6">
          {selectedEvacuation ? (
            <div className="space-y-6 bg-card rounded-[2.5rem] p-8 border border-border shadow-sm min-h-[calc(100vh-250px)] flex flex-col">
              <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-border/80 pb-6 gap-4">
                <div>
                  <h2 className="text-2xl font-black text-foreground tracking-tight mb-1">상세 안전 확인 리스트</h2>
                  <p className="text-muted-foreground font-bold text-sm">
                    {format(new Date(selectedEvacuation.activatedAt), 'yyyy년 MM월 dd일 HH:mm:ss', { locale: ko })} 발동 건
                  </p>
                </div>
                <Button 
                  onClick={() => handleExport(selectedEvacuation, checkins)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl h-12 px-6 flex items-center gap-2 shrink-0 cursor-pointer"
                >
                  <FileSpreadsheet className="w-5 h-5" />
                  Excel 다운로드
                </Button>
              </div>

              {/* Progress Summary Card */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-muted p-5 rounded-3xl text-center border border-border">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">전체 임직원</p>
                  <p className="text-2xl font-black text-foreground">{selectedEvacuation.totalWorkers || 0}명</p>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 p-5 rounded-3xl text-center font-bold">
                  <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">출근 인원 (발동시)</p>
                  <p className="text-2xl font-black text-blue-450">{selectedEvacuation.totalClockedIn || selectedEvacuation.totalWorkers || 0}명</p>
                </div>
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-5 rounded-3xl text-center">
                  <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">안전 확인</p>
                  <p className="text-2xl font-black text-emerald-450">{checkins.length}명</p>
                </div>
                <div className="bg-rose-500/10 border border-rose-500/20 p-5 rounded-3xl text-center">
                  <p className="text-[10px] font-black text-rose-450 uppercase tracking-widest mb-1">미확인</p>
                  <p className="text-2xl font-black text-rose-400">
                    {Math.max(0, (selectedEvacuation.totalClockedIn || selectedEvacuation.totalWorkers || 0) - checkins.length)}명
                  </p>
                </div>
              </div>

              {/* Checkin List */}
              <div className="flex-1 overflow-hidden flex flex-col pt-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-black text-foreground flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    안전 확인 인원 ({checkins.length})
                  </h4>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-hide">
                  {checkinsLoading ? (
                    <div className="py-20 text-center">
                      <div className="w-8 h-8 border-4 border-border border-t-emerald-500 rounded-full animate-spin mx-auto" />
                    </div>
                  ) : checkins.length > 0 ? (
                    checkins.map((c, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-muted border border-border rounded-2xl">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-card rounded-xl flex items-center justify-center font-black text-muted-foreground border border-border">
                            {c.displayName ? c.displayName.charAt(0) : ''}
                          </div>
                          <div>
                            <p className="font-black text-foreground">{c.displayName}</p>
                            <p className="text-xs font-bold text-muted-foreground">{c.departmentName}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-black text-foreground">{format(new Date(c.confirmedAt), 'HH:mm:ss')}</p>
                          <p className="text-[10px] font-bold text-emerald-400">CONFIRMED SAFE</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-20 text-center bg-muted rounded-[2rem] border-2 border-dashed border-border/80">
                      <XCircle className="w-8 h-8 text-muted-foreground/35 mx-auto mb-2" />
                      <p className="text-muted-foreground font-bold">확인된 리스트가 없습니다.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[calc(100vh-250px)] bg-muted/40 rounded-[2.5rem] border-2 border-dashed border-border flex flex-col items-center justify-center p-12 text-center">
              <div className="w-20 h-20 bg-card border border-border rounded-3xl flex items-center justify-center text-muted-foreground/40 shadow-sm mb-6">
                <Search className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-black text-muted-foreground tracking-tight">대피 이력을 선택해 주세요</h3>
              <p className="text-muted-foreground/60 font-bold mt-2 max-w-xs">
                왼쪽 리스트에서 이력을 선택하면 상세 안전 확인 명단과 롤콜 통계를 확인할 수 있습니다.
              </p>
            </div>
          )}
        </div>
      </div>
    </PCAdminLayout>
  );
};

export default PCAdminEvacuationHistory;
