import React, { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '@/firebase';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { Notice } from '@/types';
import { useAuth } from '@/components/AuthProvider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Megaphone, 
  Search, 
  ChevronRight, 
  Clock, 
  User,
  Trash2,
  Volume2,
} from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { grantRandomShipPart } from '@/services/shipService';
import { AlertSoundPlayer } from '@/lib/sound';

export const Notices: React.FC = () => {
  const { profile } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [displayLimit, setDisplayLimit] = useState(5);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [noticeToDelete, setNoticeToDelete] = useState<string | null>(null);
  const [preferredNarrator, setPreferredNarrator] = useState<'standard-female' | 'deep-male' | 'cheerful-female'>(
    AlertSoundPlayer.getNarrator()
  );

  useEffect(() => {
    localStorage.setItem('lastViewedNoticesTime', new Date().toISOString());
    const q = query(collection(db, 'notices'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notice)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'notices'));
    return () => unsubscribe();
  }, []);

  const filteredNotices = notices.filter(n => 
    n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    n.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDeleteNotice = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notices', id));
      toast.success('공지사항이 삭제되었습니다.');
      setSelectedNotice(null);
      setIsDeleteOpen(false);
      setNoticeToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `notices/${id}`);
    }
  };

  const isAdmin = profile?.role === 'CEO' || 
                  profile?.role === 'DIRECTOR' || 
                  profile?.role === 'GENERAL_AFFAIRS' || 
                  profile?.role === 'SAFETY_MANAGER' ||
                  profile?.permissions?.includes('admin') ||
                  profile?.permissions?.includes('notice_mgmt') ||
                  profile?.email === 'tjrwnfjqm1@gmail.com' ||
                  profile?.email === 'tjrwnef@gmail.com'; // Added other variants if needed, but the primary one is tjrwnfjqm1@gmail.com

  return (
    <div className="space-y-6 pb-24 px-2">
      <header className="py-6">
        <h2 className="text-3xl font-black tracking-tight text-foreground leading-tight">공지사항</h2>
        <p className="text-muted-foreground font-bold">회사 소식을 가장 빠르게 확인하세요</p>
      </header>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
        <Input 
          placeholder="검색" 
          className="h-14 pl-11 bg-card border-border rounded-2xl text-foreground font-bold placeholder:text-muted-foreground/30"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* 성우 설정 (Voice Selector Card) */}
      <Card className="bg-card border-border rounded-2xl p-4 overflow-hidden shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-foreground flex items-center gap-1.5">
              <Volume2 className="w-4 h-4 text-primary" />
              공지 음성 방송 성우 설정
            </h3>
            <p className="text-[11px] text-muted-foreground font-bold mt-0.5">공지사항을 낭독할 성우 목소리를 선택하세요.</p>
          </div>
          <div className="flex items-center gap-1 bg-muted p-1 rounded-xl shrink-0 self-start sm:self-center">
            <Button
              variant={preferredNarrator === 'standard-female' ? 'secondary' : 'ghost'}
              size="sm"
              className={cn(
                "h-8 rounded-lg text-xs font-black px-2.5",
                preferredNarrator === 'standard-female' ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => {
                AlertSoundPlayer.setNarrator('standard-female');
                setPreferredNarrator('standard-female');
                AlertSoundPlayer.speak("차분한 아나운서 목소리로 설정되었습니다.");
              }}
            >
              👩‍💼 아나운서
            </Button>
            <Button
              variant={preferredNarrator === 'deep-male' ? 'secondary' : 'ghost'}
              size="sm"
              className={cn(
                "h-8 rounded-lg text-xs font-black px-2.5",
                preferredNarrator === 'deep-male' ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => {
                AlertSoundPlayer.setNarrator('deep-male');
                setPreferredNarrator('deep-male');
                AlertSoundPlayer.speak("신뢰감 있는 남성 성우 목소리로 설정되었습니다.");
              }}
            >
              👨‍💼 남성 성우
            </Button>
            <Button
              variant={preferredNarrator === 'cheerful-female' ? 'secondary' : 'ghost'}
              size="sm"
              className={cn(
                "h-8 rounded-lg text-xs font-black px-2.5",
                preferredNarrator === 'cheerful-female' ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => {
                AlertSoundPlayer.setNarrator('cheerful-female');
                setPreferredNarrator('cheerful-female');
                AlertSoundPlayer.speak("맑고 부드러운 가이드 목소리로 설정되었습니다.");
              }}
            >
              👧 가이드
            </Button>
          </div>
        </div>
      </Card>

      <div className="space-y-2">
        {filteredNotices.length > 0 ? (
          <>
            {filteredNotices.slice(0, displayLimit).map((notice) => (
              <div 
                key={notice.id} 
                className="bg-card p-5 rounded-2xl border border-border flex items-start gap-4 cursor-pointer active:scale-[0.98] transition-all"
                onClick={() => {
                  setSelectedNotice(notice);
                  if (profile?.uid) {
                    grantRandomShipPart(profile.uid, '공지사항 상세 확인');
                  }
                }}
              >
                <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center shrink-0">
                  <Megaphone className={cn("w-5 h-5", notice.isImportant ? "text-red-500" : "text-primary")} />
                </div>
                <div className="flex-1 space-y-1 overflow-hidden">
                  <div className="flex items-center justify-between">
                    {notice.isImportant && (
                      <Badge className="bg-red-500/20 text-red-500 border-none text-[8px] px-1.5 h-4 mb-1">URGENT</Badge>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-muted-foreground">{format(new Date(notice.createdAt), 'MM.dd')}</span>
                      {isAdmin && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="w-6 h-6 rounded-md text-white/20 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setNoticeToDelete(notice.id);
                            setIsDeleteOpen(true);
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <h4 className="text-base font-black text-foreground tracking-tight truncate">{notice.title}</h4>
                  <p className="text-xs text-muted-foreground font-bold line-clamp-1">{notice.content}</p>
                </div>
                <div className="flex items-center gap-1.5 self-center shrink-0">
                  <Button
                    variant="outline"
                    size="icon"
                    className="w-8 h-8 rounded-full border-primary/20 text-primary hover:bg-primary/5 active:scale-90 transition-transform"
                    onClick={(e) => {
                      e.stopPropagation();
                      AlertSoundPlayer.trigger('notice', `${notice.title}. ${notice.content}`);
                    }}
                    title="음성으로 듣기"
                  >
                    <Volume2 className="w-4 h-4" />
                  </Button>
                  <ChevronRight className="w-5 h-5 text-muted-foreground/30" />
                </div>
              </div>
            ))}
            
            {filteredNotices.length > displayLimit && (
              <Button 
                variant="ghost" 
                className="w-full h-14 bg-muted hover:bg-muted/80 text-muted-foreground font-black rounded-2xl group transition-all"
                onClick={() => setDisplayLimit(prev => prev + 5)}
              >
                더 보기
                <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            )}
          </>
        ) : (
          <div className="py-20 text-center opacity-30">
            <Megaphone className="w-16 h-16 mx-auto mb-4" />
            <p className="font-black text-sm">공지사항이 없습니다</p>
          </div>
        )}
      </div>

      <Dialog open={!!selectedNotice} onOpenChange={(open) => !open && setSelectedNotice(null)}>
        <DialogContent className="bg-card border border-border rounded-3xl text-foreground max-w-[90vw] sm:max-w-md p-0 overflow-hidden">
          {selectedNotice && (
            <div className="flex flex-col">
              <div className="p-8 pb-6 flex flex-col items-center text-center gap-4">
                <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center">
                  <Megaphone className={cn("w-8 h-8", selectedNotice.isImportant ? "text-red-500" : "text-primary")} />
                </div>
                <div className="space-y-1">
                  {selectedNotice.isImportant && <Badge className="bg-red-500/20 text-red-500 border-none mb-1">핵심 공지</Badge>}
                  <DialogTitle className="text-xl font-black tracking-tight leading-tight text-foreground">{selectedNotice.title}</DialogTitle>
                  <div className="flex items-center justify-center gap-4 mt-2">
                     <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> {format(new Date(selectedNotice.createdAt), 'yyyy.MM.dd HH:mm')}</span>
                     <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1"><User className="w-3 h-3" /> {selectedNotice.authorName}</span>
                  </div>
                  <div className="mt-4 flex justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-full border-primary/20 text-primary hover:bg-primary/5 font-black text-xs px-3.5 flex items-center gap-1.5"
                      onClick={() => {
                        AlertSoundPlayer.trigger('notice', `${selectedNotice.title}. ${selectedNotice.content}`);
                      }}
                    >
                      <Volume2 className="w-3.5 h-3.5 animate-pulse text-primary" />
                      공지 음성 방송 듣기
                    </Button>
                  </div>
                </div>
              </div>
              <div className="px-8 pb-8 max-h-[40vh] overflow-y-auto">
                <p className="text-sm font-bold text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {selectedNotice.content}
                </p>
              </div>
              <div className="p-6 pt-0 border-t border-border space-y-3">
                <Button 
                  onClick={() => setSelectedNotice(null)}
                  className="w-full h-14 bg-primary text-primary-foreground hover:bg-primary/90 rounded-2xl font-black mt-6"
                >
                  확인
                </Button>
                {isAdmin && (
                  <Button 
                    variant="ghost"
                    onClick={() => {
                      setNoticeToDelete(selectedNotice.id);
                      setIsDeleteOpen(true);
                    }}
                    className="w-full h-10 text-red-500/50 hover:text-red-500 hover:bg-red-500/5 rounded-xl font-bold flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" /> 공지 삭제
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="bg-card border border-border rounded-[2rem] shadow-2xl max-w-sm w-[90%] p-8 overflow-hidden text-foreground">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center">
              <Trash2 className="w-8 h-8 text-red-500" />
            </div>
            <div className="space-y-1">
              <DialogTitle className="text-xl font-black text-foreground">공지 삭제</DialogTitle>
              <p className="text-muted-foreground font-bold text-xs">
                이 공지사항을 정말 삭제하시겠습니까?<br />이 작업은 되돌릴 수 없습니다.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 pt-6">
            <Button 
              className="w-full h-14 bg-red-500 hover:bg-red-600 text-white font-black rounded-xl"
              onClick={() => noticeToDelete && handleDeleteNotice(noticeToDelete)}
            >
              삭제하기
            </Button>
            <Button 
              variant="ghost"
              className="w-full h-10 text-muted-foreground font-black hover:text-foreground"
              onClick={() => setIsDeleteOpen(false)}
            >
              취소
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
