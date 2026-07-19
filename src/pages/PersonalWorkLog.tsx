import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/firebase';
import { collection, addDoc, query, where, orderBy, onSnapshot, limit, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { 
  ClipboardList, 
  Clock, 
  Save, 
  ChevronLeft, 
  Plus, 
  Trash2, 
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Signature as SignatureIcon,
  Check
} from 'lucide-react';
import { IndividualWorkLog } from '@/types';
import { handleFirestoreError, OperationType } from '@/lib/errorHandlers';
import SignatureCanvas from 'react-signature-canvas';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

export const PersonalWorkLog: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [logDate, setLogDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [tasks, setTasks] = useState<{ content: string; hours: string }[]>([{ content: '', hours: '' }]);
  const [clockOutTime, setClockOutTime] = useState('18:00');
  const [recentLogs, setRecentLogs] = useState<IndividualWorkLog[]>([]);
  
  const [workerSignUrl, setWorkerSignUrl] = useState('');
  const [isSignOpen, setIsSignOpen] = useState(false);
  const sigPad = useRef<SignatureCanvas>(null);
  const [justSigned, setJustSigned] = useState(false);

  // Safely patch SignaturePad prototype through the active SignatureCanvas instance when dialog is opened
  useEffect(() => {
    if (isSignOpen) {
      const timer = setTimeout(() => {
        try {
          const sigCanvasInstance = sigPad.current;
          if (sigCanvasInstance) {
            const pad = (sigCanvasInstance as any).getSignaturePad?.() || (sigCanvasInstance as any)._sigPad;
            if (pad) {
              const padProto = Object.getPrototypeOf(pad);
              if (padProto) {
                // Patch _strokeEnd
                if (padProto._strokeEnd && !padProto._strokeEnd.__isPatched) {
                  const originalStrokeEnd = padProto._strokeEnd;
                  padProto._strokeEnd = function(event: any) {
                    if (!this._activeStroke) {
                      console.warn("SignaturePad: touch end occurred but no active stroke found. Crash prevented.");
                      return;
                    }
                    originalStrokeEnd.call(this, event);
                  };
                  padProto._strokeEnd.__isPatched = true;
                  console.log("Successfully patched _strokeEnd on SignaturePad prototype dynamically!");
                }

                // Patch _strokeUpdate
                if (padProto._strokeUpdate && !padProto._strokeUpdate.__isPatched) {
                  const originalStrokeUpdate = padProto._strokeUpdate;
                  padProto._strokeUpdate = function(event: any) {
                    if (!this._activeStroke) {
                      console.warn("SignaturePad: touch move occurred but no active stroke found. Crash prevented.");
                      return;
                    }
                    originalStrokeUpdate.call(this, event);
                  };
                  padProto._strokeUpdate.__isPatched = true;
                  console.log("Successfully patched _strokeUpdate on SignaturePad prototype dynamically!");
                }
              }
            }
          }
        } catch (err) {
          console.warn("Error patching signature pad prototype dynamically:", err);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isSignOpen]);

  const handleCopyPreviousLog = () => {
    if (recentLogs.length > 0) {
      const lastLog = recentLogs[0];
      setTasks(lastLog.tasks.map(t => ({ ...t })));
      setClockOutTime(lastLog.clockOutTime);
      toast.success('전일 작업 내용을 불러왔습니다.');
    } else {
      toast.error('이전 기록이 없습니다.');
    }
  };

  useEffect(() => {
    if (!profile) return;

    const q = query(
      collection(db, 'personalWorkLogs'),
      where('uid', '==', profile.uid),
      orderBy('date', 'desc'),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      setRecentLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as IndividualWorkLog)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'personalWorkLogs'));

    return () => unsubscribe();
  }, [profile]);

  const handleAddTask = () => {
    if (tasks.length < 5) {
      setTasks([...tasks, { content: '', hours: '' }]);
    } else {
      toast.error('작업 항목은 최대 5개까지 가능합니다.');
    }
  };

  const handleRemoveTask = (idx: number) => {
    setTasks(tasks.filter((_, i) => i !== idx));
  };

  const updateTask = (idx: number, field: 'content' | 'hours', value: string) => {
    const newTasks = [...tasks];
    newTasks[idx][field] = value;
    setTasks(newTasks);
  };

  const handleSignSave = () => {
    if (sigPad.current) {
      if (sigPad.current.isEmpty()) {
        toast.error('서명을 작성해주세요.');
        return;
      }
      const dataUrl = sigPad.current.toDataURL();
      setWorkerSignUrl(dataUrl);

      // Trigger smooth Framer Motion checkmark feedback
      setJustSigned(true);
      setTimeout(() => {
        setJustSigned(false);
      }, 3000);

      setIsSignOpen(false);
      toast.success('서명이 입력되었습니다!');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    const validTasks = tasks.filter(t => t.content && t.hours);
    if (validTasks.length === 0) {
      toast.error('최소 하나 이상의 작업 내용을 입력해주세요.');
      return;
    }

    if (!workerSignUrl) {
      toast.error('본인 확인 서명을 완료해주세요.');
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'personalWorkLogs'), {
        uid: profile.uid,
        userName: profile.displayName,
        departmentId: profile.departmentId || '',
        departmentName: profile.departmentName || '',
        date: logDate,
        clockOutTime,
        tasks: validTasks,
        workerSignUrl,
        status: 'PENDING',
        createdAt: new Date().toISOString()
      });
      
      toast.success('작업일지가 제출되었습니다. 팀장님 결재 대기 중입니다.');
      navigate('/');
    } catch (error) {
      console.error(error);
      toast.error('제출 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-24 px-1 max-w-2xl mx-auto">
      <div className="flex items-center gap-4 py-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <div>
          <h1 className="text-2xl font-black text-foreground">나의 작업일지 작성</h1>
          <p className="text-sm text-muted-foreground font-bold">오늘의 업무 내역을 기록해 주세요.</p>
        </div>
      </div>

      <div className="flex justify-end pr-1">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleCopyPreviousLog}
          className="bg-muted border-border text-foreground font-bold gap-2 rounded-xl text-xs"
        >
          <ClipboardList className="w-3.5 h-3.5 text-primary" />
          전일 데이터 복사
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="bg-card border-border rounded-3xl overflow-hidden shadow-xl">
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">작업 일자</label>
                <div className="relative">
                  <Input 
                    type="date"
                    value={logDate}
                    onChange={(e) => setLogDate(e.target.value)}
                    className="bg-muted border-border rounded-xl h-12 font-black text-foreground"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">퇴근 시간</label>
                <div className="relative">
                  <Input 
                    type="time"
                    value={clockOutTime}
                    onChange={(e) => setClockOutTime(e.target.value)}
                    className="bg-muted border-border rounded-xl h-12 font-black text-foreground"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-primary uppercase tracking-widest ml-1">상세 작업 내용</label>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleAddTask}
                  className="text-primary font-bold text-xs gap-1"
                >
                  <Plus className="w-3 h-3" /> 항목 추가
                </Button>
              </div>

              <div className="space-y-3">
                {tasks.map((task, idx) => (
                  <div key={idx} className="flex gap-2 group">
                    <div className="flex-1 space-y-2">
                       <Input 
                        placeholder="작업 내용을 입력하세요"
                        value={task.content}
                        onChange={(e) => updateTask(idx, 'content', e.target.value)}
                        className="bg-muted border-border rounded-xl text-sm font-semibold text-foreground"
                      />
                    </div>
                    <div className="w-20 relative">
                      <Input 
                        placeholder="시간"
                        value={task.hours}
                        onChange={(e) => updateTask(idx, 'hours', e.target.value)}
                        className="bg-muted border-border rounded-xl text-center font-black pr-6 text-foreground"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted-foreground/30">H</span>
                    </div>
                    {tasks.length > 1 && (
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleRemoveTask(idx)}
                        className="text-muted-foreground/30 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-muted rounded-2xl p-4 border border-border flex gap-3">
              <AlertCircle className="w-5 h-5 text-primary/40 shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground font-medium leading-relaxed">
                입력하신 내용은 소속 팀장/직장님께 전달되어 확인 후 최종 승인됩니다. <br/>
                정확한 시간을 입력해 주세요.
              </p>
            </div>

            {/* Digital Signature section */}
            <div className="space-y-2 pt-2 border-t border-border">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">본인 서명 및 사인</label>
              <div 
                id="worker-signature-trigger-box"
                className={cn(
                  "relative h-24 bg-muted/20 border border-dashed border-border rounded-2xl flex items-center justify-center cursor-pointer hover:bg-muted/30 transition-all overflow-hidden"
                )}
                onClick={() => setIsSignOpen(true)}
              >
                {workerSignUrl ? (
                   <div className="relative w-full h-full flex items-center justify-center">
                     <img src={workerSignUrl} className="h-full object-contain mix-blend-multiply dark:mix-blend-normal" alt="worker-signature" />
                     <div className="absolute bottom-2 right-2 bg-emerald-500 text-white rounded-full p-1 shadow-md shadow-emerald-500/30">
                       <Check className="w-3.5 h-3.5" strokeWidth={4} />
                     </div>

                     <AnimatePresence>
                       {justSigned && (
                         <motion.div 
                           initial={{ opacity: 0, scale: 0.6 }}
                           animate={{ opacity: 1, scale: 1 }}
                           exit={{ opacity: 0, scale: 0.8 }}
                           className="absolute inset-0 bg-emerald-500/95 flex flex-col items-center justify-center rounded-2xl z-10 pointer-events-none text-white"
                           transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                         >
                           <Check className="w-8 h-8 text-white" strokeWidth={4} />
                           <span className="font-black tracking-widest text-white/95 uppercase mt-1 text-sm">서명 등록 완료</span>
                         </motion.div>
                       )}
                     </AnimatePresence>
                   </div>
                ) : (
                   <div className="flex flex-col items-center justify-center gap-1.5 select-none">
                     <SignatureIcon className="w-6 h-6 text-muted-foreground/30 animate-pulse" />
                     <span className="text-xs font-black text-muted-foreground/50">터치하여 디지털 서명 등록</span>
                   </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Button 
          type="submit" 
          disabled={loading}
          className="w-full h-16 bg-primary text-white font-black text-lg rounded-3xl shadow-xl shadow-primary/20 active:scale-95 transition-all gap-2"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          작업일지 제출하기
        </Button>
      </form>

      {/* Recent History */}
      <div className="space-y-4 pt-4">
        <h3 className="text-sm font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
          <FileText className="w-4 h-4" />
          최근 제출 내역
        </h3>
        <div className="space-y-3">
          {recentLogs.length === 0 ? (
            <div className="py-8 text-center border border-dashed border-border rounded-3xl">
              <p className="text-muted-foreground/40 text-xs font-bold">최근 제출 기록이 없습니다.</p>
            </div>
          ) : (
            recentLogs.map(log => (
              <div key={log.id} className="bg-card border border-border p-4 rounded-2xl flex items-center justify-between shadow-sm">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-black text-foreground">{log.date}</span>
                    <span className="text-[10px] font-bold text-muted-foreground/60">{log.clockOutTime} 퇴근</span>
                  </div>
                  <div className="flex gap-2">
                    {log.tasks.slice(0, 2).map((t, i) => (
                      <span key={i} className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-md truncate max-w-[100px]">
                        {t.content}
                      </span>
                    ))}
                    {log.tasks.length > 2 && <span className="text-[10px] text-muted-foreground/30">...</span>}
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-[10px] font-black border ${
                  log.status === 'PENDING' ? 'bg-amber-500/10 text-amber-500 border-amber-500/10' :
                  log.status === 'LEADER_APPROVED' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                  log.status === 'FINAL_APPROVED' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                  'bg-red-500/10 text-red-500 border-red-500/20'
                }`}>
                  {log.status === 'PENDING' ? '대기중' : 
                   log.status === 'LEADER_APPROVED' ? '팀장확인' : 
                   log.status === 'FINAL_APPROVED' ? '최종승인' : '반려'}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Signature Dialog */}
      <Dialog open={isSignOpen} onOpenChange={setIsSignOpen}>
        <DialogContent className="bg-card border border-border text-foreground max-w-sm rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-foreground flex items-center gap-2">
              <SignatureIcon className="w-5 h-5 text-primary" /> 업무 본인 서명
            </DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <p className="text-xs text-muted-foreground font-bold leading-normal">
              캔버스 영역에 드래그하거나 손가락 터치로 서명을 작성해 주세요.
            </p>
            <div className="border border-border/80 rounded-2xl overflow-hidden bg-white">
              <SignatureCanvas
                ref={sigPad}
                penColor="black"
                canvasProps={{
                  className: "w-full h-40 cursor-crosshair bg-white"
                }}
              />
            </div>
          </div>

          <DialogFooter className="flex flex-row justify-end gap-2 p-0">
            <Button 
              type="button" 
              variant="ghost" 
              onClick={() => {
                if (sigPad.current) {
                  sigPad.current.clear();
                }
              }} 
              className="rounded-xl font-bold bg-muted"
            >
              초기화
            </Button>
            <div className="flex gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsSignOpen(false)} 
                className="rounded-xl font-bold"
              >
                취소
              </Button>
              <Button 
                type="button" 
                onClick={handleSignSave} 
                className="bg-primary hover:bg-primary/95 text-white font-black rounded-xl px-4"
              >
                서명 완료
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
