import React, { useEffect, useRef } from 'react';
import { db } from '@/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  updateDoc, 
  doc,
  limit
} from 'firebase/firestore';
import { useAuth } from './AuthProvider';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { handleFirestoreError, OperationType } from '../lib/errorHandlers';

export const GhostGuardTracker: React.FC = () => {
  const { profile } = useAuth();
  const lastMovementTimeRef = useRef<number>(Date.now());
  const isClockedInRef = useRef<boolean>(false);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Constants
  const IMMOBILE_THRESHOLD_MS = 15 * 60 * 1000; // 15분
  const MOVEMENT_THRESHOLD = 0.5; // 가속도 변화 임계값

  useEffect(() => {
    if (!profile || !profile.ghostGuardEnabled) return;

    // 1. 오늘 출근 여부 확인 리스너
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const q = query(
      collection(db, 'attendance'),
      where('uid', '==', profile.uid),
      where('date', '==', todayStr),
      limit(1)
    );

    const unsubscribeAttendance = onSnapshot(q, (snapshot) => {
      const att = snapshot.docs[0]?.data();
      isClockedInRef.current = !!(att && att.clockIn && !att.clockOut);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'attendance_daily_ghost');
    });

    // 2. 가속도 센서 시작
    let sensor: any = null;
    let fallbackCleanup: (() => void) | null = null;
    
    const startSensor = async () => {
      if ('LinearAccelerationSensor' in window) {
        try {
          sensor = new (window as any).LinearAccelerationSensor({ frequency: 1 });
          sensor.addEventListener('reading', () => {
            const { x, y, z } = sensor;
            const acceleration = Math.sqrt(x * x + y * y + z * z);
            
            if (acceleration > MOVEMENT_THRESHOLD) {
              lastMovementTimeRef.current = Date.now();
              // 만약 이전에 무동작 판정이었다면 해제
              if (profile.isImmobile) {
                updateDoc(doc(db, 'users', profile.uid), {
                  isImmobile: false,
                  lastMovementAt: new Date().toISOString()
                }).catch(() => {});
              }
            }
          });
          sensor.start();
        } catch (e) {
          console.warn("GhostGuard: LinearAccelerationSensor failed, falling back to devicemotion");
          setupFallback();
        }
      } else {
        setupFallback();
      }
    };

    const setupFallback = () => {
      const handleMotion = (event: DeviceMotionEvent) => {
        const acc = event.acceleration;
        if (!acc) return;
        const x = acc.x || 0;
        const y = acc.y || 0;
        const z = acc.z || 0;
        const acceleration = Math.sqrt(x * x + y * y + z * z);

        if (acceleration > MOVEMENT_THRESHOLD) {
          lastMovementTimeRef.current = Date.now();
        }
      };
      window.addEventListener('devicemotion', handleMotion);
      fallbackCleanup = () => {
        window.removeEventListener('devicemotion', handleMotion);
      };
    };

    startSensor();

    // 3. 무동작 체크 타이머
    checkIntervalRef.current = setInterval(async () => {
      if (!isClockedInRef.current) return;

      // 점심시간 체크 (12:00 ~ 13:00)
      const now = new Date();
      const hours = now.getHours();
      if (hours === 12) return; 

      const timeSinceLastMovement = Date.now() - lastMovementTimeRef.current;

      if (timeSinceLastMovement >= IMMOBILE_THRESHOLD_MS && !profile.isImmobile) {
        try {
          // 1차 경고 (로컬 알림/진동)
          if (navigator.vibrate) navigator.vibrate([500, 200, 500]);
          
          toast.error("무동작 감지 알림", {
            description: "15분간 움직임이 없습니다. 응답이 없으면 관리자에게 알림이 전송됩니다.",
            duration: 10000,
          });

          // 실제 DB 업데이트 (관리자 전송)
          await updateDoc(doc(db, 'users', profile.uid), {
            isImmobile: true,
            lastMovementAt: new Date(lastMovementTimeRef.current).toISOString()
          });
        } catch (e) {
          console.error("GhostGuard alert failed", e);
        }
      }
    }, 30000); // 30초마다 체크

    return () => {
      if (sensor) sensor.stop();
      if (fallbackCleanup) fallbackCleanup();
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
      unsubscribeAttendance();
    };
  }, [profile?.uid, profile?.ghostGuardEnabled, profile?.isImmobile]);

  return null;
};
