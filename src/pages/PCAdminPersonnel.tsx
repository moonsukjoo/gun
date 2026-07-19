import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { collection, query, getDocs, orderBy, doc, updateDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile } from '../types';
import PCAdminLayout from '../components/PCAdminLayout';
import { 
  Search, 
  Filter, 
  UserPlus, 
  MoreHorizontal, 
  Edit3, 
  Trash2, 
  Download,
  Mail,
  Phone,
  Building2,
  Calendar,
  ShieldCheck,
  UserCheck,
  MoreVertical,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

const PCAdminPersonnel: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const isPermissionTabActive = searchParams.get('tab') === 'permissions';

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [positions, setPositions] = useState<string[]>([
    '대표', '실장', '총무', '서무', '안전관리자', '소장', '팀장', '직장', '조장', '반장', '사원'
  ]);
  const [departments, setDepartments] = useState<any[]>([
    { id: 'dept_ship', name: '함정선체생산부' },
    { id: 'dept_mid', name: '중형선선체조립부' }
  ]);
  const [jobRoles, setJobRoles] = useState<any[]>([
    { id: 'job_0', name: '취부' },
    { id: 'job_1', name: '용접' },
    { id: 'job_2', name: '사상' },
    { id: 'job_3', name: '도장' },
    { id: 'job_4', name: '반장' },
    { id: 'job_5', name: '조장' },
    { id: 'job_6', name: '기타' }
  ]);
  const [workplaces, setWorkplaces] = useState<any[]>([
    { id: 'wp_0', name: '함정선체생산부' },
    { id: 'wp_1', name: '중형선선체조립부' },
    { id: 'wp_2', name: '기타' }
  ]);

  useEffect(() => {
    fetchUsers();
    fetchPositions();
    fetchDepartments();
    fetchJobRoles();
    fetchWorkplaces();
  }, []);

  const fetchDepartments = async () => {
    try {
      const q = query(collection(db, 'departments'));
      const snapshot = await getDocs(q);
      const defaults = [
        { id: 'dept_ship', name: '함정선체생산부' },
        { id: 'dept_mid', name: '중형선선체조립부' }
      ];
      if (!snapshot.empty) {
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setDepartments(list);
      } else {
        setDepartments(defaults);
      }
    } catch (e) {
      console.error('Error fetching departments:', e);
    }
  };

  const fetchJobRoles = async () => {
    try {
      const q = query(collection(db, 'jobRoles'));
      const snapshot = await getDocs(q);
      const defaults = ['취부', '용접', '사상', '도장', '반장', '조장', '기타'].map((name, i) => ({ id: `job_${i}`, name }));
      if (!snapshot.empty) {
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setJobRoles(list);
      } else {
        setJobRoles(defaults);
      }
    } catch (e) {
      console.error('Error fetching jobRoles:', e);
    }
  };

  const fetchWorkplaces = async () => {
    try {
      const q = query(collection(db, 'workplaces'));
      const snapshot = await getDocs(q);
      const defaults = ['함정선체생산부', '중형선선체조립부', '기타'].map((name, i) => ({ id: `wp_${i}`, name }));
      if (!snapshot.empty) {
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setWorkplaces(list);
      } else {
        setWorkplaces(defaults);
      }
    } catch (e) {
      console.error('Error fetching workplaces:', e);
    }
  };

  const fetchPositions = async () => {
    try {
      const q = query(collection(db, 'positions'));
      const snapshot = await getDocs(q);
      const defaults = ['대표', '실장', '총무', '서무', '안전관리자', '소장', '팀장', '직장', '조장', '반장', '사원'];
      if (!snapshot.empty) {
        const dbNames = snapshot.docs.map(doc => doc.data().name as string);
        const merged = Array.from(new Set([...defaults, ...dbNames]));
        setPositions(merged);
      } else {
        setPositions(defaults);
      }
    } catch (e) {
      console.error('Error fetching positions:', e);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'users'), orderBy('displayName', 'asc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setUsers(data);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'users');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      (user.displayName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.phoneNumber?.includes(searchTerm);
    
    if (selectedRole === 'all') return matchesSearch;
    // Fitler by actual user position string
    return matchesSearch && user.position === selectedRole;
  });

  const getPositionBadge = (pos: string) => {
    const pValue = pos || '사원';
    const positionStyles: Record<string, { label: string, color: string }> = {
      '대표': { label: '대표', color: 'bg-rose-500/10 text-rose-500 border-rose-500/20' },
      '사장': { label: '사장', color: 'bg-rose-500/10 text-rose-500 border-rose-500/20' },
      '실장': { label: '실장', color: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' },
      '총무': { label: '총무', color: 'bg-pink-500/10 text-pink-500 border-pink-500/20' },
      '서무': { label: '서무', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
      '소장': { label: '소장', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
      '팀장': { label: '팀장', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
      '직장': { label: '직장', color: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20' },
      '조장': { label: '조장', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
      '반장': { label: '반장', color: 'bg-teal-500/10 text-teal-500 border-teal-500/20' },
      '안전관리자': { label: '안전관리자', color: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
      '사원': { label: '사원', color: 'bg-muted text-muted-foreground border-border' },
    };
    
    const matched = Object.entries(positionStyles).find(([k]) => pValue.includes(k));
    const r = matched ? matched[1] : { label: pValue, color: 'bg-muted text-muted-foreground border-border' };
    return <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${r.color}`}>{r.label}</span>;
  };

  const getMappedRole = (pos: string): string => {
    if (!pos) return 'WORKER';
    if (pos.includes('대표') || pos.includes('사장')) return 'CEO';
    if (pos.includes('소장')) return 'DIRECTOR';
    if (pos.includes('실장')) return 'GENERAL_MANAGER';
    if (pos.includes('안전관리자') || pos.includes('안전')) return 'SAFETY_MANAGER';
    if (pos.includes('팀장')) return 'TEAM_LEADER';
    if (pos.includes('총무') || pos.includes('서무')) return 'CLERK';
    return 'WORKER';
  };

  const getRoleBadge = (role: string) => {
    const roles: Record<string, { label: string, color: string }> = {
      'CEO': { label: '대표이사', color: 'bg-rose-500/10 text-rose-500 border-rose-500/20' },
      'DIRECTOR': { label: '상무/이사', color: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
      'GENERAL_MANAGER': { label: '부장/현장소장', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
      'SAFETY_MANAGER': { label: '안전팀장', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
      'TEAM_LEADER': { label: '현장관제사', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
      'WORKER': { label: '작업자', color: 'bg-muted text-muted-foreground border-border' },
    };
    const r = roles[role] || { label: role, color: 'bg-muted text-muted-foreground border-border' };
    return <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${r.color}`}>{r.label}</span>;
  };

  const getStatusBadge = (user: UserProfile) => {
    const status = user.status || (user.isActive ? 'ACTIVE' : 'RETIRED');
    
    if (status === 'ACTIVE') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 text-emerald-500 rounded-lg text-[10px] font-black border border-emerald-500/20">
          <UserCheck className="w-3 h-3" />
          재직 중
        </span>
      );
    } else if (status === 'ON_LEAVE') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 text-amber-500 rounded-lg text-[10px] font-black border border-amber-500/20">
          <Calendar className="w-3 h-3" />
          휴직 중
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-muted text-muted-foreground rounded-lg text-[10px] font-black border border-border">
          <Trash2 className="w-3 h-3" />
          퇴직
        </span>
      );
    }
  };

  const handleUpdateStatus = async (uid: string, newStatus: string) => {
    try {
      const isActive = newStatus === 'ACTIVE' || newStatus === 'ON_LEAVE';
      await updateDoc(doc(db, 'users', uid), { 
        status: newStatus,
        isActive: isActive
      });
      toast.success('상태가 변경되었습니다.');
      fetchUsers();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('변경 중 오류가 발생했습니다.');
    }
  };

  const handleUpdateRole = async (uid: string, newRole: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), { role: newRole });
      toast.success('직책이 변경되었습니다.');
      fetchUsers();
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('변경 중 오류가 발생했습니다.');
    }
  };

  const handleExportExcel = () => {
    try {
      const exportData = filteredUsers.map((u, idx) => ({
        'No': idx + 1,
        '이름': u.displayName,
        '이메일': u.email || '-',
        '전화번호': u.phoneNumber || '-',
        '직위': u.position || '사원',
        '직무': u.jobRole || '기타',
        '부서': u.departmentName || '-',
        '사업장': u.workplace || '-',
        '상태': u.status || 'ACTIVE'
      }));
      import('../lib/exportUtils').then(module => {
        module.exportToExcel(exportData, `임직원목록_${new Date().toISOString().split('T')[0]}`, '임직원');
      });
      toast.success('사원정보 엑셀 파일이 다운로드되었습니다.');
    } catch (error) {
      console.error("Excel export error:", error);
      toast.error('엑셀 변환 중 오류가 발생했습니다.');
    }
  };

  return (
    <PCAdminLayout title={isPermissionTabActive ? "사용자 권한 관리" : "임직원 정보 관리"}>
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Top Actions Bar */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-card p-6 rounded-[2rem] shadow-sm border border-border text-foreground">
          <div className="flex items-center gap-4 w-full md:w-auto flex-1 max-w-xl">
            <div className="relative w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="이름, 이메일, 전화번호로 검색..."
                className="w-full pl-12 pr-4 py-3 bg-muted border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/10 transition-all border border-transparent focus:border-primary/20 text-foreground"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select 
              className="bg-muted border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/10 cursor-pointer text-foreground"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
            >
              <option value="all" className="bg-card text-foreground">전체 직위</option>
              {positions.map(pos => (
                <option key={pos} value={pos} className="bg-card text-foreground">{pos}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button 
              onClick={handleExportExcel}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-muted border border-border rounded-2xl font-black text-sm hover:bg-muted/80 transition-all text-foreground"
            >
              <Download className="w-4 h-4" />
              엑셀 다운로드
            </button>
            <button 
              onClick={() => {
                setEditingUser({
                  uid: '',
                  displayName: '',
                  employeeId: '',
                  email: '',
                  phoneNumber: '',
                  birthDate: '',
                  joinedAt: new Date().toISOString().split('T')[0],
                  position: '사원',
                  role: 'WORKER',
                  status: 'ACTIVE',
                  isActive: true,
                  departmentId: departments[0]?.id || '',
                  departmentName: departments[0]?.name || '',
                  jobRole: jobRoles[0]?.name || '기타',
                  workplace: workplaces[0]?.name || '',
                  permissions: []
                });
                setIsEditModalOpen(true);
              }}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-2xl font-black text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
            >
              <UserPlus className="w-4 h-4" />
              임직원 등록
            </button>
          </div>
        </div>

        {/* Tab Sub-Navigation Bar */}
        <div className="flex bg-card p-1.5 rounded-2xl border border-border shadow-sm max-w-sm shrink-0 text-foreground">
          <button 
            onClick={() => navigate('/admin/pc/personnel')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all ${
              !isPermissionTabActive 
                ? 'bg-primary text-primary-foreground shadow-md font-black' 
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            }`}
          >
            임직원 신상 명부
          </button>
          <button 
            onClick={() => navigate('/admin/pc/personnel?tab=permissions')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all ${
              isPermissionTabActive 
                ? 'bg-primary text-primary-foreground shadow-md font-black' 
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            }`}
          >
            모듈별 권한 설정
          </button>
        </div>

        {/* Users Table */}
        <div className="bg-card rounded-[2.5rem] border border-border shadow-sm overflow-hidden text-foreground">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                {isPermissionTabActive ? (
                  <tr className="bg-muted/30 border-b border-border">
                    <th className="px-8 py-5 text-[11px] font-black text-muted-foreground uppercase tracking-widest text-center w-16">No.</th>
                    <th className="px-6 py-5 text-[11px] font-black text-muted-foreground uppercase tracking-widest">사용자 정보</th>
                    <th className="px-6 py-5 text-[11px] font-black text-muted-foreground uppercase tracking-widest text-center">직책</th>
                    <th className="px-6 py-5 text-[11px] font-black text-muted-foreground uppercase tracking-widest">부여된 시스템 세부 모듈 제어 권한</th>
                    <th className="px-6 py-5 text-[11px] font-black text-muted-foreground uppercase tracking-widest text-center">활성 상태</th>
                    <th className="px-6 py-5 text-[11px] font-black text-muted-foreground uppercase tracking-widest text-right">상세 권한 조정</th>
                  </tr>
                ) : (
                  <tr className="bg-muted/30 border-b border-border">
                    <th className="px-8 py-5 text-[11px] font-black text-muted-foreground uppercase tracking-widest text-center w-16">No.</th>
                    <th className="px-6 py-5 text-[11px] font-black text-muted-foreground uppercase tracking-widest">사용자 정보</th>
                    <th className="px-6 py-5 text-[11px] font-black text-muted-foreground uppercase tracking-widest text-center">직책</th>
                    <th className="px-6 py-5 text-[11px] font-black text-muted-foreground uppercase tracking-widest">부서 / 현장</th>
                    <th className="px-6 py-5 text-[11px] font-black text-muted-foreground uppercase tracking-widest text-center">활성 상태</th>
                    <th className="px-6 py-5 text-[11px] font-black text-muted-foreground uppercase tracking-widest text-right">관리</th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                   [...Array(5)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={6} className="h-20 bg-muted/10" />
                    </tr>
                   ))
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-20 text-center text-muted-foreground font-bold">임직원 데이터가 없습니다.</td>
                  </tr>
                ) : (
                  filteredUsers.map((user, idx) => (
                    <tr key={user.uid} className="hover:bg-muted/30 transition-colors group">
                      <td className="px-8 py-5 text-xs font-black text-muted-foreground text-center">{idx + 1}</td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-muted rounded-xl overflow-hidden border border-border shrink-0">
                             <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} alt="profile" />
                          </div>
                          <div>
                            <p className="text-sm font-black text-foreground leading-none mb-1.5">{user.displayName}</p>
                            <div className="flex items-center gap-4 text-[11px] font-bold text-muted-foreground">
                              <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {user.email || '-'}</span>
                              <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {user.phoneNumber || '-'}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                        {getPositionBadge(user.position || '사원')}
                      </td>
                      {isPermissionTabActive ? (
                        <>
                          <td className="px-6 py-5">
                            <div className="flex flex-wrap gap-1.5 max-w-md">
                              {(!user.permissions || user.permissions.length === 0) ? (
                                <span className="text-xs text-muted-foreground italic font-medium">일반 기능 제한 계정</span>
                              ) : (
                                user.permissions.map((p: string) => {
                                  const labels: Record<string, string> = {
                                    'admin': '최고관리자',
                                    'employee_mgmt': '임직원관리',
                                    'leave_mgmt': '연차결재',
                                    'redemption_mgmt': '현물지급',
                                    'attendance_mgmt': '근태조정',
                                    'high_work_monitor': '고소작업',
                                    'payslip_mgmt': '급여명세서',
                                    'qualification_mgmt': '보건자격',
                                    'training_mgmt': '기본교육',
                                    'statutory_training_mgmt': '정기교육',
                                  };
                                  return (
                                    <span key={p} className="px-2 py-0.5 bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-[0.5rem] text-[10px] font-black uppercase tracking-tight">
                                      {labels[p] || p}
                                    </span>
                                  );
                                })
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-5 text-center">
                             {getStatusBadge(user)}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-6 py-5">
                            <div className="flex flex-col gap-1 text-xs font-bold text-muted-foreground">
                              <div className="flex items-center gap-1.5 text-foreground font-black">
                                <Building2 className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                                <span className="truncate">{user.workplace || '미정 사업장'}</span>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-[10px] pl-5 text-muted-foreground font-medium">
                                <span>부서: {user.departmentName || '미지정'}</span>
                                <span className="w-1 h-1 rounded-full bg-muted-foreground/30 shrink-0" />
                                <span>직무: {user.jobRole || '기타'}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-center">
                             {getStatusBadge(user)}
                          </td>
                        </>
                      )}
                      <td className="px-8 py-5 text-right">
                        <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                           <select 
                             className="text-[10px] font-black bg-muted border border-border rounded-lg px-2 py-1 cursor-pointer focus:ring-1 focus:ring-primary text-foreground"
                             value={user.status || (user.isActive ? 'ACTIVE' : 'RETIRED')}
                             onChange={(e) => handleUpdateStatus(user.uid, e.target.value)}
                           >
                             <option value="ACTIVE">재직 중</option>
                             <option value="ON_LEAVE">휴직 중</option>
                             <option value="RETIRED">퇴직</option>
                           </select>
                           <button 
                             onClick={() => {
                               setEditingUser(user);
                               setIsEditModalOpen(true);
                             }}
                             className="p-2 hover:bg-card hover:shadow-md rounded-xl transition-all text-muted-foreground" 
                             title="상세 정보 및 권한 설정"
                           >
                              <Edit3 className="w-4 h-4" />
                           </button>
                           <button 
                             onClick={() => {
                               if (window.confirm(`정말로 ${user.displayName} 사원의 정보를 영구 삭제하시겠습니까?`)) {
                                 deleteDoc(doc(db, 'users', user.uid))
                                   .then(() => {
                                     toast.success(`${user.displayName} 사원의 임직원 계정이 영구 삭제되었습니다.`);
                                     fetchUsers();
                                   })
                                   .catch((err) => {
                                     console.error(err);
                                     toast.error('삭제 처리 중 오류가 발생했습니다.');
                                   });
                               }
                             }}
                             className="p-2 hover:bg-rose-500/10 hover:shadow-md rounded-xl transition-all text-rose-500" 
                             title="삭제"
                           >
                              <Trash2 className="w-4 h-4" />
                           </button>
                           <button className="p-2 hover:bg-card hover:shadow-md rounded-xl transition-all text-muted-foreground">
                              <MoreVertical className="w-4 h-4" />
                           </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="px-10 py-6 border-t border-border bg-muted/20 flex justify-between items-center text-xs font-black text-muted-foreground">
             <span>총 {filteredUsers.length}명의 데이터가 파악되었습니다.</span>
             <div className="flex gap-2">
                <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-background border border-border text-foreground">1</button>
                <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background border border-transparent hover:border-border text-muted-foreground">2</button>
                <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background border border-transparent hover:border-border text-muted-foreground">3</button>
             </div>
          </div>
        </div>
      </div>

      {/* Edit / Permissions Detail Modal */}
      <AnimatePresence>
        {isEditModalOpen && editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-card border border-border rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl text-foreground flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-border bg-muted/20 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold tracking-tight">
                      {editingUser.uid ? '임직원 정보 및 상세 권한 관리' : '신규 임직원 등록'}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {editingUser.uid ? '사용자의 신상 정보와 시스템 권한 목록을 제어합니다.' : '새로운 사원을 명부에 등록하고 부서와 초기 권한을 설정합니다.'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsEditModalOpen(false)}
                  className="w-10 h-10 hover:bg-muted border border-border hover:border-transparent rounded-full flex items-center justify-center transition-all"
                >
                  &times;
                </button>
              </div>

              <div className="p-8 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
                {/* 1. 신상 정보 */}
                <div className="space-y-4">
                  <h4 className="text-xs font-black uppercase text-primary tracking-widest">
                    {editingUser.uid ? '1. 신상 정보 수정' : '1. 신상 정보 입력'}
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5 col-span-2 sm:col-span-1">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">이름</label>
                      <input 
                        type="text" 
                        value={editingUser.displayName || ''}
                        onChange={(e) => setEditingUser({ ...editingUser, displayName: e.target.value })}
                        className="w-full px-4 py-3 bg-muted border border-transparent rounded-xl text-sm font-bold focus:ring-1 focus:ring-primary focus:border-primary text-foreground"
                        placeholder="성함을 입력하십시오"
                      />
                    </div>
                    <div className="space-y-1.5 col-span-2 sm:col-span-1">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">사원 번호 (사번)</label>
                      <input 
                        type="text" 
                        value={editingUser.employeeId || ''}
                        onChange={(e) => setEditingUser({ ...editingUser, employeeId: e.target.value })}
                        className="w-full px-4 py-3 bg-muted border border-transparent rounded-xl text-sm font-bold focus:ring-1 focus:ring-primary focus:border-primary text-foreground"
                        placeholder="사번을 입력하십시오"
                      />
                    </div>
                    <div className="space-y-1.5 col-span-2 sm:col-span-1">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">생년월일</label>
                      <input 
                        type="text" 
                        value={editingUser.birthDate || ''}
                        onChange={(e) => setEditingUser({ ...editingUser, birthDate: e.target.value })}
                        className="w-full px-4 py-3 bg-muted border border-transparent rounded-xl text-sm font-bold focus:ring-1 focus:ring-primary focus:border-primary text-foreground"
                        placeholder="6자리 입력 (예: 860330)"
                      />
                    </div>
                    <div className="space-y-1.5 col-span-2 sm:col-span-1">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">연락처</label>
                      <input 
                        type="text" 
                        value={editingUser.phoneNumber || ''}
                        onChange={(e) => setEditingUser({ ...editingUser, phoneNumber: e.target.value })}
                        className="w-full px-4 py-3 bg-muted border border-transparent rounded-xl text-sm font-bold focus:ring-1 focus:ring-primary focus:border-primary text-foreground"
                        placeholder="010-0000-0000"
                      />
                    </div>
                    <div className="space-y-1.5 col-span-2">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">이메일 주소 (선택)</label>
                      <input 
                        type="email" 
                        placeholder="이메일 주소를 입력하십시오 (예: example@company.com)"
                        value={editingUser.email || ''}
                        onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                        className="w-full px-4 py-3 bg-muted border border-transparent rounded-xl text-sm font-bold focus:ring-1 focus:ring-primary focus:border-primary text-foreground"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. 임직원 소속 및 직무 설정 */}
                <div className="space-y-4 pt-4 border-t border-border">
                  <h4 className="text-xs font-black uppercase text-primary tracking-widest">2. 소속 부서, 직책 및 직무 설정</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5 col-span-2 sm:col-span-1">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">소속 부서</label>
                      <select 
                        value={editingUser.departmentId || ''}
                        onChange={(e) => {
                          const selectedId = e.target.value;
                          const selectedDept = departments.find(d => d.id === selectedId);
                          setEditingUser({ 
                            ...editingUser, 
                            departmentId: selectedId,
                            departmentName: selectedDept ? selectedDept.name : ''
                          });
                        }}
                        className="w-full h-12 px-4 bg-muted border border-transparent rounded-xl text-sm font-bold focus:ring-1 focus:ring-primary focus:border-primary text-foreground cursor-pointer"
                      >
                        <option value="">부서 선택</option>
                        {departments.map(dept => (
                          <option key={dept.id} value={dept.id}>{dept.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5 col-span-2 sm:col-span-1">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">직위</label>
                      <select 
                        value={editingUser.position || '사원'}
                        onChange={(e) => {
                          const nextPos = e.target.value;
                          setEditingUser({ 
                            ...editingUser, 
                            position: nextPos,
                            role: getMappedRole(nextPos) as any
                          });
                        }}
                        className="w-full h-12 px-4 bg-muted border border-transparent rounded-xl text-sm font-bold focus:ring-1 focus:ring-primary focus:border-primary text-foreground cursor-pointer"
                      >
                        {positions.map(pos => (
                          <option key={pos} value={pos}>{pos}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5 col-span-2 sm:col-span-1">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">직무(팀)</label>
                      <select 
                        value={editingUser.jobRole || ''}
                        onChange={(e) => setEditingUser({ ...editingUser, jobRole: e.target.value })}
                        className="w-full h-12 px-4 bg-muted border border-transparent rounded-xl text-sm font-bold focus:ring-1 focus:ring-primary focus:border-primary text-foreground cursor-pointer"
                      >
                        <option value="">직무 선택</option>
                        {jobRoles.map(job => (
                          <option key={job.id} value={job.name}>{job.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5 col-span-2 sm:col-span-1">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">입사일</label>
                      <input 
                        type="date"
                        value={editingUser.joinedAt || ''}
                        onChange={(e) => setEditingUser({ ...editingUser, joinedAt: e.target.value })}
                        className="w-full px-4 py-3 bg-muted border border-transparent rounded-xl text-sm font-bold focus:ring-1 focus:ring-primary focus:border-primary text-foreground cursor-pointer"
                      />
                    </div>
                    <div className="space-y-1.5 col-span-2">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">사업장</label>
                      <select 
                        value={editingUser.workplace || ''}
                        onChange={(e) => setEditingUser({ ...editingUser, workplace: e.target.value })}
                        className="w-full h-12 px-4 bg-muted border border-transparent rounded-xl text-sm font-bold focus:ring-1 focus:ring-primary focus:border-primary text-foreground cursor-pointer"
                      >
                        <option value="">사업장 선택</option>
                        {workplaces.map(wp => (
                          <option key={wp.id} value={wp.name}>{wp.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5 col-span-2 sm:col-span-1">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">기본 직책 그룹</label>
                      <select 
                        value={editingUser.role || 'WORKER'}
                        onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as any })}
                        className="w-full px-4 py-3 bg-muted border border-transparent rounded-xl text-sm font-bold focus:ring-1 focus:ring-primary cursor-pointer text-foreground"
                      >
                        <option value="CEO">CEO (대표이사)</option>
                        <option value="DIRECTOR">DIRECTOR (상무/이사)</option>
                        <option value="GENERAL_MANAGER">GENERAL_MANAGER (부장/현장소장)</option>
                        <option value="SAFETY_MANAGER">SAFETY_MANAGER (안전 관리 총괄팀장)</option>
                        <option value="TEAM_LEADER">TEAM_LEADER (현장 관제사)</option>
                        <option value="GENERAL_AFFAIRS">GENERAL_AFFAIRS (총무부 사원)</option>
                        <option value="CLERK">CLERK (서무 사원)</option>
                        <option value="EMPLOYEE">EMPLOYEE (일반 사원)</option>
                        <option value="GROUP_LEADER">GROUP_LEADER (조장/반장)</option>
                        <option value="WORKER">WORKER (기본 현장 근로자)</option>
                      </select>
                    </div>
                    <div className="space-y-1.5 col-span-2 sm:col-span-1">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">현재 재직 근무 현황</label>
                      <select 
                        value={editingUser.status || 'ACTIVE'}
                        onChange={(e) => setEditingUser({ ...editingUser, status: e.target.value as any })}
                        className="w-full px-4 py-3 bg-muted border border-transparent rounded-xl text-sm font-bold focus:ring-1 focus:ring-primary cursor-pointer text-foreground"
                      >
                        <option value="ACTIVE">ACTIVE (정상 재직 중)</option>
                        <option value="ON_LEAVE">ON_LEAVE (휴직 / 휴가 중)</option>
                        <option value="RETIRED">RETIRED (계약 만료 / 퇴직)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 3. 시스템 승인 / 상세 권한 설정 */}
                <div className="space-y-4 pt-4 border-t border-border">
                  <h4 className="text-xs font-black uppercase text-primary tracking-widest">3. 세부 모듈 제어 권한 (Permissions List)</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { value: 'admin', label: '최고 관리자 권한 (전체 설정)' },
                      { value: 'employee_mgmt', label: '임직원 정보 수정 권한' },
                      { value: 'leave_mgmt', label: '연차/휴가 결재 승인 권한' },
                      { value: 'redemption_mgmt', label: '현물/포인트 지급 관리 권한' },
                      { value: 'attendance_mgmt', label: '근태/출퇴근 조정 권한' },
                      { value: 'high_work_monitor', label: '고소작업 안전 분석 권한' },
                      { value: 'payslip_mgmt', label: '급여명세서 입력 및 관리 권한' },
                      { value: 'qualification_mgmt', label: '보건/자격검증 승인 권한' },
                      { value: 'training_mgmt', label: '기본 안전교육 수동 조율 권한' },
                      { value: 'statutory_training_mgmt', label: '법정 정기교육 수동 등록 권한' },
                    ].map((perm) => {
                      const hasPerm = (editingUser.permissions || []).includes(perm.value);
                      return (
                        <label 
                          key={perm.value}
                          className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer ${
                            hasPerm 
                              ? 'bg-primary/5 border-primary/20 text-foreground' 
                              : 'bg-muted/30 border-transparent hover:bg-muted text-muted-foreground'
                          }`}
                        >
                          <input 
                            type="checkbox"
                            checked={hasPerm}
                            onChange={() => {
                              const currentPerms = editingUser.permissions || [];
                              const newPerms = currentPerms.includes(perm.value)
                                ? currentPerms.filter(p => p !== perm.value)
                                : [...currentPerms, perm.value];
                              setEditingUser({ ...editingUser, permissions: newPerms });
                            }}
                            className="mt-0.5 rounded border-border text-primary focus:ring-primary w-4 h-4"
                          />
                          <span className="text-xs font-bold leading-tight">{perm.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="p-8 border-t border-border bg-muted/20 flex gap-3 shrink-0">
                <button 
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-4 bg-muted border border-border hover:bg-muted/80 rounded-2xl font-black text-sm text-foreground transition-all active:scale-[0.98]"
                >
                  취소
                </button>
                <button 
                  onClick={async () => {
                    try {
                      if (!editingUser.displayName || !editingUser.displayName.trim()) {
                        toast.error('이름은 필수 입력 사항입니다.');
                        return;
                      }
                      if (!editingUser.employeeId || !editingUser.employeeId.trim()) {
                        toast.error('사원 번호(사번)는 필수 입력 사항입니다.');
                        return;
                      }

                      if (editingUser.uid) {
                        // Edit existing user
                        const userRef = doc(db, 'users', editingUser.uid);
                        await updateDoc(userRef, {
                          displayName: editingUser.displayName || '',
                          phoneNumber: editingUser.phoneNumber || '',
                          employeeId: editingUser.employeeId || '',
                          email: editingUser.email || '',
                          birthDate: editingUser.birthDate || '',
                          joinedAt: editingUser.joinedAt || '',
                          position: editingUser.position || '',
                          role: editingUser.role || 'WORKER',
                          permissions: editingUser.permissions || [],
                          status: editingUser.status || 'ACTIVE',
                          isActive: editingUser.status === 'ACTIVE' || editingUser.status === 'ON_LEAVE',
                          departmentId: editingUser.departmentId || '',
                          departmentName: editingUser.departmentName || '',
                          jobRole: editingUser.jobRole || '',
                          workplace: editingUser.workplace || '',
                        });
                        toast.success(`${editingUser.displayName} 님의 정보와 권한이 안전하게 관리자 업데이트되었습니다.`);
                      } else {
                        // Register new user manual register flow
                        const userRef = await addDoc(collection(db, 'users'), {
                          displayName: editingUser.displayName,
                          employeeId: editingUser.employeeId,
                          phoneNumber: editingUser.phoneNumber || '',
                          email: editingUser.email || `${editingUser.employeeId}@shipyard.com`,
                          birthDate: editingUser.birthDate || '',
                          joinedAt: editingUser.joinedAt || '',
                          position: editingUser.position || '사원',
                          role: editingUser.role || 'WORKER',
                          permissions: editingUser.permissions || [],
                          status: editingUser.status || 'ACTIVE',
                          isActive: editingUser.status === 'ACTIVE' || editingUser.status === 'ON_LEAVE',
                          departmentId: editingUser.departmentId || '',
                          departmentName: editingUser.departmentName || '',
                          jobRole: editingUser.jobRole || '',
                          workplace: editingUser.workplace || '',
                          kudosCount: 0,
                          points: 0,
                          createdAt: new Date().toISOString(),
                          updatedAt: new Date().toISOString()
                        });
                        // Set the auto-generated ID back into the uid field
                        await updateDoc(doc(db, 'users', userRef.id), { uid: userRef.id });
                        toast.success(`신규 사원 ${editingUser.displayName} 님이 성공적으로 등록되었습니다.`);
                      }

                      setIsEditModalOpen(false);
                      setEditingUser(null);
                      fetchUsers();
                    } catch (e) {
                      console.error(e);
                      toast.error('정보를 저장하는 중 에러가 발생했습니다.');
                    }
                  }}
                  className="flex-1 py-4 bg-primary hover:bg-primary/95 text-primary-foreground rounded-2xl font-black text-sm shadow-xl shadow-primary/20 transition-all active:scale-[0.98]"
                >
                  {editingUser.uid ? '프로필 권한 변경사항 저장' : '새로운 사원 명부 등록'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </PCAdminLayout>
  );
};

export default PCAdminPersonnel;
