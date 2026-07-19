import React, { useState, useEffect } from 'react';
import { 
  ClipboardList, 
  Search, 
  Download, 
  Calendar,
  CheckCircle2,
  Users,
  Clock,
  ChevronRight,
  X
} from 'lucide-react';
import { collection, query, getDocs, orderBy, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import PCAdminLayout from '../components/PCAdminLayout';
import { toast } from 'sonner';
import { TeamWorkLog } from '../types';
import { format } from 'date-fns';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';

const PCAdminWorkLog: React.FC = () => {
  const [logs, setLogs] = useState<TeamWorkLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedTeam, setSelectedTeam] = useState('전체');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLog, setSelectedLog] = useState<TeamWorkLog | null>(null);

  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, 'teamWorkLogs'), 
      where('date', '==', selectedDate),
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TeamWorkLog[];
      setLogs(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching logs:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedDate]);

  // Filter logs based on team AND search query for worker names
  const filteredLogs = logs.filter(log => {
    const matchesTeam = selectedTeam === '전체' || log.teamName.includes(selectedTeam);
    if (!matchesTeam) return false;
    
    if (!searchQuery.trim()) return true;
    return log.entries.some(entry => 
      entry.userName && entry.userName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const handleExportExcel = () => {
    if (filteredLogs.length === 0) {
      toast.error('내보낼 데이터가 없습니다.');
      return;
    }
    const exportData: any[] = [];
    filteredLogs.forEach(log => {
      log.entries.forEach(entry => {
        exportData.push({
          '날짜': log.date,
          '팀이름': log.teamName,
          '성명': entry.userName,
          '작업1': entry.tasks[0]?.content || '',
          '시간1': entry.tasks[0]?.hours || '',
          '작업2': entry.tasks[1]?.content || '',
          '시간2': entry.tasks[1]?.hours || '',
          '작업3': entry.tasks[2]?.content || '',
          '시간3': entry.tasks[2]?.hours || '',
          '퇴근시간': entry.clockOutTime,
          '작성자': log.createdByUserName
        });
      });
    });

    import('../lib/exportUtils').then(m => {
      m.exportToExcel(exportData, `팀별작업현황_${selectedDate}`, '작업일지');
      toast.success('엑셀 파일이 다운로드되었습니다.');
    });
  };

  return (
    <PCAdminLayout title="작업일지 총괄 관리">
      <div className="max-w-[1600px] mx-auto space-y-8 text-foreground pb-20">
        <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-blue-500 font-black text-xs uppercase tracking-widest">
               <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
               Daily Reporting System
            </div>
            <h2 className="text-4xl font-black text-foreground tracking-tight">팀별 일일 작업일지</h2>
            <p className="text-muted-foreground font-medium">실시간으로 보고되는 각 팀의 작업 내역과 인원 투입 현황을 통합 관리합니다.</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={handleExportExcel}
              className="px-6 py-4 bg-blue-600 text-white rounded-2xl font-black text-sm flex items-center gap-3 hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/10 cursor-pointer"
            >
              <Download className="w-5 h-5" />
              엑셀 리포트 출력
            </button>
          </div>
        </div>

        {/* Statistics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-card p-8 rounded-[2rem] border-border shadow-sm flex items-center gap-6">
            <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-400">
               <Users className="w-8 h-8" />
            </div>
            <div>
               <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1">보고된 총 인원</p>
               <p className="text-4xl font-black text-foreground">
                 {filteredLogs.reduce((acc, log) => acc + log.entries.length, 0)}<span className="text-lg font-bold text-muted-foreground ml-1">명</span>
               </p>
            </div>
          </Card>
          <Card className="bg-card p-8 rounded-[2rem] border-border shadow-sm flex items-center gap-6">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400">
               <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
               <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1">보고 완료 팀</p>
               <p className="text-4xl font-black text-foreground">{filteredLogs.length}<span className="text-lg font-bold text-muted-foreground ml-1">팀</span></p>
            </div>
          </Card>
          <Card className="bg-card p-8 rounded-[2rem] border-border shadow-sm flex items-center gap-6">
            <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-400">
               <Clock className="w-8 h-8" />
            </div>
            <div>
               <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1">평균 퇴근 보고</p>
               <p className="text-4xl font-black text-foreground">18:00</p>
            </div>
          </Card>
        </div>

        {/* Filter Bar */}
        <div className="bg-card p-6 rounded-[2rem] border border-border shadow-sm flex flex-wrap gap-6 items-center">
          <div className="flex flex-col gap-1.5 shrink-0">
            <label className="text-[10px] font-black text-muted-foreground uppercase ml-1">조회 일자</label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input 
                type="date" 
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="pl-12 pr-6 py-3 bg-muted border-none rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-foreground cursor-pointer"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            <label className="text-[10px] font-black text-muted-foreground uppercase ml-1">팀 필터</label>
            <div className="flex gap-2">
              {['전체', '대조', '곡직', '크레인'].map(sec => (
                <button
                  key={sec}
                  onClick={() => setSelectedTeam(sec)}
                  className={`px-5 py-3 rounded-xl text-sm font-black transition-all cursor-pointer border ${
                    selectedTeam === sec 
                    ? 'bg-blue-600 text-white border-transparent' 
                    : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
                  }`}
                >
                  {sec}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5 ml-auto flex-1 max-w-sm w-full">
             <label className="text-[10px] font-black text-muted-foreground uppercase ml-1">직원 검색</label>
             <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-blue-500 transition-colors" />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="원하는 직원명으로 필터링..."
                  className="w-full pl-12 pr-6 py-3 bg-muted border-none rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-foreground"
                />
             </div>
          </div>
        </div>

        {/* WorkLog Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {loading ? (
            Array(4).fill(0).map((_, i) => (
              <div key={i} className="h-[400px] bg-muted animate-pulse rounded-[2.5rem]" />
            ))
          ) : filteredLogs.length > 0 ? (
            filteredLogs.map((log) => (
              <Card key={log.id} className="bg-card rounded-[2.5rem] border border-border shadow-sm overflow-hidden flex flex-col hover:border-blue-500/30 transition-all group">
                <div className="p-8 border-b border-border flex items-center justify-between bg-muted/30">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center text-foreground shadow-sm border border-border group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <Users className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-foreground">{log.teamName}</h3>
                      <p className="text-xs font-bold text-muted-foreground">작성자: {log.createdByUserName}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-muted rounded-full border border-border text-[10px] font-black text-blue-400 mb-2">
                       <Calendar className="w-3 h-3" />
                       {log.date}
                    </div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">SUBMITTED AT {format(new Date(log.createdAt), 'HH:mm')}</p>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto max-h-[400px]">
                  <Table>
                    <TableHeader className="bg-muted/50 sticky top-0 z-10 border-b border-border">
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="px-8 py-4 text-[10px] font-black text-muted-foreground uppercase w-[100px]">성명</TableHead>
                        <TableHead className="px-8 py-4 text-[10px] font-black text-muted-foreground uppercase">상세 작업 내역</TableHead>
                        <TableHead className="px-8 py-4 text-[10px] font-black text-muted-foreground uppercase w-[80px] text-center">퇴근</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {log.entries.map((entry, idx) => (
                        <TableRow key={idx} className="border-border/60 hover:bg-muted/10 transition-colors">
                          <TableCell className="px-8 py-4">
                             <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-black text-muted-foreground">
                                  {entry.userName ? entry.userName.charAt(0) : ''}
                                </div>
                                <span className="text-sm font-bold text-foreground">{entry.userName}</span>
                             </div>
                          </TableCell>
                          <TableCell className="px-8 py-4">
                             <div className="space-y-1.5">
                               {entry.tasks.map((t, tIdx) => (
                                 <div key={tIdx} className="flex items-center justify-between group/task text-xs">
                                   <span className="text-muted-foreground font-medium line-clamp-1 flex-1">• {t.content}</span>
                                   <span className="text-[10px] font-black text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded ml-2 shrink-0">{t.hours}H</span>
                                 </div>
                               ))}
                             </div>
                          </TableCell>
                          <TableCell className="px-8 py-4 text-center">
                            <span className="text-[10px] font-black text-muted-foreground">{entry.clockOutTime}</span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="p-6 bg-muted/20 border-t border-border flex justify-between items-center mt-auto">
                  <div className="flex -space-x-2">
                    {log.entries.slice(0, 5).map((e, i) => (
                      <div key={i} className="w-8 h-8 rounded-full border-2 border-card bg-muted flex items-center justify-center text-[10px] font-black text-muted-foreground">
                        {e.userName ? e.userName.charAt(0) : ''}
                      </div>
                    ))}
                    {log.entries.length > 5 && (
                      <div className="w-8 h-8 rounded-full border-2 border-card bg-slate-800 flex items-center justify-center text-[10px] font-black text-white">
                        +{log.entries.length - 5}
                      </div>
                    )}
                  </div>
                  
                  <button 
                    onClick={() => setSelectedLog(log)}
                    className="text-blue-400 font-black text-xs flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    전체 보기 <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </Card>
            ))
          ) : (
            <div className="col-span-full py-32 flex flex-col items-center gap-6 bg-card rounded-[3rem] border border-dashed border-border">
               <ClipboardList className="w-20 h-20 text-muted-foreground/30" />
               <div className="text-center">
                 <p className="text-xl font-black text-muted-foreground">등록된 작업일지가 없습니다.</p>
                 <p className="text-sm text-muted-foreground/60 font-bold mt-1">다른 날짜를 선택하거나 팀 필터 및 검색을 변경해보세요.</p>
               </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail Dialog Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedLog(null)}>
          <div className="bg-card border border-border rounded-[2.5rem] w-full max-w-4xl overflow-hidden shadow-2xl text-foreground flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
            <div className="p-8 border-b border-border bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div>
                <DialogTitle className="text-2xl font-black">{selectedLog.teamName} 상세 작업일지</DialogTitle>
                <p className="text-slate-400 font-medium mt-1">{selectedLog.date} 일자 보고서</p>
              </div>
              <button 
                onClick={() => setSelectedLog(null)}
                className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-all cursor-pointer border border-white/5"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
            
            <div className="p-8 overflow-y-auto flex-1">
              <Table>
                 <TableHeader className="bg-muted/50 border-b border-border">
                   <TableRow className="border-border">
                     <TableHead className="font-black text-xs text-muted-foreground">NO</TableHead>
                     <TableHead className="font-black text-xs text-muted-foreground">성명</TableHead>
                     <TableHead className="font-black text-xs text-muted-foreground">작업 내역 1</TableHead>
                     <TableHead className="font-black text-xs text-muted-foreground">작업 내역 2</TableHead>
                     <TableHead className="font-black text-xs text-muted-foreground">작업 내역 3</TableHead>
                     <TableHead className="font-black text-xs text-center text-muted-foreground">퇴근</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody className="divide-y divide-border">
                   {selectedLog.entries.map((entry, idx) => (
                     <TableRow key={idx} className="border-border hover:bg-muted/20 transition-colors">
                       <TableCell className="text-xs font-bold text-muted-foreground">{idx + 1}</TableCell>
                       <TableCell className="text-sm font-black text-foreground">{entry.userName}</TableCell>
                       <TableCell className="text-xs text-foreground/80">{entry.tasks[0]?.content || '-'} {entry.tasks[0]?.hours ? `(${entry.tasks[0].hours}H)` : ''}</TableCell>
                       <TableCell className="text-xs text-foreground/80">{entry.tasks[1]?.content || '-'} {entry.tasks[1]?.hours ? `(${entry.tasks[1].hours}H)` : ''}</TableCell>
                       <TableCell className="text-xs text-foreground/80">{entry.tasks[2]?.content || '-'} {entry.tasks[2]?.hours ? `(${entry.tasks[2].hours}H)` : ''}</TableCell>
                       <TableCell className="text-sm font-black text-foreground text-center">{entry.clockOutTime}</TableCell>
                     </TableRow>
                   ))}
                 </TableBody>
              </Table>
            </div>
            
            <div className="p-6 border-t border-border bg-muted/20 flex justify-end shrink-0">
              <button 
                onClick={() => setSelectedLog(null)}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs transition-all cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </PCAdminLayout>
  );
};

export default PCAdminWorkLog;
