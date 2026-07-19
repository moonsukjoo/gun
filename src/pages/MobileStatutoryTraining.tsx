import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2,
  Calendar, 
  Clock, 
  Users, 
  FileCheck, 
  Printer, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  ChevronRight, 
  UserPlus, 
  HardHat, 
  Award,
  Video,
  ArrowLeft,
  Camera,
  CheckSquare,
  Square,
  Edit
} from 'lucide-react';
import { collection, onSnapshot, updateDoc, doc, setDoc, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';
import { UserProfile, StatutorySession, StatutoryCompletion } from '../types';
import * as XLSX from 'xlsx';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';

const CATEGORIES = [
  '현장안전 교육',
  '영상안전보건 교육',
  '월간 위험성평가 교육',
  '특별안전 교육',
  '신규입사자 교육'
];

const DEPARTMENTS = [
  '전체',
  '용접팀',
  '취부팀',
  '사상팀',
  '도장팀',
  '조립팀'
];

export default function MobileStatutoryTraining() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'REGISTER' | 'STATUS'>('STATUS');

  // Firestore sync states
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [statutorySessions, setStatutorySessions] = useState<StatutorySession[]>([]);
  const [statutoryCompletions, setStatutoryCompletions] = useState<StatutoryCompletion[]>([]);
  const [categories, setCategories] = useState<string[]>([
    '현장안전 교육',
    '영상안전보건 교육',
    '월간 위험성평가 교육',
    '특별안전 교육',
    '신규입사자 교육'
  ]);
  const [loading, setLoading] = useState(true);

  // Filter & Query States (for managing/printing)
  const [queryYear, setQueryYear] = useState<number>(new Date().getFullYear());
  const [queryMonth, setQueryMonth] = useState<number>(new Date().getMonth() + 1);
  const [queryRound, setQueryRound] = useState<number>(1);
  const [queryCategory, setQueryCategory] = useState<string>('현장안전 교육');
  const [queryDept, setQueryDept] = useState<string>('전체');

  // Sub-session selector under query
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');

  // Creation State - Supports MULTIPLE SELECTIONS ("중복 선택 가능")
  const [createYear, setCreateYear] = useState<number>(new Date().getFullYear());
  const [createMonth, setCreateMonth] = useState<number>(new Date().getMonth() + 1);
  const [createRound, setCreateRound] = useState<number>(1);
  const [createDept, setCreateDept] = useState<string>('전체');
  
  // Selected categories for multi-select creation
  const [selectedCreateCats, setSelectedCreateCats] = useState<string[]>(['현장안전 교육']);
  
  // Custom states per selected category
  const [categoryConfigs, setCategoryConfigs] = useState<Record<string, {
    durationMinutes: number;
    startTime: string;
    trainingDate: string;
    instructor: string;
    location: string;
    content: string;
    imageUrl: string;
    allowedUids?: string[];
  }>>({});

  // Reeducation Modal State
  const [isReeducationOpen, setIsReeducationOpen] = useState(false);
  const [activeParentSession, setActiveParentSession] = useState<StatutorySession | null>(null);
  const [selectedAbsentees, setSelectedAbsentees] = useState<string[]>([]); // worker UIDs
  const [reeducationForm, setReeducationForm] = useState({
    title: '',
    durationMinutes: 60,
    startTime: '14:00',
    trainingDate: new Date().toISOString().split('T')[0],
    instructor: '문석주 (안전관리자)',
    location: '탈의실',
    imageUrl: '',
    content: '### 법정 안전보건 불참자 특별 대면 교육 및 집중 지도 수칙\n\n본 정기 교육 불참 인원에 대한 소집 집체 교육을 실시하며, 사내 안전수칙을 엄격히 철하 재확인 지도합니다.'
  });

  // Session Edit & Delete States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [sessionToDeleteId, setSessionToDeleteId] = useState<string | null>(null);
  const [sessionToEdit, setSessionToEdit] = useState<StatutorySession | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    instructor: '',
    location: '',
    durationMinutes: 60,
    trainingDate: '',
    category: '',
    targetDepartment: '',
    content: '',
    allowedUids: [] as string[]
  });

  const [mobileSearchQuery, setMobileSearchQuery] = useState('');
  const [mobileWorkplaceFilter, setMobileWorkplaceFilter] = useState('ALL');

  const [mobileEditSearchQuery, setMobileEditSearchQuery] = useState('');
  const [mobileEditWorkplaceFilter, setMobileEditWorkplaceFilter] = useState('ALL');

  const handleOpenEdit = (session: StatutorySession) => {
    setSessionToEdit(session);
    setEditForm({
      title: session.title || '',
      instructor: session.instructor || '',
      location: session.location || '',
      durationMinutes: session.durationMinutes || 60,
      trainingDate: session.trainingDate || '',
      category: session.category || '',
      targetDepartment: session.targetDepartment || '전체',
      content: session.content || '',
      allowedUids: (session as any).allowedUids || []
    });
    setMobileEditSearchQuery('');
    setMobileEditWorkplaceFilter('ALL');
    setIsEditModalOpen(true);
  };

  const handleUpdateSession = async () => {
    if (!sessionToEdit) return;
    try {
      await updateDoc(doc(db, 'statutorySessions', sessionToEdit.id), {
        title: editForm.title,
        instructor: editForm.instructor,
        location: editForm.location,
        durationMinutes: Number(editForm.durationMinutes),
        trainingDate: editForm.trainingDate,
        category: editForm.category,
        targetDepartment: editForm.targetDepartment,
        content: editForm.content,
        allowedUids: editForm.allowedUids || []
      });
      setIsEditModalOpen(false);
      toast.success('교육 세션 정보가 성공적으로 수정되었습니다.');
    } catch (err) {
      console.error(err);
      toast.error('세션 수정에 실패했습니다.');
    }
  };

  const handleDeleteSession = (sessionId: string) => {
    setSessionToDeleteId(sessionId);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!sessionToDeleteId) return;
    try {
      await deleteDoc(doc(db, 'statutorySessions', sessionToDeleteId));
      setIsDeleteModalOpen(false);
      setSessionToDeleteId(null);
      toast.success('교육 일정이 삭제되었습니다.');
    } catch (err) {
      console.error(err);
      toast.error('세션 삭제에 실패했습니다.');
    }
  };

  const getCategorySuffix = (cat: string) => {
    if (cat.includes('현장')) return 'onsite';
    if (cat.includes('영상')) return 'video';
    if (cat.includes('위험성')) return 'risk';
    if (cat.includes('특별')) return 'special';
    if (cat.includes('신규')) return 'newhire';
    return cat.replace(/[^a-zA-Z0-9가-힣]/g, '').substring(0, 12);
  };

  // Sync data from Firestore
  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
      setLoading(false);
    }, (error) => {
      console.error("unsubUsers onSnapshot error: ", error);
    });

    const unsubSessions = onSnapshot(collection(db, 'statutorySessions'), (snap) => {
      setStatutorySessions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as StatutorySession)));
    }, (error) => {
      console.error("unsubSessions onSnapshot error: ", error);
    });

    const unsubCompletions = onSnapshot(collection(db, 'statutoryCompletions'), (snap) => {
      setStatutoryCompletions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as StatutoryCompletion)));
    }, (error) => {
      console.error("unsubCompletions onSnapshot error: ", error);
    });

    const unsubCats = onSnapshot(collection(db, 'statutoryCategories'), (snap) => {
      const defaults = ['현장안전 교육', '영상안전보건 교육', '월간 위험성평가 교육', '특별안전 교육', '신규입사자 교육'];
      if (!snap.empty) {
        const fetched = snap.docs.map(doc => doc.data().name as string);
        const unique = Array.from(new Set([...defaults, ...fetched]));
        setCategories(unique);
      } else {
        setCategories(defaults);
      }
    }, (error) => {
      console.error("unsubCats onSnapshot error: ", error);
    });

    return () => {
      unsubUsers();
      unsubSessions();
      unsubCompletions();
      unsubCats();
    };
  }, []);

  // Initialize Configurations for Selected Creation Categories
  useEffect(() => {
    const nextConfigs = { ...categoryConfigs };
    let changed = false;

    selectedCreateCats.forEach(cat => {
      if (!nextConfigs[cat]) {
        changed = true;
        const defaultContent = cat === '현장안전 교육' 
          ? `### 현장 밀폐구역 작업 안전 지침 및 통제 요령\n\n조선소 야드 내 탱크(Tank), 이중저(Double Bottom), 보이드 스페이스(Void Space) 등 밀폐구역은 산소 결핍 및 가스 인화로 인한 대형 재해 위험도가 극도로 빈번합니다.\n\n**[핵심 통제대책 및 행동 지침]**\n1. **산소 및 유해가스 농도 상시 계측**: 밀폐지대 출입구에서 센서 측정 장비를 완벽히 가동하여 산소 농도 18% 이상, 황화수소 10ppm 미만을 기록 계측하십시오.\n2. **강제 환기 펜 연속 기동**: 고효율 배풍기와 가요성 덕트를 깊게 안착시켜 정체된 흄과 먼지를 즉시 배기 하십시오.\n3. **투입 상시 무전 감시자 현장 배치**: 밀폐구역 맨홀 웰 바깥에 비상 대기용 마스크를 견지한 1명 이상의 감시인을 기공들과 상시 유지하십시오.`
          : cat === '영상안전보건 교육'
          ? `### 시청각 안전 보건 및 보호구 핵심 착용법 교육\n\n조선업 10대 기본 철칙 및 주요 추락 전도 충돌 협착 중점 예방을 시청하며 생명권을 파악하는 필수 단과 영상 코스입니다.\n\n**[영상 핵심 학습 수칙]**\n- **안전 버클 턱끈 밀착**: 사소한 턱끈 풀림이 머리 뇌 외상을 수반합니다. 귀 주위 통풍 루프를 타이트하게 고정하십시오.\n- **안전대 하네스 2구 고리 체결**: 2m 이상의 블록 연도 가설 고소작업 시 항시 와이어 하네스를 신뢰성 있는 볼트 지지 고리에 선조치 체결할 것.\n- **방진 가스 마스크 흡기 밸브 점검**: 그라인딩 사상 분진 노출 즉시 전용 카트리지를 확인 후 조임 스트랩 밀봉 교정.`
          : cat === '특별안전 교육'
          ? `### 크레인 및 중량물 특수취급 특별안전 교육\n\n갠트리 크레인 공동 작업 및 대형 선박 블록 인양, 지상 반경 붕괴/협착 위험 요소를 통제하기 위한 집중 교육입니다.\n\n**[중점 작업 통제 대책]**\n1. **인양 반경 출입 통제**: 와이어 인양 중에는 무조건 반경 30m 내 무단 유입을 금지하며 적색 경고 라인을 가동합니다.\n2. **공동 인양 무전 일원화**: 지정된 1인 메인 신호수의 무전 지시에만 슬링 고리원들이 일괄 동조해야 합니다.\n3. **줄걸이용 슬링벨트 상시 점검**: 매 작업 전 고리의 균열 및 벨트 강성 등을 점검하십시오.`
          : cat === '신규입사자 교육'
          ? `### 신규 입사자 기초 안전 보건 교육\n\n조선 생산 거점에 신규 배치된 사원들이 숙지해야 할 현장 10대 수칙 및 비상 대피 요령 교육입니다.\n\n**[기초 실천 수칙]**\n1. **현장 보호구 표준 완벽 착용**: 안전모 턱끈 조임, 방진마스크 밀착, 안전화 상시 착용을 생활화하십시오.\n2. **비상 대피로 및 모임 장소 확인**: 비상 사이렌 취명 시 유도로를 통해 안전 구역으로 신속 대피하십시오.\n3. **안전 불감증 배척**: 사소한 유해요소도 보고하여 아차사고를 미연에 원천 봉쇄하십시오.`
          : `### 갠트리 크레인 중량물 인양 반경 신호 수칙 위험성 평가\n\n초대형 선박 메가 블록 크레인 작업 구역의 붕괴, 불시기 낙하, 러깅 러그 파단 위해성에 대한 긴급 등급화 평가 교육안입니다.\n\n**[위험 특성 및 대책]**\n- **가해 요인**: 중량 인양물 유동 및 슬링 와이어 장력 이탈 피해서 낙하.\n- **위험도 등급**: 발생 대개 낮음, 사고시 치명 결과 (중대재해).\n- **현장 통제 조치**: 장비 중량 계측 기기 교정, 인양 가이드 통일 수신호 및 전용 무전 7채널 고정 준수. 반경 25미터 안전 옐로우 안전 테이프 바리케이트 설정.`;

        nextConfigs[cat] = {
          durationMinutes: 60,
          startTime: '09:00',
          trainingDate: new Date().toISOString().split('T')[0],
          instructor: '문석주 (안전관리자)',
          location: '탈의실',
          content: defaultContent,
          imageUrl: '',
          allowedUids: []
        };
      }
    });

    if (changed) {
      setCategoryConfigs(nextConfigs);
    }
  }, [selectedCreateCats]);

  // Image upload base64 compression helper for creation
  const handleConfigImageUpload = (category: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setCategoryConfigs(prev => ({
        ...prev,
        [category]: {
          ...prev[category],
          imageUrl: base64
        }
      }));
      toast.success(`${category} 현장 사진이 성공적으로 적용되었습니다.`);
    };
    reader.readAsDataURL(file);
  };

  // Image upload base64 compression helper for re-education
  const handleReeducationImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setReeducationForm(prev => ({ ...prev, imageUrl: base64 }));
      toast.success(`재교육 증빙 사진이 적용되었습니다.`);
    };
    reader.readAsDataURL(file);
  };

  // Toggle selected categories for creation
  const handleToggleCreateCategory = (cat: string) => {
    if (selectedCreateCats.includes(cat)) {
      if (selectedCreateCats.length === 1) {
        toast.warning('최소 1개 이상의 교육 종류를 선택하셔야 합니다.');
        return;
      }
      setSelectedCreateCats(selectedCreateCats.filter(c => c !== cat));
    } else {
      setSelectedCreateCats([...selectedCreateCats, cat]);
    }
  };

  // Save multiple sessions in a batch
  const handleSaveSessionsBatch = async () => {
    if (selectedCreateCats.length === 0) {
      toast.error('선택된 교육 종류가 없습니다.');
      return;
    }

    try {
      for (const cat of selectedCreateCats) {
        const config = categoryConfigs[cat];
        if (!config) continue;

        const targetId = `${createYear}_${String(createMonth).padStart(2, '0')}_${createRound}_${getCategorySuffix(cat)}_${createDept}`;
        const titleText = `${createMonth}월 ${createRound}회차 법정 정기 ${cat}`;

        const newSession: StatutorySession = {
          id: targetId,
          title: titleText,
          year: createYear,
          month: createMonth,
          round: createRound,
          category: cat,
          content: config.content,
          targetDepartment: createDept,
          instructor: config.instructor,
          location: `${config.location} (${config.startTime} 시작)`,
          durationMinutes: config.durationMinutes,
          trainingMethod: cat === '영상안전보건 교육' ? 'ONLINE' : 'ONSITE',
          trainingDate: config.trainingDate,
          createdAt: new Date().toISOString(),
          imageUrl: config.imageUrl || '',
          allowedUids: config.allowedUids || []
        } as any;

        await setDoc(doc(db, 'statutorySessions', targetId), newSession);
      }

      if (selectedCreateCats.length > 0) {
        setQueryYear(createYear);
        setQueryMonth(createMonth);
        setQueryRound(createRound);
        setQueryCategory(selectedCreateCats[0]);
        setQueryDept(createDept);
      }

      toast.success('선택하신 법정 안전보건 교육 세션들이 성공적으로 실시간 일괄 일지 등록 및 배포되었습니다.');
      setActiveTab('STATUS');
    } catch (e) {
      console.error(e);
      toast.error('안건 등록 도중 예기치 못한 데이터베이스 타임아웃 오류가 발생했습니다.');
    }
  };

  // Retrieve current active sessions list based on query filter
  const currentQuerySessionId = `${queryYear}_${String(queryMonth).padStart(2, '0')}_${queryRound}_${getCategorySuffix(queryCategory)}_${queryDept || '전체'}`;
  
  // Find standard main session
  const matchedSession = statutorySessions.find(s => s.id === currentQuerySessionId);

  // Find all reeducation sessions linked to this year_month_round_category_dept
  const matchingReeducationSessions = statutorySessions.filter(
    s => (s as any).isReeducation && 
         (s as any).parentSessionId === currentQuerySessionId
  );

  // Computed employees for the selected department
  const filteredWorkers = users.filter(u => {
    if (!u.isActive) return false;
    if (queryDept === '전체') return true;
    return u.departmentName === queryDept || u.jobRole === queryDept;
  });

  // Main session completed count
  const completedCount = filteredWorkers.filter(u => 
    statutoryCompletions.some(c => c.uid === u.uid && c.sessionId === currentQuerySessionId)
  );

  // Absent workers list for the parent session
  const absentWorkers = filteredWorkers.filter(u => 
    !statutoryCompletions.some(c => c.uid === u.uid && c.sessionId === currentQuerySessionId)
  );

  // Excel Export for the main session or sub-session
  const handleExportExcel = (sessionId: string, sessionTitle: string) => {
    const currentSessionMatches = statutorySessions.find(s => s.id === sessionId);
    if (!currentSessionMatches) return;

    // Filter workers who belong or are allowed to this session
    const targetWorkersForExcel = (currentSessionMatches as any).isReeducation && (currentSessionMatches as any).allowedUids
      ? users.filter(u => (currentSessionMatches as any).allowedUids.includes(u.uid))
      : filteredWorkers;

    const reportRows = targetWorkersForExcel.map((u, i) => {
      const comp = statutoryCompletions.find(c => c.uid === u.uid && c.sessionId === sessionId);
      return {
        '순번': i + 1,
        '부서명': u.departmentName || '기타',
        '직급': u.position || '사원',
        '성명': u.displayName,
        '사원번호': u.employeeId || '',
        '수강 구분': (currentSessionMatches as any).isReeducation ? '불참자 특별재교육' : '정기 의무 교육',
        '이수 여부': comp ? '이수완료' : '불참',
        '평가 등급': comp ? 'A (합격)' : '-',
        '완료일정/친필날인': comp && comp.completedAt ? comp.completedAt.replace('T', ' ').substring(0, 16) : '미이수'
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(reportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '이수현황표');
    XLSX.writeFile(workbook, `${sessionTitle.replace(/ /g, '_')}_명부대장.xlsx`);
    toast.success('이수현황 Microsoft Excel 대장 다운로드가 성공되었습니다.');
  };

  // Beautiful printing matching formatting
  const handlePrintPDF = (sessionId: string) => {
    const sessionToPrint = statutorySessions.find(s => s.id === sessionId);
    if (!sessionToPrint) {
      toast.error('세션 정보를 조회할 수 없습니다.');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('인쇄를 위한 팝업 차단 설정을 확인해 주십시오.');
      return;
    }

    // Filter target personnel
    const isRe = (sessionToPrint as any).isReeducation;
    const targetWorkers = isRe && (sessionToPrint as any).allowedUids
      ? users.filter(u => (sessionToPrint as any).allowedUids.includes(u.uid))
      : filteredWorkers;

    const doneCount = targetWorkers.filter(u => 
      statutoryCompletions.some(c => c.uid === u.uid && c.sessionId === sessionId)
    ).length;

    const nonDoneWorkers = targetWorkers.filter(u => 
      !statutoryCompletions.some(c => c.uid === u.uid && c.sessionId === sessionId)
    );

    let rowsHtml = '';
    targetWorkers.forEach((u, i) => {
      const comp = statutoryCompletions.find(c => c.uid === u.uid && c.sessionId === sessionId);
      const attendanceImg = comp 
        ? `<img src="${comp.signatureUrl}" style="height: 30px; max-width: 75px; object-fit: contain;" />` 
        : '<span style="color: #ef4444; font-weight: 900; font-size: 11px;">※ 불참대기</span>';

      const evalImg = comp?.evalSignatureUrl
        ? `<img src="${comp.evalSignatureUrl}" style="height: 30px; max-width: 75px; object-fit: contain;" />` 
        : comp
          ? '<span style="color: #ea580c; font-weight: bold; font-size: 11px;">평가 무기명</span>'
          : '<span style="color: #ef4444; font-weight: 950; font-size: 11px;">-</span>';

      const gradeText = comp?.evaluationGrade
        ? comp.evaluationGrade
        : comp
          ? '우수 (A)'
          : '-';

      rowsHtml += `
        <tr style="height: 42px;">
          <td align="center" style="border: 1px solid #000; font-size: 12px;">${i + 1}</td>
          <td style="border: 1px solid #000; padding-left: 8px; font-size: 12px;">${u.departmentName || '야드'}</td>
          <td align="center" style="border: 1px solid #000; font-size: 12px;">${u.position || '기공'}</td>
          <td align="center" style="border: 1px solid #000; font-weight: bold; font-size: 12px;">${u.displayName}</td>
          <td align="center" style="border: 1px solid #000; font-size: 11px;">${u.employeeId || '-'}</td>
          <td align="center" style="border: 1px solid #000; font-weight: bold; font-size: 12px; color: ${comp ? '#10b981' : '#f43f5e'}">
            ${comp ? '이수 완료' : '미이수'}
          </td>
          <td align="center" style="border: 1px solid #000; font-size: 11px; font-weight: 850;">
            ${gradeText}
          </td>
          <td align="center" valign="middle" style="border: 1px solid #000; background-color: #fafafa; padding: 4px;">${attendanceImg}</td>
          <td align="center" valign="middle" style="border: 1px solid #000; background-color: #fafafa; padding: 4px;">${evalImg}</td>
        </tr>
      `;
    });

    const completionRate = ((doneCount / (targetWorkers.length || 1)) * 100).toFixed(1);

    // Render image section if uploaded in database
    const uploadedImageHtml = (sessionToPrint as any).imageUrl 
      ? `
        <div style="font-size: 14px; font-weight: bold; margin-bottom: 8px; border-left: 4px solid #f43f5e; padding-left: 8px; margin-top: 25px;">4. 교육 현장 전경 및 실무 배치 실증 사진 (보안 엄수)</div>
        <div style="border: 1px solid #000; padding: 15px; text-align: center; margin-bottom: 25px; background: #ffffff;">
          <img src="${(sessionToPrint as any).imageUrl}" style="max-height: 250px; max-width: 100%; object-fit: contain; border-radius: 6px;" />
          <p style="font-size: 11px; color: #666; font-weight: bold; margin-top: 8px; margin-bottom: 0;">※ 영등 야드 내 안전훈련 실증 증빙용 현장 사진</p>
        </div>
      `
      : '';

    const displayYear = String(sessionToPrint.year || new Date().getFullYear()).substring(2, 4);
    const displayMonth = String(sessionToPrint.month || (new Date().getMonth() + 1)).padStart(2, '0');
    const doctitle = `${displayYear}년 ${displayMonth}월 안전보건교육 기록훈련표${isRe ? ' (불참자재교육)' : ''}`;

    const htmlContent = `
      <html>
      <head>
        <title>${sessionToPrint.title}</title>
        <style>
          body { font-family: 'Malgun Gothic', 'Noto Sans KR', sans-serif; padding: 30px; color: #000; line-height: 1.4; background-color: #fff; }
          .container { max-width: 820px; margin: 0 auto; border: 2px solid #000; padding: 25px; background-color: #fff; }
          .title { text-align: center; font-size: 26px; font-weight: 900; margin-bottom: 25px; text-decoration: underline; letter-spacing: 3px; }
          .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .meta-table th, .meta-table td { border: 1px solid #000; padding: 6px 8px; font-size: 11px; text-align: left; }
          .meta-table th { background-color: #f2f2f2; font-weight: bold; width: 14%; text-align: center; }
          .content-box { border: 1px solid #000; padding: 15px; min-height: 110px; font-size: 12px; background-color: #fafafa; white-space: pre-wrap; margin-bottom: 20px; font-family: inherit; }
          .section-title { font-size: 13px; font-weight: bold; margin-bottom: 8px; border-left: 4px solid #10b981; padding-left: 8px; margin-top: 25px; }
          .member-table { width: 100%; border-collapse: collapse; margin-block: 15px; }
          .stats-grid { width: 100%; border-collapse: collapse; margin-block: 25px; text-align: center; }
          .stats-grid td { border: 1px solid #000; padding: 10px; font-size: 13px; }
          .footer { text-align: right; margin-top: 40px; font-size: 13px; font-weight: bold; }
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
          <div class="title">${doctitle}</div>
          
          <table class="meta-table">
            <tr>
              <th>과 정 명</th>
              <td colspan="3" style="font-weight: bold; font-size: 13px;">${sessionToPrint.title}</td>
              <th rowspan="4" style="width: 35px; writing-mode: vertical-rl; letter-spacing: 12px; padding: 4px; font-size: 13px; text-align: center; background: #fafafa; font-weight: bold;">결재</th>
              <td style="width: 60px; height: 18px; text-align: center; font-size: 10px; font-weight: bold; background: #fafafa; padding: 2px;">작성자</td>
              <td style="width: 60px; text-align: center; font-size: 10px; font-weight: bold; background: #fafafa; padding: 2px;">검토자</td>
              <td style="width: 60px; text-align: center; font-size: 10px; font-weight: bold; background: #fafafa; padding: 2px;">승인자</td>
            </tr>
            <tr>
              <th>교육 구분</th>
              <td>${isRe ? '불참자 소집 특별재교육' : '정기 의무 법정교육'}</td>
              <th>대상 부서</th>
              <td style="font-weight: bold;">${sessionToPrint.targetDepartment} (조사정원: ${targetWorkers.length}명)</td>
              <td rowspan="3" style="height: 50px; text-align: center; vertical-align: middle; font-size: 10px;">&nbsp;</td>
              <td rowspan="3" style="text-align: center; vertical-align: middle; font-size: 10px;">&nbsp;</td>
              <td rowspan="3" style="text-align: center; vertical-align: middle; font-size: 10px;">&nbsp;</td>
            </tr>
            <tr>
              <th>수강 방식</th>
              <td style="font-weight: bold; color: ${sessionToPrint.trainingMethod === 'ONLINE' ? '#2563eb' : '#ea580c'}">
                ${sessionToPrint.trainingMethod === 'ONLINE' ? '온라인 시청각 (ONLINE/비대면)' : '현장 실증 대면 (ONSITE/집합)'}
              </td>
              <th>교육 시간</th>
              <td>${sessionToPrint.durationMinutes || 60}분 (법정의무 수강 완수)</td>
            </tr>
            <tr>
              <th>지도 강사</th>
              <td>${sessionToPrint.instructor}</td>
              <th>교육 장소</th>
              <td>${sessionToPrint.location}</td>
            </tr>
          </table>

          <div class="section-title">1. 안전보건 교육 세부계획 수칙 내용</div>
          <div class="content-box">${sessionToPrint.content}</div>

          ${uploadedImageHtml}

          <div class="section-title">3. 임직원 자필 이수 서명대장 (참석 날인 및 학업 성취도 평가검인)</div>
          <table class="member-table">
            <thead>
              <tr style="background-color: #f2f2f2; height: 35px;">
                <th style="border: 1px solid #000; font-size: 11px;" width="6%">순번</th>
                <th style="border: 1px solid #000; font-size: 11px;" width="16%">소속 파트</th>
                <th style="border: 1px solid #000; font-size: 11px;" width="10%">직급</th>
                <th style="border: 1px solid #000; font-size: 11px;" width="13%">성명</th>
                <th style="border: 1px solid #000; font-size: 11px;" width="13%">사원번호</th>
                <th style="border: 1px solid #000; font-size: 11px;" width="12%">이수현황</th>
                <th style="border: 1px solid #000; font-size: 11px;" width="10%">평가결과</th>
                <th style="border: 1px solid #000; font-size: 11px;" width="13%">참석 서명</th>
                <th style="border: 1px solid #000; font-size: 11px;" width="13%">평가 서명</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="section-title">4. 법정 안전 수강집계 통계량</div>
          <table class="stats-grid">
            <tr style="background-color: #f9f9f9; font-weight: bold;">
              <td>소요 정원 (명)</td>
              <td>정상 수료 (명)</td>
              <td>미참석자 (명)</td>
              <td>의무 달성율 (%)</td>
            </tr>
            <tr style="font-size: 15px; font-weight: bold;">
              <td>${targetWorkers.length}</td>
              <td style="color: #10b981;">${doneCount}</td>
              <td style="color: #ef4444;">${nonDoneWorkers.length}</td>
              <td style="color: #2563eb;">${completionRate}%</td>
            </tr>
          </table>

          <div class="footer">
          </div>
        </div>
        <script>
          window.focus();
          setTimeout(function() { window.print(); }, 600);
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Open Re-education registration setup
  const handleOpenReeducationModal = (parentSession: StatutorySession) => {
    // Collect absent workers
    const abs = filteredWorkers.filter(u => 
      !statutoryCompletions.some(c => c.uid === u.uid && c.sessionId === parentSession.id)
    );

    if (abs.length === 0) {
      toast.success('본 세션의 모든 인원이 이수를 완료하였습니다.');
      return;
    }

    setActiveParentSession(parentSession);
    setSelectedAbsentees(abs.map(a => a.uid)); // Select all absentees by default
    setReeducationForm({
      title: `[재교육] ${parentSession.title}`,
      durationMinutes: parentSession.durationMinutes || 60,
      startTime: '15:00',
      trainingDate: new Date().toISOString().split('T')[0],
      instructor: parentSession.instructor || '문석주 (안전관리자)',
      location: parentSession.location?.split('(')[0]?.trim() || '탈의실',
      imageUrl: '',
      content: `### 법정 안전보건 불참자 특별 대면 재교육\n\n- **소속 세션**: ${parentSession.title}\n- **대상 사유**: 당회 안전보건 의무 교육 무단 불참 및 미수강자 강제 소집\n\n**[중점 재지도 및 수칙]**\n1. 조선소 현장 10대 야드 안전 준수 조항 필사 확인 및 확인 서명\n2. 지급용 표준 방진 가스마스크 여과 필터 밀봉 실습 및 공과 완벽 숙련\n3. 미준수 상태 발견 적발 즉시 직무 정지 등 처분 재확약.`
    });
    setIsReeducationOpen(true);
  };

  // Submit Re-education Session
  const handleSaveReeducation = async () => {
    if (!activeParentSession) return;
    if (selectedAbsentees.length === 0) {
      toast.error('재교육 대상 임직원을 1명 이상 선택해 주십시오.');
      return;
    }

    const reSessionId = `re_${activeParentSession.id}_${Date.now()}`;
    const newReSession: StatutorySession = {
      id: reSessionId,
      title: reeducationForm.title,
      year: activeParentSession.year,
      month: activeParentSession.month,
      round: activeParentSession.round,
      category: activeParentSession.category,
      content: reeducationForm.content,
      targetDepartment: activeParentSession.targetDepartment,
      instructor: reeducationForm.instructor,
      location: `${reeducationForm.location} (${reeducationForm.startTime} 시작)`,
      durationMinutes: Number(reeducationForm.durationMinutes),
      trainingMethod: 'ONSITE',
      trainingDate: reeducationForm.trainingDate,
      createdAt: new Date().toISOString(),
      // Re-education specific fields
      isReeducation: true,
      parentSessionId: activeParentSession.id,
      allowedUids: selectedAbsentees,
      imageUrl: reeducationForm.imageUrl || ''
    } as any;

    try {
      await setDoc(doc(db, 'statutorySessions', reSessionId), newReSession);
      
      // Let's send an urgent notification to all selected absentees for re-education!
      for (const uid of selectedAbsentees) {
        const notifId = `notice_reedu_${reSessionId}_${uid}`;
        const targetUser = users.find(u => u.uid === uid);
        const msg = `${targetUser?.displayName || '임직원'}님, [불참자 소집 특별재교육] 수강 배포 완료되었습니다. 즉시 참석 후 친필과 평가 날인을 모바일에서 완마하여 주십시오.`;
        
        await setDoc(doc(db, 'notifications', notifId), {
          id: notifId,
          uid: uid,
          title: '🚨 법정 정기 재교육 대상 수강명령 지시서',
          message: msg,
          body: msg,
          type: 'SYSTEM',
          isRead: false,
          status: 'UNREAD',
          createdAt: new Date().toISOString()
        });
      }

      setIsReeducationOpen(false);
      toast.success('불참자 특별 동조 재교육 세션 개설 및 폰 알람 강제 지령 하달 완료!');
    } catch (e) {
      console.error(e);
      toast.error('재교육 등록 중 저장오류가 발행했습니다.');
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-24 md:px-4">
      {/* Smart Mobile Header */}
      <div className="sticky top-0 z-40 backdrop-blur-md bg-background/80 border-b border-border py-4 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/admin')}
            className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground active:scale-90 transition-all border border-border"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base font-black tracking-tight leading-tight">법정 정기교육 관리 (모바일)</h1>
            <p className="text-[10px] font-bold text-muted-foreground">현장 모바일 즉흥 개설 및 보고일지 이수 날인서 수집</p>
          </div>
        </div>

        <Badge className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] font-black">
          실시간 관제
        </Badge>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-6">
        
        {/* Navigation Tabs - Mobile Optimized */}
        <div className="grid grid-cols-2 gap-1 bg-muted p-1 rounded-2xl border border-border">
          <button
            onClick={() => setActiveTab('STATUS')}
            className={`py-3 rounded-xl text-xs font-black transition-all ${
              activeTab === 'STATUS' 
                ? 'bg-card text-foreground shadow-sm' 
                : 'text-muted-foreground/70 hover:text-foreground'
            }`}
          >
            대장 대조 & 재교육 관리
          </button>
          <button
            onClick={() => setActiveTab('REGISTER')}
            className={`py-3 rounded-xl text-xs font-black transition-all ${
              activeTab === 'REGISTER' 
                ? 'bg-card text-foreground shadow-sm' 
                : 'text-muted-foreground/70 hover:text-foreground'
            }`}
          >
            안전교육 즉시 일괄 소집
          </button>
        </div>

        {/* Tab 1: STATUS AND REEDUCATION MANAGEMENT */}
        {activeTab === 'STATUS' && (
          <div className="space-y-6">
            
            {/* Registered Sessions List */}
            <Card className="rounded-[2rem] border border-border bg-card shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <HardHat className="w-5 h-5 text-primary" />
                  <span className="text-sm font-black text-foreground">📢 개설 및 배포된 법정교육 목록 ({statutorySessions.filter(s => !(s as any).isReeducation).length})</span>
                </div>
              </div>

              {statutorySessions.filter(s => !(s as any).isReeducation).length === 0 ? (
                <p className="text-xs text-muted-foreground font-semibold text-center py-4">등록된 법정교육 일정이 없습니다.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
                  {statutorySessions.filter(s => !(s as any).isReeducation).map((s) => {
                    const isSelected = 
                      queryYear === s.year &&
                      queryMonth === s.month &&
                      queryRound === s.round &&
                      queryCategory === s.category &&
                      queryDept === (s.targetDepartment || '전체');

                    return (
                      <div 
                        key={s.id} 
                        className={`p-4 rounded-2xl border transition-all space-y-2 flex flex-col justify-between ${
                          isSelected 
                            ? 'border-primary/60 bg-primary/5 shadow-xs' 
                            : 'border-border bg-muted/30 hover:bg-muted/50'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                              {s.year}년 · {s.month}월 · {s.round}회차
                            </span>
                            <span className="text-[10px] font-bold text-muted-foreground truncate">
                              대상: {s.targetDepartment || '전체'}
                            </span>
                          </div>
                          
                          <h4 className="text-xs font-black text-foreground line-clamp-1">
                            {s.title}
                          </h4>

                          <div className="text-[10px] text-muted-foreground font-semibold space-y-0.5">
                            <p>• 분류: {s.category}</p>
                            <p>• 강사: {s.instructor}</p>
                            <p>• 장소: {s.location}</p>
                            <p>• 일자: {s.trainingDate || '미지정'}</p>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-border/50">
                          <button
                            onClick={() => {
                              setQueryYear(s.year);
                              setQueryMonth(s.month);
                              setQueryRound(s.round);
                              setQueryCategory(s.category);
                              setQueryDept(s.targetDepartment || '전체');
                              toast.info(`'${s.title}'의 이수 현황이 아래에 로드되었습니다.`);
                            }}
                            className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black transition-all ${
                              isSelected 
                                ? 'bg-primary text-white shadow-xs' 
                                : 'bg-muted border border-border text-foreground hover:bg-card'
                            }`}
                          >
                            수강 대장 조회
                          </button>
                          
                          <button
                            onClick={() => handleOpenEdit(s)}
                            className="p-1.5 bg-muted hover:bg-card border border-border rounded-lg text-foreground hover:text-primary transition-all"
                            title="수정"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDeleteSession(s.id)}
                            className="p-1.5 bg-muted hover:bg-red-500/10 border border-border rounded-lg text-foreground hover:text-red-500 transition-all"
                            title="삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Filter Card */}
            <Card className="rounded-[2rem] border border-border bg-card shadow-sm p-5 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-border">
                <Calendar className="w-4 h-4 text-primary" />
                <span className="text-xs font-black">교육 계획 일정 대조 선택</span>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground">년도</label>
                  <select 
                    value={queryYear} 
                    onChange={(e) => setQueryYear(Number(e.target.value))}
                    className="w-full bg-muted border border-border rounded-xl text-xs font-bold px-3 py-2.5"
                  >
                    <option value={2025}>2025년</option>
                    <option value={2026}>2026년</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground">월분</label>
                  <select 
                    value={queryMonth} 
                    onChange={(e) => setQueryMonth(Number(e.target.value))}
                    className="w-full bg-muted border border-border rounded-xl text-xs font-bold px-3 py-2.5"
                  >
                    {[...Array(12)].map((_, i) => (
                      <option key={i+1} value={i+1}>{i+1}월 정기</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground">회차 구분</label>
                  <select 
                    value={queryRound} 
                    onChange={(e) => setQueryRound(Number(e.target.value))}
                    className="w-full bg-muted border border-border rounded-xl text-xs font-bold px-3 py-2.5"
                  >
                    <option value={1}>1회차 (전반기)</option>
                    <option value={2}>2회차 (후반기)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground">조사 대상팀</label>
                  <select 
                    value={queryDept} 
                    onChange={(e) => setQueryDept(e.target.value)}
                    className="w-full bg-muted border border-border rounded-xl text-xs font-bold px-3 py-2.5"
                  >
                    {DEPARTMENTS.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground">의무 교육 종류</label>
                <select 
                  value={queryCategory} 
                  onChange={(e) => setQueryCategory(e.target.value)}
                  className="w-full bg-muted border border-border rounded-xl text-xs font-bold px-3 py-2.5"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </Card>

            {/* Selected Session Info */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-black text-muted-foreground tracking-wider uppercase">조회된 배포 교육 실증</h2>
              </div>

              {matchedSession ? (
                <div className="space-y-4">
                  {/* Primary card info */}
                  <Card className="rounded-[2rem] border border-emerald-500/20 bg-card shadow-sm p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <Badge className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-lg text-[9px] font-black">
                        활성화 정기 교육안
                      </Badge>
                      <span className="text-[10px] font-bold text-muted-foreground">
                        {matchedSession.trainingDate || '실시 미지정'}
                      </span>
                    </div>

                    <div className="space-y-1.5 centrale-text">
                      <h3 className="text-base font-black text-foreground tracking-tight leading-snug">
                        {matchedSession.title}
                      </h3>
                      <div className="text-[11px] text-muted-foreground font-bold space-y-0.5">
                        <p>• 강사: {matchedSession.instructor}</p>
                        <p>• 장소: {matchedSession.location}</p>
                        <p>• 설계시간: <span className="text-primary">{matchedSession.durationMinutes || 60}분</span></p>
                        <p>• 이수방법: {matchedSession.trainingMethod === 'ONLINE' ? '비대면 영상' : '현장 집체대면'}</p>
                      </div>
                    </div>

                    {/* Progress Bar of Completion */}
                    <div className="pt-2 border-t border-border space-y-1.5">
                      <div className="flex justify-between items-center text-[11px] font-black text-foreground">
                        <span>전체 소속 이수율</span>
                        <span className="text-primary">
                          {completedCount.length}명 / {filteredWorkers.length}명 ({((completedCount.length / (filteredWorkers.length || 1)) * 100).toFixed(1)}%)
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden border border-border">
                        <div 
                          className="h-full bg-emerald-500 transition-all duration-700"
                          style={{ width: `${(completedCount.length / (filteredWorkers.length || 1)) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Report Image Display box - "똑같이 이미지 업로드한것처럼 나오게" */}
                    {matchedSession.imageUrl ? (
                      <div className="pt-3 border-t border-border space-y-2">
                        <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" /> 증빙 보고 교육 현장 전경 사진 수집 완료
                        </span>
                        <div className="relative aspect-video rounded-2xl overflow-hidden border border-border bg-black/40">
                          <img 
                            src={matchedSession.imageUrl} 
                            alt="Training Session Photo"
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="pt-3 border-t border-border space-y-2">
                        <span className="text-[10px] font-bold text-amber-500 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-500" /> 증빙 검진 현장 사진 없음
                        </span>
                        <label className="flex flex-col items-center justify-center border border-dashed border-border rounded-2xl py-4 bg-muted/30 cursor-pointer active:bg-muted transition-all">
                          <Camera className="w-5 h-5 text-muted-foreground mb-1" />
                          <span className="text-[10px] font-black text-muted-foreground">여기 터치하여 교육 현장 사진 업로딩</span>
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = async (event) => {
                                  const base64 = event.target?.result as string;
                                  try {
                                    await updateDoc(doc(db, 'statutorySessions', matchedSession.id), { imageUrl: base64 });
                                    toast.success('법정 세션의 증빙 교육 실충 전경사진 저장에 성공했습니다!');
                                  } catch (err) {
                                    toast.error('전경 이미지 저장 실패');
                                  }
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>
                      </div>
                    )}

                    {/* Operational Action Row */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
                      <button
                        onClick={() => handleExportExcel(matchedSession.id, matchedSession.title)}
                        className="py-2.5 bg-muted rounded-xl text-[10px] font-black text-foreground flex items-center justify-center gap-1.5 active:scale-95 transition-all text-center border border-border"
                      >
                        <Download className="w-3.5 h-3.5 text-emerald-500" />
                        대장 엑셀저장
                      </button>
                      <button
                        onClick={() => handlePrintPDF(matchedSession.id)}
                        className="py-2.5 bg-primary text-white rounded-xl text-[10px] font-black flex items-center justify-center gap-1.5 active:scale-95 transition-all text-center"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        법정일지 인쇄
                      </button>
                    </div>

                    {/* Bulkamja Reeducation Registrant Action */}
                    {absentWorkers.length > 0 && (
                      <button
                        onClick={() => handleOpenReeducationModal(matchedSession)}
                        className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-500 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all mt-1"
                      >
                        <AlertTriangle className="w-4 h-4" />
                        불참자 특별 재교육 즉각 배포 ({absentWorkers.length}명 대상)
                      </button>
                    )}
                  </Card>

                  {/* SUB-TAB or Sub-area for associated Reeducation Sessions */}
                  {matchingReeducationSessions.length > 0 && (
                    <div className="space-y-3 mt-4">
                      <h3 className="text-xs font-black text-red-500 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" /> 본 정기 교육의 불참 수강재교육 대장
                      </h3>
                      {matchingReeducationSessions.map((reSession) => {
                        const recComps = statutoryCompletions.filter(c => c.sessionId === reSession.id);
                        const allowedCount = (reSession as any).allowedUids?.length || 0;
                        return (
                          <Card key={reSession.id} className="rounded-2xl border border-red-500/20 bg-card p-5 space-y-3 shadow-xs">
                            <div className="flex items-center justify-between">
                              <Badge className="bg-red-500/10 text-red-500 border border-red-500/20 rounded-md text-[9px] font-bold">
                                특별 소집 재교육
                              </Badge>
                              <span className="text-[10px] font-bold text-muted-foreground">{reSession.trainingDate}</span>
                            </div>

                            <div className="space-y-1">
                              <h4 className="text-xs font-black text-foreground">{reSession.title}</h4>
                              <p className="text-[10px] text-muted-foreground font-semibold">
                                • 대상: {allowedCount}명 / 완료서명자: <span className="text-emerald-500 font-bold">{recComps.length}명</span>
                              </p>
                              <p className="text-[10px] text-muted-foreground font-semibold">• 장소: {reSession.location}</p>
                            </div>

                            {reSession.imageUrl && (
                              <div className="aspect-video relative rounded-xl overflow-hidden border border-border">
                                <img src={reSession.imageUrl} alt="Re-edu Photo" className="w-full h-full object-cover" />
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
                              <button
                                onClick={() => handleExportExcel(reSession.id, reSession.title)}
                                className="py-2 bg-muted rounded-lg text-[9px] font-black text-foreground flex items-center justify-center gap-1"
                              >
                                <Download className="w-3 h-3 text-emerald-500" />
                                명부 Excel
                              </button>
                              <button
                                onClick={() => handlePrintPDF(reSession.id)}
                                className="py-2 bg-red-650 bg-red-500 text-white rounded-lg text-[9px] font-black flex items-center justify-center gap-1"
                              >
                                <Printer className="w-3 h-3" />
                                재일지 인쇄
                              </button>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  )}

                  {/* Worker completion list detail */}
                  <Card className="rounded-[2.5rem] border border-border bg-card shadow-sm p-6 space-y-4">
                    <h3 className="text-xs font-black text-foreground">소속원 개별 서식 날인 현황</h3>
                    <div className="divide-y divide-border">
                      {filteredWorkers.map(w => {
                        const comp = statutoryCompletions.find(c => c.uid === w.uid && c.sessionId === matchedSession.id);
                        return (
                          <div key={w.uid} className="py-3 flex items-center justify-between">
                            <div className="min-w-0 flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center font-black text-xs text-muted-foreground">
                                {w.displayName[0]}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-black text-foreground truncate">{w.displayName}</p>
                                <p className="text-[9px] font-bold text-muted-foreground uppercase">{w.position || '사원'} | {w.employeeId || '임시'}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                {comp ? (
                                  <span className="text-[10px] font-black text-emerald-500 block">이수완료 (A등급)</span>
                                ) : (
                                  <span className="text-[10px] font-extrabold text-rose-450 text-rose-500 block">※ 불참 미이수</span>
                                )}
                              </div>
                              {comp && comp.signatureUrl ? (
                                <img 
                                  src={comp.signatureUrl} 
                                  alt="Sign" 
                                  className="w-10 h-7 object-contain bg-white border border-border rounded"
                                />
                              ) : (
                                <div className="w-10 h-7 bg-muted border border-dashed border-border rounded flex items-center justify-center text-[10px] text-muted-foreground">
                                  대기
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                </div>
              ) : (
                <div className="border border-dashed border-border rounded-[2.5rem] p-10 text-center bg-card space-y-4">
                  <AlertTriangle className="w-10 h-10 mx-auto text-amber-550 text-amber-500" />
                  <div className="space-y-1">
                    <h4 className="text-sm font-black text-foreground">해당 사서 세션이 개설되지 않았습니다</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      우측 [안전교육 즉시 일괄 소집] 탭을 눌러 본 기수를 즉석 개설하시면 수강 대장이 설립됩니다.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: BATCH REGISTER SESSIONS (중복 선택 및 세부 수강/시작시간 입력 가능) */}
        {activeTab === 'REGISTER' && (
          <div className="space-y-6">
            <Card className="rounded-[2.5rem] border border-border bg-card p-6 space-y-5 shadow-sm">
              <h2 className="text-sm font-black text-foreground border-b border-border pb-3 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-primary" />
                모바일 교육 소집 기획안 등록
              </h2>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground">년도</label>
                  <select 
                    value={createYear} 
                    onChange={(e) => setCreateYear(Number(e.target.value))}
                    className="w-full bg-muted border border-border rounded-xl text-xs font-semibold px-3 py-2.5 text-foreground"
                  >
                    <option value={2025}>2025년</option>
                    <option value={2026}>2026년</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground">월분</label>
                  <select 
                    value={createMonth} 
                    onChange={(e) => setCreateMonth(Number(e.target.value))}
                    className="w-full bg-muted border border-border rounded-xl text-xs font-semibold px-3 py-2.5 text-foreground"
                  >
                    {[...Array(12)].map((_, i) => (
                      <option key={i+1} value={i+1}>{i+1}월 정기분</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground">기수 회차</label>
                  <select 
                    value={createRound} 
                    onChange={(e) => setCreateRound(Number(e.target.value))}
                    className="w-full bg-muted border border-border rounded-xl text-xs font-semibold px-3 py-2.5 text-foreground"
                  >
                    <option value={1}>1회차 (전반기)</option>
                    <option value={2}>2회차 (후반기)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground">소집 수강부서</label>
                  <select 
                    value={createDept} 
                    onChange={(e) => setCreateDept(e.target.value)}
                    className="w-full bg-muted border border-border rounded-xl text-xs font-semibold px-3 py-2.5 text-foreground"
                  >
                    {DEPARTMENTS.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Multiple Selection categories selector block */}
              <div className="space-y-2.5 pt-2 border-t border-border">
                <label className="text-[10px] font-extrabold text-primary uppercase block">
                  교육 분류 일괄 선택 (중복 선택 가능 ※)
                </label>
                <div className="space-y-2">
                  {categories.map(cat => {
                    const isSelected = selectedCreateCats.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => handleToggleCreateCategory(cat)}
                        className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between active:scale-[0.99] transition-all ${
                          isSelected 
                            ? 'bg-primary/5 border-primary text-foreground' 
                            : 'bg-muted/40 border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <span className="text-xs font-black">{cat}</span>
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-primary" />
                        ) : (
                          <Square className="w-4 h-4 text-muted-foreground/50" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic details form rendering for each checked category */}
              <AnimatePresence>
                {selectedCreateCats.map((cat) => {
                  const config = categoryConfigs[cat];
                  if (!config) return null;

                  return (
                    <motion.div
                      key={cat}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -15 }}
                      className="p-5 bg-muted/40 border border-border rounded-3xl space-y-4 shadow-xs"
                    >
                      <h3 className="text-xs font-black text-foreground flex items-center gap-2">
                        <HardHat className="w-4 h-4 text-amber-500" />
                        {cat} 세부 수칙 계획
                      </h3>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-muted-foreground">수강 시간 (분)</label>
                          <input 
                            type="number"
                            value={config.durationMinutes}
                            onChange={(e) => setCategoryConfigs(prev => ({
                              ...prev,
                              [cat]: { ...prev[cat], durationMinutes: Number(e.target.value) }
                            }))}
                            className="w-full bg-card border border-border rounded-xl text-xs font-bold px-3 py-2 text-foreground"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-muted-foreground">시작 시간</label>
                          <input 
                            type="time"
                            value={config.startTime}
                            onChange={(e) => setCategoryConfigs(prev => ({
                              ...prev,
                              [cat]: { ...prev[cat], startTime: e.target.value }
                            }))}
                            className="w-full bg-card border border-border rounded-xl text-xs font-bold px-3 py-2 text-foreground"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-muted-foreground">교육 일자</label>
                          <input 
                            type="date"
                            value={config.trainingDate}
                            onChange={(e) => setCategoryConfigs(prev => ({
                              ...prev,
                              [cat]: { ...prev[cat], trainingDate: e.target.value }
                            }))}
                            className="w-full bg-card border border-border rounded-xl text-[11px] font-bold px-2 py-2 text-foreground"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-muted-foreground">교육 장소</label>
                          <input 
                            type="text"
                            value={config.location}
                            onChange={(e) => setCategoryConfigs(prev => ({
                              ...prev,
                              [cat]: { ...prev[cat], location: e.target.value }
                            }))}
                            className="w-full bg-card border border-border rounded-xl text-xs font-bold px-3 py-2 text-foreground"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground">지도 강사</label>
                        <input 
                          type="text"
                          value={config.instructor}
                          onChange={(e) => setCategoryConfigs(prev => ({
                            ...prev,
                            [cat]: { ...prev[cat], instructor: e.target.value }
                          }))}
                          className="w-full bg-card border border-border rounded-xl text-xs font-bold px-3 py-2 text-foreground"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground">안건 내용 수칙 (Markdown 가능)</label>
                        <textarea 
                          rows={4}
                          value={config.content}
                          onChange={(e) => setCategoryConfigs(prev => ({
                            ...prev,
                            [cat]: { ...prev[cat], content: e.target.value }
                          }))}
                          className="w-full bg-card border border-border rounded-xl text-xs font-bold p-3 text-foreground focus:outline-none"
                        />
                      </div>

                      {/* Image Upload for Report - "교육보고서 이미지 업로드한것처럼 똑같이 나와야함" */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground">교육 전경/실증 사진 첨부 (보고서 출력용)</label>
                        {config.imageUrl ? (
                          <div className="relative aspect-video rounded-2xl overflow-hidden border border-border">
                            <img src={config.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setCategoryConfigs(prev => ({
                                ...prev,
                                [cat]: { ...prev[cat], imageUrl: '' }
                              }))}
                              className="absolute top-2 right-2 p-1.5 bg-red-500 rounded-lg text-white"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center justify-center border border-dashed border-border rounded-2xl py-6 bg-card cursor-pointer hover:bg-muted/20 active:scale-95 transition-all text-center">
                            <Camera className="w-6 h-6 text-muted-foreground mb-1" />
                            <span className="text-[10px] font-black text-foreground">사진 첨부하기 / 카메라 전환</span>
                            <span className="text-[9px] text-muted-foreground">보고일에 현장 인물 전경 사진 삽입</span>
                            <input 
                              type="file" 
                              accept="image/*" 
                              className="hidden" 
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  handleConfigImageUpload(cat, file);
                                }
                              }}
                            />
                          </label>
                        )}
                      </div>

                      <div className="space-y-2 pt-2 border-t border-border/60 mt-3">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-black text-foreground">
                            교육 대상 사원 개별 지정 ({(config.allowedUids || []).length}명 선택됨)
                          </label>
                          {(config.allowedUids || []).length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setCategoryConfigs(prev => ({
                                  ...prev,
                                  [cat]: { ...prev[cat], allowedUids: [] }
                                }));
                              }}
                              className="text-[10px] font-bold text-rose-500 hover:underline"
                            >
                              초기화
                            </button>
                          )}
                        </div>
                        
                        <p className="text-[10px] font-semibold text-muted-foreground leading-relaxed">
                          💡 특정 사원만 지정할 수 있습니다. 아무도 선택하지 않으면 부서 전체({createDept})에 배정됩니다.
                        </p>

                        {/* Quick Filter Inputs */}
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            placeholder="사원명 검색..."
                            value={mobileSearchQuery}
                            onChange={(e) => setMobileSearchQuery(e.target.value)}
                            className="h-8 px-2 text-[11px] rounded-lg border border-input bg-muted/20 focus:outline-none"
                          />
                          <select
                            value={mobileWorkplaceFilter}
                            onChange={(e) => setMobileWorkplaceFilter(e.target.value)}
                            className="h-8 px-2 text-[11px] rounded-lg border border-input bg-muted/20 focus:outline-none font-bold"
                          >
                            <option value="ALL">전체 사업장</option>
                            <option value="중형선">중형선선체조립부</option>
                            <option value="함정">함정선체생산부</option>
                          </select>
                        </div>

                        {/* Workers Checkbox List */}
                        <div className="max-h-36 overflow-y-auto border border-border rounded-xl p-2 bg-card space-y-1 scrollbar-thin">
                          {(() => {
                            const filtered = users.filter(u => {
                              if (!u.isActive) return false;
                              const matchesSearch = mobileSearchQuery 
                                ? u.displayName?.toLowerCase().includes(mobileSearchQuery.toLowerCase())
                                : true;
                              const matchesDept = mobileWorkplaceFilter === 'ALL'
                                ? true
                                : mobileWorkplaceFilter === '중형선'
                                  ? (u.departmentName?.includes('중형선') || u.workplace?.includes('중형선'))
                                  : (u.departmentName?.includes('함정') || u.workplace?.includes('함정'));
                              return matchesSearch && matchesDept;
                            });

                            if (filtered.length === 0) {
                              return <div className="text-center text-[10px] text-muted-foreground py-4">검색 결과가 없습니다.</div>;
                            }

                            return filtered.map((u) => {
                              const checked = (config.allowedUids || []).includes(u.uid);
                              return (
                                <label key={u.uid} className="flex items-start gap-2.5 p-1.5 hover:bg-muted rounded-lg cursor-pointer text-[11px] font-bold text-foreground">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => {
                                      const nextUids = checked
                                        ? (config.allowedUids || []).filter(id => id !== u.uid)
                                        : [...(config.allowedUids || []), u.uid];
                                      setCategoryConfigs(prev => ({
                                        ...prev,
                                        [cat]: { ...prev[cat], allowedUids: nextUids }
                                      }));
                                    }}
                                    className="rounded border-gray-300 text-primary focus:ring-primary w-3.5 h-3.5 mt-0.5 accent-primary"
                                  />
                                  <div className="flex flex-col">
                                    <span>{u.displayName || u.email} ({u.position || '사원'})</span>
                                    <span className="text-[9px] text-muted-foreground font-semibold leading-none mt-0.5">
                                      {u.departmentName || '부서 없음'} {u.employeeId ? `| ${u.employeeId}` : ''}
                                    </span>
                                  </div>
                                </label>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {/* Final submission of batch */}
              <button
                type="button"
                onClick={handleSaveSessionsBatch}
                className="w-full py-4 bg-primary text-white text-xs font-black rounded-2xl shadow-lg hover:bg-primary/95 shadow-primary/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {selectedCreateCats.length}개 법정 교육 일괄 등록 및 배포 지시
              </button>
            </Card>
          </div>
        )}

      </div>

      {/* Slide Drawer/Dialog for absent re-education registration */}
      <Dialog open={isReeducationOpen} onOpenChange={setIsReeducationOpen}>
        <DialogContent className="bg-card border border-border text-foreground rounded-3xl max-w-sm p-6 overflow-hidden flex flex-col shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-extrabold text-base text-red-500 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              불참 임직원 법정 재교육 지정
            </DialogTitle>
            <DialogDescription className="text-[10px] text-muted-foreground font-semibold leading-relaxed">
              본 정기 회의에 서식 미이수된 불참자를 상대로 직권 추가 소집 명령서를 배정합니다.
            </DialogDescription>
          </DialogHeader>

          {/* Employee multi-select list */}
          <div className="space-y-2 border-t border-b border-border py-4">
            <div className="flex justify-between items-center pb-2">
              <span className="text-[10px] font-black text-foreground">재교육 배포 인원 ({selectedAbsentees.length}명)</span>
              <button
                type="button"
                onClick={() => {
                  const abs = filteredWorkers.filter(u => 
                    !statutoryCompletions.some(c => c.uid === u.uid && c.sessionId === activeParentSession?.id)
                  );
                  if (selectedAbsentees.length === abs.length) {
                    setSelectedAbsentees([]);
                  } else {
                    setSelectedAbsentees(abs.map(a => a.uid));
                  }
                }}
                className="text-[10px] font-black text-primary underline"
              >
                일괄전체 전환
              </button>
            </div>

            <div className="max-h-[140px] overflow-y-auto space-y-2 pr-1">
              {filteredWorkers.filter(u => 
                !statutoryCompletions.some(c => c.uid === u.uid && c.sessionId === activeParentSession?.id)
              ).map(u => {
                const checked = selectedAbsentees.includes(u.uid);
                return (
                  <button
                    key={u.uid}
                    type="button"
                    onClick={() => {
                      if (checked) {
                        setSelectedAbsentees(selectedAbsentees.filter(id => id !== u.uid));
                      } else {
                        setSelectedAbsentees([...selectedAbsentees, u.uid]);
                      }
                    }}
                    className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between text-xs font-bold transition-all ${
                      checked ? 'bg-primary/5 border-primary text-foreground' : 'bg-muted/40 border-border text-muted-foreground'
                    }`}
                  >
                    <span>{u.displayName} ({u.position || '사원'} | {u.departmentName})</span>
                    {checked ? (
                      <CheckSquare className="w-4 h-4 text-primary" />
                    ) : (
                      <Square className="w-4 h-4 text-muted-foreground/30" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form settings */}
          <div className="space-y-3">
            <div className="space-y-0.5">
              <label className="text-[9px] font-bold text-muted-foreground uppercase">재교육 과정명</label>
              <input 
                type="text" 
                value={reeducationForm.title}
                onChange={(e) => setReeducationForm({ ...reeducationForm, title: e.target.value })}
                className="w-full bg-muted border border-border rounded-lg text-xs font-bold px-3 py-2 text-foreground"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-0.5">
                <label className="text-[9px] font-bold text-muted-foreground">이수시간 (분)</label>
                <input 
                  type="number" 
                  value={reeducationForm.durationMinutes}
                  onChange={(e) => setReeducationForm({ ...reeducationForm, durationMinutes: Number(e.target.value) })}
                  className="w-full bg-muted border border-border rounded-lg text-xs font-bold px-3 py-2 text-foreground"
                />
              </div>
              <div className="space-y-0.5">
                <label className="text-[9px] font-bold text-muted-foreground">시작 시간</label>
                <input 
                  type="time" 
                  value={reeducationForm.startTime}
                  onChange={(e) => setReeducationForm({ ...reeducationForm, startTime: e.target.value })}
                  className="w-full bg-muted border border-border rounded-lg text-xs font-bold px-3 py-2 text-foreground"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-0.5">
                <label className="text-[9px] font-bold text-muted-foreground">지도 일시</label>
                <input 
                  type="date" 
                  value={reeducationForm.trainingDate}
                  onChange={(e) => setReeducationForm({ ...reeducationForm, trainingDate: e.target.value })}
                  className="w-full bg-muted border border-border rounded-lg text-[10px] font-bold px-2 py-2 text-foreground"
                />
              </div>
              <div className="space-y-0.5">
                <label className="text-[9px] font-bold text-muted-foreground">출강 강사</label>
                <input 
                  type="text" 
                  value={reeducationForm.instructor}
                  onChange={(e) => setReeducationForm({ ...reeducationForm, instructor: e.target.value })}
                  className="w-full bg-muted border border-border rounded-lg text-xs font-bold px-3 py-2 text-foreground"
                />
              </div>
            </div>

            <div className="space-y-0.5">
              <label className="text-[9px] font-bold text-muted-foreground">인쇄일지 포함될 실지 사진 업로드</label>
              {reeducationForm.imageUrl ? (
                <div className="relative aspect-video rounded-xl overflow-hidden border border-border bg-black/30">
                  <img src={reeducationForm.imageUrl} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setReeducationForm(prev => ({ ...prev, imageUrl: '' }))}
                    className="absolute top-2.5 right-2.5 p-1 bg-red-650 bg-red-500 text-white rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center border border-dashed border-border rounded-xl py-4 bg-muted/30 cursor-pointer hover:bg-muted text-center active:scale-95 transition-all">
                  <Camera className="w-5 h-5 text-muted-foreground mb-0.5" />
                  <span className="text-[9px] font-black text-muted-foreground">재교육 전경 사진 첨부</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleReeducationImageUpload(file);
                    }}
                  />
                </label>
              )}
            </div>

            <div className="space-y-0.5">
              <label className="text-[9px] font-bold text-muted-foreground">훈련지도 수칙요령</label>
              <textarea 
                rows={3} 
                value={reeducationForm.content}
                onChange={(e) => setReeducationForm({ ...reeducationForm, content: e.target.value })}
                className="w-full bg-muted border border-border rounded-lg text-xs font-bold p-2 text-foreground"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <button
              onClick={handleSaveReeducation}
              className="w-full py-3 bg-red-550 bg-red-500 text-white rounded-xl text-xs font-black shadow-lg shadow-red-500/10 hover:bg-red-600 active:scale-95 transition-all"
            >
              재교육 등록 및 배포 지시
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Session Edit Modal Dialog */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="bg-card border border-border text-foreground rounded-3xl max-w-sm p-6 overflow-hidden flex flex-col shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-extrabold text-base text-primary flex items-center gap-2">
              <Edit className="w-5 h-5 text-primary" />
              법정의무 교육 일정 수정
            </DialogTitle>
            <DialogDescription className="text-[10px] text-muted-foreground font-semibold leading-relaxed">
              선택한 법정 의무 교육 과정의 실시 정보 및 세부 수칙 계획을 수정합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground">교육 제목</label>
              <input 
                type="text"
                value={editForm.title}
                onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                className="w-full bg-muted border border-border rounded-xl text-xs font-bold px-3 py-2 text-foreground"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground">교육 분류</label>
                <select 
                  value={editForm.category}
                  onChange={(e) => setEditForm(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full bg-muted border border-border rounded-xl text-xs font-bold px-3 py-1.5 text-foreground"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground">수강부서</label>
                <select 
                  value={editForm.targetDepartment}
                  onChange={(e) => setEditForm(prev => ({ ...prev, targetDepartment: e.target.value }))}
                  className="w-full bg-muted border border-border rounded-xl text-xs font-bold px-3 py-1.5 text-foreground"
                >
                  {DEPARTMENTS.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground">교육 설계 일자</label>
                <input 
                  type="date"
                  value={editForm.trainingDate}
                  onChange={(e) => setEditForm(prev => ({ ...prev, trainingDate: e.target.value }))}
                  className="w-full bg-muted border border-border rounded-xl text-[11px] font-bold px-2 py-2 text-foreground"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground">장소 및 시간</label>
                <input 
                  type="text"
                  value={editForm.location}
                  onChange={(e) => setEditForm(prev => ({ ...prev, location: e.target.value }))}
                  className="w-full bg-muted border border-border rounded-xl text-xs font-bold px-3 py-2 text-foreground"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground">교육 시간(분)</label>
                <input 
                  type="number"
                  value={editForm.durationMinutes}
                  onChange={(e) => setEditForm(prev => ({ ...prev, durationMinutes: Number(e.target.value) }))}
                  className="w-full bg-muted border border-border rounded-xl text-xs font-bold px-3 py-2 text-foreground"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground">지도 강사</label>
                <input 
                  type="text"
                  value={editForm.instructor}
                  onChange={(e) => setEditForm(prev => ({ ...prev, instructor: e.target.value }))}
                  className="w-full bg-muted border border-border rounded-xl text-xs font-bold px-3 py-2 text-foreground"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground">교육 안건 수칙 계획 (Markdown)</label>
              <textarea 
                rows={3}
                value={editForm.content}
                onChange={(e) => setEditForm(prev => ({ ...prev, content: e.target.value }))}
                className="w-full bg-muted border border-border rounded-xl text-xs font-bold p-2.5 text-foreground focus:outline-none"
              />
            </div>

            <div className="space-y-2 pt-2 border-t border-border/60 mt-3">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-black text-foreground">
                  교육 대상 사원 개별 지정 ({(editForm.allowedUids || []).length}명 선택됨)
                </label>
                {(editForm.allowedUids || []).length > 0 && (
                  <button
                    type="button"
                    onClick={() => setEditForm(prev => ({ ...prev, allowedUids: [] }))}
                    className="text-[10px] font-bold text-rose-500 hover:underline"
                  >
                    초기화
                  </button>
                )}
              </div>
              
              <p className="text-[10px] font-semibold text-muted-foreground leading-relaxed">
                💡 특정 사원만 지정할 수 있습니다. 아무도 선택하지 않으면 부서 전체({editForm.targetDepartment || '전체'})에 배정됩니다.
              </p>

              {/* Quick Filter Inputs */}
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="사원명 검색..."
                  value={mobileEditSearchQuery}
                  onChange={(e) => setMobileEditSearchQuery(e.target.value)}
                  className="h-8 px-2 text-[11px] rounded-lg border border-input bg-muted/20 focus:outline-none"
                />
                <select
                  value={mobileEditWorkplaceFilter}
                  onChange={(e) => setMobileEditWorkplaceFilter(e.target.value)}
                  className="h-8 px-2 text-[11px] rounded-lg border border-input bg-muted/20 focus:outline-none font-bold"
                >
                  <option value="ALL">전체 사업장</option>
                  <option value="중형선">중형선선체조립부</option>
                  <option value="함정">함정선체생산부</option>
                </select>
              </div>

              {/* Workers Checkbox List */}
              <div className="max-h-36 overflow-y-auto border border-border rounded-xl p-2 bg-muted space-y-1.5 scrollbar-thin">
                {(() => {
                  const filtered = users.filter(u => {
                    if (!u.isActive) return false;
                    const matchesSearch = mobileEditSearchQuery 
                      ? u.displayName?.toLowerCase().includes(mobileEditSearchQuery.toLowerCase())
                      : true;
                    const matchesDept = mobileEditWorkplaceFilter === 'ALL'
                      ? true
                      : mobileEditWorkplaceFilter === '중형선'
                        ? (u.departmentName?.includes('중형선') || u.workplace?.includes('중형선'))
                        : (u.departmentName?.includes('함정') || u.workplace?.includes('함정'));
                    return matchesSearch && matchesDept;
                  });

                  if (filtered.length === 0) {
                    return <div className="text-center text-[10px] text-muted-foreground py-4">검색 결과가 없습니다.</div>;
                  }

                  return filtered.map((u) => {
                    const checked = (editForm.allowedUids || []).includes(u.uid);
                    return (
                      <label key={u.uid} className="flex items-start gap-2.5 p-1.5 hover:bg-card rounded-lg cursor-pointer text-[11px] font-bold text-foreground">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const nextUids = checked
                              ? (editForm.allowedUids || []).filter(id => id !== u.uid)
                              : [...(editForm.allowedUids || []), u.uid];
                            setEditForm(prev => ({ ...prev, allowedUids: nextUids }));
                          }}
                          className="rounded border-gray-300 text-primary focus:ring-primary w-3.5 h-3.5 mt-0.5 accent-primary"
                        />
                        <div className="flex flex-col">
                          <span>{u.displayName || u.email} ({u.position || '사원'})</span>
                          <span className="text-[9px] text-muted-foreground font-semibold leading-none mt-0.5">
                            {u.departmentName || '부서 없음'} {u.employeeId ? `| ${u.employeeId}` : ''}
                          </span>
                        </div>
                      </label>
                    );
                  });
                })()}
              </div>
            </div>
          </div>

          <DialogFooter className="flex gap-2 pt-2">
            <button
              onClick={() => setIsEditModalOpen(false)}
              className="flex-1 py-3 bg-muted text-foreground font-black text-xs rounded-xl active:scale-95 transition-all"
            >
              취소
            </button>
            <button
              onClick={handleUpdateSession}
              className="flex-1 py-3 bg-primary text-white font-black text-xs rounded-xl active:scale-95 transition-all"
            >
              수정 완료
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Session Delete Confirmation Dialog */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="bg-card border border-border text-foreground rounded-3xl max-w-sm p-6 overflow-hidden flex flex-col shadow-2xl space-y-4 max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="font-extrabold text-base text-red-500 flex items-center gap-2">
              <span className="p-1 px-2.5 rounded-lg bg-red-500/10 text-xs">일정 삭제</span>
              교육 일정 삭제 확인
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-semibold leading-relaxed pt-2">
              정말로 이 교육 일정을 영구히 삭제하시겠습니까? 삭제 시 해당 회차의 모든 서명 대장 및 현람 데이터가 모두 상실되며, 복구할 수 없습니다.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex gap-2 pt-2">
            <button
              onClick={() => {
                setIsDeleteModalOpen(false);
                setSessionToDeleteId(null);
              }}
              className="flex-1 py-3 bg-muted text-foreground font-black text-xs rounded-xl active:scale-95 transition-all cursor-pointer"
            >
              취소
            </button>
            <button
              onClick={handleConfirmDelete}
              className="flex-1 py-3 bg-red-500 text-white font-black text-xs rounded-xl active:scale-95 transition-all cursor-pointer hover:bg-red-600"
            >
              삭제 승인
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Internal customized sub-components to adhere to our React theme
function Card({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`p-4 rounded-3xl border border-border bg-card shadow-sm text-foreground ${className || ''}`} {...props}>
      {children}
    </div>
  );
}

function CardContent({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`space-y-4 ${className || ''}`} {...props}>
      {children}
    </div>
  );
}

function Badge({ children, className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black tracking-tight ${className || ''}`} {...props}>
      {children}
    </span>
  );
}
