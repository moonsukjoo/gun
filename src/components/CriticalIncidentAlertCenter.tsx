import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc, 
  getDocs, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { useAuth } from './AuthProvider';
import { 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle, 
  MessageSquare, 
  Clock, 
  User, 
  History, 
  Flame, 
  Heart, 
  X, 
  Check, 
  CornerDownRight, 
  ChevronRight,
  Filter,
  Search,
  BookOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { toast } from 'sonner';

export const CriticalIncidentAlertCenter: React.FC = () => {
  const { profile } = useAuth();
  const [pendingIncidents, setPendingIncidents] = useState<any[]>([]);
  const [historyIncidents, setHistoryIncidents] = useState<any[]>([]);
  
  // UI states
  const [selectedIncident, setSelectedIncident] = useState<any | null>(null);
  const [resolutionComment, setResolutionComment] = useState('');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isResolutionOpen, setIsResolutionOpen] = useState(false);
  
  // History list filters
  const [historyTypeFilter, setHistoryTypeFilter] = useState<string>('ALL');
  const [historySearchTerm, setHistorySearchTerm] = useState('');

  // Soni-siren or audio alert for supervisors when pending alerts appear
  const [audioPlayed, setAudioPlayed] = useState(false);

  // Check if current user is an authorized superior/manager
  const isSupervisor = profile && [
    'CEO', 
    'DIRECTOR', 
    'GENERAL_MANAGER', 
    'SAFETY_MANAGER', 
    'TEAM_LEADER', 
    'GROUP_LEADER', 
    'GENERAL_AFFAIRS', 
    'CLERK'
  ].includes(profile.role);

  // 1. Listen for PENDING critical incidents in real-time
  useEffect(() => {
    if (!profile || !isSupervisor) return;

    const q = query(
      collection(db, 'criticalIncidents'),
      where('status', '==', 'PENDING'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const incidentsList = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter((inc: any) => inc.type !== 'FIRE'); // Exclude FIRE from real-time floating alert popups to prevent blocking the roll-call dashboard
      
      setPendingIncidents(incidentsList);

      // Play alert sound if new pending incident arrives and not yet played
      if (incidentsList.length > 0 && !audioPlayed) {
        playBeepAlert();
        setAudioPlayed(true);
      } else if (incidentsList.length === 0) {
        setAudioPlayed(false);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'criticalIncidents');
    });

    return () => unsubscribe();
  }, [profile, isSupervisor, audioPlayed]);

  // Play synthetic soft alarm sound to capture supervisor's attention
  const playBeepAlert = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      // Multi-tone beep sequence
      const playTone = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        osc.frequency.setValueAtTime(freq, start);
        gainNode.gain.setValueAtTime(0.3, start);
        gainNode.gain.exponentialRampToValueAtTime(0.01, start + duration);
        
        osc.start(start);
        osc.stop(start + duration);
      };

      const now = ctx.currentTime;
      playTone(587.33, now, 0.15); // D5
      playTone(659.25, now + 0.18, 0.15); // E5
      playTone(783.99, now + 0.36, 0.3); // G5
    } catch (e) {
      console.warn("Audio Context beep failed", e);
    }
  };

  // Fetch resolved incidents logs for history modal
  const fetchResolutionHistory = async () => {
    try {
      const q = query(
        collection(db, 'criticalIncidents'),
        where('status', '==', 'RESOLVED'),
        orderBy('resolvedAt', 'desc'),
        limit(150)
      );
      const snapshot = await getDocs(q);
      const historyList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setHistoryIncidents(historyList);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'criticalIncidents_history');
      toast.error("이력 데이터를 가져오는 중 오류가 발생했습니다.");
    }
  };

  // Submit confirmation/resolution and log history
  const handleResolveIncident = async () => {
    if (!selectedIncident || !profile) return;
    if (!resolutionComment.trim()) {
      toast.error('조치 사항(이력 내용)을 입력해주세요!');
      return;
    }

    try {
      const incidentRef = doc(db, 'criticalIncidents', selectedIncident.id);
      const resolvedAt = new Date().toISOString();
      
      await updateDoc(incidentRef, {
        status: 'RESOLVED',
        resolvedAt,
        resolvedByUid: profile.uid,
        resolvedByName: profile.displayName || '관리자',
        resolvedByRole: profile.role,
        resolutionText: resolutionComment
      });

      // Send positive notification closure to user who raised it
      await addDoc(collection(db, 'notifications'), {
        uid: selectedIncident.uid,
        title: `✅ [조치완료] 긴급 상황 조치 완료`,
        message: `상급자 ${profile.displayName}님이 귀하의 '${selectedIncident.typeName}' 상황을 확인하고 조치를 전산 완료했습니다. (조치 내용: ${resolutionComment})`,
        type: 'HEALTH_CHECK',
        isRead: false,
        createdAt: resolvedAt,
        fromUid: profile.uid,
        fromName: profile.displayName
      });

      toast.success('신속한 긴급 이상 확인 및 이력 등록이 완료되었습니다!');
      setIsResolutionOpen(false);
      setSelectedIncident(null);
      setResolutionComment('');
      
      // Refresh history if it happens to be open in background
      if (isHistoryOpen) {
        fetchResolutionHistory();
      }
    } catch (err) {
      console.error("Failed to resolve incident", err);
      toast.error('이력 수정 중 오류가 발생했습니다.');
    }
  };

  if (!isSupervisor) return null;

  // Render descriptive icon based on incident type
  const getIncidentIcon = (type: string) => {
    switch (type) {
      case 'FALL':
        return <AlertTriangle className="w-6 h-6 text-red-500 animate-bounce" />;
      case 'IMPACT':
        return <ShieldAlert className="w-6 h-6 text-orange-500 animate-pulse" />;
      case 'SOS':
        return <ShieldAlert className="w-6 h-6 text-rose-600 animate-ping" />;
      case 'FIRE':
        return <Flame className="w-6 h-6 text-red-600 animate-pulse" />;
      case 'HEALTH_BAD':
        return <Heart className="w-6 h-6 text-amber-500" />;
      default:
        return <AlertTriangle className="w-6 h-6 text-zinc-500" />;
    }
  };

  const getIncidentBadgeClass = (type: string) => {
    switch (type) {
      case 'FALL':
        return 'bg-red-500/15 text-red-600 border border-red-500/30';
      case 'IMPACT':
        return 'bg-orange-500/15 text-orange-600 border border-orange-500/30';
      case 'SOS':
        return 'bg-rose-500/15 text-rose-600 border border-rose-500/40';
      case 'FIRE':
        return 'bg-red-600/15 text-red-600 border border-red-600/30';
      case 'HEALTH_BAD':
        return 'bg-amber-500/15 text-amber-600 border border-amber-500/30';
      default:
        return 'bg-zinc-500/15 text-zinc-600 border border-zinc-500/20';
    }
  };

  // Filter history list
  const filteredHistory = historyIncidents.filter(inc => {
    const matchesType = historyTypeFilter === 'ALL' || inc.type === historyTypeFilter;
    const matchesSearch = inc.displayName?.toLowerCase().includes(historySearchTerm.toLowerCase()) ||
                          inc.employeeId?.toLowerCase().includes(historySearchTerm.toLowerCase());
    return matchesType && matchesSearch;
  });

  return (
    <>
      {/* 1. Real-time floating alert popups for senior managers */}
      <div className="fixed bottom-24 right-4 z-40 max-w-sm w-[90vw] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {pendingIncidents.map((incident) => (
            <motion.div
              key={incident.id}
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8, x: 200 }}
              className="bg-card/95 backdrop-blur-xl border-l-[6px] border-l-red-500 border border-border shadow-2xl p-5 rounded-3xl pointer-events-auto flex flex-col gap-4 relative overflow-hidden"
            >
              {/* Pulsing red accent light bar */}
              <div className="absolute top-0 right-0 w-24 h-1 bg-gradient-to-l from-red-500/30 to-transparent animate-pulse" />
              
              <div className="flex gap-3.5 items-start">
                <div className="w-12 h-12 rounded-2xl bg-muted border border-border flex items-center justify-center shrink-0">
                  {getIncidentIcon(incident.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase ${getIncidentBadgeClass(incident.type)}`}>
                      {incident.typeName}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(incident.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                  <h3 className="font-black text-sm text-foreground flex items-center gap-1.5">
                    {incident.displayName}
                    <span className="text-xs text-muted-foreground/60 font-medium">({incident.departmentName || '협력팀'})</span>
                  </h3>
                  <p className="text-[11px] font-bold text-muted-foreground/80 mt-1">
                    위치: {incident.workplace || '기록 안됨'} | 사번: {incident.employeeId || '미입력'}
                  </p>
                  {incident.type === 'HEALTH_BAD' && (
                    <p className="text-[10px] text-amber-500 font-extrabold mt-1.5 flex items-center gap-1 bg-amber-500/5 p-1 rounded-lg">
                      ⚠️ 출근 시 피로감 및 건강악화 발생을 보고했습니다. 상시 연락 권장.
                    </p>
                  )}
                  {incident.type === 'FIRE' && (
                    <p className="text-[10px] text-red-500 font-extrabold mt-1.5 flex items-center gap-1 bg-red-500/5 p-1 rounded-lg">
                      🔥 대피 요원 점검 및 롤콜 인원 파악 요망.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-2 border-t border-border pt-3">
                <Button 
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedIncident(incident);
                    setIsResolutionOpen(true);
                  }}
                  className="flex-1 h-10 rounded-xl border-red-500/25 bg-red-500/10 text-red-500 font-black text-xs hover:bg-red-500/20 active:scale-95 transition-all cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5 mr-1" /> 조치 및 확인 이력 남기기
                </Button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* 2. Action Input dialog to confirm and save Resolution History */}
      <Dialog open={isResolutionOpen} onOpenChange={setIsResolutionOpen}>
        <DialogContent className="bg-card border border-border text-foreground max-w-sm rounded-3xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-extrabold text-lg flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-500 animate-pulse" />
              상급자 안전 조치 이력서 작성
            </DialogTitle>
            <DialogDescription className="text-xs font-semibold text-muted-foreground">
              안전관리 규정에 의거하여 상급자 조치 사항을 실시간 등록해야 합니다.
            </DialogDescription>
          </DialogHeader>

          {selectedIncident && (
            <div className="space-y-4 py-4 border-y border-border/80 my-2">
              <div className="p-3 bg-muted rounded-2xl text-xs space-y-2">
                <div className="flex justify-between font-bold">
                  <span className="text-muted-foreground">발생 유형</span>
                  <span className="font-black text-red-500">{selectedIncident.typeName}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span className="text-muted-foreground">대상 사원</span>
                  <span>{selectedIncident.displayName} ({selectedIncident.employeeId})</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span className="text-muted-foreground">소속 부서</span>
                  <span>{selectedIncident.departmentName || '협력팀'} / {selectedIncident.jobRole || '근로원'}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span className="text-muted-foreground">발생 시간</span>
                  <span>{new Date(selectedIncident.createdAt).toLocaleString('ko-KR')}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span className="text-muted-foreground">작업 위치</span>
                  <span>{selectedIncident.workplace || '정보 없음'}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black uppercase text-primary tracking-widest">
                  직접 조치 사항 기재 (이력 저장)
                </label>
                <textarea
                  value={resolutionComment}
                  onChange={(e) => setResolutionComment(e.target.value)}
                  placeholder="예: '전화 통화로 건강 상태 확인하였으며 가벼운 정비 후 작업 복귀 완료', '원격 CCTV로 화재 오발령 판정한 후 경보기 해제 조치함'"
                  className="w-full h-24 p-3 rounded-xl border border-border bg-muted/60 text-xs text-foreground placeholder:text-muted-foreground/50 resize-none outline-none focus:border-red-500/50 transition-all font-medium leading-relaxed"
                />
              </div>
            </div>
          )}

          <DialogFooter className="grid grid-cols-2 gap-2 mt-4">
            <Button 
              variant="outline" 
              onClick={() => {
                setIsResolutionOpen(false);
                setSelectedIncident(null);
                setResolutionComment('');
              }}
              className="h-11 rounded-xl text-xs font-bold border-border"
            >
              취소
            </Button>
            <Button 
              onClick={handleResolveIncident}
              className="h-11 rounded-xl text-xs font-black bg-red-600 text-white"
            >
              <Check className="w-3.5 h-3.5 mr-1" /> 조치 완료 등록
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 3. Sliding / Modal View of All Historic Actions (이력 조회란) */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="bg-card border border-border text-foreground max-w-lg w-[95vw] rounded-[2rem] p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader className="mb-4">
            <div className="flex justify-between items-center pr-6">
              <DialogTitle className="font-black text-xl flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-500" />
                긴급 이상 & 안전 조치 이력 관리
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs font-semibold text-muted-foreground">
              안전 신호 수신 후 상급 소속 직원에 의해 확인 및 조치 조율을 완수한 이력집입니다.
            </DialogDescription>
          </DialogHeader>

          {/* Filters section */}
          <div className="space-y-3 mb-4">
            <div className="flex flex-wrap gap-1.5">
              {['ALL', 'FALL', 'IMPACT', 'SOS', 'FIRE', 'HEALTH_BAD'].map((type) => {
                const labelMap: Record<string, string> = {
                  ALL: '전체',
                  FALL: '추락',
                  IMPACT: '충격',
                  SOS: 'SOS',
                  FIRE: '화재',
                  HEALTH_BAD: '컨디션 나쁨'
                };
                return (
                  <button
                    key={type}
                    onClick={() => setHistoryTypeFilter(type)}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-black transition-all border ${
                      historyTypeFilter === type 
                        ? 'bg-amber-500/10 text-amber-500 border-amber-500/45' 
                        : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
                    }`}
                  >
                    {labelMap[type]}
                  </button>
                );
              })}
            </div>

            <div className="relative">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-muted-foreground/50" />
              <input
                type="text"
                value={historySearchTerm}
                onChange={(e) => setHistorySearchTerm(e.target.value)}
                placeholder="대상자 이름 또는 사번 검색..."
                className="w-full h-10 pl-9 pr-4 bg-muted/60 border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground/45 outline-none focus:border-amber-500/50"
              />
            </div>
          </div>

          {/* History records list */}
          <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
            {filteredHistory.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground/45 text-xs font-medium">
                조치 완료 이력이 없습니다.
              </div>
            ) : (
              filteredHistory.map((inc) => (
                <div 
                  key={inc.id}
                  className="p-4 bg-muted/40 border border-border rounded-2.5xl space-y-3 text-xs"
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-black ${getIncidentBadgeClass(inc.type)}`}>
                      {inc.typeName}
                    </span>
                    <span className="text-[10px] text-muted-foreground/60 font-semibold">
                      {new Date(inc.createdAt).toLocaleString('ko-KR')}
                    </span>
                  </div>

                  <div className="flex justify-between font-bold">
                    <span className="text-foreground">{inc.displayName} ({inc.employeeId || '사번없음'})</span>
                    <span className="text-muted-foreground/75 text-[10px]">{inc.departmentName} · {inc.jobRole}</span>
                  </div>

                  {inc.workplace && (
                    <div className="text-[11px] text-muted-foreground">
                      위치: <span className="text-foreground font-semibold">{inc.workplace}</span>
                    </div>
                  )}

                  {/* Resolution result block */}
                  <div className="bg-emerald-500/5 border border-emerald-500/20 p-3 rounded-xl space-y-1.5 mt-2">
                    <div className="flex justify-between items-center text-[10px] font-black text-emerald-600">
                      <span className="flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" />
                        상급자 확인 완료
                      </span>
                      <span>
                        시간: {new Date(inc.resolvedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-[11px] font-extrabold text-foreground leading-relaxed pl-1">
                      {inc.resolutionText}
                    </p>
                    <div className="text-[9px] text-muted-foreground/75 pl-1 pt-1 flex items-center gap-1">
                      <User className="w-3 h-3 text-muted-foreground/50" />
                      확인자: {inc.resolvedByName} ({inc.resolvedByRole || '상급자'})
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <DialogFooter className="mt-4">
            <Button 
              className="w-full h-11 bg-zinc-900 border border-zinc-800 text-foreground text-xs font-black rounded-xl hover:bg-zinc-800"
              onClick={() => setIsHistoryOpen(false)}
            >
              확인 닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
