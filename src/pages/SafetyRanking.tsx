import React, { useState, useEffect, useMemo } from 'react';
import { db } from '@/firebase';
import { collection, query, onSnapshot, updateDoc, doc, addDoc, orderBy } from 'firebase/firestore';
import { UserProfile, SafetyScoreLog, Department } from '@/types';
import { useAuth } from '@/components/AuthProvider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { startOfMonth, subMonths, format } from 'date-fns';
import { 
  Trophy, 
  Search, 
  History, 
  Star, 
  ShieldCheck, 
  ChevronRight,
  TrendingUp,
  TrendingDown,
  User as UserIcon,
  Plus,
  Minus,
  Save,
  Download,
  FileText
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { exportToExcel, exportToPDF } from '@/lib/exportUtils';
import { handleFirestoreError, OperationType } from '../lib/errorHandlers';

export const SafetyRanking: React.FC = () => {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [logs, setLogs] = useState<SafetyScoreLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('all');
  const [activeView, setActiveView] = useState<'INDIVIDUAL' | 'TEAM' | 'LOGS'>('INDIVIDUAL');
  const [loading, setLoading] = useState(true);

  const [isAdjustmentOpen, setIsAdjustmentOpen] = useState(false);
  const [targetUser, setTargetUser] = useState<UserProfile | null>(null);
  const [scoreDelta, setScoreDelta] = useState<string>('');
  const [adjustmentType, setAdjustmentType] = useState<'REWARD' | 'PENALTY'>('REWARD');
  const [reason, setReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const isAdmin = profile && (profile.role === 'CEO');

  useEffect(() => {
    const unsubscribeUsers = onSnapshot(query(collection(db, 'users')), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    const unsubscribeDepts = onSnapshot(query(collection(db, 'departments'), orderBy('name')), (snapshot) => {
      setDepartments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'departments');
    });

    const unsubscribeLogs = onSnapshot(query(collection(db, 'safetyScoreLogs'), orderBy('createdAt', 'desc')), (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SafetyScoreLog)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'safetyScoreLogs');
    });

    return () => {
      unsubscribeUsers();
      unsubscribeDepts();
      unsubscribeLogs();
    };
  }, []);

  const filteredUsers = useMemo(() => {
    return users
      .filter(user => {
        const matchesSearch = (user.displayName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
                             user.employeeId?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesDept = selectedDeptId === 'all' || user.departmentId === selectedDeptId;
        return matchesSearch && matchesDept;
      })
      .sort((a, b) => (b.safetyScore ?? 100) - (a.safetyScore ?? 100));
  }, [users, searchTerm, selectedDeptId]);

  const userMonthlyStats = useMemo(() => {
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const prevMonthStart = startOfMonth(subMonths(now, 1));
    const stats: Record<string, { currentMonthDelta: number, prevMonthDelta: number }> = {};

    logs.forEach(log => {
      const logDate = new Date(log.createdAt);
      if (!stats[log.targetUid]) stats[log.targetUid] = { currentMonthDelta: 0, prevMonthDelta: 0 };
      if (logDate >= currentMonthStart) stats[log.targetUid].currentMonthDelta += log.scoreDelta;
      else if (logDate >= prevMonthStart) stats[log.targetUid].prevMonthDelta += log.scoreDelta;
    });
    return stats;
  }, [logs]);

  const teamRankings = useMemo(() => {
    const deptMap: Record<string, { id: string; name: string; totalScore: number; count: number; average: number }> = {};
    users.forEach(user => {
      if (!user.departmentId) return;
      if (!deptMap[user.departmentId]) deptMap[user.departmentId] = { id: user.departmentId, name: user.departmentName || 'Unknown', totalScore: 0, count: 0, average: 0 };
      deptMap[user.departmentId].totalScore += (user.safetyScore ?? 100);
      deptMap[user.departmentId].count += 1;
    });
    return Object.values(deptMap)
      .map(d => ({ ...d, average: d.count > 0 ? d.totalScore / d.count : 0 }))
      .sort((a, b) => b.average - a.average);
  }, [users]);

  const handleAdjustScore = async () => {
    if (!targetUser || !scoreDelta || !reason || !profile) return;
    const delta = adjustmentType === 'REWARD' ? parseInt(scoreDelta) : -parseInt(scoreDelta);
    if (isNaN(delta)) return;

    setIsSaving(true);
    const prevScore = targetUser.safetyScore ?? 100;
    const newScore = prevScore + delta;

    try {
      await updateDoc(doc(db, 'users', targetUser.uid), { safetyScore: newScore });
      await addDoc(collection(db, 'safetyScoreLogs'), {
        targetUid: targetUser.uid,
        targetName: targetUser.displayName,
        adminUid: profile.uid,
        adminName: profile.displayName,
        adminRole: profile.role,
        scoreDelta: delta,
        previousScore: prevScore,
        newScore: newScore,
        reason,
        type: delta > 0 ? 'REWARD' : 'PENALTY',
        createdAt: new Date().toISOString()
      });

      toast.success('점수가 업데이트되었습니다.');
      setIsAdjustmentOpen(false);
      setScoreDelta('');
      setReason('');
    } catch (error) {
      toast.error('오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportExcel = () => {
    if (activeView === 'INDIVIDUAL') {
      const data = filteredUsers.map((u, idx) => ({
        '순위': idx + 1,
        '성명': u.displayName,
        '사번': u.employeeId,
        '부서': u.departmentName,
        '안전지수': u.safetyScore || 100
      }));
      exportToExcel(data, '개인별_안전지수', '랭킹');
    } else if (activeView === 'TEAM') {
      const data = teamRankings.map((t, idx) => ({
        '순위': idx + 1,
        '팀명': t.name,
        '팀원수': t.count,
        '평균지수': t.average.toFixed(1)
      }));
      exportToExcel(data, '팀별_안전지수', '팀랭킹');
    } else {
      const data = logs.map(l => ({
        '대상자': l.targetName,
        '점수변동': l.scoreDelta,
        '변동후': l.newScore,
        '사유': l.reason,
        '관리자': l.adminName,
        '일시': format(new Date(l.createdAt), 'yyyy-MM-dd HH:mm')
      }));
      exportToExcel(data, '안전지수_히스토리', '히스토리');
    }
    toast.success('엑셀 다운로드 완료');
  };

  const handleExportPDF = async () => {
    let title = '안전 지수 보고서';
    let headers: string[] = [];
    let data: any[][] = [];

    if (activeView === 'INDIVIDUAL') {
      title = '개인별 안전 지수 랭킹 리포트';
      headers = ['순위', '성명', '부서', '지수'];
      data = filteredUsers.map((u, idx) => [idx + 1, u.displayName, u.departmentName, u.safetyScore || 100]);
    } else if (activeView === 'TEAM') {
      title = '팀별 안전 지수 평균 리포트';
      headers = ['순위', '팀명', '인원', '평균'];
      data = teamRankings.map((t, idx) => [idx + 1, t.name, t.count, t.average.toFixed(1)]);
    } else {
      title = '안전 지수 변동 히스토리 리포트';
      headers = ['대상', '변동', '잔여', '사유'];
      data = logs.map(l => [l.targetName, l.scoreDelta > 0 ? `+${l.scoreDelta}` : l.scoreDelta, l.newScore, l.reason]);
    }

    await exportToPDF(title, headers, data, '안전지수_보고서');
    toast.success('PDF 리포트 생성 완료');
  };

  return (
    <div className="space-y-6 pb-24 px-1">
      <header className="py-6 flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-foreground leading-tight">안전 지수</h2>
          <p className="text-muted-foreground font-bold">우리 회사의 안전 랭킹을 확인하세요</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            className="h-10 rounded-xl bg-muted/50 border-border text-foreground font-black text-[10px] gap-2"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" /> EXCEL
          </Button>
          <Button 
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            className="h-10 rounded-xl bg-muted/50 border-border text-foreground font-black text-[10px] gap-2"
          >
            <FileText className="w-3.5 h-3.5 text-rose-400" /> PDF
          </Button>
        </div>
      </header>

      <div className="bg-muted/50 p-1 rounded-2xl flex gap-1">
        {(['INDIVIDUAL', 'TEAM', 'LOGS'] as const).map((view) => (
          <button
            key={view}
            onClick={() => setActiveView(view)}
            className={cn(
              "flex-1 h-12 rounded-xl text-xs font-black transition-all",
              activeView === view ? "bg-card text-foreground shadow-lg" : "text-muted-foreground/60 hover:text-muted-foreground/90"
            )}
          >
            {view === 'INDIVIDUAL' ? '개인별' : view === 'TEAM' ? '팀별' : '히스토리'}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {activeView === 'INDIVIDUAL' && (
          <div className="space-y-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
              <Input 
                placeholder="이름 검색..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-14 pl-11 bg-card border-border rounded-2xl text-foreground font-bold placeholder:text-muted-foreground/30"
              />
            </div>

            <div className="space-y-2">
              {filteredUsers.map((user, idx) => (
                <div key={user.uid} className="bg-card p-5 rounded-2xl border border-border flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center font-black",
                      idx === 0 ? "bg-amber-500/20 text-amber-700 dark:text-amber-500 shadow-amber-500/10 shadow-lg" : "bg-muted text-muted-foreground"
                    )}>
                      {idx < 3 ? <Trophy className="w-5 h-5" /> : (idx + 1)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-black text-foreground">{user.displayName}</span>
                        <Badge variant="outline" className="text-[9px] font-black bg-muted border-none opacity-80">
                           {user.departmentName}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground font-bold">{user.employeeId}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className={cn("text-xl font-black", (user.safetyScore ?? 100) >= 100 ? "text-emerald-500" : "text-amber-700 dark:text-amber-500")}>
                        {user.safetyScore ?? 100}
                        <span className="text-[10px] ml-1 opacity-60">pts</span>
                      </div>
                    </div>
                    {isAdmin && (
                      <Button 
                        size="icon" 
                        variant="ghost"
                        onClick={() => { setTargetUser(user); setIsAdjustmentOpen(true); }}
                        className="w-10 h-10 rounded-xl bg-muted text-muted-foreground"
                      >
                        <Plus className="w-5 h-5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeView === 'TEAM' && (
          <div className="space-y-4">
            {teamRankings.map((team, idx) => (
              <div key={team.id} className="bg-card p-6 rounded-2xl border border-border space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/20 text-primary flex items-center justify-center rounded-xl font-black">
                      {idx + 1}
                    </div>
                    <span className="text-lg font-black text-foreground">{team.name}</span>
                  </div>
                  <div className="text-right">
                     <span className="text-2xl font-black text-primary">{team.average.toFixed(1)}</span>
                     <span className="text-xs text-muted-foreground ml-1">AVG</span>
                  </div>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                   <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(team.average, 100)}%` }} className="h-full bg-primary rounded-full shadow-lg shadow-primary/20" />
                </div>
              </div>
            ))}
          </div>
        )}

        {activeView === 'LOGS' && (
          <div className="space-y-2">
            {logs.map((log) => (
              <div key={log.id} className="bg-card p-5 rounded-2xl border border-border flex items-start gap-4">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                  log.type === 'REWARD' ? "bg-emerald-500/20 text-emerald-500" : "bg-red-500/20 text-red-500"
                )}>
                  {log.type === 'REWARD' ? <Plus className="w-5 h-5" /> : <Minus className="w-5 h-5" />}
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-black text-foreground">{log.targetName}</span>
                    <span className={cn("text-xs font-black", log.scoreDelta > 0 ? "text-emerald-500" : "text-red-500")}>
                      {log.scoreDelta > 0 ? `+${log.scoreDelta}` : log.scoreDelta}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground font-bold">{log.reason}</p>
                  <p className="text-[10px] text-muted-foreground/40 mt-2 font-bold">{format(new Date(log.createdAt), 'yyyy.MM.dd')}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isAdjustmentOpen} onOpenChange={setIsAdjustmentOpen}>
        <DialogContent className="bg-card border-none rounded-3xl text-foreground">
          <DialogHeader>
            <DialogTitle className="text-xl font-black flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500" /> 점수 조정
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 pt-4">
             <div className="bg-muted p-4 rounded-2xl flex items-center justify-between">
                <div>
                   <h4 className="text-sm font-black text-foreground">{targetUser?.displayName}</h4>
                   <span className="text-[10px] text-muted-foreground">{targetUser?.employeeId}</span>
                </div>
                <span className="text-xl font-black text-primary">{targetUser?.safetyScore ?? 100}</span>
             </div>
             <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => setAdjustmentType('REWARD')}
                  className={cn("h-12 rounded-xl font-black text-xs border", adjustmentType === 'REWARD' ? "bg-emerald-500 border-emerald-500 text-white" : "bg-muted border-border text-muted-foreground")}
                >상점 (+)</button>
                <button 
                  onClick={() => setAdjustmentType('PENALTY')}
                  className={cn("h-12 rounded-xl font-black text-xs border", adjustmentType === 'PENALTY' ? "bg-red-500 border-red-500 text-white" : "bg-muted border-border text-muted-foreground")}
                >벌점 (-)</button>
             </div>
             <Input 
                type="number" 
                placeholder="점수" 
                value={scoreDelta} 
                onChange={e => setScoreDelta(e.target.value)} 
                className="bg-muted border-border h-14 rounded-2xl text-lg font-black text-center"
             />
             <Input 
                placeholder="사유" 
                value={reason} 
                onChange={e => setReason(e.target.value)} 
                className="bg-muted border-border h-14 rounded-2xl font-bold"
             />
          </div>
          <DialogFooter className="mt-4">
            <Button onClick={handleAdjustScore} disabled={isSaving} className="w-full h-14 bg-primary text-white font-black rounded-2xl">
              {isSaving ? '저장 중' : '변경사항 저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
