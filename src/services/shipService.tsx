import React from 'react';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, arrayUnion, increment } from 'firebase/firestore';
import { toast } from 'sonner';

export const SHIP_PARTS = [
  { id: 'ENGINE', name: '⚡ 강력한 엔진', description: '함선의 심장부입니다.' },
  { id: 'PROPELLER', name: '🌬️ 대형 프로펠러', description: '추진력을 만들어냅니다.' },
  { id: 'RADAR', name: '📡 정밀 레이더', description: '장애물을 감지합니다.' },
  { id: 'DECK', name: '🚢 넓은 갑판', description: '승선 공간을 확보합니다.' },
  { id: 'HULL', name: '🛡️ 견고한 선체', description: '함선의 뼈대입니다.' },
  { id: 'MAST', name: '🚩 높은 돛대', description: '신호를 전달합니다.' },
  { id: 'ANCHOR', name: '⚓ 무거운 닻', description: '함선을 고정시킵니다.' },
  { id: 'RUDDER', name: '☸️ 방향타', description: '진로를 결정합니다.' },
  { id: 'CABIN', name: '🏠 선실', description: '승무원들의 쉼터입니다.' },
  { id: 'CRANE', name: '🏗️ 대형 크레인', description: '하물을 적재합니다.' },
];

export const PART_ICONS: Record<string, any> = {
  ENGINE: 'Zap',
  PROPELLER: 'Fan',
  RADAR: 'Radar',
  DECK: 'Layout',
  HULL: 'Shield',
  MAST: 'Flag',
  ANCHOR: 'Anchor',
  RUDDER: 'Compass',
  CABIN: 'Home',
  CRANE: 'Wrench',
};

import { motion, AnimatePresence } from 'motion/react';
import * as Icons from 'lucide-react';
const { Ship, Sparkles, Zap, Fan, Radar, Layout, Shield, Flag, Anchor, Compass, Home, Wrench } = Icons;

export async function grantRandomShipPart(uid: string, actionName: string) {
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) return;
    
    const userData = userSnap.data();
    
    // Day limit check
    const todayStr = new Date().toISOString().split('T')[0];
    const lastGrantStr = userData.lastShipPartGrantAt?.split('T')[0];
    
    if (lastGrantStr === todayStr) {
      console.log("Already granted a part today for user", uid);
      
      // Only show the "already reached limit" message once per session to avoid annoying the user
      const limitKey = `ship_part_limit_notified_${todayStr}`;
      if (!sessionStorage.getItem(limitKey)) {
        // Deterministically show it once to inform the user
        toast.info('오늘의 부품 획득 기회를 이미 사용하셨습니다. 내일 다시 시도해주세요!', {
          description: '함선 부품은 하루에 한 번만 획득할 수 있습니다.'
        });
        sessionStorage.setItem(limitKey, 'true');
      }
      return; 
    }

    // Fetch config
    const configSnap = await getDoc(doc(db, 'settings', 'shipParts'));
    const config = configSnap.exists() ? configSnap.data() : { probability: 0.3, disabledParts: [] };
    
    const probability = config.probability ?? 0.3;
    const disabledParts = config.disabledParts ?? [];

    // Probability check
    if (Math.random() > probability) return;

    // Filter available parts
    const availableParts = SHIP_PARTS.filter(p => !disabledParts.includes(p.id));
    if (availableParts.length === 0) return;

    // Pick a random part
    const randomPart = availableParts[Math.floor(Math.random() * availableParts.length)];
    const IconName = PART_ICONS[randomPart.id] || 'Box';
    const PartIcon = (Icons as any)[IconName] || Icons.Box;

    // We want to support duplicates, so we don't use arrayUnion but fetch/update
    const currentParts = userData.shipParts || [];
    const newParts = [...currentParts, randomPart.id];
    const count = newParts.filter(id => id === randomPart.id).length;

    await updateDoc(userRef, {
      shipParts: newParts,
      lastShipPartGrantAt: new Date().toISOString()
    });

    // Custom Centered Reward Popup
    toast.custom((t) => (
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-[100] p-4">
        <motion.div 
          initial={{ scale: 0.5, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0 }}
          className="bg-card rounded-[2.5rem] p-8 shadow-2xl border border-white/10 flex flex-col items-center text-center gap-6 pointer-events-auto max-w-sm ring-1 ring-white/5"
        >
          <div className="relative">
            <div className="w-24 h-24 bg-primary rounded-[2.5rem] flex items-center justify-center shadow-xl shadow-primary/30 border-4 border-white/20">
              <PartIcon className="w-12 h-12 text-white" />
            </div>
            <div className="absolute -top-2 -right-2 w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center border-4 border-[#121212] shadow-lg animate-bounce">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            {count > 1 && (
              <div className="absolute -bottom-2 -right-2 bg-slate-900 text-white px-3 py-1 rounded-xl border-2 border-white shadow-lg font-black text-xs">
                x{count}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <span className="text-[11px] font-black text-primary uppercase tracking-[0.4em] block bg-primary/5 py-2 px-4 rounded-full">Reward Found</span>
            <h3 className="text-3xl font-black text-white leading-tight tracking-tighter">함선 부품 획득!</h3>
            <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
              <p className="text-sm font-bold text-white/80">
                <span className="text-white/40">[{actionName}] 활동 보상</span><br />
                <span className="text-primary font-black text-lg">{randomPart.name}</span>을(를) 찾았습니다.
              </p>
            </div>
          </div>

          <button 
            onClick={() => toast.dismiss(t)}
            className="w-full h-14 bg-primary text-white rounded-2xl font-black text-sm active:scale-95 transition-all shadow-xl shadow-primary/20"
          >
            확인
          </button>
        </motion.div>
      </div>
    ), { 
      duration: 5000,
      position: 'top-center'
    });
    
    return randomPart;
  } catch (error) {
    console.error("Error granting ship part:", error);
  }
}
