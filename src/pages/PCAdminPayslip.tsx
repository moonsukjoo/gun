import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, doc, deleteDoc, setDoc, where, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Payslip } from '../types';
import PCAdminLayout from '../components/PCAdminLayout';
import { 
  FileText, 
  Upload, 
  Search, 
  Trash2, 
  Eye, 
  Printer, 
  FileSpreadsheet,
  CheckCircle2,
  Calendar as CalendarIcon,
  Plus,
  X,
  PlusCircle,
  Edit2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

const PCAdminPayslip: React.FC = () => {
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingPayslipId, setEditingPayslipId] = useState<string | null>(null);
  const [payslipToDelete, setPayslipToDelete] = useState<{ id: string; name: string } | null>(null);
  
  // New payslip form state
  const [newPayslip, setNewPayslip] = useState({
    userName: '',
    employeeId: '',
    month: selectedMonth,
    baseSalary: '3000000',
    experienceAllowance: '0',
    otherAllowance: '0',
    annualLeaveAllowance: '0',
    mealAllowance: '100000',
    extraAllowance: '0',
    incomeTax: '100000',
    localIncomeTax: '10000',
    healthInsurance: '120000',
    nationalPension: '135000',
    employmentInsurance: '27000',
    mealDeduction: '0',
    laundryDeduction: '0',
  });

  useEffect(() => {
    fetchPayslips();
  }, [selectedMonth]);

  const fetchPayslips = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'payslips'),
        where('month', '==', selectedMonth),
        orderBy('userName', 'asc')
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payslip));
      setPayslips(data);
    } catch (error) {
      console.error('Error fetching payslips:', error);
      // fallback if composite index is not ready
      const qBasic = query(collection(db, 'payslips'), where('month', '==', selectedMonth));
      try {
        const snapBasic = await getDocs(qBasic);
        const dataBasic = snapBasic.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payslip));
        setPayslips(dataBasic);
      } catch (fallbackError) {
        console.error('Fallback failed:', fallbackError);
        toast.error('급여명세서 목록을 불러오지 못했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePayslip = (id: string, name: string) => {
    setPayslipToDelete({ id, name });
  };

  const confirmDeletePayslip = async () => {
    if (!payslipToDelete) return;
    try {
      await deleteDoc(doc(db, 'payslips', payslipToDelete.id));
      toast.success(`${payslipToDelete.name}님의 급여명세서가 안전하게 삭제되었습니다.`);
      setPayslipToDelete(null);
      fetchPayslips();
    } catch (e) {
      console.error(e);
      toast.error('삭제 처리에 실패했습니다.');
    }
  };

  const handleOpenEditModal = (payslip: Payslip) => {
    setEditingPayslipId(payslip.id || null);
    setNewPayslip({
      userName: payslip.userName || '',
      employeeId: payslip.employeeId || payslip.uid || '',
      month: payslip.month || selectedMonth,
      baseSalary: String(payslip.baseSalary || 0),
      experienceAllowance: String(payslip.experienceAllowance || 0),
      otherAllowance: String(payslip.otherAllowance || 0),
      annualLeaveAllowance: String(payslip.annualLeaveAllowance || 0),
      mealAllowance: String(payslip.mealAllowance || 100000),
      extraAllowance: String(payslip.extraAllowance || 0),
      incomeTax: String(payslip.incomeTax || 0),
      localIncomeTax: String(payslip.localIncomeTax || 0),
      healthInsurance: String(payslip.healthInsurance || 0),
      nationalPension: String(payslip.nationalPension || 0),
      employmentInsurance: String(payslip.employmentInsurance || 0),
      mealDeduction: String(payslip.mealDeduction || 0),
      laundryDeduction: String(payslip.laundryDeduction || 0),
    });
    setIsAddModalOpen(true);
  };

  const handleAddPayslip = async () => {
    if (!newPayslip.userName.trim()) {
      toast.error('성명을 입력해주십시오.');
      return;
    }
    if (!newPayslip.employeeId.trim()) {
      toast.error('사번을 입력해주십시오.');
      return;
    }

    try {
      const baseSalary = Number(newPayslip.baseSalary) || 0;
      const experienceAllowance = Number(newPayslip.experienceAllowance) || 0;
      const otherAllowance = Number(newPayslip.otherAllowance) || 0;
      const annualLeaveAllowance = Number(newPayslip.annualLeaveAllowance) || 0;
      const mealAllowance = Number(newPayslip.mealAllowance) || 0;
      const extraAllowance = Number(newPayslip.extraAllowance) || 0;

      const incomeTax = Number(newPayslip.incomeTax) || 0;
      const localIncomeTax = Number(newPayslip.localIncomeTax) || 0;
      const healthInsurance = Number(newPayslip.healthInsurance) || 0;
      const nationalPension = Number(newPayslip.nationalPension) || 0;
      const employmentInsurance = Number(newPayslip.employmentInsurance) || 0;
      const mealDeduction = Number(newPayslip.mealDeduction) || 0;
      const laundryDeduction = Number(newPayslip.laundryDeduction) || 0;

      const totalEarnings = baseSalary + experienceAllowance + otherAllowance + annualLeaveAllowance + mealAllowance + extraAllowance;
      const totalDeductions = incomeTax + localIncomeTax + healthInsurance + nationalPension + employmentInsurance + mealDeduction + laundryDeduction;
      const netPay = totalEarnings - totalDeductions;

      const docId = editingPayslipId || `${newPayslip.month}_${newPayslip.employeeId}`;
      await setDoc(doc(db, 'payslips', docId), {
        uid: newPayslip.employeeId,
        employeeId: newPayslip.employeeId,
        userName: newPayslip.userName.trim(),
        month: newPayslip.month,
        baseHours: 160,
        weeklyHolidayHours: 32,
        paidLeaveHours: 8,
        trainingHours: 0,
        otherHours: 0,
        monthlyLeaveHours: 24,
        holidayWorkHours: 0,
        overtimeHours: 0,
        totalHours: 224,
        hourlyRate: 0,
        baseSalary,
        experienceAllowance,
        otherAllowance,
        annualLeaveAllowance,
        mealAllowance,
        extraAllowance,
        totalEarnings,
        incomeTax,
        localIncomeTax,
        healthInsurance,
        nationalPension,
        employmentInsurance,
        mealDeduction,
        laundryDeduction,
        totalDeductions,
        netPay,
        createdAt: new Date().toISOString()
      }, { merge: true });

      toast.success(editingPayslipId ? `${newPayslip.userName}님의 급여명세서가 수정 완료되었습니다.` : `${newPayslip.userName}님의 수기 급여명세서가 등록되었습니다.`);
      setIsAddModalOpen(false);
      setEditingPayslipId(null);
      setNewPayslip({
        userName: '',
        employeeId: '',
        month: selectedMonth,
        baseSalary: '3000000',
        experienceAllowance: '0',
        otherAllowance: '0',
        annualLeaveAllowance: '0',
        mealAllowance: '100000',
        extraAllowance: '0',
        incomeTax: '100000',
        localIncomeTax: '10000',
        healthInsurance: '120000',
        nationalPension: '135000',
        employmentInsurance: '27000',
        mealDeduction: '0',
        laundryDeduction: '0',
      });
      fetchPayslips();
    } catch (e) {
      console.error(e);
      toast.error(editingPayslipId ? '수정 중 오류가 발생했습니다.' : '수기 등록 중 오류가 발생했습니다.');
    }
  };

  const downloadTemplate = async () => {
    try {
      const data = [
        ['항목', '예시 데이터 (이 열을 복사해서 여러 명을 추가하세요)'],
        ['사번', 'x66626'],
        ['성명', '문서주'],
        ['정취', 160],
        ['주차', 32],
        ['유휴', 8],
        ['훈련', 0],
        ['기타시간', 0],
        ['월휴', 24],
        ['휴일근로', 0],
        ['연장근로', 11],
        ['시간계', 235],
        ['시급', 0],
        ['시간급여액(가)', 3500000],
        ['경력', 0],
        ['기타수당', 0],
        ['년차', 0.0],
        ['중식', 0],
        ['기타', 0],
        ['총급여액', 3500000],
        ['갑근세', 127220],
        ['주민세', 12720],
        ['건강보험', 146420],
        ['국민연금', 171000],
        ['고용보험', 31500],
        ['식권대', 0],
        ['세탁비', 0],
        ['공제액계', 488860],
        ['지급액', 3011140],
        ['연차기준일', '2025.12.01']
      ];

      const XLSX = await import('xlsx');
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws['!cols'] = [{ wch: 20 }, { wch: 40 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '급여명세서_양식');
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `급여명세서_양식_${selectedMonth}.xlsx`;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);
      
      toast.success('템플릿 서식이 다운로드되었습니다.');
    } catch (error) {
      console.error(error);
      toast.error('템플릿 다운로드 중 오류가 발생했습니다.');
    }
  };

  const handleExportReport = async () => {
    if (payslips.length === 0) {
      toast.error('내보낼 데이터가 없습니다.');
      return;
    }
    try {
      const headers = ['이름', '지급월', '총 지급액', '총 공제액', '실 수령액'];
      const data = payslips.map(p => [
        p.userName,
        p.month,
        p.totalEarnings.toLocaleString() + '원',
        p.totalDeductions.toLocaleString() + '원',
        p.netPay.toLocaleString() + '원'
      ]);

      const { exportToPDF } = await import('../lib/exportUtils');
      await exportToPDF(`${selectedMonth} 급여 발행 실적 리포트`, headers, data, `Salary_Report_${selectedMonth}`);
      toast.success('실적 리포트가 생성되었습니다.');
    } catch (error) {
      console.error(error);
      toast.error('리포트 생성 중 오류가 발생했습니다.');
    }
  };

  // Filter list of payslips by search query
  const filteredPayslips = payslips.filter(p => 
    p.userName && p.userName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <PCAdminLayout title="급여명세서 중앙 관리">
      <div className="max-w-[1600px] mx-auto space-y-10 text-foreground">
        {/* Management Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
           <div className="bg-card p-10 rounded-[3rem] border border-border shadow-sm flex items-center gap-8">
              <div className="w-20 h-20 bg-blue-500/10 rounded-[2rem] flex items-center justify-center text-blue-500 shadow-inner">
                 <FileSpreadsheet className="w-10 h-10" />
              </div>
              <div>
                <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1">금월 발행 결과</h3>
                <div className="flex items-baseline gap-2">
                   <span className="text-4xl font-black text-foreground">{payslips.length}</span>
                   <span className="text-muted-foreground font-bold text-sm">건 완료</span>
                </div>
              </div>
           </div>

           <div className="bg-slate-900 border border-slate-800 p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden group">
              <div className="relative z-10">
                <h3 className="text-xs font-black text-blue-400 uppercase tracking-widest mb-4">Batch Processing</h3>
                <p className="text-2xl font-black mb-6 tracking-tight leading-none">급여 데이터 대량 업로드</p>
                <div className="flex gap-4">
                   <button 
                     onClick={() => toast.info('급여 대량 업로드는 모바일/Excel 연동 자동 배치망 또는 수기 추가를 활용해 주십시오.')}
                     className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-black text-xs hover:bg-blue-500 transition-all flex items-center gap-2"
                   >
                     <Upload className="w-4 h-4" /> 엑셀 업로드 정보
                   </button>
                   <button 
                     onClick={downloadTemplate}
                     className="px-6 py-2.5 bg-white/10 text-white rounded-xl font-black text-xs hover:bg-white/20 transition-all border border-white/10"
                   >
                     템플릿 서식 다운
                   </button>
                </div>
              </div>
              <FileSpreadsheet className="absolute -right-8 -bottom-8 w-48 h-48 text-white/5 rotate-12 transition-transform group-hover:scale-110" />
           </div>

           <div className="bg-emerald-600/25 border border-emerald-500/30 p-10 rounded-[3rem] text-foreground shadow-2xl flex flex-col justify-between">
              <div>
                <CheckCircle2 className="w-10 h-10 mb-4 text-emerald-500 opacity-80" />
                <p className="text-sm font-bold text-foreground/90 leading-relaxed">이번 달에도 모든 임직원의 급여 발행이<br/>정상적으로 연동/완료되었습니다.</p>
              </div>
              <button 
                onClick={handleExportReport}
                className="w-fit text-xs font-black bg-emerald-500/20 px-4 py-2 rounded-xl text-emerald-400 hover:bg-emerald-500/30 transition-all border border-emerald-500/20 mt-4 cursor-pointer"
              >
                실적 리포트 확인
              </button>
           </div>
        </div>

        {/* Toolbar */}
        <div className="bg-card p-6 rounded-[2.5rem] border border-border shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
           <div className="flex items-center gap-4 flex-1 w-full">
              <div className="relative shrink-0">
                 <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                 <input 
                   type="month" 
                   value={selectedMonth}
                   onChange={(e) => setSelectedMonth(e.target.value)}
                   className="pl-12 pr-6 py-3 bg-muted border-none rounded-2xl text-sm font-black focus:ring-2 focus:ring-blue-500/10 cursor-pointer text-foreground"
                 />
              </div>
              <div className="relative flex-1 max-w-sm group">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-blue-500 transition-colors" />
                 <input 
                   type="text" 
                   placeholder="임직원 이름 검색..."
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                   className="w-full pl-12 pr-6 py-3 bg-muted border-none rounded-2xl text-sm font-black focus:ring-2 focus:ring-blue-500/10 transition-all border border-transparent focus:border-border text-foreground"
                 />
              </div>
           </div>
           
           <div className="flex items-center gap-4 shrink-0">
              <button 
                onClick={() => window.print()}
                className="p-3 bg-muted text-muted-foreground hover:text-foreground rounded-2xl hover:bg-muted/80 transition-all cursor-pointer border border-border" 
                title="인쇄"
              >
                <Printer className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setIsAddModalOpen(true)}
                className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-black text-sm hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/15 flex items-center gap-2 cursor-pointer"
              >
                 <Plus className="w-5 h-5" />
                 수기 명세서 추가
              </button>
           </div>
        </div>

        {/* Data Table */}
        <div className="bg-card rounded-[3rem] border border-border shadow-sm overflow-hidden">
           <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                 <thead>
                    <tr className="bg-muted text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em] border-b border-border">
                       <th className="px-10 py-6 text-center w-20">순번</th>
                       <th className="px-6 py-6">임직원 이름</th>
                       <th className="px-6 py-6 text-center">지급월</th>
                       <th className="px-6 py-6 text-right">총 지급액</th>
                       <th className="px-6 py-6 text-right">실 수령액</th>
                       <th className="px-6 py-6 text-center">발행 유무</th>
                       <th className="px-10 py-6 text-right">액션</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-border/60">
                    {loading ? (
                       [...Array(6)].map((_, i) => (
                        <tr key={i} className="animate-pulse"><td colSpan={7} className="h-20" /></tr>
                       ))
                    ) : filteredPayslips.length === 0 ? (
                       <tr><td colSpan={7} className="py-32 text-center text-muted-foreground font-bold">발행된 명세서 내역이 없습니다.</td></tr>
                    ) : (
                       filteredPayslips.map((payslip, idx) => (
                        <tr key={payslip.id} className="hover:bg-muted/30 transition-all group">
                           <td className="px-10 py-6 text-center text-xs font-black text-muted-foreground leading-none">{idx + 1}</td>
                           <td className="px-6 py-6 font-black text-foreground font-sans tracking-tight">{payslip.userName}</td>
                           <td className="px-6 py-6 text-center font-bold text-muted-foreground font-mono text-xs">{payslip.month}</td>
                           <td className="px-6 py-6 text-right font-black text-foreground/80 font-mono italic">{payslip.totalEarnings?.toLocaleString() || 0}원</td>
                           <td className="px-6 py-6 text-right font-black text-blue-400 font-mono italic">{payslip.netPay?.toLocaleString() || 0}원</td>
                           <td className="px-6 py-6 text-center">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-[10px] font-black border border-emerald-500/20">
                                 <CheckCircle2 className="w-3 h-3" /> 발행완료
                              </span>
                           </td>
                           <td className="px-10 py-6 text-right">
                              <div className="flex justify-end gap-3 opacity-90 group-hover:opacity-100 transition-all">
                                 <button 
                                   onClick={() => setSelectedPayslip(payslip)}
                                   className="p-2.5 bg-muted border border-border rounded-xl hover:bg-card transition-all text-muted-foreground hover:text-foreground cursor-pointer flex items-center justify-center" 
                                   title="상세보기"
                                 >
                                   <Eye className="w-4 h-4" />
                                 </button>
                                 <button 
                                   onClick={() => handleOpenEditModal(payslip)}
                                   className="p-2.5 bg-muted border border-border rounded-xl hover:bg-card transition-all text-indigo-400 hover:text-indigo-300 cursor-pointer flex items-center justify-center" 
                                   title="수정"
                                 >
                                   <Edit2 className="w-4 h-4" />
                                 </button>
                                 <button 
                                   onClick={() => handleDeletePayslip(payslip.id!, payslip.userName)}
                                   className="p-2.5 bg-muted border border-border rounded-xl hover:bg-rose-500/10 transition-all text-rose-500 hover:text-rose-400 cursor-pointer flex items-center justify-center" 
                                   title="삭제"
                                 >
                                   <Trash2 className="w-4 h-4" />
                                 </button>
                              </div>
                           </td>
                        </tr>
                       ))
                    )}
                 </tbody>
              </table>
           </div>
           <div className="p-8 bg-muted/40 flex justify-center border-t border-border">
              <div className="flex gap-2">
                 <button className="w-10 h-10 flex items-center justify-center rounded-2xl bg-card border border-border shadow-sm font-black text-sm">1</button>
              </div>
           </div>
        </div>
      </div>

      {/* Manual Insertion Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl text-foreground flex flex-col max-h-[90vh]">
            <div className="p-8 border-b border-border bg-muted/20 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                  <PlusCircle className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <h3 className="text-lg font-black leading-none">{editingPayslipId ? "기존 명세서 데이터 수정" : "수기 명세서 수동 발행"}</h3>
                  <p className="text-xs font-semibold text-muted-foreground mt-1">
                    {editingPayslipId ? "선택한 임직원의 기존 급여 명세 정산 데이터를 수정 및 갱신합니다." : "개별 임직원의 급여 데이터를 수동으로 입력하여 명세서를 즉시 생성합니다."}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => { setIsAddModalOpen(false); setEditingPayslipId(null); }}
                className="w-10 h-10 hover:bg-muted border border-border hover:border-transparent rounded-full flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-8 overflow-y-auto space-y-6 flex-1 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-muted-foreground">임직원 이름</label>
                  <input 
                    type="text" 
                    placeholder="예: 문서주"
                    value={newPayslip.userName}
                    onChange={(e) => setNewPayslip(prev => ({ ...prev, userName: e.target.value }))}
                    className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-sm font-bold text-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-muted-foreground">사번 (식별값)</label>
                  <input 
                    type="text" 
                    placeholder="예: x66626"
                    value={newPayslip.employeeId}
                    onChange={(e) => setNewPayslip(prev => ({ ...prev, employeeId: e.target.value }))}
                    className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-sm font-bold text-foreground"
                  />
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <h4 className="text-xs font-extrabold text-blue-500 mb-4 flex items-center gap-2">지급 항목 (Earnings)</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-black text-muted-foreground">기본급 (원)</label>
                    <input 
                      type="number" 
                      value={newPayslip.baseSalary}
                      onChange={(e) => setNewPayslip(prev => ({ ...prev, baseSalary: e.target.value }))}
                      className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-sm font-mono text-foreground"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-black text-muted-foreground">경력 수당 (원)</label>
                    <input 
                      type="number" 
                      value={newPayslip.experienceAllowance}
                      onChange={(e) => setNewPayslip(prev => ({ ...prev, experienceAllowance: e.target.value }))}
                      className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-sm font-mono text-foreground"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-black text-muted-foreground">중식대 (원)</label>
                    <input 
                      type="number" 
                      value={newPayslip.mealAllowance}
                      onChange={(e) => setNewPayslip(prev => ({ ...prev, mealAllowance: e.target.value }))}
                      className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-sm font-mono text-foreground"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-black text-muted-foreground">기타 수당 (원)</label>
                    <input 
                      type="number" 
                      value={newPayslip.otherAllowance}
                      onChange={(e) => setNewPayslip(prev => ({ ...prev, otherAllowance: e.target.value }))}
                      className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-sm font-mono text-foreground"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <h4 className="text-xs font-extrabold text-red-400 mb-4 flex items-center gap-2">공제 항목 (Deductions)</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-black text-muted-foreground">소득세 (갑근세)</label>
                    <input 
                      type="number" 
                      value={newPayslip.incomeTax}
                      onChange={(e) => setNewPayslip(prev => ({ ...prev, incomeTax: e.target.value }))}
                      className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-sm font-mono text-foreground"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-black text-muted-foreground">지방소득세 (주민세)</label>
                    <input 
                      type="number" 
                      value={newPayslip.localIncomeTax}
                      onChange={(e) => setNewPayslip(prev => ({ ...prev, localIncomeTax: e.target.value }))}
                      className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-sm font-mono text-foreground"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-black text-muted-foreground">국민연금</label>
                    <input 
                      type="number" 
                      value={newPayslip.nationalPension}
                      onChange={(e) => setNewPayslip(prev => ({ ...prev, nationalPension: e.target.value }))}
                      className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-sm font-mono text-foreground"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-black text-muted-foreground">건강보험료</label>
                    <input 
                      type="number" 
                      value={newPayslip.healthInsurance}
                      onChange={(e) => setNewPayslip(prev => ({ ...prev, healthInsurance: e.target.value }))}
                      className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-sm font-mono text-foreground"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 border-t border-border bg-muted/20 flex gap-4 shrink-0">
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="flex-1 py-4 bg-muted border border-border text-foreground hover:bg-muted/80 rounded-2xl font-black text-xs transition-all cursor-pointer"
              >
                취소
              </button>
              <button 
                onClick={handleAddPayslip}
                className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs transition-all cursor-pointer"
              >
                명세서 확정 발행
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PaySlip Detailed Preview Modal */}
      {selectedPayslip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedPayslip(null)}>
          <div className="bg-card border border-border rounded-[2.5rem] w-full max-w-xl overflow-hidden shadow-2xl text-foreground flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
            <div className="px-8 py-6 border-b border-border bg-muted/20 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-foreground">급여명세서 상세 보기</h3>
                <p className="text-xs font-bold text-muted-foreground mt-1">{selectedPayslip.userName}님 / {selectedPayslip.month} 귀속일자</p>
              </div>
              <button 
                onClick={() => setSelectedPayslip(null)}
                className="w-10 h-10 hover:bg-muted border border-border hover:border-transparent rounded-full flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-8 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Employee Header Panel */}
              <div className="bg-muted/40 p-4 rounded-2xl border border-border grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-black">성명 / 사원번호</p>
                  <p className="text-sm font-black text-foreground mt-1">{selectedPayslip.userName} ({selectedPayslip.employeeId || '미기재'})</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-black">정산기준 근로시간</p>
                  <p className="text-sm font-black text-foreground mt-1">{selectedPayslip.totalHours || 224} 시간</p>
                </div>
              </div>

              {/* Earnings Details */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-black text-blue-500 uppercase tracking-widest pl-1">지급액 세부 내역 (Earnings)</h4>
                <div className="bg-muted/10 border border-border/80 rounded-2xl p-4 divide-y divide-border/40">
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground font-semibold">기본급</span>
                    <span className="font-mono font-bold text-foreground">{selectedPayslip.baseSalary?.toLocaleString() || 0} 원</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground font-semibold">경력 및 직책수당</span>
                    <span className="font-mono font-bold text-foreground">{selectedPayslip.experienceAllowance?.toLocaleString() || 0} 원</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground font-semibold">식비 (중식대)</span>
                    <span className="font-mono font-bold text-foreground">{selectedPayslip.mealAllowance?.toLocaleString() || 0} 원</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground font-semibold">기타 연장/안전 수당</span>
                    <span className="font-mono font-bold text-foreground">{selectedPayslip.otherAllowance?.toLocaleString() || 0} 원</span>
                  </div>
                  <div className="flex justify-between py-2 font-black border-t border-border pt-2">
                    <span className="text-foreground">지급 합계액 (Ea)</span>
                    <span className="font-mono text-blue-400">{selectedPayslip.totalEarnings?.toLocaleString() || 0} 원</span>
                  </div>
                </div>
              </div>

              {/* Deductions Details */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-black text-red-500 uppercase tracking-widest pl-1">세금 및 공제 내역 (Deductions)</h4>
                <div className="bg-muted/10 border border-border/80 rounded-2xl p-4 divide-y divide-border/40">
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground font-semibold">갑근세 (소득세)</span>
                    <span className="font-mono font-bold text-foreground">{selectedPayslip.incomeTax?.toLocaleString() || 0} 원</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground font-semibold">국민연금</span>
                    <span className="font-mono font-bold text-foreground">{selectedPayslip.nationalPension?.toLocaleString() || 0} 원</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground font-semibold">건강보험료</span>
                    <span className="font-mono font-bold text-foreground">{selectedPayslip.healthInsurance?.toLocaleString() || 0} 원</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground font-semibold">고용보험료</span>
                    <span className="font-mono font-bold text-foreground">{selectedPayslip.employmentInsurance?.toLocaleString() || 0} 원</span>
                  </div>
                  <div className="flex justify-between py-2 font-black border-t border-border pt-2">
                    <span className="text-foreground">공제 합계액 (De)</span>
                    <span className="font-mono text-red-400">{selectedPayslip.totalDeductions?.toLocaleString() || 0} 원</span>
                  </div>
                </div>
              </div>

              {/* Total Summary Frame */}
              <div className="bg-blue-600/15 border border-blue-500/20 p-5 rounded-3xl flex justify-between items-center">
                <div>
                  <p className="text-[10px] text-blue-500 font-extrabold tracking-widest uppercase">실수령액 (Net Pay)</p>
                  <p className="text-xs text-muted-foreground font-bold mt-1">지급액계 - 공제액계</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-blue-400 font-mono tracking-tight">{selectedPayslip.netPay?.toLocaleString() || 0} 원</p>
                </div>
              </div>
            </div>

            <div className="px-8 py-5 border-t border-border flex justify-end bg-muted/25 gap-2">
              <button 
                onClick={() => {
                  window.print();
                }} 
                className="h-12 px-6 rounded-2xl font-black bg-muted hover:bg-muted/80 text-foreground border border-border text-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1"
              >
                <Printer className="w-4 h-4" /> 명세서 인쇄
              </button>
              <button 
                onClick={() => setSelectedPayslip(null)} 
                className="h-12 px-8 rounded-2xl font-black bg-blue-600 hover:bg-blue-700 text-white text-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {payslipToDelete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl p-8 relative space-y-6 text-foreground text-center animate-in zoom-in-95 duration-250">
            <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-8 h-8 animate-bounce" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-foreground">급여명세서 영구 삭제</h3>
              <p className="text-sm text-muted-foreground break-keep">
                <strong>[{payslipToDelete.name}]</strong>님의 {selectedMonth} 급여 데이터를 안전 보관소 및 전산 시스템에서 영구적으로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
              </p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setPayslipToDelete(null)}
                className="flex-1 py-3.5 bg-muted rounded-xl font-black text-xs border border-border hover:bg-muted/80 transition-all text-muted-foreground"
              >
                취소
              </button>
              <button 
                onClick={confirmDeletePayslip}
                className="flex-1 py-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-xs shadow-lg shadow-rose-600/15 transition-all text-center"
              >
                명세서 삭제 실행
              </button>
            </div>
          </div>
        </div>
      )}
    </PCAdminLayout>
  );
};

export default PCAdminPayslip;
