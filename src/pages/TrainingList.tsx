import React, { useState, useEffect, useRef } from 'react';
import { db } from '@/firebase';
import { collection, onSnapshot, query, where, addDoc, setDoc, doc, getDoc, getDocs } from 'firebase/firestore';
import { Training, TrainingResult, QuizQuestion, StatutorySession, StatutoryCompletion } from '@/types';
import { useAuth } from '@/components/AuthProvider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  BookOpen, 
  CheckCircle2, 
  PlayCircle, 
  HelpCircle,
  Trophy,
  AlertCircle,
  Clock,
  FileText,
  Star,
  Users,
  Video,
  PenTool,
  Calendar,
  AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

export const TrainingList: React.FC = () => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'JOB' | 'STATUTORY'>('STATUTORY');
  
  // Job training states
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [results, setResults] = useState<TrainingResult[]>([]);
  const [selectedTraining, setSelectedTraining] = useState<Training | null>(null);
  const [isExamMode, setIsExamMode] = useState(false);
  const [activeQuestions, setActiveQuestions] = useState<QuizQuestion[]>([]);
  const [currentAnswers, setCurrentAnswers] = useState<Record<string, number>>({});
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [lastResult, setLastResult] = useState<TrainingResult | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Statutory training states
  const [statutorySessions, setStatutorySessions] = useState<StatutorySession[]>([]);
  const [statutoryCompletions, setStatutoryCompletions] = useState<StatutoryCompletion[]>([]);
  const [selectedStatutory, setSelectedStatutory] = useState<StatutorySession | null>(null);
  const [isStatutorySignOpen, setIsStatutorySignOpen] = useState(false);
  
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedRound, setSelectedRound] = useState<number>(1);
  const [isSigning, setIsSigning] = useState(false);
  const [signName, setSignName] = useState('');
  const [hasDrawn, setHasDrawn] = useState(false);
  const [hasDrawnEval, setHasDrawnEval] = useState(false);
  const [evaluationGrade, setEvaluationGrade] = useState<string>('우수 (A)');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const evalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Drawing pad handlers (supporting both attendance and evaluation pads)
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>, type: 'main' | 'eval') => {
    e.preventDefault();
    const canvas = type === 'main' ? canvasRef.current : evalCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let x, y;
    if ('touches' in e) {
      if (e.touches.length === 0) return;
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>, type: 'main' | 'eval') => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = type === 'main' ? canvasRef.current : evalCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let x, y;
    if ('touches' in e) {
      if (e.touches.length === 0) return;
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.lineTo(x, y);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    if (type === 'main') {
      setHasDrawn(true);
    } else {
      setHasDrawnEval(true);
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = (type: 'main' | 'eval') => {
    const canvas = type === 'main' ? canvasRef.current : evalCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (type === 'main') {
      setHasDrawn(false);
    } else {
      setHasDrawnEval(false);
    }
  };

  const submitSignature = async () => {
    if (!selectedStatutory || !profile) return;
    if (!signName.trim()) {
      toast.error('서명자 성명을 정밀히 기재해 주십시오.');
      return;
    }
    if (!hasDrawn || !canvasRef.current) {
      toast.error('1단계: 참석 확인 패드 박스에 친필 서명을 기재해 주십시오.');
      return;
    }
    if (!hasDrawnEval || !evalCanvasRef.current) {
      toast.error('3단계: 평가 인증 패드 박스에 친필 서명을 기재해 주십시오.');
      return;
    }

    setIsSigning(true);
    try {
      const sigData = canvasRef.current.toDataURL('image/png');
      const evalSigData = evalCanvasRef.current.toDataURL('image/png');
      const compId = `${selectedStatutory.id}_${profile.uid}`;
      const compData: StatutoryCompletion = {
        id: compId,
        sessionId: selectedStatutory.id,
        uid: profile.uid,
        userName: signName.trim(),
        userRole: profile.role || 'WORKER',
        departmentName: profile.departmentName || '용접팀',
        position: profile.position || '기공',
        category: selectedStatutory.category,
        year: selectedStatutory.year,
        month: selectedStatutory.month,
        round: selectedStatutory.round,
        completedAt: new Date().toISOString(),
        signatureUrl: sigData,
        evalSignatureUrl: evalSigData,
        evaluationGrade: evaluationGrade,
        status: 'COMPLETED'
      };

      await setDoc(doc(db, 'statutoryCompletions', compId), compData);
      toast.success('법정 필수 정기교육 참석 이수 및 성과 평가 서명 날인이 완수되어 최종 등록되었습니다.');
      setIsStatutorySignOpen(false);
      setSelectedStatutory(null);
      // Reset draws
      setHasDrawn(false);
      setHasDrawnEval(false);
    } catch (e) {
      console.error(e);
      toast.error('통신 대기시간이 만료되었습니다. 다시 시도하십시오.');
    } finally {
      setIsSigning(false);
    }
  };

  // Sync Listeners
  useEffect(() => {
    if (!profile) return;
    
    // 1. Regular job trainings list
    const unsubscribeT = onSnapshot(collection(db, 'trainings'), (snap) => {
      const all = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Training));
      const filtered = all.filter(t => 
        (t.status === 'PUBLISHED' || !t.status) && 
        (!t.targetJobRole || t.targetJobRole === profile.jobRole || t.targetJobRole === 'ALL')
      );
      setTrainings(filtered);
    }, (error) => console.error("Trainings listener error:", error));

    const qResults = query(collection(db, 'trainingResults'), where('uid', '==', profile.uid));
    const unsubscribeR = onSnapshot(qResults, (snap) => {
      setResults(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TrainingResult)));
    }, (error) => console.error("Training results listener error:", error));

    // 2. Statutory safety sessions
    const unsubStatSessions = onSnapshot(collection(db, 'statutorySessions'), (snap) => {
      const all = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as StatutorySession));
      setStatutorySessions(all);
    }, (err) => console.error("Statutory sessions listener error:", err));

    // 3. Statutory completions for current user
    const qComps = query(collection(db, 'statutoryCompletions'), where('uid', '==', profile.uid));
    const unsubStatCompletions = onSnapshot(qComps, (snap) => {
      setStatutoryCompletions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as StatutoryCompletion)));
    }, (err) => console.error("Statutory completions listener error:", err));

    return () => { 
      unsubscribeT(); 
      unsubscribeR(); 
      unsubStatSessions();
      unsubStatCompletions();
    };
  }, [profile]);

  // Seeding default statutory templates
  useEffect(() => {
    if (!profile) return;

    const seedStatutorySessions = async () => {
      try {
        const seedRef = doc(db, 'settings', 'statutorySeeding');
        const seedSnap = await getDoc(seedRef);
        
        // If already marked as seeded in Firestore, do not run template seeding
        if (seedSnap.exists() && seedSnap.data()?.seeded) {
          return;
        }

        // Additional safeguard: if sessions already exist in DB, mark as seeded and skip
        const existingSnap = await getDocs(collection(db, 'statutorySessions'));
        if (!existingSnap.empty) {
          try {
            await setDoc(seedRef, { seeded: true, timestamp: new Date().toISOString() });
          } catch (writeErr) {
            console.log("Non-admin user skipped writing seedRef:", writeErr);
          }
          return;
        }

        const year = new Date().getFullYear();
        const month = new Date().getMonth() + 1;
        
        const templates = [
          {
            id: `${year}_${String(month).padStart(2, '0')}_1_onsite_전체`,
            title: `${month}월 1회차 법정 현장안전보건 교육`,
            year,
            month,
            round: 1,
            category: '현장안전 교육',
            content: `### 현장 밀폐구역 작업 안전 지침 및 통제 요령\n\n조선소 야드 내 탱크(Tank), 이중저(Double Bottom), 보이드 스페이스(Void Space) 등 밀폐구역은 산소 결핍 및 가스 인화로 인한 대형 재해 위험도가 극도로 빈번합니다.\n\n**[핵심 통제대책 및 행동 지침]**\n1. **산소 및 유해가스 농도 상시 계측**: 밀폐지대 출입구에서 센서 측정 장비를 완벽히 가동하여 산소 농도 18% 이상, 황화수소 10ppm 미만을 기록 계측하십시오.\n2. **강제 환기 펜 연속 기동**: 고효율 배풍기와 가요성 덕트를 깊게 안착시켜 정체된 흄과 먼지를 즉시 배기 하십시오.\n3. **투입 상시 무전 감시자 현장 배치**: 밀폐구역 맨홀 웰 바깥에 비상 대기용 마스크를 견지한 1명 이상의 감시인을 기공들과 상시 유지하십시오.`,
            targetDepartment: '전체',
            instructor: '문석주 (안전관리자)',
            location: '탈의실',
            createdAt: new Date().toISOString()
          },
          {
            id: `${year}_${String(month).padStart(2, '0')}_1_video_전체`,
            title: `${month}월 1회차 법정 영상안전보건 교육`,
            year,
            month,
            round: 1,
            category: '영상안전보건 교육',
            content: `### 시청각 안전 보건 및 보호구 핵심 착용법 교육\n\n조선업 10대 기본 철칙 및 주요 추락 전도 충돌 협착 중점 예방을 시청하며 생명권을 파악하는 필수 단과 영상 코스입니다.\n\n**[영상 핵심 학습 수칙]**\n- **안전 버클 턱끈 밀착**: 사소한 턱끈 풀림이 머리 뇌 외상을 수반합니다. 귀 주위 통풍 루프를 타이트하게 고정하십시오.\n- **안전대 하네스 2구 고리 체결**: 2m 이상의 블록 연도 가설 고소작업 시 항시 와이어 하네스를 신뢰성 있는 볼트 지지 고리에 선조치 체결할 것.\n- **방진 가스 마스크 흡기 밸브 점검**: 그라인딩 사상 분진 노출 즉시 전용 카트리지를 확인 후 조임 스트랩 밀봉 교정.`,
            targetDepartment: '전체',
            instructor: '정지훈 (시청각보건전문원)',
            location: '모바일 동영상 학습 (온라인)',
            videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            createdAt: new Date().toISOString()
          },
          {
            id: `${year}_${String(month).padStart(2, '0')}_1_risk_전체`,
            title: `${month}월 1회차 정기 위험성평가 안전교육`,
            year,
            month,
            round: 1,
            category: '월간 위험성평가 교육',
            content: `### 갠트리 크레인 중량물 인양 반경 신호 수칙 위험성 평가\n\n초대형 선박 메가 블록 크레인 작업 구역의 붕괴, 불시기 낙하, 러깅 러그 파단 위해성에 대한 긴급 등급화 평가 교육안입니다.\n\n**[위험 특성 및 대책]**\n- **가해 요인**: 중량 인양물 유동 및 슬링 와이어 장력 이탈 피해서 낙하.\n- **위험도 등급**: 발생 대개 낮음, 사고시 치명 결과 (중대재해).\n- **현장 통제 조치**: 장비 중량 계측 기기 교정, 인양 가이드 통일 수신호 및 전용 무전 7채널 고정 준수. 반경 25미터 안전 옐로우 안전 테이프 바리케이트 설정.`,
            targetDepartment: '전체',
            instructor: '홍경철 (위험관리이사)',
            location: '서브 하이도크 연단 크레인 구역',
            createdAt: new Date().toISOString()
          }
        ];

        for (const t of templates) {
          const docId = t.id;
          await setDoc(doc(db, 'statutorySessions', docId), t);
        }

        // Successfully seeded, write seed settings
        try {
          await setDoc(seedRef, { seeded: true, timestamp: new Date().toISOString() });
        } catch (writeErr) {
          console.log("Non-admin user skipped updating seedRef:", writeErr);
        }
        console.log("Statutory template seeding complete & marked in Firestore settings collection.");
      } catch (e) {
        console.log("Seeding statutory safety models skipped or error:", e);
      }
    };
    seedStatutorySessions();
  }, [profile]);

  useEffect(() => {
    if (isExamMode && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) { handleSubmitExam(true); return 0; }
          return prev - 1;
        });
      }, 1000);
    } else { if (timerRef.current) clearInterval(timerRef.current); }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isExamMode, timeLeft]);

  const handleStartExam = (trainingOverride?: Training) => {
    const target = trainingOverride || selectedTraining;
    if (!target || !target.questions || target.questions.length === 0) {
      toast.error('문제가 없습니다.'); return;
    }

    // Check attempts limit (max 2 attempts)
    const userAttempts = results.filter(r => r.trainingId === target.id).length;
    if (userAttempts >= 2) {
      toast.error('최대 응시 횟수(2회)를 초과하였습니다.');
      return;
    }
    
    // Select questions randomly
    const selected = [...target.questions]
      .sort(() => 0.5 - Math.random())
      .slice(0, target.questionsPerExam || target.questions.length);

    // IMPORTANT: Shuffle options for each selected question to prevent cheating
    const sessionQuestions = selected.map(q => {
      // Create a map of text to its original index
      const optionsWithIndices = q.options.map((opt, idx) => ({ text: opt, originalIdx: idx }));
      
      // Shuffle the options
      const shuffled = [...optionsWithIndices].sort(() => 0.5 - Math.random());
      
      // Find the new index of the correct answer
      const newCorrectIdx = shuffled.findIndex(o => o.originalIdx === q.correctAnswer);
      
      return {
        ...q,
        options: shuffled.map(o => o.text),
        correctAnswer: newCorrectIdx
      };
    });

    setActiveQuestions(sessionQuestions);
    setCurrentAnswers({});
    setTimeLeft((target.timeLimit || 15) * 60);
    setIsExamMode(true);
  };

  const handleSubmitExam = async (isAuto = false) => {
    if (!selectedTraining || !profile || activeQuestions.length === 0) return;
    if (!isAuto && Object.keys(currentAnswers).length < activeQuestions.length) {
      toast.warning('모든 문제를 풀어주세요.', {
        description: '남은 문제들을 모두 선택한 후 다시 제출 버튼을 눌러주세요.',
      }); 
      return;
    }
    let correctCount = 0;
    activeQuestions.forEach(q => { if (currentAnswers[q.id] === q.correctAnswer) correctCount++; });
    
    const pointsPerQuestion = selectedTraining.pointsPerQuestion || 20;
    const passingScore = selectedTraining.passingScore || 60;
    const totalScore = correctCount * pointsPerQuestion;
    const isPassed = totalScore >= passingScore;

    const resultData: Omit<TrainingResult, 'id'> = {
      trainingId: selectedTraining.id,
      trainingTitle: selectedTraining.title,
      uid: profile.uid,
      userName: profile.displayName,
      score: totalScore,
      totalQuestions: activeQuestions.length,
      isPassed,
      completedAt: new Date().toISOString()
    };
    try {
      const docRef = await addDoc(collection(db, 'trainingResults'), resultData);
      setLastResult({ id: docRef.id, ...resultData });
      setIsExamMode(false); setSelectedTraining(null); setIsResultOpen(true);
    } catch (error) { toast.error('저장 실패'); }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="space-y-6 pb-24 px-1">
      <header className="py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-foreground leading-tight">안전 교육 센터</h2>
          <p className="text-muted-foreground font-bold">건명기업 임직원 필수 직무 및 법정 교육 이수처</p>
        </div>
      </header>

      {/* Tab Switcher Area */}
      <div className="flex bg-muted p-1 rounded-2xl gap-1 border border-border">
        <button
          onClick={() => setActiveTab('STATUTORY')}
          className={cn(
            "flex-1 py-3 text-xs font-black rounded-xl transition-all",
            activeTab === 'STATUTORY' ? "bg-card text-foreground shadow-sm font-black" : "text-muted-foreground hover:bg-card/40"
          )}
        >
          정기 법정의무교육 & 서명
        </button>
        <button
          onClick={() => setActiveTab('JOB')}
          className={cn(
            "flex-1 py-3 text-xs font-black rounded-xl transition-all",
            activeTab === 'JOB' ? "bg-card text-foreground shadow-sm font-black" : "text-muted-foreground hover:bg-card/40"
          )}
        >
          직무/안전교육 시험
        </button>
      </div>

      {activeTab === 'JOB' ? (
        <div className="space-y-3">
          {trainings.map(t => {
            const result = results.find(r => r.trainingId === t.id);
            return (
              <Card key={t.id} className="border-none shadow-none bg-card rounded-2xl overflow-hidden border border-border">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <Badge className={cn("rounded-lg font-black text-[10px]", result?.isPassed ? "bg-emerald-500/20 text-emerald-500" : "bg-muted text-muted-foreground")}>
                         {result?.isPassed ? '이수완료' : '교육중'}
                      </Badge>
                      <h3 className="text-lg font-black text-foreground tracking-tight">{t.title}</h3>
                      <p className="text-xs text-muted-foreground font-bold line-clamp-1">{t.description}</p>
                    </div>
                    <div className="w-12 h-12 bg-muted rounded-2xl flex items-center justify-center text-muted-foreground">
                      <BookOpen className="w-6 h-6" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-border">
                     <div className="flex gap-4">
                        <span className="text-[10px] font-black text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> {t.timeLimit}분</span>
                        <span className="text-[10px] font-black text-muted-foreground flex items-center gap-1"><HelpCircle className="w-3 h-3" /> {t.questions?.length}문항</span>
                     </div>
                     <Button 
                      className={cn("rounded-xl h-10 px-4 font-black shadow-none", result?.isPassed ? "bg-muted text-muted-foreground" : "bg-primary text-white hover:bg-primary/90")}
                      onClick={() => setSelectedTraining(t)}
                     >
                       {result?.isPassed ? '학습하기' : '교육중'}
                     </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {trainings.length === 0 && (
            <div className="py-20 text-center opacity-30">
              <Star className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <p className="font-black text-sm text-muted-foreground">등록된 교육이 없습니다</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Calendar Selector Row */}
          <div className="bg-muted/50 p-4 rounded-2xl border border-border flex flex-col xs:flex-row gap-3 items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              <span className="text-xs font-black text-foreground">교육 회차 선택 :</span>
            </div>
            <div className="flex gap-2 w-full xs:w-auto">
              <select 
                value={selectedYear} 
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-card border border-border rounded-xl text-xs font-bold px-3 py-2 text-foreground focus:outline-none"
              >
                <option value={2025}>2025년</option>
                <option value={2026}>2026년</option>
              </select>
              <select 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="bg-card border border-border rounded-xl text-xs font-bold px-3 py-2 text-foreground focus:outline-none"
              >
                {[...Array(12)].map((_, i) => (
                  <option key={i+1} value={i+1}>{i+1}월</option>
                ))}
              </select>
              <select 
                value={selectedRound} 
                onChange={(e) => setSelectedRound(Number(e.target.value))}
                className="bg-card border border-border rounded-xl text-xs font-bold px-3 py-2 text-foreground focus:outline-none"
              >
                <option value={1}>1회차 (전반기)</option>
                <option value={2}>2회차 (후반기)</option>
              </select>
            </div>
          </div>

          {/* Statutory cards block */}
          <div className="space-y-4">
            {['현장안전 교육', '영상안전보건 교육', '월간 위험성평가 교육', '특별안전 교육', '신규입사자 교육'].map((cat, idx) => {
              // 1. Look for a session in this month/round/category where this user is explicitly targeted in allowedUids
              let matchedSession = statutorySessions.find(
                s => s.year === selectedYear && 
                     s.month === selectedMonth && 
                     s.round === selectedRound && 
                     s.category === cat &&
                     s.allowedUids && 
                     s.allowedUids.includes(profile?.uid || '')
              );
              
              // 2. If not found, look for a session matching department with no specific allowedUids
              if (!matchedSession) {
                matchedSession = statutorySessions.find(
                  s => s.year === selectedYear && 
                       s.month === selectedMonth && 
                       s.round === selectedRound && 
                       s.category === cat &&
                       (!s.allowedUids || s.allowedUids.length === 0) &&
                       (s.targetDepartment === '전체' || s.targetDepartment === profile?.departmentName)
                );
              }

              // 3. Fallback to match ANY session in this period with no specific allowedUids if none found
              if (!matchedSession) {
                matchedSession = statutorySessions.find(
                  s => s.year === selectedYear && 
                       s.month === selectedMonth && 
                       s.round === selectedRound && 
                       s.category === cat &&
                       (!s.allowedUids || s.allowedUids.length === 0)
                );
              }

              // If a session has specific allowedUids, but our current user is not in that list, don't show the training card
              if (matchedSession && matchedSession.allowedUids && matchedSession.allowedUids.length > 0) {
                if (!matchedSession.allowedUids.includes(profile?.uid || '')) {
                  return null;
                }
              }

              // Default behavior for new hire is to hide if not defined/matched
              if (!matchedSession && cat === '신규입사자 교육') {
                return null;
              }
              
              const matchedCompletion = statutoryCompletions.find(
                c => c.sessionId === matchedSession?.id && c.category === cat
              );

              return (
                <Card key={idx} className="border-none shadow-none bg-card rounded-2xl overflow-hidden border border-border">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className="bg-primary/10 text-primary border-none rounded-lg text-[9px] font-black">
                            법정 필수
                          </Badge>
                          {matchedSession && (
                            <Badge className="bg-blue-500/10 text-blue-500 border-none rounded-lg text-[9px] font-black">
                              대상: {matchedSession.targetDepartment || '전체'}
                            </Badge>
                          )}
                          <Badge className={cn("rounded-lg font-black text-[9px]", matchedCompletion ? "bg-emerald-500/20 text-emerald-500" : "bg-rose-500/10 text-rose-500")}>
                            {matchedCompletion ? '이수 및 서명완료' : '미이수 (서명 필요)'}
                          </Badge>
                        </div>
                        <h3 className="text-base font-black text-foreground tracking-tight">
                          {matchedSession?.title || `${selectedMonth}월 ${selectedRound}회차 ${cat} (미등록 회차)`}
                        </h3>
                        <div className="text-[11px] text-muted-foreground font-medium space-y-1">
                          <p>• 강사: {matchedSession?.instructor || '안전지도교사'}</p>
                          <p>• 장소: {matchedSession?.location || '야드 지정구역'}</p>
                          {matchedSession && (
                            <>
                              <p>• 수강시간: <span className="text-primary font-bold">{matchedSession.durationMinutes || 60}분</span></p>
                              <p>• 교육방식: <span className="text-emerald-500 font-bold">{matchedSession.trainingMethod === 'ONLINE' ? '온라인 영상 학습 (비대면)' : '현장 직접 대면 교육'}</span></p>
                              <p>• 교육실시일: <span className="text-blue-500 font-bold">{matchedSession.trainingDate || (matchedSession.createdAt ? matchedSession.createdAt.split('T')[0] : '')}</span></p>
                            </>
                          )}
                        </div>
                      </div>
                      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", cat === '영상안전보건 교육' ? "bg-blue-500/10 text-blue-500" : "bg-amber-500/10 text-amber-500")}>
                        {cat === '영상안전보건 교육' ? <Video className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 mt-4 border-t border-border">
                      <div className="text-[10px] font-bold text-muted-foreground">
                        {matchedCompletion ? (
                          <span className="text-emerald-500 font-extrabold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> 이수완료 일자: {matchedCompletion.completedAt ? matchedCompletion.completedAt.split('T')[0] : ''}
                          </span>
                        ) : (
                          <span className="text-rose-400 font-bold flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" /> 벌점 부과 대상 (수강 기한 준수)
                          </span>
                        )}
                      </div>
                      
                      {matchedCompletion ? (
                        <div className="flex items-center gap-2">
                          <img 
                            src={matchedCompletion.signatureUrl} 
                            alt="Signed Signature" 
                            className="h-8 max-w-[60px] object-contain border border-border border-dashed rounded bg-white px-1 py-0.5" 
                            referrerPolicy="no-referrer"
                          />
                          <span className="text-xs font-black text-emerald-500">{matchedCompletion.userName} (서명 확인)</span>
                        </div>
                      ) : (
                        <Button
                          disabled={!matchedSession}
                          onClick={() => {
                            if (matchedSession) {
                              setSelectedStatutory(matchedSession);
                              setSignName(profile?.displayName || '');
                              setHasDrawn(false);
                              setIsStatutorySignOpen(true);
                            }
                          }}
                          className="rounded-xl h-10 px-4 bg-primary text-white hover:bg-primary/90 font-black shadow-none text-xs"
                        >
                          {matchedSession ? '교육참여 & 친필서명' : '개설 대기중'}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* Special Re-education sessions for absentees */}
            {statutorySessions.filter(
              s => (s as any).isReeducation &&
                   s.year === selectedYear &&
                   s.month === selectedMonth &&
                   s.round === selectedRound &&
                   (s as any).allowedUids?.includes(profile?.uid)
            ).map((reSession, idx) => {
              const matchedCompletion = statutoryCompletions.find(
                c => c.sessionId === reSession.id
              );
              return (
                <Card key={`re_${idx}`} className="border-2 border-red-500/20 bg-card rounded-2xl overflow-hidden shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className="bg-red-500/10 text-red-500 border-none rounded-lg text-[9px] font-black">
                            불참자 특별 대면 재교육 🚨
                          </Badge>
                          <Badge className={cn("rounded-lg font-black text-[9px]", matchedCompletion ? "bg-emerald-500/20 text-emerald-500" : "bg-red-500/20 text-red-500")}>
                            {matchedCompletion ? '재교육 이수완료' : '미이수 (친필서명 필요)'}
                          </Badge>
                        </div>
                        <h3 className="text-base font-black text-foreground tracking-tight">
                          {reSession.title}
                        </h3>
                        <div className="text-[11px] text-muted-foreground font-medium space-y-1">
                          <p>• 강사: {reSession.instructor}</p>
                          <p>• 장소: {reSession.location}</p>
                          <p>• 수강시간: <span className="text-primary font-bold">{reSession.durationMinutes || 60}분</span></p>
                          <p>• 교육실시일: <span className="text-blue-500 font-bold">{reSession.trainingDate}</span></p>
                        </div>
                      </div>
                      <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 mt-4 border-t border-border">
                      <div className="text-[10px] font-bold text-muted-foreground">
                        {matchedCompletion ? (
                          <span className="text-emerald-500 font-extrabold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> 이수기록 접수됨 ({matchedCompletion.completedAt ? matchedCompletion.completedAt.split('T')[0] : ''})
                          </span>
                        ) : (
                          <span className="text-red-500 font-bold flex items-center gap-1 animate-pulse">
                            <AlertTriangle className="w-3.5 h-3.5" /> 벌점 부과 대상 (미수강 시 징계 조치)
                          </span>
                        )}
                      </div>
                      
                      {matchedCompletion ? (
                        <div className="flex items-center gap-2">
                          <img 
                            src={matchedCompletion.signatureUrl} 
                            alt="Signed Signature" 
                            className="h-8 max-w-[60px] object-contain border border-border border-dashed rounded bg-white px-1 py-0.5" 
                            referrerPolicy="no-referrer"
                          />
                          <span className="text-xs font-black text-emerald-500">{matchedCompletion.userName} (날인 확인)</span>
                        </div>
                      ) : (
                        <Button
                          onClick={() => {
                            setSelectedStatutory(reSession);
                            setSignName(profile?.displayName || '');
                            setHasDrawn(false);
                            setIsStatutorySignOpen(true);
                          }}
                          className="rounded-xl h-10 px-4 bg-red-500 hover:bg-red-600 text-white font-black shadow-none text-xs border-none"
                        >
                          재교육 참여 & 수강서명
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Reg Job Dialogs */}
      <Dialog open={!!selectedTraining && !isExamMode} onOpenChange={(open) => !open && setSelectedTraining(null)}>
        <DialogContent className="bg-card border border-border rounded-3xl text-foreground max-w-[95vw] sm:max-w-md p-0 overflow-hidden flex flex-col max-h-[90vh] shadow-2xl">
          {selectedTraining && (
            <>
              <DialogHeader className="p-8 pb-4">
                <DialogTitle className="text-xl font-black">{selectedTraining.title}</DialogTitle>
                <DialogDescription className="text-muted-foreground font-bold">충분히 학습 후 시험에 응시하세요</DialogDescription>
              </DialogHeader>
              <div className="p-8 overflow-y-auto flex-1 space-y-6">
                 <div className="markdown-body text-sm font-bold text-foreground leading-relaxed">
                   <ReactMarkdown>{selectedTraining.content}</ReactMarkdown>
                 </div>
                 {selectedTraining.videoUrl && (
                   <Button className="w-full h-14 bg-muted text-foreground rounded-2xl gap-2 hover:bg-muted/80" onClick={() => window.open(selectedTraining.videoUrl, '_blank')}>
                     <PlayCircle className="w-5 h-5" /> 시청각 자료 보기
                   </Button>
                 )}
              </div>
              <div className="p-6 border-t border-border space-y-2">
                 {(() => {
                    const attempts = results.filter(r => r.trainingId === selectedTraining.id).length;
                    return (
                      <>
                        <Button 
                          className="w-full h-16 bg-primary text-white font-black rounded-2xl disabled:opacity-50 shadow-lg shadow-primary/20" 
                          onClick={() => handleStartExam()}
                          disabled={attempts >= 2}
                        >
                          {attempts >= 2 ? '응시 기회 소진' : '시험 응시하기'}
                        </Button>
                        <p className="text-[10px] text-center text-muted-foreground font-bold">
                          남은 응시 기회: <span className={cn(attempts >= 2 ? "text-red-400" : "text-emerald-400")}>{Math.max(0, 2 - attempts)}회</span> (총 2회)
                        </p>
                      </>
                    );
                 })()}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isExamMode} onOpenChange={setIsExamMode}>
        <DialogContent className="bg-card border border-border rounded-3xl text-foreground p-0 overflow-hidden flex flex-col h-full max-h-[100vh] sm:max-h-[90vh] shadow-2xl">
           <DialogHeader className="p-8 bg-muted/30 border-b border-border">
              <div className="flex justify-between items-center w-full">
                 <DialogTitle className="font-black">평가 수행</DialogTitle>
                 <Badge className="bg-primary/10 text-primary border-none flex gap-2 font-black h-8">
                    <Clock className="w-3.5 h-3.5" /> {formatTime(timeLeft)}
                 </Badge>
              </div>
           </DialogHeader>
           <div className="p-8 flex-1 overflow-y-auto space-y-8">
              {activeQuestions.map((q, idx) => (
                <div key={q.id} className="space-y-4">
                   <h4 className="text-base font-black text-foreground">{idx+1}. {q.question}</h4>
                   <div className="grid gap-2">
                      {q.options.map((opt, oIdx) => (
                        <button 
                          key={oIdx}
                          onClick={() => setCurrentAnswers({...currentAnswers, [q.id]: oIdx})}
                          className={cn(
                            "p-4 rounded-2xl text-left font-bold text-xs border transition-all",
                            currentAnswers[q.id] === oIdx ? "bg-primary border-primary text-white shadow-lg shadow-primary/20" : "bg-muted border-border text-foreground hover:bg-muted/80"
                          )}
                        >
                          {oIdx + 1}. {String(opt).replace(/^\d+[\.\)\s]+/, '')}
                        </button>
                      ))}
                   </div>
                </div>
              ))}
           </div>
           <div className="p-6 border-t border-border">
             <Button className="w-full h-16 bg-foreground text-background font-black rounded-2xl shadow-xl active:scale-95 transition-all" onClick={() => handleSubmitExam()}>
               제출 완료
             </Button>
           </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isResultOpen} onOpenChange={setIsResultOpen}>
        <DialogContent className="bg-card border border-border rounded-3xl text-foreground max-w-sm text-center p-8 space-y-6 shadow-2xl">
           {lastResult && (
             <>
               <div className={cn("w-20 h-20 mx-auto rounded-3xl flex items-center justify-center shadow-lg", lastResult.isPassed ? "bg-emerald-500" : "bg-red-500")}>
                  {lastResult.isPassed ? <Trophy className="w-10 h-10 text-white" /> : <AlertCircle className="w-10 h-10 text-white" />}
               </div>
               <div className="space-y-1">
                  <h3 className="text-2xl font-black">{lastResult.isPassed ? '시험 합격!' : '시험 불합격'}</h3>
                  <p className="text-muted-foreground font-bold">{lastResult.score}점 ({lastResult.totalQuestions}문항 응시)</p>
               </div>
               <Button className="w-full h-14 bg-primary text-white font-black rounded-2xl shadow-lg shadow-primary/20" onClick={() => setIsResultOpen(false)}>
                  확인
               </Button>
             </>
           )}
        </DialogContent>
      </Dialog>

      {/* Statutory Safety Modal Dialog with Digital Signature Pad */}
      <Dialog 
        open={isStatutorySignOpen} 
        onOpenChange={(open) => {
          setIsStatutorySignOpen(open);
          if (open) {
            setTimeout(() => {
              clearCanvas('main');
              clearCanvas('eval');
            }, 200);
          } else {
            setSelectedStatutory(null);
          }
        }}
      >
        <DialogContent className="bg-card border border-border rounded-3xl text-foreground p-0 overflow-hidden flex flex-col max-w-[95vw] sm:max-w-xl max-h-[92vh] shadow-2xl">
          {selectedStatutory && (
            <>
              <DialogHeader className="p-8 pb-4 bg-muted/20 border-b border-border">
                <div className="space-y-1">
                  <Badge className="bg-primary/10 text-primary border-none rounded-lg text-[9px] font-black">
                     정기 법정의무 이행
                  </Badge>
                  <DialogTitle className="text-xl font-black">{selectedStatutory.title}</DialogTitle>
                  <p className="text-xs text-muted-foreground font-bold">
                     강사: {selectedStatutory.instructor} | 장소: {selectedStatutory.location}
                  </p>
                </div>
              </DialogHeader>

              <div className="p-8 overflow-y-auto flex-1 space-y-6">
                <div className="markdown-body text-xs font-medium text-foreground leading-relaxed whitespace-pre-wrap">
                  <ReactMarkdown>{selectedStatutory.content}</ReactMarkdown>
                </div>
                
                {selectedStatutory.videoUrl && (
                  <Button 
                    className="w-full h-12 bg-red-500 hover:bg-red-600 text-white rounded-xl gap-2 text-xs font-black" 
                    onClick={() => window.open(selectedStatutory.videoUrl, '_blank')}
                  >
                    <Video className="w-4 h-4" /> 교육 영상 시청 (온라인 강의 수강)
                  </Button>
                )}

                {/* Name validation at the top */}
                <div className="space-y-2 pt-4 border-t border-border">
                  <label className="text-xs font-black text-foreground">서명자 실명 확인 (수강 사원 성함)</label>
                  <input 
                    type="text"
                    placeholder="본인의 실명을 정밀히 기재하여 주십시오."
                    value={signName}
                    onChange={(e) => setSignName(e.target.value)}
                    className="w-full h-12 px-4 rounded-xl border border-input text-xs font-bold text-foreground bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/10"
                  />
                </div>

                {/* Pad 1: Attendance Signature */}
                <div className="space-y-3 pt-3 border-t border-border">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-black text-foreground flex items-center gap-1">
                      <span className="w-4 h-4 rounded bg-primary text-white text-[10px] font-extrabold flex items-center justify-center">1</span>
                      교육 수강 이수 서명 날인
                    </label>
                    <button 
                      onClick={() => clearCanvas('main')} 
                      className="text-[10px] font-black hover:text-red-500 underline text-muted-foreground"
                    >
                      이수 서명 지우기
                    </button>
                  </div>
                  
                  <div className="border border-input border-dashed rounded-2xl overflow-hidden bg-white p-2">
                    <canvas
                      ref={canvasRef}
                      width={440}
                      height={140}
                      onMouseDown={(e) => startDrawing(e, 'main')}
                      onMouseMove={(e) => draw(e, 'main')}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={(e) => startDrawing(e, 'main')}
                      onTouchMove={(e) => draw(e, 'main')}
                      onTouchEnd={stopDrawing}
                      className="w-full bg-white h-[140px] touch-none cursor-crosshair rounded-xl block"
                      style={{ touchAction: 'none' }}
                    />
                  </div>
                </div>

                {/* Step 2: Evaluation Grade Selection */}
                <div className="space-y-3 pt-4 border-t border-border">
                  <label className="text-xs font-black text-foreground flex items-center gap-1">
                    <span className="w-4 h-4 rounded bg-primary text-white text-[10px] font-extrabold flex items-center justify-center">2</span>
                    교육 이수 성과 평가 (본인 점검)
                  </label>
                  <p className="text-[10px] text-muted-foreground font-semibold">본 교육 과정의 전달 내용과 전사 안전 수칙에 관한 자사 이해도를 선택하십시오.</p>
                  <div className="grid grid-cols-3 gap-2">
                    {['우수 (A)', '보통 (B)', '미흡 (C)'].map((grade) => (
                      <button
                        key={grade}
                        type="button"
                        onClick={() => setEvaluationGrade(grade)}
                        className={cn(
                          "py-3 rounded-xl border text-xs font-black transition-all",
                          evaluationGrade === grade 
                            ? "bg-primary text-white border-primary shadow-sm" 
                            : "bg-muted/40 text-muted-foreground hover:bg-muted"
                        )}
                      >
                        {grade}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pad 2: Evaluation Signature */}
                <div className="space-y-3 pt-4 border-t border-border">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-black text-foreground flex items-center gap-1">
                      <span className="w-4 h-4 rounded bg-primary text-white text-[10px] font-extrabold flex items-center justify-center">3</span>
                      교육 평가 확인 서명 날인
                    </label>
                    <button 
                      onClick={() => clearCanvas('eval')} 
                      className="text-[10px] font-black hover:text-red-500 underline text-muted-foreground"
                    >
                      평가 서명 지우기
                    </button>
                  </div>
                  
                  <div className="border border-input border-dashed rounded-2xl overflow-hidden bg-white p-2">
                    <canvas
                      ref={evalCanvasRef}
                      width={440}
                      height={140}
                      onMouseDown={(e) => startDrawing(e, 'eval')}
                      onMouseMove={(e) => draw(e, 'eval')}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={(e) => startDrawing(e, 'eval')}
                      onTouchMove={(e) => draw(e, 'eval')}
                      onTouchEnd={stopDrawing}
                      className="w-full bg-white h-[140px] touch-none cursor-crosshair rounded-xl block"
                      style={{ touchAction: 'none' }}
                    />
                  </div>
                  <p className="text-[9px] text-center text-muted-foreground font-semibold">
                    ※ 산업안전보건법 시행규칙에 준거하여 교육 및 교육 결과 평가 서명이 동시에 등재됩니다.
                  </p>
                </div>
              </div>

              <div className="p-6 border-t border-border bg-muted/10">
                <Button 
                  className="w-full h-14 bg-primary text-white font-black rounded-2xl shadow-lg shadow-primary/20 flex gap-2 justify-center items-center cursor-pointer active:scale-[0.98] transition-transform" 
                  onClick={submitSignature}
                  disabled={isSigning}
                >
                  {isSigning ? '법정 원부 등록 처리중...' : '이수 서명 및 가치 평가 최종 서명완료'}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
