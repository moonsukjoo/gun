import React, { useState, useEffect } from 'react';
import { 
  Thermometer, 
  Droplets, 
  Wind, 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  Save, 
  RefreshCw, 
  MapPin, 
  Calendar, 
  Clock, 
  Settings, 
  AlertTriangle, 
  FileSpreadsheet, 
  FileText,
  User,
  X,
  FileBarChart
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot, addDoc, doc, deleteDoc, updateDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import PCAdminLayout from '../components/PCAdminLayout';
import { useAuth } from '../components/AuthProvider';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { 
  calculateWetBulb, 
  calculatePerceivedTemp, 
  getPerceivedRiskDetails, 
  getDisplayDept 
} from './PerceivedTemp';
import { exportToExcel, exportToPDF } from '../lib/exportUtils';

interface PerceivedTempRecord {
  id: string;
  date: string;
  time: string;
  location: string;
  ta: number;
  rh: number;
  windSpeed: number;
  tw: number;
  perceivedTemp: number;
  riskLevel: string;
  actionTaken: string;
  notes: string;
  writerUid: string;
  writerName: string;
  createdAt: string;
  department?: '함정선체생산부' | '중형선선체조립부';
}

interface PerceivedTempLocation {
  id: string;
  name: string;
  creatorUid: string;
  createdAt: string;
}

const PCAdminPerceivedTemp: React.FC = () => {
  const { profile } = useAuth();
  
  // Real-time synchronization states
  const [records, setRecords] = useState<PerceivedTempRecord[]>([]);
  const [locations, setLocations] = useState<PerceivedTempLocation[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter/Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<'전체' | '함정선체생산부' | '중형선선체조립부'>('전체');
  const [selectedLocationFilter, setSelectedLocationFilter] = useState<string>('전체');
  const [selectedRiskFilter, setSelectedRiskFilter] = useState<string>('전체');
  
  // UI states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PerceivedTempRecord | null>(null);
  
  // Form input states
  const [inputDate, setInputDate] = useState<string>('');
  const [inputTime, setInputTime] = useState<string>('');
  const [inputDept, setInputDept] = useState<'함정선체생산부' | '중형선선체조립부'>('함정선체생산부');
  const [inputLocation, setInputLocation] = useState<string>('');
  const [inputTa, setInputTa] = useState<string>('30');
  const [inputRh, setInputRh] = useState<string>('60');
  const [inputWindSpeed, setInputWindSpeed] = useState<string>('1.0');
  const [inputAction, setInputAction] = useState<string>('');
  const [inputNotes, setInputNotes] = useState<string>('');
  const [newLocationName, setNewLocationName] = useState<string>('');

  // Live calculations for Form Inputs
  const [liveTw, setLiveTw] = useState<number>(0);
  const [livePerceived, setLivePerceived] = useState<number>(0);
  const [liveRisk, setLiveRisk] = useState<ReturnType<typeof getPerceivedRiskDetails>>(getPerceivedRiskDetails(0));

  // Load records and locations with real-time onSnapshot listeners
  useEffect(() => {
    setLoading(true);
    
    // 1. Listen for temperature records
    const recordsQuery = query(collection(db, 'perceivedTempLogs'), orderBy('date', 'desc'), orderBy('time', 'desc'));
    const unsubscribeRecords = onSnapshot(recordsQuery, (snapshot) => {
      const fetchedRecords = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PerceivedTempRecord[];
      setRecords(fetchedRecords);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'pc_perceived_records_sync');
      toast.error('체감온도 측정 기록을 불러오는데 실패했습니다.');
    });

    // 2. Listen for registered locations
    const locationsQuery = query(collection(db, 'perceivedTempLocations'), orderBy('createdAt', 'desc'));
    const unsubscribeLocations = onSnapshot(locationsQuery, (snapshot) => {
      const fetchedLocations = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PerceivedTempLocation[];
      setLocations(fetchedLocations);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'pc_perceived_locations_sync');
    });

    return () => {
      unsubscribeRecords();
      unsubscribeLocations();
    };
  }, []);

  // Recalculate live values in input form whenever Ta or RH inputs change
  useEffect(() => {
    const ta = parseFloat(inputTa) || 0;
    const rh = parseFloat(inputRh) || 0;
    
    const tw = calculateWetBulb(ta, rh);
    const perceived = calculatePerceivedTemp(ta, tw);
    const risk = getPerceivedRiskDetails(perceived);

    setLiveTw(tw);
    setLivePerceived(perceived);
    setLiveRisk(risk);
  }, [inputTa, inputRh]);

  // Open Form for Adding
  const handleOpenAddForm = () => {
    const now = new Date();
    const curDate = now.toISOString().split('T')[0];
    const curTime = now.toTimeString().substring(0, 5);

    setEditingRecord(null);
    setInputDate(curDate);
    setInputTime(curTime);
    setInputDept('함정선체생산부');
    setInputLocation(locations[0]?.name || '야외 작업장 A');
    setInputTa('31');
    setInputRh('65');
    setInputWindSpeed('1.2');
    setInputAction('');
    setInputNotes('');
    setIsFormOpen(true);
  };

  // Open Form for Editing
  const handleOpenEditForm = (record: PerceivedTempRecord) => {
    setEditingRecord(record);
    setInputDate(record.date);
    setInputTime(record.time);
    setInputDept(record.department || '함정선체생산부');
    setInputLocation(record.location);
    setInputTa(String(record.ta));
    setInputRh(String(record.rh));
    setInputWindSpeed(String(record.windSpeed || '1.0'));
    setInputAction(record.actionTaken || '');
    setInputNotes(record.notes || '');
    setIsFormOpen(true);
  };

  // Submit Apparent Temp Record (Create or Update)
  const handleSubmitRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    const taVal = parseFloat(inputTa);
    const rhVal = parseFloat(inputRh);
    const wsVal = parseFloat(inputWindSpeed) || 0;

    if (isNaN(taVal) || isNaN(rhVal)) {
      toast.error('기온과 상대습도를 올바른 숫자로 입력해 주세요.');
      return;
    }

    if (!inputLocation.trim()) {
      toast.error('측정 장소를 지정해 주세요.');
      return;
    }

    // Double-verify calculations using exact helpers
    const twVal = calculateWetBulb(taVal, rhVal);
    const perceivedVal = calculatePerceivedTemp(taVal, twVal);
    const riskVal = getPerceivedRiskDetails(perceivedVal).level;

    const dataPayload = {
      date: inputDate,
      time: inputTime,
      department: inputDept,
      location: inputLocation,
      ta: taVal,
      rh: rhVal,
      windSpeed: wsVal,
      tw: twVal,
      perceivedTemp: perceivedVal,
      riskLevel: riskVal,
      actionTaken: inputAction || getPerceivedRiskDetails(perceivedVal).action,
      notes: inputNotes,
      writerUid: profile?.uid || 'pc-admin',
      writerName: profile?.displayName || '관리자',
      updatedAt: new Date().toISOString()
    };

    try {
      if (editingRecord) {
        // Edit existing log
        await updateDoc(doc(db, 'perceivedTempLogs', editingRecord.id), dataPayload);
        toast.success('체감온도 측정 정보가 성공적으로 수정되었습니다.');
      } else {
        // Create new log
        await addDoc(collection(db, 'perceivedTempLogs'), {
          ...dataPayload,
          createdAt: new Date().toISOString()
        });
        toast.success('새로운 체감온도 정보가 등록되었습니다.');
      }
      setIsFormOpen(false);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.CREATE, 'pc_perceived_record_submit');
      toast.error('오류 발생: 정보를 입력 혹은 변경하지 못했습니다.');
    }
  };

  // Delete Apparent Temp Record
  const handleDeleteRecord = async (id: string) => {
    if (!window.confirm('정말로 이 측정 기록을 완전히 삭제하시겠습니까?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'perceivedTempLogs', id));
      toast.success('측정 기록이 영구히 삭제되었습니다.');
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, 'pc_perceived_record_delete');
      toast.error('기록 삭제에 실패했습니다.');
    }
  };

  // Add a new Location
  const handleAddLocation = async () => {
    const trimmed = newLocationName.trim();
    if (!trimmed) {
      toast.error('추가할 위치명을 정확히 기재하세요.');
      return;
    }

    if (locations.some(l => l.name === trimmed)) {
      toast.error('이미 동일한 이름의 측정 장소가 존재합니다.');
      return;
    }

    try {
      await addDoc(collection(db, 'perceivedTempLocations'), {
        name: trimmed,
        creatorUid: profile?.uid || 'pc-admin',
        createdAt: new Date().toISOString()
      });
      toast.success(`'${trimmed}' 장소가 성공적으로 추가되었습니다.`);
      setNewLocationName('');
    } catch (error) {
      toast.error('장소 추가 실패');
    }
  };

  // Delete an existing Location
  const handleDeleteLocation = async (locId: string, name: string) => {
    if (!window.confirm(`'${name}' 장소를 삭제하시겠습니까?`)) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'perceivedTempLocations', locId));
      toast.success('지정 측정 장소가 해제되었습니다.');
    } catch (error) {
      toast.error('장소 삭제 실패');
    }
  };

  // Filter Logic
  const filteredRecords = records.filter(rec => {
    // 1. Text Search matching location, Writer name, actionTaken, or notes
    const matchesSearch = searchQuery 
      ? (
          rec.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (rec.writerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (rec.actionTaken || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (rec.notes || '').toLowerCase().includes(searchQuery.toLowerCase())
        )
      : true;

    // 2. Department filter
    const matchesDept = selectedDeptFilter === '전체' 
      ? true 
      : rec.department === selectedDeptFilter;

    // 3. Location filter
    const matchesLoc = selectedLocationFilter === '전체'
      ? true
      : rec.location === selectedLocationFilter;

    // 4. Risk level filter
    const matchesRisk = selectedRiskFilter === '전체'
      ? true
      : rec.riskLevel === selectedRiskFilter;

    return matchesSearch && matchesDept && matchesLoc && matchesRisk;
  });

  // Calculate stats for top KPI block
  const totalCount = filteredRecords.length;
  const maxPerceived = totalCount > 0 
    ? Math.max(...filteredRecords.map(r => r.perceivedTemp)) 
    : 0;
  const warningAndDangerCount = filteredRecords.filter(r => ['경고', '위험', '매우위험'].includes(r.riskLevel)).length;
  
  // Real-time averages by official divisions
  const deptShipRecs = filteredRecords.filter(r => r.department === '함정선체생산부');
  const avgShipTemp = deptShipRecs.length > 0 
    ? (deptShipRecs.reduce((sum, r) => sum + r.perceivedTemp, 0) / deptShipRecs.length).toFixed(1) 
    : '0';

  const deptMidRecs = filteredRecords.filter(r => r.department === '중형선선체조립부');
  const avgMidTemp = deptMidRecs.length > 0 
    ? (deptMidRecs.reduce((sum, r) => sum + r.perceivedTemp, 0) / deptMidRecs.length).toFixed(1) 
    : '0';

  // Excel Export Handler
  const handleExportExcel = async () => {
    if (filteredRecords.length === 0) {
      toast.error('출력할 측정 기록이 모여있지 않습니다.');
      return;
    }

    try {
      const excelRows = filteredRecords.map((r, i) => ({
        'No': i + 1,
        '측정 일자': r.date,
        '측정 시간': r.time,
        '관할 부서': r.department || '미지정',
        '측정 장소': r.location,
        '기온 (Ta, ℃)': r.ta,
        '상대 습도 (RH, %)': r.rh,
        '풍속 (WS, m/s)': r.windSpeed || 0,
        '습구 온도 (Tw, ℃)': r.tw,
        '체감 온도 (℃)': r.perceivedTemp,
        '안전 주의 수준': r.riskLevel,
        '수행된 즉시 안전 조치': r.actionTaken || '',
        '비고 및 세부 사항': r.notes || '',
        '계측 주체': r.writerName || '관리자'
      }));

      await exportToExcel(
        excelRows, 
        `체감온도_총괄일지_${new Date().toISOString().split('T')[0]}`, 
        '체감온도 대장'
      );
      toast.success('엑셀 파일이 준비 완료되어 다운로드를 진행합니다.');
    } catch (err: any) {
      toast.error('엑셀 생성 중 오류가 발생했습니다.');
    }
  };

  // PDF Export Handler
  const handleExportPDF = async () => {
    if (filteredRecords.length === 0) {
      toast.error('출력이 가능한 측정 정보가 비었습니다.');
      return;
    }

    try {
      const headers = ['측정 일시', '대비 부서', '측정 장소', '체감기온', '습구/풍속', '안전 위험도', '현장 취지 조치'];
      const dataRows = filteredRecords.map(r => [
        `${r.date} ${r.time}`,
        r.department || '공용',
        r.location,
        `${r.perceivedTemp}℃`,
        `습구:${r.tw}℃ / ${r.windSpeed || 1.0}m/s`,
        r.riskLevel,
        r.actionTaken || '자체 통제진행'
      ]);

      await exportToPDF(
        '건명기업 실시간 복합 체감온도 관제 일지',
        headers,
        dataRows,
        `apparent_temperature_master_log_${new Date().toISOString().split('T')[0]}`
      );
      toast.success('안전 관리자 검토를 위한 공식 PDF 리포트가 발행되었습니다.');
    } catch (error) {
      toast.error('PDF 발행 과정 중 기술적 고장이 생겼습니다.');
    }
  };

  return (
    <PCAdminLayout title="체감온도 통합 관리 센터">
      <div className="max-w-[1600px] mx-auto space-y-10 text-foreground">
        
        {/* Header Title Section */}
        <header className="flex justify-between items-start">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-sky-500/10 text-sky-500 rounded-full text-[11px] font-black uppercase tracking-wider mb-3 border border-sky-500/20">
              <Thermometer className="w-3.5 h-3.5" />
              현장 보건 위생 안전망 가동 중
            </div>
            <h1 className="text-4xl font-black tracking-tight mb-2 flex items-center gap-2">
              실시간 현업 체감온도 계측 및 관제 대장
            </h1>
            <p className="text-muted-foreground text-base font-medium">
              기상 분석 데이터와 현지 실시간 온습도를 바탕으로 연소 및 냉온작업 구역의 실효 위험 등급을 계산하고 통제 정책을 정합니다.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsLocationModalOpen(true)}
              className="px-5 py-3 border border-border bg-card rounded-[1.25rem] font-bold text-sm shadow-sm hover:bg-muted/80 transition-all flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              측정 장소 설정
            </button>
            <button 
              onClick={handleOpenAddForm}
              className="px-5 py-3 bg-primary text-white rounded-[1.25rem] font-black text-sm shadow-lg shadow-primary/10 hover:bg-primary/95 transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              체감온도 측정점 등록
            </button>
          </div>
        </header>

        {/* Real-time KPI Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          
          <div className="bg-card p-6 rounded-3xl border border-border shadow-sm flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-sky-500/10 text-sky-500 flex items-center justify-center shrink-0">
              <Thermometer className="w-7 h-7" />
            </div>
            <div>
              <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">일간 최고 체감온도</p>
              <p className="text-2xl font-black mt-1 text-foreground">
                {maxPerceived > 0 ? `${maxPerceived}℃` : '계측 미완료'}
              </p>
              <p className="text-[10px] font-bold text-muted-foreground mt-0.5">전 작업장 계측 최대치 기준</p>
            </div>
          </div>

          <div className="bg-card p-6 rounded-3xl border border-border shadow-sm flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div>
              <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">경고/위험 구역 빈도</p>
              <p className={`text-2xl font-black mt-1 ${warningAndDangerCount > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                {warningAndDangerCount}개 구역
              </p>
              <p className="text-[10px] font-bold text-muted-foreground mt-0.5">작업 제한 검토 수준 계측 건수</p>
            </div>
          </div>

          <div className="bg-card p-6 rounded-3xl border border-border shadow-sm flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-violet-500/10 text-violet-500 flex items-center justify-center shrink-0">
              <FileBarChart className="w-7 h-7" />
            </div>
            <div>
              <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">함정선체생산부 평균</p>
              <p className="text-2xl font-black mt-1 text-foreground">{avgShipTemp}℃</p>
              <p className="text-[10px] font-bold text-muted-foreground mt-0.5">최근 섭취 수분 및 물막 보강</p>
            </div>
          </div>

          <div className="bg-card p-6 rounded-3xl border border-border shadow-sm flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
              <FileBarChart className="w-7 h-7" />
            </div>
            <div>
              <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">중형선선체조립부 평균</p>
              <p className="text-2xl font-black mt-1 text-foreground">{avgMidTemp}℃</p>
              <p className="text-[10px] font-bold text-muted-foreground mt-0.5">그늘막 및 강제 팬 배치 집중</p>
            </div>
          </div>

        </div>

        {/* Filters and Search Action Dashboard Row */}
        <div className="bg-card border border-border rounded-[2rem] p-6 shadow-sm flex flex-col xl:flex-row gap-5 items-center justify-between">
          <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto">
            
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="장소 / 조치내용 / 기록자 검색"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-muted/30 border border-border rounded-xl text-xs font-bold focus:outline-none focus:border-primary focus:bg-background"
              />
            </div>

            {/* Department Filter */}
            <div className="flex flex-col">
              <select
                value={selectedDeptFilter}
                onChange={(e) => setSelectedDeptFilter(e.target.value as any)}
                className="px-3.5 py-2.5 bg-muted/30 border border-border rounded-xl text-xs font-bold focus:outline-none cursor-pointer"
              >
                <option value="전체">전체 소속부서</option>
                <option value="함정선체생산부">함정선체생산부</option>
                <option value="중형선선체조립부">중형선선체조립부</option>
              </select>
            </div>

            {/* Location Select Filter */}
            <div className="flex flex-col">
              <select
                value={selectedLocationFilter}
                onChange={(e) => setSelectedLocationFilter(e.target.value)}
                className="px-3.5 py-2.5 bg-muted/30 border border-border rounded-xl text-xs font-bold focus:outline-none cursor-pointer"
              >
                <option value="전체">전체 계측장소</option>
                {locations.map(loc => (
                  <option key={loc.id} value={loc.name}>{loc.name}</option>
                ))}
              </select>
            </div>

            {/* Risk Category Filter */}
            <div className="flex flex-col">
              <select
                value={selectedRiskFilter}
                onChange={(e) => setSelectedRiskFilter(e.target.value)}
                className="px-3.5 py-2.5 bg-muted/30 border border-border rounded-xl text-xs font-bold focus:outline-none cursor-pointer"
              >
                <option value="전체">전체 위험단계</option>
                <option value="안전">정상 (안전)</option>
                <option value="주의">주의 필요</option>
                <option value="경고">경고 (온열 보강)</option>
                <option value="위험">위험 (작업 축소)</option>
                <option value="매우위험">매우위험 (제한 조치)</option>
              </select>
            </div>

          </div>

          {/* Export & Print actions */}
          <div className="flex items-center gap-2 w-full sm:w-auto self-end xl:self-auto justify-end">
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 transition-colors text-white rounded-xl text-xs font-black shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4" />
              엑셀 다운로드
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 border border-border hover:bg-slate-800 transition-colors text-white rounded-xl text-xs font-black shadow-sm"
            >
              <FileText className="w-4 h-4" />
              PDF 리포트 출력
            </button>
          </div>
        </div>

        {/* Master Data Grid Table */}
        <div className="bg-card border border-border rounded-[2.5rem] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-20 text-center flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-10 h-10 text-primary animate-spin" />
                <p className="font-bold text-muted-foreground text-sm">실시간 안전망 원격 연결 정보 로드 중...</p>
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="p-20 text-center">
                <Thermometer className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="font-black text-lg text-foreground">조건에 일치하는 체감온도 기록이 발견되지 않았습니다.</p>
                <p className="text-muted-foreground font-medium text-xs mt-2">필터를 조정하거나, 우측 상단의 계측 등록 버튼을 클릭해 새로운 데이터를 관제선에 보강해 주십시오.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="px-6 py-5 text-xs font-black text-muted-foreground uppercase tracking-wider">측정 일시</th>
                    <th className="px-6 py-5 text-xs font-black text-muted-foreground uppercase tracking-wider">관할 부서</th>
                    <th className="px-6 py-5 text-xs font-black text-muted-foreground uppercase tracking-wider">계측 지점</th>
                    <th className="px-6 py-5 text-xs font-black text-muted-foreground uppercase tracking-wider text-center">대기기온/습도</th>
                    <th className="px-6 py-5 text-xs font-black text-muted-foreground uppercase tracking-wider text-center">풍속/습구(Tw)</th>
                    <th className="px-6 py-5 text-xs font-black text-muted-foreground uppercase tracking-wider text-center">실효 체감온도</th>
                    <th className="px-6 py-5 text-xs font-black text-muted-foreground uppercase tracking-wider text-center">안전경보 등급</th>
                    <th className="px-6 py-5 text-xs font-black text-muted-foreground uppercase tracking-wider">현장 이행 즉각 조치</th>
                    <th className="px-6 py-5 text-xs font-black text-muted-foreground uppercase tracking-wider">기록 주체</th>
                    <th className="px-6 py-5 text-xs font-black text-muted-foreground uppercase tracking-wider text-right">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredRecords.map((rec) => {
                    // Decide Risk Badger Color Classes based on standard details
                    const recRisk = getPerceivedRiskDetails(rec.perceivedTemp);
                    
                    return (
                      <tr key={rec.id} className="hover:bg-muted/10 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-xs font-black text-foreground flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                              {rec.date}
                            </span>
                            <span className="text-[10px] font-bold text-muted-foreground mt-0.5 flex items-center gap-1.5 pl-0.5">
                              <Clock className="w-3 h-3 text-muted-foreground" />
                              {rec.time}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-muted text-foreground border border-border/70">
                            {rec.department || '공동/전사'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                            <span className="text-xs font-black text-foreground truncate max-w-xs">{rec.location}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-3">
                            <span className="text-xs font-black text-foreground flex items-center gap-0.5">
                              <Thermometer className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              {rec.ta}℃
                            </span>
                            <span className="text-xs font-black text-muted-foreground flex items-center gap-0.5">
                              <Droplets className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                              {rec.rh}%
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex flex-col items-center justify-center">
                            <span className="text-xs font-semibold text-foreground">
                              {rec.tw}℃
                            </span>
                            <span className="text-[10px] text-muted-foreground mt-0.5 font-bold flex items-center gap-0.5">
                              <Wind className="w-3 h-3 text-blue-400 shrink-0" />
                              {rec.windSpeed || 0} m/s
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className="text-base font-black text-foreground tracking-tight">
                            {rec.perceivedTemp}℃
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-[11px] font-black border ${recRisk.bgColor} ${recRisk.textColor} ${recRisk.borderColor}`}>
                            {rec.riskLevel}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="max-w-sm truncate text-xs font-bold text-foreground" title={rec.actionTaken}>
                            {rec.actionTaken || <span className="text-muted-foreground font-medium italic">특질사항 없음</span>}
                          </div>
                          {rec.notes && (
                            <div className="text-[10px] text-muted-foreground font-medium truncate max-w-sm mt-1" title={rec.notes}>
                              📝 {rec.notes}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-500" />
                            <span className="text-xs font-bold text-foreground">{rec.writerName || '관리자'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEditForm(rec)}
                              className="p-1 px-2.5 rounded-lg border border-border bg-card text-muted-foreground hover:text-primary transition-all flex items-center gap-1 text-[10px] font-black"
                            >
                              <Edit3 className="w-3 h-3" />
                              수정
                            </button>
                            <button
                              onClick={() => handleDeleteRecord(rec.id)}
                              className="p-1 px-2.5 rounded-lg border border-red-200 bg-red-500/5 text-rose-600 hover:bg-rose-500 hover:text-white transition-all flex items-center gap-1 text-[10px] font-black"
                            >
                              <Trash2 className="w-3 h-3" />
                              삭제
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* --- DIALOG 1: Add/Edit Apparent Temp Record --- */}
        <AnimatePresence>
          {isFormOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="bg-card border border-border rounded-[2.5rem] w-full max-w-xl shadow-2xl overflow-hidden flex flex-col text-foreground"
              >
                
                {/* Formal Modal Header */}
                <div className="p-6 bg-muted/40 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-sm">
                      <Thermometer className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black tracking-tight">
                        {editingRecord ? '체감온도 측정 정보 변경' : '체감온도 위험 실측지 등록'}
                      </h3>
                      <p className="text-[10px] font-bold text-muted-foreground">국민안전처 및 기상청 고도화 습구온도 수치 통제 기법 적용</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsFormOpen(false)}
                    className="p-2 border border-border rounded-xl bg-card hover:bg-muted transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleSubmitRecord} className="p-6 space-y-5 overflow-y-auto max-h-[75vh] custom-scrollbar">
                  
                  {/* Row 1: Date & Time */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5 col-span-1">
                      <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider block">계측 일자</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input 
                          type="date" 
                          required
                          value={inputDate}
                          onChange={(e) => setInputDate(e.target.value)}
                          className="w-full bg-muted/30 border border-border pl-10 pr-3 py-2.5 rounded-xl text-xs font-black focus:outline-none focus:border-primary"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5 col-span-1">
                      <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider block">계측 시간</label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input 
                          type="time" 
                          required
                          value={inputTime}
                          onChange={(e) => setInputTime(e.target.value)}
                          className="w-full bg-muted/30 border border-border pl-10 pr-3 py-2.5 rounded-xl text-xs font-black focus:outline-none focus:border-primary"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Department & Location */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider block">관할 소속부서</label>
                      <select
                        value={inputDept}
                        onChange={(e) => setInputDept(e.target.value as any)}
                        className="w-full bg-muted/30 border border-border px-4 py-2.5 rounded-xl text-xs font-black focus:outline-none focus:border-primary cursor-pointer"
                      >
                        <option value="함정선체생산부">함정선체생산부</option>
                        <option value="중형선선체조립부">중형선선체조립부</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider block">계측 현장 장소</label>
                      <select
                        value={inputLocation}
                        onChange={(e) => setInputLocation(e.target.value)}
                        className="w-full bg-muted/30 border border-border px-4 py-2.5 rounded-xl text-xs font-black focus:outline-none focus:border-primary cursor-pointer"
                      >
                        {locations.length === 0 ? (
                          <option value="">(장소를 먼저 등록해 주십시오)</option>
                        ) : (
                          locations.map(loc => (
                            <option key={loc.id} value={loc.name}>{loc.name}</option>
                          ))
                        )}
                      </select>
                    </div>
                  </div>

                  {/* Row 3: Physical Environment (Ta, RH, WS) */}
                  <div className="p-4 bg-muted/30 rounded-2xl border border-border/60">
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-3">계측 가독 환경 데이터 입력</p>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-black text-muted-foreground block">기온 ($T_a$, ℃)</label>
                        <input 
                          type="number" 
                          step="0.1"
                          required
                          value={inputTa}
                          onChange={(e) => setInputTa(e.target.value)}
                          placeholder="31.2"
                          className="w-full bg-card border border-border px-3.5 py-2.5 rounded-xl text-xs font-black focus:outline-none focus:border-primary text-center"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-black text-muted-foreground block">상대습도 ($RH$, %)</label>
                        <input 
                          type="number" 
                          step="1"
                          required
                          value={inputRh}
                          onChange={(e) => setInputRh(e.target.value)}
                          placeholder="65"
                          className="w-full bg-card border border-border px-3.5 py-2.5 rounded-xl text-xs font-black focus:outline-none focus:border-primary text-center"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-black text-muted-foreground block">풍속 ($WS$, m/s)</label>
                        <input 
                          type="number" 
                          step="0.1"
                          value={inputWindSpeed}
                          onChange={(e) => setInputWindSpeed(e.target.value)}
                          placeholder="1.2"
                          className="w-full bg-card border border-border px-3.5 py-2.5 rounded-xl text-xs font-black focus:outline-none focus:border-primary text-center"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Calculations Preview Pane */}
                  <div className={`p-4 rounded-2xl border ${liveRisk.borderColor} ${liveRisk.bgColor} transition-all duration-300`}>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2.5">계산된 환경 통제 예측값</p>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-baseline gap-1">
                        <span className="text-[10px] font-bold text-muted-foreground">습구온도 (Tw):</span>
                        <span className="text-sm font-black">{liveTw}℃</span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-[10px] font-bold text-muted-foreground">체감온도:</span>
                        <span className="text-lg font-black">{livePerceived}℃</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-muted-foreground">위험지수:</span>
                        <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold text-white bg-foreground uppercase`}>
                          {liveRisk.level}
                        </span>
                      </div>
                    </div>
                    {/* Live suggestions */}
                    <div className="mt-3.5 pt-3.5 border-t border-border/40 flex flex-col gap-1.5">
                      <span className="text-[10px] font-black text-muted-foreground">💡 해당 위험단계 이행 권고 기준</span>
                      <span className="text-xs font-bold leading-relaxed">{liveRisk.description}</span>
                    </div>
                  </div>

                  {/* Immediate Action / Actiontaken */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider block">실질 이행 조치</label>
                      <button
                        type="button"
                        onClick={() => setInputAction(liveRisk.action)}
                        className="text-[10px] font-bold text-primary hover:underline"
                      >
                        기본 권고조치 자동 입력
                      </button>
                    </div>
                    <textarea 
                      placeholder="예시) 물, 그늘, 휴식 주기 15% 가중 보강 및 강제 냉풍 모터 2대 가동"
                      rows={2}
                      value={inputAction}
                      onChange={(e) => setInputAction(e.target.value)}
                      className="w-full bg-muted/30 border border-border p-3.5 rounded-xl text-xs font-semibold focus:outline-none focus:border-primary-active leading-relaxed"
                    />
                    
                    {/* Pre-select Chips */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {[
                        '수분과 공용 그늘 수시 분배',
                        '무더위 시간 작업 10% 단축제 운용',
                        '혹서 대피소 보냉가동 주입',
                        '실외 직사광선 전공정 일시 중지'
                      ].map(act => (
                        <button
                          key={act}
                          type="button"
                          onClick={() => setInputAction(act)}
                          className="px-2.5 py-1 text-[10px] font-semibold rounded-lg bg-muted text-foreground border border-border/85 hover:border-primary transition-all active:scale-95"
                        >
                          {act}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Notes & Memo info */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider block">비고 / 세부 지점 묘사 ($Notes$)</label>
                    <input 
                      type="text" 
                      placeholder="현장의 기류 상태, 구조적 가열 위험 요소 기재..."
                      value={inputNotes}
                      onChange={(e) => setInputNotes(e.target.value)}
                      className="w-full bg-muted/30 border border-border px-3.5 py-2.5 rounded-xl text-xs font-semibold focus:outline-none"
                    />
                  </div>

                  {/* Modal Action Buttons */}
                  <div className="pt-4 border-t border-border flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsFormOpen(false)}
                      className="px-5 py-3 border border-border bg-card rounded-xl font-bold text-xs"
                    >
                      취소
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-3 bg-primary text-white rounded-xl font-black text-xs flex items-center gap-1.5"
                    >
                      <Save className="w-4 h-4" />
                      {editingRecord ? '수정 사항 저장' : '체감 관제 등록'}
                    </button>
                  </div>

                </form>

              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* --- DIALOG 2: Locations Configuration Manager panel --- */}
        <AnimatePresence>
          {isLocationModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-card border border-border rounded-[2.5rem] w-full max-w-md shadow-2xl p-6 relative flex flex-col text-foreground"
              >
                
                <h3 className="text-xl font-black tracking-tight mb-2">체감온도 계측 지점 설정</h3>
                <p className="text-muted-foreground font-semibold text-xs mb-5">
                  체감온도를 상시 계측하고 저장할 전사 핵심 실외 및 가설 공정 주소를 수립합니다.
                </p>

                {/* Add standard Location input */}
                <div className="flex gap-2 mb-6">
                  <input 
                    type="text" 
                    placeholder="신규 측정 장소 이름 입력"
                    value={newLocationName}
                    onChange={(e) => setNewLocationName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddLocation()}
                    className="flex-1 px-3.5 py-2.5 bg-muted/30 border border-border rounded-xl text-xs font-bold focus:outline-none focus:border-primary"
                  />
                  <button
                    onClick={handleAddLocation}
                    className="px-4 py-2.5 bg-primary text-white font-black text-xs rounded-xl flex items-center gap-1 shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    추가
                  </button>
                </div>

                {/* Location Items listing */}
                <div className="max-h-60 overflow-y-auto space-y-2 border border-border rounded-2xl p-3 bg-muted/10">
                  {locations.length === 0 ? (
                    <p className="text-center text-xs font-semibold text-muted-foreground py-6">지정된 위치 목록이 존재하지 않습니다.</p>
                  ) : (
                    locations.map(loc => (
                      <div key={loc.id} className="flex items-center justify-between p-2.5 rounded-xl bg-card border border-border hover:border-muted-foreground transition-all">
                        <span className="text-xs font-black text-foreground flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-rose-500" />
                          {loc.name}
                        </span>
                        <button
                          onClick={() => handleDeleteLocation(loc.id, loc.name)}
                          className="p-1 px-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors text-[10px] font-black"
                        >
                          지점 삭제
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Bottom Cancel Close Button */}
                <div className="mt-6 pt-4 border-t border-border flex justify-end">
                  <button
                    onClick={() => setIsLocationModalOpen(false)}
                    className="px-5 py-3 bg-slate-900 border border-border text-white rounded-xl font-black text-xs"
                  >
                    설정창 닫기
                  </button>
                </div>

              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </PCAdminLayout>
  );
};

export default PCAdminPerceivedTemp;
