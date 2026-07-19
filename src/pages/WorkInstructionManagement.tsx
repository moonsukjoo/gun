import React, { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '@/firebase';
import { collection, onSnapshot, query, orderBy, where, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { WorkInstructionReport, Role } from '@/types';
import { useAuth } from '@/components/AuthProvider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  ClipboardList, 
  Search, 
  Clock, 
  ChevronRight, 
  Users, 
  FileText,
  Printer,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Building2,
  ArrowRight
} from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { exportToExcel } from '@/lib/exportUtils';

export const WorkInstructionManagement: React.FC = () => {
  const { profile } = useAuth();
  const [reports, setReports] = useState<WorkInstructionReport[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<WorkInstructionReport | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  useEffect(() => {
    if (!profile) return;

    let q = query(collection(db, 'workInstructionReports'), orderBy('date', 'desc'));

    // Restriction: Non-admin roles (TEAM_LEADER, EMPLOYEE) can only see their department's reports
    const isFullAdmin = ['CEO', 'SAFETY_MANAGER', 'DIRECTOR', 'GENERAL_MANAGER'].includes(profile.role);
    if (!isFullAdmin && profile.departmentId) {
      q = query(
        collection(db, 'workInstructionReports'), 
        where('teamId', '==', profile.departmentId),
        orderBy('date', 'desc')
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setReports(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkInstructionReport)));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'workInstructionReports'));

    return () => unsubscribe();
  }, [profile]);

  const filteredReports = reports.filter(r => 
    r.teamName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.date.includes(searchTerm) ||
    r.supervisorName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDeleteReport = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'workInstructionReports', id));
      toast.success('보고서가 삭제되었습니다.');
      setIsDeleteDialogOpen(false);
      setSelectedReport(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `workInstructionReports/${id}`);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = async () => {
    const data = filteredReports.map(r => ({
      '날짜': r.date,
      '팀명': r.teamName,
      '관리감독자': r.supervisorName,
      '작업인원': r.workerInstructions?.length || 0,
      'TBM내용': r.tbmContent,
      '상태': r.status === 'APPROVED' ? '최종제출' : '작성중'
    }));
    
    const fileName = searchTerm 
      ? `작업지시서_${searchTerm}`
      : `작업지시서_전체`;
    
    await exportToExcel(data, fileName, "작업지시_목록");
  };

  return (
    <div className="space-y-6 pb-24 px-1 max-w-4xl mx-auto print:p-0 print:pb-0">
      <header className="py-6 flex flex-col gap-4 print:hidden">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-black tracking-tight text-foreground leading-tight">작업지시서 관리</h2>
            <p className="text-muted-foreground font-bold italic">제출된 팀별 일일 작업 지시 및 안전 점검 현황을 관리합니다.</p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleExportExcel}
            className="rounded-xl font-black gap-2 border-primary/20 text-primary"
          >
            <Printer className="w-4 h-4" /> 엑셀 다운로드
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/30" />
          <Input 
            placeholder="팀명, 날짜 또는 관리자 검색" 
            className="h-14 pl-11 bg-card border-border rounded-2xl text-foreground font-bold"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </header>

      <div className="grid gap-3 print:hidden">
        {loading ? (
          <div className="py-20 text-center animate-pulse">
            <ClipboardList className="w-16 h-16 mx-auto mb-4 text-muted-foreground/10" />
            <p className="font-black text-muted-foreground/30">데이터를 불러오는 중...</p>
          </div>
        ) : filteredReports.length > 0 ? filteredReports.map((report) => (
          <Card 
            key={report.id} 
            className="bg-card border-border p-5 rounded-3xl hover:bg-muted/30 transition-all cursor-pointer group active:scale-[0.99]"
            onClick={() => setSelectedReport(report)}
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-primary/5 rounded-2xl flex flex-col items-center justify-center border border-primary/10 group-hover:scale-105 transition-transform">
                <span className="text-[10px] font-black text-primary/40 leading-none">{report.date.split('-')[1]}월</span>
                <span className="text-xl font-black text-primary leading-none">{report.date.split('-')[2]}</span>
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                   <h3 className="text-lg font-black text-foreground">{report.teamName}</h3>
                   <Badge variant="outline" className="text-[9px] font-black rounded-lg border-border">{report.supervisorName} 팀장</Badge>
                </div>
                <div className="flex items-center gap-3">
                   <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                      <Clock className="w-3 h-3" /> {report.status === 'APPROVED' ? '최종제출' : '작성중'} {format(new Date(report.createdAt), 'HH:mm')}
                   </div>
                   <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                      <Users className="w-3 h-3" /> {report.workerInstructions?.length || 0}명
                   </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {report.status === 'APPROVED' ? (
                  <Badge className="bg-emerald-500/10 text-emerald-500 border-none">제출됨</Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-600 border-amber-600/20">작성중</Badge>
                )}
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground/30 group-hover:bg-primary group-hover:text-white transition-all">
                  <ChevronRight className="w-5 h-5" />
                </div>
              </div>
            </div>
          </Card>
        )) : (
          <div className="py-20 text-center bg-muted/20 rounded-3xl border-2 border-dashed border-border px-6">
            <p className="text-muted-foreground/30 font-black">검색 조건에 맞는 보고서가 없습니다.</p>
          </div>
        )}
      </div>

      {/* Report Detail Dialog */}
      <Dialog open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
        <DialogContent className="bg-card border-border rounded-[2.5rem] shadow-2xl max-w-4xl w-[98vw] p-0 overflow-hidden flex flex-col max-h-[95dvh] text-foreground">
          {selectedReport && (
            <>
              <DialogHeader className="p-8 pb-6 bg-muted/50 border-b border-border flex flex-row items-center justify-between shrink-0 print:hidden">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                    <FileText className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <DialogTitle className="text-2xl font-black text-foreground">{selectedReport.teamName} - 작업지시서</DialogTitle>
                    <p className="text-xs font-bold text-muted-foreground/60">{selectedReport.date} ({selectedReport.dayOfWeek})</p>
                  </div>
                </div>
                <div className="flex gap-2">
                   <Button variant="outline" size="icon" onClick={handlePrint} className="rounded-xl bg-white border-border">
                      <Printer className="w-5 h-5" />
                   </Button>
                   <Button variant="ghost" size="icon" onClick={() => setIsDeleteDialogOpen(true)} className="rounded-xl text-red-500 hover:bg-red-500/10">
                      <Trash2 className="w-5 h-5" />
                   </Button>
                </div>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto p-4 md:p-10 space-y-8 md:space-y-10 no-scrollbar print:overflow-visible print:p-0">
                 {/* This section will be styled for printing */}
                 <div className="print-report space-y-6 md:space-y-8">
                    <div className="flex flex-col md:flex-row items-baseline md:items-center justify-between border-b-2 pb-4 md:pb-6 border-foreground/10 print:border-foreground gap-2">
                       <div>
                          <h1 className="text-xl md:text-3xl font-black tracking-tight print:text-2xl whitespace-nowrap">작업지시 및 일일안전 점검일지</h1>
                          <p className="text-muted-foreground font-bold text-xs md:text-base">{selectedReport.date} ({selectedReport.dayOfWeek})</p>
                       </div>
                       <div className="text-left md:text-right w-full md:w-auto">
                          <p className="text-[10px] md:text-xs font-black text-primary uppercase tracking-widest leading-none">HD HYUNDAI</p>
                          <p className="text-lg md:text-xl font-black text-foreground">{selectedReport.teamName}</p>
                       </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-6">
                       <div className="lg:col-span-3 bg-muted/30 p-5 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border border-border/50 print:border print:bg-transparent">
                          <div className="flex items-center gap-2 mb-4">
                             <Building2 className="w-4 h-4 text-primary" />
                             <h4 className="text-[10px] md:text-xs font-black text-muted-foreground uppercase tracking-widest">관리 책임 및 승인</h4>
                          </div>
                          <div className="grid grid-cols-2 gap-4 md:gap-8">
                             <div className="space-y-1">
                                <p className="text-[9px] md:text-[10px] font-bold text-muted-foreground uppercase">관리감독자</p>
                                <div className="flex items-center gap-2">
                                  <p className="text-base md:text-lg font-black leading-tight">{selectedReport.supervisorName}</p>
                                  {selectedReport.supervisorSignUrl ? (
                                    <div className="h-6 w-16 bg-white/5 rounded overflow-hidden border border-border/30">
                                      <img src={selectedReport.supervisorSignUrl} className="h-full w-full object-contain mix-blend-multiply dark:mix-blend-normal" alt="supervisor-sign" />
                                    </div>
                                  ) : (
                                    <div className="w-8 md:w-12 h-4 md:h-6 border-b border-dashed border-border/50"></div>
                                  )}
                                </div>
                             </div>
                             <div className="space-y-1">
                                <p className="text-[9px] md:text-[10px] font-bold text-muted-foreground uppercase">안전책임자</p>
                                <div className="flex items-center gap-2">
                                  <p className="text-base md:text-lg font-black leading-tight text-primary">{selectedReport.safetyManagerName || '김주영'}</p>
                                  {selectedReport.safetyManagerSignUrl ? (
                                    <div className="h-6 w-16 bg-white/5 rounded overflow-hidden border border-border/30">
                                      <img src={selectedReport.safetyManagerSignUrl} className="h-full w-full object-contain mix-blend-multiply dark:mix-blend-normal" alt="safety-manager-sign" />
                                    </div>
                                  ) : (
                                    <div className="w-8 md:w-12 h-4 md:h-6 border-b border-dashed border-border/50"></div>
                                  )}
                                </div>
                             </div>
                          </div>
                       </div>
                       <div className="lg:col-span-2 bg-muted/30 p-5 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border border-border/50 print:border print:bg-transparent">
                          <div className="flex items-center gap-2 mb-4">
                             <ClipboardList className="w-4 h-4 text-primary" />
                             <h4 className="text-[10px] md:text-xs font-black text-muted-foreground uppercase tracking-widest">TBM 핵심 내용</h4>
                          </div>
                          <p className="text-xs md:text-sm font-bold leading-relaxed text-foreground/80">{selectedReport.tbmContent}</p>
                       </div>
                    </div>

                    <div className="space-y-3 md:space-y-4">
                       <h3 className="text-lg md:text-xl font-black flex items-center gap-2 px-1">
                          <Users className="w-5 h-5 text-primary" /> 작업 인원 지시 및 서명
                       </h3>
                       <div className="rounded-[1.5rem] md:rounded-[2rem] border border-border overflow-x-auto bg-card shadow-sm">
                          <table className="w-full border-collapse min-w-[700px] md:min-w-full">
                             <thead className="bg-muted/50 print:bg-transparent border-b border-border">
                                <tr>
                                   <th className="px-3 py-3 md:px-4 md:py-4 text-[9px] md:text-[10px] font-black border-r border-border text-center w-10">NO</th>
                                   <th className="px-3 py-3 md:px-4 md:py-4 text-[9px] md:text-[10px] font-black border-r border-border text-left w-20 md:w-32">성명</th>
                                   <th className="px-3 py-3 md:px-4 md:py-4 text-[9px] md:text-[10px] font-black border-r border-border text-left">지시내용</th>
                                   <th className="px-3 py-3 md:px-4 md:py-4 text-[9px] md:text-[10px] font-black border-r border-border text-center w-12 md:w-20">건강</th>
                                   <th className="px-3 py-3 md:px-4 md:py-4 text-[9px] md:text-[10px] font-black border-r border-border text-center w-24 md:w-40">시간</th>
                                   <th className="px-3 py-3 md:px-4 md:py-4 text-[9px] md:text-[10px] font-black border-r border-border text-center w-16 md:w-24">전</th>
                                   <th className="px-3 py-3 md:px-4 md:py-4 text-[9px] md:text-[10px] font-black text-center w-16 md:w-24">후</th>
                                </tr>
                             </thead>
                             <tbody className="divide-y divide-border">
                                {selectedReport.workerInstructions?.map((w, i) => (
                                   <tr key={i} className="hover:bg-muted/5 transition-colors">
                                      <td className="px-3 py-3 md:px-4 md:py-4 text-[10px] font-medium text-center border-r border-border text-muted-foreground">{w.no}</td>
                                      <td className="px-3 py-3 md:px-4 md:py-4 text-xs md:text-sm font-black border-r border-border">{w.workerName}</td>
                                      <td className="px-3 py-3 md:px-4 md:py-4 text-xs md:text-sm font-bold border-r border-border leading-tight">{w.instruction}</td>
                                      <td className="px-3 py-3 md:px-4 md:py-4 text-center border-r border-border">
                                         <Badge variant={w.healthStatus === 'GOOD' ? 'default' : w.healthStatus === 'BAD' ? 'destructive' : 'outline'} className="text-[8px] md:text-[9px] px-1 md:px-1.5 py-0 h-3 md:h-4 font-black">
                                            {w.healthStatus}
                                         </Badge>
                                      </td>
                                      <td className="px-3 py-3 md:px-4 md:py-4 text-[9px] font-bold text-center border-r border-border whitespace-nowrap">
                                         {w.startTime} ~ {w.endTime || '--:--'}
                                      </td>
                                      <td className="px-1 py-1 md:px-4 md:py-4 border-r border-border text-center bg-muted/5">
                                         {w.signBeforeUrl ? <img src={w.signBeforeUrl} className="h-6 md:h-10 mx-auto object-contain mix-blend-multiply dark:mix-blend-normal" alt="sign" /> : <div className="h-6 md:h-10"></div>}
                                      </td>
                                      <td className="px-1 py-1 md:px-4 md:py-4 text-center bg-muted/5">
                                         {w.signAfterUrl ? <img src={w.signAfterUrl} className="h-6 md:h-10 mx-auto object-contain mix-blend-multiply dark:mix-blend-normal" alt="sign" /> : <div className="h-6 md:h-10"></div>}
                                      </td>
                                   </tr>
                                ))}
                             </tbody>
                          </table>
                       </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 print:grid-cols-2 print:gap-6">
                       <div className="space-y-3 md:space-y-4">
                          <h3 className="text-lg md:text-xl font-black flex items-center gap-2 px-1">
                             <ShieldCheck className="w-5 h-5 text-primary" /> 안전 점검 결과
                          </h3>
                          <div className="rounded-[1.5rem] md:rounded-[2rem] border border-border bg-card shadow-sm overflow-hidden divide-y divide-border">
                             {selectedReport.safetyChecks?.map((cat, ci) => (
                                <div key={ci} className="bg-transparent">
                                   <div className="px-4 py-2 md:px-5 md:py-3 bg-muted/30 text-[9px] md:text-[10px] font-black text-muted-foreground uppercase tracking-widest">{cat.category}</div>
                                   <div className="divide-y divide-border">
                                      {cat.items.map((item, ii) => (
                                         <div key={ii} className="flex items-center justify-between px-4 py-2 md:px-5 md:py-3">
                                            <p className="text-[11px] md:text-[12px] font-bold text-foreground/80 leading-snug">{item.no}. {item.text}</p>
                                            <div className={cn(
                                               "w-6 h-6 md:w-8 md:h-8 rounded-lg md:rounded-xl flex items-center justify-center text-[10px] md:text-xs font-black shrink-0 ml-3 md:ml-4",
                                               item.result === 'O' ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : 
                                               item.result === 'X' ? "bg-red-500/10 text-red-500 border border-red-500/20" :
                                               "bg-muted/50 text-muted-foreground/50 border border-border"
                                            )}>{item.result}</div>
                                         </div>
                                      ))}
                                   </div>
                                </div>
                             ))}
                          </div>
                       </div>
                       <div className="space-y-3 md:space-y-4">
                          <h3 className="text-lg md:text-xl font-black flex items-center gap-2 px-1">
                             <AlertCircle className="w-5 h-5 text-primary" /> 위험요인 및 안전작업방법
                          </h3>
                          <div className="rounded-[1.5rem] md:rounded-[2rem] border border-border bg-card shadow-sm overflow-x-auto">
                             <table className="w-full border-collapse min-w-[300px]">
                                <thead className="bg-muted/50 border-b border-border">
                                   <tr>
                                      <th className="px-3 py-3 md:px-4 md:py-4 text-[9px] md:text-[10px] font-black border-r border-border text-center w-10">NO</th>
                                      <th className="px-3 py-3 md:px-4 md:py-4 text-[9px] md:text-[10px] font-black border-r border-border text-left w-24 md:w-32">위험요인</th>
                                      <th className="px-3 py-3 md:px-4 md:py-4 text-[9px] md:text-[10px] font-black text-left">안전작업방법</th>
                                   </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                   {selectedReport.hazardAssessments?.map((h, i) => (
                                      <tr key={i} className="hover:bg-muted/5 transition-colors">
                                         <td className="px-3 py-3 md:px-4 md:py-4 text-[10px] font-medium text-center border-r border-border text-muted-foreground">{h.no}</td>
                                         <td className="px-3 py-3 md:px-4 md:py-4 text-xs md:text-sm font-black border-r border-border bg-muted/5">{h.hazardFactor}</td>
                                         <td className="px-3 py-3 md:px-4 md:py-4 text-xs md:text-medium leading-relaxed italic text-foreground/70">{h.safetyMethod || '-'}</td>
                                      </tr>
                                   ))}
                                </tbody>
                             </table>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>

              <DialogFooter className="p-8 pt-4 bg-muted/50 border-t border-border shrink-0 print:hidden">
                <Button 
                  className="w-full h-14 bg-card border border-border rounded-2xl font-black text-foreground hover:bg-muted"
                  onClick={() => setSelectedReport(null)}
                >
                  닫기
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
         <DialogContent className="bg-card border-border rounded-[2.5rem] max-w-sm">
            <DialogHeader>
               <DialogTitle className="text-xl font-black text-center pt-4">보고서 삭제</DialogTitle>
            </DialogHeader>
            <div className="py-6 text-center">
               <p className="text-muted-foreground font-bold">이 보고서를 영구적으로 삭제하시겠습니까?</p>
            </div>
            <DialogFooter className="flex-col gap-2">
               <Button variant="destructive" onClick={() => selectedReport?.id && handleDeleteReport(selectedReport.id)} className="w-full h-12 rounded-xl font-black">삭제</Button>
               <Button variant="ghost" onClick={() => setIsDeleteDialogOpen(false)} className="w-full h-12 rounded-xl font-black">취소</Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>

      {/* Basic Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-report, .print-report * {
            visibility: visible;
          }
          .print-report {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};
