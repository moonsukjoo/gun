import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { 
  FileBox, 
  Search, 
  Filter, 
  Calendar, 
  Download, 
  FileText, 
  Table as TableIcon,
  Users,
  ShieldCheck,
  ClipboardList,
  AlertTriangle,
  History,
  Building2,
  FileSpreadsheet,
  Clock,
  File as FileIcon,
  HeartPulse,
  Utensils,
  Coffee
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { exportToExcel, exportToPDF } from '../lib/exportUtils';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';
import PCAdminLayout from '../components/PCAdminLayout';

type ReportType = 'EMPLOYEES' | 'ATTENDANCE' | 'TRAINING' | 'STATUTORY_TRAINING' | 'LEAVE' | 'ACCIDENTS' | 'HEALTH' | 'EVACUATION' | 'REDEMPTION' | 'WORK_LOGS' | 'WORK_INSTRUCTIONS' | 'LUNCH' | 'SNACK';

const UnifiedReportCenter: React.FC = () => {
  const [reportType, setReportType] = useState<ReportType>('ATTENDANCE');
  const [dateRange, setDateRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });
  const [targetName, setTargetName] = useState('');
  const [targetDept, setTargetDept] = useState('ALL');
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchDepts = async () => {
      const snap = await getDocs(collection(db, 'departments'));
      setDepartments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchDepts();
  }, []);

  const handleExport = async (formatType: 'EXCEL' | 'PDF') => {
    setLoading(true);
    try {
      let data: any[] = [];
      let collectionName = '';
      let title = '';
      
      switch (reportType) {
        case 'ATTENDANCE':
          collectionName = 'attendance';
          title = '근태 관리 보고서';
          break;
        case 'EMPLOYEES':
          collectionName = 'users';
          title = '임직원 명부';
          break;
        case 'TRAINING':
          collectionName = 'trainingResults';
          title = '교육 이수 현황';
          break;
        case 'STATUTORY_TRAINING':
          collectionName = 'statutoryCompletions';
          title = '법정 정기안전교육 서명대장 보고서';
          break;
        case 'LEAVE':
          collectionName = 'leaveRequests';
          title = '연차/휴가 사용 내역';
          break;
        case 'ACCIDENTS':
          collectionName = 'accidentCases';
          title = '사고/아차사고 사례 보고';
          break;
        case 'HEALTH':
          collectionName = 'healthReports';
          title = '매일보건 관리 보고서';
          break;
        case 'EVACUATION':
          collectionName = 'evacuations';
          title = '비상 대피 통합 보고서';
          break;
        case 'REDEMPTION':
          collectionName = 'redemptionRequests';
          title = '포인트 환전/지급 내역';
          break;
        case 'WORK_LOGS':
          collectionName = 'personalWorkLogs';
          title = '전 사원 작업일지 현황';
          break;
        case 'WORK_INSTRUCTIONS':
          collectionName = 'workInstructionReports';
          title = '작업지시 및 점검일지 보고서';
          break;
        case 'LUNCH':
          collectionName = 'lunchRequests';
          title = '도시락 신청 내역 리포트';
          break;
        case 'SNACK':
          collectionName = 'snackRequests';
          title = '간식 신청 내역 리포트';
          break;
      }

    try {
      const q = query(collection(db, collectionName), limit(500));
      const snap = await getDocs(q);
      const events = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];

      if (reportType === 'EVACUATION') {
        const fullEvacuationData: any[] = [];
        
        // Fetch all users to know who is unconfirmed
        const usersSnap = await getDocs(collection(db, 'users'));
        const allUsers = usersSnap.docs.map(doc => doc.data());

        // Sort events by date descending
        const sortedEvents = [...events].sort((a,b) => (b.activatedAt || b.createdAt || '').localeCompare(a.activatedAt || a.createdAt || ''));

        for (const ev of sortedEvents) {
          // Filter event by date range
          const evDate = (ev.activatedAt || ev.createdAt || '').split('T')[0];
          if (!(evDate >= dateRange.start && evDate <= dateRange.end)) continue;

          // Fetch checkins for this event
          const checkinsSnap = await getDocs(collection(db, 'evacuations', ev.id, 'checkins'));
          const checkinsMap = new Map();
          checkinsSnap.docs.forEach(doc => {
            checkinsMap.set(doc.id, doc.data());
          });

          // Create a record for every user for this event
          allUsers.forEach((user: any) => {
            const checkin = checkinsMap.get(user.uid);
            fullEvacuationData.push({
              eventId: ev.id,
              eventReason: ev.reason,
              eventDate: evDate,
              activatedAt: ev.activatedAt || ev.createdAt,
              userName: user.displayName,
              deptName: user.departmentName || '-',
              position: user.position || '-',
              status: checkin ? '안전확인됨' : '미확인(대피중)',
              confirmedAt: checkin?.confirmedAt || checkin?.timestamp || checkin?.createdAt || '-',
              phoneNumber: user.phoneNumber || '-'
            });
          });
        }
        data = fullEvacuationData;
      } else {
        data = events;
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, collectionName);
    }

      // Apply Filters
      if (reportType !== 'EMPLOYEES') {
        data = data.filter(item => {
          const date = item.date || item.createdAt || item.activatedAt || item.startDate;
          if (!date) return true;
          const itemDate = date.includes('T') ? date.split('T')[0] : date;
          return itemDate >= dateRange.start && itemDate <= dateRange.end;
        });
      }

      if (targetName) {
        data = data.filter(item => {
          const name = item.userName || item.displayName || item.authorName || item.activatedByName || item.reportedBy || item.supervisorName || item.createdByName;
          let match = name?.toLowerCase().includes(targetName.toLowerCase());
          
          if (!match && item.workerInstructions) {
            match = item.workerInstructions.some((w: any) => 
              w.workerName?.toLowerCase().includes(targetName.toLowerCase())
            );
          }
          return match;
        });
      }

      if (targetDept !== 'ALL') {
        data = data.filter(item => {
          const deptId = item.departmentId || item.teamId;
          const deptName = item.departmentName || item.teamName;
          return deptId === targetDept || deptName === targetDept;
        });
      }

      if (data.length === 0) {
        toast.error('선택한 조건에 맞는 데이터가 없습니다.');
        return;
      }

      // Format Data for export
      const formattedData = formatDataForExport(reportType, data, formatType === 'PDF');

      if (formatType === 'EXCEL') {
        exportToExcel(formattedData, `${title}_${format(new Date(), 'yyyyMMdd')}`, 'Sheet1');
        toast.success('엑셀 다운로드가 시작되었습니다.');
      } else {
        const headers = Object.keys(formattedData[0]);
        const rows = formattedData.map(obj => Object.values(obj));
        await exportToPDF(title, headers, rows, `${title}_${format(new Date(), 'yyyyMMdd')}`);
        toast.success('PDF 리포트가 생성되었습니다.');
      }

    } catch (error) {
      console.error(error);
      toast.error('보고서 생성 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const formatDataForExport = (type: ReportType, rawData: any[], isPdf: boolean = false) => {
    const getName = (d: any) => d.userName || d.displayName || d.reportedBy || d.authorName || d.userName || '미기입';
    const formatDate = (dateStr: any) => {
      if (!dateStr) return '-';
      try {
        const date = new Date(dateStr);
        return format(date, 'yyyy-MM-dd');
      } catch {
        return dateStr;
      }
    };
    
    switch (type) {
      case 'ATTENDANCE':
        return rawData.map(d => {
          const formatTime = (timeStr: string | null) => {
            if (!timeStr) return '-';
            try {
              return format(new Date(timeStr), 'MM월 dd일 HH:mm');
            } catch {
              return timeStr;
            }
          };
          
          return {
            '날짜': d.date,
            '성명': getName(d),
            '출근시간': formatTime(d.clockIn),
            '퇴근시간': formatTime(d.clockOut),
            '상태': d.status === '정상' || d.status === 'PRESENT' ? '정상' : 
                   d.status === 'LATE' ? '지각' : 
                   d.status === 'EARLY_LEAVE' ? '조퇴' : 
                   d.status === 'ABSENT' ? '결근' : 
                   d.status === 'OFF' ? '휴무' :
                   d.status === 'VACATION' ? '휴가' :
                   d.status === 'LEAVE' ? '휴가/영가' :
                   d.status || '-',
            '메모': d.memo || ''
          };
        });
      case 'EMPLOYEES':
        return rawData.map(d => ({
          '사번': d.employeeId,
          '성명': d.displayName,
          '부서': d.departmentName || '-',
          '직급': d.position || '-',
          '직종': d.jobRole || '-',
          '연락처': d.phoneNumber || '-',
          '입사일': d.joinedAt || (d.createdAt ? formatDate(d.createdAt) : '-')
        }));
      case 'HEALTH':
        return rawData.map(d => ({
          '날짜': d.date,
          '부서': d.teamName || d.departmentName || '-',
          '보고자': getName(d),
          '상태': d.status === 'NORMAL' ? '이상없음' : d.status === 'ISSUE' ? '특이사항' : d.status === 'GOOD' ? '좋음' : d.status === 'BAD' ? '나쁨' : d.status || '-',
          '내용': d.content || '-'
        }));
      case 'ACCIDENTS':
        return rawData.map(d => ({
          '날짜': d.date,
          '제목': d.title,
          '장소': d.location,
          '위험도': d.severity === 'HIGH' ? '중대' : d.severity === 'MEDIUM' ? '경미' : d.severity === 'LOW' ? '아차' : d.severity,
          '유형': d.type === 'SAFE' ? '아차사고' : d.type === 'ACCIDENT' ? '사고' : d.type,
          '보고자': getName(d)
        }));
      case 'TRAINING':
        return rawData.map(d => ({
          '교육명': d.trainingTitle,
          '성명': getName(d),
          '점수': d.score,
          '합격여부': d.isPassed ? '합격' : '불합격',
          '완료일': d.completedAt ? format(new Date(d.completedAt), 'yyyy-MM-dd HH:mm') : '-'
        }));
      case 'STATUTORY_TRAINING':
        return rawData.map(d => ({
          '교육기수': `${d.year || ''}년도 ${d.month || ''}월 (회차: ${d.round || '1'}회)`,
          '교육 카테고리': d.category || '-',
          '사원 성명': d.userName || d.displayName || '-',
          '소속 부서': d.departmentName || d.teamName || '-',
          '직급': d.position || '-',
          '직책/권한': d.userRole === 'TEAM_LEADER' ? '팀장/조장' : '사원/기공',
          '이수 완료 시각': d.completedAt ? d.completedAt.replace('T', ' ').substring(0, 16) : '-',
          '수기 서명 상태': isPdf ? (d.signatureUrl || '') : (d.signatureUrl ? '자필서명득' : '미날인')
        }));
      case 'LEAVE':
        return rawData.map(d => ({
          '성명': getName(d),
          '유형': d.type === 'ANNUAL' ? '연차' : d.type === 'SICK' ? '병가' : d.type === 'REWARD' ? '포상' : d.type === 'EXTRA' ? '보강' : d.type,
          '시작일': d.startDate,
          '종료일': d.endDate,
          '사유': d.reason,
          '상태': d.status === 'APPROVED' ? '승인완료' : d.status === 'PENDING' ? '대기중' : d.status === 'REJECTED' ? '반려됨' : d.status
        }));
      case 'WORK_LOGS':
        return rawData.map(d => {
          const totalLoggedHours = d.tasks?.reduce((sum: number, t: any) => sum + parseFloat(t.hours || '0'), 0) || 0;
          return {
            '날짜': d.date,
            '성명': getName(d),
            '부서': d.departmentName || '-',
            '업무내용': d.tasks?.map((t: any) => t.content).join(', ') || '',
            '총시간': totalLoggedHours,
            '본인 서명': isPdf ? (d.workerSignUrl || '') : (d.workerSignUrl ? '서명완료' : '미서명'),
            '승인자(조직장)': d.approvedByLeaderName || d.approvedByFinalName || d.approvedByName || '-',
            '상태': d.status === 'FINAL_APPROVED' ? '최종승인' : d.status === 'LEADER_APPROVED' ? '조직장승인' : '검토중'
          };
        });
      case 'WORK_INSTRUCTIONS':
        {
          const flattened: any[] = [];
          rawData.forEach(d => {
            if (d.workerInstructions && d.workerInstructions.length > 0) {
              d.workerInstructions.forEach((w: any) => {
                flattened.push({
                  '날짜': d.date,
                  '부서(팀명)': d.teamName || '-',
                  '관리감독자': d.supervisorName || '-',
                  '감독자 서명': isPdf ? (d.supervisorSignUrl || '') : (d.supervisorSignUrl ? '서명완료' : '미서명'),
                  '안전책임자': d.safetyManagerName || '김주영',
                  '책임자 서명': isPdf ? (d.safetyManagerSignUrl || '') : (d.safetyManagerSignUrl ? '서명완료' : '미서명'),
                  '작업자': w.workerName || '-',
                  '지시내용': w.instruction || '-',
                  '건강상태': w.healthStatus || 'NORMAL',
                  '작업시간': `${w.startTime || ''} ~ ${w.endTime || '--:--'}`,
                  '작업 전 서명': isPdf ? (w.signBeforeUrl || '') : (w.signBeforeUrl ? '서명완료' : '미서명'),
                  '작업 후 서명': isPdf ? (w.signAfterUrl || '') : (w.signAfterUrl ? '서명완료' : '미서명'),
                  'TBM 핵심내용': d.tbmContent || '-'
                });
              });
            } else {
              flattened.push({
                '날짜': d.date,
                '부서(팀명)': d.teamName || '-',
                '관리감독자': d.supervisorName || '-',
                '감독자 서명': isPdf ? (d.supervisorSignUrl || '') : (d.supervisorSignUrl ? '서명완료' : '미서명'),
                '안전책임자': d.safetyManagerName || '김주영',
                '책임자 서명': isPdf ? (d.safetyManagerSignUrl || '') : (d.safetyManagerSignUrl ? '서명완료' : '미서명'),
                '작업자': '-',
                '지시내용': '-',
                '건강상태': '-',
                '작업시간': '-',
                '작업 전 서명': '-',
                '작업 후 서명': '-',
                'TBM 핵심내용': d.tbmContent || '-'
              });
            }
          });
          return flattened;
        }
      case 'LUNCH':
        return rawData.map(d => ({
          '성명': getName(d),
          '신청일': d.createdAt ? formatDate(d.createdAt) : '-',
          '시작일': d.startDate,
          '종료일': d.endDate,
          '상태': d.status === 'APPROVED' ? '승인완료' : d.status === 'PENDING' ? '대기중' : d.status === 'REJECTED' ? '반려됨' : d.status,
          '승인자': d.approvedByName || '-'
        }));
      case 'SNACK':
        return rawData.map(d => ({
          '성명': getName(d),
          '신청일': d.createdAt ? formatDate(d.createdAt) : '-',
          '수량': d.quantity,
          '배송희망일': d.deliveryDate,
          '상태': d.status === 'APPROVED' ? '확정완료' : d.status === 'PENDING' ? '대기중' : d.status === 'REJECTED' ? '반려됨' : d.status,
          '승인자': d.approvedByName || '-'
        }));
      case 'EVACUATION':
        return rawData.map(d => ({
          '발동일자': d.eventDate,
          '비상사유': d.eventReason,
          '성명': d.userName,
          '부서': d.deptName,
          '직급': d.position,
          '생존확인상태': d.status,
          '확인시각': d.confirmedAt === '-' ? '-' : format(new Date(d.confirmedAt), 'HH:mm:ss'),
          '연락처': d.phoneNumber
        }));
      case 'REDEMPTION':
        return rawData.map(d => ({
          '날짜': formatDate(d.createdAt),
          '성명': getName(d),
          '포인트': d.points,
          '상태': d.status === 'COMPLETED' ? '지급완료' : '대기'
        }));
      default:
        return rawData;
    }
  };

  const menuItems = [
    { id: 'ATTENDANCE', label: '근태 보고서', icon: Clock, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { id: 'EMPLOYEES', label: '임직원 명부', icon: Users, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { id: 'HEALTH', label: '매일보건 관리', icon: HeartPulse, color: 'text-rose-500', bg: 'bg-rose-500/10' },
    { id: 'ACCIDENTS', label: '사고/안전 사례', icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { id: 'TRAINING', label: '교육 이수 현황', icon: ClipboardList, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
    { id: 'STATUTORY_TRAINING', label: '법정 안전이수 대장', icon: ShieldCheck, color: 'text-rose-600', bg: 'bg-rose-500/10' },
    { id: 'LEAVE', label: '연차/휴가 내역', icon: Calendar, color: 'text-pink-500', bg: 'bg-pink-500/10' },
    { id: 'EVACUATION', label: '비상 대피 이력', icon: History, color: 'text-slate-500', bg: 'bg-slate-500/10' },
    { id: 'REDEMPTION', label: '포인트 환전', icon: FileText, color: 'text-violet-500', bg: 'bg-violet-500/10' },
    { id: 'WORK_LOGS', label: '작업일지 관리', icon: ClipboardList, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
    { id: 'WORK_INSTRUCTIONS', label: '작업지시서 관리', icon: FileText, color: 'text-sky-500', bg: 'bg-sky-500/10' },
    { id: 'LUNCH', label: '도시락 신청 내역', icon: Utensils, color: 'text-orange-400', bg: 'bg-orange-500/10' },
    { id: 'SNACK', label: '간식 신청 내역', icon: Coffee, color: 'text-pink-400', bg: 'bg-pink-100/10' },
  ];

  const location = useLocation();
  const isPC = location.pathname.startsWith('/admin/pc');
  const innerContent = (
    <div className="p-2 space-y-6 pb-24">
      {/* Header */}
        <header className="flex flex-col gap-1 px-4 py-6 relative overflow-hidden bg-muted/20 rounded-[2.5rem] border border-border shadow-2xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-10 -mt-10" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
              <FileBox className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-0.5">Corporate Intelligence</p>
              <h2 className="text-2xl font-black text-foreground tracking-tight">통합 보고서 시스템</h2>
            </div>
          </div>
        </header>

        {/* Report Type Selector */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => setReportType(item.id as ReportType)}
              className={cn(
                "p-4 rounded-[2rem] border transition-all flex flex-col items-center gap-3 group active:scale-95",
                reportType === item.id 
                  ? "bg-muted border-primary shadow-xl shadow-black/10 scale-[1.02]" 
                  : "bg-card border-border hover:bg-muted/50"
              )}
            >
              <div className={cn(
                "w-12 h-12 flex items-center justify-center rounded-2xl transition-transform group-hover:scale-110",
                item.bg,
                reportType === item.id ? "shadow-lg shadow-black/10" : ""
              )}>
                <item.icon className={cn("w-6 h-6", item.color)} />
              </div>
              <span className={cn(
                "text-xs font-black transition-colors leading-tight text-center",
                reportType === item.id ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
              )}>
                {item.label}
              </span>
            </button>
          ))}
        </div>

        {/* Filters Card */}
        <Card className="bg-card border-border rounded-[2rem] overflow-hidden">
          <CardHeader className="p-6 border-b border-border bg-muted/30">
            <CardTitle className="text-sm font-black text-foreground flex items-center gap-2">
              <Filter className="w-4 h-4 text-primary" />
              보고서 상세 조건 설정
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6 text-foreground">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Date Filters */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">조회 기간 (시작)</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/30" />
                    <Input 
                      type="date"
                      value={dateRange.start}
                      onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                      className="bg-background border-border h-12 pl-12 rounded-xl text-foreground font-bold"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">조회 기간 (종료)</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/30" />
                    <Input 
                      type="date"
                      value={dateRange.end}
                      onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                      className="bg-background border-border h-12 pl-12 rounded-xl text-foreground font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Name & Dept Filters */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">대상 성명 (검색어)</label>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/30" />
                    <Input 
                      placeholder="성명 검색..."
                      value={targetName}
                      onChange={(e) => setTargetName(e.target.value)}
                      className="bg-background border-border h-12 pl-12 rounded-xl text-foreground font-bold placeholder:text-muted-foreground/10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">대상 부서/팀</label>
                  <Select value={targetDept} onValueChange={setTargetDept}>
                    <SelectTrigger className="bg-background border-border h-12 rounded-xl text-foreground font-bold text-xs ring-0">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-muted-foreground/30" />
                        <SelectValue placeholder="전체 부서" />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-foreground">
                      <SelectItem value="ALL">전체 부서</SelectItem>
                      {departments.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row gap-3">
              <Button 
                onClick={() => handleExport('EXCEL')}
                disabled={loading}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl h-14 gap-2 text-base transition-all active:scale-95"
              >
                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FileSpreadsheet className="w-6 h-6" />}
                Excel 추출하기
              </Button>
              <Button 
                onClick={() => handleExport('PDF')}
                disabled={loading}
                variant="outline"
                className="flex-1 border-border bg-muted hover:bg-muted/80 text-foreground font-black rounded-2xl h-14 gap-2 text-base transition-all active:scale-95"
              >
                {loading ? <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /> : <FileText className="w-6 h-6 text-rose-500" />}
                PDF 리포트 생성
              </Button>
            </div>
            
            <div className="mt-4 p-4 bg-primary/5 rounded-2xl border border-primary/10 flex gap-3">
              <FileIcon className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-black text-foreground uppercase tracking-tight">보고서 생성 안내</p>
                <p className="text-[10px] font-bold text-muted-foreground leading-relaxed">
                  필터링 조건에 따라 최대 500건의 데이터를 추출합니다. 데이터가 많은 경우 기간을 좁게 설정하여 추출해 주세요.
                  성명 및 부서 필터는 선택 사항이며, 입력 시 해당 조건에 맞는 데이터만 포함됩니다.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
  );

  if (isPC) {
    return (
      <PCAdminLayout title="통합 보고서 센터">
        <div className="max-w-[1600px] mx-auto">
          {innerContent}
        </div>
      </PCAdminLayout>
    );
  }

  return innerContent;
};

export default UnifiedReportCenter;
