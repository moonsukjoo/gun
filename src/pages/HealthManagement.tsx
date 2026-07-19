import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, orderBy, limit, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../components/AuthProvider';
import { HealthReport, Role } from '../types';
import PCAdminLayout from '../components/PCAdminLayout';
import { 
  HeartPulse, 
  Plus, 
  Search, 
  Calendar, 
  User, 
  MapPin, 
  CheckCircle2, 
  AlertCircle,
  MessageSquare,
  Clock,
  ChevronRight,
  Filter,
  X,
  Edit,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

const HealthManagement: React.FC = () => {
  const { profile } = useAuth();
  const [reports, setReports] = useState<HealthReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [newReport, setNewReport] = useState({
    status: '이상무',
    content: ''
  });

  const [editingReport, setEditingReport] = useState<HealthReport | null>(null);

  const canWrite = profile && (
    ['CEO', 'DIRECTOR', 'GENERAL_MANAGER', 'CLERK', 'SAFETY_MANAGER', 'TEAM_LEADER'].includes(profile.role) ||
    profile.permissions?.includes('health_mgmt') ||
    (profile.position && ['반장', '조장', '팀장'].some(p => profile.position?.includes(p)))
  );

  useEffect(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const q = query(
      collection(db, 'healthReports'), 
      where('date', '==', today),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setReports(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as HealthReport)));
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'healthReports');
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAddReport = async () => {
    if (!profile) return;
    if (!newReport.status.trim()) {
      toast.error('상태를 입력해주세요.');
      return;
    }

    try {
      await addDoc(collection(db, 'healthReports'), {
        authorUid: profile.uid,
        authorName: profile.displayName,
        authorRole: profile.role,
        teamId: profile.departmentId || '',
        teamName: profile.departmentName || '',
        status: newReport.status,
        content: newReport.content,
        date: format(new Date(), 'yyyy-MM-dd'),
        createdAt: new Date().toISOString()
      });

      toast.success('보건 이상무 보고가 등록되었습니다.');
      setIsWriteOpen(false);
      setNewReport({ status: '이상무', content: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'healthReports');
      toast.error('보고 등록 중 오류가 발생했습니다.');
    }
  };

  const handleUpdateReport = async () => {
    if (!editingReport) return;
    try {
      await updateDoc(doc(db, 'healthReports', editingReport.id), {
        status: editingReport.status,
        content: editingReport.content,
        updatedAt: new Date().toISOString()
      });
      toast.success('보고서가 수정되었습니다.');
      setIsEditOpen(false);
      setEditingReport(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `healthReports/${editingReport.id}`);
      toast.error('수정 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteReport = async (id: string) => {
    if (!confirm('정말로 이 보고서를 삭제하시겠습니까?')) return;
    try {
      await deleteDoc(doc(db, 'healthReports', id));
      toast.success('보고서가 삭제되었습니다.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `healthReports/${id}`);
      toast.error('삭제 중 오류가 발생했습니다.');
    }
  };

  const filteredReports = reports.filter(r => 
    r.authorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.teamName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isPC = window.location.pathname.startsWith('/admin/pc');
  const innerContent = (
    <div className="p-2 space-y-6 pb-24">
      {/* Header */}
        <header className="flex flex-col gap-1 px-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-500/10 rounded-xl">
                <HeartPulse className="w-5 h-5 text-emerald-500" />
              </div>
              <h2 className="text-xl font-black text-foreground">보건관리 (이상무)</h2>
            </div>
            {canWrite && (
              <Button 
                onClick={() => setIsWriteOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl h-10 px-4 gap-2 text-sm shadow-lg shadow-emerald-900/20"
              >
                <Plus className="w-4 h-4" /> 보고 등록
              </Button>
            )}
          </div>
        </header>

        {/* Search */}
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/30 group-focus-within:text-emerald-500 transition-colors" />
          <Input 
            placeholder="팀명, 성명, 상태 검색..." 
            className="h-12 pl-10 bg-muted border-border rounded-2xl text-sm font-bold text-foreground focus:border-emerald-500/50 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Reports List */}
        <div className="space-y-4">
          {loading ? (
            <div className="py-20 text-center">
              <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground font-bold text-sm">보고 내역을 불러오는 중...</p>
            </div>
          ) : filteredReports.length > 0 ? (
            filteredReports.map((report, idx) => (
              <motion.div
                key={report.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-card border border-border rounded-[2rem] p-5 relative overflow-hidden"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center font-black text-emerald-500 text-sm">
                      {report.authorName.charAt(0)}
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-foreground">{report.authorName}</h4>
                      <p className="text-[10px] font-bold text-muted-foreground/40">{report.teamName || '소속 미지정'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {profile?.uid === report.authorUid && (
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="w-8 h-8 rounded-lg text-muted-foreground/40 hover:text-foreground hover:bg-muted"
                          onClick={() => {
                            setEditingReport(report);
                            setIsEditOpen(true);
                          }}
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="w-8 h-8 rounded-lg text-muted-foreground/40 hover:text-rose-500 hover:bg-rose-500/10"
                          onClick={() => handleDeleteReport(report.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                    <Badge variant="outline" className="bg-emerald-500/10 border-emerald-500/20 text-emerald-500 font-bold text-[10px]">
                      {report.status}
                    </Badge>
                  </div>
                </div>

                {report.content && (
                  <div className="bg-muted/50 rounded-2xl p-4 mb-4">
                    <p className="text-xs text-foreground/70 font-medium leading-relaxed">
                      {report.content}
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <div className="flex items-center gap-1.5 text-muted-foreground/30">
                    <Calendar className="w-3 h-3" />
                    <span className="text-[10px] font-bold">{report.date}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground/30">
                    <Clock className="w-3 h-3" />
                    <span className="text-[10px] font-bold">
                      {report.createdAt ? format(new Date(report.createdAt), 'HH:mm') : '-'}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="py-20 text-center bg-card rounded-[2.5rem] border border-dashed border-border">
              <AlertCircle className="w-10 h-10 text-muted-foreground/10 mx-auto mb-4" />
              <p className="text-muted-foreground font-bold">최근 보고 내역이 없습니다.</p>
            </div>
          )}
        </div>

      {/* Write Dialog */}
      <Dialog open={isWriteOpen} onOpenChange={setIsWriteOpen}>
        <DialogContent className="bg-card border border-border rounded-[2.5rem] text-foreground">
          <DialogHeader>
            <DialogTitle className="text-xl font-black flex items-center gap-2">
              <HeartPulse className="w-5 h-5 text-emerald-500" />
              보건관리 이상무 등록
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">현재 상태 (기본: 이상무)</label>
              <Input 
                value={newReport.status}
                onChange={(e) => setNewReport({ ...newReport, status: e.target.value })}
                className="bg-muted border-border rounded-xl h-12 font-bold text-foreground"
                placeholder="상태를 입력하세요 (예: 이상무, 특이사항 발생 등)"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">상세 내용 (선택사항)</label>
              <Textarea 
                value={newReport.content}
                onChange={(e) => setNewReport({ ...newReport, content: e.target.value })}
                className="bg-muted border-border rounded-xl min-h-[120px] font-bold resize-none text-foreground"
                placeholder="전달할 특이사항이나 상세 내용을 입력하세요..."
              />
            </div>
            
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-100 leading-relaxed">
                팀장/직장 보고 권한으로 제출됩니다. 등록된 보고는 안전관리자 및 경영진이 실시간으로 확인합니다.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="ghost" 
              onClick={() => setIsWriteOpen(false)}
              className="rounded-xl font-bold"
            >
              취소
            </Button>
            <Button 
              onClick={handleAddReport}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl px-8"
            >
              제출하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="bg-card border border-border rounded-[2.5rem] text-foreground">
          <DialogHeader>
            <DialogTitle className="text-xl font-black flex items-center gap-2">
              <Edit className="w-5 h-5 text-emerald-500" />
              보고서 수정
            </DialogTitle>
          </DialogHeader>
          {editingReport && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">현재 상태</label>
                <Input 
                  value={editingReport.status}
                  onChange={(e) => setEditingReport({ ...editingReport, status: e.target.value })}
                  className="bg-muted border-border rounded-xl h-12 font-bold text-foreground"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">상세 내용</label>
                <Textarea 
                  value={editingReport.content}
                  onChange={(e) => setEditingReport({ ...editingReport, content: e.target.value })}
                  className="bg-muted border-border rounded-xl min-h-[120px] font-bold resize-none text-foreground"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button 
              variant="ghost" 
              onClick={() => {
                setIsEditOpen(false);
                setEditingReport(null);
              }}
              className="rounded-xl font-bold"
            >
              취소
            </Button>
            <Button 
              onClick={handleUpdateReport}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl px-8"
            >
              수정 완료
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  if (isPC) {
    return (
      <PCAdminLayout title="보건관리(이상무) 현황">
        <div className="max-w-[1600px] mx-auto">
          {innerContent}
        </div>
      </PCAdminLayout>
    );
  }

  return innerContent;
};

export default HealthManagement;
