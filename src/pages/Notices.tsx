import React, { useEffect, useState } from 'react';
import { db } from '@/src/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Notice } from '@/src/types';
import { useAuth } from '@/src/components/AuthProvider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Megaphone, 
  Search, 
  ChevronRight, 
  Clock, 
  User,
} from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { grantRandomShipPart } from '@/src/services/shipService';

export const Notices: React.FC = () => {
  const { profile } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'notices'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notice)));
    });
    return () => unsubscribe();
  }, []);

  const filteredNotices = notices.filter(n => 
    n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    n.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-24 px-1">
      <header className="py-6">
        <h2 className="text-3xl font-black tracking-tight text-white leading-tight">공지사항</h2>
        <p className="text-muted-foreground font-bold">회사 소식을 가장 빠르게 확인하세요</p>
      </header>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
        <Input 
          placeholder="검색" 
          className="h-14 pl-11 bg-card border-white/5 rounded-2xl text-white font-bold"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        {filteredNotices.length > 0 ? filteredNotices.map((notice) => (
          <div 
            key={notice.id} 
            className="bg-card p-5 rounded-2xl border border-white/5 flex items-start gap-4 cursor-pointer active:scale-[0.98] transition-all"
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
                  <span className="text-[10px] font-bold text-muted-foreground">{format(new Date(notice.createdAt), 'MM.dd')}</span>
               </div>
               <h4 className="text-base font-black text-white tracking-tight truncate">{notice.title}</h4>
               <p className="text-xs text-muted-foreground font-bold line-clamp-1">{notice.content}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-white/10 self-center" />
          </div>
        )) : (
          <div className="py-20 text-center opacity-30">
            <Megaphone className="w-16 h-16 mx-auto mb-4" />
            <p className="font-black text-sm">공지사항이 없습니다</p>
          </div>
        )}
      </div>

      <Dialog open={!!selectedNotice} onOpenChange={(open) => !open && setSelectedNotice(null)}>
        <DialogContent className="bg-card border-none rounded-3xl text-white max-w-[90vw] sm:max-w-md p-0 overflow-hidden">
          {selectedNotice && (
            <div className="flex flex-col">
              <div className="p-8 pb-6 flex flex-col items-center text-center gap-4">
                <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center">
                  <Megaphone className={cn("w-8 h-8", selectedNotice.isImportant ? "text-red-500" : "text-primary")} />
                </div>
                <div className="space-y-1">
                  {selectedNotice.isImportant && <Badge className="bg-red-500/20 text-red-500 border-none mb-1">핵심 공지</Badge>}
                  <DialogTitle className="text-xl font-black tracking-tight leading-tight">{selectedNotice.title}</DialogTitle>
                  <div className="flex items-center justify-center gap-4 mt-2">
                     <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> {format(new Date(selectedNotice.createdAt), 'yyyy.MM.dd HH:mm')}</span>
                     <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1"><User className="w-3 h-3" /> {selectedNotice.authorName}</span>
                  </div>
                </div>
              </div>
              <div className="px-8 pb-8 max-h-[40vh] overflow-y-auto">
                <p className="text-sm font-bold text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {selectedNotice.content}
                </p>
              </div>
              <div className="p-6 pt-0 border-t border-white/5">
                <Button 
                  onClick={() => setSelectedNotice(null)}
                  className="w-full h-14 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-black mt-6"
                >
                  확인
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');
