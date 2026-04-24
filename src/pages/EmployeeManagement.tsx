import React, { useEffect, useState } from 'react';
import { db } from '@/src/firebase';
import { collection, onSnapshot, updateDoc, doc, addDoc, deleteDoc, query, orderBy, increment } from 'firebase/firestore';
import { UserProfile, Role, Department, PraiseCoupon, JobRole } from '@/src/types';
import { useAuth } from '@/src/components/AuthProvider';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { 
  Plus, 
  Trash2, 
  Users, 
  Building2, 
  UserCog, 
  UserPlus, 
  Search, 
  X,
  CalendarRange,
  Save,
  Filter,
  CheckCircle2,
  XCircle,
  Gift,
  Clock,
  MapPin,
  ArrowRight,
  Download
} from 'lucide-react';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

const ROLES: Role[] = ['CEO', 'DIRECTOR', 'GENERAL_AFFAIRS', 'GENERAL_MANAGER', 'CLERK', 'SAFETY_MANAGER', 'TEAM_LEADER', 'EMPLOYEE'];

const ROLE_LABELS: Record<Role, string> = {
  CEO: '사장 (CEO)',
  DIRECTOR: '소장 (DIRECTOR)',
  GENERAL_AFFAIRS: '총무 (AFFAIRS)',
  GENERAL_MANAGER: '실장 (MANAGER)',
  CLERK: '서무 (CLERK)',
  SAFETY_MANAGER: '안전관리자 (SAFETY)',
  TEAM_LEADER: '팀장 (LEADER)',
  EMPLOYEE: '일반사원 (EMPLOYEE)'
};

const POSITIONS = ['사장', '소장', '실장', '팀장', '조장', '반장', '사원'];

const PERMISSIONS = [
  { id: 'notice_mgmt', label: '공지사항 관리' },
  { id: 'accident_mgmt', label: '사고보고 관리' },
  { id: 'leave_mgmt', label: '연차/휴가 관리' },
  { id: 'dept_mgmt', label: '부서/팀 관리' },
  { id: 'employee_mgmt', label: '인사/사원 관리' },
  { id: 'training_mgmt', label: '교육/평가 관리' },
  { id: 'praise_coupon', label: '칭찬쿠폰 발행' },
];

