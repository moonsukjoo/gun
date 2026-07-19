import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  Search, 
  Plus, 
  Gift, 
  Ticket, 
  Calendar, 
  User, 
  ChevronRight,
  Filter,
  AlertCircle,
  CheckCircle2,
  Send,
  Users,
  Edit2,
  Trash2,
  X,
  MapPin,
  Clock as ClockIcon,
  Download,
  Printer
} from 'lucide-react';
import { collection, query, getDocs, addDoc, updateDoc, deleteDoc, doc, increment, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../components/AuthProvider';
import { UserProfile, PraiseCoupon } from '../types';
import PCAdminLayout from '../components/PCAdminLayout';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';

const PCAdminCoupons: React.FC = () => {
  const { profile } = useAuth();
  const [coupons, setCoupons] = useState<PraiseCoupon[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'dateDesc' | 'dateAsc' | 'pointsDesc' | 'pointsAsc'>('dateDesc');

  // Create Form State
  const [selectedUserUid, setSelectedUserUid] = useState('');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [points, setPoints] = useState(1);
  const [location, setLocation] = useState('');
  const [reason, setReason] = useState('');
  const [customDate, setCustomDate] = useState(new Date().toISOString().split('T')[0]);
  const [customTime, setCustomTime] = useState(new Date().toTimeString().slice(0, 5));

  // Edit Form State
  const [editingCoupon, setEditingCoupon] = useState<PraiseCoupon | null>(null);
  const [editUserUid, setEditUserUid] = useState('');
  const [editUserSearchQuery, setEditUserSearchQuery] = useState('');
  const [editPoints, setEditPoints] = useState(1);
  const [editLocation, setEditLocation] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editStatus, setEditStatus] = useState<'PENDING' | 'COMPLETED'>('PENDING');

  // Bulk Payment Month
  const [bulkUpdateMonth, setBulkUpdateMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    fetchData();

    const handleBeforePrint = () => {
      document.title = "";
    };
    const handleAfterPrint = () => {
      document.title = "건명 통합관리 시스템";
    };

    window.addEventListener("beforeprint", handleBeforePrint);
    window.addEventListener("afterprint", handleAfterPrint);

    return () => {
      window.removeEventListener("beforeprint", handleBeforePrint);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch users
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersList = usersSnapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      })) as UserProfile[];
      setUsers(usersList);

      // Fetch praise coupons
      const couponsSnapshot = await getDocs(collection(db, 'praiseCoupons'));
      const couponsList = couponsSnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as PraiseCoupon[];

      setCoupons(couponsList);
    } catch (e) {
      console.error("Error fetching data from Firestore:", e);
      toast.error("데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // Trigger Native Print Dialog
  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = "";
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  // Export List to Excel
  const exportToExcel = () => {
    try {
      if (sortedCoupons.length === 0) {
        toast.error('내보낼 발급 내역이 없습니다.');
        return;
      }

      // 3-stage corporate approval block at top-right of the Excel
      const excelHeader = [
        ['칭찬 및 안전쿠폰 발급대장', '', '', '', '', '', '결재', '작성', '검토', '최종확인'],
        [`출력일시: ${new Date().toLocaleDateString('ko-KR')} ${new Date().toLocaleTimeString('ko-KR')}`, '', '', '', '', '', '', '서명/인', '서명/인', '서명/인'],
        [`발행처: 건명기업 안전보건관리 시스템 (Admin)`, '', '', '', '', '', '', '', '', ''],
        [], // empty spacer
      ];

      const tableHeaders = ['순번', '수혜자', '사번', '부서', '지급포인트(P)', '환산금액(원)', '지급 장소', '지급 사유', '지급 일자', '지급 시간', '지급 상태', '발행인', '발행인 직책'];

      const tableRows = sortedCoupons.map((c, index) => {
        const targetUserObj = users.find(u => u.uid === c.receiverUid);
        return [
          index + 1,
          c.receiverName || '-',
          targetUserObj?.employeeId || '-',
          targetUserObj?.departmentName || '-',
          c.points || 0,
          (c.points || 0) * 5000,
          c.location || '-',
          c.reason || '-',
          c.date || '-',
          c.time || '-',
          c.status === 'COMPLETED' ? '지급 완료' : '지급 대기',
          c.senderName || '-',
          c.senderRole || '-'
        ];
      });

      const aoaData = [
        ...excelHeader,
        tableHeaders,
        ...tableRows
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(aoaData);

      // Adjust column widths automatically
      const colWidths = tableHeaders.map((_, i) => {
        let maxLen = 10;
        aoaData.forEach(row => {
          if (row && row[i] !== undefined && row[i] !== null) {
            const valStr = String(row[i]);
            if (valStr.length > maxLen) {
              maxLen = valStr.length;
            }
          }
        });
        return { wch: Math.min(Math.max(maxLen * 2, 10), 40) };
      });
      worksheet['!cols'] = colWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '칭찬쿠폰 발급대장');

      const todayStr = new Date().toISOString().split('T')[0];
      XLSX.writeFile(workbook, `칭찬_안전쿠폰_발급대장_${todayStr}.xlsx`);
      toast.success('결재란이 포함된 엑셀 파일이 성공적으로 다운로드되었습니다.');
    } catch (e) {
      console.error('Error exporting to Excel:', e);
      toast.error('엑셀 파일 생성 중 오류가 발생했습니다.');
    }
  };

  // Create Coupon Submission
  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserUid) {
      toast.error('지급 대상을 선택해주세요.');
      return;
    }
    if (!reason.trim()) {
      toast.error('지급 사유를 입력해주세요.');
      return;
    }
    if (!location.trim()) {
      toast.error('지급 장소를 입력해주세요.');
      return;
    }

    const recipient = users.find(u => u.uid === selectedUserUid);
    if (!recipient) {
      toast.error('선택한 사용자 정보를 찾을 수 없습니다.');
      return;
    }

    try {
      const generatedId = Math.random().toString(36).substring(2, 9);
      const couponData: PraiseCoupon = {
        id: generatedId,
        senderUid: profile?.uid || 'admin-pc',
        senderName: profile?.displayName || '관리자',
        senderRole: profile?.role || 'SAFETY_MANAGER',
        receiverUid: selectedUserUid,
        receiverName: recipient.displayName || '알 수 없음',
        date: customDate,
        time: customTime,
        location: location.trim(),
        reason: reason.trim(),
        points: points,
        createdAt: new Date().toISOString(),
        status: 'PENDING'
      };

      // 1. Add coupon document to firestore with matching document ID
      await setDoc(doc(db, 'praiseCoupons', generatedId), couponData);

      // 2. Increment target user's point balance
      await updateDoc(doc(db, 'users', selectedUserUid), {
        points: increment(points)
      });

      // 3. Create a notification for the user
      await addDoc(collection(db, 'notifications'), {
        uid: selectedUserUid,
        title: '칭찬쿠폰이 지급되었습니다!',
        message: `${profile?.displayName || '관리자'}님께서 "${reason}" 사유로 ${points}P를 선물하셨습니다.`,
        type: 'COUPON',
        isRead: false,
        createdAt: new Date().toISOString()
      });

      toast.success(`${recipient.displayName}님에게 쿠폰 ${points}P가 정상 지급되었습니다.`);
      
      // Reset form & close
      setSelectedUserUid('');
      setUserSearchQuery('');
      setPoints(1);
      setLocation('');
      setReason('');
      setCustomDate(new Date().toISOString().split('T')[0]);
      setCustomTime(new Date().toTimeString().slice(0, 5));
      setIsCreateModalOpen(false);

      // Refresh list
      fetchData();
    } catch (e) {
      console.error(e);
      toast.error('쿠폰 지급 처리 중 오류가 발생했습니다.');
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = (coupon: PraiseCoupon) => {
    setEditingCoupon(coupon);
    setEditUserUid(coupon.receiverUid);
    const recipient = users.find(u => u.uid === coupon.receiverUid);
    setEditUserSearchQuery(recipient?.displayName || coupon.receiverName || '');
    setEditPoints(coupon.points || 1);
    setEditLocation(coupon.location || '');
    setEditReason(coupon.reason || '');
    setEditDate(coupon.date || new Date().toISOString().split('T')[0]);
    setEditTime(coupon.time || new Date().toTimeString().slice(0, 5));
    setEditStatus(coupon.status || 'PENDING');
    setIsEditModalOpen(true);
  };

  // Edit Coupon Submission
  const handleUpdateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCoupon) return;
    if (!editUserUid) {
      toast.error('지급 대상을 선택해주세요.');
      return;
    }
    if (!editReason.trim()) {
      toast.error('지급 사유를 입력해주세요.');
      return;
    }
    if (!editLocation.trim()) {
      toast.error('지급 장소를 입력해주세요.');
      return;
    }

    const recipient = users.find(u => u.uid === editUserUid);
    if (!recipient) {
      toast.error('선택한 사용자 정보를 찾을 수 없습니다.');
      return;
    }

    try {
      const oldPoints = editingCoupon.points || 0;
      const oldReceiverUid = editingCoupon.receiverUid;

      // 1. Update coupon document in firestore
      await updateDoc(doc(db, 'praiseCoupons', editingCoupon.id), {
        receiverUid: editUserUid,
        receiverName: recipient.displayName || '알 수 없음',
        points: editPoints,
        location: editLocation.trim(),
        reason: editReason.trim(),
        date: editDate,
        time: editTime,
        status: editStatus
      });

      // 2. Adjust point balances in users collection safely
      const pointsDiff = editPoints - oldPoints;
      if (editUserUid === oldReceiverUid) {
        // Recipient is the same: simply add/subtract point difference
        if (pointsDiff !== 0 && editUserUid && editUserUid !== 'N/A') {
          try {
            await updateDoc(doc(db, 'users', editUserUid), {
              points: increment(pointsDiff)
            });
          } catch (err) {
            console.warn("Failed to update user points in Firestore, proceeding:", err);
          }
        }
      } else {
        // Recipient changed: deduct oldPoints from old recipient and add editPoints to new recipient
        if (oldReceiverUid && oldReceiverUid !== 'N/A') {
          try {
            await updateDoc(doc(db, 'users', oldReceiverUid), {
              points: increment(-oldPoints)
            });
          } catch (err) {
            console.warn("Failed to deduct points from old user, proceeding:", err);
          }
        }
        if (editUserUid && editUserUid !== 'N/A') {
          try {
            await updateDoc(doc(db, 'users', editUserUid), {
              points: increment(editPoints)
            });
          } catch (err) {
            console.warn("Failed to add points to new user, proceeding:", err);
          }
        }
      }

      toast.success('쿠폰 정보가 정상적으로 수정되었습니다.');
      setIsEditModalOpen(false);
      setEditingCoupon(null);
      fetchData();
    } catch (e) {
      console.error(e);
      toast.error('수정 중 오류가 발생했습니다.');
    }
  };

  // Delete Coupon Submission
  const handleDeleteCoupon = async (coupon: PraiseCoupon) => {
    if (!window.confirm(`정말로 ${coupon.receiverName}님에게 지급된 ${coupon.points}P 쿠폰을 삭제하시겠습니까?\n삭제 시 해당 직원의 포인트 잔액에서 ${coupon.points}P가 차감됩니다.`)) {
      return;
    }

    try {
      // 1. Delete document from firestore
      await deleteDoc(doc(db, 'praiseCoupons', coupon.id));

      // 2. Deduct points from recipient's user profile safely
      if (coupon.receiverUid && coupon.receiverUid !== 'N/A') {
        try {
          await updateDoc(doc(db, 'users', coupon.receiverUid), {
            points: increment(-(coupon.points || 0))
          });
        } catch (err) {
          console.warn("Failed to deduct points from user profile, but proceeding with coupon deletion:", err);
        }
      }

      toast.success('쿠폰 지급 내역이 삭제되었습니다.');
      fetchData();
    } catch (e) {
      console.error("Error during coupon deletion:", e);
      toast.error('삭제 처리 중 오류가 발생했습니다.');
    }
  };

  // Toggle individual coupon payout status
  const toggleCouponStatus = async (coupon: PraiseCoupon) => {
    const newStatus = coupon.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
    
    // Validate: only users who have at least 1 point in their user profile can be processed to COMPLETED
    if (newStatus === 'COMPLETED') {
      const targetUserObj = users.find(u => u.uid === coupon.receiverUid);
      const userPoints = targetUserObj?.points ?? 0;
      if (userPoints < 1) {
        toast.error(`'${coupon.receiverName}'님의 실제 보유 포인트가 1P 미만(${userPoints}P)이므로 '지급 완료' 처리할 수 없습니다. (달팽이 게임 등으로 포인트 소진됨)`);
        return;
      }
    }

    try {
      await updateDoc(doc(db, 'praiseCoupons', coupon.id), {
        status: newStatus
      });
      toast.success(`'${coupon.receiverName}'님의 쿠폰이 ${newStatus === 'COMPLETED' ? '지급 완료' : '지급 대기'} 상태로 변경되었습니다.`);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('상태 변경에 실패했습니다.');
    }
  };

  // Bulk complete payouts for a specific month
  const handleBulkCompleteForMonth = async () => {
    const allPendingCoupons = coupons.filter(c => 
      c.date?.startsWith(bulkUpdateMonth) && c.status !== 'COMPLETED'
    );

    if (allPendingCoupons.length === 0) {
      toast.info(`${bulkUpdateMonth}월에 지급 대기 중인 쿠폰이 없습니다.`);
      return;
    }

    // Filter pending coupons so only users who currently have at least 1 point can receive/be paid
    const pendingCouponsForBulkMonth = allPendingCoupons.filter(c => {
      const targetUser = users.find(u => u.uid === c.receiverUid);
      return (targetUser?.points ?? 0) >= 1;
    });

    const skippedCoupons = allPendingCoupons.filter(c => {
      const targetUser = users.find(u => u.uid === c.receiverUid);
      return (targetUser?.points ?? 0) < 1;
    });

    let confirmMsg = `${bulkUpdateMonth}월의 지급 대기 쿠폰 총 ${allPendingCoupons.length}건을 일괄 '지급 완료' 처리하시겠습니까?`;
    if (skippedCoupons.length > 0) {
      confirmMsg += `\n\n⚠️ 제외 안내: 실제 잔여 포인트가 1P 미만인 임직원 ${skippedCoupons.length}명 (${skippedCoupons.map(s => s.receiverName).join(', ')})은 달팽이 레이싱 참여 등으로 포인트를 소진하여 제외됩니다.\n실제 1P 이상 보유한 대상인 ${pendingCouponsForBulkMonth.length}건에 대해서만 '지급 완료' 처리를 실행합니다.`;
    }

    if (!window.confirm(confirmMsg)) {
      return;
    }

    if (pendingCouponsForBulkMonth.length === 0) {
      toast.info("지급 완료 처리 가능한 대상(보유 포인트 1P 이상)이 없습니다.");
      return;
    }

    setLoading(true);
    try {
      const updatePromises = pendingCouponsForBulkMonth.map(c => 
        updateDoc(doc(db, 'praiseCoupons', c.id), {
          status: 'COMPLETED'
        })
      );
      await Promise.all(updatePromises);
      
      toast.success(`${bulkUpdateMonth}월 쿠폰 ${pendingCouponsForBulkMonth.length}건이 성공적으로 일괄 지급 완료 처리되었습니다.`);
      fetchData();
    } catch (err) {
      console.error("Bulk completion error:", err);
      toast.error("일괄 지급 완료 처리 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // Search & Filter list of coupons
  const filteredCoupons = coupons.filter(c => {
    // Filter by selected month if specified
    if (bulkUpdateMonth && (!c.date || !c.date.startsWith(bulkUpdateMonth))) {
      return false;
    }

    if (!searchQuery.trim()) return true;
    const queryStr = searchQuery.toLowerCase();
    
    // Find recipient details for matching on department/employeeId
    const recipient = users.find(u => u.uid === c.receiverUid);
    const departmentName = recipient?.departmentName || '';
    const employeeId = recipient?.employeeId || '';

    return (
      (c.receiverName && c.receiverName.toLowerCase().includes(queryStr)) ||
      (c.senderName && c.senderName.toLowerCase().includes(queryStr)) ||
      (c.reason && c.reason.toLowerCase().includes(queryStr)) ||
      (c.location && c.location.toLowerCase().includes(queryStr)) ||
      (departmentName && departmentName.toLowerCase().includes(queryStr)) ||
      (employeeId && employeeId.toLowerCase().includes(queryStr))
    );
  });

  // Stats calculation based on filtered list
  const totalCount = filteredCoupons.length;
  const totalPoints = filteredCoupons.reduce((acc, c) => acc + (Number(c.points) || 0), 0);
  const totalAmount = totalPoints * 5000; // 1P = 5,000 KRW
  const uniqueRecipients = new Set(filteredCoupons.map(c => c.receiverUid).filter(Boolean)).size;

  // Sort list of coupons
  const sortedCoupons = [...filteredCoupons].sort((a, b) => {
    if (sortBy === 'dateDesc') {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    }
    if (sortBy === 'dateAsc') {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateA - dateB;
    }
    if (sortBy === 'pointsDesc') {
      return (b.points || 0) - (a.points || 0);
    }
    if (sortBy === 'pointsAsc') {
      return (a.points || 0) - (b.points || 0);
    }
    return 0;
  });

  // Filter users inside the searchable select component
  const filteredUsersForSelect = users.filter(u => {
    if (!userSearchQuery.trim()) return true;
    const q = userSearchQuery.toLowerCase();
    return (
      u.displayName?.toLowerCase().includes(q) ||
      u.employeeId?.toLowerCase().includes(q) ||
      u.departmentName?.toLowerCase().includes(q)
    );
  });

  // Filter users inside the EDIT searchable select component
  const filteredUsersForEditSelect = users.filter(u => {
    if (!editUserSearchQuery.trim()) return true;
    const q = editUserSearchQuery.toLowerCase();
    return (
      u.displayName?.toLowerCase().includes(q) ||
      u.employeeId?.toLowerCase().includes(q) ||
      u.departmentName?.toLowerCase().includes(q)
    );
  });

  return (
    <PCAdminLayout title="포상 및 쿠폰 관리">
      <div className="max-w-[1500px] mx-auto space-y-10" id="pcadmin-coupons-container">
        
        {/* Printable CSS style sheet */}
        <style>{`
          @media print {
            @page {
              size: portrait;
              margin: 0 !important;
            }
            body {
              padding: 15mm !important;
            }
            aside, header, .no-print, button, #btn-create-reward, .no-print-col {
              display: none !important;
            }
            body, html, #root, #root > div, main, .flex-1, .bg-background, .custom-scrollbar {
              background: white !important;
              color: #000000 !important;
              height: auto !important;
              min-height: auto !important;
              overflow: visible !important;
              position: static !important;
              display: block !important;
              box-shadow: none !important;
              border: none !important;
              margin: 0 !important;
            }
            main {
              display: block !important;
              height: auto !important;
              overflow: visible !important;
              position: static !important;
            }
            main > div.flex-1 {
              display: block !important;
              height: auto !important;
              overflow: visible !important;
              position: static !important;
              padding: 0 !important;
              margin: 0 !important;
            }
            #pcadmin-coupons-container {
              padding: 0 !important;
              margin: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
              display: block !important;
            }
            .bg-card {
              background: white !important;
              border: none !important;
              border-radius: 0 !important;
              box-shadow: none !important;
              overflow: visible !important;
              padding: 0 !important;
              margin: 0 !important;
              display: block !important;
            }
            table {
              width: 100% !important;
              border-collapse: collapse !important;
              margin-top: 15px !important;
            }
            th, td {
              border: 1px solid #000000 !important;
              padding: 10px 8px !important;
              color: #000000 !important;
              font-size: 11px !important;
              text-align: left !important;
            }
            td.text-center, th.text-center {
              text-align: center !important;
            }
            th {
              background-color: #f4f4f5 !important;
              font-weight: bold !important;
            }
            th *, td * {
              color: #000000 !important;
            }
            tr {
              page-break-inside: avoid !important;
            }
            body {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
        `}</style>

        {/* Print-Only Header Block */}
        <div className="hidden print:block mb-8 text-black bg-white p-6 border-4 border-double border-zinc-900 rounded-lg">
          <div className="grid grid-cols-12 gap-4 pb-4 mb-4 border-b border-zinc-300 items-start">
            <div className="col-span-8 space-y-2">
              <h1 className="text-2xl font-black tracking-tight text-zinc-900 leading-tight">
                {bulkUpdateMonth ? `${parseInt(bulkUpdateMonth.split('-')[1], 10)}월 ` : ''}칭찬 및 안전쿠폰 발행 보관대장
              </h1>
              <p className="text-[10px] text-zinc-400 font-mono">
                출력 일시: {new Date().toLocaleDateString('ko-KR')} {new Date().toLocaleTimeString('ko-KR')}
              </p>
            </div>

            {/* Corporate approval block */}
            <div className="col-span-4 flex justify-end">
              <table className="border-collapse border border-zinc-800 text-center text-[10px] font-bold w-[240px] m-0">
                <tbody>
                  <tr className="bg-zinc-100 border-b border-zinc-800">
                    <td className="w-1/3 py-1 border-r border-zinc-800">작성</td>
                    <td className="w-1/3 py-1 border-r border-zinc-800">검토</td>
                    <td className="w-1/3 py-1">최종확인</td>
                  </tr>
                  <tr className="h-16">
                    <td className="border-r border-zinc-800 p-1 text-center align-middle relative"></td>
                    <td className="border-r border-zinc-800 p-1 text-center align-middle relative"></td>
                    <td className="p-1 text-center align-middle relative"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="grid grid-cols-4 gap-4 p-4 bg-zinc-50 border border-zinc-300 rounded-lg">
            <div className="text-center">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">총 발행 건수</p>
              <p className="text-xl font-extrabold text-zinc-950">{totalCount}건</p>
            </div>
            <div className="text-center border-l border-zinc-300">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">총 지급 포인트</p>
              <p className="text-xl font-extrabold text-zinc-950">{totalPoints.toLocaleString()}P</p>
            </div>
            <div className="text-center border-l border-zinc-300">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">총 지급 환산 금액</p>
              <p className="text-xl font-extrabold text-zinc-950">{totalAmount.toLocaleString()}원</p>
            </div>
            <div className="text-center border-l border-zinc-300">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">수혜 대상 직원 수</p>
              <p className="text-xl font-extrabold text-zinc-950">{uniqueRecipients}명</p>
            </div>
          </div>
        </div>

        <header className="flex justify-between items-end no-print">
          <div className="space-y-4">
            <h2 className="text-3xl font-black text-foreground tracking-tight">안전 포상 & 쿠폰 관리</h2>
            <p className="text-muted-foreground font-medium">임직원들에게 직접 지급한 칭찬/안전포상 쿠폰의 이력을 관리하고, 새로운 쿠폰을 발급합니다.</p>
          </div>
          <button 
            id="btn-create-reward"
            onClick={() => setIsCreateModalOpen(true)}
            className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-sm flex items-center gap-3 hover:bg-blue-700 transition-all shadow-xl shadow-blue-550/15 cursor-pointer"
          >
            <Send className="w-5 h-5 fill-white" />
            새 쿠폰 지급하기
          </button>
        </header>

        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 no-print">
          <div className="bg-card p-8 rounded-[3rem] border border-border flex items-center gap-8 relative overflow-hidden group">
            <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
               <Ticket className="w-8 h-8" />
            </div>
            <div>
               <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">총 발행 건수</p>
               <p className="text-3xl font-black text-foreground" id="stat-total-count">{totalCount}건</p>
            </div>
          </div>
          <div className="bg-card p-8 rounded-[3rem] border border-border flex items-center gap-8 relative overflow-hidden group">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
               <Trophy className="w-8 h-8" />
            </div>
            <div>
               <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">총 지급 포인트</p>
               <p className="text-3xl font-black text-foreground" id="stat-total-points">{totalPoints.toLocaleString()}P</p>
            </div>
          </div>
          <div className="bg-card p-8 rounded-[3rem] border border-border flex items-center gap-8 relative overflow-hidden group">
            <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
               <Gift className="w-8 h-8" />
            </div>
            <div>
               <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">총 지급 환산 금액</p>
               <p className="text-3xl font-black text-foreground" id="stat-total-amount">{totalAmount.toLocaleString()}원</p>
            </div>
          </div>
          <div className="bg-card p-8 rounded-[3rem] border border-border flex items-center gap-8 relative overflow-hidden group">
            <div className="w-16 h-16 bg-purple-500/10 rounded-2xl flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
               <Users className="w-8 h-8" />
            </div>
            <div>
               <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">수혜 대상 직원 수</p>
               <p className="text-3xl font-black text-foreground" id="stat-unique-recipients">{uniqueRecipients}명</p>
            </div>
          </div>
        </div>

        {/* List View */}
        <div className="bg-card rounded-[3rem] border border-border overflow-hidden">
          <div className="px-10 py-8 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 no-print">
            <div className="flex items-center gap-4">
              <h3 className="text-xl font-black text-foreground">칭찬 및 안전쿠폰 발급 히스토리</h3>
              <span className="px-3 py-1 bg-blue-500/10 text-blue-500 text-xs font-black rounded-full no-print">
                총 {totalCount}건 발행됨
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-4 no-print">
               <button
                 id="btn-export-excel"
                 onClick={exportToExcel}
                 className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600/10 hover:bg-emerald-600 text-emerald-500 hover:text-white rounded-xl text-xs font-black transition-all border border-emerald-500/20 cursor-pointer"
                 title="현재 검색된 목록을 엑셀 파일로 다운로드합니다."
               >
                 <Download className="w-4 h-4" />
                 엑셀 다운로드
               </button>
               <button
                 id="btn-print-pdf"
                 onClick={handlePrint}
                 className="flex items-center gap-2 px-4 py-2.5 bg-blue-600/10 hover:bg-blue-600 text-blue-500 hover:text-white rounded-xl text-xs font-black transition-all border border-blue-500/20 cursor-pointer"
                 title="목록을 인쇄하거나 PDF 파일로 저장합니다."
               >
                 <Printer className="w-4 h-4" />
                 PDF / 인쇄 출력
               </button>
               <div className="relative group">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-foreground transition-colors" />
                 <input 
                    id="search-input"
                    type="text" 
                    placeholder="직원명, 사번, 부서, 지급장소, 사유 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-12 pr-6 py-3 bg-muted border border-border rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-foreground placeholder:text-muted-foreground w-64 sm:w-80"
                 />
               </div>
               <div className="relative flex items-center gap-2 bg-muted border border-border rounded-xl px-3 py-1">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <select
                    id="sort-select"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-transparent border-none text-xs font-black text-muted-foreground focus:outline-none cursor-pointer pr-4"
                  >
                    <option value="dateDesc">최신 지급일순</option>
                    <option value="dateAsc">과거 지급일순</option>
                    <option value="pointsDesc">높은 포인트순</option>
                    <option value="pointsAsc">낮은 포인트순</option>
                  </select>
               </div>
            </div>
          </div>
          {/* Monthly Bulk Completion Control Panel */}
          <div className="px-10 py-5 bg-amber-500/5 border-b border-border/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 no-print">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center text-amber-500">
                <CheckCircle2 className="w-5 h-5 animate-bounce" />
              </div>
              <div>
                <h4 className="text-sm font-black text-foreground">칭찬쿠폰 현물 지급 일괄 완료 처리</h4>
                <p className="text-[11px] text-muted-foreground font-semibold">선택한 월에 지급 대기(PENDING) 중인 모든 칭찬쿠폰을 일괄 '지급 완료' 상태로 마킹합니다.</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <input 
                type="month"
                value={bulkUpdateMonth}
                onChange={(e) => setBulkUpdateMonth(e.target.value)}
                className="px-4 py-2.5 bg-muted border border-border rounded-xl text-xs font-black text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
              {bulkUpdateMonth && (
                <button
                  onClick={() => setBulkUpdateMonth('')}
                  className="px-3 py-2 bg-slate-500/10 hover:bg-slate-500/20 text-muted-foreground hover:text-foreground text-[11px] font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap"
                  title="전체 기간 보기"
                >
                  전체보기
                </button>
              )}
              <button
                onClick={handleBulkCompleteForMonth}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl transition-all shadow-lg shadow-amber-500/10 flex items-center gap-2 cursor-pointer whitespace-nowrap"
              >
                일괄 지급 완료 실행
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" id="reward-table">
              <thead>
                <tr className="bg-muted/30 border-b border-border">
                  <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <span className="print:hidden">수혜 대상 직원</span>
                    <span className="hidden print:inline text-black">이름</span>
                  </th>
                  <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest no-print">발급 사원 (발행인)</th>
                  <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <span className="print:hidden">지급 장소</span>
                    <span className="hidden print:inline text-black">지급장소</span>
                  </th>
                  <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <span className="print:hidden">칭찬 및 지급 사유</span>
                    <span className="hidden print:inline text-black">칭찬 및 지급사유</span>
                  </th>
                  <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <span className="print:hidden">지급 쿠폰 (금액 환산)</span>
                    <span className="hidden print:inline text-black">금액</span>
                  </th>
                  <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <span className="print:hidden">지급 일시</span>
                    <span className="hidden print:inline text-black">지급일</span>
                  </th>
                  <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest no-print">지급 상태</th>
                  <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center no-print-col">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {loading ? (
                  Array(5).fill(0).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={8} className="px-10 py-8 bg-muted/20" />
                    </tr>
                  ))
                ) : sortedCoupons.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-10 py-16 text-center text-muted-foreground font-medium">
                      검색 조건에 맞는 쿠폰 발급 내역이 없습니다.
                    </td>
                  </tr>
                ) : sortedCoupons.map((log) => {
                  const targetUserObj = users.find(u => u.uid === log.receiverUid);
                  return (
                    <tr key={log.id} className="group hover:bg-blue-500/5 transition-all">
                      <td className="px-10 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-sm font-black text-blue-600 border border-blue-500/20 no-print">
                             {log.receiverName ? log.receiverName[0] : '?'}
                          </div>
                          <div>
                             <div className="flex flex-wrap items-center gap-2">
                               <p className="text-sm font-black text-foreground">{log.receiverName}</p>
                               <span className="no-print text-[10px] font-black text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg whitespace-nowrap">
                                 실제 잔여: {targetUserObj ? (targetUserObj.points ?? 0).toLocaleString() : 0}P
                               </span>
                             </div>
                             <p className="text-[10px] font-bold text-muted-foreground tracking-tight no-print">
                               부서: {targetUserObj?.departmentName || '기타'} | 사번: {targetUserObj?.employeeId || 'N/A'}
                             </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-10 py-6 no-print">
                        <div>
                          <p className="text-xs font-extrabold text-foreground">{log.senderName}</p>
                          <p className="text-[9px] font-black text-muted-foreground/80 uppercase">{log.senderRole || 'ADMIN'}</p>
                        </div>
                      </td>
                      <td className="px-10 py-6">
                        <span className="text-xs font-bold text-muted-foreground">{log.location || '-'}</span>
                      </td>
                      <td className="px-10 py-6">
                        <p className="text-xs font-semibold text-muted-foreground max-w-[280px] leading-relaxed line-clamp-2 print:text-black print:max-w-none print:line-clamp-none">
                          {log.reason}
                        </p>
                      </td>
                      <td className="px-10 py-6">
                        <div className="flex flex-col print:hidden">
                          <div className="flex items-center gap-1.5 text-emerald-500">
                            <Gift className="w-4 h-4 no-print" />
                            <span className="text-sm font-black">+{log.points || 0}P</span>
                          </div>
                          <span className="text-[10px] font-extrabold text-muted-foreground/60 pl-5">
                            ({((log.points || 0) * 5000).toLocaleString()}원 상당)
                          </span>
                        </div>
                        <div className="hidden print:block text-xs font-bold text-black">
                          {((log.points || 0) * 5000).toLocaleString()}원
                        </div>
                      </td>
                      <td className="px-10 py-6">
                        <div className="text-xs font-bold text-muted-foreground">
                          <div>{log.date}</div>
                          <div className="text-[10px] text-muted-foreground/50 mt-0.5 no-print">{log.time}</div>
                        </div>
                      </td>
                      <td className="px-10 py-6 no-print">
                        <button
                          onClick={() => toggleCouponStatus(log)}
                          className="no-print focus:outline-none cursor-pointer"
                          title="클릭하여 지급 상태 변경"
                        >
                          {log.status === 'COMPLETED' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                              <CheckCircle2 className="w-3.5 h-3.5 animate-pulse" />
                              지급 완료
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-500/10 text-amber-500 border border-amber-500/20">
                              <AlertCircle className="w-3.5 h-3.5" />
                              지급 대기
                            </span>
                          )}
                        </button>
                        <span className="hidden print:inline-block font-semibold">
                          {log.status === 'COMPLETED' ? '지급 완료' : '지급 대기'}
                        </span>
                      </td>
                      <td className="px-10 py-6 no-print-col">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            id={`btn-edit-${log.id}`}
                            onClick={() => handleOpenEditModal(log)}
                            className="p-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white rounded-lg transition-all cursor-pointer"
                            title="쿠폰 정보 수정"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            id={`btn-delete-${log.id}`}
                            onClick={() => handleDeleteCoupon(log)}
                            className="p-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white rounded-lg transition-all cursor-pointer"
                            title="쿠폰 회수 및 삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create Coupon Modal */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="bg-card w-full max-w-lg rounded-[3rem] shadow-2xl border border-border overflow-hidden flex flex-col"
            >
              <div className="px-10 py-8 bg-[#1e293b] text-white flex justify-between items-center border-b border-border">
                <div className="flex items-center gap-4">
                  <Trophy className="w-8 h-8 text-amber-400 animate-bounce" />
                  <h3 className="text-2xl font-black tracking-tight">칭찬 및 안전쿠폰 신규 지급</h3>
                </div>
                <button onClick={() => setIsCreateModalOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors cursor-pointer">
                  <X className="w-6 h-6 text-white" />
                </button>
              </div>
              
              <form onSubmit={handleCreateCoupon} className="p-10 space-y-6 bg-card text-foreground overflow-y-auto max-h-[75vh]">
                
                {/* Search and Select User */}
                <div className="space-y-3">
                  <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-2">수혜 대상자 검색 및 선택</label>
                  {selectedUserUid ? (
                    <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-500 text-white rounded-xl flex items-center justify-center font-black">
                          {users.find(u => u.uid === selectedUserUid)?.displayName?.[0] || 'U'}
                        </div>
                        <div>
                          <p className="text-sm font-black text-foreground">
                            {users.find(u => u.uid === selectedUserUid)?.displayName}
                          </p>
                          <p className="text-[10px] font-bold text-muted-foreground">
                            사번: {users.find(u => u.uid === selectedUserUid)?.employeeId} | 부서: {users.find(u => u.uid === selectedUserUid)?.departmentName} | 실제 잔여: {(users.find(u => u.uid === selectedUserUid)?.points ?? 0).toLocaleString()}P
                          </p>
                        </div>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => { setSelectedUserUid(''); setUserSearchQuery(''); }}
                        className="p-2 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2 relative">
                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input 
                          type="text"
                          placeholder="사원명 또는 사번 입력..."
                          value={userSearchQuery}
                          onChange={(e) => setUserSearchQuery(e.target.value)}
                          className="w-full pl-12 pr-6 py-4 bg-muted border border-border rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-foreground"
                        />
                      </div>
                      {userSearchQuery.trim() && (
                        <div className="absolute left-0 right-0 top-full mt-2 bg-card border border-border rounded-2xl shadow-xl max-h-48 overflow-y-auto z-[110] divide-y divide-border">
                          {filteredUsersForSelect.slice(0, 5).map(user => (
                            <button
                              key={user.uid}
                              type="button"
                              onClick={() => setSelectedUserUid(user.uid)}
                              className="w-full px-5 py-3 text-left hover:bg-muted transition-colors flex items-center justify-between"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-black text-foreground">{user.displayName}</span>
                                  <span className="text-[10px] font-bold text-slate-400">({user.departmentName || '부서미정'})</span>
                                </div>
                                <span className="text-[10px] font-black text-amber-500 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-md w-fit whitespace-nowrap">
                                  잔여: {(user.points ?? 0).toLocaleString()}P
                                </span>
                              </div>
                              <span className="text-[10px] font-bold text-slate-400">사번: {user.employeeId}</span>
                            </button>
                          ))}
                          {filteredUsersForSelect.length === 0 && (
                            <div className="px-5 py-3 text-center text-xs text-muted-foreground">일치하는 직원이 없습니다.</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Points */}
                <div className="space-y-3">
                  <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-2">쿠폰 포인트 선택</label>
                  <select 
                    id="select-points"
                    value={points}
                    onChange={(e) => setPoints(Number(e.target.value))}
                    className="w-full px-6 py-4 bg-muted border border-border rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-foreground cursor-pointer"
                  >
                    <option value={1}>1P (5,000원 상당)</option>
                    <option value={2}>2P (10,000원 상당)</option>
                    <option value={3}>3P (15,000원 상당)</option>
                    <option value={5}>5P (25,000원 상당)</option>
                    <option value={10}>10P (50,000원 상당)</option>
                  </select>
                </div>

                {/* Location */}
                <div className="space-y-3">
                  <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-2">지급 장소</label>
                  <input 
                    id="input-location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    type="text" 
                    placeholder="예: 울산조선소 제2안전교육장"
                    className="w-full px-6 py-4 bg-muted border border-border rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-foreground"
                  />
                </div>

                {/* Date & Time */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-2">지급 일자</label>
                    <input 
                      type="date"
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      className="w-full px-6 py-4 bg-muted border border-border rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-foreground"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-2">지급 시간</label>
                    <input 
                      type="time"
                      value={customTime}
                      onChange={(e) => setCustomTime(e.target.value)}
                      className="w-full px-6 py-4 bg-muted border border-border rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-foreground"
                    />
                  </div>
                </div>

                {/* Reason */}
                <div className="space-y-3">
                  <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-2">지급 사유 (칭찬 코멘트)</label>
                  <textarea 
                    id="textarea-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={4}
                    placeholder="지급 및 칭찬 사유를 상세하게 작성해주세요. 직원에게 직접 전송 및 노출됩니다."
                    className="w-full px-6 py-6 bg-muted border border-border rounded-3xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-foreground resize-none"
                  />
                </div>

                <div className="pt-4 flex gap-4">
                  <button 
                    id="btn-cancel-create"
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="flex-1 py-5 bg-muted border border-border text-muted-foreground rounded-2xl font-black text-sm hover:bg-muted/80 transition-all cursor-pointer"
                  >
                    취소
                  </button>
                  <button 
                    id="btn-submit-create"
                    type="submit"
                    className="flex-[2] py-5 bg-blue-600 text-white rounded-2xl font-black text-sm hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/20 flex items-center justify-center gap-3 cursor-pointer"
                  >
                    <Send className="w-5 h-5 fill-white" />
                    쿠폰 지급하기
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Edit Coupon Modal */}
        {isEditModalOpen && editingCoupon && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="bg-card w-full max-w-lg rounded-[3rem] shadow-2xl border border-border overflow-hidden flex flex-col"
            >
              <div className="px-10 py-8 bg-[#1e293b] text-white flex justify-between items-center border-b border-border">
                <div className="flex items-center gap-4">
                  <Trophy className="w-8 h-8 text-amber-400" />
                  <h3 className="text-2xl font-black tracking-tight">쿠폰 지급내역 및 정보 수정</h3>
                </div>
                <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors cursor-pointer">
                  <X className="w-6 h-6 text-white" />
                </button>
              </div>
              
              <form onSubmit={handleUpdateCoupon} className="p-10 space-y-6 bg-card text-foreground overflow-y-auto max-h-[75vh]">
                
                {/* Search and Select User for Edit */}
                <div className="space-y-3">
                  <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-2">수혜 대상자 수정</label>
                  {editUserUid ? (
                    <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-500 text-white rounded-xl flex items-center justify-center font-black">
                          {users.find(u => u.uid === editUserUid)?.displayName?.[0] || 'U'}
                        </div>
                        <div>
                          <p className="text-sm font-black text-foreground">
                            {users.find(u => u.uid === editUserUid)?.displayName}
                          </p>
                          <p className="text-[10px] font-bold text-muted-foreground">
                            사번: {users.find(u => u.uid === editUserUid)?.employeeId} | 부서: {users.find(u => u.uid === editUserUid)?.departmentName} | 실제 잔여: {(users.find(u => u.uid === editUserUid)?.points ?? 0).toLocaleString()}P
                          </p>
                        </div>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => { setEditUserUid(''); setEditUserSearchQuery(''); }}
                        className="p-2 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2 relative">
                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input 
                          type="text"
                          placeholder="사원명 또는 사번 입력..."
                          value={editUserSearchQuery}
                          onChange={(e) => setEditUserSearchQuery(e.target.value)}
                          className="w-full pl-12 pr-6 py-4 bg-muted border border-border rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-foreground"
                        />
                      </div>
                      {editUserSearchQuery.trim() && (
                        <div className="absolute left-0 right-0 top-full mt-2 bg-card border border-border rounded-2xl shadow-xl max-h-48 overflow-y-auto z-[110] divide-y divide-border">
                          {filteredUsersForEditSelect.slice(0, 5).map(user => (
                            <button
                              key={user.uid}
                              type="button"
                              onClick={() => setEditUserUid(user.uid)}
                              className="w-full px-5 py-3 text-left hover:bg-muted transition-colors flex items-center justify-between"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-black text-foreground">{user.displayName}</span>
                                  <span className="text-[10px] font-bold text-slate-400">({user.departmentName || '부서미정'})</span>
                                </div>
                                <span className="text-[10px] font-black text-amber-500 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-md w-fit whitespace-nowrap">
                                  잔여: {(user.points ?? 0).toLocaleString()}P
                                </span>
                              </div>
                              <span className="text-[10px] font-bold text-slate-400">사번: {user.employeeId}</span>
                            </button>
                          ))}
                          {filteredUsersForEditSelect.length === 0 && (
                            <div className="px-5 py-3 text-center text-xs text-muted-foreground">일치하는 직원이 없습니다.</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Edit Points */}
                <div className="space-y-3">
                  <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-2">쿠폰 포인트 수정</label>
                  <select 
                    id="edit-points"
                    value={editPoints}
                    onChange={(e) => setEditPoints(Number(e.target.value))}
                    className="w-full px-6 py-4 bg-muted border border-border rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-foreground cursor-pointer"
                  >
                    <option value={1}>1P (5,000원 상당)</option>
                    <option value={2}>2P (10,000원 상당)</option>
                    <option value={3}>3P (15,000원 상당)</option>
                    <option value={5}>5P (25,000원 상당)</option>
                    <option value={10}>10P (50,000원 상당)</option>
                  </select>
                </div>

                {/* Edit Payout Status */}
                <div className="space-y-3">
                  <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-2">지급 상태 수정</label>
                  <select 
                    id="edit-status"
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as 'PENDING' | 'COMPLETED')}
                    className="w-full px-6 py-4 bg-muted border border-border rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-foreground cursor-pointer"
                  >
                    <option value="PENDING">지급 대기 (Pending)</option>
                    <option value="COMPLETED">지급 완료 (Completed)</option>
                  </select>
                </div>

                {/* Edit Location */}
                <div className="space-y-3">
                  <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-2">지급 장소 수정</label>
                  <input 
                    id="edit-location"
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    type="text" 
                    placeholder="지급 장소 입력"
                    className="w-full px-6 py-4 bg-muted border border-border rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-foreground"
                  />
                </div>

                {/* Edit Date & Time */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-2">지급 일자</label>
                    <input 
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full px-6 py-4 bg-muted border border-border rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-foreground"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-2">지급 시간</label>
                    <input 
                      type="time"
                      value={editTime}
                      onChange={(e) => setEditTime(e.target.value)}
                      className="w-full px-6 py-4 bg-muted border border-border rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-foreground"
                    />
                  </div>
                </div>

                {/* Edit Reason */}
                <div className="space-y-3">
                  <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-2">지급 사유 수정</label>
                  <textarea 
                    id="edit-reason"
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    rows={4}
                    placeholder="지급 사유 입력"
                    className="w-full px-6 py-6 bg-muted border border-border rounded-3xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-foreground resize-none"
                  />
                </div>

                <div className="pt-4 flex gap-4">
                  <button 
                    id="btn-cancel-edit"
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="flex-1 py-5 bg-muted border border-border text-muted-foreground rounded-2xl font-black text-sm hover:bg-muted/80 transition-all cursor-pointer"
                  >
                    취소
                  </button>
                  <button 
                    id="btn-submit-edit"
                    type="submit"
                    className="flex-[2] py-5 bg-blue-600 text-white rounded-2xl font-black text-sm hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/20 flex items-center justify-center gap-3 cursor-pointer"
                  >
                    수정 완료
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </div>
    </PCAdminLayout>
  );
};

export default PCAdminCoupons;
