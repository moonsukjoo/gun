import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Download, 
  Award, 
  Calendar, 
  AlertTriangle,
  TrendingUp,
  BookOpen,
  CheckCircle2,
  Clock,
  Printer,
  Edit,
  Plus,
  Users,
  Video,
  Send,
  FileCheck
} from 'lucide-react';
import { collection, onSnapshot, updateDoc, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import PCAdminLayout from '../components/PCAdminLayout';
import { toast } from 'sonner';
import { UserProfile, StatutorySession, StatutoryCompletion } from '../types';
import * as XLSX from 'xlsx';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';

interface TrainingRecord {
  id: string;
  userName: string;
  userRole: string;
  courseName: string;
  completionDate: string;
  expiryDate: string;
  status: 'valid' | 'expiring' | 'expired';
  score: number;
  instructor: string;
}

const PCAdminTraining: React.FC = () => {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'REGULAR' | 'STATUTORY'>('REGULAR');

  // Regular Trainings (Original records)
  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Statutory Trainings states
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [statutorySessions, setStatutorySessions] = useState<StatutorySession[]>([]);
  const [statutoryCompletions, setStatutoryCompletions] = useState<StatutoryCompletion[]>([]);
  const [statutoryCategories, setStatutoryCategories] = useState<string[]>([
    '현장안전 교육',
    '영상안전보건 교육',
    '월간 위험성평가 교육',
    '특별안전 교육',
    '신규입사자 교육'
  ]);
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Filter states
  const [statutoryYear, setStatutoryYear] = useState<number>(new Date().getFullYear());
  const [statutoryMonth, setStatutoryMonth] = useState<number>(new Date().getMonth() + 1);
  const [statutoryRound, setStatutoryRound] = useState<number>(1);
  const [statutoryCategory, setStatutoryCategory] = useState<string>('현장안전 교육');
  const [statutoryDept, setStatutoryDept] = useState<string>('전체');

  // Edit session dialog
  const [isEditSessionOpen, setIsEditSessionOpen] = useState(false);
  const [isDeleteSessionOpen, setIsDeleteSessionOpen] = useState(false);
  const [editingSession, setEditingSession] = useState({
    title: '',
    instructor: '',
    location: '',
    videoUrl: '',
    content: '',
    imageUrl: '',
    durationMinutes: 60,
    trainingMethod: 'ONSITE',
    trainingDate: new Date().toISOString().split('T')[0],
    allowedUids: [] as string[]
  });

  // Create session dialog
  const [isCreateSessionOpen, setIsCreateSessionOpen] = useState(false);
  const [createSessionForm, setCreateSessionForm] = useState({
    title: '',
    category: '현장안전 교육',
    durationMinutes: 60,
    trainingMethod: 'ONSITE', // ONSITE or ONLINE
    instructor: '문석주 (안전관리자)',
    location: '탈의실',
    videoUrl: '',
    content: '',
    imageUrl: '',
    trainingDate: new Date().toISOString().split('T')[0],
    allowedUids: [] as string[]
  });

  // Search and workplace filters for target user selection (Create modal)
  const [createSearchQuery, setCreateSearchQuery] = useState('');
  const [createWorkplaceFilter, setCreateWorkplaceFilter] = useState('ALL');

  // Search and workplace filters for target user selection (Edit modal)
  const [editSearchQuery, setEditSearchQuery] = useState('');
  const [editWorkplaceFilter, setEditWorkplaceFilter] = useState('ALL');

  const getCategorySuffix = (cat: string) => {
    if (cat.includes('현장')) return 'onsite';
    if (cat.includes('영상')) return 'video';
    if (cat.includes('위험성')) return 'risk';
    if (cat.includes('특별')) return 'special';
    if (cat.includes('신규')) return 'newhire';
    return cat.replace(/[^a-zA-Z0-9가-힣]/g, '').substring(0, 12);
  };

  const currentSessionId = `${statutoryYear}_${String(statutoryMonth).padStart(2, '0')}_${statutoryRound}_${getCategorySuffix(statutoryCategory)}_${statutoryDept || '전체'}`;
  const matchedSession = statutorySessions.find(s => s.id === currentSessionId);

  useEffect(() => {
    // 1. Fetch regular training records
    const unsubRecords = onSnapshot(collection(db, 'trainingRecords'), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TrainingRecord));
      setRecords(data);
      setLoading(false);
    }, (error) => {
      console.error(error);
      setLoading(false);
    });

    // 2. Fetch all users for statutory table
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    // 3. Fetch statutory sessions
    const unsubStatSessions = onSnapshot(collection(db, 'statutorySessions'), (snap) => {
      setStatutorySessions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as StatutorySession)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'statutorySessions');
    });

    // 4. Fetch statutory completions
    const unsubComps = onSnapshot(collection(db, 'statutoryCompletions'), (snap) => {
      setStatutoryCompletions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as StatutoryCompletion)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'statutoryCompletions');
    });

    // 5. Fetch statutory categories
    const unsubCats = onSnapshot(collection(db, 'statutoryCategories'), (snap) => {
      const defaults = ['현장안전 교육', '영상안전보건 교육', '월간 위험성평가 교육', '특별안전 교육', '신규입사자 교육'];
      if (!snap.empty) {
        const fetched = snap.docs.map(doc => doc.data().name as string);
        const unique = Array.from(new Set([...defaults, ...fetched]));
        setStatutoryCategories(unique);
      } else {
        setStatutoryCategories(defaults);
      }
    }, (error) => {
      console.warn('Error listening to statutoryCategories (using elegant defaults):', error);
      const defaults = ['현장안전 교육', '영상안전보건 교육', '월간 위험성평가 교육', '특별안전 교육', '신규입사자 교육'];
      setStatutoryCategories(defaults);
    });

    return () => {
      unsubRecords();
      unsubUsers();
      unsubStatSessions();
      unsubComps();
      unsubCats();
    };
  }, []);

  // Seeding regular fallbacks if collection empty
  useEffect(() => {
    if (!loading && records.length === 0) {
      setRecords([
        { id: '1', userName: '장동건', userRole: 'A공구 팀장', courseName: '2025년 상반기 고소작업 안전교육', completionDate: '2025-03-15', expiryDate: '2026-03-15', status: 'valid', score: 95, instructor: '이건명' },
        { id: '2', userName: '이순신', userRole: 'B공구 조장', courseName: '신규 입사자 기초 안전 보건 교육', completionDate: '2025-04-10', expiryDate: '2026-04-10', status: 'valid', score: 100, instructor: '김관리' },
        { id: '3', userName: '강감찬', userRole: 'C공구 기공', courseName: '밀폐 공간 작업 특별 안전 교육', completionDate: '2025-05-20', expiryDate: '2026-05-20', status: 'expiring', score: 88, instructor: '최안전' },
        { id: '4', userName: '을지문덕', userRole: '현장 지원', courseName: '응급처치 및 심폐소생술 교육', completionDate: '2025-01-10', expiryDate: '2026-01-10', status: 'expired', score: 92, instructor: '정의료' },
      ]);
    }
  }, [loading, records]);

  // Compute active workers in filter parameters
  const filteredWorkers = users.filter(u => {
    if (!u.isActive) return false;
    if (statutoryDept === '전체') return true;
    return u.departmentName === statutoryDept || u.jobRole === statutoryDept;
  });

  const completedCount = filteredWorkers.filter(u => 
    statutoryCompletions.some(c => c.uid === u.uid && c.sessionId === currentSessionId)
  ).length;

  const absentWorkers = filteredWorkers.filter(u => 
    !statutoryCompletions.some(c => c.uid === u.uid && c.sessionId === currentSessionId)
  );

  // Open Create Session modal with pre-filled default data
  const handleOpenCreateSession = () => {
    const titleText = `${statutoryMonth}월 ${statutoryRound}회차 법정 정기 ${statutoryCategory}`;
    const defaultContent = statutoryCategory === '현장안전 교육' 
      ? `### 현장 밀폐구역 작업 안전 지침 및 통제 요령\n\n조선소 야드 내 탱크(Tank), 이중저(Double Bottom), 보이드 스페이스(Void Space) 등 밀폐구역은 산소 결핍 및 가스 인화로 인한 대형 재해 위험도가 극도로 빈번합니다.\n\n**[핵심 통제대책 및 행동 지침]**\n1. **산소 및 유해가스 농도 상시 계측**: 밀폐지대 출입구에서 센서 측정 장비를 완벽히 가동하여 산소 농도 18% 이상, 황화수소 10ppm 미만을 기록 계측하십시오.\n2. **강제 환기 펜 연속 기동**: 고효율 배풍기와 가요성 덕트를 깊게 안착시켜 정체된 흄과 먼지를 즉시 배기 하십시오.\n3. **투입 상시 무전 감시자 현장 배치**: 밀폐구역 맨홀 웰 바깥에 비상 대기용 마스크를 견지한 1명 이상의 감시인을 기공들과 상시 유지하십시오.`
      : statutoryCategory === '영상안전보건 교육'
      ? `### 시청각 안전 보건 및 보호구 핵심 착용법 교육\n\n조선업 10대 기본 철칙 및 주요 추락 전도 충돌 협착 중점 예방을 시청하며 생명권을 파악하는 필수 단과 영상 코스입니다.\n\n**[영상 핵심 학습 수칙]**\n- **안전 버클 턱끈 밀착**: 사소한 턱끈 풀림이 머리 뇌 외상을 수반합니다. 귀 주위 통풍 루프를 타이트하게 고정하십시오.\n- **안전대 하네스 2구 고리 체결**: 2m 이상의 블록 연도 가설 고소작업 시 항시 와이어 하네스를 신뢰성 있는 볼트 지지 고리에 선조치 체결할 것.\n- **방진 가스 마스크 흡기 밸브 점검**: 그라인딩 사상 분진 노출 즉시 전용 카트리지를 확인 후 조임 스트랩 밀봉 교정.`
      : statutoryCategory === '특별안전 교육'
      ? `### 크레인 및 중량물 특수취급 특별안전 교육\n\n갠트리 크레인 공동 작업 및 대형 선박 블록 인양, 지상 반경 붕괴/협착 위험 요소를 통제하기 위한 집중 교육입니다.\n\n**[중점 작업 통제 대책]**\n1. **인양 반경 출입 통제**: 와이어 인양 중에는 무조건 반경 30m 내 무단 유입을 금지하며 적색 경고 라인을 가동합니다.\n2. **공동 인양 무전 일원화**: 지정된 1인 메인 신호수의 무전 지시에만 슬링 고리원들이 일괄 동조해야 합니다.\n3. **줄걸이용 슬링벨트 상시 점검**: 매 작업 전 고리의 균열 및 벨트 강성 등을 점검하십시오.`
      : statutoryCategory === '신규입사자 교육'
      ? `### 신규 입사자 기초 안전 보건 교육\n\n조선 생산 거점에 신규 배치된 사원들이 숙지해야 할 현장 10대 수칙 및 비상 대피 요령 교육입니다.\n\n**[기초 실천 수칙]**\n1. **현장 보호구 표준 완벽 착용**: 안전모 턱끈 조임, 방진마스크 밀착, 안전화 상시 착용을 생활화하십시오.\n2. **비상 대피로 및 모임 장소 확인**: 비상 사이렌 취명 시 유도로를 통해 안전 구역으로 신속 대피하십시오.\n3. **안전 불감증 배척**: 사소한 유해요소도 보고하여 아차사고를 미연에 원천 봉쇄하십시오.`
      : `### 갠트리 크레인 중량물 인양 반경 신호 수칙 위험성 평가\n\n초대형 선박 메가 블록 크레인 작업 구역의 붕괴, 불시기 낙하, 러깅 러그 파단 위해성에 대한 긴급 등급화 평가 교육안입니다.\n\n**[위험 특성 및 대책]**\n- **가해 요인**: 중량 인양물 유동 및 슬링 와이어 장력 이탈 피해서 낙하.\n- **위험도 등급**: 발생 대개 낮음, 사고시 치명 결과 (중대재해).\n- **현장 통제 조치**: 장비 중량 계측 기기 교정, 인양 가이드 통일 수신호 및 전용 무전 7채널 고정 준수. 반경 25미터 안전 옐로우 안전 테이프 바리케이트 설정.`;

    setCreateSessionForm({
      title: titleText,
      category: statutoryCategory,
      durationMinutes: 60,
      trainingMethod: 'ONSITE',
      instructor: '문석주 (안전관리자)',
      location: '탈의실',
      videoUrl: '',
      content: defaultContent,
      imageUrl: '',
      trainingDate: new Date().toISOString().split('T')[0],
      allowedUids: []
    });
    setCreateSearchQuery('');
    setCreateWorkplaceFilter('ALL');
    setIsCreateSessionOpen(true);
  };

  // Submit dynamic session creation 
  const handleSaveNewSession = async () => {
    const targetId = `${statutoryYear}_${String(statutoryMonth).padStart(2, '0')}_${statutoryRound}_${getCategorySuffix(createSessionForm.category)}_${statutoryDept || '전체'}`;
    const newSession: StatutorySession = {
      id: targetId,
      title: createSessionForm.title,
      year: statutoryYear,
      month: statutoryMonth,
      round: statutoryRound,
      category: createSessionForm.category,
      content: createSessionForm.content,
      imageUrl: createSessionForm.imageUrl || '',
      targetDepartment: statutoryDept,
      instructor: createSessionForm.instructor,
      location: createSessionForm.location,
      videoUrl: createSessionForm.videoUrl,
      durationMinutes: createSessionForm.durationMinutes,
      trainingMethod: createSessionForm.trainingMethod,
      trainingDate: createSessionForm.trainingDate,
      createdAt: new Date().toISOString(),
      allowedUids: createSessionForm.allowedUids || []
    };

    try {
      await setDoc(doc(db, 'statutorySessions', targetId), newSession);
      setIsCreateSessionOpen(false);
      toast.success(`${statutoryMonth}월 ${statutoryRound}회차 ${createSessionForm.category} 교육 세션이 타겟 부서(${statutoryDept})용으로 성공적으로 등록되었습니다.`);
    } catch (e) {
      toast.error('세션 생성에 실패하였습니다.');
    }
  };

  // Open edit modal
  const handleOpenEditSession = () => {
    if (!matchedSession) return;
    setEditingSession({
      title: matchedSession.title,
      instructor: matchedSession.instructor,
      location: matchedSession.location,
      videoUrl: matchedSession.videoUrl || '',
      content: matchedSession.content,
      imageUrl: matchedSession.imageUrl || '',
      durationMinutes: matchedSession.durationMinutes || 60,
      trainingMethod: matchedSession.trainingMethod || 'ONSITE',
      trainingDate: matchedSession.trainingDate || new Date().toISOString().split('T')[0],
      allowedUids: matchedSession.allowedUids || []
    });
    setEditSearchQuery('');
    setEditWorkplaceFilter('ALL');
    setIsEditSessionOpen(true);
  };

  // Save session details
  const handleSaveSession = async () => {
    if (!matchedSession) return;
    try {
      await updateDoc(doc(db, 'statutorySessions', matchedSession.id), {
        title: editingSession.title,
        instructor: editingSession.instructor,
        location: editingSession.location,
        videoUrl: editingSession.videoUrl,
        content: editingSession.content,
        imageUrl: editingSession.imageUrl || '',
        durationMinutes: editingSession.durationMinutes,
        trainingMethod: editingSession.trainingMethod,
        trainingDate: editingSession.trainingDate,
        allowedUids: editingSession.allowedUids || []
      });
      setIsEditSessionOpen(false);
      toast.success('법정 교육 계획안 및 지도 강사인적 요강 수정 등록이 성공적으로 마감되었습니다.');
    } catch (e) {
      toast.error('세션 조정 실패.');
    }
  };

  // Delete session
  const handleDeleteSession = () => {
    if (!matchedSession) return;
    setIsDeleteSessionOpen(true);
  };

  const handleConfirmDeleteSession = async () => {
    if (!matchedSession) return;
    try {
      await deleteDoc(doc(db, 'statutorySessions', matchedSession.id));
      setIsDeleteSessionOpen(false);
      toast.success('해당 법정 의무 교육 일정이 성공적으로 전면 삭제 처리되었습니다.');
    } catch (e) {
      console.error(e);
      toast.error('세션 삭제 실패.');
    }
  };

  const handleAddNewCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error('카테고리명을 입력해주십시오.');
      return;
    }
    const catNameNormalized = newCategoryName.trim();
    if (statutoryCategories.includes(catNameNormalized)) {
      toast.error('이미 존재하는 법정교육 카테고리입니다.');
      return;
    }
    const catDocId = catNameNormalized.replace(/[^a-zA-Z0-9가-힣]/g, '');
    try {
      await setDoc(doc(db, 'statutoryCategories', catDocId), {
        name: catNameNormalized,
        createdAt: new Date().toISOString()
      });
      setNewCategoryName('');
      setIsAddCategoryOpen(false);
      toast.success(`새 법정교육 카테고리 [${catNameNormalized}]가 성공적으로 추가 등록되었습니다.`);
    } catch (e) {
      console.error(e);
      toast.error('카테고리 등록에 실패하였습니다.');
    }
  };

  // Notify Absentees (Alert Triggering)
  const handleNotifyAbsentees = async () => {
    if (absentWorkers.length === 0) {
      toast.success('본 회차 안전 교육을 해당 부서 모든 인원이 이수하였습니다.');
      return;
    }

    try {
      for (const abs of absentWorkers) {
        const notifId = `notice_stat_${currentSessionId}_${abs.uid}`;
        const bodyMsg = `${abs.displayName}님, [${statutoryMonth}월 ${statutoryRound}회차 ${statutoryCategory}] 의무 교육이 불참(미이수) 상태입니다. 안전관리본부 정기 보고서 날인을 위해 즉시 교육 수강 후 모바일 서명을 마쳐주십시오.`;
        
        await setDoc(doc(db, 'notifications', notifId), {
          id: notifId,
          uid: abs.uid,
          title: '🚨 법정 안전교육 불참에 따른 이행 강제 촉구',
          message: bodyMsg,
          body: bodyMsg,
          type: 'SYSTEM',
          isRead: false,
          status: 'UNREAD',
          createdAt: new Date().toISOString()
        });
      }
      toast.success(`미참가 인원 (${absentWorkers.length}명)에게 직권 수강명령 모바일 푸시 알람을 즉극 전파하였습니다.`);
    } catch (e) {
      console.error(e);
      toast.error('전송 중 통신 네트워크 결함이 감지되었습니다.');
    }
  };

  // Export excel
  const handleExportExcel = () => {
    if (filteredWorkers.length === 0) {
      toast.warning('목록 대상 인원이 전혀 존재하지 않습니다.');
      return;
    }

    const reportRows = filteredWorkers.map((u, i) => {
      const comp = statutoryCompletions.find(c => c.uid === u.uid && c.sessionId === currentSessionId);
      return {
        '순번': i + 1,
        '부서명': u.departmentName || u.jobRole || '기타',
        '직급': u.position || '사원',
        '성명': u.displayName,
        '사원번호': u.employeeId || '',
        '이수현황': comp ? '이수완료' : '불참자 (재교육 필요)',
        '이수날짜/서명상태': comp ? comp.completedAt.replace('T', ' ').substring(0, 16) : '미이수'
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(reportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '법정이수서명부');
    XLSX.writeFile(workbook, `법정교육수강합격부_${statutoryYear}_${statutoryMonth}월_${statutoryRound}회차_${statutoryDept}.xlsx`);
    toast.success('Microsoft Excel 양식 명백 인쇄 완료');
  };

  // Export excel by splitting categories into sheets (모든 법정교육 카테고리를 개별 시트로 분리배치)
  const handleExportAllCategoriesExcel = () => {
    if (filteredWorkers.length === 0) {
      toast.warning('목록 대상 인원이 전혀 존재하지 않습니다.');
      return;
    }

    const workbook = XLSX.utils.book_new();

    statutoryCategories.forEach((cat) => {
      const suffix = getCategorySuffix(cat);
      const tempSessionId = `${statutoryYear}_${String(statutoryMonth).padStart(2, '0')}_${statutoryRound}_${suffix}_${statutoryDept || '전체'}`;
      const tempSession = statutorySessions.find(s => s.id === tempSessionId);

      const targetWorkers = tempSession?.category === '신규입사자 교육' && tempSession?.allowedUids?.length
        ? users.filter(u => tempSession.allowedUids!.includes(u.uid))
        : filteredWorkers;

      const reportRows = targetWorkers.map((u, i) => {
        const comp = statutoryCompletions.find(c => c.uid === u.uid && c.sessionId === tempSessionId);
        return {
          '순번': i + 1,
          '부서명': u.departmentName || u.jobRole || '기타',
          '직급': u.position || '사원',
          '성명': u.displayName,
          '사원번호': u.employeeId || '',
          '이수현황': comp ? '이수완료' : '불참자 (재교육 필요)',
          '이수날짜/서명상태': comp ? comp.completedAt.replace('T', ' ').substring(0, 16) : '미이수'
        };
      });

      // Sheet name limit is 31 chars in Excel. Clean special characters and slice to 30.
      const sheetName = cat.replace(/[\[\]\*\?\\\/: ]/g, '').substring(0, 30);
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(reportRows), sheetName || '미분류');
    });

    XLSX.writeFile(workbook, `법정교육_카테고리별합격대장_${statutoryYear}_${statutoryMonth}월_${statutoryRound}회차_${statutoryDept}.xlsx`);
    toast.success('카테고리별 시트 분할 Excel 대장 다운로드 성공');
  };

  // Print all statutory categories sequentially with page breaks
  const handlePrintAllCategoriesPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('인쇄를 위한 공람 팝업이 브라우저에서 차단되었습니다.');
      return;
    }

    let allPagesHtml = '';

    statutoryCategories.forEach((cat, idx) => {
      const suffix = getCategorySuffix(cat);
      const tempSessionId = `${statutoryYear}_${String(statutoryMonth).padStart(2, '0')}_${statutoryRound}_${suffix}_${statutoryDept || '전체'}`;
      const tempSession = statutorySessions.find(s => s.id === tempSessionId);

      const targetWorkers = tempSession?.category === '신규입사자 교육' && tempSession?.allowedUids?.length
        ? users.filter(u => tempSession.allowedUids!.includes(u.uid))
        : filteredWorkers;

      const completedCountTemp = targetWorkers.filter(u => 
        statutoryCompletions.some(c => c.uid === u.uid && c.sessionId === tempSessionId)
      ).length;

      const absentWorkersTemp = targetWorkers.filter(u => 
        !statutoryCompletions.some(c => c.uid === u.uid && c.sessionId === tempSessionId)
      );

      let rowsHtml = '';
      targetWorkers.forEach((u, i) => {
        const comp = statutoryCompletions.find(c => c.uid === u.uid && c.sessionId === tempSessionId);
        const signatureImg = comp 
          ? `<img src="${comp.signatureUrl}" style="height: 32px; max-width: 80px; object-fit: contain;" />` 
          : '<span style="color: #ef4444; font-weight: 900; font-size: 11px;">※ 불참 (재교육 대상)</span>';
        
        const evalSignatureImg = comp?.evalSignatureUrl
          ? `<img src="${comp.evalSignatureUrl}" style="height: 32px; max-width: 80px; object-fit: contain;" />`
          : comp
            ? '<span style="color: #ea580c; font-weight: bold; font-size: 11px;">평가 서명 누락</span>'
            : '<span style="color: #ef4444; font-weight: 900; font-size: 11px;">-</span>';
        
        const gradeText = comp?.evaluationGrade ? comp.evaluationGrade : (comp ? '우수 (A)' : '-');

        rowsHtml += `
          <tr>
            <td align="center">${i + 1}</td>
            <td>${u.departmentName || u.jobRole || '작업지 야드'}</td>
            <td align="center">${u.position || '사원'}</td>
            <td align="center" style="font-weight: bold;">${u.displayName}</td>
            <td align="center">${u.employeeId || '-'}</td>
            <td align="center" style="font-weight: bold; color: ${comp ? '#10b981' : '#f43f5e'}">
              ${comp ? '이수 완료' : '미이수 (불참)'}
            </td>
            <td align="center">${comp && comp.completedAt ? comp.completedAt.split('T')[0] : '-'}</td>
            <td align="center" valign="middle" style="background: #fafafa;">${signatureImg}</td>
            <td align="center" style="font-weight: bold;">${gradeText}</td>
            <td align="center" valign="middle" style="background: #fafafa;">${evalSignatureImg}</td>
          </tr>
        `;
      });

      const completionRate = ((completedCountTemp / (targetWorkers.length || 1)) * 100).toFixed(1);

      const imageSectionHtml = tempSession?.imageUrl
        ? `
          <div class="section-title" style="margin-top: 25px;">4. 교육 현장 교육 전경 및 실무 배치 증빙 사진</div>
          <div style="border: 1px solid #000; padding: 15px; text-align: center; margin-bottom: 25px; background: #ffffff;">
            <img src="${tempSession.imageUrl}" style="max-height: 240px; max-width: 100%; object-fit: contain; border-radius: 6px; border: 1px solid #ddd;" />
            <p style="font-size: 11px; color: #666; font-weight: bold; margin-top: 8px; margin-bottom: 0;">※ 현장 내 안전지리 및 실무 숙련도 실증 증빙 사진</p>
          </div>
        `
        : '';

      const displayYear = String(statutoryYear).substring(2, 4);
      const displayMonth = String(statutoryMonth).padStart(2, '0');
      const pageTitle = `${displayYear}년 ${displayMonth}월 안전보건교육 기록훈련표 [${cat}]`;

      const pageBreakStyle = idx < statutoryCategories.length - 1 ? 'page-break-inside: avoid; page-break-after: always; break-after: page;' : '';

      allPagesHtml += `
        <div class="container" style="${pageBreakStyle} margin-bottom: 40px;">
          <div class="title">${pageTitle}</div>
          
          <table class="meta-table">
            <tr>
              <th>과 정 명</th>
              <td colspan="3" style="font-weight: bold; font-size: 13px;">${tempSession?.title || `[의무] ${statutoryMonth}월 ${statutoryRound}회차 ${cat}`}</td>
              <th rowspan="4" style="width: 35px; writing-mode: vertical-rl; letter-spacing: 12px; padding: 4px; font-size: 13px; text-align: center; background: #fafafa; font-weight: bold;">결재</th>
              <td style="width: 60px; height: 18px; text-align: center; font-size: 10px; font-weight: bold; background: #fafafa; padding: 2px;">작성자</td>
              <td style="width: 60px; text-align: center; font-size: 10px; font-weight: bold; background: #fafafa; padding: 2px;">검토자</td>
              <td style="width: 60px; text-align: center; font-size: 10px; font-weight: bold; background: #fafafa; padding: 2px;">승인자</td>
            </tr>
            <tr>
              <th>교육 구분</th>
              <td>정기 법정안전보건교육</td>
              <th>대상 부서</th>
              <td style="font-weight: bold;">${statutoryDept} (정원: ${targetWorkers.length}명)</td>
              <td rowspan="3" style="height: 50px; text-align: center; vertical-align: middle; font-size: 10px;">&nbsp;</td>
              <td rowspan="3" style="text-align: center; vertical-align: middle; font-size: 10px;">&nbsp;</td>
              <td rowspan="3" style="text-align: center; vertical-align: middle; font-size: 10px;">&nbsp;</td>
            </tr>
            <tr>
              <th>수강 방식</th>
              <td style="font-weight: bold; color: ${tempSession?.trainingMethod === 'ONLINE' ? '#2563eb' : '#ea580c'}">
                ${tempSession?.trainingMethod === 'ONLINE' ? '온라인 시청각 (ONLINE/비대면)' : '현장 실증 대면 (ONSITE/집합)'}
              </td>
              <th>교육 시간</th>
              <td>${tempSession?.durationMinutes || 60}분 (법정의무 수강 완수)</td>
            </tr>
            <tr>
              <th>지도 강사</th>
              <td>${tempSession?.instructor || '-'}</td>
              <th>교육 장소</th>
              <td>${tempSession?.location || '-'}</td>
            </tr>
          </table>

          <div class="section-title" style="margin-top: 15px;">1. 안전보건 교육 세부계획 수칙 내용</div>
          <div class="content-box">${tempSession?.content || '배포 등록 예정'}</div>

          <div class="section-title">2. 임직원 참석 수강 날인 및 평가 날인서대장 (온라인 친필 검인)</div>
          <table class="member-table">
            <thead>
              <tr>
                <th width="5%">순번</th>
                <th width="14%">소속 파트</th>
                <th width="8%">직급</th>
                <th width="10%">성명</th>
                <th width="12%">사원번호</th>
                <th width="10%">이수현황</th>
                <th width="11%">완료일자</th>
                <th width="11%">참석 친필서명</th>
                <th width="9%">평가 등급</th>
                <th width="11%">평가 친필서명</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || `<tr><td colspan="10" align="center" style="padding: 20px;">등록원 명단 없음</td></tr>`}
            </tbody>
          </table>

          <div class="section-title" style="margin-top: 25px;">3. 교육 이수 집계 지수</div>
          <table class="stats-grid">
            <tr style="background-color: #fafafa; font-weight: bold;">
              <td>총 정원 (명)</td>
              <td>정상 이수 (명)</td>
              <td>재교육 대상 (명)</td>
              <td>정기 의무 달성율 (%)</td>
            </tr>
            <tr style="font-size: 14px; font-weight: bold;">
              <td>${targetWorkers.length}</td>
              <td style="color: #10b981;">${completedCountTemp}</td>
              <td style="color: #ef4444;">${absentWorkersTemp.length}</td>
              <td style="color: #3b82f6;">${completionRate}%</td>
            </tr>
          </table>

          ${imageSectionHtml}
        </div>
      `;
    });

    const displayYear = String(statutoryYear).substring(2, 4);
    const displayMonth = String(statutoryMonth).padStart(2, '0');
    const windowTitle = `${displayYear}년 ${displayMonth}월 법정 안전보건교육 기록훈련표 (카테고리별 일괄)`;

    const htmlContent = `
      <html>
      <head>
        <title>${windowTitle}</title>
        <style>
          body { font-family: 'Malgun Gothic', 'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif; padding: 45px; color: #000; line-height: 1.4; }
          .container { max-width: 800px; margin: 0 auto 50px auto; border: 2px solid #000; padding: 25px; page-break-after: always; break-after: page; }
          .title { text-align: center; font-size: 26px; font-weight: 900; margin-bottom: 25px; text-decoration: underline; letter-spacing: 2px; }
          .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .meta-table th, .meta-table td { border: 1px solid #000; padding: 6px 8px; font-size: 11px; text-align: left; }
          .meta-table th { background-color: #f5f5f5; font-weight: bold; width: 14%; text-align: center; }
          .content-box { border: 1px solid #000; padding: 15px; min-height: 100px; font-size: 11px; background-color: #fcfcfc; white-space: pre-wrap; margin-bottom: 25px; font-family: inherit; }
          .section-title { font-size: 13px; font-weight: bold; margin-bottom: 8px; border-left: 4px solid #10b981; padding-left: 8px; }
          .member-table { width: 100%; border-collapse: collapse; }
          .member-table th, .member-table td { border: 1px solid #000; padding: 6px; font-size: 11px; }
          .member-table th { background-color: #f5f5f5; font-weight: bold; text-align: center; }
          .stats-grid { width: 100%; border-collapse: collapse; margin-block: 25px; text-align: center; }
          .stats-grid td { border: 1px solid #000; padding: 10px; font-size: 12px; }
          @media print {
            @page {
              margin: 12mm;
            }
            body { padding: 0; }
            .container { border: none; padding: 0; margin-bottom: 0px; }
          }
        </style>
      </head>
      <body>
        ${allPagesHtml}
        <script>
          window.focus();
          setTimeout(function() { window.print(); }, 800);
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Print safety format with drawn signatures
  const handlePrintStatutoryPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('인쇄를 위한 공람 팝업이 브라우저에서 차단되었습니다.');
      return;
    }

    let rowsHtml = '';
    filteredWorkers.forEach((u, i) => {
      const comp = statutoryCompletions.find(c => c.uid === u.uid && c.sessionId === currentSessionId);
      const signatureImg = comp 
        ? `<img src="${comp.signatureUrl}" style="height: 32px; max-width: 80px; object-fit: contain;" />` 
        : '<span style="color: #ef4444; font-weight: 900; font-size: 11px;">※ 불참 (재교육 대상)</span>';
      
      const evalSignatureImg = comp?.evalSignatureUrl
        ? `<img src="${comp.evalSignatureUrl}" style="height: 32px; max-width: 80px; object-fit: contain;" />`
        : comp
          ? '<span style="color: #ea580c; font-weight: bold; font-size: 11px;">평가 서명 누락</span>'
          : '<span style="color: #ef4444; font-weight: 900; font-size: 11px;">-</span>';
      
      const gradeText = comp?.evaluationGrade
        ? comp.evaluationGrade
        : comp
          ? '우수 (A)'
          : '-';

      rowsHtml += `
        <tr>
          <td align="center">${i + 1}</td>
          <td>${u.departmentName || u.jobRole || '작업지 야드'}</td>
          <td align="center">${u.position || '사원'}</td>
          <td align="center" style="font-weight: bold;">${u.displayName}</td>
          <td align="center">${u.employeeId || '-'}</td>
          <td align="center" style="font-weight: bold; color: ${comp ? '#10b981' : '#f43f5e'}">
            ${comp ? '이수 완료' : '미이수 (불참)'}
          </td>
          <td align="center">${comp && comp.completedAt ? comp.completedAt.split('T')[0] : '-'}</td>
          <td align="center" valign="middle" style="background: #fafafa;">${signatureImg}</td>
          <td align="center" style="font-weight: bold;">${gradeText}</td>
          <td align="center" valign="middle" style="background: #fafafa;">${evalSignatureImg}</td>
        </tr>
      `;
    });

    const completionRate = ((completedCount / (filteredWorkers.length || 1)) * 100).toFixed(1);

    // Dynamic Image Render if present in Session
    const imageSectionHtml = matchedSession?.imageUrl
      ? `
        <div class="section-title" style="margin-top: 25px;">4. 교육 현장 교육 전경 및 실무 배치 증빙 사진</div>
        <div style="border: 1px solid #000; padding: 15px; text-align: center; margin-bottom: 25px; background: #ffffff;">
          <img src="${matchedSession.imageUrl}" style="max-height: 240px; max-width: 100%; object-fit: contain; border-radius: 6px; border: 1px solid #ddd;" />
          <p style="font-size: 11px; color: #666; font-weight: bold; margin-top: 8px; margin-bottom: 0;">※ 현장 내 안전지리 및 실무 숙련도 실증 증빙 사진</p>
        </div>
      `
      : '';

    const displayYear = String(statutoryYear).substring(2, 4);
    const displayMonth = String(statutoryMonth).padStart(2, '0');
    const customTitle = `${displayYear}년 ${displayMonth}월 안전보건교육 기록훈련표`;

    const htmlContent = `
      <html>
      <head>
        <title>${customTitle}</title>
        <style>
          body { font-family: 'Malgun Gothic', 'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif; padding: 40px; color: #000; line-height: 1.4; }
          .container { max-width: 800px; margin: 0 auto; border: 2px solid #000; padding: 25px; }
          .title { text-align: center; font-size: 26px; font-weight: 900; margin-bottom: 25px; text-decoration: underline; letter-spacing: 2px; }
          .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .meta-table th, .meta-table td { border: 1px solid #000; padding: 6px 8px; font-size: 11px; text-align: left; }
          .meta-table th { background-color: #f5f5f5; font-weight: bold; width: 14%; text-align: center; }
          .content-box { border: 1px solid #000; padding: 15px; min-height: 100px; font-size: 11px; background-color: #fcfcfc; white-space: pre-wrap; margin-bottom: 25px; font-family: inherit; }
          .section-title { font-size: 13px; font-weight: bold; margin-bottom: 8px; border-left: 4px solid #10b981; padding-left: 8px; }
          .member-table { width: 100%; border-collapse: collapse; }
          .member-table th, .member-table td { border: 1px solid #000; padding: 6px; font-size: 11px; }
          .member-table th { background-color: #f5f5f5; font-weight: bold; text-align: center; }
          .stats-grid { width: 100%; border-collapse: collapse; margin-block: 25px; text-align: center; }
          .stats-grid td { border: 1px solid #000; padding: 10px; font-size: 12px; }
          .footer { text-align: right; margin-top: 40px; font-size: 12px; font-weight: bold; letter-spacing: 1px; }
          @media print {
            @page {
              margin: 12mm; /* Suppress browser headers and footers */
            }
            body { padding: 0; }
            .container { border: none; padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="title">${customTitle}</div>
          
          <table class="meta-table">
            <tr>
              <th>과 정 명</th>
              <td colspan="3" style="font-weight: bold; font-size: 13px;">${matchedSession?.title || `[의무] ${statutoryMonth}월 ${statutoryRound}회차 ${statutoryCategory}`}</td>
              <th rowspan="4" style="width: 35px; writing-mode: vertical-rl; letter-spacing: 12px; padding: 4px; font-size: 13px; text-align: center; background: #fafafa; font-weight: bold;">결재</th>
              <td style="width: 60px; height: 18px; text-align: center; font-size: 10px; font-weight: bold; background: #fafafa; padding: 2px;">작성자</td>
              <td style="width: 60px; text-align: center; font-size: 10px; font-weight: bold; background: #fafafa; padding: 2px;">검토자</td>
              <td style="width: 60px; text-align: center; font-size: 10px; font-weight: bold; background: #fafafa; padding: 2px;">승인자</td>
            </tr>
            <tr>
              <th>교육 구분</th>
              <td>정기 법정안전보건교육</td>
              <th>대상 부서</th>
              <td style="font-weight: bold;">${statutoryDept} (정원: ${filteredWorkers.length}명)</td>
              <td rowspan="3" style="height: 50px; text-align: center; vertical-align: middle; font-size: 10px;">&nbsp;</td>
              <td rowspan="3" style="text-align: center; vertical-align: middle; font-size: 10px;">&nbsp;</td>
              <td rowspan="3" style="text-align: center; vertical-align: middle; font-size: 10px;">&nbsp;</td>
            </tr>
            <tr>
              <th>수강 방식</th>
              <td style="font-weight: bold; color: ${matchedSession?.trainingMethod === 'ONLINE' ? '#2563eb' : '#ea580c'}">
                ${matchedSession?.trainingMethod === 'ONLINE' ? '온라인 시청각 (ONLINE/비대면)' : '현장 실증 대면 (ONSITE/집합)'}
              </td>
              <th>교육 시간</th>
              <td>${matchedSession?.durationMinutes || 60}분 (법정의무 수강 완수)</td>
            </tr>
            <tr>
              <th>지도 강사</th>
              <td>${matchedSession?.instructor || '-'}</td>
              <th>교육 장소</th>
              <td>${matchedSession?.location || '-'}</td>
            </tr>
          </table>

          <div class="section-title">1. 안전보건 교육 세부계획 수칙 내용</div>
          <div class="content-box">${matchedSession?.content || '배포 등록 예정'}</div>

          <div class="section-title">2. 임직원 참석 수강 날인 및 평가 날인서대장 (온라인 친필 검인)</div>
          <table class="member-table">
            <thead>
              <tr>
                <th width="5%">순번</th>
                <th width="14%">소속 파트</th>
                <th width="8%">직급</th>
                <th width="10%">성명</th>
                <th width="12%">사원번호</th>
                <th width="10%">이수현황</th>
                <th width="11%">완료일자</th>
                <th width="11%">참석 친필서명</th>
                <th width="9%">평가 등급</th>
                <th width="11%">평가 친필서명</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="section-title" style="margin-top: 25px;">3. 교육 이수 집계 지수</div>
          <table class="stats-grid">
            <tr style="background-color: #fafafa; font-weight: bold;">
              <td>총 정원 (명)</td>
              <td>정상 이수 (명)</td>
              <td>재교육 대상 (명)</td>
              <td>정기 의무 달성율 (%)</td>
            </tr>
            <tr style="font-size: 14px; font-weight: bold;">
              <td>${filteredWorkers.length}</td>
              <td style="color: #10b981;">${completedCount}</td>
              <td style="color: #ef4444;">${absentWorkers.length}</td>
              <td style="color: #3b82f6;">${completionRate}%</td>
            </tr>
          </table>

          ${imageSectionHtml}

          <div class="footer">
          </div>
        </div>
        <script>
          window.focus();
          setTimeout(function() { window.print(); }, 500);
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'valid':
        return <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-lg text-[10px] font-black uppercase border border-emerald-500/20">이수 완료</span>;
      case 'expiring':
        return <span className="px-3 py-1 bg-amber-500/10 text-amber-500 rounded-lg text-[10px] font-black uppercase border border-amber-500/20">만료 예정</span>;
      case 'expired':
        return <span className="px-3 py-1 bg-rose-500/10 text-rose-500 rounded-lg text-[10px] font-black uppercase border border-rose-500/20">만료됨</span>;
      default:
        return null;
    }
  };

  return (
    <PCAdminLayout title="안전 교육 및 평가 제어실">
      <div className="max-w-[1600px] mx-auto space-y-10 text-foreground">
        
        {/* Top Header Row with dual layout */}
        <div className="flex justify-between items-end flex-wrap gap-6 py-2 border-b border-border pb-6">
          <div className="space-y-3">
            <h2 className="text-3xl font-black text-foreground tracking-tight">전사 안전 교육 상황실</h2>
            <p className="text-muted-foreground font-medium text-sm">
               직무인증 규격 교육과 한달 2회 전직원 정기 법정안전교육의 친필 서명을 정밀 관장합니다.
            </p>
          </div>

          {/* Core Navigation Switcher */}
          <div className="bg-muted p-1.5 rounded-2xl flex gap-1.5 border border-border shadow-inner">
            <button
              onClick={() => setActiveTab('REGULAR')}
              className={`px-6 py-3 rounded-xl text-xs font-black transition-all ${
                activeTab === 'REGULAR' 
                  ? 'bg-card text-foreground shadow-md' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              직무 전문 교육현황
            </button>
            <button
              onClick={() => setActiveTab('STATUTORY')}
              className={`px-6 py-3 rounded-xl text-xs font-black transition-all ${
                activeTab === 'STATUTORY' 
                  ? 'bg-card text-foreground shadow-md' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              법정 안전교육 일지 & 날인대장
            </button>
          </div>
        </div>

        {activeTab === 'REGULAR' ? (
          <>
            {/* Dashboard Cards (Regular) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              {[
                { label: '전체 교육 이수율', value: '94.2', unit: '%', sub: '필수 교육 대상자 대비', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                { label: '평균 평가 점수', value: '88.5', unit: '점', sub: '최근 6개월 상시 평가', icon: TrendingUp, color: 'text-blue-500', bg: 'bg-blue-500/10' },
                { label: '만료 예정 자격', value: '12', unit: '건', sub: '30일 이내 갱신 필요', icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
                { label: '미이수 인원', value: '5', unit: '명', sub: '긴급 교육 대상자', icon: AlertTriangle, color: 'text-rose-500', bg: 'bg-rose-500/10' },
              ].map((card, i) => (
                <div key={i} className="bg-card p-8 rounded-[2.5rem] border border-border shadow-sm relative overflow-hidden group">
                  <div className={`w-14 h-14 rounded-2xl ${card.bg} flex items-center justify-center ${card.color} mb-6 group-hover:scale-110 transition-transform`}>
                    <card.icon className="w-7 h-7" />
                  </div>
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">{card.label}</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-foreground">{card.value}</span>
                    <span className="text-muted-foreground font-black text-lg uppercase">{card.unit}</span>
                  </div>
                  <p className="mt-4 text-[11px] font-bold text-muted-foreground">{card.sub}</p>
                </div>
              ))}
            </div>

            {/* Filters and Search */}
            <div className="bg-card p-6 rounded-[2rem] border border-border shadow-sm flex flex-wrap gap-4 items-center">
              <div className="relative flex-1 max-w-md group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-foreground transition-colors" />
                <input 
                  type="text" 
                  placeholder="이름, 교육명, 부서로 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-6 py-4 bg-muted border-none rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/5 transition-all text-foreground"
                />
              </div>
              <select className="px-6 py-4 bg-muted border-none rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/5 transition-all text-foreground cursor-pointer">
                <option className="bg-card">교육 상태: 전체</option>
                <option className="bg-card">이수 완료</option>
                <option className="bg-card">만료 예정</option>
                <option className="bg-card">만료됨</option>
              </select>
            </div>

            {/* Training Table */}
            <div className="bg-card rounded-[2.5rem] border border-border shadow-sm overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted/30 border-b border-border">
                    <th className="px-8 py-6 text-[10px] font-black text-muted-foreground uppercase tracking-widest">상태</th>
                    <th className="px-8 py-6 text-[10px] font-black text-muted-foreground uppercase tracking-widest">이수 대상자</th>
                    <th className="px-8 py-6 text-[10px] font-black text-muted-foreground uppercase tracking-widest">교육 과정명</th>
                    <th className="px-8 py-6 text-[10px] font-black text-muted-foreground uppercase tracking-widest">이수 / 만료</th>
                    <th className="px-8 py-6 text-[10px] font-black text-muted-foreground uppercase tracking-widest">평가 점수</th>
                    <th className="px-8 py-6 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-center">자격증</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {records.filter(r => r.userName.includes(searchTerm) || r.courseName.includes(searchTerm)).map((record) => (
                    <tr key={record.id} className="group hover:bg-primary/5 transition-all">
                      <td className="px-8 py-6">
                        {getStatusBadge(record.status)}
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-muted rounded-xl flex items-center justify-center text-sm font-black text-muted-foreground">
                            {record.userName[0]}
                          </div>
                          <div>
                            <p className="text-sm font-black text-foreground">{record.userName}</p>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase">{record.userRole}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col gap-1">
                          <p className="text-sm font-bold text-foreground">{record.courseName}</p>
                          <p className="text-[10px] font-black text-blue-500">강사: {record.instructor}</p>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {record.completionDate}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] font-black text-rose-400">
                            <Clock className="w-3 h-3" />
                            만료: {record.expiryDate}
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 max-w-[100px] h-2 bg-muted rounded-full overflow-hidden border border-border">
                            <div 
                              className={`h-full rounded-full ${record.score >= 90 ? 'bg-emerald-500' : 'bg-blue-500'}`} 
                              style={{ width: `${record.score}%` }} 
                            />
                          </div>
                          <span className="text-sm font-black text-foreground">{record.score}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex justify-center">
                          <button 
                            onClick={() => toast.success('수료증을 성공적으로 불러왔습니다.')}
                            className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg text-[10px] font-black text-muted-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all shadow-sm"
                          >
                            <Award className="w-4 h-4" />
                            수료증 확인
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          /* Statutory safety interface */
          <div className="space-y-8">
            {/* Control & Query Bar */}
            <div className="bg-card p-6 rounded-[2.5rem] border border-border shadow-sm flex flex-wrap gap-4 items-center justify-between">
              
              <div className="flex flex-wrap gap-3 items-center">
                <div className="flex items-center gap-2 bg-muted/60 px-4 py-3 rounded-2xl border border-border">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span className="text-xs font-black text-foreground">계획 일정 관리:</span>
                </div>
                
                <select 
                  value={statutoryYear} 
                  onChange={(e) => setStatutoryYear(Number(e.target.value))}
                  className="bg-muted px-4 py-3 rounded-2xl text-xs font-black text-foreground border border-border focus:outline-none focus:ring-1 focus:ring-primary h-12 inline-block cursor-pointer"
                >
                  <option value={2025}>2025년도</option>
                  <option value={2026}>2026년도</option>
                </select>

                <select 
                  value={statutoryMonth} 
                  onChange={(e) => setStatutoryMonth(Number(e.target.value))}
                  className="bg-muted px-4 py-3 rounded-2xl text-xs font-black text-foreground border border-border focus:outline-none focus:ring-1 focus:ring-primary h-12 inline-block cursor-pointer"
                >
                  {[...Array(12)].map((_, i) => (
                    <option key={i+1} value={i+1}>{i+1}월 정기분</option>
                  ))}
                </select>

                <select 
                  value={statutoryRound} 
                  onChange={(e) => setStatutoryRound(Number(e.target.value))}
                  className="bg-muted px-4 py-3 rounded-2xl text-xs font-black text-foreground border border-border focus:outline-none focus:ring-1 focus:ring-primary h-12 inline-block cursor-pointer"
                >
                  <option value={1}>1회차 (전반기)</option>
                  <option value={2}>2회차 (후반기)</option>
                </select>

                <select 
                  value={statutoryCategory} 
                  onChange={(e) => setStatutoryCategory(e.target.value)}
                  className="bg-muted px-4 py-3 rounded-2xl text-xs font-black text-foreground border border-border focus:outline-none focus:ring-1 focus:ring-primary h-12 inline-block cursor-pointer"
                >
                  {statutoryCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => setIsAddCategoryOpen(true)}
                  className="h-12 px-4 bg-muted border border-border hover:bg-muted/80 text-primary rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                  title="새 법정교육 카테고리 추가"
                >
                  <Plus className="w-4 h-4 text-primary" />
                  카테고리 추가
                </button>

                <select 
                  value={statutoryDept} 
                  onChange={(e) => setStatutoryDept(e.target.value)}
                  className="bg-muted px-4 py-3 rounded-2xl text-xs font-black text-foreground border border-border focus:outline-none focus:ring-1 focus:ring-primary h-12 inline-block cursor-pointer"
                >
                  <option value="전체">부서 : 전체임직원</option>
                  <option value="용접팀">용접팀</option>
                  <option value="취부팀">취부팀</option>
                  <option value="사상팀">사상팀</option>
                  <option value="도장팀">도장팀</option>
                  <option value="조립팀">조립팀</option>
                </select>
              </div>

              {/* Functional download & notices trigger */}
              <div className="flex gap-2 flex-wrap">
                <button 
                  onClick={handleExportExcel}
                  className="px-4 h-12 bg-card border border-border text-foreground rounded-2xl text-xs font-black hover:bg-muted font-bold flex items-center gap-2 shadow-sm transition-all"
                  title="전체 대장을 하나의 리스트로 일괄 다운로드합니다."
                >
                  <Download className="w-4 h-4 text-emerald-500" />
                  Excel 대장 다운로드
                </button>
                <button 
                  onClick={handleExportAllCategoriesExcel}
                  className="px-4 h-12 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl text-xs font-black hover:bg-emerald-100 flex items-center gap-2 shadow-sm transition-all"
                  title="모든 법정의무 교육 카테고리를 각각의 개별 시트로 실증 설계하여 Excel로 다운로드합니다."
                >
                  <Download className="w-4 h-4 text-emerald-600" />
                  카테고리별 Excel 다운로드
                </button>
                <button 
                  onClick={handlePrintStatutoryPDF}
                  className="px-4 h-12 bg-muted border border-border text-foreground rounded-2xl text-xs font-black hover:bg-muted/90 flex items-center gap-2 shadow-sm transition-all"
                  title="선택된 장부 전체를 일괄 인쇄합니다."
                >
                  <Printer className="w-4 h-4 text-primary" />
                  통합 일지 인쇄
                </button>
                <button 
                  onClick={handlePrintAllCategoriesPDF}
                  className="px-4 h-12 bg-primary text-white rounded-2xl text-xs font-black hover:bg-primary/95 flex items-center gap-2 shadow-sm shadow-primary/10 transition-all"
                  title="모든 법정의무 교육 카테고리별로 개별 연혁표 및 일지를 자동 분할(Page Break)하여 하나로 연속 인쇄합니다."
                >
                  <Printer className="w-4 h-4" />
                  카테고리별 연속 인쇄
                </button>
              </div>
            </div>

            {/* Session Information Card */}
            {matchedSession ? (
              <div className="bg-card p-8 rounded-[2.5rem] border border-border shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <p className="text-[10px] font-black text-muted-foreground tracking-widest uppercase">현재 활성화된 정기 기수 정보</p>
                  </div>
                  <h3 className="text-xl font-bold text-foreground">{matchedSession.title}</h3>
                  <div className="flex gap-4 flex-wrap text-xs font-bold text-muted-foreground">
                    <span>• 강사: {matchedSession.instructor}</span>
                    <span>• 위치: {matchedSession.location}</span>
                    <span>• 교육수행시간: <span className="text-primary font-black">{matchedSession.durationMinutes || 60}분</span></span>
                    <span>• 이수방법: <span className="text-emerald-500 font-black">{matchedSession.trainingMethod === 'ONLINE' ? '온라인 영상 학습' : '현장 직접 대면 교육'}</span></span>
                    <span>• 교육실시일: <span className="text-blue-600 font-black">{matchedSession.trainingDate || matchedSession.createdAt.split('T')[0]}</span></span>
                    <span>• 배포날짜: {matchedSession.createdAt.split('T')[0]}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={handleOpenEditSession}
                    className="px-6 py-3.5 bg-muted text-foreground border border-border hover:bg-muted/80 rounded-2xl text-xs font-black flex items-center gap-2"
                  >
                    <Edit className="w-4 h-4 text-primary" />
                    계획 요강 및 수칙 내용 상세수정
                  </button>
                  <button 
                    onClick={handleDeleteSession}
                    className="px-6 py-3.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-2xl text-xs font-black flex items-center gap-2 transition-all dark:bg-rose-500/10 dark:hover:bg-rose-500/20"
                  >
                    <AlertTriangle className="w-4 h-4 text-rose-500" />
                    안건 및 일정 전면 삭제
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-card p-10 rounded-[2.5rem] border border-border border-dashed text-center space-y-4">
                <AlertTriangle className="w-12 h-12 mx-auto text-amber-500" />
                <div className="space-y-1">
                  <h4 className="text-lg font-black">본 회차 교육 안건이 개설되지 않았습니다</h4>
                  <p className="text-xs text-muted-foreground font-medium">선택한 시기 및 부서 대상의 교육 세션을 수동 개설(등록)한 뒤, 서명을 서식하여야 대장이 성립됩니다.</p>
                </div>
                <button 
                  onClick={handleOpenCreateSession}
                  className="px-6 py-3.5 bg-primary text-white font-black text-xs rounded-xl hover:bg-primary/95 transition-all flex items-center gap-2 mx-auto"
                >
                  <Plus className="w-4 h-4" />
                  신규 안전 교육 과정 직접 등록 (개설)
                </button>
              </div>
            )}

            {/* Attendance Stat boxes */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              {[
                { label: '교육 대상 정원', value: filteredWorkers.length, unit: '명', sub: '현 선택부서 소속', icon: Users, color: 'text-foreground' },
                { label: '친필 검인 이수', value: completedCount, unit: '명', sub: '수강 완료 및 자필 서명완료', icon: FileCheck, color: 'text-emerald-500' },
                { label: '불참자 (재교육 대상)', value: absentWorkers.length, unit: '명', sub: '긴급 조치 요구 명단', icon: AlertTriangle, color: 'text-rose-500' },
                { label: '정기 이수 달성율', value: ((completedCount / (filteredWorkers.length || 1)) * 100).toFixed(1), unit: '%', sub: '목표치 대비 95% 권장', icon: CheckCircle2, color: 'text-blue-500' },
              ].map((stat, idx) => (
                <div key={idx} className="bg-card p-6.5 rounded-[2rem] border border-border shadow-sm flex items-center justify-between gap-4">
                  <div className="space-y-2">
                    <span className="text-[10px] font-black text-muted-foreground uppercase">{stat.label}</span>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-3xl font-black ${stat.color}`}>{stat.value}</span>
                      <span className="text-xs text-muted-foreground font-black uppercase">{stat.unit}</span>
                    </div>
                    <p className="text-[10px] font-bold text-muted-foreground leading-none">{stat.sub}</p>
                  </div>
                  <div className="w-12 h-12 bg-muted rounded-2xl flex items-center justify-center text-muted-foreground">
                    <stat.icon className="w-6 h-6" />
                  </div>
                </div>
              ))}
            </div>

            {/* Attendance & Signature Status Table */}
            <div className="bg-card rounded-[2.5rem] border border-border shadow-sm overflow-hidden space-y-4 p-8">
              <div className="flex justify-between items-center flex-wrap gap-4 border-b border-border pb-6">
                <div className="space-y-1">
                  <h4 className="text-lg font-black text-foreground">부서원 수강 서명부 관리대장</h4>
                  <p className="text-xs text-muted-foreground font-bold">자필 성명이 날인된 명부만 공인 효력을 지닙니다.</p>
                </div>
                <button 
                  onClick={handleNotifyAbsentees}
                  disabled={absentWorkers.length === 0}
                  className="px-6 py-3 bg-red-500 text-white rounded-2xl text-xs font-black hover:bg-red-600 disabled:opacity-40 transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-red-500/10"
                >
                  <Send className="w-4 h-4" />
                  불참자 수강 재진행 및 모바일 독려알림 강제전송
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border text-[9px] font-black text-muted-foreground uppercase tracking-widest">
                      <th className="px-6 py-5 text-center" style={{ width: '7%' }}>순번</th>
                      <th className="px-6 py-5">성명</th>
                      <th className="px-6 py-5">소속 부서</th>
                      <th className="px-6 py-5">직급</th>
                      <th className="px-6 py-5">사원 번호</th>
                      <th className="px-6 py-5 text-center" style={{ width: '15%' }}>이수 상태</th>
                      <th className="px-6 py-5">이수/서명 시간</th>
                      <th className="px-6 py-5 text-center" style={{ width: '18%' }}>수기 친필 서명</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredWorkers.map((u, i) => {
                      const comp = statutoryCompletions.find(c => c.uid === u.uid && c.sessionId === currentSessionId);
                      return (
                        <tr key={u.uid} className="hover:bg-muted/10 transition-colors">
                          <td className="px-6 py-4.5 text-center text-xs font-bold text-muted-foreground">{i + 1}</td>
                          <td className="px-6 py-4.5">
                            <span className="text-sm font-black text-foreground">{u.displayName}</span>
                          </td>
                          <td className="px-6 py-4.5">
                            <span className="text-xs font-bold text-muted-foreground">{u.departmentName || u.jobRole || '기타'}</span>
                          </td>
                          <td className="px-6 py-4.5">
                            <span className="text-xs font-bold text-muted-foreground">{u.position || '사원'}</span>
                          </td>
                          <td className="px-6 py-4.5">
                            <span className="text-xs font-mono text-muted-foreground font-bold">{u.employeeId || 'ID-TEMPORARY'}</span>
                          </td>
                          <td className="px-6 py-4.5 text-center">
                            {comp ? (
                              <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] font-black rounded-lg">
                                완료 완료
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 bg-rose-500/10 text-rose-500 border border-rose-500/20 text-[10px] font-black rounded-lg">
                                불참 / 미이수
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4.5">
                            <span className="text-xs font-bold text-muted-foreground">
                              {comp ? comp.completedAt.replace('T', ' ').substring(0, 16) : '-'}
                            </span>
                          </td>
                          <td className="px-6 py-4.5">
                            <div className="flex justify-center items-center">
                              {comp ? (
                                <img 
                                  src={comp.signatureUrl} 
                                  alt="Worker hand signature" 
                                  className="h-9 max-w-[120px] object-contain border border-dashed border-border bg-white rounded p-1"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <span className="text-[11px] text-rose-400 font-bold">날인 미등록</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredWorkers.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-16 text-center text-xs font-bold text-muted-foreground">
                          해당 부서에 소속 및 등록된 필터 타겟 인직원이 존재하지 않습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit statutory session details dialog */}
      <Dialog open={isEditSessionOpen} onOpenChange={setIsEditSessionOpen}>
        <DialogContent className="bg-card border border-border text-foreground rounded-3xl p-8 max-w-lg shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">법정 안전 정기교육일지 상세 수립</DialogTitle>
            <DialogDescription className="text-muted-foreground font-bold">임직원 수강 계획 및 보고 일지의 강사, 위치, 지침 전문 요강을 수정합니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 text-xs font-bold">
            <div className="space-y-2">
              <label>정기 과정명</label>
              <input 
                type="text"
                value={editingSession.title}
                onChange={(e) => setEditingSession({...editingSession, title: e.target.value})}
                className="w-full h-12 px-4 rounded-xl border border-input bg-muted/20 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label>지도 강사</label>
                <input 
                  type="text"
                  value={editingSession.instructor}
                  onChange={(e) => setEditingSession({...editingSession, instructor: e.target.value})}
                  className="w-full h-12 px-4 rounded-xl border border-input bg-muted/20 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <label>교육 장소</label>
                <input 
                  type="text"
                  value={editingSession.location}
                  onChange={(e) => setEditingSession({...editingSession, location: e.target.value})}
                  className="w-full h-12 px-4 rounded-xl border border-input bg-muted/20 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            <div className="space-y-2 font-bold">
              <label>시청각 동영상 링크 (선택사항)</label>
              <input 
                type="text"
                value={editingSession.videoUrl}
                onChange={(e) => setEditingSession({...editingSession, videoUrl: e.target.value})}
                className="w-full h-12 px-4 rounded-xl border border-input bg-muted/20 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="예: https://youtube.com/..."
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label>수강 시간 (분 단위)</label>
                <input 
                  type="number"
                  value={editingSession.durationMinutes}
                  onChange={(e) => setEditingSession({...editingSession, durationMinutes: Number(e.target.value)})}
                  className="w-full h-12 px-4 rounded-xl border border-input bg-muted/20 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="예: 60"
                />
              </div>
              <div className="space-y-2">
                <label>교육 이수 방식</label>
                <select 
                  value={editingSession.trainingMethod}
                  onChange={(e) => setEditingSession({...editingSession, trainingMethod: e.target.value})}
                  className="w-full h-12 px-4 rounded-xl border border-input bg-muted/20 text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-bold"
                >
                  <option value="ONSITE">현장 직접 교육 (대면)</option>
                  <option value="ONLINE">온라인 영상 교육 (비대면)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label>교육 이수/실시 날짜</label>
                <input 
                  type="date"
                  value={editingSession.trainingDate}
                  onChange={(e) => setEditingSession({...editingSession, trainingDate: e.target.value})}
                  className="w-full h-12 px-4 rounded-xl border border-input bg-muted/20 text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-bold"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label>안전보건 교육 세부계획 지침 (Markdown 지원)</label>
              <textarea 
                value={editingSession.content}
                onChange={(e) => setEditingSession({...editingSession, content: e.target.value})}
                rows={6}
                className="w-full p-4 rounded-xl border border-input bg-muted/20 text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium"
              />
            </div>

            <div className="space-y-2 border-t border-border pt-3">
              <label className="text-foreground font-black">교육 전경 및 증빙 자료 이미지 업로드</label>
              {editingSession.imageUrl ? (
                <div className="relative border border-border rounded-xl overflow-hidden bg-muted/25 p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img src={editingSession.imageUrl} className="w-16 h-16 object-cover rounded-lg border border-border" />
                    <div>
                      <span className="text-xs text-foreground font-bold block">이미지 첨부 완료</span>
                      <span className="text-[10px] text-muted-foreground font-bold">Base64 형식 영구 보존</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingSession({...editingSession, imageUrl: ''})}
                    className="px-3 py-1.5 bg-rose-500/10 text-rose-500 border border-rose-500/20 text-[10px] font-black rounded-lg transition-colors cursor-pointer hover:bg-rose-500 hover:text-white"
                  >
                    삭제
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center border border-dashed border-border rounded-xl py-6 bg-muted/20 cursor-pointer hover:bg-muted/35 transition-all text-center">
                  <span className="text-[11px] font-black text-primary/80">여기를 눌러 수강 증빙/칠판/인증/전경 사진 변경 및 업로드</span>
                  <span className="text-[9px] text-muted-foreground font-semibold mt-1">PNG, JPG, BMP 기기 앨범 파일 지원</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const base64 = event.target?.result as string;
                          setEditingSession({...editingSession, imageUrl: base64});
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
              )}
            </div>

            <div className="space-y-3 border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-black text-foreground">
                  교육 대상 사원 개별 지정 ({editingSession.allowedUids.length}명 선택됨)
                </label>
                {editingSession.allowedUids.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setEditingSession({ ...editingSession, allowedUids: [] })}
                    className="text-[10px] font-black text-rose-500 hover:underline"
                  >
                    선택 초기화 (전체 대상으로 변경)
                  </button>
                )}
              </div>
              <p className="text-[10.5px] font-semibold text-muted-foreground leading-relaxed">
                💡 특정 사원들에게만 교육을 배정하고 싶다면 아래 목록에서 체크해 주세요. 
                <span className="text-primary font-black ml-1">아무도 선택하지 않을 경우, 소속 부서({matchedSession?.targetDepartment || '전체'})의 모든 사원</span>에게 자동으로 배정됩니다.
              </p>
              
              {/* Filter controls */}
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="사원명 또는 사번 검색..."
                  value={editSearchQuery}
                  onChange={(e) => setEditSearchQuery(e.target.value)}
                  className="h-10 px-3 text-xs rounded-lg border border-input bg-muted/15 focus:outline-none"
                />
                <select
                  value={editWorkplaceFilter}
                  onChange={(e) => setEditWorkplaceFilter(e.target.value)}
                  className="h-10 px-3 text-xs rounded-lg border border-input bg-muted/15 focus:outline-none font-bold text-foreground"
                >
                  <option value="ALL">모든 사업부/부서</option>
                  <option value="중형선">중형선선체조립부</option>
                  <option value="함정">함정선체생산부</option>
                </select>
              </div>

              {/* User Selection List */}
              <div className="max-h-[160px] overflow-y-auto border border-border bg-muted/25 rounded-xl p-2.5 space-y-1">
                {(() => {
                  const filtered = users.filter(u => {
                    if (!u.isActive) return false;
                    const matchesSearch = editSearchQuery 
                      ? (u.displayName?.toLowerCase().includes(editSearchQuery.toLowerCase()) || 
                         u.employeeId?.toLowerCase().includes(editSearchQuery.toLowerCase()))
                      : true;
                    const matchesDept = editWorkplaceFilter === 'ALL'
                      ? true
                      : editWorkplaceFilter === '중형선'
                        ? (u.departmentName?.includes('중형선') || u.workplace?.includes('중형선'))
                        : (u.departmentName?.includes('함정') || u.workplace?.includes('함정'));
                    return matchesSearch && matchesDept;
                  });

                  if (filtered.length === 0) {
                    return <div className="text-center text-xs text-muted-foreground py-6">검색된 사원이 없습니다.</div>;
                  }

                  return filtered.map(u => {
                    const checked = editingSession.allowedUids?.includes(u.uid);
                    return (
                      <button
                        key={u.uid}
                        type="button"
                        onClick={() => {
                          const next = checked 
                            ? editingSession.allowedUids.filter(id => id !== u.uid)
                            : [...editingSession.allowedUids, u.uid];
                          setEditingSession({...editingSession, allowedUids: next});
                        }}
                        className={`w-full p-2.5 rounded-lg text-left flex items-center justify-between text-[11px] font-bold transition-all border ${
                          checked ? 'bg-primary/10 border-primary text-foreground' : 'bg-background border-transparent hover:bg-muted/30 text-muted-foreground'
                        }`}
                      >
                        <div className="flex flex-col">
                          <span>{u.displayName} ({u.position || '사원'} | {u.employeeId || '사번 없음'})</span>
                          <span className="text-[10px] text-muted-foreground font-semibold">
                            {u.departmentName || '소속 부서 없음'} {u.workplace ? `| ${u.workplace}` : ''}
                          </span>
                        </div>
                        <input type="checkbox" checked={checked} readOnly className="rounded-sm accent-primary cursor-pointer h-4 w-4" />
                      </button>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <button 
              onClick={() => setIsEditSessionOpen(false)}
              className="px-6 py-3 bg-muted border border-border rounded-xl text-xs font-black hover:bg-muted/80 transition-colors cursor-pointer"
            >
              닫기
            </button>
            <button 
              onClick={handleSaveSession}
              className="px-6 py-3 bg-primary text-white rounded-xl text-xs font-black hover:bg-primary/95 transition-colors cursor-pointer"
            >
              수정계획 최종저장
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create statutory session details dialog */}
      <Dialog open={isCreateSessionOpen} onOpenChange={setIsCreateSessionOpen}>
        <DialogContent className="bg-card border border-border text-foreground rounded-3xl p-8 max-w-lg shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">정기안전보건 교육 신규 개설 (수동 등록)</DialogTitle>
            <DialogDescription className="text-muted-foreground font-bold">새로운 정기/법정 안전보건 교육 세션을 직접 개설합니다. 수강 시간과 현장 대면 유무를 지정해 주십시오.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 text-xs font-bold text-foreground">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label>교육 연도 / 정기 분기</label>
                <div className="p-3.5 bg-muted/40 rounded-xl text-center font-black border border-border text-foreground">
                  {statutoryYear}년도 {statutoryMonth}월 ({statutoryRound}회차)
                </div>
              </div>
              <div className="space-y-2">
                <label>소속 부서 (타겟 팀)</label>
                <div className="p-3.5 bg-primary/10 text-primary rounded-xl text-center font-black border border-primary/20">
                  {statutoryDept}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label>교육 카테고리 (대분류)</label>
                <select 
                  value={createSessionForm.category}
                  onChange={(e) => setCreateSessionForm({...createSessionForm, category: e.target.value})}
                  className="w-full h-12 px-4 rounded-xl border border-input bg-muted/25 text-foreground focus:outline-none"
                >
                  {statutoryCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label>교육 이수 방식 설정</label>
                <select 
                  value={createSessionForm.trainingMethod}
                  onChange={(e) => setCreateSessionForm({...createSessionForm, trainingMethod: e.target.value})}
                  className="w-full h-12 px-4 rounded-xl border border-input bg-muted/25 text-foreground focus:outline-none font-bold"
                >
                  <option value="ONSITE">현장에서 직접 가서 교육 (대면)</option>
                  <option value="ONLINE">온라인 영상/자료 교육 (비대면)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-2">
                <label>교육 과정 제목 (활성화 타이틀)</label>
                <input 
                  type="text"
                  value={createSessionForm.title}
                  onChange={(e) => setCreateSessionForm({...createSessionForm, title: e.target.value})}
                  className="w-full h-12 px-4 rounded-xl border border-input bg-muted/20 text-foreground"
                  placeholder="과정 제목을 입력하세요"
                />
              </div>
              <div className="space-y-2">
                <label>교육 실시 일자</label>
                <input 
                  type="date"
                  value={createSessionForm.trainingDate}
                  onChange={(e) => setCreateSessionForm({...createSessionForm, trainingDate: e.target.value})}
                  className="w-full h-12 px-4 rounded-xl border border-input bg-muted/20 text-foreground font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label>수강 시간 (분 단위 필수)</label>
                <input 
                  type="number"
                  value={createSessionForm.durationMinutes}
                  onChange={(e) => setCreateSessionForm({...createSessionForm, durationMinutes: Number(e.target.value)})}
                  className="w-full h-12 px-4 rounded-xl border border-input bg-muted/20 text-foreground"
                  placeholder="예: 60"
                />
              </div>
              <div className="space-y-2">
                <label>담당 지도 강사</label>
                <input 
                  type="text"
                  value={createSessionForm.instructor}
                  onChange={(e) => setCreateSessionForm({...createSessionForm, instructor: e.target.value})}
                  className="w-full h-12 px-4 rounded-xl border border-input bg-muted/20 text-foreground"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label>교육 실시 장소</label>
                <input 
                  type="text"
                  value={createSessionForm.location}
                  onChange={(e) => setCreateSessionForm({...createSessionForm, location: e.target.value})}
                  className="w-full h-12 px-4 rounded-xl border border-input bg-muted/20 text-foreground"
                />
              </div>
              <div className="space-y-2">
                <label>강의 자료/동영상 URL</label>
                <input 
                  type="text"
                  value={createSessionForm.videoUrl}
                  onChange={(e) => setCreateSessionForm({...createSessionForm, videoUrl: e.target.value})}
                  className="w-full h-12 px-4 rounded-xl border border-input bg-muted/20 text-foreground"
                  placeholder="https://..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <label>안전 지도 방침 교육 지도 안건 요강 (Markdown)</label>
              <textarea 
                value={createSessionForm.content}
                onChange={(e) => setCreateSessionForm({...createSessionForm, content: e.target.value})}
                rows={4}
                className="w-full p-4 rounded-xl border border-input bg-muted/20 text-foreground font-medium"
              />
            </div>

            <div className="space-y-2 border-t border-border pt-3">
              <label className="text-foreground font-black">교육 전경 및 증빙 자료 이미지 업로드</label>
              {createSessionForm.imageUrl ? (
                <div className="relative border border-border rounded-xl overflow-hidden bg-muted/25 p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img src={createSessionForm.imageUrl} className="w-16 h-16 object-cover rounded-lg border border-border" />
                    <div>
                      <span className="text-xs text-foreground font-bold block">이미지 첨부 완료</span>
                      <span className="text-[10px] text-muted-foreground font-bold">Base64 형식 영구 보존</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCreateSessionForm({...createSessionForm, imageUrl: ''})}
                    className="px-3 py-1.5 bg-rose-500/10 text-rose-500 border border-rose-500/20 text-[10px] font-black rounded-lg transition-colors cursor-pointer hover:bg-rose-500 hover:text-white"
                  >
                    삭제
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center border border-dashed border-border rounded-xl py-6 bg-muted/20 cursor-pointer hover:bg-muted/35 transition-all text-center">
                  <span className="text-[11px] font-black text-primary/80">여기를 눌러 교육 증빙 자료/칠판/인증 전경 이미지 업로드</span>
                  <span className="text-[9px] text-muted-foreground font-semibold mt-1">PNG, JPG, BMP 기기 앨범 파일 지원</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const base64 = event.target?.result as string;
                          setCreateSessionForm({...createSessionForm, imageUrl: base64});
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
              )}
            </div>

            <div className="space-y-3 border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-black text-foreground">
                  교육 대상 사원 개별 지정 ({createSessionForm.allowedUids.length}명 선택됨)
                </label>
                {createSessionForm.allowedUids.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCreateSessionForm({ ...createSessionForm, allowedUids: [] })}
                    className="text-[10px] font-black text-rose-500 hover:underline"
                  >
                    선택 초기화 (전체 대상으로 변경)
                  </button>
                )}
              </div>
              <p className="text-[10.5px] font-semibold text-muted-foreground leading-relaxed">
                💡 특정 사원들에게만 교육을 배정하고 싶다면 아래 목록에서 체크해 주세요. 
                <span className="text-primary font-black ml-1">아무도 선택하지 않을 경우, 소속 부서({statutoryDept})의 모든 사원</span>에게 자동으로 배정됩니다.
              </p>
              
              {/* Filter controls */}
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="사원명 또는 사번 검색..."
                  value={createSearchQuery}
                  onChange={(e) => setCreateSearchQuery(e.target.value)}
                  className="h-10 px-3 text-xs rounded-lg border border-input bg-muted/15 focus:outline-none"
                />
                <select
                  value={createWorkplaceFilter}
                  onChange={(e) => setCreateWorkplaceFilter(e.target.value)}
                  className="h-10 px-3 text-xs rounded-lg border border-input bg-muted/15 focus:outline-none font-bold text-foreground"
                >
                  <option value="ALL">모든 사업부/부서</option>
                  <option value="중형선">중형선선체조립부</option>
                  <option value="함정">함정선체생산부</option>
                </select>
              </div>

              {/* User Selection List */}
              <div className="max-h-[160px] overflow-y-auto border border-border bg-muted/25 rounded-xl p-2.5 space-y-1">
                {(() => {
                  const filtered = users.filter(u => {
                    if (!u.isActive) return false;
                    const matchesSearch = createSearchQuery 
                      ? (u.displayName?.toLowerCase().includes(createSearchQuery.toLowerCase()) || 
                         u.employeeId?.toLowerCase().includes(createSearchQuery.toLowerCase()))
                      : true;
                    const matchesDept = createWorkplaceFilter === 'ALL'
                      ? true
                      : createWorkplaceFilter === '중형선'
                        ? (u.departmentName?.includes('중형선') || u.workplace?.includes('중형선'))
                        : (u.departmentName?.includes('함정') || u.workplace?.includes('함정'));
                    return matchesSearch && matchesDept;
                  });

                  if (filtered.length === 0) {
                    return <div className="text-center text-xs text-muted-foreground py-6">검색된 사원이 없습니다.</div>;
                  }

                  return filtered.map(u => {
                    const checked = createSessionForm.allowedUids?.includes(u.uid);
                    return (
                      <button
                        key={u.uid}
                        type="button"
                        onClick={() => {
                          const next = checked 
                            ? createSessionForm.allowedUids.filter(id => id !== u.uid)
                            : [...createSessionForm.allowedUids, u.uid];
                          setCreateSessionForm({...createSessionForm, allowedUids: next});
                        }}
                        className={`w-full p-2.5 rounded-lg text-left flex items-center justify-between text-[11px] font-bold transition-all border ${
                          checked ? 'bg-primary/10 border-primary text-foreground' : 'bg-background border-transparent hover:bg-muted/30 text-muted-foreground'
                        }`}
                      >
                        <div className="flex flex-col">
                          <span>{u.displayName} ({u.position || '사원'} | {u.employeeId || '사번 없음'})</span>
                          <span className="text-[10px] text-muted-foreground font-semibold">
                            {u.departmentName || '소속 부서 없음'} {u.workplace ? `| ${u.workplace}` : ''}
                          </span>
                        </div>
                        <input type="checkbox" checked={checked} readOnly className="rounded-sm accent-primary cursor-pointer h-4 w-4" />
                      </button>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <button 
              onClick={() => setIsCreateSessionOpen(false)}
              className="px-6 py-3 bg-muted border border-border rounded-xl text-xs font-black hover:bg-muted/80 transition-colors cursor-pointer"
            >
              취소
            </button>
            <button 
              onClick={handleSaveNewSession}
              className="px-6 py-3 bg-primary text-white rounded-xl text-xs font-black hover:bg-primary/95 transition-colors cursor-pointer"
            >
              지정 구성으로 교육과정 등록 (개설)
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Session Delete Confirmation Dialog */}
      <Dialog open={isDeleteSessionOpen} onOpenChange={setIsDeleteSessionOpen}>
        <DialogContent className="bg-card border border-border text-foreground rounded-3xl max-w-sm p-6 overflow-hidden flex flex-col shadow-2xl space-y-4 max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="font-extrabold text-base text-red-500 flex items-center gap-2">
              <span className="p-1 px-2.5 rounded-lg bg-red-500/10 text-xs">일정 삭제</span>
              교육 일정 삭제 확인
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-semibold leading-relaxed pt-2">
              정말로 이 교육 일정을 전면 삭제하시겠습니까? 삭제 시 해당 회차의 수강 서명 기록 및 모든 평가 내역도 상실될 수 있으니 극히 주의하십시오.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex gap-2 pt-2">
            <button
              onClick={() => setIsDeleteSessionOpen(false)}
              className="flex-1 py-3 bg-muted text-foreground font-black text-xs rounded-xl active:scale-95 transition-all cursor-pointer"
            >
              취소
            </button>
            <button
              onClick={handleConfirmDeleteSession}
              className="flex-1 py-3 bg-red-500 text-white font-black text-xs rounded-xl active:scale-95 transition-all cursor-pointer hover:bg-red-600"
            >
              삭제 승인
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add New Category Dialog */}
      <Dialog open={isAddCategoryOpen} onOpenChange={setIsAddCategoryOpen}>
        <DialogContent className="bg-card border border-border text-foreground rounded-3xl max-w-sm p-6 overflow-hidden flex flex-col shadow-2xl space-y-4 max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="font-extrabold text-base text-primary flex items-center gap-2">
              <span className="p-1 px-2.5 rounded-lg bg-primary/10 text-xs">법정교육 분류</span>
              교육 카테고리 추가
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-semibold leading-relaxed pt-2">
              새로운 법정 정기 안전 보건 교육 카테고리를 개설합니다. 등록 후 임직원 교육 일지 대분류에서 즉시 연동됩니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 text-xs font-bold">
            <label className="text-[10px] text-muted-foreground uppercase tracking-widest pl-1">새 카테고리 명칭 (예: 화재/질식 대비훈련 교육)</label>
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="예: 밀폐구역 기압변동 특별훈련"
              className="w-full h-11 px-3.5 bg-muted rounded-xl border border-border text-sm font-bold focus:ring-1 focus:ring-primary text-foreground"
            />
          </div>

          <DialogFooter className="flex gap-2 pt-2">
            <button
              onClick={() => {
                setNewCategoryName('');
                setIsAddCategoryOpen(false);
              }}
              className="flex-1 py-3 bg-muted text-foreground font-black text-xs rounded-xl active:scale-95 transition-all cursor-pointer"
            >
              취소
            </button>
            <button
              onClick={handleAddNewCategory}
              className="flex-1 py-3 bg-primary text-white font-black text-xs rounded-xl active:scale-95 transition-all cursor-pointer hover:bg-primary/95"
            >
              카테고리 개설
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PCAdminLayout>
  );
};

export default PCAdminTraining;