export const EmployeeManagement: React.FC = () => {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const DEFAULT_JOB_ROLES = ['취부', '용접', '사상', '도장', '반장', '조장', '기타'];
  const [newDeptName, setNewDeptName] = useState('');
  const [newJobRoleName, setNewJobRoleName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'RESIGNED'>('ALL');
  const [deptFilter, setDeptFilter] = useState<string>('ALL');
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState<string>('');
  
  // Praise Coupon States
  const [isGrantCouponOpen, setIsGrantCouponOpen] = useState(false);
  const [couponReceiver, setCouponReceiver] = useState<UserProfile | null>(null);
  const [couponForm, setCouponForm] = useState({ 
    date: new Date().toISOString().split('T')[0], 
    time: new Date().toTimeString().slice(0, 5), 
    location: '', 
    reason: '', 
    points: 1 
  });
  const [newUser, setNewUser] = useState({
    displayName: '',
    employeeId: '',
    email: '',
    role: 'EMPLOYEE' as Role,
    departmentId: '',
    position: '사원',
    jobRole: '',
    workplace: '',
    phoneNumber: '',
    birthDate: '',
    joinedAt: new Date().toISOString().split('T')[0],
    resignedAt: '',
  });

  useEffect(() => {
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => doc.data() as UserProfile));
    });

    const deptQuery = query(collection(db, 'departments'), orderBy('createdAt', 'desc'));
    const unsubscribeDepts = onSnapshot(deptQuery, (snapshot) => {
      setDepartments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department)));
    });

    const jobRoleQuery = query(collection(db, 'jobRoles'), orderBy('createdAt', 'desc'));
    const unsubscribeJobRoles = onSnapshot(jobRoleQuery, (snapshot) => {
      setJobRoles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as JobRole)));
    });

    return () => {
      unsubscribeUsers();
      unsubscribeDepts();
      unsubscribeJobRoles();
    };
  }, []);

  const handleRoleChange = async (uid: string, newRole: Role) => {
    try {
      await updateDoc(doc(db, 'users', uid), { role: newRole });
      const user = users.find(u => u.uid === uid);
      toast.success('권한 변경 완료', {
        description: `${user?.displayName}님의 권한을 '${ROLE_LABELS[newRole]}'로 변경했습니다.`
      });
    } catch (error) {
      toast.error('권한 변경 중 오류가 발생했습니다.');
    }
  };

  const handleDeptChange = async (uid: string, deptId: string) => {
    const dept = departments.find(d => d.id === deptId);
    try {
      await updateDoc(doc(db, 'users', uid), { 
        departmentId: deptId,
        departmentName: dept?.name || ''
      });
      const user = users.find(u => u.uid === uid);
      toast.success('부서 이동 완료', {
        description: `${user?.displayName}님을 '${dept?.name || '미지정'}' 부서로 이동시켰습니다.`
      });
    } catch (error) {
      toast.error('부서 변경 중 오류가 발생했습니다.');
    }
  };

  const handlePositionChange = async (uid: string, position: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), { position });
      toast.success('직위가 변경되었습니다.');
    } catch (error) {
      toast.error('직위 변경 중 오류가 발생했습니다.');
    }
  };

  const handleJobRoleChange = async (uid: string, jobRole: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), { jobRole });
      toast.success('직무가 변경되었습니다.');
    } catch (error) {
      toast.error('직무 변경 중 오류가 발생했습니다.');
    }
  };

  const handlePhoneChange = async (uid: string, phoneNumber: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), { phoneNumber });
      toast.success('연락처가 변경되었습니다.');
    } catch (error) {
      toast.error('연락처 변경 중 오류가 발생했습니다.');
    }
  };

  const handleLeaveBalanceChange = async (uid: string, balance: string) => {
    const numBalance = parseFloat(balance);
    if (isNaN(numBalance)) return;
    try {
      await updateDoc(doc(db, 'users', uid), { annualLeaveBalance: numBalance });
      toast.success('잔여 연차가 수정되었습니다.');
    } catch (error) {
      toast.error('연차 수정 중 오류가 발생했습니다.');
    }
  };

  const handleWorkplaceChange = async (uid: string, workplace: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), { workplace });
      toast.success('사업장이 변경되었습니다.');
    } catch (error) {
      toast.error('사업장 변경 중 오류가 발생했습니다.');
    }
  };

  const handleJoinedAtChange = async (uid: string, date: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), { joinedAt: date });
      toast.success('입사일이 변경되었습니다.');
    } catch (error) {
      toast.error('입사일 변경 중 오류가 발생했습니다.');
    }
  };

  const handleResignedAtChange = async (uid: string, date: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), { 
        resignedAt: date,
        isActive: !date 
      });
      const user = users.find(u => u.uid === uid);
      toast.success('인사 정보 업데이트', {
        description: `${user?.displayName}님의 퇴사/재직 정보가 수정되었습니다.`
      });
    } catch (error) {
      toast.error('퇴사 정보 변경 중 오류가 발생했습니다.');
    }
  };

  const handleStatusChange = async (uid: string, isActive: boolean) => {
    try {
      await updateDoc(doc(db, 'users', uid), { isActive });
      toast.success('재직 상태가 변경되었습니다.');
    } catch (error) {
      toast.error('상태 변경 중 오류가 발생했습니다.');
    }
  };

  const handleDisplayNameChange = async (uid: string, displayName: string) => {
    if (!displayName.trim()) return;
    try {
      await updateDoc(doc(db, 'users', uid), { displayName: displayName.trim() });
      toast.success('이름이 변경되었습니다.');
    } catch (error) {
      toast.error('이름 변경 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (!window.confirm('정말 이 사원 정보를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
    try {
      await deleteDoc(doc(db, 'users', uid));
      toast.success('사원 정보가 삭제되었습니다.');
    } catch (error) {
      toast.error('사원 삭제 중 오류가 발생했습니다.');
    }
  };

  const handleAddDept = async () => {
    if (!newDeptName.trim()) return;
    try {
      await addDoc(collection(db, 'departments'), {
        name: newDeptName.trim(),
        createdAt: new Date().toISOString()
      });
      setNewDeptName('');
      toast.success('새 부서가 추가되었습니다.');
    } catch (error) {
      toast.error('부서 추가 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteDept = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'departments', id));
      toast.success('부서가 삭제되었습니다.');
    } catch (error) {
      toast.error('부서 삭제 중 오류가 발생했습니다.');
    }
  };

  const handleAddJobRole = async () => {
    if (!newJobRoleName.trim()) return;
    try {
      await addDoc(collection(db, 'jobRoles'), {
        name: newJobRoleName.trim(),
        createdAt: new Date().toISOString()
      });
      setNewJobRoleName('');
      toast.success('새 직무가 추가되었습니다.');
    } catch (error) {
      toast.error('직무 추가 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteJobRole = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'jobRoles', id));
      toast.success('직무가 삭제되었습니다.');
    } catch (error) {
      toast.error('직무 삭제 중 오류가 발생했습니다.');
    }
  };

  const handleAddUser = async () => {
    if (!newUser.displayName || !newUser.employeeId) {
      toast.error('이름과 사번은 필수 입력 사항입니다.');
      return;
    }

    try {
      // Create a mock UID for manually added users who haven't logged in yet
      // Or we can just use the employeeId as a temporary UID if needed, 
      // but Firestore addDoc generates a unique ID anyway.
      const userRef = await addDoc(collection(db, 'users'), {
        ...newUser,
        uid: `manual_${Date.now()}`,
        isActive: true,
        departmentName: departments.find(d => d.id === newUser.departmentId)?.name || ''
      });
      
      await updateDoc(doc(db, 'users', userRef.id), { uid: userRef.id });

      setIsAddUserOpen(false);
      setNewUser({
        displayName: '',
        employeeId: '',
        email: '',
        role: 'EMPLOYEE',
        departmentId: '',
        position: '사원',
        jobRole: '',
        workplace: '',
        phoneNumber: '',
        birthDate: '',
        joinedAt: new Date().toISOString().split('T')[0],
        resignedAt: '',
      });
      toast.success('새 임직원이 등록되었습니다.');
    } catch (error) {
      console.error("Error adding user:", error);
      toast.error('임직원 등록 중 오류가 발생했습니다.');
    }
  };

  const handleEditUserSave = async () => {
    if (!editingUser) return;
    try {
      await updateDoc(doc(db, 'users', editingUser.uid), { ...editingUser });
      setIsEditUserOpen(false);
      setEditingUser(null);
      toast.success('직원 정보가 수정되었습니다.');
    } catch (error) {
      toast.error('수정 중 오류가 발생했습니다.');
    }
  };

  const handleGrantCoupon = async () => {
    if (!couponReceiver || !profile) return;
    if (!couponForm.location || !couponForm.reason || !couponForm.time) {
      toast.error('모든 정보를 입력해주세요.');
      return;
    }

    try {
      const couponId = Math.random().toString(36).substring(2, 9);
      const couponData: PraiseCoupon = {
        id: couponId,
        senderUid: profile.uid,
        senderName: profile.displayName,
        senderRole: profile.role,
        receiverUid: couponReceiver.uid,
        receiverName: couponReceiver.displayName,
        date: couponForm.date,
        time: couponForm.time,
        location: couponForm.location,
        reason: couponForm.reason,
        points: couponForm.points,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'praiseCoupons'), couponData);
      
      await updateDoc(doc(db, 'users', couponReceiver.uid), {
        points: increment(couponForm.points)
      });

      await addDoc(collection(db, 'notifications'), {
        uid: couponReceiver.uid,
        title: '칭찬쿠폰이 도착했습니다!',
        message: `${profile.displayName}님께서 "${couponForm.reason}" 사유로 ${couponForm.points}P를 선물하셨습니다.`,
        type: 'COUPON',
        isRead: false,
        createdAt: new Date().toISOString(),
        fromUid: profile.uid,
        fromName: profile.displayName
      });

      toast.success(`${couponReceiver.displayName}님께 칭찬쿠폰을 지급했습니다.`);
      setIsGrantCouponOpen(false);
      setCouponReceiver(null);
      setCouponForm({
        date: new Date().toISOString().split('T')[0], 
        time: new Date().toTimeString().slice(0, 5), 
        location: '', 
        reason: '', 
        points: 1 
      });
    } catch (error) {
      console.error(error);
      toast.error('쿠폰 지급 중 오류가 발생했습니다.');
    }
  };

  const isHRAdmin = profile && (['CEO', 'DIRECTOR', 'GENERAL_AFFAIRS', 'GENERAL_MANAGER', 'CLERK'].includes(profile.role) || profile.permissions?.includes('employee_mgmt'));
  const canManageDept = profile && (['CEO', 'DIRECTOR', 'GENERAL_AFFAIRS', 'GENERAL_MANAGER', 'CLERK'].includes(profile.role) || profile.permissions?.includes('dept_mgmt'));
  const canManageLeave = profile && (['CEO', 'DIRECTOR', 'GENERAL_AFFAIRS', 'GENERAL_MANAGER', 'CLERK'].includes(profile.role) || profile.permissions?.includes('leave_mgmt'));
  const isTeamLeader = profile?.role === 'TEAM_LEADER';

  const exportEmployeesToExcel = () => {
    try {
      const exportData = filteredUsers.map(u => ({
        '부서': u.departmentName || '미지정',
        '직급': u.position || '사원',
        '직무': u.jobRole || '',
        '사번': u.employeeId,
        '이름': u.displayName,
        '연락처': u.phoneNumber || '',
        '권한': ROLE_LABELS[u.role],
        '입사일': u.joinedAt || '',
        '상태': u.isActive ? '재직' : '퇴사',
        '사업장': u.workplace || '',
        '잔여연차': u.annualLeaveBalance || 0
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "직원목록");
      
      const fileName = `직원명부_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      toast.success('사원정보 엑셀 파일이 다운로드되었습니다.');
    } catch (error) {
      console.error("Excel export error:", error);
      toast.error('엑셀 변환 중 오류가 발생했습니다.');
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.displayName.toLowerCase().includes(searchTerm) || 
                         u.employeeId.toLowerCase().includes(searchTerm);
    
    const matchesStatus = statusFilter === 'ALL' || 
                         (statusFilter === 'ACTIVE' && u.isActive) ||
                         (statusFilter === 'RESIGNED' && !u.isActive);

    const matchesDept = deptFilter === 'ALL' || u.departmentId === deptFilter;

    if (isHRAdmin) return matchesSearch && matchesStatus && matchesDept;
    if (isTeamLeader) return matchesSearch && matchesStatus && matchesDept && u.departmentId === profile?.departmentId;
    
    // For regular employees: can see everyone as a directory, but can only edit themselves (handled by canEdit)
    return matchesSearch && matchesStatus && matchesDept;
  });

  return (
    <div className="space-y-8 pb-10">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <div className="w-2 h-6 bg-primary rounded-full" />
          <h2 className="text-3xl font-black tracking-tighter text-white">직원 정보 관리</h2>
        </div>
        <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-[0.2em] ml-4">임직원 정보 조회 및 관리 시스템</p>
      </header>

      <Tabs defaultValue="users" className="w-full flex flex-col">
        <TabsList className="flex w-full bg-white/5 p-1.5 rounded-2xl mb-8 h-12 border border-white/5">
          <TabsTrigger value="users" className="flex-1 flex items-center justify-center gap-2 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-xl data-[state=active]:text-black transition-all text-[10px] font-black h-full uppercase tracking-widest">
            <UserCog className="w-4 h-4" /> {isHRAdmin ? "임직원 관리" : "직원 주소록"}
          </TabsTrigger>
          {(isHRAdmin || isTeamLeader || canManageLeave) && (
            <TabsTrigger value="leave" className="flex-1 flex items-center justify-center gap-2 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-xl data-[state=active]:text-black transition-all text-[10px] font-black h-full uppercase tracking-widest">
              <CalendarRange className="w-4 h-4" /> {isHRAdmin || canManageLeave ? "전체 연차 관리" : "팀원 연차 관리"}
            </TabsTrigger>
          )}
          {canManageDept && (
            <TabsTrigger value="departments" className="flex-1 flex items-center justify-center gap-2 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-xl data-[state=active]:text-black transition-all text-[10px] font-black h-full uppercase tracking-widest">
              <Building2 className="w-4 h-4" /> 부서/팀 설정
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="users" className="space-y-6 outline-none">
          <div className="bg-card rounded-[2rem] shadow-sm border border-white/5 overflow-hidden">
            <div className="p-4 sm:p-6 bg-white/5 border-b border-white/5 space-y-4">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="relative flex-grow group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30 group-focus-within:text-primary transition-colors z-10" />
                  <Input 
                    placeholder="직원 이름 또는 사번 검색..." 
                    className="h-14 pl-12 bg-black/20 border-white/5 focus:border-primary rounded-2xl text-base font-black transition-all text-white placeholder:text-white/20"
                    onChange={(e) => setSearchTerm(e.target.value.toLowerCase())}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                    <SelectTrigger className="w-full sm:w-[130px] h-12 bg-white/5 border-white/5 rounded-2xl font-black text-xs shadow-sm hover:bg-white/10 transition-colors text-white">
                      <div className="flex items-center gap-2">
                        <Filter className="w-3.5 h-3.5 text-white/30" />
                        <SelectValue />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="bg-[#1c1c1e] border-white/5 rounded-xl text-white text-left">
                      <SelectItem value="ALL">전체 상태</SelectItem>
                      <SelectItem value="ACTIVE">재직중</SelectItem>
                      <SelectItem value="RESIGNED">퇴사함</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={deptFilter} onValueChange={setDeptFilter}>
                    <SelectTrigger className="w-full sm:w-[160px] h-12 bg-white/5 border-white/5 rounded-2xl font-black text-xs shadow-sm hover:bg-white/10 transition-colors text-white">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-white/30" />
                        <SelectValue />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="bg-[#1c1c1e] border-white/5 rounded-xl text-white text-left">
                      <SelectItem value="ALL">전체 부서</SelectItem>
                      {departments.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button 
                    variant="outline" 
                    onClick={exportEmployeesToExcel}
                    className="h-12 px-4 gap-2 font-black rounded-2xl border-white/10 bg-white/5 text-white hover:bg-white/10 active:scale-95 transition-all text-xs"
                  >
                    <Download className="w-4 h-4 text-emerald-400" /> 엑셀 다운로드
                  </Button>

                  {isHRAdmin && (
                    <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
                      <DialogTrigger asChild>
                        <Button className="h-12 px-6 gap-2 font-black rounded-2xl shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-95 transition-all text-sm ml-auto lg:ml-0 bg-primary text-white">
                          <Plus className="w-4 h-4" /> 사원 추가
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-card border-white/10 rounded-[2.5rem] shadow-2xl max-w-lg w-[95%] p-0 overflow-hidden flex flex-col max-h-[90dvh] text-white">
                        <DialogHeader className="p-8 pb-4 bg-white/5 border-b border-white/10 text-left shrink-0">
                          <DialogTitle className="text-2xl font-black tracking-tighter text-white">새 사원 등록</DialogTitle>
                          <DialogDescription className="text-white/50 font-bold">임직원의 상세 정보를 입력해주세요.</DialogDescription>
                        </DialogHeader>
                        <div className="p-8 space-y-5 overflow-y-auto flex-grow no-scrollbar">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">이름 *</label>
                              <Input 
                                value={newUser.displayName}
                                onChange={(e) => setNewUser({...newUser, displayName: e.target.value})}
                                placeholder="홍길동"
                                className="h-12 bg-white/5 border-white/10 rounded-xl font-bold text-white placeholder:text-white/20"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">사번 *</label>
                              <Input 
                                value={newUser.employeeId}
                                onChange={(e) => setNewUser({...newUser, employeeId: e.target.value})}
                                placeholder="X12345"
                                className="h-12 bg-white/5 border-white/10 rounded-xl font-bold text-white placeholder:text-white/20"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">생년월일 *</label>
                              <Input 
                                type="date"
                                value={newUser.birthDate}
                                onChange={(e) => setNewUser({...newUser, birthDate: e.target.value})}
                                className="h-12 bg-white/5 border-white/10 rounded-xl font-bold text-white"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">입사일 *</label>
                              <Input 
                                type="date"
                                value={newUser.joinedAt}
                                onChange={(e) => setNewUser({...newUser, joinedAt: e.target.value})}
                                className="h-12 bg-white/5 border-white/10 rounded-xl font-bold text-white"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">이메일</label>
                            <Input 
                              value={newUser.email}
                              onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                              placeholder="example@email.com"
                              className="h-12 bg-white/5 border-white/10 rounded-xl font-bold text-white placeholder:text-white/20"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">직위</label>
                              <Select value={newUser.position} onValueChange={(v) => setNewUser({...newUser, position: v})}>
                                <SelectTrigger className="h-12 bg-white/5 border-white/10 rounded-xl font-bold text-left text-white">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-[#1c1c1e] border-white/10 rounded-xl text-white text-left">
                                  {POSITIONS.map(pos => (
                                    <SelectItem key={pos} value={pos} className="font-bold">{pos}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">직무</label>
                              <Select value={newUser.jobRole} onValueChange={(v) => setNewUser({...newUser, jobRole: v})}>
                                <SelectTrigger className="h-12 bg-white/5 border-white/10 rounded-xl font-bold text-left text-white">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-[#1c1c1e] border-white/10 rounded-xl text-white text-left">
                                  {jobRoles.map(jr => (
                                    <SelectItem key={jr.id} value={jr.name} className="font-bold">{jr.name}</SelectItem>
                                  ))}
                                  {jobRoles.length === 0 && <SelectItem value="기타" className="font-bold">기타</SelectItem>}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">부서</label>
                              <Select value={newUser.departmentId} onValueChange={(v) => {
                                setNewUser({...newUser, departmentId: v});
                              }}>
                                <SelectTrigger className="h-12 bg-white/5 border-white/10 rounded-xl font-bold text-left text-white">
                                  <SelectValue placeholder="부서 선택" />
                                </SelectTrigger>
                                <SelectContent className="bg-[#1c1c1e] border-white/10 rounded-xl text-white text-left">
                                  {departments.length > 0 ? departments.map(dept => (
                                    <SelectItem key={dept.id} value={dept.id} className="font-bold">{dept.name}</SelectItem>
                                  )) : (
                                    <div className="p-2 text-xs text-white/30 text-center">등록된 부서가 없습니다.</div>
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">권한</label>
                              <Select value={newUser.role} onValueChange={(v) => setNewUser({...newUser, role: v as Role})}>
                                <SelectTrigger className="h-12 bg-white/5 border-white/10 rounded-xl font-bold text-left text-white">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-[#1c1c1e] border-white/10 rounded-xl text-white text-left">
                                  {ROLES.map(role => (
                                    <SelectItem key={role} value={role} className="font-bold">{ROLE_LABELS[role]}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">연락처</label>
                              <Input 
                                value={newUser.phoneNumber}
                                onChange={(e) => setNewUser({...newUser, phoneNumber: e.target.value})}
                                placeholder="010-0000-0000"
                                className="h-12 bg-white/5 border-white/10 rounded-xl font-bold text-white placeholder:text-white/20"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">사업장</label>
                            <Input 
                              value={newUser.workplace}
                              onChange={(e) => setNewUser({...newUser, workplace: e.target.value})}
                              placeholder="울산조선소"
                              className="h-12 bg-white/5 border-white/10 rounded-xl font-bold text-white placeholder:text-white/20"
                            />
                          </div>
                        </div>
                        <DialogFooter className="p-8 pt-4 bg-white/5 border-t border-white/10 flex flex-row gap-3 min-h-[100px]">
                          <Button variant="outline" className="flex-1 h-12 rounded-xl font-black border-white/10 bg-white/5 text-white" onClick={() => setIsAddUserOpen(false)}>취소</Button>
                          <Button className="flex-1 h-12 rounded-xl font-black shadow-lg shadow-primary/20 bg-primary text-white" onClick={handleAddUser}>등록 완료</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-6 space-y-3">
              {filteredUsers.length > 0 ? filteredUsers.map((user) => {
                const isSelf = profile?.uid === user.uid;
                const canEdit = isHRAdmin || isSelf;

                return (
                  <Card 
                    key={user.uid} 
                    className={cn(
                      "border-none shadow-sm bg-white/5 rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-all hover:bg-white/10 border border-white/5",
                      isSelf && "ring-2 ring-primary/20",
                      !user.isActive && "opacity-40"
                    )}
                    onClick={() => {
                      if (canEdit) {
                        setEditingUser({ ...user });
                        setIsEditUserOpen(true);
                      } else {
                        toast.info('본인의 정보만 수정할 수 있습니다.');
                      }
                    }}
                  >
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-white/30 font-black text-lg">
                          {user.displayName.charAt(0)}
                        </div>
                        <div className="space-y-1 text-left">
                          <div className="font-black text-lg text-white tracking-tighter leading-none flex items-center gap-2">
                            {user.displayName}
                            {isSelf && <Badge variant="outline" className="text-[8px] h-4 font-black bg-primary/20 text-primary border-primary/30">나</Badge>}
                            {!user.isActive && <span className="text-[10px] text-white/30 font-bold">(퇴사)</span>}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[10px] font-black text-white/30 uppercase tracking-widest">{user.employeeId}</span>
                            <Badge variant="secondary" className="bg-white/5 text-white/60 text-[9px] font-bold px-1.5 h-5">{user.position}</Badge>
                            {user.jobRole && <Badge variant="outline" className="text-[9px] font-bold px-1.5 h-5 border-white/10 text-white/40">{user.jobRole}</Badge>}
                            {(profile?.role === 'CEO' || profile?.role === 'SAFETY_MANAGER') && (
                              <Button 
                                variant="ghost" 
                                size="xs" 
                                className="h-6 text-[10px] font-black px-2 gap-1.5 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg shadow-sm border border-emerald-500/20 active:scale-95 transition-all"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCouponReceiver(user);
                                  setIsGrantCouponOpen(true);
                                }}
                              >
                                <Gift className="w-3 h-3" />
                                칭찬쿠폰
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                      {isHRAdmin && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="w-8 h-8 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteId(user.uid);
                            setDeleteName(user.displayName);
                            setIsDeleteConfirmOpen(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              }) : (
                <div className="py-20 flex flex-col items-center justify-center opacity-20">
                  <Users className="w-16 h-16 mb-4 text-white" />
                  <p className="font-black text-lg text-white">검색 결과가 없습니다</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="leave" className="space-y-6 outline-none">
          <Card className="border-none shadow-sm bg-card rounded-3xl overflow-hidden border border-white/5">
            <CardHeader className="p-6 border-b border-white/5 bg-white/5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-black tracking-tight flex items-center gap-2 text-white">
                  <CalendarRange className="w-5 h-5 text-primary" /> 전 사원 연차 관리
                </CardTitle>
                <div className="text-[10px] font-black text-white/30 uppercase tracking-widest">
                  총 {users.length}명
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-white/5">
                    <TableRow className="border-white/5 hover:bg-transparent">
                      <TableHead className="text-[10px] font-black text-muted-foreground uppercase tracking-widest py-4">사번</TableHead>
                      <TableHead className="text-[10px] font-black text-muted-foreground uppercase tracking-widest py-4">이름</TableHead>
                      <TableHead className="text-[10px] font-black text-muted-foreground uppercase tracking-widest py-4">부서</TableHead>
                      <TableHead className="text-[10px] font-black text-muted-foreground uppercase tracking-widest py-4">직위</TableHead>
                      <TableHead className="text-[10px] font-black text-muted-foreground uppercase tracking-widest py-4 w-[150px]">잔여 연차 (일)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers
                      .sort((a, b) => a.displayName.localeCompare(b.displayName))
                      .map((user) => (
                        <TableRow key={user.uid} className="border-white/5 hover:bg-white/5 transition-colors">
                          <TableCell className="font-mono text-[11px] font-black text-white/30">{user.employeeId}</TableCell>
                          <TableCell className="font-black text-white">{user.displayName}</TableCell>
                          <TableCell className="text-xs font-bold text-muted-foreground">{user.departmentName || '-'}</TableCell>
                          <TableCell className="text-xs font-bold text-muted-foreground">{user.position || '-'}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Input 
                                type="number"
                                step="0.5"
                                defaultValue={user.annualLeaveBalance || 0}
                                onBlur={(e) => handleLeaveBalanceChange(user.uid, e.target.value)}
                                disabled={!isHRAdmin}
                                className="h-9 w-24 bg-black/20 border-white/5 text-xs font-black rounded-lg text-center disabled:opacity-50 text-white"
                              />
                              <span className="text-[10px] font-black text-white/30">일</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {isHRAdmin && (
        <TabsContent value="departments" className="space-y-8 outline-none">
          <div className="grid lg:grid-cols-2 gap-8">
            <Card className="border-none shadow-sm bg-card rounded-2xl overflow-hidden border border-white/5">
              <CardHeader className="pb-4 pt-6 px-6 bg-white/5 border-b border-white/5">
                <CardTitle className="text-base font-black tracking-tight flex items-center gap-2 text-white">
                  <Plus className="w-4 h-4 text-primary" /> 새 부서 추가
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">부서/팀 명칭</label>
                  <Input 
                    placeholder="예: 생산1팀, 품질관리부" 
                    value={newDeptName}
                    onChange={(e) => setNewDeptName(e.target.value)}
                    className="h-12 text-sm border-white/5 bg-black/20 rounded-xl focus:ring-primary/20 font-bold text-white placeholder:text-white/20"
                  />
                </div>
                <Button className="w-full h-12 gap-2 font-black text-sm rounded-xl shadow-lg active:scale-[0.98] transition-all bg-primary text-white" onClick={handleAddDept}>
                  부서 생성하기
                </Button>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-card rounded-2xl overflow-hidden border border-white/5">
              <CardHeader className="pb-4 pt-6 px-6 bg-white/5 border-b border-white/5">
                <CardTitle className="text-base font-black tracking-tight flex items-center gap-2 text-emerald-500">
                  <Plus className="w-4 h-4 text-emerald-500" /> 새 직무 추가
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">직무 명칭</label>
                  <Input 
                    placeholder="예: 용접, 사상, 취부" 
                    value={newJobRoleName}
                    onChange={(e) => setNewJobRoleName(e.target.value)}
                    className="h-12 text-sm border-white/5 bg-black/20 rounded-xl focus:ring-primary/20 font-bold text-white placeholder:text-white/20"
                  />
                </div>
                <Button className="w-full h-12 gap-2 font-black text-sm rounded-xl shadow-lg active:scale-[0.98] transition-all bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleAddJobRole}>
                  직무 생성하기
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">부서 목록 ({departments.length})</h3>
                <div className="h-px flex-1 bg-white/5 ml-4" />
              </div>
              
              <div className="grid gap-3">
                {departments.map((dept) => (
                  <Card key={dept.id} className="border-none shadow-sm bg-white/5 rounded-2xl border border-white/5">
                    <CardContent className="p-5 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-white/30">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-black text-white tracking-tight">{dept.name}</div>
                          <div className="text-[10px] text-muted-foreground font-bold">
                            현재 인원: <span className="text-primary">{users.filter(u => u.departmentId === dept.id).length}명</span>
                          </div>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="w-10 h-10 rounded-xl text-white/20 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                        onClick={() => handleDeleteDept(dept.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
                {departments.length === 0 && (
                  <div className="py-10 text-center text-white/30 text-xs font-bold border border-dashed border-white/10 rounded-2xl bg-white/5">
                    등록된 부서가 없습니다.
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">직무 목록 ({jobRoles.length})</h3>
                <div className="h-px flex-1 bg-white/5 ml-4" />
              </div>
              
              <div className="grid gap-3">
                {jobRoles.map((jr) => (
                  <Card key={jr.id} className="border-none shadow-sm bg-white/5 rounded-2xl border border-white/5">
                    <CardContent className="p-5 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500">
                          <UserCog className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-black text-white tracking-tight">{jr.name}</div>
                          <div className="text-[10px] text-muted-foreground font-bold">
                            해당 사원: <span className="text-emerald-500">{users.filter(u => u.jobRole === jr.name).length}명</span>
                          </div>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="w-10 h-10 rounded-xl text-white/20 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                        onClick={() => handleDeleteJobRole(jr.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
                {jobRoles.length === 0 && (
                  <div className="py-10 text-center text-white/30 text-xs font-bold border border-dashed border-white/10 rounded-2xl bg-white/5">
                    등록된 직무가 없습니다.
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>
        )}
      </Tabs>

      <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
        <DialogContent className="bg-card border-none rounded-[2rem] shadow-2xl max-w-lg w-[95%] p-0 overflow-hidden flex flex-col max-h-[90dvh] text-white">
          <DialogHeader className="p-8 pb-4 bg-white/5 border-b border-white/5 shrink-0">
            <DialogTitle className="text-2xl font-black tracking-tighter text-white">정보 수정</DialogTitle>
            <DialogDescription className="text-muted-foreground font-bold">{editingUser?.displayName} 사원의 정보를 수정합니다.</DialogDescription>
          </DialogHeader>
          <div className="p-8 space-y-6 overflow-y-auto flex-grow no-scrollbar">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">이름</label>
                <Input 
                  value={editingUser?.displayName || ''}
                  onChange={(e) => setEditingUser(prev => prev ? {...prev, displayName: e.target.value} : null)}
                  className="h-12 bg-white/5 border-white/5 rounded-xl font-bold text-white placeholder:text-white/20"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">사번</label>
                <Input 
                  value={editingUser?.employeeId || ''}
                  disabled
                  className="h-12 bg-white/5 border-white/5 rounded-xl font-bold opacity-50 text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">소속 부서</label>
                <Select 
                  value={editingUser?.departmentId || 'none'} 
                  onValueChange={(v) => {
                    const dept = departments.find(d => d.id === v);
                    setEditingUser(prev => prev ? {...prev, departmentId: v, departmentName: dept?.name || ''} : null);
                  }}
                  disabled={!isHRAdmin}
                >
                  <SelectTrigger className="h-12 bg-white/5 border-white/5 rounded-xl font-bold text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1c1c1e] rounded-xl border-white/5 text-white">
                    <SelectItem value="none">미지정</SelectItem>
                    {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">직위</label>
                <Select 
                  value={editingUser?.position || '사원'} 
                  onValueChange={(v) => setEditingUser(prev => prev ? {...prev, position: v} : null)}
                  disabled={!isHRAdmin}
                >
                  <SelectTrigger className="h-12 bg-white/5 border-white/5 rounded-xl font-bold text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1c1c1e] rounded-xl border-white/5 text-white">
                    {POSITIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">직무</label>
                <Select 
                  value={editingUser?.jobRole || '기타'} 
                  onValueChange={(v) => setEditingUser(prev => prev ? {...prev, jobRole: v} : null)}
                  disabled={!isHRAdmin}
                >
                  <SelectTrigger className="h-12 bg-white/5 border-white/5 rounded-xl font-bold text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1c1c1e] rounded-xl border-white/5 text-white">
                    {jobRoles.map(jr => <SelectItem key={jr.id} value={jr.name}>{jr.name}</SelectItem>)}
                    {jobRoles.length === 0 && DEFAULT_JOB_ROLES.map(jr => <SelectItem key={jr} value={jr}>{jr}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">연락처</label>
                <Input 
                  value={editingUser?.phoneNumber || ''}
                  onChange={(e) => setEditingUser(prev => prev ? {...prev, phoneNumber: e.target.value} : null)}
                  placeholder="010-0000-0000"
                  className="h-12 bg-white/5 border-white/5 rounded-xl font-bold text-white placeholder:text-white/20"
                />
              </div>
            </div>

            {isHRAdmin && (
              <div className="space-y-4 pt-4 border-t border-white/5">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">상세 권한 설정</label>
                <div className="grid grid-cols-2 gap-3">
                  {PERMISSIONS.map((perm) => (
                    <div 
                      key={perm.id} 
                      onClick={() => {
                        if (!editingUser) return;
                        const currentPerms = editingUser.permissions || [];
                        const newPerms = currentPerms.includes(perm.id)
                          ? currentPerms.filter(p => p !== perm.id)
                          : [...currentPerms, perm.id];
                        setEditingUser({...editingUser, permissions: newPerms});
                      }}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer",
                        (editingUser?.permissions || []).includes(perm.id)
                          ? "bg-primary/5 border-primary text-primary"
                          : "bg-white/5 border-white/5 text-white/30 hover:border-white/10"
                      )}
                    >
                      <div className={cn(
                        "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all",
                        (editingUser?.permissions || []).includes(perm.id)
                          ? "bg-primary border-primary text-white"
                          : "border-white/10 text-transparent"
                      )}>
                        <CheckCircle2 className="w-3 h-3" />
                      </div>
                      <span className="text-xs font-black">{perm.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="p-8 pt-4 bg-white/5 border-t border-white/5 flex flex-row gap-3 shadow-2xl">
            <Button variant="outline" className="flex-1 h-12 rounded-xl font-black border-white/10 bg-white/5 text-white" onClick={() => setIsEditUserOpen(false)}>취소</Button>
            <Button className="flex-1 h-12 rounded-xl font-black shadow-lg bg-primary text-white" onClick={handleEditUserSave}>저장하기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="bg-card border-none rounded-[2rem] shadow-2xl max-w-sm w-[90%] p-8 overflow-hidden text-white">
          <DialogHeader className="items-center text-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mb-4">
              <Trash2 className="w-8 h-8 text-red-500" />
            </div>
            <DialogTitle className="text-xl font-black text-white">정보 삭제 확인</DialogTitle>
            <DialogDescription className="text-muted-foreground font-bold whitespace-pre-wrap">
              {deleteName} 사원의 모든 정보를 삭제하시겠습니까? {"\n"}이 작업은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-3 mt-6">
            <Button variant="outline" className="flex-1 h-12 rounded-xl font-black border-white/10 bg-white/5 text-white" onClick={() => setIsDeleteConfirmOpen(false)}>취소</Button>
            <Button 
              className="flex-1 h-12 rounded-xl font-black bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20" 
              onClick={() => {
                if (deleteId) {
                  handleDeleteUser(deleteId);
                  setIsDeleteConfirmOpen(false);
                }
              }}
            >
              삭제하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isGrantCouponOpen} onOpenChange={setIsGrantCouponOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden bg-card border-none rounded-3xl shadow-2xl flex flex-col max-h-[90dvh] w-[95%] text-white border border-white/5">
          <DialogHeader className="p-8 pb-4 bg-emerald-500/5 shrink-0 border-b border-white/5">
            <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/20">
              <Gift className="w-6 h-6 text-white" />
            </div>
            <DialogTitle className="text-2xl font-black tracking-tighter text-white">
              칭찬 쿠폰 지급
            </DialogTitle>
            <DialogDescription className="text-sm font-bold text-muted-foreground">
              {couponReceiver?.displayName} 사원에게 칭찬과 포인트를 선물합니다.
            </DialogDescription>
          </DialogHeader>
          
          <div className="p-8 space-y-4 overflow-y-auto flex-grow no-scrollbar">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">날짜</label>
                <Input 
                  type="date"
                  value={couponForm.date}
                  onChange={(e) => setCouponForm({...couponForm, date: e.target.value})}
                  className="h-12 bg-white/5 border-white/5 rounded-xl font-bold text-white"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">시간</label>
                <Input 
                  type="time"
                  value={couponForm.time}
                  onChange={(e) => setCouponForm({...couponForm, time: e.target.value})}
                  className="h-12 bg-white/5 border-white/5 rounded-xl font-bold text-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">발생 장소</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                <Input 
                  placeholder="예: 제1공장 용접실"
                  value={couponForm.location}
                  onChange={(e) => setCouponForm({...couponForm, location: e.target.value})}
                  className="h-12 pl-12 bg-white/5 border-white/5 rounded-xl font-bold text-white placeholder:text-white/20"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">칭찬 사유</label>
              <textarea 
                placeholder="어떤 칭찬을 해주고 싶으신가요?"
                value={couponForm.reason}
                onChange={(e) => setCouponForm({...couponForm, reason: e.target.value})}
                className="w-full min-h-[100px] p-4 bg-white/5 border border-white/5 rounded-xl font-bold text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 text-white placeholder:text-white/20"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">포인트 (1P = 5,000원)</label>
              <Select 
                value={String(couponForm.points)} 
                onValueChange={(v) => setCouponForm({...couponForm, points: parseInt(v)})}
              >
                <SelectTrigger className="h-12 bg-white/5 border-white/5 rounded-xl font-black text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1c1c1e] rounded-xl border-white/5 text-white">
                  <SelectItem value="1">1 P (5,000원)</SelectItem>
                  <SelectItem value="2">2 P (10,000원)</SelectItem>
                  <SelectItem value="3">3 P (15,000원)</SelectItem>
                  <SelectItem value="5">5 P (25,000원)</SelectItem>
                  <SelectItem value="10">10 P (50,000원)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="p-8 pt-4 bg-white/5 border-t border-white/5 flex flex-row gap-3">
            <Button variant="outline" className="flex-1 h-12 rounded-xl font-black border-white/5 bg-white/5 text-white" onClick={() => setIsGrantCouponOpen(false)}>취소</Button>
            <Button className="flex-1 h-12 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black shadow-lg shadow-emerald-500/20" onClick={handleGrantCoupon}>쿠폰 지급하기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
