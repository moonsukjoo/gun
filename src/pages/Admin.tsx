import React, { useState, useEffect } from 'react';
import { useAuth } from '@/src/components/AuthProvider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  ShieldCheck, 
  Settings, 
  Megaphone, 
  ShieldAlert, 
  CalendarDays, 
  Trophy,
  Search,
  CheckCircle2,
  XCircle,
  ChevronRight,
  UserPlus,
  Zap,
  Save
} from 'lucide-react';
import { db } from '@/src/firebase';
import { collection, query, onSnapshot, updateDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import { UserProfile } from '@/src/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

const PERMISSIONS = [
  { id: 'admin', label: '시스템 관리 접근', icon: Settings },
  { id: 'employee_mgmt', label: '인사등록 (사원/부서)', icon: Users },
  { id: 'notice_mgmt', label: '공지사항 관리', icon: Megaphone },
  { id: 'accident_mgmt', label: '사고즉보 관리', icon: ShieldAlert },
  { id: 'leave_mgmt', label: '연차/휴가 관리', icon: CalendarDays },
  { id: 'dept_mgmt', label: '조직 관리', icon: CheckCircle2 },
  { id: 'praise_coupon', label: '칭찬쿠폰/룰렛 관리', icon: Trophy },
];

export const Admin: React.FC = () => {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Snail Race Settings
  const [snailProbs, setSnailProbs] = useState<number[]>([1, 1, 1, 1, 1]);
  const [isSavingSnail, setIsSavingSnail] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userData = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setUsers(userData);
      setFilteredUsers(userData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'entertainment'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.snailProbabilities) {
          setSnailProbs(data.snailProbabilities);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const filtered = users.filter(user => 
      user.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.employeeId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.departmentName?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredUsers(filtered);
  }, [searchTerm, users]);

  const handleTogglePermission = async (userId: string, permissionId: string) => {
    const user = users.find(u => u.uid === userId);
    if (!user) return;

    const currentPermissions = user.permissions || [];
    const newPermissions = currentPermissions.includes(permissionId)
      ? currentPermissions.filter(p => p !== permissionId)
      : [...currentPermissions, permissionId];

    try {
      await updateDoc(doc(db, 'users', userId), {
        permissions: newPermissions
      });
      toast.success('권한이 업데이트되었습니다.');
    } catch (error) {
      toast.error('권한 업데이트 중 오류가 발생했습니다.');
    }
  };

  const handleUpdateSnailProbs = async () => {
    setIsSavingSnail(true);
    try {
      await setDoc(doc(db, 'settings', 'entertainment'), {
        snailProbabilities: snailProbs
      }, { merge: true });
      toast.success('달팽이 경주 설정이 저장되었습니다.');
    } catch (error) {
      toast.error('설정 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSavingSnail(false);
    }
  };

  const managementLinks = [
    { to: '/personnel', label: '인사등록', icon: UserPlus, permission: 'employee_mgmt' },
    { to: '/coupons', label: '칭찬쿠폰/룰렛 관리', icon: Trophy, permission: 'praise_coupon' },
    { to: '/leave', label: '연차/휴가 관리', icon: CalendarDays, permission: 'leave_mgmt' },
    { to: '/notifications', label: '공지사항 관리', icon: Megaphone, permission: 'notice_mgmt' },
    { to: '/accidents', label: '사고즉보 관리', icon: ShieldAlert, permission: 'accident_mgmt' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Check if current user has overall admin access
  const hasAdminAccess = profile && (['CEO', 'SAFETY_MANAGER'].includes(profile.role) || profile.permissions?.includes('admin'));

  if (!hasAdminAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <ShieldAlert className="w-16 h-16 text-red-500" />
        <h2 className="text-xl font-black tracking-tight">접근 권한이 없습니다.</h2>
        <p className="text-slate-500 font-bold">관리자에게 문의하세요.</p>
        <Button onClick={() => window.history.back()}>뒤로 가기</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <header className="flex flex-col gap-1">
        <h2 className="text-2xl font-black tracking-tighter text-slate-900 flex items-center gap-2">
          <Settings className="w-6 h-6 text-primary" /> 시스템 관리
        </h2>
        <p className="text-slate-500 font-bold text-sm">기능별 권한 설정 및 시스템 관리</p>
      </header>

      {/* System Management Menu */}
      <div className="space-y-4">
        <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">시스템 관리 메뉴</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {managementLinks.map((link) => (
            <Link key={link.to} to={link.to} className="block group">
              <Card className="border-none shadow-sm bg-white group-hover:shadow-md group-hover:-translate-y-1 transition-all duration-300 rounded-2xl overflow-hidden">
                <CardContent className="p-6 flex flex-col items-center text-center space-y-3">
                  <div className="w-14 h-14 bg-primary/5 rounded-2xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors duration-300">
                    <link.icon className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="font-black text-sm text-slate-900">{link.label}</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Management</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Snail Race Probability Settings */}
      <Card className="border-none shadow-sm bg-white rounded-2xl overflow-hidden">
        <CardHeader className="p-5 pb-2 bg-slate-50/50 border-b border-slate-100">
          <CardTitle className="text-sm font-black flex items-center gap-2 tracking-tight">
            <div className="w-1.5 h-4 bg-orange-500 rounded-full" />
            달팽이 경주 확률(속도 가중치) 설정
          </CardTitle>
          <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            가중치가 높을수록 해당 달팽이의 평균 전진 속도가 빨라집니다 (기본값: 1)
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
            {snailProbs.map((prob, idx) => (
              <div key={idx} className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                  <Zap className="w-3 h-3 text-orange-400" /> {idx + 1}번 달팽이
                </label>
                <Input 
                  type="number" 
                  step="0.1"
                  min="0.1"
                  max="5"
                  value={prob}
                  onChange={(e) => {
                    const newProbs = [...snailProbs];
                    newProbs[idx] = parseFloat(e.target.value) || 1;
                    setSnailProbs(newProbs);
                  }}
                  className="bg-slate-50 border-slate-200 font-black h-12 rounded-xl"
                />
              </div>
            ))}
          </div>
          <Button 
            onClick={handleUpdateSnailProbs} 
            disabled={isSavingSnail}
            className="w-full mt-6 h-12 rounded-xl bg-slate-900 font-black gap-2 transition-all active:scale-[0.98]"
          >
            {isSavingSnail ? "저장 중..." : <><Save className="w-4 h-4" /> 설정 저장하기</>}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm bg-white rounded-2xl overflow-hidden">
        <CardHeader className="p-5 pb-2 bg-slate-50/50 border-b border-slate-100">
          <CardTitle className="text-sm font-black flex items-center gap-2 tracking-tight">
            <div className="w-1.5 h-4 bg-primary rounded-full" />
            사용자 권한 설정
          </CardTitle>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="이름, 사번, 부서 검색..." 
              className="pl-9 bg-white border-slate-200"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
            {filteredUsers.map((user) => (
              <div key={user.uid} className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-black text-slate-500 text-xs border border-slate-200">
                      {user.displayName.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-slate-900">{user.displayName}</span>
                        <Badge variant="outline" className="text-[8px] font-black py-0 px-1.5 border-none bg-slate-200">{user.role}</Badge>
                      </div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        {user.departmentName} | {user.employeeId}
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-[10px] font-black uppercase tracking-widest text-primary h-8"
                    onClick={() => setSelectedUser(selectedUser?.uid === user.uid ? null : user)}
                  >
                    {selectedUser?.uid === user.uid ? '닫기' : '권한 설정'}
                  </Button>
                </div>

                {selectedUser?.uid === user.uid && (
                  <div className="grid grid-cols-1 gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-100 mt-2">
                    {PERMISSIONS.map((perm) => {
                      const hasPerm = user.permissions?.includes(perm.id);
                      return (
                        <div 
                          key={perm.id} 
                          className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-100 shadow-sm"
                        >
                          <div className="flex items-center gap-2">
                            <perm.icon className={cn("w-4 h-4", hasPerm ? "text-primary" : "text-slate-300")} />
                            <span className="text-xs font-bold text-slate-600">{perm.label}</span>
                          </div>
                          <Button
                            variant={hasPerm ? "default" : "outline"}
                            size="sm"
                            className={cn(
                              "h-7 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                              hasPerm ? "bg-primary shadow-sm" : "border-slate-200 text-slate-400"
                            )}
                            onClick={() => handleTogglePermission(user.uid, perm.id)}
                          >
                            {hasPerm ? 'ON' : 'OFF'}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
            {filteredUsers.length === 0 && (
              <div className="p-10 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                검색 결과가 없습니다.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
