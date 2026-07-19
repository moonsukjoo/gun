import React, { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '@/firebase';
import { collection, onSnapshot, updateDoc, doc, addDoc, deleteDoc, query, orderBy, increment, writeBatch, getDocs } from 'firebase/firestore';
import { UserProfile, Role, Department, PraiseCoupon, JobRole, UserStatus } from '@/types';
import { useAuth } from '@/components/AuthProvider';
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
  Download,
  RefreshCw,
  FileText
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

const ROLES: Role[] = ['CEO', 'DIRECTOR', 'GENERAL_AFFAIRS', 'GENERAL_MANAGER', 'CLERK', 'SAFETY_MANAGER', 'TEAM_LEADER', 'GROUP_LEADER', 'EMPLOYEE', 'WORKER'];

const ROLE_LABELS: Record<Role, string> = {
  CEO: '사장',
  DIRECTOR: '소장',
  GENERAL_AFFAIRS: '총무',
  GENERAL_MANAGER: '실장',
  CLERK: '서무',
  SAFETY_MANAGER: '안전관리자',
  TEAM_LEADER: '팀장',
  GROUP_LEADER: '조장',
  EMPLOYEE: '일반사원',
  WORKER: '작업자'
};

const POSITIONS = ['사장', '소장', '실장', '팀장', '조장', '반장', '사원'];

const PERMISSIONS = [
  { id: 'notice_mgmt', label: '공지사항 관리' },
  { id: 'accident_mgmt', label: '사고보고 관리' },
  { id: 'leave_mgmt', label: '연차/휴가 관리' },
  { id: 'dept_mgmt', label: '부서/팀 관리' },
  { id: 'employee_mgmt', label: '인사/사원 관리' },
  { id: 'training_mgmt', label: '일반 교육/평가 관리' },
  { id: 'statutory_training_mgmt', label: '법정 정기교육 관리' },
  { id: 'praise_coupon', label: '칭찬쿠폰 발행' },
  { id: 'health_mgmt', label: '보건관리(이상무)' },
  { id: 'unified_report', label: '통합 보고서 관리' },
  { id: 'meal_snack_mgmt', label: '도시락/간식 신청 관리' },
];

import { GlowLoading } from '@/components/GlowLoading';
import { exportToExcel, exportToPDF } from '@/lib/exportUtils';

export const EmployeeManagement: React.FC = () => {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const [positions, setPositions] = useState<{id: string, name: string, createdAt: string}[]>([]);
  const [workplaces, setWorkplaces] = useState<{id: string, name: string, createdAt: string}[]>([]);
  const DEFAULT_JOB_ROLES = ['취부', '용접', '사상', '도장', '반장', '조장', '기타'];
  const DEFAULT_POSITIONS = ['사장', '소장', '실장', '팀장', '조장', '반장', '사원'];
  const [newDeptName, setNewDeptName] = useState('');
  const [newJobRoleName, setNewJobRoleName] = useState('');
  const [newPositionName, setNewPositionName] = useState('');
  const [newWorkplaceName, setNewWorkplaceName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'ON_LEAVE' | 'RESIGNED'>('ALL');
  const [deptFilter, setDeptFilter] = useState<string>('ALL');
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState<string>('');
  
  // Bulk Import State
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [bulkImportText, setBulkImportText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  
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
    jobRole: '기타',
    workplace: '함정선체생산부',
    phoneNumber: '',
    birthDate: '',
    joinedAt: new Date().toISOString().split('T')[0],
    resignedAt: '',
    status: 'ACTIVE' as 'ACTIVE' | 'ON_LEAVE' | 'RETIRED',
    isActive: true
  });

  useEffect(() => {
    if (!profile) return;

    const minLoadTime = new Promise(resolve => setTimeout(resolve, 800));

    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as UserProfile)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

    const deptQuery = query(collection(db, 'departments'), orderBy('createdAt', 'desc'));
    const unsubscribeDepts = onSnapshot(deptQuery, (snapshot) => {
      setDepartments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'departments'));

    const jobRoleQuery = query(collection(db, 'jobRoles'), orderBy('createdAt', 'desc'));
    const unsubscribeJobRoles = onSnapshot(jobRoleQuery, (snapshot) => {
      setJobRoles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as JobRole)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'jobRoles'));

    const positionQuery = query(collection(db, 'positions'), orderBy('createdAt', 'asc'));
    const unsubscribePositions = onSnapshot(positionQuery, (snapshot) => {
      setPositions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'positions'));

    const workplaceQuery = query(collection(db, 'workplaces'), orderBy('createdAt', 'asc'));
    const unsubscribeWorkplaces = onSnapshot(workplaceQuery, (snapshot) => {
      const wpList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setWorkplaces(wpList);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'workplaces'));

    // Wait for minimum loading screen time before turning off full loader
    minLoadTime.then(() => {
      setLoading(false);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeDepts();
      unsubscribeJobRoles();
      unsubscribePositions();
      unsubscribeWorkplaces();
    };
  }, [profile]);

  // One-time safe background check for default workplaces and user workplace migration
  useEffect(() => {
    if (!profile) return;

    const isHR = (
      ['CEO', 'DIRECTOR', 'GENERAL_AFFAIRS', 'GENERAL_MANAGER', 'CLERK'].includes(profile.role) || 
      profile.permissions?.includes('employee_mgmt') ||
      profile.email === 'tjrwnfjqm1@gmail.com'
    );
    if (!isHR) return;

    const performSeedingAndMigration = async () => {
      try {
        // 1. Check and seed workplaces if missing (done via safe one-shot getDocs to avoid triggers)
        const wpSnapshot = await getDocs(collection(db, 'workplaces'));
        const wpNames = wpSnapshot.docs.map(d => d.data().name);
        
        if (!wpNames.includes('함정선체생산부')) {
          await addDoc(collection(db, 'workplaces'), { 
            name: '함정선체생산부', 
            createdAt: new Date().toISOString() 
          });
        }
        if (!wpNames.includes('중형선선체조립부')) {
          await addDoc(collection(db, 'workplaces'), { 
            name: '중형선선체조립부', 
            createdAt: new Date().toISOString() 
          });
        }

        // 2. Find any user whose workplace is empty or legacy null, and migrate to '함정선체생산부'
        const usersSnapshot = await getDocs(collection(db, 'users'));
        let migratedCount = 0;
        const batch = writeBatch(db);

        usersSnapshot.docs.forEach((userDoc) => {
          const userData = userDoc.data();
          const wpValue = userData.workplace;
          if (!wpValue || wpValue.trim() === '') {
            batch.update(doc(db, 'users', userDoc.id), { 
              workplace: '함정선체생산부',
              updatedAt: new Date().toISOString()
            });
            migratedCount++;
          }
        });

        if (migratedCount > 0) {
          await batch.commit();
          toast.success(`기존 사원 ${migratedCount}명의 사업장을 '함정선체생산부'로 일괄 지정했습니다.`);
        }
      } catch (err) {
        console.warn("Auto-seeding or migration failed in background:", err);
      }
    };

    performSeedingAndMigration();
  }, [profile]);

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

  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<{uid: string, employeeId: string} | null>(null);

  const handleResetPin = async () => {
    if (!resetTarget) return;
    
    try {
      await updateDoc(doc(db, 'users', resetTarget.uid), { 
        hasCustomPin: false,
        failedLoginAttempts: 0,
        isLocked: false,
        updatedAt: new Date().toISOString()
      });
      
      toast.success('비밀번호가 초기화되었습니다.', {
        description: `사번(${resetTarget.employeeId})으로 초기화되었습니다.`
      });
      setIsResetConfirmOpen(false);
      setResetTarget(null);
    } catch (error) {
      console.error("Reset PIN error:", error);
      toast.error('초기화 중 오류가 발생했습니다.');
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
    try {
      await deleteDoc(doc(db, 'users', uid));
      toast.success('사원 정보가 삭제되었습니다.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
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
      handleFirestoreError(error, OperationType.CREATE, 'departments');
      toast.error('부서 추가 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteDept = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'departments', id));
      toast.success('부서가 삭제되었습니다.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `departments/${id}`);
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
      handleFirestoreError(error, OperationType.CREATE, 'jobRoles');
      toast.error('직무 추가 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteJobRole = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'jobRoles', id));
      toast.success('직무가 삭제되었습니다.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `jobRoles/${id}`);
      toast.error('직무 삭제 중 오류가 발생했습니다.');
    }
  };

  const handleAddPosition = async () => {
    if (!newPositionName.trim()) return;
    try {
      await addDoc(collection(db, 'positions'), {
        name: newPositionName.trim(),
        createdAt: new Date().toISOString()
      });
      setNewPositionName('');
      toast.success('새 직위가 추가되었습니다.');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'positions');
      toast.error('직위 추가 중 오류가 발생했습니다.');
    }
  };

  const handleDeletePosition = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'positions', id));
      toast.success('직위가 삭제되었습니다.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `positions/${id}`);
      toast.error('직위 삭제 중 오류가 발생했습니다.');
    }
  };

  const handleAddWorkplace = async () => {
    if (!newWorkplaceName.trim()) return;
    try {
      await addDoc(collection(db, 'workplaces'), {
        name: newWorkplaceName.trim(),
        createdAt: new Date().toISOString()
      });
      setNewWorkplaceName('');
      toast.success('새 사업장이 추가되었습니다.');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'workplaces');
      toast.error('사업장 추가 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteWorkplace = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'workplaces', id));
      toast.success('사업장이 삭제되었습니다.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `workplaces/${id}`);
      toast.error('사업장 삭제 중 오류가 발생했습니다.');
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
        departmentName: departments.find(d => d.id === newUser.departmentId)?.name || '',
        kudosCount: 0,
        points: 0,
        createdAt: new Date().toISOString()
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
        jobRole: '기타',
        workplace: '',
        phoneNumber: '',
        birthDate: '',
        joinedAt: new Date().toISOString().split('T')[0],
        resignedAt: '',
        status: 'ACTIVE',
        isActive: true
      });
      toast.success('새 임직원이 등록되었습니다.');
    } catch (error) {
      console.error("Error adding user:", error);
      toast.error('임직원 등록 중 오류가 발생했습니다.');
    }
  };

  const handleBulkImport = async () => {
    if (!bulkImportText.trim()) {
      toast.error('가져올 데이터를 입력해주세요.');
      return;
    }

    setIsImporting(true);
    const lines = bulkImportText.trim().split('\n');
    let importedCount = 0;
    let skipCount = 0;

    try {
      for (const line of lines) {
        // Skip header lines or empty lines
        if (!line.includes('|') || line.includes('성명') || line.includes('---')) continue;

        const parts = line.split('|').map(p => p.trim()).filter(Boolean);
        if (parts.length < 5) continue; // Basic validation

        // Mapping based on the table structure:
        // | 순번 | 직종 | 직위 | 사번 | 성명 | 생년월일 | 휴대폰 | 입사년도 |
        // index: 0,   1,    2,    3,    4,     5,       6,      7
        
        const jobRole = parts[1];
        const position = parts[2];
        const employeeId = parts[3];
        const displayName = parts[4];
        const birthDate = parts[5];
        const phoneNumber = parts[6].replace(/-/g, '');
        const joinedAt = parts[7] === '-' ? '' : parts[7].replace(/\./g, '-');

        // Skip if employeeId or displayName is missing
        if (!employeeId || !displayName) {
          skipCount++;
          continue;
        }

        // Check if user already exists
        const existingUser = users.find(u => u.employeeId === employeeId);
        if (existingUser) {
          skipCount++;
          continue;
        }

        // Determine Role
        let role: Role = 'EMPLOYEE';
        if (position === '대표' || displayName === '강형규') role = 'CEO';
        else if (position === '실장') role = 'GENERAL_MANAGER';
        else if (position === '서무') role = 'CLERK';
        else if (position === '소장') role = 'DIRECTOR';
        else if (position === '안전') role = 'SAFETY_MANAGER';
        else if (position === '팀장') role = 'TEAM_LEADER';

        await addDoc(collection(db, 'users'), {
          displayName,
          employeeId,
          role,
          position,
          jobRole,
          birthDate,
          phoneNumber,
          joinedAt,
          isActive: true,
          kudosCount: 0,
          points: 0,
          permissions: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        importedCount++;
      }

      toast.success(`${importedCount}명의 직원이 성공적으로 등록되었습니다.`, {
        description: skipCount > 0 ? `${skipCount}명은 이미 등록되어 있거나 데이터가 부실하여 건너뛰었습니다.` : undefined
      });
      setIsBulkImportOpen(false);
      setBulkImportText('');
    } catch (error) {
      console.error("Bulk Import Error:", error);
      toast.error('일괄 등록 중 오류가 발생했습니다.');
    } finally {
      setIsImporting(false);
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

  const isHRAdmin = profile && (
    ['CEO', 'DIRECTOR', 'GENERAL_AFFAIRS', 'GENERAL_MANAGER', 'CLERK'].includes(profile.role) || 
    profile.permissions?.includes('employee_mgmt') ||
    profile.email === 'tjrwnfjqm1@gmail.com'
  );
  const canManageDept = profile && (
    ['CEO', 'DIRECTOR', 'GENERAL_AFFAIRS', 'GENERAL_MANAGER', 'CLERK'].includes(profile.role) || 
    profile.permissions?.includes('dept_mgmt') ||
    profile.email === 'tjrwnfjqm1@gmail.com'
  );
  const canManageLeave = profile && (
    ['CEO', 'DIRECTOR', 'GENERAL_AFFAIRS', 'GENERAL_MANAGER', 'CLERK'].includes(profile.role) || 
    profile.permissions?.includes('leave_mgmt') ||
    profile.email === 'tjrwnfjqm1@gmail.com'
  );
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

      exportToExcel(exportData, `직원명부_${new Date().toISOString().split('T')[0]}`, '직원목록');
      toast.success('사원정보 엑셀 파일이 다운로드되었습니다.');
    } catch (error) {
      console.error("Excel export error:", error);
      toast.error('엑셀 변환 중 오류가 발생했습니다.');
    }
  };

  const exportEmployeesToPDF = async () => {
    try {
      const headers = ['부서', '직급', '사번', '이름', '입사일', '상태'];
      const data = filteredUsers.map(u => [
        u.departmentName || '-',
        u.position || '사원',
        u.employeeId,
        u.displayName,
        u.joinedAt || '-',
        u.isActive ? '재직' : '퇴사'
      ]);

      await exportToPDF('임직원 명부 보고서', headers, data, `직원명부_${new Date().toISOString().split('T')[0]}`);
      toast.success('사원정보 PDF 리포트가 생성되었습니다.');
    } catch (error) {
      console.error("PDF export error:", error);
      toast.error('PDF 생성 중 오류가 발생했습니다.');
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = (u.displayName?.toLowerCase() || '').includes(searchTerm) || 
                         (u.employeeId?.toLowerCase() || '').includes(searchTerm);
    
    const userStatus = u.status || (u.isActive ? 'ACTIVE' : 'RETIRED');
    const matchesStatus = statusFilter === 'ALL' || 
                         (statusFilter === 'ACTIVE' && userStatus === 'ACTIVE') ||
                         (statusFilter === 'ON_LEAVE' && userStatus === 'ON_LEAVE') ||
                         (statusFilter === 'RESIGNED' && userStatus === 'RETIRED');

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
          <h2 className="text-3xl font-black tracking-tighter text-foreground">직원 정보 관리</h2>
        </div>
        <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-[0.2em] ml-4">임직원 정보 조회 및 관리 시스템</p>
      </header>

      <Tabs defaultValue="users" className="w-full flex flex-col">
        <TabsList className="flex w-full bg-muted/50 p-1.5 rounded-2xl mb-8 h-12 border border-border">
          <TabsTrigger value="users" className="flex-1 flex items-center justify-center gap-2 rounded-xl data-[state=active]:bg-card data-[state=active]:shadow-xl data-[state=active]:text-foreground transition-all text-[10px] font-black h-full uppercase tracking-widest text-muted-foreground">
            <UserCog className="w-4 h-4" /> {isHRAdmin ? "임직원 관리" : "직원 주소록"}
          </TabsTrigger>
          {(isHRAdmin || isTeamLeader || canManageLeave) && (
            <TabsTrigger value="leave" className="flex-1 flex items-center justify-center gap-2 rounded-xl data-[state=active]:bg-card data-[state=active]:shadow-xl data-[state=active]:text-foreground transition-all text-[10px] font-black h-full uppercase tracking-widest text-muted-foreground">
              <CalendarRange className="w-4 h-4" /> {isHRAdmin || canManageLeave ? "전체 연차 관리" : "팀원 연차 관리"}
            </TabsTrigger>
          )}
          {canManageDept && (
            <TabsTrigger value="departments" className="flex-1 flex items-center justify-center gap-2 rounded-xl data-[state=active]:bg-card data-[state=active]:shadow-xl data-[state=active]:text-foreground transition-all text-[10px] font-black h-full uppercase tracking-widest text-muted-foreground">
              <Building2 className="w-4 h-4" /> 부서/팀 설정
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="users" className="space-y-6 outline-none">
          <div className="bg-card rounded-[2rem] shadow-sm border border-border overflow-hidden">
            <div className="p-4 sm:p-6 bg-muted/20 border-b border-border space-y-4">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="relative flex-grow group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/50 group-focus-within:text-primary transition-colors z-10" />
                  <Input 
                    placeholder="직원 이름 또는 사번 검색..." 
                    className="h-14 pl-12 bg-background/50 border-border focus:border-primary rounded-2xl text-base font-black transition-all text-foreground placeholder:text-muted-foreground/40"
                    onChange={(e) => setSearchTerm(e.target.value.toLowerCase())}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                    <SelectTrigger className="w-full sm:w-[130px] h-12 bg-background/50 border-border rounded-2xl font-black text-xs shadow-sm hover:bg-muted transition-colors text-foreground">
                      <div className="flex items-center gap-2">
                        <Filter className="w-3.5 h-3.5 text-muted-foreground/50" />
                        <SelectValue />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border rounded-xl text-foreground text-left">
                      <SelectItem value="ALL">전체 상태</SelectItem>
                      <SelectItem value="ACTIVE">재직중</SelectItem>
                      <SelectItem value="ON_LEAVE">휴직중</SelectItem>
                      <SelectItem value="RESIGNED">퇴직중</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={deptFilter} onValueChange={setDeptFilter}>
                    <SelectTrigger className="w-full sm:w-[160px] h-12 bg-background/50 border-border rounded-2xl font-black text-xs shadow-sm hover:bg-muted transition-colors text-foreground">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-muted-foreground/50" />
                        <SelectValue />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border rounded-xl text-foreground text-left">
                      <SelectItem value="ALL">전체 부서</SelectItem>
                      {departments.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button 
                    variant="outline" 
                    onClick={exportEmployeesToExcel}
                    className="h-12 px-4 gap-2 font-black rounded-2xl border-border bg-background/50 text-foreground hover:bg-muted active:scale-95 transition-all text-xs"
                  >
                    <Download className="w-4 h-4 text-emerald-500" /> 엑셀
                  </Button>

                  <Button 
                    variant="outline" 
                    onClick={exportEmployeesToPDF}
                    className="h-12 px-4 gap-2 font-black rounded-2xl border-border bg-background/50 text-foreground hover:bg-muted active:scale-95 transition-all text-xs"
                  >
                    <FileText className="w-4 h-4 text-rose-500" /> PDF
                  </Button>

                  {isHRAdmin && (
                    <div className="flex gap-2 ml-auto lg:ml-0">
                      <Dialog open={isBulkImportOpen} onOpenChange={setIsBulkImportOpen}>
                        <DialogTrigger 
                          render={
                            <Button variant="outline" className="h-12 px-6 gap-2 font-black rounded-2xl border-primary/20 text-primary hover:bg-primary/10 active:scale-95 transition-all text-sm">
                              <Plus className="w-4 h-4" /> 일괄 등록
                            </Button>
                          }
                        />
                        <DialogContent className="bg-card border-border rounded-[2.5rem] shadow-2xl max-w-2xl w-[95%] p-0 overflow-hidden flex flex-col max-h-[90dvh] text-foreground">
                          <DialogHeader className="p-8 pb-6 bg-muted/20 border-b border-border text-left shrink-0">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                                <Users className="w-6 h-6 text-primary" />
                              </div>
                              <div>
                                <DialogTitle className="text-2xl font-black tracking-tighter text-foreground">사원 일괄 등록</DialogTitle>
                                <DialogDescription className="text-muted-foreground font-bold">마크다운 테이블 형식의 엑셀 데이터를 붙여넣으세요.</DialogDescription>
                              </div>
                            </div>
                          </DialogHeader>
                          
                          <div className="p-8 space-y-4 flex-grow overflow-hidden flex flex-col">
                            <div className="space-y-2 flex-grow flex flex-col">
                              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">테이블 데이터 (순번|직종|직위|사번|성명|생년월일|휴대폰|입사년도)</label>
                              <textarea
                                value={bulkImportText}
                                onChange={(e) => setBulkImportText(e.target.value)}
                                placeholder="| 1 | 취부 | 사원 | X12345 | 홍길동 | 1990-01 | 01012345678 | 2025.01.01 |"
                                className="w-full flex-grow bg-background border border-border rounded-2xl p-4 font-mono text-sm focus:outline-none focus:border-primary/50 text-foreground placeholder:text-muted-foreground/30 resize-none min-h-[300px]"
                              />
                            </div>
                            
                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex gap-3 items-start">
                              <Clock className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                              <p className="text-xs text-blue-100 leading-relaxed font-medium">
                                입력하신 사번을 기준으로 중복 여부를 체크하며, 기존에 등록된 사번은 건너뜁니다. 
                                연락처의 하이픈(-)은 자동으로 제거되며, 입사년도는 YYYY-MM-DD 형식으로 변환됩니다.
                              </p>
                            </div>
                          </div>

                          <DialogFooter className="p-8 pt-0 flex gap-3">
                            <Button variant="ghost" onClick={() => setIsBulkImportOpen(false)} className="flex-1 h-12 font-black rounded-xl text-foreground">취소</Button>
                            <Button 
                              onClick={handleBulkImport} 
                              disabled={isImporting || !bulkImportText.trim()}
                              className="flex-[2] h-12 font-black rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                            >
                              {isImporting ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                              {isImporting ? '처리 중...' : '가져오기 및 등록'}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
                        <DialogTrigger
                          render={
                            <Button className="h-12 px-6 gap-2 font-black rounded-2xl shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-95 transition-all text-sm bg-primary text-primary-foreground">
                              <UserPlus className="w-4 h-4" /> 사원 추가
                            </Button>
                          }
                        />
                      <DialogContent className="bg-card border-border rounded-[2.5rem] shadow-2xl max-w-lg w-[95%] p-0 overflow-hidden flex flex-col max-h-[90dvh] text-foreground">
                        <DialogHeader className="p-8 pb-6 bg-muted/20 border-b border-border text-left shrink-0">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                              <UserPlus className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                              <DialogTitle className="text-2xl font-black tracking-tighter text-foreground">새 사원 등록</DialogTitle>
                              <DialogDescription className="text-muted-foreground font-bold">임직원의 상세 정보를 입력해주세요.</DialogDescription>
                            </div>
                          </div>
                        </DialogHeader>
                        
                        <div className="p-8 space-y-6 overflow-y-auto flex-grow no-scrollbar">
                          {/* Basic Info Group */}
                          <div className="space-y-4">
                            <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-2 px-1">기본 인적사항</h4>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">이름 *</label>
                                <div className="relative">
                                  <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/30" />
                                  <Input 
                                    value={newUser.displayName}
                                    onChange={(e) => setNewUser({...newUser, displayName: e.target.value})}
                                    placeholder="성함 입력"
                                    className="h-12 pl-12 bg-background border-border rounded-xl font-bold text-foreground placeholder:text-muted-foreground/30"
                                  />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">사원번호 *</label>
                                <div className="relative">
                                  <Badge className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/30 p-0 flex items-center justify-center bg-transparent border-none">ID</Badge>
                                  <Input 
                                    value={newUser.employeeId}
                                    onChange={(e) => setNewUser({...newUser, employeeId: e.target.value.toUpperCase()})}
                                    placeholder="X12345"
                                    className="h-12 pl-12 bg-background border-border rounded-xl font-bold text-foreground placeholder:text-muted-foreground/30"
                                  />
                                </div>
                              </div>
                            </div>
 
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">생년월일 *</label>
                                <div className="relative">
                                  <CalendarRange className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/30" />
                                  <Input 
                                    placeholder="860330 (6자리)"
                                    value={newUser.birthDate}
                                    onChange={(e) => setNewUser({...newUser, birthDate: e.target.value})}
                                    className="h-12 pl-12 bg-muted border-border rounded-xl font-bold text-foreground placeholder:text-muted-foreground/30"
                                  />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">연락처</label>
                                <Input 
                                  value={newUser.phoneNumber}
                                  onChange={(e) => setNewUser({...newUser, phoneNumber: e.target.value})}
                                  placeholder="010-0000-0000"
                                  className="h-12 bg-muted border-border rounded-xl font-bold text-foreground placeholder:text-muted-foreground/30"
                                />
                              </div>
                            </div>
                          </div>
                          
                          <div className="w-full h-px bg-border" />
 
                          {/* Work Info Group */}
                          <div className="space-y-4">
                            <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-2 px-1">업무 정보</h4>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">부서</label>
                                <Select value={newUser.departmentId} onValueChange={(v) => setNewUser({...newUser, departmentId: v})}>
                                  <SelectTrigger className="h-12 bg-muted border-border rounded-xl font-bold text-left text-foreground">
                                    <div className="flex items-center gap-2">
                                      <Building2 className="w-4 h-4 text-muted-foreground/30" />
                                      <SelectValue placeholder="부서 선택" />
                                    </div>
                                  </SelectTrigger>
                                  <SelectContent className="bg-card border-border rounded-xl text-foreground text-left">
                                    {departments.map(dept => (
                                      <SelectItem key={dept.id} value={dept.id} className="font-bold">{dept.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">직위</label>
                                <Select value={newUser.position} onValueChange={(v) => setNewUser({...newUser, position: v})}>
                                  <SelectTrigger className="h-12 bg-muted border-border rounded-xl font-bold text-left text-foreground">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-card border-border rounded-xl text-foreground text-left">
                                    {positions.length > 0 ? (
                                      positions.map(pos => (
                                        <SelectItem key={pos.id} value={pos.name} className="font-bold">{pos.name}</SelectItem>
                                      ))
                                    ) : (
                                      DEFAULT_POSITIONS.map(pos => (
                                        <SelectItem key={pos} value={pos} className="font-bold">{pos}</SelectItem>
                                      ))
                                    )}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
 
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">직무(팀)</label>
                                <Select value={newUser.jobRole} onValueChange={(v) => setNewUser({...newUser, jobRole: v})}>
                                  <SelectTrigger className="h-12 bg-muted border-border rounded-xl font-bold text-left text-foreground">
                                    <SelectValue placeholder="직무 선택" />
                                  </SelectTrigger>
                                  <SelectContent className="bg-card border-border rounded-xl text-foreground text-left">
                                    {jobRoles.length > 0 ? (
                                      jobRoles.map(jr => (
                                        <SelectItem key={jr.id} value={jr.name} className="font-bold">{jr.name}</SelectItem>
                                      ))
                                    ) : (
                                      DEFAULT_JOB_ROLES.map(role => (
                                        <SelectItem key={role} value={role} className="font-bold">{role}</SelectItem>
                                      ))
                                    )}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">입사일 *</label>
                                <div className="relative">
                                  <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/30" />
                                  <Input 
                                    type="date"
                                    value={newUser.joinedAt}
                                    onChange={(e) => setNewUser({...newUser, joinedAt: e.target.value})}
                                    className="h-12 pl-12 bg-muted border-border rounded-xl font-bold text-foreground"
                                  />
                                </div>
                              </div>
                            </div>
 
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">시스템 권한</label>
                                <Select value={newUser.role} onValueChange={(v) => setNewUser({...newUser, role: v as Role})}>
                                  <SelectTrigger className="h-12 bg-muted border-border rounded-xl font-bold text-left text-foreground">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-card border-border rounded-xl text-foreground text-left">
                                    {ROLES.map(role => (
                                      <SelectItem key={role} value={role} className="font-bold">{ROLE_LABELS[role]}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">사업장</label>
                                <Select value={newUser.workplace} onValueChange={(v) => setNewUser({...newUser, workplace: v})}>
                                  <SelectTrigger className="h-12 bg-muted border-border rounded-xl font-bold text-left text-foreground">
                                    <div className="flex items-center gap-2">
                                      <MapPin className="w-4 h-4 text-muted-foreground/45" />
                                      <SelectValue placeholder="사업장 선택" />
                                    </div>
                                  </SelectTrigger>
                                  <SelectContent className="bg-card border-border rounded-xl text-foreground text-left">
                                    {workplaces.length > 0 ? (
                                      workplaces.map(wp => (
                                        <SelectItem key={wp.id} value={wp.name} className="font-bold">{wp.name}</SelectItem>
                                      ))
                                    ) : (
                                      <>
                                        <SelectItem value="함정선체생산부" className="font-bold">함정선체생산부</SelectItem>
                                        <SelectItem value="중형선선체조립부" className="font-bold">중형선선체조립부</SelectItem>
                                      </>
                                    )}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                               <div className="space-y-2">
                                 <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">재직 상태 *</label>
                                 <Select value={newUser.status} onValueChange={(v) => setNewUser({...newUser, status: v as UserStatus, isActive: v === 'ACTIVE' || v === 'ON_LEAVE'})}>
                                   <SelectTrigger className="h-12 bg-muted border-border rounded-xl font-bold text-left text-foreground">
                                     <SelectValue />
                                   </SelectTrigger>
                                   <SelectContent className="bg-card border-border rounded-xl text-foreground text-left">
                                     <SelectItem value="ACTIVE" className="font-bold">재직 중</SelectItem>
                                     <SelectItem value="ON_LEAVE" className="font-bold">휴직 중</SelectItem>
                                     <SelectItem value="RETIRED" className="font-bold">퇴직 중</SelectItem>
                                   </SelectContent>
                                 </Select>
                               </div>
                               <div className="space-y-2 opacity-0 pointer-events-none">
                                 <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">공백</label>
                                 <div className="h-12" />
                               </div>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">이메일 계정</label>
                            <Input 
                              value={newUser.email}
                              onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                              placeholder="example@gmail.com (선택)"
                              className="h-12 bg-muted border-border rounded-xl font-bold text-foreground placeholder:text-muted-foreground/30"
                            />
                          </div>
                        </div>
 
                        <DialogFooter className="p-8 pt-6 bg-muted/20 border-t border-border flex flex-row gap-3 min-h-[100px] shrink-0">
                          <Button variant="outline" className="flex-1 h-14 rounded-2xl font-black border-border bg-background text-foreground hover:bg-muted transition-all" onClick={() => setIsAddUserOpen(false)}>취소</Button>
                          <Button className="flex-1 h-14 rounded-2xl font-black shadow-lg shadow-primary/20 bg-primary text-primary-foreground hover:shadow-primary/40 active:scale-95 transition-all" onClick={handleAddUser}>인사정보 저장</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
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
                      "border-none shadow-sm bg-muted/40 rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-all hover:bg-muted/60 border border-border",
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
                        <div className="w-12 h-12 bg-muted rounded-2xl flex items-center justify-center text-muted-foreground font-black text-lg">
                          {user.displayName.charAt(0)}
                        </div>
                        <div className="space-y-1 text-left">
                          <div className="font-black text-lg text-foreground tracking-tighter leading-none flex items-center gap-2">
                            {user.displayName}
                            {isSelf && <Badge variant="outline" className="text-[8px] h-4 font-black bg-primary/20 text-primary border-primary/30">나</Badge>}
                            {user.status === 'RETIRED' || (!user.status && !user.isActive) ? (
                              <span className="text-[10px] text-muted-foreground font-bold px-2 py-0.5 bg-muted rounded-md border border-border">(퇴사)</span>
                            ) : user.status === 'ON_LEAVE' ? (
                              <span className="text-[10px] text-amber-500 font-bold px-2 py-0.5 bg-amber-500/10 rounded-md border border-amber-500/20">(휴직)</span>
                            ) : (
                              <span className="text-[10px] text-emerald-500 font-bold px-2 py-0.5 bg-emerald-500/10 rounded-md border border-emerald-500/20">(재직)</span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[10px] font-black text-muted-foreground uppercase tracking-widest">{user.employeeId}</span>
                            <Badge variant="secondary" className="bg-muted text-foreground/70 text-[9px] font-bold px-1.5 h-5">{user.position}</Badge>
                            {user.jobRole && <Badge variant="outline" className="text-[9px] font-bold px-1.5 h-5 border-border text-muted-foreground">{user.jobRole}</Badge>}
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
                          className="w-8 h-8 rounded-lg text-muted-foreground/20 hover:text-destructive hover:bg-destructive/10 transition-colors"
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
          <Card className="border-none shadow-sm bg-card rounded-3xl overflow-hidden border border-border">
            <CardHeader className="p-6 border-b border-border bg-muted/30">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-black tracking-tight flex items-center gap-2 text-foreground">
                  <CalendarRange className="w-5 h-5 text-primary" /> 전 사원 연차 관리
                </CardTitle>
                <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                  총 {users.length}명
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow className="border-border hover:bg-transparent">
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
                         <TableRow key={user.uid} className="border-border hover:bg-muted/30 transition-colors">
                          <TableCell className="font-mono text-[11px] font-black text-muted-foreground">{user.employeeId}</TableCell>
                          <TableCell className="font-black text-foreground">{user.displayName}</TableCell>
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
                                className="h-9 w-24 bg-background border-border text-xs font-black rounded-lg text-center disabled:opacity-50 text-foreground"
                              />
                              <span className="text-[10px] font-black text-muted-foreground">일</span>
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
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-none shadow-sm bg-card rounded-2xl overflow-hidden border border-border">
              <CardHeader className="pb-4 pt-6 px-6 bg-muted/30 border-b border-border">
                <CardTitle className="text-base font-black tracking-tight flex items-center gap-2 text-rose-500">
                  <Plus className="w-4 h-4 text-rose-500" /> 새 사업장 추가
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">사업장 명칭</label>
                  <Input 
                    placeholder="예: 중형선선체조립부" 
                    value={newWorkplaceName}
                    onChange={(e) => setNewWorkplaceName(e.target.value)}
                    className="h-12 text-sm border-border bg-background rounded-xl focus:ring-primary/20 font-bold text-foreground placeholder:text-muted-foreground/30"
                  />
                </div>
                <Button className="w-full h-12 gap-2 font-black text-sm rounded-xl shadow-lg active:scale-[0.98] transition-all bg-rose-600 hover:bg-rose-700 text-white" onClick={handleAddWorkplace}>
                  사업장 생성하기
                </Button>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-card rounded-2xl overflow-hidden border border-border">
              <CardHeader className="pb-4 pt-6 px-6 bg-muted/30 border-b border-border">
                <CardTitle className="text-base font-black tracking-tight flex items-center gap-2 text-foreground">
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
                    className="h-12 text-sm border-border bg-background rounded-xl focus:ring-primary/20 font-bold text-foreground placeholder:text-muted-foreground/30"
                  />
                </div>
                <Button className="w-full h-12 gap-2 font-black text-sm rounded-xl shadow-lg active:scale-[0.98] transition-all bg-primary text-primary-foreground" onClick={handleAddDept}>
                  부서 생성하기
                </Button>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-card rounded-2xl overflow-hidden border border-border">
              <CardHeader className="pb-4 pt-6 px-6 bg-muted/30 border-b border-border">
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
                    className="h-12 text-sm border-border bg-background rounded-xl focus:ring-primary/20 font-bold text-foreground placeholder:text-muted-foreground/30"
                  />
                </div>
                <Button className="w-full h-12 gap-2 font-black text-sm rounded-xl shadow-lg active:scale-[0.98] transition-all bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleAddJobRole}>
                  직무 생성하기
                </Button>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-card rounded-2xl overflow-hidden border border-border">
              <CardHeader className="pb-4 pt-6 px-6 bg-muted/30 border-b border-border">
                <CardTitle className="text-base font-black tracking-tight flex items-center gap-2 text-blue-400">
                  <Plus className="w-4 h-4 text-blue-400" /> 새 직위 추가
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">직위 명칭</label>
                  <Input 
                    placeholder="예: 사원, 대리, 과장" 
                    value={newPositionName}
                    onChange={(e) => setNewPositionName(e.target.value)}
                    className="h-12 text-sm border-border bg-background rounded-xl focus:ring-primary/20 font-bold text-foreground placeholder:text-muted-foreground/30"
                  />
                </div>
                <Button className="w-full h-12 gap-2 font-black text-sm rounded-xl shadow-lg active:scale-[0.98] transition-all bg-blue-600 hover:bg-blue-700 text-white" onClick={handleAddPosition}>
                  직위 생성하기
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">사업장 목록 ({workplaces.length})</h3>
                <div className="h-px flex-1 bg-border ml-4" />
              </div>
              
              <div className="grid gap-3 max-h-[400px] overflow-y-auto no-scrollbar">
                {workplaces.map((wp) => (
                  <Card key={wp.id} className="border-none shadow-sm bg-muted/40 rounded-2xl border border-border">
                    <CardContent className="p-5 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-rose-500/10 rounded-xl flex items-center justify-center text-rose-500">
                          <MapPin className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-black text-foreground tracking-tight">{wp.name}</div>
                          <div className="text-[10px] text-muted-foreground font-bold">
                            해당 사원: <span className="text-rose-500">{users.filter(u => u.workplace === wp.name).length}명</span>
                          </div>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="w-10 h-10 rounded-xl text-muted-foreground/20 hover:text-destructive hover:bg-destructive/10 transition-colors"
                        onClick={() => handleDeleteWorkplace(wp.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
                {workplaces.length === 0 && (
                  <div className="py-10 text-center text-muted-foreground/30 text-xs font-bold border border-dashed border-border rounded-2xl bg-muted/20">
                    등록된 사업장이 없습니다.
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">부서 목록 ({departments.length})</h3>
                <div className="h-px flex-1 bg-border ml-4" />
              </div>
              
              <div className="grid gap-3 max-h-[400px] overflow-y-auto no-scrollbar">
                {departments.map((dept) => (
                  <Card key={dept.id} className="border-none shadow-sm bg-muted/40 rounded-2xl border border-border">
                    <CardContent className="p-5 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-muted rounded-xl flex items-center justify-center text-muted-foreground/30">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-black text-foreground tracking-tight">{dept.name}</div>
                          <div className="text-[10px] text-muted-foreground font-bold">
                            현재 인원: <span className="text-primary">{users.filter(u => u.departmentId === dept.id).length}명</span>
                          </div>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="w-10 h-10 rounded-xl text-muted-foreground/20 hover:text-destructive hover:bg-destructive/10 transition-colors"
                        onClick={() => handleDeleteDept(dept.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
                {departments.length === 0 && (
                  <div className="py-10 text-center text-muted-foreground/30 text-xs font-bold border border-dashed border-border rounded-2xl bg-muted/20">
                    등록된 부서가 없습니다.
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">직무 목록 ({jobRoles.length})</h3>
                <div className="h-px flex-1 bg-border ml-4" />
              </div>
              
              <div className="grid gap-3 max-h-[400px] overflow-y-auto no-scrollbar">
                {jobRoles.map((jr) => (
                  <Card key={jr.id} className="border-none shadow-sm bg-muted/40 rounded-2xl border border-border">
                    <CardContent className="p-5 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500">
                          <UserCog className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-black text-foreground tracking-tight">{jr.name}</div>
                          <div className="text-[10px] text-muted-foreground font-bold">
                            해당 사원: <span className="text-emerald-500">{users.filter(u => u.jobRole === jr.name).length}명</span>
                          </div>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="w-10 h-10 rounded-xl text-muted-foreground/20 hover:text-destructive hover:bg-destructive/10 transition-colors"
                        onClick={() => handleDeleteJobRole(jr.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
                {jobRoles.length === 0 && (
                  <div className="py-10 text-center text-muted-foreground/30 text-xs font-bold border border-dashed border-border rounded-2xl bg-muted/20">
                    등록된 직무가 없습니다.
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">직위 목록 ({positions.length})</h3>
                <div className="h-px flex-1 bg-border ml-4" />
              </div>
              
              <div className="grid gap-3 max-h-[400px] overflow-y-auto no-scrollbar">
                {positions.map((pos) => (
                  <Card key={pos.id} className="border-none shadow-sm bg-muted/40 rounded-2xl border border-border">
                    <CardContent className="p-5 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500">
                          <Plus className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-black text-foreground tracking-tight">{pos.name}</div>
                          <div className="text-[10px] text-muted-foreground font-bold">
                            해당 사원: <span className="text-blue-500">{users.filter(u => u.position === pos.name).length}명</span>
                          </div>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="w-10 h-10 rounded-xl text-muted-foreground/20 hover:text-destructive hover:bg-destructive/10 transition-colors"
                        onClick={() => handleDeletePosition(pos.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
                {positions.length === 0 && (
                  <div className="py-10 text-center text-muted-foreground/30 text-xs font-bold border border-dashed border-border rounded-2xl bg-muted/20">
                    등록된 직위가 없습니다.
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>
        )}
      </Tabs>

      <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
        <DialogContent className="bg-card border-border rounded-[2rem] shadow-2xl max-w-lg w-[95%] p-0 overflow-hidden flex flex-col max-h-[90dvh] text-foreground">
          <DialogHeader className="p-8 pb-4 bg-muted/20 border-b border-border shrink-0">
            <DialogTitle className="text-2xl font-black tracking-tighter text-foreground">정보 수정</DialogTitle>
            <DialogDescription className="text-muted-foreground font-bold">{editingUser?.displayName} 사원의 정보를 수정합니다.</DialogDescription>
          </DialogHeader>
          <div className="p-8 space-y-6 overflow-y-auto flex-grow no-scrollbar">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">이름</label>
                <Input 
                  value={editingUser?.displayName || ''}
                  onChange={(e) => setEditingUser(prev => prev ? {...prev, displayName: e.target.value} : null)}
                  className="h-12 bg-muted border-border rounded-xl font-bold text-foreground placeholder:text-muted-foreground/30"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">사번</label>
                <Input 
                  value={editingUser?.employeeId || ''}
                  disabled
                  className="h-12 bg-muted border-border rounded-xl font-bold opacity-50 text-foreground"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">생년월일</label>
                <div className="relative">
                  <CalendarRange className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/30" />
                  <Input 
                    type="text"
                    placeholder="860330"
                    value={editingUser?.birthDate || ''}
                    onChange={(e) => setEditingUser(prev => prev ? {...prev, birthDate: e.target.value} : null)}
                    className="h-12 pl-12 bg-muted border-border rounded-xl font-bold text-foreground placeholder:text-muted-foreground/30"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">연락처</label>
                <Input 
                  value={editingUser?.phoneNumber || ''}
                  onChange={(e) => setEditingUser(prev => prev ? {...prev, phoneNumber: e.target.value} : null)}
                  placeholder="010-0000-0000"
                  className="h-12 bg-muted border-border rounded-xl font-bold text-foreground placeholder:text-muted-foreground/30"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">재직 상태</label>
                 <Select 
                   value={editingUser?.status || (editingUser?.isActive ? 'ACTIVE' : 'RETIRED')} 
                   onValueChange={(v) => setEditingUser(prev => prev ? {...prev, status: v as UserStatus, isActive: v === 'ACTIVE' || v === 'ON_LEAVE'} : null)}
                   disabled={!isHRAdmin}
                 >
                   <SelectTrigger className="h-12 bg-muted border-border rounded-xl font-bold text-foreground">
                      <SelectValue placeholder="상태 선택" />
                   </SelectTrigger>
                   <SelectContent className="bg-card rounded-xl border-border text-foreground">
                     <SelectItem value="ACTIVE">재직 중</SelectItem>
                     <SelectItem value="ON_LEAVE">휴직 중</SelectItem>
                     <SelectItem value="RETIRED">퇴직 중</SelectItem>
                   </SelectContent>
                 </Select>
               </div>
               <div className="space-y-2 opacity-0 pointer-events-none">
                 <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">공백</label>
                 <div className="h-12" />
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
                  <SelectTrigger className="h-12 bg-muted border-border rounded-xl font-bold text-foreground">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-muted-foreground/30" />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="bg-card rounded-xl border-border text-foreground">
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
                  <SelectTrigger className="h-12 bg-muted border-border rounded-xl font-bold text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card rounded-xl border-border text-foreground">
                    {positions.length > 0 ? (
                      positions.map(p => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)
                    ) : (
                      DEFAULT_POSITIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">직무(팀)</label>
                <Select 
                  value={editingUser?.jobRole || '기타'} 
                  onValueChange={(v) => setEditingUser(prev => prev ? {...prev, jobRole: v} : null)}
                  disabled={!isHRAdmin}
                >
                  <SelectTrigger className="h-12 bg-muted border-border rounded-xl font-bold text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card rounded-xl border-border text-foreground">
                    {jobRoles.length > 0 ? (
                      jobRoles.map(jr => <SelectItem key={jr.id} value={jr.name}>{jr.name}</SelectItem>)
                    ) : (
                      DEFAULT_JOB_ROLES.map(jr => <SelectItem key={jr} value={jr}>{jr}</SelectItem>)
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">입사일</label>
                <div className="relative">
                  <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/30" />
                  <Input 
                    type="date"
                    value={editingUser?.joinedAt || ''}
                    onChange={(e) => setEditingUser(prev => prev ? {...prev, joinedAt: e.target.value} : null)}
                    className="h-12 pl-12 bg-muted border-border rounded-xl font-bold text-foreground"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">사업장</label>
                <Select 
                  value={editingUser?.workplace || '함정선체생산부'} 
                  onValueChange={(v) => setEditingUser(prev => prev ? {...prev, workplace: v} : null)}
                  disabled={!isHRAdmin}
                >
                  <SelectTrigger className="h-12 bg-muted border-border rounded-xl font-bold text-foreground">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground/45" />
                      <SelectValue placeholder="사업장 선택" />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="bg-card rounded-xl border-border text-foreground">
                    {workplaces.length > 0 ? (
                      workplaces.map(wp => <SelectItem key={wp.id} value={wp.name}>{wp.name}</SelectItem>)
                    ) : (
                      <>
                        <SelectItem value="함정선체생산부">함정선체생산부</SelectItem>
                        <SelectItem value="중형선선체조립부">중형선선체조립부</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 opacity-0 pointer-events-none">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">공백</label>
                <div className="h-12" />
              </div>
            </div>

            {isHRAdmin && (
              <div className="space-y-4 pt-4 border-t border-border">
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
                          : "bg-muted/40 border-border text-muted-foreground/40 hover:border-muted-foreground/20"
                      )}
                    >
                      <div className={cn(
                        "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all",
                        (editingUser?.permissions || []).includes(perm.id)
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-border text-transparent"
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
          <DialogFooter className="p-8 pt-4 bg-muted/20 border-t border-border flex flex-row gap-3 shadow-2xl">
            <Button variant="outline" className="flex-1 h-12 rounded-xl font-black border-border bg-background text-foreground hover:bg-muted" onClick={() => setIsEditUserOpen(false)}>취소</Button>
            {isHRAdmin && editingUser && (
              <Button 
                variant="outline" 
                className="flex-1 h-12 rounded-xl font-black border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10" 
                onClick={() => {
                  setResetTarget({ uid: editingUser.uid, employeeId: editingUser.employeeId });
                  setIsResetConfirmOpen(true);
                }}
              >
                초기화
              </Button>
            )}
            <Button className="flex-1 h-12 rounded-xl font-black shadow-lg bg-primary text-primary-foreground" onClick={handleEditUserSave}>저장하기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isResetConfirmOpen} onOpenChange={setIsResetConfirmOpen}>
        <DialogContent className="bg-card border-border rounded-[2rem] shadow-2xl max-w-sm w-[90%] p-8 overflow-hidden text-foreground">
          <DialogHeader className="items-center text-center space-y-4">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
              <RefreshCw className="w-8 h-8 text-primary" />
            </div>
            <div className="space-y-1">
              <DialogTitle className="text-xl font-black text-foreground tracking-tighter">비밀번호 초기화</DialogTitle>
              <DialogDescription className="text-muted-foreground font-bold text-xs text-center">
                선택하신 사원의 비밀번호를 초기화하시겠습니까?<br />초기 비밀번호는 사번으로 설정됩니다.
              </DialogDescription>
            </div>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-6">
            <Button 
              className="w-full h-14 bg-primary text-primary-foreground font-black rounded-xl"
              onClick={handleResetPin}
            >
              초기화 실행
            </Button>
            <Button 
              variant="ghost"
              className="w-full h-10 text-muted-foreground hover:text-foreground font-black"
              onClick={() => setIsResetConfirmOpen(false)}
            >
              취소
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="bg-card border-border border rounded-[2rem] shadow-2xl max-w-sm w-[90%] p-8 overflow-hidden text-foreground">
          <DialogHeader className="items-center text-center">
            <div className="w-16 h-16 bg-destructive/10 rounded-2xl flex items-center justify-center mb-4">
              <Trash2 className="w-8 h-8 text-destructive" />
            </div>
            <DialogTitle className="text-xl font-black text-foreground">정보 삭제 확인</DialogTitle>
            <DialogDescription className="text-muted-foreground font-bold whitespace-pre-wrap">
              {deleteName} 사원의 모든 정보를 삭제하시겠습니까? {"\n"}이 작업은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-3 mt-6">
            <Button variant="outline" className="flex-1 h-12 rounded-xl font-black border-border bg-background text-foreground hover:bg-muted" onClick={() => setIsDeleteConfirmOpen(false)}>취소</Button>
            <Button 
              className="flex-1 h-12 rounded-xl font-black bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-lg shadow-destructive/20" 
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
        <DialogContent className="max-w-md p-0 overflow-hidden bg-card border-border rounded-3xl shadow-2xl flex flex-col max-h-[90dvh] w-[95%] text-foreground border">
          <DialogHeader className="p-8 pb-4 bg-emerald-500/5 shrink-0 border-b border-border">
            <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/20">
              <Gift className="w-6 h-6 text-white" />
            </div>
            <DialogTitle className="text-2xl font-black tracking-tighter text-foreground">
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
                  className="h-12 bg-muted border-border rounded-xl font-bold text-foreground"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">시간</label>
                <Input 
                  type="time"
                  value={couponForm.time}
                  onChange={(e) => setCouponForm({...couponForm, time: e.target.value})}
                  className="h-12 bg-muted border-border rounded-xl font-bold text-foreground"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">발생 장소</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/30" />
                <Input 
                  placeholder="예: 제1공장 용접실"
                  value={couponForm.location}
                  onChange={(e) => setCouponForm({...couponForm, location: e.target.value})}
                  className="h-12 pl-12 bg-muted border-border rounded-xl font-bold text-foreground placeholder:text-muted-foreground/30"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">칭찬 사유</label>
              <textarea 
                placeholder="어떤 칭찬을 해주고 싶으신가요?"
                value={couponForm.reason}
                onChange={(e) => setCouponForm({...couponForm, reason: e.target.value})}
                className="w-full min-h-[100px] p-4 bg-muted border border-border rounded-xl font-bold text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground placeholder:text-muted-foreground/30"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">포인트 (1P = 5,000원)</label>
              <Select 
                value={String(couponForm.points)} 
                onValueChange={(v) => setCouponForm({...couponForm, points: parseInt(v)})}
              >
                <SelectTrigger className="h-12 bg-muted border-border rounded-xl font-black text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card rounded-xl border-border text-foreground">
                  <SelectItem value="1">1 P (5,000원)</SelectItem>
                  <SelectItem value="2">2 P (10,000원)</SelectItem>
                  <SelectItem value="3">3 P (15,000원)</SelectItem>
                  <SelectItem value="5">5 P (25,000원)</SelectItem>
                  <SelectItem value="10">10 P (50,000원)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="p-8 pt-4 bg-muted/20 border-t border-border flex flex-row gap-3">
            <Button variant="outline" className="flex-1 h-12 rounded-xl font-black border-border bg-background text-foreground hover:bg-muted" onClick={() => setIsGrantCouponOpen(false)}>취소</Button>
            <Button className="flex-1 h-12 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black shadow-lg shadow-emerald-500/20" onClick={handleGrantCoupon}>쿠폰 지급하기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
