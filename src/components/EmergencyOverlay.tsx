import React, { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '@/firebase';
import { doc, onSnapshot, setDoc, updateDoc, increment, collection, query, where, getDocs } from 'firebase/firestore';
import { EvacuationStatus, UserProfile } from '@/types';
import { useAuth } from '@/components/AuthProvider';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, CheckCircle, Shield, Phone, X, Search, UserMinus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export const EmergencyOverlay: React.FC = () => {
  const { profile, user } = useAuth();
  const [status, setStatus] = useState<EvacuationStatus | null>(null);
  const [hasConfirmed, setHasConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showStats, setShowStats] = useState(false);
  
  // New state for missing person lists
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [checkinUids, setCheckinUids] = useState<Set<string>>(new Set());
  const [clockedInUids, setClockedInUids] = useState<Set<string>>(new Set());
  const [viewingMissingList, setViewingMissingList] = useState<'clockedIn' | 'total'>('clockedIn');
  const [searchTerm, setSearchTerm] = useState('');
  const [rollcallTab, setRollcallTab] = useState<'unconfirmed' | 'confirmed'>('unconfirmed');

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'evacuation', 'status'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as EvacuationStatus;
        setStatus(data);
      } else {
        setStatus(null);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'evacuation/status');
    });
    return () => unsubscribe();
  }, []);

  // Listen to all users
  useEffect(() => {
    if (!status?.isActive) return;
    const unsubscribe = onSnapshot(collection(db, 'users'), (snap) => {
      setAllUsers(snap.docs.map(doc => doc.data() as UserProfile));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });
    return () => unsubscribe();
  }, [status?.isActive]);

  // Listen to all check-ins for the current evacuation
  useEffect(() => {
    if (!status?.isActive || !status.id) return;
    const unsubscribe = onSnapshot(collection(db, 'evacuations', status.id, 'checkins'), (snap) => {
      setCheckinUids(new Set(snap.docs.map(doc => doc.id)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `evacuations/${status.id}/checkins`);
    });
    return () => unsubscribe();
  }, [status?.isActive, status?.id]);

  // Listen to today's attendance to see who is clocked in
  useEffect(() => {
    if (!status?.isActive) return;
    const today = new Date().toISOString().split('T')[0];
    const q = query(collection(db, 'attendance'), where('date', '==', today));
    const unsubscribe = onSnapshot(q, (snap) => {
      const uids = new Set<string>();
      snap.docs.forEach(doc => {
        const data = doc.data();
        if (!data.clockOut) {
          uids.add(data.uid);
        }
      });
      setClockedInUids(uids);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'attendance');
    });
    return () => unsubscribe();
  }, [status?.isActive]);

  useEffect(() => {
    if (status?.isActive && profile) {
      const checkinRef = doc(db, 'evacuations', status.id, 'checkins', profile.uid);
      const unsubscribeAuto = onSnapshot(checkinRef, (snap) => {
        setHasConfirmed(snap.exists());
        if (snap.exists()) {
          setShowStats(true); // Automatically show stats once confirmed
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `evacuations/${status.id}/checkins/${profile.uid}`);
      });
      return () => unsubscribeAuto();
    } else {
      setHasConfirmed(false);
      setShowStats(false);
    }
  }, [status?.isActive, status?.id, profile]);

  const handleConfirmSafety = async () => {
    if (!profile || !status?.isActive || hasConfirmed) return;

    setIsSubmitting(true);
    try {
      const checkinRef = doc(db, 'evacuations', status.id, 'checkins', profile.uid);
      await setDoc(checkinRef, {
        uid: profile.uid,
        displayName: profile.displayName,
        departmentName: profile.departmentName || '소속 없음',
        confirmedAt: new Date().toISOString()
      });

      // Increment global confirmed count
      await updateDoc(doc(db, 'evacuation', 'status'), {
        confirmedCount: increment(1)
      });

      toast.success('안전 확인이 완료되었습니다.');
    } catch (err) {
      console.error("Safety confirmation error:", err);
      toast.error('확인 처리 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEndSituation = async () => {
    if (!status?.id) {
      toast.error('상황 정보를 찾을 수 없습니다.');
      return;
    }
    
    if (isSubmitting) return;

    // Use toast for feedback instead of window.confirm which might be blocked
    try {
      setIsSubmitting(true);
      const now = new Date().toISOString();
      const endedBy = profile?.displayName || user?.displayName || user?.email || 'Administrator';
      
      console.log("Ending situation with ID:", status.id, "Ended by:", endedBy);

      // 1. Update historical record first
      try {
        await setDoc(doc(db, 'evacuations', status.id), {
          isActive: false,
          status: 'FINISHED',
          endedAt: now,
          endedBy: endedBy,
          finishedAt: now,
        }, { merge: true });
      } catch (histError) {
        console.warn("Could not update historical record, but continuing to end situation:", histError);
      }

      // 2. Update the main status flag (this triggers real-time UI close)
      // Switch from updateDoc to setDoc for maximum reliability
      await setDoc(doc(db, 'evacuation', 'status'), {
        isActive: false,
        endedAt: now,
        endedBy: endedBy
      }, { merge: true });

      // 3. Clear pending FIRE incidents in real-time database to prevent ghost alerts
      try {
        const fireQuery = query(
          collection(db, 'criticalIncidents'),
          where('type', '==', 'FIRE'),
          where('status', '==', 'PENDING')
        );
        const fireSnap = await getDocs(fireQuery);
        for (const fireDoc of fireSnap.docs) {
          await updateDoc(doc(db, 'criticalIncidents', fireDoc.id), {
            status: 'RESOLVED',
            resolvedAt: now,
            resolvedByUid: profile?.uid || 'admin',
            resolvedByName: profile?.displayName || '관리자',
            resolutionText: '대피령 일괄 해제 / 상황 종료됨'
          });
        }
      } catch (err) {
        console.error("Failed to clear pending fire incidents:", err);
      }

      toast.success('비상 상황이 종료되었습니다.');
      setShowStats(false);
      setViewingMissingList('clockedIn');
    } catch (error) {
      console.error("End situation error:", error);
      // More descriptive error for the user
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`상황 종료 실패: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isAuthorizedToEnd = profile?.role === 'CEO' || 
                            profile?.permissions?.includes('admin') ||
                            profile?.displayName?.includes('Moon moon') || 
                            profile?.displayName?.includes('강형규') || 
                            user?.email?.toLowerCase() === 'tjrwnfjqm1@gmail.com';

  const missingList = allUsers.filter(user => {
    const isConfirmed = checkinUids.has(user.uid);
    if (isConfirmed) return false;

    if (viewingMissingList === 'clockedIn') {
      return clockedInUids.has(user.uid);
    }
    return true;
  }).filter(user => 
    user.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.phoneNumber?.includes(searchTerm)
  );

  const confirmedList = allUsers.filter(user => {
    const isConfirmed = checkinUids.has(user.uid);
    if (!isConfirmed) return false;

    if (viewingMissingList === 'clockedIn') {
      return clockedInUids.has(user.uid);
    }
    return true;
  }).filter(user => 
    user.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.phoneNumber?.includes(searchTerm)
  );

  if (!status?.isActive) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-start md:items-center justify-center bg-red-600 p-4 md:p-12 overflow-y-auto"
      >
        <div className="fixed inset-0 overflow-hidden opacity-10 pointer-events-none">
          <motion.div
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [0.1, 0.3, 0.1]
            }}
            transition={{
              duration: 5,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="w-full h-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.15)_0%,transparent_100%)] bg-[size:100px_100px]"
          />
        </div>

        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          className={`relative z-10 w-full bg-white rounded-[32px] md:rounded-[40px] p-6 md:p-8 shadow-2xl flex flex-col items-center text-center gap-4 max-h-[92vh] overflow-y-auto transition-all duration-350 ${
            showStats ? 'max-w-xl' : 'max-w-lg'
          }`}
        >
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center text-red-600 mb-0 shrink-0 animate-pulse">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
              비상 대피령 발동
            </h1>
            <p className="text-sm md:text-base font-bold text-slate-500 leading-relaxed px-2">
              {status.reason || '긴급 상황이 발생했습니다.'}
              <br />
              <span className="text-red-600">안전 구역으로 대피 후</span> 버튼을 눌러주세요.
            </p>
          </div>

          <div className="w-full space-y-3">
            {hasConfirmed ? (
              <div className="w-full space-y-4 animate-in fade-in zoom-in duration-500">
                {showStats ? (
                  <div className="w-full space-y-4 text-left">
                    {/* Horizontal side-by-side stats segment selection */}
                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        type="button"
                        onClick={() => setViewingMissingList('clockedIn')}
                        className={`p-4 rounded-2.5xl border-2 flex flex-col items-center gap-1 transition-all active:scale-95 text-center cursor-pointer ${
                          viewingMissingList === 'clockedIn'
                            ? 'bg-blue-50/80 border-blue-500 shadow-md shadow-blue-50'
                            : 'bg-white border-slate-100 hover:bg-slate-50/80'
                        }`}
                      >
                        <p className={`text-[10px] font-black uppercase tracking-wider ${
                          viewingMissingList === 'clockedIn' ? 'text-blue-600' : 'text-slate-400'
                        }`}>출근자 대피율</p>
                        <div className="flex items-baseline gap-0.5">
                          <span className={`text-2xl font-black ${
                            viewingMissingList === 'clockedIn' ? 'text-blue-600' : 'text-slate-700'
                          }`}>{status.confirmedCount || 0}</span>
                          <span className="text-xs font-bold text-slate-400">/ {status.totalClockedIn || clockedInUids.size || '-'}</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                          <div 
                            style={{ width: `${Math.min(100, ((status.confirmedCount || 0) / (status.totalClockedIn || clockedInUids.size || 1)) * 100)}%` }}
                            className={`h-full ${viewingMissingList === 'clockedIn' ? 'bg-blue-500' : 'bg-slate-400'}`}
                          />
                        </div>
                        <p className="text-[9px] font-bold text-slate-400/80 mt-1">터치시 정밀조회</p>
                      </button>

                      <button 
                        type="button"
                        onClick={() => setViewingMissingList('total')}
                        className={`p-4 rounded-2.5xl border-2 flex flex-col items-center gap-1 transition-all active:scale-95 text-center cursor-pointer ${
                          viewingMissingList === 'total'
                            ? 'bg-emerald-50/80 border-emerald-500 shadow-md shadow-emerald-50'
                            : 'bg-white border-slate-100 hover:bg-slate-50/80'
                        }`}
                      >
                        <p className={`text-[10px] font-black uppercase tracking-wider ${
                          viewingMissingList === 'total' ? 'text-emerald-600' : 'text-slate-400'
                        }`}>전체 대원 대피율</p>
                        <div className="flex items-baseline gap-0.5">
                          <span className={`text-2xl font-black ${
                            viewingMissingList === 'total' ? 'text-emerald-600' : 'text-slate-700'
                          }`}>{status.confirmedCount || 0}</span>
                          <span className="text-xs font-bold text-slate-400">/ {status.totalWorkers || allUsers.length || '-'}</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                          <div 
                            style={{ width: `${Math.min(100, ((status.confirmedCount || 0) / (status.totalWorkers || allUsers.length || 1)) * 100)}%` }}
                            className={`h-full ${viewingMissingList === 'total' ? 'bg-emerald-500' : 'bg-slate-400'}`}
                          />
                        </div>
                        <p className="text-[9px] font-bold text-slate-400/80 mt-1">터치시 정밀조회</p>
                      </button>
                    </div>

                    {/* Separator / Header */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                        {viewingMissingList === 'clockedIn' ? '출근 단원 롤콜 명단' : '전체 단원 롤콜 명단'}
                      </h2>
                    </div>

                    {/* Seamless Rollcall Tab selectors */}
                    <div className="flex gap-2 bg-slate-50 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setRollcallTab('unconfirmed')}
                        className={`flex-1 py-2 text-xs font-black rounded-lg transition-all border flex items-center justify-center gap-1.5 cursor-pointer ${
                          rollcallTab === 'unconfirmed'
                            ? 'bg-red-50 text-red-600 border-red-200 shadow-sm'
                            : 'bg-transparent text-slate-400 border-transparent hover:text-slate-600'
                        }`}
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        미대피 확인 ({missingList.length}명)
                      </button>
                      <button
                        type="button"
                        onClick={() => setRollcallTab('confirmed')}
                        className={`flex-1 py-2 text-xs font-black rounded-lg transition-all border flex items-center justify-center gap-1.5 cursor-pointer ${
                          rollcallTab === 'confirmed'
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-sm'
                            : 'bg-transparent text-slate-400 border-transparent hover:text-slate-600'
                        }`}
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        대피완료 ({confirmedList.length}명)
                      </button>
                    </div>

                    {/* Search inside dashboard */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="이름 또는 전화번호 실시간 검색..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full h-9 pl-8 pr-4 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold focus:ring-2 focus:ring-primary/20 text-slate-900 outline-none"
                      />
                    </div>

                    {/* Live Scrollable List box */}
                    <div className="w-full max-h-[180px] overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-xl bg-slate-50/20 p-2 text-left">
                      {rollcallTab === 'unconfirmed' ? (
                        missingList.length > 0 ? (
                          <div className="space-y-1.5">
                            {missingList.map(user => (
                              <div key={user.uid} className="flex items-center justify-between p-2.5 bg-red-50/15 rounded-lg border border-red-100/30">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-7 h-7 rounded bg-red-100 text-red-600 flex items-center justify-center font-black text-xs shrink-0">
                                    {user.displayName?.[0] || '?'}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1">
                                      <p className="text-xs font-black text-slate-900 truncate">{user.displayName}</p>
                                      <span className="text-[7.5px] px-1 py-0.2 bg-red-100 text-red-600 font-black rounded">미대피</span>
                                    </div>
                                    <p className="text-[9px] font-bold text-slate-400 truncate tracking-tight">
                                      {user.position || '대원'} | {user.departmentName || '협력팀'}
                                    </p>
                                  </div>
                                </div>
                                {user.phoneNumber ? (
                                  <a 
                                    href={`tel:${user.phoneNumber}`}
                                    className="w-7 h-7 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center text-white shadow-md active:scale-90 transition-all shrink-0 animate-bounce"
                                    title="전화 바로걸기"
                                  >
                                    <Phone className="w-3.5 h-3.5 fill-current" />
                                  </a>
                                ) : (
                                  <div className="text-[8.5px] font-semibold text-slate-300 shrink-0">
                                    No Phone
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="py-6 text-center text-slate-400 text-xs font-bold">
                            🎉 롤콜 명단 내 미대피 인원이 없습니다.
                          </div>
                        )
                      ) : (
                        confirmedList.length > 0 ? (
                          <div className="space-y-1.5">
                            {confirmedList.map(user => (
                              <div key={user.uid} className="flex items-center justify-between p-2.5 bg-emerald-50/10 rounded-lg border border-emerald-100/30">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-7 h-7 rounded bg-emerald-100 text-emerald-600 flex items-center justify-center font-black text-xs shrink-0">
                                    {user.displayName?.[0] || '?'}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1">
                                      <p className="text-xs font-black text-slate-900 truncate">{user.displayName}</p>
                                      <span className="text-[7.5px] px-1 py-0.2 bg-emerald-100 text-emerald-600 font-black rounded">대피완료</span>
                                    </div>
                                    <p className="text-[9px] font-bold text-slate-400 truncate tracking-tight">
                                      {user.position || '대원'} | {user.departmentName || '협력팀'}
                                    </p>
                                  </div>
                                </div>
                                {user.phoneNumber ? (
                                  <a 
                                    href={`tel:${user.phoneNumber}`}
                                    className="w-7 h-7 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-600 active:scale-90 transition-all shrink-0"
                                    title="전화 바로걸기"
                                  >
                                    <Phone className="w-3 h-3 fill-current" />
                                  </a>
                                ) : (
                                  <div className="text-[8.5px] font-semibold text-slate-300 shrink-0">
                                    No Phone
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="py-6 text-center text-slate-400 text-xs font-bold">
                            대피를 보고한 인원이 없습니다.
                          </div>
                        )
                      )}
                    </div>

                    <Button
                      type="button"
                      onClick={() => setShowStats(false)}
                      variant="outline"
                      className="w-full h-11 rounded-lg border-slate-200 text-slate-500 font-bold text-xs"
                    >
                      대피 상태 화면으로 돌아가기
                    </Button>
                  </div>
                ) : (
                  <div 
                    onClick={() => setShowStats(true)}
                    className="flex flex-col items-center gap-3 p-8 bg-green-50 rounded-[32px] border-2 border-green-200 cursor-pointer hover:bg-green-100 transition-colors"
                  >
                    <CheckCircle className="w-12 h-12 text-green-500" />
                    <div className="text-center">
                      <p className="text-xl font-black text-green-700">생존 확인 완료</p>
                      <p className="text-xs font-medium text-green-600 mt-1">실시간 현황 및 전화 연락망 보려면 터치하세요</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full space-y-3">
                <Button
                  onClick={handleConfirmSafety}
                  disabled={isSubmitting}
                  className="w-full h-20 rounded-[28px] bg-red-600 hover:bg-red-700 text-white text-xl font-black shadow-xl shadow-red-200 transition-all active:scale-95"
                >
                  {isSubmitting ? '처리 중...' : '안전 확인 완료'}
                </Button>
                
                {isAuthorizedToEnd && (
                  <Button
                    onClick={() => {
                      setHasConfirmed(true);
                      setShowStats(true);
                    }}
                    variant="outline"
                    className="w-full h-14 rounded-2xl border-red-200 bg-red-50 text-red-600 hover:bg-red-100 font-extrabold text-sm flex items-center justify-center gap-2 animate-bounce"
                  >
                    🔍 대피/롤콜 실시간 현황 및 전화 연락망 바로가기
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-slate-400 py-1">
            <Shield className="w-3.5 h-3.5" />
            <p className="text-[10px] font-black uppercase tracking-widest">Safety Roll-Call System</p>
          </div>

          {isAuthorizedToEnd && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full pt-4 border-t border-slate-100 mt-auto"
            >
              <Button
                onClick={handleEndSituation}
                disabled={isSubmitting}
                className="w-full h-12 bg-slate-900 hover:bg-black text-white text-xs font-black rounded-2xl gap-2 shadow-xl disabled:opacity-50"
              >
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                {isSubmitting ? '종료 처리 중...' : '비상 상황 종료 (강제 해제)'}
              </Button>
              <p className="text-[10px] font-bold text-slate-400 mt-2">
                * 관리자(Moon moon, 강형규) 전용 공개 버튼입니다.
              </p>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
