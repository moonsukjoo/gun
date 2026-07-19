import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Motion } from '@capacitor/motion';
import { useAuth } from './AuthProvider';
import { db } from '../firebase';
import { doc, updateDoc, addDoc, collection, serverTimestamp, onSnapshot, getDocs, query, where } from 'firebase/firestore';
import { ShieldAlert, AlertTriangle, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface SafetySensorContextType {
  isMonitoring: boolean;
  startMonitoring: () => void;
  stopMonitoring: () => void;
  lastAcceleration: { x: number; y: number; z: number } | null;
}

const SafetySensorContext = createContext<SafetySensorContextType | undefined>(undefined);

export const SafetySensorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [lastAcceleration, setLastAcceleration] = useState<{ x: number; y: number; z: number } | null>(null);
  const [alertType, setAlertType] = useState<'FALL' | 'IMPACT' | null>(null);
  const [countdown, setCountdown] = useState(15);
  const [thresholds, setThresholds] = useState({
    impact: 40.0,
    fall: 3.0,
    duration: 150,
    sosTimeout: 15
  });
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fallStartTimeRef = useRef<number | null>(null);
  const isAlertingRef = useRef(false);

  // High-fidelity sensor filtering refs
  const gravityRef = useRef({ x: 0, y: 0, z: 9.8 });
  const gravityInitRef = useRef(false);
  const highAccSamplesRef = useRef(0);
  const smoothedMagnitudeRef = useRef(0);
  const highAccStartTimeRef = useRef<number | null>(null);

  // Phone-agnostic shake filters to prevent false positives under continuous movement
  const peaksHistoryRef = useRef<number[]>([]);
  const isShakingActiveRef = useRef<boolean>(false);
  const lastShakeDetectedAtRef = useRef<number>(0);

  // Web Audio API synthetic siren refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sirenIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  const startSiren = () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      // Stop any existing oscillator to prevent overlapping sirens
      if (oscillatorRef.current) {
        try { oscillatorRef.current.stop(); } catch (e) {}
        oscillatorRef.current.disconnect();
      }
      if (gainNodeRef.current) {
        gainNodeRef.current.disconnect();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime); // moderate volume

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      oscillatorRef.current = osc;
      gainNodeRef.current = gain;

      // Clean up previous sweep interval
      if (sirenIntervalRef.current) {
        clearInterval(sirenIntervalRef.current);
      }

      let high = false;
      const sweep = () => {
        if (!oscillatorRef.current || !audioCtxRef.current) return;
        const targetFreq = high ? 600 : 1000;
        oscillatorRef.current.frequency.exponentialRampToValueAtTime(targetFreq, audioCtxRef.current.currentTime + 0.4);
        high = !high;
      };

      sweep();
      sirenIntervalRef.current = setInterval(sweep, 450);
    } catch (e) {
      console.warn("Failed to start synthetic siren:", e);
    }
  };

  const stopSiren = () => {
    if (sirenIntervalRef.current) {
      clearInterval(sirenIntervalRef.current);
      sirenIntervalRef.current = null;
    }
    if (oscillatorRef.current) {
      try { oscillatorRef.current.stop(); } catch (e) {}
      oscillatorRef.current.disconnect();
      oscillatorRef.current = null;
    }
    if (gainNodeRef.current) {
      gainNodeRef.current.disconnect();
      gainNodeRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopMonitoring();
      stopSiren();
    };
  }, []);

  // Listen for dynamic thresholds from admin settings (statically imported to prevent dynamic import failure)
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'safety_sensors'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setThresholds({
          impact: data.impactThreshold || 40.0,
          fall: data.fallThreshold || 3.0,
          duration: data.fallDuration || 150,
          sosTimeout: data.sosTimeout || 15
        });
      }
    }, (error) => {
      console.error("Firestore onSnapshot error:", error);
    });
    return () => unsub();
  }, []);

  const triggerAlert = (type: 'FALL' | 'IMPACT') => {
    if (isAlertingRef.current) return;
    isAlertingRef.current = true;
    setAlertType(type);
    setCountdown(thresholds.sosTimeout);
    
    startSiren();

    // Start countdown
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          sendEmergencySOS().catch(e => console.error("Auto SOS throw failed:", e));
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const cancelAlert = () => {
    isAlertingRef.current = false;
    setAlertType(null);
    if (timerRef.current) clearInterval(timerRef.current);
    stopSiren();
  };

  const sendEmergencySOS = async () => {
    if (!profile) return;

    try {
      // Update user status
      await updateDoc(doc(db, 'users', profile.uid), {
        isFalling: alertType === 'FALL',
        hasImpacted: alertType === 'IMPACT',
        fallDetectedAt: alertType === 'FALL' ? new Date().toISOString() : null,
        impactDetectedAt: alertType === 'IMPACT' ? new Date().toISOString() : null,
      });

      // Find admins to notify
      const adminQuery = query(
        collection(db, 'users'),
        where('role', 'in', ['CEO', 'DIRECTOR', 'GENERAL_AFFAIRS', 'GENERAL_MANAGER', 'CLERK', 'SAFETY_MANAGER', 'TEAM_LEADER'])
      );
      const adminSnap = await getDocs(adminQuery);
      
      const notificationPromises = adminSnap.docs.map(adminDoc => 
        addDoc(collection(db, 'notifications'), {
          uid: adminDoc.id,
          title: `[긴급] ${alertType === 'FALL' ? '추락' : '충격'} 감지`,
          message: `${profile.displayName} (${profile.employeeId})님의 기기에서 ${alertType === 'FALL' ? '자유 낙하' : '강한 충격'}가 감지되었습니다. 무반응으로 인해 긴급 SOS가 발송되었습니다.`,
          type: 'EMERGENCY',
          isRead: false,
          createdAt: new Date().toISOString(),
          fromUid: profile.uid,
          fromName: profile.displayName
        })
      );

      // Create a critical incident report entry for superiors to authorize
      const criticalIncidentPromise = addDoc(collection(db, 'criticalIncidents'), {
        type: alertType === 'FALL' ? 'FALL' : 'IMPACT',
        typeName: alertType === 'FALL' ? '추락 감지' : '충격 감지',
        uid: profile.uid,
        displayName: profile.displayName || '이름없음',
        employeeId: profile.employeeId || '',
        departmentName: profile.departmentName || '미지정',
        jobRole: profile.jobRole || '',
        workplace: profile.workplace || '현장',
        status: 'PENDING',
        createdAt: new Date().toISOString()
      });

      await Promise.all([...notificationPromises, criticalIncidentPromise]);

      toast.error('긴급 SOS가 관리자에게 발송되었습니다!');
    } catch (err) {
      console.error("SOS failed", err);
    }
  };

  const startMonitoring = async () => {
    if (isMonitoring) return true;

    // Check if actual mobile device to bind hardware motion API correctly
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (!isMobileDevice) {
      setIsMonitoring(true);
      return true;
    }

    try {
      if (typeof DeviceMotionEvent !== 'undefined' && (DeviceMotionEvent as any).requestPermission) {
        try {
          const response = await (DeviceMotionEvent as any).requestPermission();
          if (response !== 'granted') {
            toast.error('센서 권한이 거부되었습니다. 설정에서 센서 접근을 허용해주세요.');
            return false;
          }
        } catch (permError) {
          console.warn('DeviceMotionEvent.requestPermission failed:', permError);
          return false;
        }
      }

      // Logic to process motion data with smart gravity filtering & debouncing
      const processMotion = (x: number, y: number, z: number) => {
        // 1. If tab is in background (hidden) or minimized, ignore events to prevent false negatives/positives
        if (typeof document !== 'undefined' && document.hidden) {
          return;
        }

        // 2. Physical sensors exhibit thermal and electronic noise; perfect (0,0,0) is physically impossible.
        // If all readings are 0, it means we are on a desktop browser simulation or inactive/unsupported environment.
        if (x === 0 && y === 0 && z === 0) {
          return;
        }

        // Determine raw magnitude of the incoming vector
        const rawMag = Math.sqrt(x * x + y * y + z * z);

        // 3. Reject near-zero readings which act as weightlessness simulation in desktop/inactive states
        if (rawMag < 0.1) {
          return;
        }

        // Auto-scale detection/calibration:
        // Some devices/WebViews report acceleration in Gs (where gravity is ~1.0) rather than m/s² (where gravity is ~9.8).
        // Track the baseline magnitude with an exponential moving average to calibrate scale.
        if (typeof (window as any)._avgRawMagnitude === 'undefined') {
          (window as any)._avgRawMagnitude = rawMag;
        } else {
          (window as any)._avgRawMagnitude = 0.05 * rawMag + 0.95 * (window as any)._avgRawMagnitude;
        }

        // If the baseline raw magnitude is low (less than 3.0), multiply standard values by 9.8 to convert G-force to m/s²
        const isGForceUnit = (window as any)._avgRawMagnitude < 3.0;
        const scaleFactor = isGForceUnit ? 9.8 : 1.0;

        const sx = x * scaleFactor;
        const sy = y * scaleFactor;
        const sz = z * scaleFactor;

        setLastAcceleration({ x: sx, y: sy, z: sz });

        // Initialize gravity direction vector on first reading using normalized values
        if (!gravityInitRef.current) {
          gravityRef.current = { x: sx, y: sy, z: sz };
          gravityInitRef.current = true;
        }

        // Apply a low-pass filter to isolate stable gravity vector (alpha = 0.9)
        const alpha = 0.9;
        const g = gravityRef.current;
        g.x = alpha * g.x + (1 - alpha) * sx;
        g.y = alpha * g.y + (1 - alpha) * sy;
        g.z = alpha * g.z + (1 - alpha) * sz;
        gravityRef.current = g;

        // Subtract gravity vector to isolate absolute linear movement/shock acceleration
        const linearX = sx - g.x;
        const linearY = sy - g.y;
        const linearZ = sz - g.z;

        // Compute pure linear acceleration magnitude (without gravity)
        const linearMagnitude = Math.sqrt(linearX * linearX + linearY * linearY + linearZ * linearZ);

        // Keep track of recent rapid movement peaks to detect active phone shaking
        const now = Date.now();
        peaksHistoryRef.current = peaksHistoryRef.current.filter(t => now - t < 1500);
        if (linearMagnitude > 14.5) {
          const lastPeak = peaksHistoryRef.current[peaksHistoryRef.current.length - 1] || 0;
          if (now - lastPeak > 150) {
            peaksHistoryRef.current.push(now);
          }
        }

        const isActivelyShaken = peaksHistoryRef.current.length >= 3;
        if (isActivelyShaken) {
          isShakingActiveRef.current = true;
          lastShakeDetectedAtRef.current = now;
        } else if (now - lastShakeDetectedAtRef.current > 2000) {
          isShakingActiveRef.current = false;
        }

        // Physics-driven adaptivity: Respect chosen admin sensitivity levels with a logical safety floor of 15.0 m/s²
        const impactLimit = Math.max(15.0, thresholds.impact || 45.0);
        const fallLimit = Math.max(1.8, Math.min(4.5, thresholds.fall || 3.0));
        const monitorDuration = Math.max(120, thresholds.duration || 180);

        // Fall detection uses raw magnitude:
        // Free-fall results in near-zero gravity force.
        // We block fall detection if the phone is being actively shaken or exhibits high linear acceleration.
        const rawMagnitudeNormalized = Math.sqrt(sx * sx + sy * sy + sz * sz);
        const isDeviceFreeFalling = rawMagnitudeNormalized < fallLimit && linearMagnitude < 6.0 && !isShakingActiveRef.current;

        if (isDeviceFreeFalling) {
          if (!fallStartTimeRef.current) {
            fallStartTimeRef.current = Date.now();
          } else if (Date.now() - fallStartTimeRef.current > monitorDuration) {
            triggerAlert('FALL');
          }
        } else {
          fallStartTimeRef.current = null;
        }

        // To trigger an IMPACT alert, we check if the linear acceleration exceeds the configured limit.
        // For testing and high sensitivity, we allow shaking to trigger it if linearMagnitude is high enough.
        const activeImpactLimit = isShakingActiveRef.current 
          ? Math.max(impactLimit * 1.2, 50.0) 
          : impactLimit;

        if (linearMagnitude > activeImpactLimit) {
          triggerAlert('IMPACT');
        }
      };

      try {
        if (Motion && typeof Motion.addListener === 'function') {
          await Motion.addListener('accel', (event) => {
            const { x, y, z } = event.accelerationIncludingGravity;
            processMotion(x, y, z);
          });
        }
      } catch (e) {
        console.warn("Capacitor Motion listener failed:", e);
      }

      const handleWebMotion = (event: DeviceMotionEvent) => {
        const acc = event.accelerationIncludingGravity;
        if (!acc) return;
        processMotion(acc.x || 0, acc.y || 0, acc.z || 0);
      };

      window.addEventListener('devicemotion', handleWebMotion);
      const cleanup = () => {
        window.removeEventListener('devicemotion', handleWebMotion);
      };
      (window as any)._safetySensorCleanup = cleanup;

      setIsMonitoring(true);
      return true;
    } catch (err) {
      console.error("Monitoring failed deep:", err);
      return false;
    }
  };

  const stopMonitoring = () => {
    try {
      if (Motion && typeof Motion.removeAllListeners === 'function') {
        Motion.removeAllListeners();
      }
    } catch (e) {}
    
    if ((window as any)._safetySensorCleanup) {
      (window as any)._safetySensorCleanup();
      delete (window as any)._safetySensorCleanup;
    }
    setIsMonitoring(false);
  };

  // Expose test controls globally during development/preview so the user can trigger it easily!
  useEffect(() => {
    (window as any).simulateSafetySensor = (type: 'FALL' | 'IMPACT') => {
      triggerAlert(type);
      toast.info(`[시뮬레이션] ${type === 'FALL' ? '추락' : '충격'} 센서가 강제 작동되었습니다.`);
    };
    return () => {
      delete (window as any).simulateSafetySensor;
    };
  }, []);

  // Automatically start monitoring if profile exists
  // BUT we don't block on errors here anymore
  useEffect(() => {
     if (profile && !isMonitoring) {
        startMonitoring().catch(e => console.error("Auto-start monitoring failed:", e));
     }
  }, [profile]);

  return (
    <SafetySensorContext.Provider value={{ isMonitoring, startMonitoring, stopMonitoring, lastAcceleration }}>
      {children}
      
      {/* Emergency Overlay */}
      <AnimatePresence>
        {alertType && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-red-600 p-6"
          >
            <div className="max-w-md w-full flex flex-col items-center text-center">
              <motion.div 
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-2xl mb-8"
              >
                <ShieldAlert className="w-12 h-12 text-red-600" />
              </motion.div>
              
              <h1 className="text-4xl font-black text-white mb-4 tracking-tighter">
                {alertType === 'FALL' ? '추락 감지!' : '강한 충격 감지!'}
              </h1>
              <p className="text-white text-lg font-bold mb-12">
                몸 상태는 괜찮으신가요?<br />
                {countdown}초 후에 자동으로 긴급 SOS를 발송합니다.
              </p>

              <div className="w-full space-y-4">
                <Button 
                  size="lg" 
                  className="w-full h-20 rounded-[2rem] bg-white text-red-600 hover:bg-white/90 text-2xl font-black gap-3 shadow-xl"
                  onClick={cancelAlert}
                >
                  <Check className="w-8 h-8" />
                  저 괜찮아요!
                </Button>
                
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="w-full h-16 rounded-[2rem] border-white/40 bg-red-700 text-white hover:bg-red-800 text-lg font-bold gap-3"
                  onClick={sendEmergencySOS}
                >
                  <AlertTriangle className="w-6 h-6" />
                  지금 바로 SOS 발송
                </Button>
              </div>
            </div>
            
            {/* Background flashing effects */}
            <motion.div 
              animate={{ opacity: [0.1, 0.3, 0.1] }}
              transition={{ repeat: Infinity, duration: 0.5 }}
              className="absolute inset-0 bg-white pointer-events-none" 
            />
          </motion.div>
        )}
      </AnimatePresence>
    </SafetySensorContext.Provider>
  );
};

export const useSafetySensor = () => {
  const context = useContext(SafetySensorContext);
  if (context === undefined) {
    return {
      isMonitoring: false,
      startMonitoring: () => {},
      stopMonitoring: () => {},
      lastAcceleration: null,
    };
  }
  return context;
};
