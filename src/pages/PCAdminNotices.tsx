import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Bell, 
  MoreVertical, 
  Trash2, 
  Edit3, 
  Megaphone,
  Eye,
  Calendar,
  User,
  Filter
} from 'lucide-react';
import { collection, query, getDocs, orderBy, deleteDoc, doc, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import PCAdminLayout from '../components/PCAdminLayout';
import { useAuth } from '../components/AuthProvider';
import { toast } from 'sonner';
import { motion } from 'motion/react';

interface Notice {
  id: string;
  title: string;
  content: string;
  author: string;
  createdAt: any;
  category: string;
  priority: 'low' | 'medium' | 'high';
}

const PCAdminNotices: React.FC = () => {
  const { profile } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);
  const [deleteNoticeId, setDeleteNoticeId] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  
  // Form states
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('전체');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');

  useEffect(() => {
    fetchNotices();
  }, []);

  const fetchNotices = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'notices'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Notice[];
      setNotices(data);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'pc_notices_fetch');
      toast.error('공지사항을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) {
      toast.error('제목과 내용을 모두 입력해주세요.');
      return;
    }

    try {
      if (editingNotice) {
        await updateDoc(doc(db, 'notices', editingNotice.id), {
          title,
          content,
          category,
          priority,
          updatedAt: serverTimestamp()
        });
        toast.success('공지사항이 수정되었습니다.');
      } else {
        await addDoc(collection(db, 'notices'), {
          title,
          content,
          author: profile?.displayName || '관리자',
          category,
          priority,
          createdAt: serverTimestamp()
        });
        toast.success('새 공지사항이 등록되었습니다.');
      }
      setIsModalOpen(false);
      resetForm();
      fetchNotices();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, editingNotice ? `notices/${editingNotice.id}` : 'notices_add');
      toast.error('저장 중 오류가 발생했습니다.');
    }
  };

  const handleDelete = (id: string) => {
    setDeleteNoticeId(id);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteNoticeId) return;
    try {
      await deleteDoc(doc(db, 'notices', deleteNoticeId));
      toast.success('공지사항이 삭제되었습니다.');
      setIsDeleteModalOpen(false);
      setDeleteNoticeId(null);
      fetchNotices();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `notices/${deleteNoticeId}`);
      toast.error('삭제 중 오류가 발생했습니다.');
    }
  };

  const resetForm = () => {
    setTitle('');
    setContent('');
    setCategory('전체');
    setPriority('medium');
    setEditingNotice(null);
  };

  const openEditModal = (notice: Notice) => {
    setEditingNotice(notice);
    setTitle(notice.title);
    setContent(notice.content);
    setCategory(notice.category);
    setPriority(notice.priority);
    setIsModalOpen(true);
  };

  const filteredNotices = notices.filter(notice => {
    const titleVal = notice.title || '';
    const contentVal = notice.content || '';
    return titleVal.toLowerCase().includes(searchTerm.toLowerCase()) ||
           contentVal.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const getAuthorInitial = (author?: string) => {
    if (!author) return '관';
    return author[0] || '관';
  };

  const getAuthorName = (author?: string) => {
    return author || '관리자';
  };

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return '-';
    if (typeof timestamp.toDate === 'function') {
      return timestamp.toDate().toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' });
    }
    if (timestamp instanceof Date) {
      return timestamp.toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' });
    }
    const d = new Date(timestamp);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' });
    }
    return '-';
  };

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case 'high': return <span className="px-2 py-1 bg-rose-500/10 text-rose-500 rounded-full text-[10px] font-black">긴급</span>;
      case 'medium': return <span className="px-2 py-1 bg-blue-500/10 text-blue-500 rounded-full text-[10px] font-black">일반</span>;
      default: return <span className="px-2 py-1 bg-slate-500/10 text-slate-400 rounded-full text-[10px] font-black">안내</span>;
    }
  };

  return (
    <PCAdminLayout title="공지사항 관리">
      <div className="max-w-[1400px] mx-auto space-y-8">
        <div className="flex justify-between items-end">
          <div className="space-y-4">
            <h2 className="text-3xl font-black text-foreground tracking-tight">Announcements</h2>
            <p className="text-muted-foreground font-medium">전 직원에게 전달될 공지사항을 관리합니다.</p>
          </div>
          <button 
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="px-6 py-4 bg-primary text-white rounded-2xl font-black text-sm flex items-center gap-3 hover:bg-primary/95 transition-all shadow-lg"
          >
            <Plus className="w-5 h-5" />
            새 공지사항 등록
          </button>
        </div>

        {/* Search & Filter */}
        <div className="bg-card p-6 rounded-[2rem] border border-border shadow-sm flex gap-4">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-foreground transition-colors" />
            <input 
              type="text" 
              placeholder="제목 또는 내용으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-6 py-4 bg-muted border border-border rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/10 text-foreground transition-all"
            />
          </div>
          <div className="flex gap-2">
            <select className="px-6 py-4 bg-muted border border-border rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all text-muted-foreground">
              <option>모든 카테고리</option>
              <option>현장공지</option>
              <option>인사/복지</option>
              <option>안전교육</option>
              <option>기타</option>
            </select>
          </div>
        </div>

        {/* Notice List */}
        <div className="bg-card rounded-[2.5rem] border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="px-8 py-6 text-[11px] font-black text-muted-foreground uppercase tracking-widest">상태</th>
                  <th className="px-8 py-6 text-[11px] font-black text-muted-foreground uppercase tracking-widest">카테고리</th>
                  <th className="px-8 py-6 text-[11px] font-black text-muted-foreground uppercase tracking-widest w-1/2">제목</th>
                  <th className="px-8 py-6 text-[11px] font-black text-muted-foreground uppercase tracking-widest">작성자</th>
                  <th className="px-8 py-6 text-[11px] font-black text-muted-foreground uppercase tracking-widest">작성일</th>
                  <th className="px-8 py-6 text-[11px] font-black text-muted-foreground uppercase tracking-widest text-center">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  Array(5).fill(0).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={6} className="px-8 py-6 bg-muted/20" />
                    </tr>
                  ))
                ) : filteredNotices.length > 0 ? (
                  filteredNotices.map((notice) => (
                    <tr key={notice.id} className="group hover:bg-muted/50 transition-colors">
                      <td className="px-8 py-6">
                        {getPriorityBadge(notice.priority)}
                      </td>
                      <td className="px-8 py-6 text-sm font-bold text-muted-foreground">
                        {notice.category}
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-black text-foreground group-hover:text-primary transition-colors">{notice.title}</span>
                          <span className="text-xs text-muted-foreground font-medium truncate max-w-lg">{notice.content}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-muted rounded-full flex items-center justify-center text-[10px] font-black text-muted-foreground border border-border">
                             {getAuthorInitial(notice.author)}
                          </div>
                          <span className="text-xs font-bold text-muted-foreground">{getAuthorName(notice.author)}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-xs font-black text-muted-foreground">
                        {formatTimestamp(notice.createdAt)}
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => openEditModal(notice)}
                            className="p-2 bg-muted border border-border rounded-xl hover:bg-primary/10 hover:text-primary transition-all shadow-sm"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(notice.id)}
                            className="p-2 bg-muted border border-border rounded-xl hover:bg-rose-500/10 hover:text-rose-500 transition-all shadow-sm"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-8 py-20 text-center text-muted-foreground font-bold">
                      등록된 공지사항이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="bg-card w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-border"
            >
              <div className="px-10 py-8 bg-[#1e293b] text-white flex justify-between items-center">
                <h3 className="text-2xl font-black tracking-tight">{editingNotice ? '공지사항 수정' : '새 공지사항 작성'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-10 space-y-8 overflow-y-auto">
                <div className="space-y-3">
                  <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-2">제목</label>
                  <input 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    type="text" 
                    placeholder="공지사항 제목을 입력하세요"
                    className="w-full px-6 py-4 bg-muted border border-border rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/10 text-foreground transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-2">카테고리</label>
                    <select 
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-6 py-4 bg-muted border border-border rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/10 text-foreground transition-all"
                    >
                      <option value="전체">전체공지</option>
                      <option value="현장공지">현장공지</option>
                      <option value="인사/복지">인사/복지</option>
                      <option value="안전교육">안전교육</option>
                      <option value="급여">급여안내</option>
                    </select>
                  </div>
                  <div className="space-y-3">
                    <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-2">중요도</label>
                    <div className="flex gap-2">
                      {(['low', 'medium', 'high'] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPriority(p)}
                          className={`flex-1 py-4 rounded-2xl font-black text-xs transition-all border-2 ${
                            priority === p 
                            ? 'bg-primary text-white border-primary shadow-lg shadow-primary/10 scale-105' 
                            : 'bg-muted text-muted-foreground border-transparent hover:bg-muted-foreground/10'
                          }`}
                        >
                          {p === 'high' ? '긴급' : p === 'medium' ? '일반' : '상시'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-2">내용</label>
                  <textarea 
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={8}
                    placeholder="전달할 내용을 상세히 입력하세요..."
                    className="w-full px-6 py-6 bg-muted border border-border rounded-3xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/10 text-foreground resize-none transition-all"
                  />
                </div>

                <div className="pt-4 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-5 bg-muted border border-border text-foreground rounded-2xl font-black text-sm hover:bg-muted-foreground/5 transition-all"
                  >
                    취소
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] py-5 bg-primary text-white rounded-2xl font-black text-sm hover:bg-primary/95 transition-all shadow-xl"
                  >
                    {editingNotice ? '내용 수정하기' : '공지사항 게시하기'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Delete Modal */}
        {isDeleteModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden flex flex-col p-8 space-y-6"
            >
              <div className="text-center space-y-2">
                <h3 className="text-xl font-black text-slate-900">공지사항 삭제 확인</h3>
                <p className="text-xs text-slate-400 font-bold leading-relaxed">
                  정말로 이 공지사항을 삭제하시겠습니까? 삭제된 공지사항은 즉각 대시보드 및 알림판에서 내림 처리되며 복구할 수 없습니다.
                </p>
              </div>
              
              <div className="flex gap-4">
                <button 
                  type="button"
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setDeleteNoticeId(null);
                  }}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs hover:bg-slate-200 transition-all cursor-pointer"
                >
                  취소
                </button>
                <button 
                  type="button"
                  onClick={handleConfirmDelete}
                  className="flex-1 py-4 bg-rose-500 text-white rounded-2xl font-black text-xs hover:bg-rose-600 transition-all shadow-xl shadow-rose-500/15 cursor-pointer"
                >
                  지우기 승인
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </PCAdminLayout>
  );
};

export default PCAdminNotices;
