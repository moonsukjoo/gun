import React, { useState, useEffect, useRef } from 'react';
import { db } from '@/src/firebase';
import { collection, onSnapshot, query, where, addDoc } from 'firebase/firestore';
import { Training, TrainingResult, QuizQuestion } from '@/src/types';
import { useAuth } from '@/src/components/AuthProvider';
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
  Star
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

export const TrainingList: React.FC = () => {
  const { profile } = useAuth();
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

  useEffect(() => {
    if (!profile) return;
    const unsubscribeT = onSnapshot(collection(db, 'trainings'), (snap) => {
      const all = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Training));
      const filtered = all.filter(t => 
        (t.status === 'PUBLISHED' || !t.status) && 
        (!t.targetJobRole || t.targetJobRole === profile.jobRole || t.targetJobRole === 'ALL')
      );
      setTrainings(filtered);
    });
    const qResults = query(collection(db, 'trainingResults'), where('uid', '==', profile.uid));
    const unsubscribeR = onSnapshot(qResults, (snap) => {
      setResults(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TrainingResult)));
    });
    return () => { unsubscribeT(); unsubscribeR(); };
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
    const selected = [...target.questions].sort(() => 0.5 - Math.random()).slice(0, target.questionsPerExam || target.questions.length);
    setActiveQuestions(selected);
    setCurrentAnswers({});
    setTimeLeft((target.timeLimit || 15) * 60);
    setIsExamMode(true);
  };

  const handleSubmitExam = async (isAuto = false) => {
    if (!selectedTraining || !profile || activeQuestions.length === 0) return;
    if (!isAuto && Object.keys(currentAnswers).length < activeQuestions.length) {
      toast.error('모든 문제를 풀어주세요.'); return;
    }
    let score = 0;
    activeQuestions.forEach(q => { if (currentAnswers[q.id] === q.correctAnswer) score++; });
    const isPassed = score / activeQuestions.length >= 0.7;
    const resultData: Omit<TrainingResult, 'id'> = {
      trainingId: selectedTraining.id,
      trainingTitle: selectedTraining.title,
      uid: profile.uid,
      userName: profile.displayName,
      score,
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
      <header className="py-6">
        <h2 className="text-3xl font-black tracking-tight text-white leading-tight">직무 교육</h2>
        <p className="text-muted-foreground font-bold">안전한 업무를 위한 필수 코스</p>
      </header>

      <div className="space-y-3">
        {trainings.map(t => {
          const result = results.find(r => r.trainingId === t.id);
          return (
            <Card key={t.id} className="border-none shadow-none bg-card rounded-2xl overflow-hidden border border-white/5">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <Badge className={cn("rounded-lg font-black text-[10px]", result?.isPassed ? "bg-emerald-500/20 text-emerald-500" : "bg-white/5 text-muted-foreground")}>
                       {result?.isPassed ? '이수완료' : '교육중'}
                    </Badge>
                    <h3 className="text-lg font-black text-white tracking-tight">{t.title}</h3>
                    <p className="text-xs text-muted-foreground font-bold line-clamp-1">{t.description}</p>
                  </div>
                  <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-muted-foreground">
                    <BookOpen className="w-6 h-6" />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-white/5">
                   <div className="flex gap-4">
                      <span className="text-[10px] font-black text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> {t.timeLimit}분</span>
                      <span className="text-[10px] font-black text-muted-foreground flex items-center gap-1"><HelpCircle className="w-3 h-3" /> {t.questions?.length}문항</span>
                   </div>
                   <Button 
                    className={cn("rounded-xl h-10 px-4 font-black shadow-none", result?.isPassed ? "bg-white/5 text-muted-foreground" : "bg-primary text-white")}
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
            <Star className="w-16 h-16 mx-auto mb-4" />
            <p className="font-black text-sm">등록된 교육이 없습니다</p>
          </div>
        )}
      </div>

      <Dialog open={!!selectedTraining && !isExamMode} onOpenChange={(open) => !open && setSelectedTraining(null)}>
        <DialogContent className="bg-card border-none rounded-3xl text-white max-w-[95vw] sm:max-w-md p-0 overflow-hidden flex flex-col max-h-[90vh]">
          {selectedTraining && (
            <>
              <DialogHeader className="p-8 pb-4">
                <DialogTitle className="text-xl font-black">{selectedTraining.title}</DialogTitle>
                <DialogDescription className="text-muted-foreground font-bold">충분히 학습 후 시험에 응시하세요</DialogDescription>
              </DialogHeader>
              <div className="p-8 overflow-y-auto flex-1 space-y-6">
                 <div className="markdown-body text-sm font-bold text-muted-foreground leading-relaxed">
                   <ReactMarkdown>{selectedTraining.content}</ReactMarkdown>
                 </div>
                 {selectedTraining.videoUrl && (
                   <Button className="w-full h-14 bg-white/5 text-white rounded-2xl gap-2" onClick={() => window.open(selectedTraining.videoUrl, '_blank')}>
                     <PlayCircle className="w-5 h-5" /> 시청각 자료 보기
                   </Button>
                 )}
              </div>
              <div className="p-6 border-t border-white/5">
                 <Button className="w-full h-16 bg-primary text-white font-black rounded-2xl" onClick={() => handleStartExam()}>
                   시험 응시하기
                 </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isExamMode} onOpenChange={setIsExamMode}>
        <DialogContent className="bg-[#1c1c1e] border-none rounded-3xl text-white p-0 overflow-hidden flex flex-col h-full max-h-[100vh] sm:max-h-[90vh]">
           <DialogHeader className="p-8 bg-white/5">
              <div className="flex justify-between items-center w-full">
                 <DialogTitle className="font-black">평가 수행</DialogTitle>
                 <Badge className="bg-primary/20 text-primary border-none flex gap-2 font-black">
                    <Clock className="w-3 h-3" /> {formatTime(timeLeft)}
                 </Badge>
              </div>
           </DialogHeader>
           <div className="p-8 flex-1 overflow-y-auto space-y-8">
              {activeQuestions.map((q, idx) => (
                <div key={q.id} className="space-y-4">
                   <h4 className="text-base font-black text-white">{idx+1}. {q.question}</h4>
                   <div className="grid gap-2">
                      {q.options.map((opt, oIdx) => (
                        <button 
                          key={oIdx}
                          onClick={() => setCurrentAnswers({...currentAnswers, [q.id]: oIdx})}
                          className={cn(
                            "p-4 rounded-2xl text-left font-bold text-xs border transition-all",
                            currentAnswers[q.id] === oIdx ? "bg-primary border-primary text-white" : "bg-white/5 border-white/5 text-muted-foreground"
                          )}
                        >
                          {opt}
                        </button>
                      ))}
                   </div>
                </div>
              ))}
           </div>
           <div className="p-6 border-t border-white/5">
             <Button className="w-full h-16 bg-white text-black font-black rounded-2xl" onClick={() => handleSubmitExam()}>
               제출 완료
             </Button>
           </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isResultOpen} onOpenChange={setIsResultOpen}>
        <DialogContent className="bg-card border-none rounded-3xl text-white max-w-sm text-center p-8 space-y-6">
           {lastResult && (
             <>
               <div className={cn("w-20 h-20 mx-auto rounded-3xl flex items-center justify-center", lastResult.isPassed ? "bg-emerald-500" : "bg-red-500")}>
                  {lastResult.isPassed ? <Trophy className="w-10 h-10 text-white" /> : <AlertCircle className="w-10 h-10 text-white" />}
               </div>
               <div className="space-y-1">
                  <h3 className="text-2xl font-black">{lastResult.isPassed ? '시험 합격!' : '시험 불합격'}</h3>
                  <p className="text-muted-foreground font-bold">{lastResult.score} / {lastResult.totalQuestions} 문제 정답</p>
               </div>
               <Button className="w-full h-14 bg-primary text-white font-black rounded-2xl" onClick={() => setIsResultOpen(false)}>
                  확인
               </Button>
             </>
           )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
