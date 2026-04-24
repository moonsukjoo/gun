import React, { useState, useEffect, useMemo } from 'react';
import { db } from '@/src/firebase';
import { 
  collection, 
  query, 
  onSnapshot, 
  updateDoc, 
  doc, 
  where, 
  orderBy,
  deleteDoc
} from 'firebase/firestore';
import { UserProfile, Attendance } from '@/src/types';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { 
  Users, 
  Search, 
  Calendar, 
  Clock, 
  Edit2, 
  Save, 
  X, 
  ChevronRight,
  TrendingUp,
  AlertCircle,
  ArrowLeft,
  Calculator
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { calculateAttendanceHours } from '@/src/lib/attendance';

export const AttendanceManagement: React.FC = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [attendanceData, setAttendanceData] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    clockIn: string;
    clockOut: string;
    workHours: string;
    overtimeHours: string;
  }>({
    clockIn: '',
    clockOut: '',
    workHours: '',
    overtimeHours: ''
  });

  // Fetch all users
  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('displayName', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ ...doc.data() } as UserProfile)));
    });
    return () => unsubscribe();
  }, []);

  // Fetch attendance for selected user and month
  useEffect(() => {
    if (!selectedUser) {
      setAttendanceData([]);
      return;
    }

    setLoading(true);
    const start = startOfMonth(parseISO(month + '-01'));
    const end = endOfMonth(start);

    const q = query(
      collection(db, 'attendance'),
      where('uid', '==', selectedUser.uid),
      where('date', '>=', format(start, 'yyyy-MM-dd')),
      where('date', '<=', format(end, 'yyyy-MM-dd')),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAttendanceData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Attendance)));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedUser, month]);

  const filteredUsers = users.filter(u => 
    u.displayName.toLowerCase().includes(search.toLowerCase()) || 
    u.departmentName?.toLowerCase().includes(search.toLowerCase())
  );

  const startEditing = (att: Attendance) => {
    setEditingId(att.id);
    setEditForm({
      clockIn: att.clockIn ? format(new Date(att.clockIn), "yyyy-MM-dd'T'HH:mm") : '',
      clockOut: att.clockOut ? format(new Date(att.clockOut), "yyyy-MM-dd'T'HH:mm") : '',
      workHours: att.workHours?.toString() || '0',
      overtimeHours: att.overtimeHours?.toString() || '0'
    });
  };

  const handleSaveEdit = async (id: string) => {
    try {
      const updates: any = {
        workHours: parseFloat(editForm.workHours),
        overtimeHours: parseFloat(editForm.overtimeHours)
      };

      if (editForm.clockIn) {
        updates.clockIn = new Date(editForm.clockIn).toISOString();
      }
      if (editForm.clockOut) {
        updates.clockOut = new Date(editForm.clockOut).toISOString();
      } else {
        updates.clockOut = null;
      }

      await updateDoc(doc(db, 'attendance', id), updates);
      setEditingId(null);
      toast.success('근태 기록이 수정되었습니다.');
    } catch (error) {
      console.error(error);
      toast.error('수정 중 오류가 발생했습니다.');
    }
  };

  const handleRecalculate = () => {
    if (!editForm.clockIn || !editForm.clockOut) {
      toast.error('출근 시간과 퇴근 시간이 모두 필요합니다.');
      return;
    }

    const { workHours, overtimeHours } = calculateAttendanceHours(
      new Date(editForm.clockIn),
      new Date(editForm.clockOut)
    );

    setEditForm({
      ...editForm,
      workHours: workHours.toString(),
      overtimeHours: overtimeHours.toString()
    });
    toast.success('근무 시간이 재계산되었습니다.');
  };

  const stats = useMemo(() => {
    const total = attendanceData.reduce((acc, curr) => acc + (curr.workHours || 0), 0);
    const ot = attendanceData.reduce((acc, curr) => acc + (curr.overtimeHours || 0), 0);
    return { total, ot };
  }, [attendanceData]);

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="p-6 sticky top-0 bg-background/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-4 mb-6">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/admin')}
            className="text-muted-foreground"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">근태 관리</h1>
            <p className="text-xs font-bold text-muted-foreground">사용자별 근태 기록 확인 및 조정</p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
             <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="이름 또는 부서 검색" 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 h-12 bg-card border-none text-sm font-bold rounded-xl"
                />
             </div>
             <Input 
               type="month" 
               value={month}
               onChange={(e) => setMonth(e.target.value)}
               className="w-32 h-12 bg-card border-none text-xs font-black text-white rounded-xl text-center px-0 appearance-none"
               style={{ colorScheme: 'dark' }}
             />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {filteredUsers.map(user => (
              <button
                key={user.uid}
                onClick={() => setSelectedUser(user)}
                className={cn(
                  "shrink-0 px-4 py-2 rounded-xl text-xs font-black transition-all border",
                  selectedUser?.uid === user.uid 
                    ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" 
                    : "bg-card text-muted-foreground border-white/5"
                )}
              >
                {user.displayName} 
                <span className="ml-1 opacity-50 text-[10px]">{user.position || user.departmentName}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="px-6 space-y-6">
        {selectedUser ? (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
               <Card className="bg-card border-white/5 rounded-2xl p-4 overflow-hidden relative">
                  <div className="absolute top-0 right-0 p-3 opacity-10">
                    <Clock className="w-12 h-12 text-blue-500" />
                  </div>
                  <p className="text-[10px] font-black text-muted-foreground mb-1 uppercase tracking-widest">이달의 기본 시간</p>
                  <p className="text-2xl font-black text-white">{stats.total.toFixed(1)} <span className="text-xs font-bold text-muted-foreground">h</span></p>
               </Card>
               <Card className="bg-card border-white/5 rounded-2xl p-4 overflow-hidden relative">
                  <div className="absolute top-0 right-0 p-3 opacity-10">
                    <TrendingUp className="w-12 h-12 text-primary" />
                  </div>
                  <p className="text-[10px] font-black text-muted-foreground mb-1 uppercase tracking-widest">이달의 잔업 시간</p>
                  <p className="text-2xl font-black text-primary">{stats.ot.toFixed(1)} <span className="text-xs font-bold text-muted-foreground">h</span></p>
               </Card>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                {selectedUser.displayName}님의 기록
              </h3>

              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-4">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs font-bold text-muted-foreground">기록을 불러오는 중...</p>
                </div>
              ) : attendanceData.length > 0 ? (
                <div className="space-y-3">
                  {attendanceData.map((att) => (
                    <Card key={att.id} className="bg-card border-white/5 rounded-2xl overflow-hidden">
                      <div className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <p className="text-sm font-black text-white">{format(parseISO(att.date), 'MM.dd EEEE', { locale: ko })}</p>
                            <div className="flex gap-2 mt-1">
                              <span className="text-[10px] font-bold text-muted-foreground">출근: {att.clockIn ? format(new Date(att.clockIn), 'HH:mm') : '-'}</span>
                              <span className="text-[10px] font-bold text-muted-foreground">퇴근: {att.clockOut ? format(new Date(att.clockOut), 'HH:mm') : '-'}</span>
                            </div>
                          </div>
                          {editingId === att.id ? (
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" onClick={() => handleSaveEdit(att.id)} className="text-emerald-500">
                                <Save className="w-4 h-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => setEditingId(null)} className="text-rose-500">
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <Button size="icon" variant="ghost" onClick={() => startEditing(att)} className="text-muted-foreground">
                              <Edit2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>

                        {editingId === att.id ? (
                          <div className="space-y-3 pt-2 border-t border-white/5">
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <label className="text-[10px] font-black text-muted-foreground uppercase ml-1">출근 시간</label>
                                <Input 
                                  type="datetime-local" 
                                  value={editForm.clockIn}
                                  onChange={(e) => setEditForm({...editForm, clockIn: e.target.value})}
                                  className="h-9 bg-black/20 border-none text-[10px] font-bold"
                                  style={{ colorScheme: 'dark' }}
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-black text-muted-foreground uppercase ml-1">퇴근 시간</label>
                                <Input 
                                  type="datetime-local" 
                                  value={editForm.clockOut}
                                  onChange={(e) => setEditForm({...editForm, clockOut: e.target.value})}
                                  className="h-9 bg-black/20 border-none text-[10px] font-bold"
                                  style={{ colorScheme: 'dark' }}
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <label className="text-[10px] font-black text-muted-foreground uppercase ml-1">기본 시간 (h)</label>
                                <Input 
                                  type="number" 
                                  step="0.1"
                                  value={editForm.workHours}
                                  onChange={(e) => setEditForm({...editForm, workHours: e.target.value})}
                                  className="h-9 bg-black/20 border-none text-[10px] font-bold"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-black text-muted-foreground uppercase ml-1">잔업 시간 (h)</label>
                                <Input 
                                  type="number" 
                                  step="0.1"
                                  value={editForm.overtimeHours}
                                  onChange={(e) => setEditForm({...editForm, overtimeHours: e.target.value})}
                                  className="h-9 bg-black/20 border-none text-[10px] font-bold"
                                />
                              </div>
                            </div>
                            <Button 
                              variant="outline" 
                              className="w-full h-8 bg-primary/5 border-primary/20 text-primary text-[10px] font-black gap-1"
                              onClick={handleRecalculate}
                            >
                              <Calculator className="w-3 h-3" /> 시간 자동 계산
                            </Button>
                          </div>
                        ) : (
                          <div className="flex gap-4">
                            <div className="flex-1 bg-black/20 rounded-xl p-2 text-center">
                              <p className="text-[9px] font-black text-muted-foreground uppercase mb-0.5 tracking-tighter">기본</p>
                              <p className="text-sm font-black text-white">{att.workHours?.toFixed(1) || '0.0'}h</p>
                            </div>
                            <div className="flex-1 bg-black/20 rounded-xl p-2 text-center">
                              <p className="text-[9px] font-black text-muted-foreground uppercase mb-0.5 tracking-tighter">잔업</p>
                              <p className="text-sm font-black text-primary">{att.overtimeHours?.toFixed(1) || '0.0'}h</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="py-20 flex flex-col items-center justify-center gap-4 bg-card rounded-3xl border border-dashed border-white/10">
                  <AlertCircle className="w-8 h-8 text-muted-foreground opacity-20" />
                  <p className="text-xs font-bold text-muted-foreground">이달의 근태 기록이 없습니다.</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="py-24 flex flex-col items-center justify-center gap-4 bg-card/30 rounded-3xl border border-dashed border-white/5">
            <Users className="w-10 h-10 text-muted-foreground opacity-20" />
            <div className="text-center">
              <p className="text-sm font-black text-white mb-1">사용자를 선택해주세요</p>
              <p className="text-xs font-bold text-muted-foreground">기록을 확인하고 조정할 사용자를 목록에서 선택하세요.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
