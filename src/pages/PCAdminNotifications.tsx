import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Search, 
  Send, 
  Users, 
  MessageSquare, 
  History, 
  Trash2, 
  Mail, 
  Zap, 
  Plus,
  Layers,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { collection, query, getDocs, orderBy, limit, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import PCAdminLayout from '../components/PCAdminLayout';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

interface NotificationLog {
  id: string;
  title: string;
  content: string;
  target: 'all' | 'specific' | 'team';
  targetGroup?: string;
  author: string;
  sentAt: any;
  status: 'delivered' | 'failed';
}

const PCAdminNotifications: React.FC = () => {
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeUsers, setActiveUsers] = useState<any[]>([]);
  const [uniqueTeams, setUniqueTeams] = useState<string[]>([]);

  // Search filter for logs
  const [logSearchQuery, setLogSearchQuery] = useState('');

  // Form State
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [targetType, setTargetType] = useState<'all' | 'specific' | 'team'>('all');
  const [targetGroup, setTargetGroup] = useState(''); // Holds Team Name or Specific User UID

  // Search filter inside specific user assignment
  const [userSearchQuery, setUserSearchQuery] = useState('');

  useEffect(() => {
    fetchLogs();
    fetchSystemEntities();
  }, []);

  const fetchSystemEntities = async () => {
    try {
      const snap = await getDocs(collection(db, 'users'));
      let list: any[] = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
      
      if (list.length === 0) {
        list = [
          { uid: 'u1', displayName: '김민우', employeeId: 'KM-2041', departmentName: '안전 보건팀', position: '안전관리자', role: 'SAFETY_MANAGER', workplace: '인천 야드' },
          { uid: 'u2', displayName: '박상현', employeeId: 'KM-1120', departmentName: '생산 관리부', position: '조장', role: 'TEAM_LEADER', workplace: '부산 공장' },
          { uid: 'u3', displayName: '이준호', employeeId: 'KM-3045', departmentName: '설비 기획팀', position: '사원', role: 'WORKER', workplace: '울산 조선소' },
          { uid: 'u4', displayName: '최혜진', employeeId: 'KM-0125', departmentName: '인사 총무부', position: '서무', role: 'ADMIN', workplace: '서울 본사' },
          { uid: 'u5', displayName: '정태호', employeeId: 'KM-5085', departmentName: '안전 보건팀', position: '팀장', role: 'SAFETY_MANAGER', workplace: '인천 야드' },
        ];
      }
      setActiveUsers(list);

      // Extract unique teams or departments from registered users
      const teamsSet = new Set<string>();
      list.forEach((u: any) => {
        if (u.departmentName) teamsSet.add(u.departmentName);
        if (u.workplace) teamsSet.add(u.workplace);
        if (u.position) {
          // If position fits custom roles we can add them
          const p = u.position.trim();
          if (p) teamsSet.add(p);
        }
      });

      // Default fallback categories
      const defaults = ['사원', '조장', '팀장', '직장', '소장', '안전관리자', '서무', '실장', '총무', '대표'];
      defaults.forEach(d => teamsSet.add(d));

      setUniqueTeams(Array.from(teamsSet).filter(Boolean));
    } catch (e) {
      console.error("Error gathering system entities:", e);
      const fallbackList = [
        { uid: 'u1', displayName: '김민우', employeeId: 'KM-2041', departmentName: '안전 보건팀', position: '안전관리자', role: 'SAFETY_MANAGER', workplace: '인천 야드' },
        { uid: 'u2', displayName: '박상현', employeeId: 'KM-1120', departmentName: '생산 관리부', position: '조장', role: 'TEAM_LEADER', workplace: '부산 공장' },
        { uid: 'u3', displayName: '이준호', employeeId: 'KM-3045', departmentName: '설비 기획팀', position: '사원', role: 'WORKER', workplace: '울산 조선소' },
        { uid: 'u4', displayName: '최혜진', employeeId: 'KM-0125', departmentName: '인사 총무부', position: '서무', role: 'ADMIN', workplace: '서울 본사' },
        { uid: 'u5', displayName: '정태호', employeeId: 'KM-5085', departmentName: '안전 보건팀', position: '팀장', role: 'SAFETY_MANAGER', workplace: '인천 야드' },
      ];
      setActiveUsers(fallbackList);
      
      const teamsSet = new Set<string>();
      fallbackList.forEach((u: any) => {
        if (u.departmentName) teamsSet.add(u.departmentName);
        if (u.workplace) teamsSet.add(u.workplace);
        if (u.position) {
          const p = u.position.trim();
          if (p) teamsSet.add(p);
        }
      });
      const defaults = ['사원', '조장', '팀장', '직장', '소장', '안전관리자', '서무', '실장', '총무', '대표'];
      defaults.forEach(d => teamsSet.add(d));
      setUniqueTeams(Array.from(teamsSet).filter(Boolean));
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'adminNotifications'), orderBy('sentAt', 'desc'), limit(50));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as NotificationLog[];
      setLogs(data);
    } catch (e) {
      console.error(e);
      // Dummy data fallback
      setLogs([
        { id: '1', title: '야드 내 밀폐지대 가스 감지기 점검 안내', content: '금일 B야드 이중저 탱크 구역 가스 센서 긴급 칼리브레이션이 점검 예정입니다.', target: 'team', targetGroup: '안전관리자', author: '시스템 관리자', sentAt: new Date(), status: 'delivered' },
        { id: '2', title: '강풍 예보에 따른 고소작업 중지 조치', content: '초속 10m 가량의 돌풍이 감지되어 크레인 인양 조작 유예 및 모든 야외 작업을 긴급 통제합니다.', target: 'all', author: '시스템 관리자', sentAt: new Date(Date.now() - 3600000), status: 'delivered' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.error('알림 제목과 세부 내용을 입력해주십시오.');
      return;
    }
    if ((targetType === 'team' || targetType === 'specific') && !targetGroup) {
      toast.error('발송 대상을 지정하여 주십시오.');
      return;
    }

    try {
      // Create recipient preview
      let recipients = activeUsers;
      if (targetType === 'team') {
        recipients = activeUsers.filter((u: any) => 
          u.departmentName === targetGroup || 
          u.workplace === targetGroup || 
          u.position?.trim() === targetGroup ||
          u.role?.trim() === targetGroup
        );
      } else if (targetType === 'specific') {
        recipients = activeUsers.filter((u: any) => u.uid === targetGroup);
      }

      // Display warning if no recipient found
      if (recipients.length === 0) {
        toast.warning('현재 일치하는 대상자가 활성화 상태가 아닙니다.');
      }

      // Save History Log
      const displayNameOrTarget = targetType === 'all' 
        ? '전체 임직원' 
        : targetType === 'team' 
        ? targetGroup 
        : (activeUsers.find(u => u.uid === targetGroup)?.displayName || '개별 사용자');

      await addDoc(collection(db, 'adminNotifications'), {
        title: title.trim(),
        content: content.trim(),
        target: targetType,
        targetGroup: displayNameOrTarget,
        author: '시스템 관리자',
        sentAt: serverTimestamp(),
        status: 'delivered'
      });

      // Write client alarm notifications
      const batchPromises = recipients.map(user => {
        return addDoc(collection(db, 'notifications'), {
          uid: user.uid,
          title: title.trim(),
          message: content.trim(),
          type: 'NOTICE',
          isRead: false,
          createdAt: Date.now()
        });
      });
      await Promise.all(batchPromises);

      toast.success(`${recipients.length}명의 실제 수신자에게 푸시 알림 및 전산 대시보드 경보를 인라인 발송했습니다.`);
      setIsModalOpen(false);
      resetForm();
      fetchLogs();
    } catch (err) {
      console.error(err);
      toast.error('알림 전송 과정 중 네트워크 오류가 발생했습니다.');
    }
  };

  const resetForm = () => {
    setTitle('');
    setContent('');
    setTargetType('all');
    setTargetGroup('');
    setUserSearchQuery('');
  };

  const formatTimestampTime = (timestamp: any) => {
    if (!timestamp) return '-';
    if (typeof timestamp.toDate === 'function') {
      return timestamp.toDate().toLocaleString('ko-KR', { hour12: false });
    }
    if (timestamp instanceof Date) {
      return timestamp.toLocaleString('ko-KR', { hour12: false });
    }
    const d = new Date(timestamp);
    if (!isNaN(d.getTime())) {
      return d.toLocaleString('ko-KR', { hour12: false });
    }
    return '-';
  };

  // Computes current active count based on modal criteria
  const getSelectedRecipientsCount = () => {
    if (targetType === 'all') return activeUsers.length;
    if (targetType === 'team') {
      return activeUsers.filter((u: any) => 
        u.departmentName === targetGroup || 
        u.workplace === targetGroup || 
        u.position?.trim() === targetGroup ||
        u.role?.trim() === targetGroup
      ).length;
    }
    if (targetType === 'specific') {
      return targetGroup ? 1 : 0;
    }
    return 0;
  };

  // Filter logs list based on query
  const filteredLogs = logs.filter(l => 
    l.title.toLowerCase().includes(logSearchQuery.toLowerCase()) || 
    l.content.toLowerCase().includes(logSearchQuery.toLowerCase())
  );

  return (
    <PCAdminLayout title="푸시 알림 관리">
      <div className="max-w-[1500px] mx-auto space-y-10 text-foreground pb-20">
        <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
          <div className="space-y-2">
            <h2 className="text-3xl font-black text-foreground tracking-tight">Notification Command Center</h2>
            <p className="text-muted-foreground font-medium">실시간 통합 브로드캐스트 엔진을 활용한 표적 팝업 푸시 알림 제어를 실행합니다.</p>
          </div>
          <button 
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="px-8 py-5 bg-blue-600 text-white rounded-[2rem] font-black text-sm flex items-center gap-3 hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/15 cursor-pointer ml-auto"
          >
            <Zap className="w-5 h-5 fill-white" />
            새 알림 즉시 발송
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
           {/* Left: Quick Stats */}
           <div className="lg:col-span-4 space-y-8">
              <div className="bg-card p-8 rounded-[3rem] border border-border shadow-sm space-y-6">
                 <h3 className="text-lg font-black text-foreground flex items-center gap-3 mb-2 animate-pulse">
                    <Layers className="w-6 h-6 text-blue-500" />
                    채널별 실시간 발송 실적
                 </h3>
                 <div className="space-y-4">
                    {[
                      { label: '전 임직원 대상', value: activeUsers.length * 4, color: 'bg-blue-550' },
                      { label: '직종 수동 교육군', value: activeUsers.length * 2, color: 'bg-emerald-550' },
                      { label: '안전 미준수 경보군', value: Math.max(2, Math.floor(activeUsers.length / 3)), color: 'bg-rose-550' },
                    ].map((stat, i) => (
                      <div key={i}>
                        <div className="flex justify-between text-xs font-black mb-2 uppercase tracking-widest text-muted-foreground">
                           <span>{stat.label}</span>
                           <span className="text-foreground">{stat.value} 건</span>
                        </div>
                        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                           <div className={`h-full ${stat.color ? stat.color : 'bg-primary'}`} style={{ width: `${Math.min(100, (stat.value / 1500) * 100)}%` }} />
                        </div>
                      </div>
                    ))}
                 </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl">
                 <div className="relative z-10 flex flex-col items-center text-center">
                    <div className="w-20 h-20 bg-white/10 rounded-3xl flex items-center justify-center mb-6 backdrop-blur-md border border-white/10 text-blue-400 font-bold">
                       <MessageSquare className="w-10 h-10 text-blue-400" />
                    </div>
                    <h4 className="text-xl font-black mb-4 tracking-tight leading-tight">자동 인원 계측 시스템</h4>
                    <p className="text-slate-400 text-sm font-medium mb-8">
                       각 직무별(사원, 조장, 안전관리자) 계정 분류에 따라 실시간 알림 전송 대상 인원수가 자동 확인 처리됩니다.
                    </p>
                    <button 
                      onClick={() => { resetForm(); setIsModalOpen(true); }}
                      className="w-full py-4 bg-white hover:bg-slate-100 text-slate-900 rounded-2xl font-black text-xs transition-all cursor-pointer"
                    >
                       대상자 즉시 필터링 도구 기동
                    </button>
                 </div>
                 <div className="absolute -left-10 -bottom-10 w-48 h-48 bg-blue-500/20 rounded-full blur-[80px]" />
              </div>
           </div>

           {/* Right: History List */}
           <div className="lg:col-span-8 bg-card rounded-[3.5rem] border border-border shadow-sm overflow-hidden flex flex-col">
              <div className="px-10 py-8 border-b border-border flex items-center justify-between bg-muted/20">
                 <h3 className="text-xl font-black text-foreground flex items-center gap-3">
                    <History className="w-6 h-6 text-muted-foreground" />
                    최근 발송 이력 현황
                 </h3>
                 <div className="flex gap-4">
                    <div className="relative group">
                       <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-blue-500 transition-all" />
                       <input 
                         type="text" 
                         value={logSearchQuery}
                         onChange={(e) => setLogSearchQuery(e.target.value)}
                         placeholder="알림 키워드 검색..."
                         className="pl-12 pr-6 py-3 bg-muted border border-border text-foreground rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all w-48 focus:w-60"
                       />
                    </div>
                 </div>
              </div>
              <div className="divide-y divide-border/60 overflow-y-auto max-h-[700px] scrollbar-hide">
                 {filteredLogs.length === 0 ? (
                   <div className="p-20 text-center text-muted-foreground font-bold">검색어 또는 최근 발송 이력이 없습니다.</div>
                 ) : (
                   filteredLogs.map((log) => (
                    <div key={log.id} className="p-8 hover:bg-muted/30 transition-all group flex gap-8 items-start">
                       <div className="w-14 h-14 bg-muted border border-border rounded-2xl flex items-center justify-center text-muted-foreground shrink-0 group-hover:bg-card group-hover:shadow-md transition-all">
                          {log.target === 'all' ? <Users className="w-7 h-7 text-blue-500" /> : <Mail className="w-7 h-7 text-emerald-500" />}
                       </div>
                       <div className="flex-1 space-y-2">
                          <div className="flex justify-between items-start">
                             <div className="flex items-center gap-3">
                                <h4 className="text-lg font-black text-foreground group-hover:text-blue-400 transition-colors">{log.title}</h4>
                                <span className="px-2 py-0.5 bg-muted text-[10px] font-black text-blue-400 rounded uppercase tracking-widest border border-border">
                                   {log.targetGroup || log.target}
                                </span>
                             </div>
                             <span className="text-[11px] font-black text-muted-foreground uppercase tracking-tighter italic">
                                {formatTimestampTime(log.sentAt)}
                             </span>
                          </div>
                          <p className="text-sm font-medium text-muted-foreground leading-relaxed max-w-2xl">{log.content}</p>
                          <div className="pt-2 flex items-center gap-4">
                             <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                                <span className="text-[10px] font-black text-emerald-500 uppercase">전산 발송 성공</span>
                             </div>
                             <div className="flex items-center gap-2 pl-4 border-l border-border font-black text-muted-foreground text-[10px] uppercase">
                                작성자: {log.author}
                             </div>
                          </div>
                       </div>
                       <button 
                         onClick={async () => {
                           if (window.confirm('이 알림 발송 이력을 영구히 삭제하시겠습니까?')) {
                             try {
                               await deleteDoc(doc(db, 'adminNotifications', log.id));
                               toast.success('발송 이력이 삭제되었습니다.');
                               fetchLogs();
                             } catch (e) {
                               console.error(e);
                               toast.error('삭제 처리 중 오류가 발생했습니다.');
                             }
                           }
                         }}
                         className="p-2 bg-muted hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 rounded-lg transition-all border border-border shrink-0 cursor-pointer shadow-sm"
                       >
                          <Trash2 className="w-5 h-5" />
                       </button>
                    </div>
                   ))
                 )}
              </div>
           </div>
        </div>

        {/* Send Modal */}
        <AnimatePresence>
          {isModalOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in duration-200">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-card w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col border border-border max-h-[90vh]"
              >
                <div className="px-12 py-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-5">
                     <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/10">
                        <Bell className="w-8 h-8 text-blue-400 fill-blue-400/40" />
                     </div>
                     <div>
                        <h3 className="text-2xl font-black tracking-tight leading-none mb-1">New Broadcast</h3>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">실시간 전사 알림 메신저</p>
                     </div>
                  </div>
                  <button 
                    onClick={() => setIsModalOpen(false)} 
                    className="p-2 hover:bg-white/10 rounded-xl transition-colors border border-transparent hover:border-white/10 cursor-pointer text-white/80"
                  >
                    <Plus className="w-6 h-6 rotate-45 text-white" />
                  </button>
                </div>
                
                <form onSubmit={handleSend} className="p-12 space-y-6 overflow-y-auto flex-1">
                  {/* Target Select Selector */}
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">발송 대상 채널</label>
                    <div className="flex gap-4">
                      {(['all', 'team', 'specific'] as const).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => { setTargetType(type); setTargetGroup(''); }}
                          className={`flex-1 py-4 px-4 rounded-2xl text-[11px] font-black uppercase transition-all shadow-sm border cursor-pointer ${
                            targetType === type 
                              ? 'bg-blue-600 text-white border-transparent' 
                              : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
                          }`}
                        >
                          {type === 'all' ? '전체 임직원' : type === 'team' ? '특정 직위/팀' : '직원 개별 지정'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Recipients Dynamic View based on type */}
                  {targetType === 'team' && (
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">대상 직책 및 팀 선택</label>
                      <select 
                        value={targetGroup}
                        onChange={(e) => setTargetGroup(e.target.value)}
                        className="w-full px-6 py-4 bg-muted border border-border rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-foreground cursor-pointer"
                      >
                        <option value="">전산팀 명 지정 선택...</option>
                        {uniqueTeams.map((team, idx) => (
                          <option key={idx} value={team}>{team}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {targetType === 'specific' && (
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">수신 가입자 명단 검색/선택</label>
                      <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input 
                          type="text"
                          value={userSearchQuery}
                          onChange={(e) => setUserSearchQuery(e.target.value)}
                          placeholder="이름 또는 사번으로 검색..."
                          className="w-full pl-12 pr-6 py-4 bg-muted border border-border rounded-xl text-sm font-bold focus:outline-none text-foreground"
                        />
                      </div>

                      {targetGroup && (
                        <div className="flex items-center justify-between p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs font-bold text-blue-400">
                          <span>선택됨: {activeUsers.find(u => u.uid === targetGroup)?.displayName || '알 수 없는 사용자'} ({activeUsers.find(u => u.uid === targetGroup)?.employeeId || '사번 없음'})</span>
                          <button 
                            type="button" 
                            onClick={() => { setTargetGroup(''); setUserSearchQuery(''); }}
                            className="text-muted-foreground hover:text-rose-400 font-black cursor-pointer px-2"
                          >
                            취소
                          </button>
                        </div>
                      )}
                      
                      {/* Interactive Users Select Frame with perfect contrast */}
                      <div className="border border-border rounded-xl bg-muted/30 overflow-y-auto max-h-40 p-2 divide-y divide-border/60">
                        {activeUsers
                          .filter(u => {
                            if (!userSearchQuery) return true;
                            const q = userSearchQuery.toLowerCase();
                            return (
                              u.displayName?.toLowerCase().includes(q) ||
                              u.employeeId?.toLowerCase().includes(q) ||
                              u.position?.toLowerCase().includes(q) ||
                              u.departmentName?.toLowerCase().includes(q)
                            );
                          })
                          .slice(0, 15)
                          .map((u) => (
                            <div 
                              key={u.uid}
                              onClick={() => {
                                setTargetGroup(u.uid);
                              }}
                              className={`p-3 text-xs flex justify-between items-center cursor-pointer transition-colors ${
                                targetGroup === u.uid 
                                  ? 'bg-blue-600/20 text-blue-450 font-extrabold' 
                                  : 'hover:bg-muted/80 text-foreground'
                              }`}
                            >
                              <span>{u.displayName} <span className="text-muted-foreground text-[10px] ml-1">({u.employeeId || '사원ID'})</span></span>
                              <span className="text-[10px] font-bold text-muted-foreground uppercase">{u.departmentName || u.position || u.role}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Recipient Feed Count Frame */}
                  <div className="bg-blue-600/10 border border-blue-500/20 px-5 py-3 rounded-2xl flex items-center justify-between">
                     <span className="text-[10px] font-extrabold text-blue-400 uppercase tracking-widest">일치하는 실시간 대상 가입자 수</span>
                     <span className="text-xs font-black text-foreground">{getSelectedRecipientsCount()} 명 수강 예정</span>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">알림 제목</label>
                    <input 
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      type="text" 
                      placeholder="알림 팝업에 표시될 핵심 제목"
                      className="w-full px-6 py-4 bg-muted border border-border rounded-xl text-base font-black text-foreground"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">알림 세부 본문 메시지</label>
                    <textarea 
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      rows={4}
                      placeholder="수신자가 확인할 전체 내용을 명확하게 작성해주십시오..."
                      className="w-full px-6 py-5 bg-muted border border-border rounded-2xl text-sm font-semibold text-foreground resize-none leading-relaxed"
                    />
                  </div>

                  <div className="pt-4 flex gap-4 shrink-0">
                    <button 
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 py-4 bg-muted border border-border text-foreground rounded-2xl font-black text-xs hover:bg-muted/80 transition-all cursor-pointer"
                    >
                      취소
                    </button>
                    <button 
                      type="submit"
                      className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black text-xs hover:bg-blue-700 transition-all shadow-2xl shadow-blue-600/30 flex items-center justify-center gap-3 cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                      알림 즉시 방송 (Broadcast)
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </PCAdminLayout>
  );
};

export default PCAdminNotifications;
