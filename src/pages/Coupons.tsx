import React, { useState, useEffect } from 'react';
import { useAuth } from '@/src/components/AuthProvider';
import { db } from '@/src/firebase';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, increment } from 'firebase/firestore';
import { UserProfile, PraiseCoupon } from '@/src/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger 
} from '@/components/ui/sheet';
import { Gift, Trophy, Settings, MapPin, Search, ShieldCheck, Download, History, Check, ChevronsUpDown, User, ChevronRight, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';
import * as XLSX from 'xlsx';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';

interface RouletteSetting {
  id: string;
  label: string;
  multiplier: number;
  probability: number;
  color: string;
}

const DEFAULT_ROULETTE_SETTINGS: RouletteSetting[] = [
  { id: '1', label: '꽝', multiplier: 0, probability: 0.4, color: '#94a3b8' },
  { id: '2', label: '1배', multiplier: 1, probability: 0.3, color: '#3b82f6' },
  { id: '3', label: '2배', multiplier: 2, probability: 0.2, color: '#10b981' },
  { id: '4', label: '5배', multiplier: 5, probability: 0.08, color: '#f59e0b' },
  { id: '5', label: '10배', multiplier: 10, probability: 0.02, color: '#ef4444' },
];

export const Coupons: React.FC = () => {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [rouletteSettings, setRouletteSettings] = useState<RouletteSetting[]>(DEFAULT_ROULETTE_SETTINGS);
  const [isAuthorizedToGive, setIsAuthorizedToGive] = useState(false);
  const [couponHistory, setCouponHistory] = useState<PraiseCoupon[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'give' | 'history' | 'settings'>('give');
  
  const [giveCouponForm, setGiveCouponForm] = useState({
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0, 5),
    location: '',
    reason: '',
    points: 1
  });

  useEffect(() => {
    if (!profile) return;
    
    const isAuth = profile.role === 'CEO' || profile.role === 'SAFETY_MANAGER' || profile.permissions?.includes('praise_coupon');
    setIsAuthorizedToGive(isAuth);
    
    const unsubscribeUsers = onSnapshot(
      collection(db, 'users'), 
      (snapshot) => {
        setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
      },
      (error) => {
        console.error("Users list sync error:", error);
        toast.error("사원 정보를 불러올 수 없습니다. 연결 상태를 확인해주세요.");
      }
    );

    const unsubscribeHistory = onSnapshot(
      collection(db, 'praiseCoupons'), 
      (snapshot) => {
        const history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PraiseCoupon));
        setCouponHistory(history.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        setHistoryLoading(false);
      },
      (error) => {
        console.error("Coupon history sync error:", error);
        toast.error("지급 내역을 불러올 수 없습니다.");
        setHistoryLoading(false);
      }
    );

    return () => {
      unsubscribeUsers();
      unsubscribeHistory();
    };
  }, [profile]);

  const exportCouponsToExcel = () => {
    try {
      const exportData = couponHistory.map(c => {
        const receiver = users.find(u => u.uid === c.receiverUid);
        return {
          '날짜': c.date,
          '시간': c.time,
          '받는사람 이름': c.receiverName,
          '받는사람 사번': receiver?.employeeId || '-',
          '받는사람 부서': receiver?.departmentName || '-',
          '보낸사람 이름': c.senderName,
          '칭찬 포인트': `${c.points}P`,
          '장소': c.location,
          '사유': c.reason,
          '등록일시': c.createdAt
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "칭찬쿠폰 내역");
      
      const fileName = `칭찬쿠폰지급내역_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      toast.success('칭찬쿠폰 내역 엑셀 파일이 다운로드되었습니다.');
    } catch (error) {
      console.error("Excel export error:", error);
      toast.error('엑셀 변환 중 오류가 발생했습니다.');
    }
  };

  const handleGiveCoupon = async () => {
    if (!isAuthorizedToGive) {
      toast.error('지급 권한이 없습니다.');
      return;
    }
    if (!selectedUser) {
      toast.error('사원을 선택해주세요.');
      return;
    }
    if (!giveCouponForm.location || !giveCouponForm.reason) {
      toast.error('장소와 사유를 입력해주세요.');
      return;
    }

    try {
      const couponData: PraiseCoupon = {
        id: Math.random().toString(36).substring(2, 9),
        senderUid: profile!.uid,
        senderName: profile!.displayName,
        senderRole: profile!.role,
        receiverUid: selectedUser,
        receiverName: users.find(u => u.uid === selectedUser)?.displayName || '알 수 없음',
        date: giveCouponForm.date,
        time: giveCouponForm.time,
        location: giveCouponForm.location,
        reason: giveCouponForm.reason,
        points: giveCouponForm.points,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'praiseCoupons'), couponData);
      await updateDoc(doc(db, 'users', selectedUser), { points: increment(giveCouponForm.points) });

      await addDoc(collection(db, 'notifications'), {
        uid: selectedUser,
        title: '칭찬쿠폰이 도착했습니다!',
        message: `${profile?.displayName}님께서 "${giveCouponForm.reason}" 사유로 ${giveCouponForm.points}P를 선물하셨습니다.`,
        type: 'COUPON',
        isRead: false,
        createdAt: new Date().toISOString()
      });

      toast.success('쿠폰이 성공적으로 지급되었습니다.');
      setSelectedUser('');
      setGiveCouponForm({ ...giveCouponForm, location: '', reason: '' });
    } catch (error) {
      toast.error('지급 중 오류가 발생했습니다.');
    }
  };

  const updateProbability = (id: string, val: string) => {
    const prob = parseFloat(val);
    if (isNaN(prob)) return;
    setRouletteSettings(prev => prev.map(s => s.id === id ? { ...s, probability: prob } : s));
  };

  if (!isAuthorizedToGive) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 px-6 text-center">
        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-2">
          <ShieldCheck className="w-10 h-10 text-white/20" />
        </div>
        <h2 className="text-xl font-black text-white tracking-tight">접근 권한이 없습니다.</h2>
        <p className="text-sm text-muted-foreground font-medium">이 페이지는 관리자 전용 공간입니다.</p>
      </div>
    );
  }

  const totalProb = rouletteSettings.reduce((a, s) => a + s.probability, 0);
  const isProbValid = Math.abs(totalProb - 1) < 0.001;

  return (
    <div className="w-full min-h-screen py-4 px-4 pb-24 flex flex-col items-center">
      {/* Page Header - Centered Block */}
      <div className="w-full max-w-md mb-8 text-center flex flex-col items-center">
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="inline-flex items-center gap-3 bg-card px-6 py-2.5 rounded-full shadow-lg border border-white/5 ring-4 ring-primary/5 mb-2"
        >
          <Trophy className="w-5 h-4 text-yellow-500 fill-yellow-500" />
          <h2 className="text-xl font-black tracking-tight text-white">칭찬쿠폰 & 룰렛 관리</h2>
        </motion.div>
        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.4em] leading-none">Administrative Controls</p>
      </div>

      {/* Navigation Tab Bar - Separated Layout */}
      <div className="w-full max-w-md bg-white/5 backdrop-blur-sm p-1 rounded-2xl flex gap-1 mb-8 shadow-inner border border-white/5">
        <button 
          onClick={() => setActiveTab('give')}
          className={cn(
            "flex-1 py-3 px-4 rounded-xl text-sm font-black transition-all",
            activeTab === 'give' ? "bg-white text-emerald-600 shadow-md scale-[1.02]" : "text-muted-foreground hover:text-white hover:bg-white/5"
          )}
        >
          지급
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={cn(
            "flex-1 py-3 px-4 rounded-xl text-sm font-black transition-all",
            activeTab === 'history' ? "bg-white text-primary shadow-md scale-[1.02]" : "text-muted-foreground hover:text-white hover:bg-white/5"
          )}
        >
          내역
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={cn(
            "flex-1 py-3 px-4 rounded-xl text-sm font-black transition-all",
            activeTab === 'settings' ? "bg-white text-black shadow-md scale-[1.02]" : "text-muted-foreground hover:text-white hover:bg-white/5"
          )}
        >
          설정
        </button>
      </div>

      {/* Main Content Area - Separated Layout and Absolute Centering */}
      <div className="w-full max-w-md">
        {activeTab === 'give' && (
          <section className="space-y-6">
            <div className="flex items-center gap-3 px-2">
              <div className="w-2 h-5 bg-emerald-500 rounded-full" />
              <h3 className="text-base font-black text-white uppercase tracking-widest">칭찬쿠폰 발급</h3>
            </div>

            <Card className="border-none shadow-2xl bg-card rounded-[2.5rem] overflow-hidden border border-white/5">
              <CardHeader className="p-8 pb-4 text-center border-b border-white/5">
                <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Gift className="w-8 h-8 text-emerald-500" />
                </div>
                <CardTitle className="text-xl font-black text-emerald-500">칭찬쿠폰 지급하기</CardTitle>
              </CardHeader>
              <CardContent className="p-6 sm:p-10 space-y-8">
                <div className="space-y-6">
                  {/* Integrated Search Box */}
                  <div className="space-y-4">
                    <label className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">지급 대상 사원 선택</label>
                    <div className="relative group">
                      <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-white/20 group-focus-within:text-emerald-500 transition-colors z-10" />
                      <Input 
                        placeholder="사원 이름 또는 사번으로 검색..." 
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          if (selectedUser) setSelectedUser('');
                        }}
                        className="h-16 pl-16 bg-white/5 border-2 border-transparent focus:border-emerald-500 focus:bg-black/20 rounded-2xl font-black text-lg transition-all shadow-inner placeholder:text-white/20 text-white"
                      />
                    </div>

                    {/* Result or Selection Display */}
                    <div className="min-h-[160px]">
                      {selectedUser ? (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                          {(() => {
                            const user = users.find(u => u.uid === selectedUser);
                            if (!user) return null;
                            return (
                              <div className="flex flex-col items-center text-center p-8 bg-black/40 rounded-[2.5rem] shadow-2xl relative overflow-hidden group border border-white/5">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 transition-transform" />
                                
                                <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center border-4 border-white/10 mb-4 shadow-2xl">
                                  <span className="text-3xl font-black text-white">{user.displayName.charAt(0)}</span>
                                </div>
                                
                                <h4 className="text-2xl font-black text-white tracking-tight">{user.displayName}</h4>
                                <p className="text-muted-foreground font-extrabold text-[11px] uppercase tracking-[0.2em] mt-1">
                                  {user.departmentName} | {user.employeeId}
                                </p>
                                
                                <Badge className="mt-4 bg-emerald-500 text-white font-black px-4 py-1.5 rounded-xl border-none shadow-lg">
                                  지급 대상 확정
                                </Badge>

                                <button 
                                  onClick={() => setSelectedUser('')}
                                  className="absolute top-6 right-6 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors border border-white/10"
                                >
                                  <XCircle className="w-5 h-5 text-white" />
                                </button>
                              </div>
                            );
                          })()}
                        </div>
                      ) : searchQuery.length > 0 ? (
                        <div className="grid gap-3 max-h-[300px] overflow-y-auto no-scrollbar py-2">
                          {users
                            .filter(u => u.uid !== profile?.uid)
                            .filter(u => {
                              const query = searchQuery.toLowerCase();
                              return u.displayName.toLowerCase().includes(query) || 
                                     u.employeeId?.toLowerCase().includes(query) ||
                                     u.departmentName?.toLowerCase().includes(query);
                            }).length === 0 ? (
                              <div className="py-20 flex flex-col items-center gap-3 opacity-30">
                                <Search className="w-12 h-12 text-white/10" />
                                <p className="text-sm font-black text-muted-foreground uppercase tracking-widest">일치하는 사원이 없습니다</p>
                              </div>
                            ) : (
                              users
                                .filter(u => u.uid !== profile?.uid)
                                .filter(u => {
                                  const query = searchQuery.toLowerCase();
                                  return u.displayName.toLowerCase().includes(query) || 
                                         u.employeeId?.toLowerCase().includes(query) ||
                                         u.departmentName?.toLowerCase().includes(query);
                                })
                                .map((user) => (
                                  <button
                                    key={user.uid}
                                    onClick={() => {
                                      setSelectedUser(user.uid);
                                      setSearchQuery('');
                                    }}
                                    className="w-full flex items-center justify-between p-6 rounded-[2rem] border-2 border-transparent bg-white/5 hover:border-emerald-500 hover:bg-white/10 transition-all duration-300 group shadow-sm hover:shadow-xl"
                                  >
                                    <div className="flex items-center gap-4 text-left">
                                       <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center font-black text-xl border-2 border-white/5 text-white/20 shadow-sm group-hover:bg-emerald-500 group-hover:text-white group-hover:border-emerald-500 transition-all">
                                         {user.displayName.charAt(0)}
                                       </div>
                                       <div className="flex flex-col">
                                         <div className="flex items-center gap-2">
                                           <span className="font-black text-base text-white tracking-tight">{user.displayName}</span>
                                           <Badge className="bg-white/10 text-muted-foreground text-[8px] font-black">{user.role}</Badge>
                                         </div>
                                         <span className="text-[10px] font-bold text-muted-foreground mt-0.5">{user.employeeId} | {user.departmentName}</span>
                                       </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-white/20 group-hover:text-emerald-500 transition-all" />
                                  </button>
                                ))
                            )}
                        </div>
                      ) : (
                        <div className="py-16 flex flex-col items-center justify-center text-center space-y-4 bg-white/5 border-2 border-dashed border-white/5 rounded-[2.5rem]">
                          <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center shadow-sm">
                            <User className="w-8 h-8 text-white/10" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-black text-muted-foreground uppercase tracking-widest">사원을 선택해 주세요</p>
                            <p className="text-[9px] font-bold text-white/10 uppercase tracking-[0.2em]">이름 또는 사번으로 검색</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest ml-1">날짜</label>
                      <Input type="date" value={giveCouponForm.date} onChange={e => setGiveCouponForm({...giveCouponForm, date: e.target.value})} className="h-14 bg-white/5 border-white/5 rounded-2xl font-bold border-2 text-white" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest ml-1">시간</label>
                      <Input type="time" value={giveCouponForm.time} onChange={e => setGiveCouponForm({...giveCouponForm, time: e.target.value})} className="h-14 bg-white/5 border-white/5 rounded-2xl font-bold border-2 text-white" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest ml-1">발생 장소</label>
                    <div className="relative">
                      <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
                      <Input placeholder="사무실, 현장 등" value={giveCouponForm.location} onChange={e => setGiveCouponForm({...giveCouponForm, location: e.target.value})} className="h-14 pl-14 bg-white/5 border-white/5 rounded-2xl font-bold border-2 text-white placeholder:text-white/20" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest ml-1">보너스 포인트</label>
                    <Select value={String(giveCouponForm.points)} onValueChange={v => setGiveCouponForm({...giveCouponForm, points: parseInt(v)})}>
                      <SelectTrigger className="h-14 bg-white/5 border-white/5 rounded-2xl font-black border-2 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1c1c1e] rounded-2xl border-white/5 text-white">
                        {[1, 2, 3, 5, 10].map(p => (
                          <SelectItem key={p} value={String(p)} className="font-bold">{p}P ({(p * 5000).toLocaleString()}원)</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest ml-1">칭찬 사유</label>
                    <textarea 
                      placeholder="사원에게 전달될 칭찬 사유를 정성껏 작성해주세요" 
                      value={giveCouponForm.reason} 
                      onChange={e => setGiveCouponForm({...giveCouponForm, reason: e.target.value})}
                      className="w-full h-40 p-5 bg-white/5 border-2 border-white/5 rounded-[2rem] font-bold text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-white placeholder:text-white/20"
                    />
                  </div>

                  <Button onClick={handleGiveCoupon} className="w-full h-16 rounded-[2rem] bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xl shadow-xl shadow-emerald-500/20 transition-all active:scale-95 mt-4">
                    쿠폰 발송하기
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {activeTab === 'history' && (
          <section className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between gap-4 px-2">
              <div className="flex items-center gap-3">
                <div className="w-2 h-5 bg-primary rounded-full" />
                <h3 className="text-base font-black text-white uppercase tracking-widest">지급 내역</h3>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={exportCouponsToExcel}
                className="h-11 px-4 gap-2 font-black rounded-2xl border-white/10 bg-white/5 hover:bg-white/10 text-white shadow-sm flex items-center"
              >
                <Download className="w-4 h-4 text-emerald-500" /> 엑셀 저장
              </Button>
            </div>

            <Card className="border-none shadow-xl bg-card rounded-[2rem] overflow-hidden border border-white/5">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-white/5 border-white/5 hover:bg-transparent">
                        <TableHead className="text-[11px] font-black text-muted-foreground uppercase tracking-widest py-5 pl-8">일시</TableHead>
                        <TableHead className="text-[11px] font-black text-muted-foreground uppercase tracking-widest py-5">대상자</TableHead>
                        <TableHead className="text-[11px] font-black text-muted-foreground uppercase tracking-widest py-5 text-center">포인트</TableHead>
                        <TableHead className="text-[11px] font-black text-muted-foreground uppercase tracking-widest py-5 pr-8">사유</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyLoading ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-20 text-muted-foreground font-bold">로딩 중...</TableCell>
                        </TableRow>
                      ) : couponHistory.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-20 text-muted-foreground font-bold italic uppercase tracking-widest">데이터가 없습니다.</TableCell>
                        </TableRow>
                      ) : (
                        couponHistory.map((c) => (
                          <TableRow key={c.id} className="border-white/5 hover:bg-white/5 transition-colors">
                            <TableCell className="pl-8 py-5">
                              <div className="flex flex-col">
                                <span className="text-xs font-black text-white">{c.date}</span>
                                <span className="text-[10px] font-bold text-muted-foreground mt-1">{c.time}</span>
                              </div>
                            </TableCell>
                            <TableCell className="py-5">
                              <div className="flex flex-col">
                                <span className="text-xs font-black text-white">{c.receiverName}</span>
                                <span className="text-[10px] font-bold text-muted-foreground mt-0.5">{users.find(u => u.uid === c.receiverUid)?.position || '사원'}</span>
                              </div>
                            </TableCell>
                            <TableCell className="py-5 font-black text-emerald-500 text-sm text-center">+{c.points}P</TableCell>
                            <TableCell className="pr-8 py-5">
                              <p className="text-[11px] font-bold text-white/50 line-clamp-2 max-w-[150px] leading-relaxed">{c.reason}</p>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {activeTab === 'settings' && (
          <section className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-3 px-2">
              <div className="w-2 h-5 bg-primary rounded-full" />
              <h3 className="text-base font-black text-white uppercase tracking-widest">환경 설정</h3>
            </div>

            <Card className="border-none shadow-2xl bg-card rounded-[2.5rem] overflow-hidden border border-white/5">
              <CardHeader className="p-8 pb-4 text-center border-b border-white/5">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                  <History className="w-8 h-8 text-white/50" />
                </div>
                <CardTitle className="text-xl font-black text-white">룰렛 당첨 확률</CardTitle>
              </CardHeader>
              <CardContent className="p-6 sm:p-10 space-y-8">
                <div className="space-y-5">
                  {rouletteSettings.map((s) => (
                    <div key={s.id} className="flex flex-col gap-3 bg-white/5 p-6 rounded-[2rem] border border-white/5 ring-1 ring-inset ring-white/5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-2xl shadow-sm border-2 border-white/5 flex-shrink-0" style={{ backgroundColor: s.color }} />
                          <div className="flex flex-col">
                             <span className="text-base font-black text-white">{s.label}</span>
                             <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">{s.multiplier}x Multiplier</span>
                          </div>
                        </div>
                        <div className="w-28 relative">
                          <Input 
                            type="number" 
                            step="0.01" 
                            value={s.probability} 
                            onChange={e => updateProbability(s.id, e.target.value)} 
                            className="h-12 bg-black/40 border-2 border-white/5 rounded-2xl text-center font-black pr-10 focus:ring-primary text-white" 
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-white/20">%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <div className="pt-8">
                    <div className="p-8 bg-black/40 rounded-[2.5rem] shadow-2xl text-center space-y-4 border border-white/5">
                        <div className="flex flex-col items-center gap-2">
                           <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">System Integrity Check</span>
                           <div className="flex items-center gap-2 bg-white/5 px-3 py-1 rounded-full">
                              <div className={cn("w-2 h-2 rounded-full", isProbValid ? "bg-emerald-500 animate-pulse" : "bg-red-500")} />
                              <span className={cn("text-[10px] font-extrabold uppercase", isProbValid ? "text-emerald-400" : "text-red-400")}>
                                {isProbValid ? "VALID" : "INVALID"}
                              </span>
                           </div>
                        </div>
                        <div className={cn("text-5xl font-black transition-colors duration-700", isProbValid ? "text-white" : "text-red-500")}>
                           {(totalProb * 100).toFixed(0)}<span className="text-2xl ml-1">%</span>
                        </div>
                    </div>
                    <p className="text-center text-[10px] text-muted-foreground font-bold mt-6 tracking-wide leading-relaxed">
                      모든 확률의 합계는 <span className="text-white underline">반드시 100%</span>가 되어야 시스템이 정상 작동합니다.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        )}
      </div>
    </div>
  );
};
