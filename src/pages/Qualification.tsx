import React, { useState, useEffect } from 'react';
import { useAuth } from '@/src/components/AuthProvider';
import { db } from '@/src/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Award, 
  ShieldAlert, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle,
  HardHat,
  Tractor,
  Flame,
  Construction
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO, isAfter } from 'date-fns';

interface Qualification {
  id: string;
  name: string;
  category: 'WELDING' | 'CRANE' | 'FORKLIFT' | 'SCAFFOLDING' | 'SAFETY';
  level: string;
  issueDate: string;
  expiryDate: string;
  issuer: string;
}

interface PPE {
  id: string;
  name: string;
  serialNumber: string;
  lastInspection: string;
  nextInspection: string;
  status: 'SAFE' | 'WARN' | 'DANGER';
}

export const Qualification: React.FC = () => {
  const { profile } = useAuth();
  const [qualifications, setQualifications] = useState<Qualification[]>([]);
  const [ppeItems, setPpeItems] = useState<PPE[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;

    // In a real app, these would come from Firestore
    // For now, providing realistic shipyard mock data based on role
    const mockQuals: Qualification[] = [
      {
        id: 'q1',
        name: '용접 전문 자격 (ABS Class)',
        category: 'WELDING',
        level: '6G',
        issueDate: '2025-01-15',
        expiryDate: '2026-01-14',
        issuer: '한국선급 (KR)'
      },
      {
        id: 'q2',
        name: '비계 설치 자격',
        category: 'SCAFFOLDING',
        level: '전문급',
        issueDate: '2024-05-10',
        expiryDate: '2027-05-09',
        issuer: '한국산업인력공단'
      }
    ];

    const mockPpe: PPE[] = [
      {
        id: 'p1',
        name: '안전벨트 (Full Body Harness)',
        serialNumber: 'S-2024-0012',
        lastInspection: '2026-03-01',
        nextInspection: '2026-09-01',
        status: 'SAFE'
      },
      {
        id: 'p2',
        name: '용접면 (Auto-Darkening Helmet)',
        serialNumber: 'W-HELM-442',
        lastInspection: '2025-10-15',
        nextInspection: '2026-04-15',
        status: 'WARN'
      }
    ];

    setQualifications(mockQuals);
    setPpeItems(mockPpe);
    setLoading(false);
  }, [profile]);

  const getCategoryIcon = (cat: string) => {
    switch(cat) {
      case 'WELDING': return <Flame className="w-5 h-5 text-orange-500" />;
      case 'CRANE': return <Construction className="w-5 h-5 text-blue-500" />;
      case 'FORKLIFT': return <Tractor className="w-5 h-5 text-emerald-500" />;
      default: return <Award className="w-5 h-5 text-primary" />;
    }
  };

  const isExpired = (date: string) => {
    return isAfter(new Date(), parseISO(date));
  };

  return (
    <div className="space-y-8 pb-32 px-1">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <div className="w-2 h-6 bg-primary rounded-full" />
          <h2 className="text-3xl font-black tracking-tighter text-white">자격 및 안전 장비</h2>
        </div>
      </header>

      <section className="space-y-4">
        <h3 className="text-sm font-black flex items-center gap-2 text-white ml-2 uppercase tracking-widest">
          <Award className="w-4 h-4 text-primary" /> 보유 자격 및 면허
        </h3>
        <div className="grid gap-4">
          {qualifications.map((q) => (
            <Card key={q.id} className="border-none shadow-none bg-card rounded-3xl overflow-hidden border border-white/5 group transition-all">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5 group-hover:bg-primary/5 transition-colors">
                      {getCategoryIcon(q.category)}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-white">{q.name}</span>
                        <Badge variant="outline" className="text-[9px] font-black h-5 uppercase px-2 border-white/10 text-muted-foreground">{q.level}</Badge>
                      </div>
                      <p className="text-[10px] font-bold text-muted-foreground">{q.issuer}</p>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    <Badge className={cn(
                      "font-black text-[9px] px-2 py-0.5 rounded-full border-none",
                      isExpired(q.expiryDate) ? "bg-red-500/20 text-red-500" : "bg-emerald-500/20 text-emerald-500"
                    )}>
                      {isExpired(q.expiryDate) ? '만료됨' : '유효함'}
                    </Badge>
                    <span className="text-[9px] font-bold text-white/20">만료일: {q.expiryDate}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4 pt-4">
        <h3 className="text-sm font-black flex items-center gap-2 text-white ml-2 uppercase tracking-widest">
          <HardHat className="w-4 h-4 text-primary" /> 안전 장비(PPE) 점검 현황
        </h3>
        <Card className="border-none shadow-none bg-card rounded-[2.5rem] overflow-hidden border border-white/5">
          <CardContent className="p-6">
            <div className="space-y-6">
              {ppeItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center border transition-all",
                      item.status === 'SAFE' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" :
                      item.status === 'WARN' ? "bg-amber-500/10 border-amber-500/20 text-amber-500" :
                      "bg-red-500/10 border-red-500/20 text-red-500 animate-pulse"
                    )}>
                      {item.status === 'SAFE' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-xs font-black text-white">{item.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">{item.serialNumber}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] font-black text-white/20 uppercase tracking-widest leading-none mb-1">다음 점검일</div>
                    <div className={cn(
                      "text-xs font-black tracking-tight",
                      item.status === 'SAFE' ? "text-white" : "text-amber-500"
                    )}>{item.nextInspection}</div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-8 p-6 bg-white/5 rounded-3xl border border-white/5">
               <div className="flex items-start gap-3">
                 <ShieldAlert className="w-4 h-4 text-primary mt-0.5" />
                 <div className="space-y-1">
                   <p className="text-[10px] font-black text-white">장비 점검 알림</p>
                   <p className="text-[9px] font-bold text-muted-foreground leading-relaxed">
                     조선소 안전 규정에 따라 고소 작업용 안전 벨트와 용접면은 6개월마다 정기 점검이 필수입니다. 
                     만료 15일 전부터 점검 요청이 가능합니다.
                   </p>
                 </div>
               </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};
