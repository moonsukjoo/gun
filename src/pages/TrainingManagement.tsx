import React, { useState, useEffect } from 'react';
import { db } from '@/src/firebase';
import { collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { Training, JobRole, QuizQuestion } from '@/src/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2, BookOpen, Layers, HelpCircle, CheckCircle2, AlertCircle, FileUp, Clock, Eye, Send, Circle } from 'lucide-react';
import { useAuth } from '@/src/components/AuthProvider';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';

export const TrainingManagement: React.FC = () => {
  const { profile } = useAuth();
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const DEFAULT_JOB_ROLES = ['취부', '용접', '사상', '도장', '반장', '조장', '기타'];
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isExamOpen, setIsExamOpen] = useState(false);
  const [selectedTrainingId, setSelectedTrainingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'PUBLISHED' | 'DRAFT'>('PUBLISHED');

  const [newTraining, setNewTraining] = useState({
    title: '',
    description: '',
    content: '',
    videoUrl: '',
    targetJobRole: 'ALL',
    fileName: '',
    fileUrl: '',
  });

  const [editTraining, setEditTraining] = useState<Training | null>(null);

  const [examSettings, setExamSettings] = useState({
    questionsPerExam: 5,
    timeLimit: 15,
    questions: [] as QuizQuestion[],
  });

  const canManageTraining = profile && (
    ['CEO', 'SAFETY_MANAGER', 'DIRECTOR'].includes(profile.role) || 
    profile.permissions?.includes('training_mgmt')
  );

  useEffect(() => {
    const unsubscribeT = onSnapshot(query(collection(db, 'trainings'), orderBy('createdAt', 'desc')), (snap) => {
      setTrainings(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Training)));
    });
    const unsubscribeJR = onSnapshot(query(collection(db, 'jobRoles'), orderBy('name')), (snap) => {
      setJobRoles(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as JobRole)));
    });
    return () => {
      unsubscribeT();
      unsubscribeJR();
    };
  }, []);

  const handleUpdateEducation = async () => {
    if (!editTraining || !editTraining.title || !editTraining.content) {
      toast.error('제목과 내용을 입력해주세요.');
      return;
    }

    try {
      const { id, questions, createdAt, status, ...updateData } = editTraining;
      await updateDoc(doc(db, 'trainings', id), {
        ...updateData,
        targetJobRole: updateData.targetJobRole === 'ALL' ? '' : updateData.targetJobRole,
      });
      setIsEditOpen(false);
      setEditTraining(null);
      toast.success('교육 자료가 수정되었습니다.');
    } catch (error) {
      toast.error('수정 중 오류가 발생했습니다.');
    }
  };

  const handleOpenEdit = (training: Training) => {
    setEditTraining({
      ...training,
      targetJobRole: training.targetJobRole || 'ALL'
    });
    setIsEditOpen(true);
  };

  const handleCreateEducation = async (status: 'DRAFT' | 'PUBLISHED') => {
    if (!newTraining.title || !newTraining.content) {
      toast.error('제목과 내용을 입력해주세요.');
      return;
    }

    try {
      await addDoc(collection(db, 'trainings'), {
        ...newTraining,
        targetJobRole: newTraining.targetJobRole === 'ALL' ? '' : newTraining.targetJobRole,
        questions: [],
        questionsPerExam: 5,
        timeLimit: 15,
        status,
        createdAt: new Date().toISOString()
      });
      setIsAddOpen(false);
      setNewTraining({ title: '', description: '', content: '', videoUrl: '', targetJobRole: 'ALL', fileName: '', fileUrl: '' });
      toast.success('교육 자료가 등록되었습니다. 이제 관리 목록에서 시험 문제를 등록해주세요.');
    } catch (error) {
      toast.error('등록 중 오류가 발생했습니다.');
    }
  };

  const handleOpenExamSetup = (training: Training) => {
    setSelectedTrainingId(training.id);
    setExamSettings({
      questionsPerExam: training.questionsPerExam || 5,
      timeLimit: training.timeLimit || 15,
      questions: training.questions || [],
    });
    setIsExamOpen(true);
  };

  const handleSaveExamSetup = async () => {
    if (!selectedTrainingId) return;
    if (examSettings.questions.length === 0) {
      toast.error('최소 1개 이상의 시험 문제를 등록해야 합니다.');
      return;
    }

    try {
      await updateDoc(doc(db, 'trainings', selectedTrainingId), {
        questions: examSettings.questions,
        questionsPerExam: examSettings.questionsPerExam,
        timeLimit: examSettings.timeLimit,
      });
      setIsExamOpen(false);
      toast.success('시험 설정이 저장되었습니다.');
    } catch (error) {
      toast.error('저장 중 오류가 발생했습니다.');
    }
  };

  const handleAddQuestion = () => {
    const qid = Math.random().toString(36).substring(2, 9);
    setExamSettings({
      ...examSettings,
      questions: [...examSettings.questions, { id: qid, question: '', options: ['', '', '', ''], correctAnswer: 0 }]
    });
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        const importedQuestions: QuizQuestion[] = data.map((item: any) => ({
          id: Math.random().toString(36).substring(2, 9),
          question: item.Question || item['문제'] || '',
          options: [
            item.Option1 || item['보기1'] || '',
            item.Option2 || item['보기2'] || '',
            item.Option3 || item['보기3'] || '',
            item.Option4 || item['보기4'] || '',
          ].filter(Boolean),
          correctAnswer: (parseInt(item.CorrectAnswer || item['정답']) || 1) - 1
        }));

        setExamSettings(prev => ({
          ...prev,
          questions: [...prev.questions, ...importedQuestions]
        }));
        toast.success(`${importedQuestions.length}개의 문제가 추가되었습니다.`);
      } catch (error) {
        toast.error('엑셀 파일 형식이 올바르지 않습니다.');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewTraining({
        ...newTraining,
        fileName: file.name,
        fileUrl: `mock-server-path/${file.name}`
      });
      toast.success(`${file.name} 파일이 선택되었습니다.`);
    }
  };

  const handleToggleStatus = async (training: Training) => {
    const newStatus = training.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    try {
      await updateDoc(doc(db, 'trainings', training.id), { status: newStatus });
      toast.success(newStatus === 'PUBLISHED' ? '게시되었습니다.' : '초안으로 변경되었습니다.');
    } catch (error) {
      toast.error('상태 변경 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteTraining = async (id: string) => {
    if (!confirm('정말로 삭제하시겠습니까?')) return;
    try {
      await deleteDoc(doc(db, 'trainings', id));
      toast.success('교육 자료가 삭제되었습니다.');
    } catch (error) {
      toast.error('삭제 중 오류가 발생했습니다.');
    }
  };

  if (!canManageTraining) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4 opacity-50" />
        <h2 className="text-xl font-black text-white mb-2">권한이 없습니다</h2>
        <p className="text-sm font-bold text-muted-foreground">교육 관리 권한이 있는 관리자만 접근 가능합니다.</p>
      </div>
    );
  }

  const filteredTrainings = trainings.filter(t => (t.status || 'PUBLISHED') === activeTab);

  return (
    <div className="pb-24 w-full flex flex-col items-center">
      <div className="w-full max-w-lg space-y-10">
        {/* Title Area - Brutalist Label style */}
        <div className="flex flex-col gap-6 pt-4 text-left">
          <div className="flex items-center gap-4 bg-card p-4 rounded-3xl shadow-sm border border-white/5">
            <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-200/20">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white leading-none">교육 관리 시스템</h2>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mt-1.5 flex items-center gap-1">
                <Circle className="w-1.5 h-1.5 fill-emerald-500 text-emerald-500" /> Admin Service
              </p>
            </div>
          </div>
          
          <Button 
            onClick={() => setIsAddOpen(true)}
            className="h-16 w-full rounded-3xl bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20 gap-3 font-black text-lg active:scale-[0.98] transition-all border-b-4 border-primary/70 text-white"
          >
            <Plus className="w-6 h-6 text-white" /> 새 교육 자료 등록
          </Button>
        </div>

        {/* Custom Tab Switcher - More robust than standard Tabs component */}
        <div className="space-y-6">
          <div className="bg-white/5 p-1.5 rounded-[2rem] flex gap-1.5 shadow-inner border border-white/5">
            <button
              onClick={() => setActiveTab('PUBLISHED')}
              className={cn(
                "flex-1 h-14 rounded-[1.7rem] font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2",
                activeTab === 'PUBLISHED' 
                  ? "bg-white text-black shadow-lg scale-100" 
                  : "text-muted-foreground hover:text-white hover:bg-white/5 scale-95 opacity-70"
              )}
            >
              <CheckCircle2 className={cn("w-4 h-4", activeTab === 'PUBLISHED' ? "text-emerald-500" : "text-muted-foreground")} />
              게시 중
            </button>
            <button
              onClick={() => setActiveTab('DRAFT')}
              className={cn(
                "flex-1 h-14 rounded-[1.7rem] font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2",
                activeTab === 'DRAFT' 
                  ? "bg-white text-black shadow-lg scale-100" 
                  : "text-muted-foreground hover:text-white hover:bg-white/5 scale-95 opacity-70"
              )}
            >
              <Eye className={cn("w-4 h-4", activeTab === 'DRAFT' ? "text-primary" : "text-muted-foreground")} />
              대기 / 초안
            </button>
          </div>

          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {filteredTrainings.length > 0 ? (
              filteredTrainings.map(t => (
                <RenderTrainingCard 
                   key={t.id} 
                   t={t} 
                   onToggle={() => handleToggleStatus(t)} 
                   onDelete={() => handleDeleteTraining(t.id)} 
                   onUpdateExam={() => handleOpenExamSetup(t)}
                   onEdit={() => handleOpenEdit(t)}
                />
              ))
            ) : (
              <EmptyState text={activeTab === 'PUBLISHED' ? "현재 게시된 교육이 없습니다." : "보관 중인 교육이 없습니다."} />
            )}
          </div>
        </div>
      </div>

      {/* Dialogs remain similar but ensure responsive padding */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="bg-card border-none rounded-[2rem] sm:rounded-[3rem] shadow-2xl max-w-2xl w-[95vw] p-0 overflow-hidden flex flex-col max-h-[90vh] text-white">
          <DialogHeader className="p-6 sm:p-10 pb-4 sm:pb-6 bg-white/5 border-b border-white/5 shrink-0 text-left">
            <DialogTitle className="text-xl sm:text-3xl font-black tracking-tighter flex items-center gap-3 sm:gap-4 text-white">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500 shrink-0">
                <BookOpen className="w-5 h-5 sm:w-7 h-7" />
              </div>
              교육 자료 등록
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 sm:p-10 space-y-6 overflow-y-auto no-scrollbar">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">교육 제목</label>
                <Input value={newTraining.title} onChange={e => setNewTraining({...newTraining, title: e.target.value})} placeholder="교육 제목 입력" className="h-12 font-bold bg-white/5 border-white/5 rounded-xl px-4 text-white placeholder:text-white/20" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">대상 직무</label>
                <Select value={newTraining.targetJobRole} onValueChange={v => setNewTraining({...newTraining, targetJobRole: v})}>
                  <SelectTrigger className="h-12 bg-white/5 border-white/5 rounded-xl font-bold px-4 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1c1c1e] rounded-xl border-white/5 shadow-xl text-white">
                    <SelectItem value="ALL">전체 공통</SelectItem>
                    {jobRoles.map(jr => <SelectItem key={jr.id} value={jr.name}>{jr.name}</SelectItem>)}
                    {jobRoles.length === 0 && DEFAULT_JOB_ROLES.map(jr => <SelectItem key={jr} value={jr}>{jr}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">학습 파일 (PDF/Excel) - 파일 선택 또는 URL 입력</label>
              <div className="flex flex-col gap-2">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1 h-12 bg-white/5 border border-white/5 rounded-xl flex items-center px-4 text-white/40 font-bold text-xs truncate">
                    {newTraining.fileName || '선택된 파일 없음'}
                  </div>
                  <Button variant="outline" className="h-12 px-4 rounded-xl font-black border-white/10 bg-white/5 text-white gap-2 shrink-0 hover:bg-white/10" onClick={() => document.getElementById('edu-file-upload')?.click()}>
                    <FileUp className="w-4 h-4" /> 파일 찾기
                  </Button>
                  <input id="edu-file-upload" type="file" className="hidden" accept=".pdf,.xlsx,.xls,.doc,.docx,.ppt,.pptx" onChange={handleFileUpload} />
                </div>
                <Input 
                  value={newTraining.fileUrl} 
                  onChange={e => setNewTraining({...newTraining, fileUrl: e.target.value, fileName: e.target.value ? (newTraining.fileName || '교안 자료') : ''})} 
                  placeholder="또는 직접 다운로드 URL 입력 (https://...)" 
                  className="h-12 font-bold bg-white/5 border-white/5 rounded-xl px-4 text-white placeholder:text-white/20" 
                />
                {newTraining.fileUrl && !newTraining.fileName && (
                  <Input 
                    value={newTraining.fileName} 
                    onChange={e => setNewTraining({...newTraining, fileName: e.target.value})} 
                    placeholder="표시할 파일 이름 입력" 
                    className="h-12 font-bold bg-white/5 border-white/5 rounded-xl px-4 text-white placeholder:text-white/20" 
                  />
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">설명</label>
              <Input value={newTraining.description} onChange={e => setNewTraining({...newTraining, description: e.target.value})} placeholder="교육 리스트 요약 설명" className="h-12 font-bold bg-white/5 border-white/5 rounded-xl px-4 text-white placeholder:text-white/20" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">비디오 URL</label>
              <Input value={newTraining.videoUrl} onChange={e => setNewTraining({...newTraining, videoUrl: e.target.value})} placeholder="YouTube URL" className="h-12 font-bold bg-white/5 border-white/5 rounded-xl px-4 text-white placeholder:text-white/20" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">상세 내용 (Markdown)</label>
              <Textarea value={newTraining.content} onChange={e => setNewTraining({...newTraining, content: e.target.value})} placeholder="교육 내용 입력" className="min-h-[160px] font-bold bg-white/5 border-white/5 rounded-2xl p-4 text-sm text-white placeholder:text-white/20" />
            </div>
          </div>
          <DialogFooter className="p-6 sm:p-10 pt-4 bg-white/5 border-t border-white/5 flex flex-col sm:flex-row gap-2 shrink-0">
            <Button variant="ghost" className="h-12 rounded-xl font-black text-muted-foreground hover:text-white" onClick={() => handleCreateEducation('DRAFT')}>
              초안 저장
            </Button>
            <Button className="h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-black text-white px-8" onClick={() => handleCreateEducation('PUBLISHED')}>
              게시 하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="bg-card border-none rounded-[2rem] sm:rounded-[3rem] shadow-2xl max-w-2xl w-[95vw] p-0 overflow-hidden flex flex-col max-h-[90vh] text-white">
          <DialogHeader className="p-6 sm:p-10 pb-4 sm:pb-6 bg-white/5 border-b border-white/5 shrink-0 text-left">
            <DialogTitle className="text-xl sm:text-3xl font-black tracking-tighter flex items-center gap-3 sm:gap-4 text-white">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500 shrink-0">
                <FileUp className="w-5 h-5 sm:w-7 h-7" />
              </div>
              교육 자료 수정
            </DialogTitle>
          </DialogHeader>
          {editTraining && (
            <div className="p-6 sm:p-10 space-y-6 overflow-y-auto no-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">교육 제목</label>
                  <Input value={editTraining.title} onChange={e => setEditTraining({...editTraining, title: e.target.value})} placeholder="교육 제목 입력" className="h-12 font-bold bg-white/5 border-white/5 rounded-xl px-4 text-white placeholder:text-white/20" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">대상 직무</label>
                  <Select value={editTraining.targetJobRole || 'ALL'} onValueChange={v => setEditTraining({...editTraining, targetJobRole: v})}>
                    <SelectTrigger className="h-12 bg-white/5 border-white/5 rounded-xl font-bold px-4 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1c1c1e] rounded-xl border-white/5 shadow-xl text-white">
                      <SelectItem value="ALL">전체 공통</SelectItem>
                      {jobRoles.map(jr => <SelectItem key={jr.id} value={jr.name}>{jr.name}</SelectItem>)}
                      {jobRoles.length === 0 && DEFAULT_JOB_ROLES.map(jr => <SelectItem key={jr} value={jr}>{jr}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">학습 파일 (PDF/Excel) - 파일 선택 또는 URL 입력</label>
                <div className="flex flex-col gap-2">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex-1 h-12 bg-white/5 border border-white/5 rounded-xl flex items-center px-4 text-white/40 font-bold text-xs truncate">
                      {editTraining.fileName || '선택된 파일 없음'}
                    </div>
                    <Button variant="outline" className="h-12 px-4 rounded-xl font-black border-white/10 bg-white/5 text-white gap-2 shrink-0 hover:bg-white/10" onClick={() => document.getElementById('edit-edu-file-upload')?.click()}>
                      <FileUp className="w-4 h-4" /> 파일 찾기
                    </Button>
                    <input id="edit-edu-file-upload" type="file" className="hidden" accept=".pdf,.xlsx,.xls,.doc,.docx,.ppt,.pptx" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setEditTraining({...editTraining, fileName: file.name, fileUrl: `mock-server-path/${file.name}`});
                    }} />
                  </div>
                  <Input 
                    value={editTraining.fileUrl || ''} 
                    onChange={e => setEditTraining({...editTraining, fileUrl: e.target.value, fileName: e.target.value ? (editTraining.fileName || '교안 자료') : ''})} 
                    placeholder="또는 직접 다운로드 URL 입력 (https://...)" 
                    className="h-12 font-bold bg-white/5 border-white/5 rounded-xl px-4 text-white placeholder:text-white/20" 
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">설명</label>
                <Input value={editTraining.description} onChange={e => setEditTraining({...editTraining, description: e.target.value})} placeholder="교육 리스트 요약 설명" className="h-12 font-bold bg-white/5 border-white/5 rounded-xl px-4 text-white placeholder:text-white/20" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">비디오 URL</label>
                <Input value={editTraining.videoUrl || ''} onChange={e => setEditTraining({...editTraining, videoUrl: e.target.value})} placeholder="YouTube URL" className="h-12 font-bold bg-white/5 border-white/5 rounded-xl px-4 text-white placeholder:text-white/20" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">상세 내용 (Markdown)</label>
                <Textarea value={editTraining.content} onChange={e => setEditTraining({...editTraining, content: e.target.value})} placeholder="교육 내용 입력" className="min-h-[160px] font-bold bg-white/5 border-white/5 rounded-2xl p-4 text-sm text-white placeholder:text-white/20" />
              </div>
            </div>
          )}
          <DialogFooter className="p-6 sm:p-10 pt-4 bg-white/5 border-t border-white/5 flex flex-col sm:flex-row gap-2 shrink-0">
            <Button variant="ghost" className="h-12 rounded-xl font-black text-muted-foreground hover:text-white" onClick={() => setIsEditOpen(false)}>
              취소
            </Button>
            <Button className="h-12 rounded-xl bg-blue-600 hover:bg-blue-700 font-black text-white px-8" onClick={handleUpdateEducation}>
              수정 완료
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isExamOpen} onOpenChange={setIsExamOpen}>
        <DialogContent className="bg-card rounded-[2rem] sm:rounded-[3rem] border-none shadow-2xl max-w-3xl w-[95vw] p-0 overflow-hidden flex flex-col max-h-[90vh] text-white">
          <DialogHeader className="p-6 sm:p-10 pb-4 sm:pb-6 bg-card text-white shrink-0 text-left border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-emerald-400 shrink-0">
                <HelpCircle className="w-5 h-5" />
              </div>
              <DialogTitle className="text-xl sm:text-2xl font-black tracking-tighter">평가 및 시험 설정</DialogTitle>
            </div>
          </DialogHeader>
          <div className="p-6 sm:p-10 space-y-8 overflow-y-auto no-scrollbar">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">출제 문항 수</label>
                <Input type="number" min={1} value={examSettings.questionsPerExam} onChange={e => setExamSettings({...examSettings, questionsPerExam: parseInt(e.target.value) || 1})} className="h-12 font-black text-lg bg-white/5 border-white/5 rounded-xl px-4 text-white" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">제한 시간 (분)</label>
                <Input type="number" min={1} value={examSettings.timeLimit} onChange={e => setExamSettings({...examSettings, timeLimit: parseInt(e.target.value) || 1})} className="h-12 font-black text-lg bg-white/5 border-white/5 rounded-xl px-4 text-white" />
              </div>
            </div>
            <div className="space-y-6 pt-6 border-t border-white/5">
              <div className="flex items-center justify-between gap-4">
                <h4 className="font-black text-lg text-white">문제은행 ({examSettings.questions.length})</h4>
                <div className="flex items-center gap-2">
                  <Button variant="outline" className="h-9 px-3 rounded-lg font-black text-[10px] border-white/10 bg-white/5 text-white gap-1.5 hover:bg-white/10" onClick={() => document.getElementById('exam-excel-upload')?.click()}>
                    <FileUp className="w-3.5 h-3.5 text-emerald-400" /> 엑셀
                  </Button>
                  <input id="exam-excel-upload" type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelUpload} />
                  <Button onClick={handleAddQuestion} className="h-9 px-3 rounded-lg font-black text-[10px] bg-white text-black gap-1.5">
                    <Plus className="w-3.5 h-3.5" /> 추가
                  </Button>
                </div>
              </div>
              <div className="space-y-4">
                {examSettings.questions.map((q, idx) => (
                  <div key={q.id} className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <Badge className="bg-white/10 text-white/50 border-none font-black px-2 py-1 rounded text-[9px]">문항 {idx + 1}</Badge>
                      <Button variant="ghost" size="icon" onClick={() => setExamSettings({...examSettings, questions: examSettings.questions.filter((_, i) => i !== idx)})} className="h-8 w-8 text-white/20 hover:text-red-400 hover:bg-red-400/10">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <Input value={q.question} onChange={e => {
                      const newQs = [...examSettings.questions];
                      newQs[idx].question = e.target.value;
                      setExamSettings({...examSettings, questions: newQs});
                    }} placeholder="질문 입력" className="font-bold bg-black/20 h-11 border-white/5 rounded-xl text-xs text-white placeholder:text-white/20" />
                    <div className="grid grid-cols-2 gap-2">
                      {q.options.map((opt, oIdx) => (
                        <div key={oIdx} className="flex gap-2 items-center">
                          <button 
                            className={cn(
                              "w-7 h-7 rounded flex items-center justify-center cursor-pointer border-2 transition-all text-[10px] font-black shrink-0",
                              q.correctAnswer === oIdx ? "bg-emerald-500 border-emerald-500 text-white" : "bg-white/5 border-white/5 text-white/20"
                            )}
                            onClick={() => {
                              const newQs = [...examSettings.questions];
                              newQs[idx].correctAnswer = oIdx;
                              setExamSettings({...examSettings, questions: newQs});
                            }}
                          >
                            {oIdx + 1}
                          </button>
                          <Input value={opt} onChange={e => {
                            const newQs = [...examSettings.questions];
                            newQs[idx].options[oIdx] = e.target.value;
                            setExamSettings({...examSettings, questions: newQs});
                          }} placeholder={`보기 ${oIdx + 1}`} className="h-9 font-bold bg-black/20 border-white/5 rounded-lg text-[10px] text-white placeholder:text-white/20" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="p-6 sm:p-10 pt-4 bg-white/5 border-t border-white/5 shrink-0">
            <Button className="w-full h-14 rounded-xl bg-primary hover:bg-primary/90 font-black text-white active:scale-95 transition-all gap-2" onClick={handleSaveExamSetup}>
              <CheckCircle2 className="w-5 h-5 text-white" /> 설정 저장하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const RenderTrainingCard = ({ t, onToggle, onDelete, onUpdateExam, onEdit }: { t: Training, onToggle: () => void, onDelete: () => void, onUpdateExam: () => void, onEdit: () => void }) => (
  <Card className="border-none shadow-xl bg-card rounded-[2.5rem] overflow-hidden hover:border-emerald-500/20 shadow-emerald-500/5 transition-all w-full border border-white/5">
    <CardContent className="p-6 sm:p-8 space-y-6">
      {/* Header Info */}
      <div className="flex flex-col items-center text-center space-y-4">
        {/* Top Badges */}
        <div className="flex items-center gap-2">
          <Badge className="bg-emerald-500/10 text-emerald-400 border-none font-black text-[10px] px-3 py-1 rounded-full uppercase tracking-widest">
            {t.targetJobRole || '전체 공통'}
          </Badge>
          {t.fileUrl && (
            <Badge className="bg-blue-500/10 text-blue-400 border-none font-black text-[10px] px-3 py-1 rounded-full uppercase tracking-widest">
              자료 포함
            </Badge>
          )}
        </div>
        <h3 className="text-2xl font-black tracking-tight text-white leading-tight">
          {t.title}
        </h3>
        <p className="text-sm text-white/50 font-bold max-w-[280px] line-clamp-2">
          {t.description || '상세 설명이 등록되지 않은 교육 자료입니디.'}
        </p>
      </div>

      {/* Stats Icons */}
      <div className="flex items-center justify-center gap-6 py-4 bg-white/5 rounded-3xl border border-dashed border-white/10">
        <div className="flex flex-col items-center gap-1">
          <Layers className="w-5 h-5 text-white/20" />
          <span className="text-[10px] font-black text-white/40 uppercase tracking-tighter">{t.questions?.length || 0}문항</span>
        </div>
        <div className="flex flex-col items-center gap-1 border-x border-white/10 px-6">
          <Clock className="w-5 h-5 text-white/20" />
          <span className="text-[10px] font-black text-white/40 uppercase tracking-tighter">{t.timeLimit || 15}분</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <HelpCircle className="w-5 h-5 text-white/20" />
          <span className="text-[10px] font-black text-white/40 uppercase tracking-tighter">{t.questionsPerExam || 0}문제</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <Button 
          variant="outline" 
          onClick={onEdit} 
          className="h-14 rounded-2xl font-black text-base gap-2 border-white/10 bg-white/5 text-white hover:bg-blue-500/10 hover:text-blue-400 hover:border-blue-500/20 shadow-sm transition-all"
        >
          <FileUp className="w-5 h-5" /> 수정
        </Button>
        <Button 
          variant="outline" 
          onClick={onUpdateExam} 
          className="h-14 rounded-2xl font-black text-base gap-2 border-white/10 bg-white/5 text-white hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/20 shadow-sm transition-all"
        >
          <HelpCircle className="w-5 h-5" /> 시험
        </Button>
        <Button 
          variant="outline" 
          onClick={onToggle} 
          className={cn(
            "col-span-2 h-14 rounded-2xl font-black text-base gap-2 shadow-sm transition-all text-white",
            t.status === 'PUBLISHED' 
              ? "border-white/10 bg-white/5 hover:bg-white/10" 
              : "border-primary bg-primary text-white hover:bg-primary/90"
          )}
        >
          {t.status === 'PUBLISHED' ? <><Eye className="w-5 h-5" /> 교육 내리기</> : <><Send className="w-5 h-5" /> 교육 게시하기</>}
        </Button>
        <Button 
          variant="ghost" 
          onClick={onDelete} 
          className="col-span-2 h-12 rounded-xl text-white/20 hover:text-red-400 hover:bg-red-400/10 font-bold text-xs gap-2"
        >
          <Trash2 className="w-4 h-4" /> 교육 자료 영구 삭제
        </Button>
      </div>
    </CardContent>
  </Card>
);

const EmptyState = ({ text }: { text: string }) => (
  <div className="py-24 text-center bg-card rounded-[3rem] border-2 border-dashed border-white/5 flex flex-col items-center justify-center gap-6 px-10 shadow-inner">
    <div className="w-20 h-20 bg-white/5 rounded-[2rem] flex items-center justify-center shadow-sm">
      <BookOpen className="w-10 h-10 text-white/10" />
    </div>
    <div className="space-y-2">
      <p className="font-black text-lg text-white/30 tracking-tight">{text}</p>
      <p className="text-[10px] font-bold text-white/10 uppercase tracking-[0.3em]">No data found</p>
    </div>
  </div>
);
