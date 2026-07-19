import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, doc, setDoc, limit } from 'firebase/firestore';
import { db } from '../firebase';
import PCAdminLayout from '../components/PCAdminLayout';
import { 
  ShieldCheck, 
  Save, 
  AlertTriangle, 
  Settings, 
  Info,
  ChevronRight,
  Plus
} from 'lucide-react';
import { toast } from 'sonner';

const PCAdminSafety: React.FC = () => {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const q = query(collection(db, 'safetyScoreConfig'), orderBy('updatedAt', 'desc'), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setConfig(snap.docs[0].data());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PCAdminLayout title="지능형 안전지수 시스템 설정">
      <div className="max-w-5xl mx-auto space-y-10 pb-20 text-foreground">
        <div className="bg-card rounded-[3rem] p-12 border border-border shadow-sm relative overflow-hidden">
          <div className="relative z-10">
             <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500 shadow-sm">
                   <ShieldCheck className="w-8 h-8" />
                </div>
                <div>
                   <h3 className="text-2xl font-black text-foreground tracking-tight">안전 점수 산출 로직 관리</h3>
                   <p className="text-muted-foreground font-bold">임직원 개개인의 안전지수를 결정하는 가중치와 기준을 설정합니다.</p>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-6">
                   <h4 className="text-sm font-black text-foreground uppercase tracking-widest flex items-center gap-2">
                      <Settings className="w-4 h-4 text-blue-500" />
                      기본 가점 기준
                   </h4>
                   {[
                     { label: '교육 이수 가점', value: '10', unit: '점' },
                     { label: '우수 제안 채택', value: '5', unit: '점' },
                     { label: '현장 정리 정돈', value: '3', unit: '점' },
                   ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-5 bg-muted rounded-2xl border border-border">
                       <span className="text-sm font-bold text-muted-foreground">{item.label}</span>
                       <input type="number" defaultValue={item.value} className="w-20 text-right bg-background border border-border rounded-xl px-3 py-2 text-sm font-black focus:ring-2 focus:ring-blue-500/10 text-foreground" />
                    </div>
                   ))}
                </div>

                <div className="space-y-6">
                   <h4 className="text-sm font-black text-rose-500 uppercase tracking-widest flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      위험 행위 감점 기준
                   </h4>
                   {[
                     { label: '보호구 미착용', value: '15', unit: '점' },
                     { label: '음주/흡연 수칙 위반', value: '30', unit: '점' },
                     { label: '고소작업 안전 위반', value: '20', unit: '점' },
                   ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-5 bg-rose-500/5 rounded-2xl border border-rose-500/15">
                       <span className="text-sm font-bold text-muted-foreground">{item.label}</span>
                       <div className="flex items-center gap-2">
                          <span className="text-rose-500 font-black">-</span>
                          <input type="number" defaultValue={item.value} className="w-20 text-right bg-background border border-rose-500/15 rounded-xl px-3 py-2 text-sm font-black focus:ring-2 focus:ring-rose-500/10 text-foreground" />
                       </div>
                    </div>
                   ))}
                </div>
             </div>

             <div className="mt-12 p-8 bg-blue-600 rounded-[2rem] text-white flex items-center justify-between shadow-2xl shadow-blue-600/20">
                <div className="flex items-center gap-4">
                   <Info className="w-6 h-6 text-blue-200" />
                   <div>
                      <p className="font-black text-lg">설정값을 즉시 적용하시겠습니까?</p>
                      <p className="text-blue-100 text-sm font-medium opacity-80">저장 시 현재 모든 임직원의 점수가 재산출됩니다.</p>
                   </div>
                </div>
                <button className="px-8 py-4 bg-white text-blue-600 rounded-2xl font-black text-sm hover:bg-slate-50 transition-all shadow-xl flex items-center gap-2">
                   <Save className="w-5 h-5" />
                   설정 데이터 저장
                </button>
             </div>
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 rounded-full blur-[120px] opacity-10 pointer-events-none -mr-32 -mt-32" />
        </div>
      </div>
    </PCAdminLayout>
  );
};

export default PCAdminSafety;
