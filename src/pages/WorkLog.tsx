import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/firebase';
import { collection, addDoc, query, where, getDocs, doc, getDoc, orderBy, limit } from 'firebase/firestore';
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
  Users, 
  Plus, 
  Trash2, 
  FileText,
  Loader2,
  Table as TableIcon,
  Signature as SignatureIcon,
  Check
} from 'lucide-react';
import { TeamWorkLog, WorkLogEntry, UserProfile } from '@/types';
import SignatureCanvas from 'react-signature-canvas';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

export const WorkLog: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  
  const [logDate, setLogDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [entries, setEntries] = useState<WorkLogEntry[]>([]);
  const [teamName, setTeamName] = useState('');
  const [previousLog, setPreviousLog] = useState<TeamWorkLog | null>(null);

  const [supervisorSignUrl, setSupervisorSignUrl] = useState('');
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

  useEffect(() => {
    if (profile) {
      setTeamName(profile.departmentName || '');
      loadTeamMembers(profile.departmentName || '');
      loadPreviousLog(profile.departmentId || '');
    }
  }, [profile]);

  const loadPreviousLog = async (deptId: string) => {
    if (!deptId) return;
    try {
      const q = query(
        collection(db, 'teamWorkLogs'),
        where('teamId', '==', deptId),
        orderBy('date', 'desc'),
        limit(1)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        setPreviousLog({ id: snap.docs[0].id, ...snap.docs[0].data() } as TeamWorkLog);
      }
    } catch (error) {
      console.error('Error loading previous team log:', error);
    }
  };

  const handleCopyPreviousLog = () => {
    if (previousLog) {
      // Create a map of existing members to easily match them
      const membersMap = new Map(teamMembers.map(m => [m.displayName, m]));
      
      // Map previous entries selectively
      const copiedEntries = previousLog.entries.map(prevEntry => {
        // Find if this person is still in the team
        const member = membersMap.get(prevEntry.userName);
        if (member) {
          return {
            userName: prevEntry.userName,
            tasks: prevEntry.tasks.map(t => ({ ...t })),
            clockOutTime: prevEntry.clockOutTime
          };
        }
        return null;
      }).filter(Boolean) as WorkLogEntry[];

      if (copiedEntries.length > 0) {
        // Also add members who weren't in the previous log as empty entries
        const copiedNames = new Set(copiedEntries.map(e => e.userName));
        const missingMembers = teamMembers
          .filter(m => !copiedNames.has(m.displayName))
          .map(m => ({
            userName: m.displayName,
            tasks: [{ content: '', hours: '' }],
            clockOutTime: '18:00'
          }));

        setEntries([...copiedEntries, ...missingMembers]);
        toast.success(`전일 데이터(${previousLog.date})를 불러왔습니다.`);
      } else {
        toast.error('불러올 수 있는 이전 데이터가 없습니다.');
      }
    } else {
      toast.error('이전 기록이 없습니다.');
    }
  };

  const loadTeamMembers = async (deptName: string) => {
    if (!deptName) return;
    try {
      const q = query(
        collection(db, 'users'), 
        where('departmentName', '==', deptName),
        where('isActive', '==', true)
      );
      const snap = await getDocs(q);
      const members = snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
      setTeamMembers(members);
      
      // Initialize entries with members
      setEntries(members.map(m => ({
        userName: m.displayName,
        tasks: [{ content: '', hours: '' }],
        clockOutTime: '18:00'
      })));
    } catch (error) {
      console.error('Error loading team members:', error);
    }
  };

  const handleAddEntry = () => {
    setEntries([...entries, {
      userName: '',
      tasks: [{ content: '', hours: '' }],
      clockOutTime: '18:00'
    }]);
  };

  const handleRemoveEntry = (index: number) => {
    setEntries(entries.filter((_, i) => i !== index));
  };

  const handleUpdateEntry = (index: number, updates: Partial<WorkLogEntry>) => {
    const newEntries = [...entries];
    newEntries[index] = { ...newEntries[index], ...updates };
    setEntries(newEntries);
  };

  const handleAddTask = (entryIndex: number) => {
    const newEntries = [...entries];
    if (newEntries[entryIndex].tasks.length < 3) {
      newEntries[entryIndex].tasks.push({ content: '', hours: '' });
      setEntries(newEntries);
    } else {
      toast.error('최대 3개까지만 가능합니다.');
    }
  };

  const handleUpdateTask = (entryIndex: number, taskIndex: number, field: 'content' | 'hours', value: string) => {
    const newEntries = [...entries];
    newEntries[entryIndex].tasks[taskIndex][field] = value;
    setEntries(newEntries);
  };
  const handleApplyFirstToAll = () => {
    if (entries.length < 2) return;
    const firstTasks = entries[0].tasks;
    const firstClockOut = entries[0].clockOutTime;
    
    setEntries(entries.map((entry, idx) => {
      if (idx === 0) return entry;
      return {
        ...entry,
        tasks: firstTasks.map(t => ({ ...t })),
        clockOutTime: firstClockOut
      };
    }));
    toast.success('첫 번째 인원의 작업 내용이 모두에게 적용되었습니다.');
  };

  const handleSignSave = () => {
    if (sigPad.current) {
      if (sigPad.current.isEmpty()) {
        toast.error('서명을 작성해주세요.');
        return;
      }
      const dataUrl = sigPad.current.toDataURL();
      setSupervisorSignUrl(dataUrl);

      // Trigger smooth Framer Motion checkmark feedback
      setJustSigned(true);
      setTimeout(() => {
        setJustSigned(false);
      }, 3000);

      setIsSignOpen(false);
      toast.success('관리감독자 서명이 승인되었습니다!');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    const validEntries = entries.filter(e => e.userName && e.tasks.some(t => t.content));
    if (validEntries.length === 0) {
      toast.error('최소 한 명 이상의 작업 내용을 입력해주세요.');
      return;
    }

    if (!supervisorSignUrl) {
      toast.error('관리감독자 서명을 완료해주세요.');
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'teamWorkLogs'), {
        teamId: profile.departmentId || '',
        teamName: teamName || profile.departmentName || '미지정',
        date: logDate,
        entries: validEntries,
        supervisorSignUrl,
        createdAt: new Date().toISOString(),
        createdByUid: profile.uid,
        createdByUserName: profile.displayName
      });
      
      toast.success('팀 작업일지가 저장되었습니다.');
      navigate('/');
    } catch (error) {
      console.error('Team work log save error:', error);
      toast.error('저장 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-24 px-1 max-w-5xl mx-auto">
      <div className="flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-xl bg-muted text-foreground"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-black text-foreground">팀 일일작업일지</h1>
            <p className="text-[10px] font-bold text-muted-foreground">{teamName} | {logDate}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="space-y-1.5 p-4 bg-muted rounded-2xl border border-border">
          <label className="text-[10px] font-black text-muted-foreground uppercase ml-1">작업 일자</label>
          <Input 
            type="date"
            value={logDate}
            onChange={(e) => setLogDate(e.target.value)}
            className="bg-transparent border-none text-foreground font-black p-0 h-auto focus-visible:ring-0 text-lg"
          />
        </div>
        <div className="space-y-1.5 p-4 bg-muted rounded-2xl border border-border">
          <label className="text-[10px] font-black text-muted-foreground uppercase ml-1">팀 이름</label>
          <Input 
            type="text"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="팀 이름을 입력하세요"
            className="bg-transparent border-none text-foreground font-black p-0 h-auto focus-visible:ring-0 text-lg"
          />
        </div>
        <div className="flex items-center gap-4 p-4 bg-primary/5 rounded-2xl border border-primary/10">
          <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-black text-primary uppercase">총원</p>
            <p className="text-xl font-black text-foreground">{entries.length}명</p>
          </div>
        </div>
      </div>

      <Card className="bg-card border-border rounded-[2rem] overflow-hidden shadow-2xl">
        <CardHeader className="bg-muted/50 p-6 border-b border-border flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-black text-foreground flex items-center gap-2">
            <TableIcon className="w-5 h-5 text-primary" />
            작업 내역 입력
          </CardTitle>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant="outline" 
              onClick={handleCopyPreviousLog}
              disabled={!previousLog}
              className="text-primary border-primary/20 hover:bg-primary/5 font-bold gap-1 rounded-xl text-[10px]"
            >
              <ClipboardList className="w-3 h-3" />
              전일 데이터 복사
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={handleApplyFirstToAll}
              disabled={entries.length < 2}
              className="text-muted-foreground/60 border-border hover:bg-muted font-bold gap-1 rounded-xl text-[10px]"
            >
              <Save className="w-3 h-3" />
              첫 인원 내용 일괄복사
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={handleAddEntry}
              className="text-primary hover:bg-primary/10 font-bold gap-1 rounded-xl text-[10px]"
            >
              <Plus className="w-4 h-4" />
              인원 추가
            </Button>
          </div>
        </CardHeader>
          <div className="space-y-4">
            {entries.length === 0 ? (
              <div className="py-20 text-center border-2 border-dashed border-border rounded-[2rem] bg-muted/20">
                <Users className="w-12 h-12 text-muted-foreground/10 mx-auto mb-4" />
                <p className="text-muted-foreground font-bold">인원을 추가하거나 멤버를 불러와주세요.</p>
              </div>
            ) : (
              entries.map((entry, idx) => (
                <Card key={idx} className="bg-muted/30 border-border rounded-3xl overflow-hidden shadow-sm transition-all hover:bg-muted/50 hover:border-primary/20 relative group">
                  {/* Floating ID badge */}
                  <div className="absolute top-0 left-0 bg-primary/20 text-primary px-3 py-1 rounded-br-2xl text-[10px] font-black uppercase tracking-widest z-10">
                    NO. {idx + 1}
                  </div>
                  
                  <div className="p-5 pt-10 space-y-6">
                    {/* Compact Top Section: Name & Time */}
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
                      <div className="flex-1 w-full space-y-2">
                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">작업자 성명</label>
                        <Input 
                          value={entry.userName}
                          onChange={(e) => handleUpdateEntry(idx, { userName: e.target.value })}
                          placeholder="성명 입력"
                          className="bg-muted border-border text-lg font-black text-foreground px-4 h-12 rounded-2xl focus:ring-primary/20 placeholder:text-muted-foreground/30"
                        />
                      </div>
                      
                      <div className="w-full sm:w-40 space-y-2">
                        <div className="flex items-center justify-between ml-1">
                          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">퇴근 시간</label>
                        </div>
                        <div className="flex items-center gap-3 px-4 h-12 bg-muted rounded-2xl border border-border">
                          <Clock className="w-4 h-4 text-muted-foreground/40" />
                          <Input 
                            type="time"
                            value={entry.clockOutTime}
                            onChange={(e) => handleUpdateEntry(idx, { clockOutTime: e.target.value })}
                            className="bg-transparent border-none text-sm font-bold text-foreground p-0 w-full focus-visible:ring-0"
                          />
                        </div>
                      </div>

                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleRemoveEntry(idx)}
                        className="absolute top-2 right-2 w-10 h-10 text-muted-foreground/20 hover:text-red-500 hover:bg-red-500/10 rounded-xl opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Task Grid with improved layout */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-border pb-2">
                        <span className="text-[10px] font-black text-primary uppercase tracking-widest">세부 업무 기록</span>
                        <span className="text-[9px] font-bold text-muted-foreground/40 italic">최대 3개 항목</span>
                      </div>
                      
                      <div className="space-y-3">
                        {entry.tasks.map((task, tIdx) => (
                          <div key={tIdx} className="flex gap-3">
                            <div className="flex-1 bg-muted rounded-2xl border border-border focus-within:border-primary/40 transition-all p-1">
                              <Input 
                                value={task.content}
                                onChange={(e) => handleUpdateTask(idx, tIdx, 'content', e.target.value)}
                                placeholder={`업무 상세 내용 ${tIdx + 1}`}
                                className="bg-transparent border-none text-sm font-semibold text-foreground px-4 py-2.5 h-auto focus-visible:ring-0 placeholder:text-muted-foreground/20"
                              />
                            </div>
                            <div className="relative w-20 shrink-0 bg-muted rounded-2xl border border-border focus-within:border-primary/40 transition-all p-1">
                              <div className="flex items-center justify-center h-full px-2">
                                <Input 
                                  value={task.hours}
                                  onChange={(e) => handleUpdateTask(idx, tIdx, 'hours', e.target.value)}
                                  placeholder="0"
                                  className="bg-transparent border-none text-base font-black text-primary p-0 w-8 h-auto text-right focus-visible:ring-0"
                                />
                                <span className="text-[10px] font-black text-muted-foreground/40 ml-1">H</span>
                              </div>
                            </div>
                          </div>
                        ))}

                        {entry.tasks.length < 3 && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleAddTask(idx)}
                            className="w-full h-10 border border-dashed border-border bg-muted/20 text-muted-foreground font-bold text-[11px] gap-2 transition-all mt-2 rounded-2xl"
                          >
                            <Plus className="w-4 h-4" />
                            신규 업무 항목 추가
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
      </Card>

      {/* 관리감독자 승인 및 서명란 */}
      <Card className="bg-card border border-border rounded-3xl overflow-hidden p-6 shadow-lg">
        <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">관리감독자 확인 서명</label>
        <div className="mt-3">
          <div 
            id="supervisor-signature-trigger-box"
            className={cn(
              "relative h-28 bg-muted/20 border border-dashed border-border rounded-2xl flex items-center justify-center cursor-pointer hover:bg-muted/30 transition-all overflow-hidden"
            )}
            onClick={() => setIsSignOpen(true)}
          >
            {supervisorSignUrl ? (
               <div className="relative w-full h-full flex items-center justify-center">
                 <img src={supervisorSignUrl} className="h-full object-contain mix-blend-multiply dark:mix-blend-normal" alt="supervisor-signature" />
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
                       <span className="font-black tracking-widest text-white/95 uppercase mt-1 text-sm">관리감독자 서명 완료</span>
                     </motion.div>
                   )}
                 </AnimatePresence>
               </div>
            ) : (
               <div className="flex flex-col items-center justify-center gap-1.5 select-none">
                 <SignatureIcon className="w-6 h-6 text-muted-foreground/30 animate-pulse" />
                 <span className="text-xs font-black text-muted-foreground/50">터치하여 관리감독자 디지털 서명 등록 (필수)</span>
               </div>
            )}
          </div>
        </div>
      </Card>

      <div className="flex gap-4">
        <Button 
          onClick={handleSubmit}
          disabled={loading}
          className="flex-1 h-16 bg-primary text-white font-black text-lg rounded-2xl shadow-xl shadow-primary/20 active:scale-[0.98] transition-all gap-2"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          {loading ? '저장 중...' : '팀 작업일지 제출하기'}
        </Button>
      </div>

      <div className="bg-muted/50 rounded-2xl p-6 border border-border space-y-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <FileText className="w-4 h-4" />
          <span className="text-xs font-black uppercase tracking-widest">작업일지 작성 안내</span>
        </div>
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h4 className="font-bold text-foreground text-sm">팀원별 직접 입력</h4>
              <p className="text-muted-foreground text-xs mt-1 leading-relaxed">
                팀원들의 성명을 확인하고 작업 내용과 시간(H)을 각각 입력해 주세요.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
              <Save className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h4 className="font-bold text-foreground text-sm">일괄 복사 기능</h4>
              <p className="text-muted-foreground text-xs mt-1 leading-relaxed">
                첫 번째 인원의 내용을 모두에게 동일하게 적용하려면 '일괄복사' 버튼을 사용하세요.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Signature Dialog */}
      <Dialog open={isSignOpen} onOpenChange={setIsSignOpen}>
        <DialogContent className="bg-card border border-border text-foreground max-w-sm rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-foreground flex items-center gap-2">
              <SignatureIcon className="w-5 h-5 text-primary" /> 관리감독자 승인 및 확인
            </DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <p className="text-xs text-muted-foreground font-bold leading-normal">
              캔버스 영역에 드래그하거나 터치로 본 관리감독자 확인 서명을 완성해 주세요.
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
