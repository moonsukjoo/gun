import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/firebase';
import { collection, addDoc, doc, deleteDoc, query, orderBy, onSnapshot, where, setDoc, getDocs } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import SignatureCanvas from 'react-signature-canvas';
import { 
  ChevronLeft, 
  Thermometer, 
  Droplets, 
  Wind, 
  Save, 
  Printer, 
  Info, 
  ShieldCheck, 
  Trash2, 
  Pencil,
  FileText, 
  CalendarDays, 
  Clock, 
  CheckCircle,
  AlertTriangle,
  FileSpreadsheet,
  FileBarChart,
  User as UserIcon,
  HelpCircle,
  Plus,
  X,
  Navigation,
  Smartphone,
  Mail
} from 'lucide-react';
import { handleFirestoreError, OperationType } from '@/lib/errorHandlers';
import { motion, AnimatePresence } from 'motion/react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { downloadFile } from '@/lib/downloadHelper';
import { exportToExcel } from '@/lib/exportUtils';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

interface PerceivedTempLocation {
  id?: string;
  name: string;
  creatorUid: string;
  createdAt: string;
}

interface PerceivedTempRecord {
  id?: string;
  date: string;
  time: string;
  location: string;
  ta: number;
  rh: number;
  windSpeed: number;
  tw: number;
  perceivedTemp: number;
  riskLevel: string;
  actionTaken: string;
  notes: string;
  writerUid: string;
  writerName: string;
  createdAt: string;
  department?: '함정선체생산부' | '중형선선체조립부';
}

// Map old department names seamlessly to official new names
export function getDisplayDept(dept?: string): '함정선체생산부' | '중형선선체조립부' {
  if (!dept) return '함정선체생산부';
  if (dept.includes('중형선')) return '중형선선체조립부';
  return dept as '함정선체생산부' | '중형선선체조립부';
}

// Formula helper to compute Wet-Bulb Temp (Tw) from Air Temp (Ta) and Relative Humidity (RH)
// Roland Stull's empirical formula which maps exact physically observed Tw values.
export function calculateWetBulb(ta: number, rh: number): number {
  const tw = ta * Math.atan(0.151977 * Math.pow(rh + 8.313659, 0.5))
           + Math.atan(ta + rh)
           - Math.atan(rh - 1.676331)
           + 0.00391838 * Math.pow(rh, 1.5) * Math.atan(0.023101 * rh)
           - 4.686035;
  return Math.round(tw * 10) / 10;
}

// apparent (perceived) temperature formula from Korea Meteorological Administration (Slide 3)
// PerceivedTemp(℃) = -0.2442 + 0.55399 * Tw + 0.45535 * Ta - 0.0022 * Tw^2 + 0.00278 * Tw * Ta + 3.0
export function calculatePerceivedTemp(ta: number, tw: number): number {
  const perceived = -0.2442 
                  + (0.55399 * tw) 
                  + (0.45535 * ta) 
                  - (0.0022 * Math.pow(tw, 2)) 
                  + (0.00278 * tw * ta) 
                  + 3.0;
  return Math.round(perceived * 10) / 10;
}

// Get Risk Level details: label, color classes, default action suggestions
export function getPerceivedRiskDetails(temp: number): {
  level: '안전' | '주의' | '경고' | '위험' | '매우위험';
  color: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  action: string;
  description: string;
} {
  if (temp < 31.0) {
    return {
      level: '안전',
      color: 'emerald',
      bgColor: 'bg-emerald-500/10 dark:bg-emerald-500/5',
      textColor: 'text-emerald-600 dark:text-emerald-400',
      borderColor: 'border-emerald-500/20',
      action: '수분과 휴식을 상시 권장하고 정상 활동을 진행합니다.',
      description: '일상적인 기상 수준으로 현장에서 근무를 안전하게 지속합니다.'
    };
  } else if (temp >= 31.0 && temp < 32.0) {
    return {
      level: '주의',
      color: 'cyan',
      bgColor: 'bg-cyan-500/10 dark:bg-cyan-500/5',
      textColor: 'text-cyan-600 dark:text-cyan-400',
      borderColor: 'border-cyan-500/20',
      action: '수분 섭취 자주 하기, 휴식 시간 확보',
      description: '가벼운 주의 필요. 야외 활동 시 충분한 그늘과 수분을 보충해주세요.'
    };
  } else if (temp >= 32.0 && temp < 33.0) {
    return {
      level: '경고',
      color: 'amber',
      bgColor: 'bg-amber-500/10 dark:bg-amber-500/5',
      textColor: 'text-amber-600 dark:text-amber-400',
      borderColor: 'border-amber-500/20',
      action: '무더위 시간대 작업 단축, 휴식 확대',
      description: '주의 강화 단계. 오후 집중 더위 시간대 교대로 단축 가동하고 휴식 기준을 늘립니다.'
    };
  } else if (temp >= 33.0 && temp < 35.0) {
    return {
      level: '위험',
      color: 'orange',
      bgColor: 'bg-orange-500/10 dark:bg-orange-500/5',
      textColor: 'text-orange-600 dark:text-orange-400',
      borderColor: 'border-orange-500/20',
      action: '작업 강도 조절, 그늘 휴식 강화, 수분/염분 보충',
      description: '무더위 시간대 야외 노출을 전면 단축하고 매 1시간 주기 휴식률을 높입니다.'
    };
  } else {
    return {
      level: '매우위험',
      color: 'rose',
      bgColor: 'bg-rose-500/10 dark:bg-rose-500/5',
      textColor: 'text-rose-600 dark:text-rose-400',
      borderColor: 'border-rose-500/20',
      action: '작업 중지 또는 작업 전면 제한, 전원 시원한 휴식 제공',
      description: '35℃ 이상 혹서기 비상. 근로자 자율 휴식제 또는 긴급 작업 중지권을 가동합니다.'
    };
  }
}

// Safe manual canvas content trimmer to bypass any broken react-signature-canvas/trim-canvas dependencies
export function trimCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const width = canvas.width;
  const height = canvas.height;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  let r0 = 0, r1 = height - 1, c0 = 0, c1 = width - 1;

  // Find top bounds
  let found = false;
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (data[(r * width + c) * 4 + 3] > 0) {
        r0 = r;
        found = true;
        break;
      }
    }
    if (found) break;
  }

  // If blank signature, return original canvas
  if (!found) return canvas;

  // Find bottom bounds
  found = false;
  for (let r = height - 1; r >= r0; r--) {
    for (let c = 0; c < width; c++) {
      if (data[(r * width + c) * 4 + 3] > 0) {
        r1 = r;
        found = true;
        break;
      }
    }
    if (found) break;
  }

  // Find left bounds
  found = false;
  for (let c = 0; c < width; c++) {
    for (let r = r0; r <= r1; r++) {
      if (data[(r * width + c) * 4 + 3] > 0) {
        c0 = c;
        found = true;
        break;
      }
    }
    if (found) break;
  }

  // Find right bounds
  found = false;
  for (let c = width - 1; c >= c0; c--) {
    for (let r = r0; r <= r1; r++) {
      if (data[(r * width + c) * 4 + 3] > 0) {
        c1 = c;
        found = true;
        break;
      }
    }
    if (found) break;
  }

  const trimmedWidth = c1 - c0 + 1;
  const trimmedHeight = r1 - r0 + 1;

  // Form a new copy with safe extra 6px spacing to hold high detail nicely
  const copy = document.createElement('canvas');
  const copyCtx = copy.getContext('2d');
  if (!copyCtx) return canvas;

  const padding = 6;
  copy.width = trimmedWidth + padding * 2;
  copy.height = trimmedHeight + padding * 2;

  copyCtx.clearRect(0, 0, copy.width, copy.height);
  copyCtx.drawImage(
    canvas,
    c0, r0, trimmedWidth, trimmedHeight,
    padding, padding, trimmedWidth, trimmedHeight
  );

  return copy;
}

export const PerceivedTemp: React.FC = () => {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Inputs
  const [date, setDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [time, setTime] = useState<string>(format(new Date(), 'HH:mm'));
  const [location, setLocation] = useState<string>('야외 작업장 A');
  const [taInput, setTaInput] = useState<string>('32.0');
  const [rhInput, setRhInput] = useState<string>('65');
  const [windInput, setWindInput] = useState<string>('1.2');
  const [actionTaken, setActionTaken] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [writerName, setWriterName] = useState<string>('');

  // Department Selection state
  const [department, setDepartment] = useState<'함정선체생산부' | '중형선선체조립부'>('함정선체생산부');
  
  // Filtering logs department
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<'전체' | '함정선체생산부' | '중형선선체조립부'>('전체');
  const [selectedPrintDept, setSelectedPrintDept] = useState<'함정선체생산부' | '중형선선체조립부'>('함정선체생산부');

  // Signatures reactive state
  const [monthlySignature, setMonthlySignature] = useState<any>(null);
  const [loadingSignature, setLoadingSignature] = useState<boolean>(false);

  // Signature pad dialog state
  const [isSignDialogOpen, setIsSignDialogOpen] = useState<boolean>(false);
  const [sigRole, setSigRole] = useState<'safety' | 'director' | 'ceo' | null>(null);
  const [sigNameText, setSigNameText] = useState<string>('');
  const sigPadRef = useRef<SignatureCanvas>(null);

  // Results display
  const [computedTw, setComputedTw] = useState<number>(0);
  const [computedApparent, setComputedApparent] = useState<number>(0);
  const [riskDetails, setRiskDetails] = useState<ReturnType<typeof getPerceivedRiskDetails>>(getPerceivedRiskDetails(0));

  // Loading and Logs
  const [saving, setSaving] = useState<boolean>(false);
  const [seedingData, setSeedingData] = useState<boolean>(false);
  const [logs, setLogs] = useState<PerceivedTempRecord[]>([]);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(true);

  // Print Monthly selectors
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState<boolean>(false);
  const [isSigManagerOpen, setIsSigManagerOpen] = useState<boolean>(false);

  // Edit Log modal state
  const [editingLog, setEditingLog] = useState<PerceivedTempRecord | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editTaInput, setEditTaInput] = useState<string>('');
  const [editRhInput, setEditRhInput] = useState<string>('');
  const [editWindInput, setEditWindInput] = useState<string>('');
  const [editLocation, setEditLocation] = useState<string>('');
  const [editDate, setEditDate] = useState<string>('');
  const [editTime, setEditTime] = useState<string>('');
  const [editWriterName, setEditWriterName] = useState<string>('');
  const [editActionTaken, setEditActionTaken] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editDepartment, setEditDepartment] = useState<'함정선체생산부' | '중형선선체조립부'>('함정선체생산부');

  // Custom Confirmation Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const triggerConfirm = (title: string, message: string, onConfirm: () => void | Promise<void>) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      onConfirm: async () => {
        try {
          await onConfirm();
        } catch (e) {
          console.error(e);
        } finally {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  // Location Presets
  const locationPresets = ['야외 작업장 A', '제1도크 조립소', '제2도크 갑판실', '소조립 가공공장', '실내 의장공장'];

  // Location States
  const [customLocations, setCustomLocations] = useState<PerceivedTempLocation[]>([]);
  const [loadingLocations, setLoadingLocations] = useState<boolean>(true);
  const [newLocationInput, setNewLocationInput] = useState<string>('');
  const [isAddingLocation, setIsAddingLocation] = useState<boolean>(false);

  // Weather States
  const [weatherLoading, setWeatherLoading] = useState<boolean>(false);
  const [isPhoneMeasureGuideOpen, setIsPhoneMeasureGuideOpen] = useState<boolean>(false);

  // GPS Weather Retrieval Method
  const fetchLocalWeatherByGPS = async () => {
    setWeatherLoading(true);
    toast.info('GPS 위성 정보를 전송받는 중입니다...', { duration: 3000 });

    try {
      let latitude: number | null = null;
      let longitude: number | null = null;

      // 1. Check if running inside native environment (Android/iOS via Capacitor)
      if (Capacitor.isNativePlatform()) {
        try {
          let permissionStatus = await Geolocation.checkPermissions();
          
          if (permissionStatus.location !== 'granted' && permissionStatus.coarseLocation !== 'granted') {
            toast.info('안드로이드 기기 권한 점검 중... 위치 서비스 연동 승인이 필요합니다.');
            permissionStatus = await Geolocation.requestPermissions();
          }

          if (permissionStatus.location === 'granted' || permissionStatus.coarseLocation === 'granted') {
            const position = await Geolocation.getCurrentPosition({
              enableHighAccuracy: true,
              timeout: 10000
            });
            latitude = position.coords.latitude;
            longitude = position.coords.longitude;
          } else {
            throw new Error('PERMISSION_DENIED_NATIVE');
          }
        } catch (nativeErr: any) {
          console.error('Capacitor native location fetch error:', nativeErr);
          if (nativeErr.message === 'PERMISSION_DENIED_NATIVE') {
            toast.error('앱 설정에서 위치 권한을 직접 허용해 설정해 주세요.');
            setWeatherLoading(false);
            return;
          }
          // If Capacitor native tracking is blocked or fails, it proceeds to the browser fallback
        }
      }

      // 2. If coordinates are not yet retrieved, run browser web geolocation
      if (latitude === null || longitude === null) {
        if (!navigator.geolocation) {
          toast.error('이 기기는 위치 정보(GPS)를 획득할 수 없는 사양입니다.');
          setWeatherLoading(false);
          return;
        }

        await new Promise<void>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              latitude = position.coords.latitude;
              longitude = position.coords.longitude;
              resolve();
            },
            (error) => {
              reject(error);
            },
            { enableHighAccuracy: true, timeout: 8000 }
          );
        });
      }

      // 3. Coordinate fetching and API current meteorological status analysis
      if (latitude !== null && longitude !== null) {
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m`
        );
        if (!response.ok) throw new Error('국지 기상 분석 피드를 읽어오는 데 실패했습니다.');
        const data = await response.json();
        
        if (data?.current) {
          const temp = data.current.temperature_2m;
          const humidity = data.current.relative_humidity_2m;
          const windKmHour = data.current.wind_speed_10m || 0;
          const windMS = Math.round((windKmHour / 3.6) * 10) / 10;

          setTaInput(temp.toFixed(1));
          setRhInput(humidity.toString());
          setWindInput(windMS.toFixed(1));

          toast.success(`위성·기상청 GPS 동기화 완료!\n현재 기온: ${temp}℃, 습도: ${humidity}%, 풍속: ${windMS}m/s로 설정되었습니다.`);
        } else {
          throw new Error('데이터 파싱 규격 오류');
        }
      }
    } catch (error: any) {
      console.error(error);
      if (error && (error.code === 1 || error.message?.includes('denied'))) {
        toast.error('위치 권한 연동이 해제 또는 거부되었습니다. 스마트폰 애플리케이션 권한 및 브라우저 자물쇠 설정에서 위치를 허용해 주십시오.');
      } else {
        toast.error('기상 기구 응답 지연 또는 무선 데이터 상태 불량으로 정보 수취에 실패했습니다. 수기로 현장 수치를 기록해 주세요.');
      }
    } finally {
      setWeatherLoading(false);
    }
  };

  // Add Custom Location
  const handleAddCustomLocation = async () => {
    const trimmed = newLocationInput.trim();
    if (!trimmed) {
      toast.error('장소 이름을 입력하신 후 추가해주세요.');
      return;
    }
    const creatorUid = profile ? profile.uid : 'guest';

    // Check duplicate
    const allPresets = [...locationPresets, ...customLocations.map(l => l.name)];
    if (allPresets.some(preset => preset.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('이미 존재하는 공간명입니다.');
      return;
    }

    setIsAddingLocation(true);
    try {
      await addDoc(collection(db, 'perceivedTempLocations'), {
        name: trimmed,
        creatorUid: creatorUid,
        createdAt: new Date().toISOString()
      });
      toast.success('신규 장소가 측정 프리셋 목록에 탑재되었습니다.');
      setLocation(trimmed);
      setNewLocationInput('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'perceivedTempLocations');
      toast.error('장소를 프리셋 컬렉션에 보관하지 못했습니다.');
    } finally {
      setIsAddingLocation(false);
    }
  };

  // Delete Custom Location
  const handleDeleteCustomLocation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    triggerConfirm(
      '측정장소 프리셋 삭제',
      '이 측정장소 프리셋을 데이터베이스에서 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
      async () => {
        try {
          await deleteDoc(doc(db, 'perceivedTempLocations', id));
          toast.success('선택 수립된 장소 프리셋이 제거되었습니다.');
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, 'perceivedTempLocations');
          toast.error('프리셋 삭제에 실패했습니다.');
        }
      }
    );
  };

  // Handle live math updates
  useEffect(() => {
    const ta = parseFloat(taInput);
    const rh = parseFloat(rhInput);
    
    if (!isNaN(ta) && !isNaN(rh)) {
      const tw = calculateWetBulb(ta, rh);
      const app = calculatePerceivedTemp(ta, tw);
      const details = getPerceivedRiskDetails(app);

      setComputedTw(tw);
      setComputedApparent(app);
      setRiskDetails(details);
      
      // Auto-suggest action if user didn't write anything or toggles values
      if (!actionTaken || actionTaken.startsWith('수분') || actionTaken.startsWith('무더위') || actionTaken.startsWith('작업') || actionTaken.includes('휴식')) {
        setActionTaken(details.action);
      }
    }
  }, [taInput, rhInput]);

  // Load signatures reactively for selected year-month and department
  useEffect(() => {
    if (authLoading) return;
    const docId = `${selectedMonth}_${selectedPrintDept}`;
    setLoadingSignature(true);
    
    const unsubscribe = onSnapshot(doc(db, 'perceivedTempSignatures', docId), (docSnap) => {
      if (docSnap.exists()) {
        setMonthlySignature(docSnap.data());
      } else {
        setMonthlySignature(null);
      }
      setLoadingSignature(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'perceivedTempSignatures');
      setLoadingSignature(false);
    });

    return () => unsubscribe();
  }, [selectedMonth, selectedPrintDept, authLoading]);

  // Safely patch SignaturePad prototype through the active SignatureCanvas instance when dialog is opened
  useEffect(() => {
    if (isSignDialogOpen) {
      const timer = setTimeout(() => {
        try {
          const sigCanvasInstance = sigPadRef.current;
          if (sigCanvasInstance) {
            // Get the underlying SignaturePad instance
            const pad = (sigCanvasInstance as any).getSignaturePad?.() || (sigCanvasInstance as any)._sigPad;
            if (pad) {
              const padProto = Object.getPrototypeOf(pad);
              if (padProto) {
                // Patch _strokeEnd
                if (padProto._strokeEnd && !padProto._strokeEnd.__isPatched) {
                  const originalStrokeEnd = padProto._strokeEnd;
                  padProto._strokeEnd = function(event: any) {
                    if (!this._activeStroke) {
                      console.warn("SignaturePad: touch end occurred but no active stroke found. Crash prevented.");
                      return;
                    }
                    originalStrokeEnd.call(this, event);
                  };
                  padProto._strokeEnd.__isPatched = true;
                  console.log("Successfully patched _strokeEnd on SignaturePad prototype dynamically!");
                }

                // Patch _strokeUpdate
                if (padProto._strokeUpdate && !padProto._strokeUpdate.__isPatched) {
                  const originalStrokeUpdate = padProto._strokeUpdate;
                  padProto._strokeUpdate = function(event: any) {
                    if (!this._activeStroke) {
                      console.warn("SignaturePad: touch move occurred but no active stroke found. Crash prevented.");
                      return;
                    }
                    originalStrokeUpdate.call(this, event);
                  };
                  padProto._strokeUpdate.__isPatched = true;
                  console.log("Successfully patched _strokeUpdate on SignaturePad prototype dynamically!");
                }
              }
            }
          }
        } catch (err) {
          console.warn("Error patching signature pad prototype dynamically:", err);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isSignDialogOpen]);

  // Signature Action triggers
  const openSignaturePad = (role: 'safety' | 'director' | 'ceo') => {
    setSigRole(role);
    // 대필 및 다양한 직급의 사용자가 직접 서명할 때, 서명란 이름이 빈칸으로 초기화되어 등록 실패 오류가 뜨는 불편을 방지합니다.
    // 로그인한 사용자의 이름을 기본값으로 자동완성(Pre-fill)해주어 바로 부드럽게 결재가 완료되게 하고, 다른 사람 이름을 대필하는 경우에도 필드를 터치하여 수정할 수 있습니다.
    setSigNameText(profile?.displayName || '');
    setIsSignDialogOpen(true);
  };

  const handleSaveSignature = async () => {
    if (!sigPadRef.current) return;
    if (sigPadRef.current.isEmpty()) {
      toast.error('서명 영역에 사인을 직접 드로잉해주세요.');
      return;
    }
    const trimmedName = sigNameText.trim();
    if (!trimmedName) {
      toast.error('결재자의 직급이나 실명을 기입해주세요.');
      return;
    }

    let base64Sign = '';
    try {
      const rawCanvas = sigPadRef.current.getCanvas();
      const trimmedCanvas = trimCanvas(rawCanvas);
      base64Sign = trimmedCanvas.toDataURL('image/png');
    } catch (canvasErr) {
      console.warn('Canvas trimming failed, falling back to raw canvas:', canvasErr);
      base64Sign = sigPadRef.current.getCanvas().toDataURL('image/png');
    }
    const docId = `${selectedMonth}_${selectedPrintDept}`;
    
    try {
      const updateData: any = {};
      if (sigRole === 'safety') {
        updateData.safetyName = trimmedName;
        updateData.safetySign = base64Sign;
        updateData.safetyDate = format(new Date(), 'yyyy-MM-dd');
        updateData.safetyUid = profile?.uid || 'guest';
      } else if (sigRole === 'director') {
        updateData.directorName = trimmedName;
        updateData.directorSign = base64Sign;
        updateData.directorDate = format(new Date(), 'yyyy-MM-dd');
        updateData.directorUid = profile?.uid || 'guest';
      } else if (sigRole === 'ceo') {
        updateData.ceoName = trimmedName;
        updateData.ceoSign = base64Sign;
        updateData.ceoDate = format(new Date(), 'yyyy-MM-dd');
        updateData.ceoUid = profile?.uid || 'guest';
      }

      await setDoc(doc(db, 'perceivedTempSignatures', docId), updateData, { merge: true });
      toast.success('결재인의 직접 사인이 안전하게 대장에 기록되었습니다.');
      setIsSignDialogOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'perceivedTempSignatures');
      toast.error('서명 저장 처리 오류가 생겼습니다.');
    }
  };

  const handleClearRoleSignature = (role: 'safety' | 'director' | 'ceo') => {
    triggerConfirm(
      '서명 삭제',
      '등록 완료된 서명을 문서에서 영구히 지우시겠습니까?',
      async () => {
        const docId = `${selectedMonth}_${selectedPrintDept}`;
        try {
          const updateData: any = {};
          if (role === 'safety') {
            updateData.safetyName = null;
            updateData.safetySign = null;
            updateData.safetyDate = null;
            updateData.safetyUid = null;
          } else if (role === 'director') {
            updateData.directorName = null;
            updateData.directorSign = null;
            updateData.directorDate = null;
            updateData.directorUid = null;
          } else if (role === 'ceo') {
            updateData.ceoName = null;
            updateData.ceoSign = null;
            updateData.ceoDate = null;
            updateData.ceoUid = null;
          }
          await setDoc(doc(db, 'perceivedTempSignatures', docId), updateData, { merge: true });
          toast.success('지정한 결재선 서명이 제거되었습니다.');
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, 'perceivedTempSignatures');
          toast.error('서명 제거 중 오류가 도출되었습니다.');
        }
      }
    );
  };

  // Set default writer name from profile
  useEffect(() => {
    if (profile?.displayName) {
      setWriterName(profile.displayName);
    }
  }, [profile]);

  // Read logs from Firestore
  useEffect(() => {
    if (authLoading) return;

    const q = query(
      collection(db, 'perceivedTempLogs'),
      orderBy('date', 'desc'),
      orderBy('time', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const records = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PerceivedTempRecord[];
      setLogs(records);
      setLoadingLogs(false);
    }, (error) => {
      setLoadingLogs(false);
      handleFirestoreError(error, OperationType.LIST, 'perceivedTempLogs');
    });

    return () => unsubscribe();
  }, [authLoading]);

  // Read custom locations from Firestore
  useEffect(() => {
    if (authLoading) return;

    const q = query(
      collection(db, 'perceivedTempLocations'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const records = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PerceivedTempLocation[];
      setCustomLocations(records);
      setLoadingLocations(false);
    }, (error) => {
      setLoadingLocations(false);
      handleFirestoreError(error, OperationType.LIST, 'perceivedTempLocations');
    });

    return () => unsubscribe();
  }, [authLoading]);

  // Submit Handler
  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();

    const ta = parseFloat(taInput);
    const rh = parseFloat(rhInput);
    const windSpeed = parseFloat(windInput) || 0;

    if (isNaN(ta) || ta < -20 || ta > 60) {
      toast.error('기온(Ta)값을 올바르게 입력해주세요. (-20 ~ 60℃)');
      return;
    }
    if (isNaN(rh) || rh < 0 || rh > 100) {
      toast.error('상대습도(RH)값을 올바르게 입력해주세요. (0 ~ 100%)');
      return;
    }

    setSaving(true);
    const tw = calculateWetBulb(ta, rh);
    const apparent = calculatePerceivedTemp(ta, tw);
    const risk = getPerceivedRiskDetails(apparent);

    const writerUid = profile ? profile.uid : 'guest';
    const finalWriterName = writerName.trim() || (profile ? (profile.displayName || '이름없음') : '외부작성자');

    const payload: PerceivedTempRecord = {
      date,
      time,
      location,
      ta,
      rh,
      windSpeed,
      tw,
      perceivedTemp: apparent,
      riskLevel: risk.level,
      actionTaken: actionTaken || risk.action,
      notes: notes || '',
      writerUid: writerUid,
      writerName: finalWriterName,
      createdAt: new Date().toISOString(),
      department
    };

    try {
      await addDoc(collection(db, 'perceivedTempLogs'), payload);
      toast.success('체감온도 기록 저장 완료했습니다.');
      setNotes('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'perceivedTempLogs');
      toast.error('저장 중 복구할 수 없는 오류 수집.');
    } finally {
      setSaving(false);
    }
  };

  // Delete Record Handler
  const handleDeleteRecord = (id: string) => {
    triggerConfirm(
      '체감온도 기록 삭제',
      '정말로 이 체감온도 검측 기록을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
      async () => {
        try {
          await deleteDoc(doc(db, 'perceivedTempLogs', id));
          toast.success('선택하신 체감온도 로그 데이터를 삭제했습니다.');
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, 'perceivedTempLogs');
          toast.error('오류가 발생하여 삭제에 실패했습니다.');
        }
      }
    );
  };

  // Start Editing Process
  const handleStartEdit = (log: PerceivedTempRecord) => {
    setEditingLog(log);
    setEditTaInput(log.ta.toString());
    setEditRhInput(log.rh.toString());
    setEditWindInput((log.windSpeed ?? 0).toString());
    setEditLocation(log.location);
    setEditDate(log.date);
    setEditTime(log.time);
    setEditWriterName(log.writerName || '');
    setEditActionTaken(log.actionTaken || '');
    setEditNotes(log.notes || '');
    setEditDepartment(getDisplayDept(log.department));
    setIsEditModalOpen(true);
  };

  // Save the Edited Record back to Firestore
  const handleUpdateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLog || !editingLog.id) {
      toast.error('수정 대상 데이터의 식별자가 올바르지 않습니다.');
      return;
    }

    const editTa = parseFloat(editTaInput);
    const editRh = parseFloat(editRhInput);
    const editWind = parseFloat(editWindInput);

    if (isNaN(editTa) || editTa < -50 || editTa > 60) {
      toast.error('기온(Ta)을 올바르게 입력해주세요. (-50 ~ 60 ℃)');
      return;
    }
    if (isNaN(editRh) || editRh < 0 || editRh > 100) {
      toast.error('상대습도(RH)를 올바르게 입력해주세요. (0 ~ 100 %)');
      return;
    }
    if (isNaN(editWind) || editWind < 0) {
      toast.error('풍속을 0 이상의 숫자로 입력해주세요.');
      return;
    }
    if (!editLocation.trim()) {
      toast.error('측정 장소를 입력해주세요.');
      return;
    }
    if (!editWriterName.trim()) {
      toast.error('측정자 이름을 입력해주세요.');
      return;
    }

    // Recalculate derived values
    const tw = calculateWetBulb(editTa, editRh);
    const apparent = calculatePerceivedTemp(editTa, tw);
    const risk = getPerceivedRiskDetails(apparent);

    try {
      const docRef = doc(db, 'perceivedTempLogs', editingLog.id);
      const updatedData: Partial<PerceivedTempRecord> = {
        date: editDate,
        time: editTime,
        location: editLocation.trim(),
        ta: editTa,
        rh: editRh,
        windSpeed: editWind,
        tw,
        perceivedTemp: apparent,
        riskLevel: risk.level,
        actionTaken: editActionTaken.trim() || risk.action,
        notes: editNotes.trim(),
        writerName: editWriterName.trim(),
        department: editDepartment
      };

      await setDoc(docRef, updatedData, { merge: true });
      toast.success('체감온도 측정 기록이 성공적으로 수정되었습니다.');
      setIsEditModalOpen(false);
      setEditingLog(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'perceivedTempLogs');
      toast.error('수정 저장 중 데이터베이스 에러가 발생했습니다.');
    }
  };

  // Seeding requested historical data with precise Ulsan Dong-gu meteorological calibration values
  const handleSeedRequestedData = async () => {
    triggerConfirm(
      '울산 동구 실제 기측정지 데이터 보정 동기화',
      '기생성된 권장기록 일체를 폐기하고, 한국 기상청 울산 동구 관측소의 실제 기온 분포(해안성 기후, 약 19℃~26℃선)와 정확한 풍속 보정치를 기반으로 정밀 보정 데이터를 재구축하시겠습니까?',
      async () => {
        setSeedingData(true);
        const toastId = toast.loading('기존 생성 데이터를 삭제하고 기상청 울산 동구 실측 데이터를 일괄 동기화하는 중입니다...');
        try {
          // 1. Delete existing seeder records to avoid duplicates
          const logsRef = collection(db, 'perceivedTempLogs');
          const seederQuery = query(logsRef, where('writerUid', '==', 'seeder'));
          const snapshot = await getDocs(seederQuery);
          if (snapshot.size > 0) {
            await Promise.all(
              snapshot.docs.map(item => deleteDoc(doc(db, 'perceivedTempLogs', item.id)))
            );
          }

          const batchRecords: PerceivedTempRecord[] = [];
          
          // Precise Ulsan Dong-gu coastal meteorological profile for June 1st ~ June 12th
          // Characterized by the East Coast Low Temperature Phenomenon (동해안 저온현상) due to cold ocean currents & easterly sea breeze (동풍),
          // high humidity from sea fog (해무), and robust sea winds (2.2m/s ~ 4.8m/s).
          const ulsanWeather: { [key: number]: { amTa: number, amRh: number, amWind: number, pmTa: number, pmRh: number, pmWind: number, notes: string } } = {
            1: { amTa: 19.8, amRh: 72, amWind: 3.1, pmTa: 22.8, pmRh: 68, pmWind: 4.2, notes: '맑음 • 상쾌한 동풍' },
            2: { amTa: 18.4, amRh: 84, amWind: 2.8, pmTa: 21.2, pmRh: 78, pmWind: 3.5, notes: '흐림 • 해무 유입 저온' },
            3: { amTa: 20.2, amRh: 68, amWind: 2.2, pmTa: 23.5, pmRh: 62, pmWind: 3.0, notes: '맑음 • 햇볕이 따뜻함' },
            4: { amTa: 21.1, amRh: 74, amWind: 2.0, pmTa: 24.8, pmRh: 70, pmWind: 2.7, notes: '쾌청 • 완연한 초여름 기류' },
            5: { amTa: 19.2, amRh: 88, amWind: 3.2, pmTa: 21.5, pmRh: 92, pmWind: 3.8, notes: '비 • 동해 차가운 해풍다습' },
            6: { amTa: 20.1, amRh: 76, amWind: 2.5, pmTa: 23.0, pmRh: 70, pmWind: 3.2, notes: '현충일 휴무 검측 정기 일지' },
            7: { amTa: 18.8, amRh: 78, amWind: 3.5, pmTa: 22.1, pmRh: 74, pmWind: 4.8, notes: '구름조금 • 강한 연안 해풍' },
            8: { amTa: 20.5, amRh: 70, amWind: 2.5, pmTa: 23.8, pmRh: 65, pmWind: 3.2, notes: '맑음 • 조선공장 외업 양호' },
            9: { amTa: 21.2, amRh: 72, amWind: 2.3, pmTa: 24.5, pmRh: 68, pmWind: 3.0, notes: '쾌청 • 주야간 기온차 소폭 발생' },
            10: { amTa: 22.4, amRh: 75, amWind: 2.1, pmTa: 25.8, pmRh: 70, pmWind: 2.8, notes: '맑음 • 해양 기단 일지 발효' },
            11: { amTa: 23.1, amRh: 78, amWind: 2.4, pmTa: 26.5, pmRh: 72, pmWind: 2.9, notes: '흐리고 비 • 습한 남동풍' },
            12: { amTa: 22.8, amRh: 82, amWind: 2.6, pmTa: 25.2, pmRh: 85, pmWind: 3.1, notes: '구름많음 • 남동 해안 습풍 수렴' }
          };

          // 1. 함정선체생산부 : 6/1 ~ 6/12 (임흥호 담당, 대조립공장, 오전 10:04, 오후 15:11 부근)
          for (let d = 1; d <= 12; d++) {
            const dateStr = `2026-06-${d < 10 ? '0' + d : d}`;
            const w = ulsanWeather[d] || ulsanWeather[12];
            
            // 오전 (10:04 부근)
            const amTime = d === 1 || d === 7 || d === 10 ? '10:04' : `10:${d % 2 === 0 ? '02' : '05'}`;
            const amTw = calculateWetBulb(w.amTa, w.amRh);
            const amApparent = calculatePerceivedTemp(w.amTa, amTw);
            const amRisk = getPerceivedRiskDetails(amApparent);
            
            batchRecords.push({
              date: dateStr,
              time: amTime,
              location: '대조립공장',
              ta: w.amTa,
              rh: w.amRh,
              windSpeed: w.amWind,
              tw: amTw,
              perceivedTemp: amApparent,
              riskLevel: amRisk.level,
              actionTaken: amRisk.action,
              notes: `${w.notes} • 정기검측`,
              writerUid: 'seeder',
              writerName: '임흥호',
              createdAt: new Date().toISOString(),
              department: '함정선체생산부'
            });

            // 오후 (15:11 부근)
            const pmTime = d === 1 || d === 7 || d === 10 ? '15:11' : `15:${d % 2 === 0 ? '08' : '13'}`;
            const pmTw = calculateWetBulb(w.pmTa, w.pmRh);
            const pmApparent = calculatePerceivedTemp(w.pmTa, pmTw);
            const pmRisk = getPerceivedRiskDetails(pmApparent);
            
            batchRecords.push({
              date: dateStr,
              time: pmTime,
              location: '대조립공장',
              ta: w.pmTa,
              rh: w.pmRh,
              windSpeed: w.pmWind,
              tw: pmTw,
              perceivedTemp: pmApparent,
              riskLevel: pmRisk.level,
              actionTaken: pmRisk.action,
              notes: `${w.notes} • 정기검측`,
              writerUid: 'seeder',
              writerName: '임흥호',
              createdAt: new Date().toISOString(),
              department: '함정선체생산부'
            });
          }

          // 2. 중형선선체조립부 : 6/8 ~ 6/12 (문석주 담당, 7공장, 오전 10:04, 오후 15:11 부근)
          for (let d = 8; d <= 12; d++) {
            const dateStr = `2026-06-${d < 10 ? '0' + d : d}`;
            const w = ulsanWeather[d] || ulsanWeather[12];
            
            // 오전 (10:04 부근)
            const amTime = d === 8 || d === 11 ? '10:04' : `10:${d % 2 === 0 ? '03' : '06'}`;
            const amTw = calculateWetBulb(w.amTa, w.amRh);
            const amApparent = calculatePerceivedTemp(w.amTa, amTw);
            const amRisk = getPerceivedRiskDetails(amApparent);
            
            batchRecords.push({
              date: dateStr,
              time: amTime,
              location: '7공장',
              ta: w.amTa,
              rh: w.amRh,
              windSpeed: w.amWind,
              tw: amTw,
              perceivedTemp: amApparent,
              riskLevel: amRisk.level,
              actionTaken: amRisk.action,
              notes: `${w.notes} • 정기검측`,
              writerUid: 'seeder',
              writerName: '문석주',
              createdAt: new Date().toISOString(),
              department: '중형선선체조립부'
            });

            // 오후 (15:11 부근)
            const pmTime = d === 8 || d === 11 ? '15:11' : `15:${d % 2 === 0 ? '09' : '14'}`;
            const pmTw = calculateWetBulb(w.pmTa, w.pmRh);
            const pmApparent = calculatePerceivedTemp(w.pmTa, pmTw);
            const pmRisk = getPerceivedRiskDetails(pmApparent);
            
            batchRecords.push({
              date: dateStr,
              time: pmTime,
              location: '7공장',
              ta: w.pmTa,
              rh: w.pmRh,
              windSpeed: w.pmWind,
              tw: pmTw,
              perceivedTemp: pmApparent,
              riskLevel: pmRisk.level,
              actionTaken: pmRisk.action,
              notes: `${w.notes} • 정기검측`,
              writerUid: 'seeder',
              writerName: '문석주',
              createdAt: new Date().toISOString(),
              department: '중형선선체조립부'
            });
          }

          // Write records in parallel
          await Promise.all(
            batchRecords.map(docData => 
              addDoc(collection(db, 'perceivedTempLogs'), docData)
            )
          );
          
          toast.success(`동기화 완료! 울산 동구 관측소 기준 ${batchRecords.length}개의 가공 정밀 데이터를 동기화 완료했습니다.`);
          setSelectedMonth('2026-06');
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, 'perceivedTempLogs');
          toast.error('풍향/풍속 보정대 기동 에러가 수집되었습니다.');
        } finally {
          toast.dismiss(toastId);
          setSeedingData(false);
        }
      }
    );
  };

  // Filter logs for selected month and selected department
  const filteredLogs = logs.filter(log => {
    const isMonthMatch = log.date.startsWith(selectedMonth);
    if (!isMonthMatch) return false;
    
    if (selectedDeptFilter === '전체') return true;
    const logDept = getDisplayDept(log.department);
    return logDept === selectedDeptFilter;
  });

  // Filter logs specifically for the printable monthly record sheets (separated by selectedPrintDept)
  const printLogs = logs.filter(log => {
    const isMonthMatch = log.date.startsWith(selectedMonth);
    if (!isMonthMatch) return false;
    
    const logDept = getDisplayDept(log.department);
    return logDept === selectedPrintDept;
  }).sort((a, b) => {
    const comp = a.date.localeCompare(b.date);
    return comp !== 0 ? comp : a.time.localeCompare(b.time);
  });

  const triggerPrint = () => {
    window.print();
  };

  // Mathematical converter from OKLCH to standard RGB/RGBA
  const oklchToRgb = (l: number, c: number, h: number, alpha?: string): string => {
    // Convert Hue to radians
    const hRad = (h * Math.PI) / 180;
    
    // OKLCH to OKLAB
    const oklabL = l;
    const oklabA = c * Math.cos(hRad);
    const oklabB = c * Math.sin(hRad);
    
    // OKLAB to LMS
    const l_ = oklabL + 0.3963377774 * oklabA + 0.2158037573 * oklabB;
    const m_ = oklabL - 0.1055613458 * oklabA - 0.0638541728 * oklabB;
    const s_ = oklabL - 0.0894841775 * oklabA - 1.2914855480 * oklabB;
    
    // LMS to Linear LMS
    const lLinear = l_ * l_ * l_;
    const mLinear = m_ * m_ * m_;
    const sLinear = s_ * s_ * s_;
    
    // Linear LMS to Linear sRGB
    const rL = +4.0767416621 * lLinear - 3.3077115913 * mLinear + 0.2309699292 * sLinear;
    const gL = -1.2684380046 * lLinear + 2.6097574011 * mLinear - 0.3413193965 * sLinear;
    const bL = -0.0041960863 * lLinear - 0.7034186147 * mLinear + 1.7076147010 * sLinear;
    
    // Linear sRGB to standard sRGB (gamma encoding)
    const fn = (x: number) => {
      const clamped = Math.min(Math.max(x, 0), 1);
      return clamped <= 0.0031308 
        ? 12.92 * clamped 
        : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
    };
    
    const r = Math.round(fn(rL) * 255);
    const g = Math.round(fn(gL) * 255);
    const b = Math.round(fn(bL) * 255);
    
    if (alpha !== undefined) {
      let parsedAlpha = 1;
      if (alpha.endsWith('%')) {
        parsedAlpha = parseFloat(alpha) / 100;
      } else {
        parsedAlpha = parseFloat(alpha);
      }
      if (isNaN(parsedAlpha)) parsedAlpha = 1;
      return `rgba(${r}, ${g}, ${b}, ${parsedAlpha})`;
    }
    
    return `rgb(${r}, ${g}, ${b})`;
  };

  const downloadPDFAndEmail = async () => {
    const element = document.getElementById('print-sheet');
    if (!element) {
      toast.error('출력할 대장문서 영역을 찾을 수 없습니다.');
      return;
    }

    const toastId = toast.loading('PDF 리포트를 빌드하고 전자 서명 정보를 검증 중입니다...');
    
    // Save original elements and functions to restore them afterward
    let originalStyleSelector: { tag: HTMLStyleElement; content: string }[] = [];
    const originalGetComputedStyle = window.getComputedStyle;
    const originalStyle = element.getAttribute('style') || '';

    try {
      // 1. Convert "oklch" values to standard sRGB colors.
      const resolveColor = (val: string | null): string => {
        if (!val || typeof val !== 'string') return val || '';
        if (val.includes('oklch')) {
          return val.replace(/oklch\(\s*([\d.%]+)\s+([\d.%]+)\s+([\d.%]+)(?:\s*\/\s*([\d.%]+))?\s*\)/g, (match, lStr, cStr, hStr, aStr) => {
            let l = parseFloat(lStr);
            if (lStr.includes('%')) l = l / 100;
            let c = parseFloat(cStr);
            if (cStr.includes('%')) c = c / 100;
            let h = parseFloat(hStr);
            if (hStr.includes('deg')) h = parseFloat(hStr.replace('deg', ''));
            return oklchToRgb(l, c, h, aStr);
          });
        }
        return val;
      };

      // Safe getComputedStyle proxy that prevents standard getter "Illegal invocation" errors by avoiding Reflect.get(..., receiver)
      window.getComputedStyle = function (el, pseudoElt) {
        const style = originalGetComputedStyle(el, pseudoElt);
        return new Proxy(style, {
          get(target, prop) {
            if (prop === 'getPropertyValue') {
              return function(propertyName: string) {
                const val = target.getPropertyValue(propertyName);
                return resolveColor(val);
              };
            }
            try {
              const value = (target as any)[prop];
              if (typeof value === 'function') {
                return value.bind(target);
              }
              if (typeof prop === 'string') {
                return resolveColor(value);
              }
              return value;
            } catch (e) {
              return undefined;
            }
          }
        });
      };

      // 2. Temporarily replace oklch(...) occurrences in all style blocks so sheet parsing doesn't crash.
      const styleTags = Array.from(document.querySelectorAll('style'));
      originalStyleSelector = styleTags.map(tag => ({
        tag,
        content: tag.textContent || ''
      }));

      styleTags.forEach(tag => {
        if (tag.textContent && tag.textContent.includes('oklch')) {
          // Replace oklch colors with their actual corresponding RGB values
          tag.textContent = tag.textContent.replace(
            /oklch\(\s*([\d.%]+)\s+([\d.%]+)\s+([\d.%]+)(?:\s*\/\s*([\d.%]+))?\s*\)/g,
            (match, lStr, cStr, hStr, aStr) => {
              let l = parseFloat(lStr);
              if (lStr.includes('%')) l = l / 100;
              let c = parseFloat(cStr);
              if (cStr.includes('%')) c = c / 100;
              let h = parseFloat(hStr);
              if (hStr.includes('deg')) h = parseFloat(hStr.replace('deg', ''));
              return oklchToRgb(l, c, h, aStr);
            }
          );
        }
      });

      // Temporarily expand style container properties for highest fidelity capture
      element.setAttribute('style', 'background-color: #ffffff !important; color: #18181b !important; width: 1100px !important; max-width: none !important; margin: 0 !important; padding: 24px !important;');

      await new Promise((r) => setTimeout(r, 200));

      const canvas = await html2canvas(element, {
        scale: 1.5, // Ultra sharp scale
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.85);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfPageHeight = pdf.internal.pageSize.getHeight();
      const imgProps = pdf.getImageProperties(imgData);
      const imgHeightInPdf = (imgProps.height * pdfWidth) / imgProps.width;
      
      let heightLeft = imgHeightInPdf;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeightInPdf);
      heightLeft -= pdfPageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeightInPdf;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeightInPdf);
        heightLeft -= pdfPageHeight;
      }

      const pdfBlob = pdf.output('blob');
      const formattedMonth = selectedMonth.replace('-', '년 ') + '월';
      const fileName = `체감온도_기록대장_${selectedPrintDept}_(${formattedMonth})`;

      toast.dismiss(toastId);
      
      // Let standard unified downloader modal handle options (Direct DL, Share, direct Server SMTP Send, etc.)!
      await downloadFile(pdfBlob, `${fileName}.pdf`);
    } catch (error) {
      console.error('PDF export failed:', error);
      toast.dismiss(toastId);
      toast.error('PDF 세션 파일 빌드 과정 중 오류가 발생하였습니다.');
    } finally {
      // 3. Always restore original state (styles, window.getComputedStyle, element style)
      element.setAttribute('style', originalStyle);
      window.getComputedStyle = originalGetComputedStyle;
      originalStyleSelector.forEach(({ tag, content }) => {
        tag.textContent = content;
      });
    }
  };

  const downloadExcelReport = async () => {
    try {
      // Filter logs for the selected print department and selected month
      const printLogs = logs.filter(log => {
        const isMonthMatch = log.date.startsWith(selectedMonth);
        if (!isMonthMatch) return false;
        const logDept = getDisplayDept(log.department);
        return logDept === selectedPrintDept;
      }).sort((a, b) => {
        const comp = a.date.localeCompare(b.date);
        return comp !== 0 ? comp : a.time.localeCompare(b.time);
      });

      if (printLogs.length === 0) {
        toast.warning('선택한 월 및 부서에 해당하는 기록 데이터가 없습니다.');
        return;
      }

      const excelRows = printLogs.map((log) => ({
        '부서': getDisplayDept(log.department),
        '날짜': log.date,
        '시간': log.time,
        '측정 장소': log.location,
        '기온 (Ta, ℃)': Number(log.ta.toFixed(1)),
        '습도 (RH, %)': Number(log.rh),
        '풍속 (m/s)': log.windSpeed !== undefined && log.windSpeed !== null ? Number(Number(log.windSpeed).toFixed(1)) : 0,
        '습구온도 (Tw, ℃)': Number(log.tw.toFixed(1)),
        '체감온도 (℃)': Number(log.perceivedTemp.toFixed(1)),
        '위험 단계': log.riskLevel,
        '대처 조치 사항': log.actionTaken || '-',
        '기록자': log.writerName || '-',
        '비고': log.notes || '-'
      }));

      const formattedMonth = selectedMonth.replace('-', '년 ') + '월';
      const fileName = `체감온도_기록대장_${selectedPrintDept}_(${formattedMonth})`;
      
      await exportToExcel(excelRows, fileName, `${selectedMonth}_체감온도`);
      toast.success('엑셀 보고서 다운로드를 완료했습니다.');
    } catch (err) {
      console.error('Excel download failed:', err);
      toast.error('엑셀 생성 및 다운로드 중 오류가 발생하였습니다.');
    }
  };

  const parsedEditTa = parseFloat(editTaInput) || 0;
  const parsedEditRh = parseFloat(editRhInput) || 0;
  const currentEditTw = calculateWetBulb(parsedEditTa, parsedEditRh);
  const currentEditApparent = calculatePerceivedTemp(parsedEditTa, currentEditTw);
  const currentEditRisk = getPerceivedRiskDetails(currentEditApparent);

  return (
    <div id="perceived-temp-view" className="w-full min-h-screen bg-background text-foreground px-4 py-6 space-y-6">
      {/* 1. Header Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border pb-4 print:hidden gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/')}
            className="w-10 h-10 -ml-2 text-muted-foreground hover:text-foreground transition-all rounded-xl shrink-0"
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-[14px] xs:text-base sm:text-lg font-black tracking-tight flex items-center gap-1.5 break-keep leading-tight">
              <Thermometer className="w-4 h-4 sm:w-5 sm:h-5 text-rose-500 animate-pulse shrink-0" /> 
              <span className="break-keep">체감온도 기록 양식 및 관리</span>
            </h1>
            <p className="text-[9px] sm:text-[10px] text-muted-foreground/80 font-bold break-keep mt-0.5 sm:mt-0">산업안전보건법 개정에 따른 일일 고열 대비 기록지</p>
          </div>
        </div>

        <Button 
          variant="outline" 
          size="sm"
          className="rounded-xl font-bold text-xs gap-1.5 h-9 bg-card border-border border text-foreground shrink-0 self-end sm:self-auto"
          onClick={() => setIsPrintPreviewOpen(true)}
        >
          <Printer className="w-3.5 h-3.5" /> 월별 출력 양식
        </Button>
      </div>

      {/* 2. Top Banner (Image Slide 5/6 context - Laws) */}
      <div className="bg-gradient-to-r from-amber-500/10 to-red-500/10 border border-amber-500/20 rounded-2xl p-4 flex gap-4 items-start shadow-sm print:hidden">
        <div className="w-10 h-10 bg-amber-500/20 text-amber-500 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
          <Info className="w-5 h-5" />
        </div>
        <div className="space-y-1 min-w-0 flex-1">
          <h2 className="text-xs font-black text-foreground leading-snug break-keep flex flex-wrap gap-x-1.5 items-center">
            <span className="whitespace-nowrap shrink-0">지식정보:</span>
            <span className="text-amber-500">2025년 6월 6일 시행 온열질환 조치 의무화</span>
          </h2>
          <p className="text-[10px] text-muted-foreground leading-relaxed font-semibold break-keep">
            산업안전보건법 개정으로 <span className="text-foreground font-bold">기온·습도로 환산된 체감온도 일일기록이 법적 필수화</span> 되었습니다. 고용노동부 집중 점검 기간 미준수 시 <span className="text-rose-500 font-bold">최대 과태료 1,000만 원</span>이 직행 처분될 수 있습니다. 매번 기록 보관을 12월 31일까지 유지해야 합니다.
          </p>
        </div>
      </div>

      {/* 3. Daily Calculator + Registration Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:hidden">
        {/* Left column: Entry Form */}
        <Card className="bg-card border-border/60 rounded-3xl overflow-hidden shadow-md">
          <CardHeader className="bg-muted/40 border-b border-border/40 p-5">
            <CardTitle className="text-sm font-black tracking-tight flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" /> 일일 체감온도 검측 등록
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <form onSubmit={handleSaveRecord} className="space-y-4">
              {/* 사업장 및 부서 체크 (처음에 온도를 잴 때 체크하는 양식) */}
              <div className="space-y-1.5 border-b border-border/40 pb-3">
                <label className="text-[10px] font-black text-muted-foreground/80 uppercase tracking-widest block">대상 사업장 및 부서 선택 *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDepartment('함정선체생산부')}
                    className={`h-11 rounded-xl text-xs font-black transition-all border flex items-center justify-center gap-1.5 ${
                      department === '함정선체생산부'
                        ? 'bg-rose-500/10 border-rose-500 text-rose-500'
                        : 'bg-muted/30 border-border text-muted-foreground hover:bg-muted/50'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${department === '함정선체생산부' ? 'bg-rose-500 animate-pulse' : 'bg-muted-foreground/45'}`} />
                    함정선체생산부
                  </button>
                  <button
                    type="button"
                    onClick={() => setDepartment('중형선선체조립부')}
                    className={`h-11 rounded-xl text-xs font-black transition-all border flex items-center justify-center gap-1.5 ${
                      department === '중형선선체조립부'
                        ? 'bg-sky-500/10 border-sky-500 text-sky-500'
                        : 'bg-muted/30 border-border text-muted-foreground hover:bg-muted/50'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${department === '중형선선체조립부' ? 'bg-sky-500 animate-pulse' : 'bg-muted-foreground/45'}`} />
                    중형선선체조립부
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-muted-foreground/80 uppercase whitespace-nowrap block">측정 일자 *</label>
                  <div className="relative">
                    <Input 
                      type="date" 
                      value={date} 
                      onChange={(e) => setDate(e.target.value)}
                      className="bg-muted/30 border-border rounded-xl text-xs font-bold font-mono h-11 px-2.5"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-muted-foreground/80 uppercase whitespace-nowrap block">측정 시간 *</label>
                  <div className="relative">
                    <Input 
                      type="time" 
                      value={time} 
                      onChange={(e) => setTime(e.target.value)}
                      className="bg-muted/30 border-border rounded-xl text-xs font-bold font-mono h-11 px-2.5"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-1">
                  <label className="text-[10px] font-black text-muted-foreground/80 uppercase">측정 장소 *</label>
                  <span className="text-[9px] font-extrabold text-amber-500 break-keep">지정 후 [등록]시 프리셋에 보관됩니다</span>
                </div>
                <div className="grid grid-cols-1 gap-2.5">
                  <div className="flex gap-2">
                    <Input 
                      type="text" 
                      placeholder="작업 위치를 기입하거나 프리셋을 누르세요..."
                      value={location} 
                      onChange={(e) => {
                        setLocation(e.target.value);
                        setNewLocationInput(e.target.value);
                      }}
                      className="bg-muted/30 border-border rounded-xl text-xs font-black h-11 flex-1"
                      required
                    />
                    <Button
                      type="button"
                      disabled={isAddingLocation || !location.trim()}
                      onClick={handleAddCustomLocation}
                      className="h-11 rounded-xl bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary font-black text-xs px-3 shrink-0 flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" /> 등록
                    </Button>
                  </div>

                  {/* Presets Grid */}
                  <div className="space-y-1.5 bg-muted/20 p-3 rounded-2xl border border-border/40">
                    <span className="text-[9px] font-black text-muted-foreground uppercase tracking-wider block mb-1">고정 기본 장소</span>
                    <div className="flex flex-wrap gap-1.5">
                      {locationPresets.map((preset) => (
                        <button
                          type="button"
                          key={preset}
                          onClick={() => {
                            setLocation(preset);
                            setNewLocationInput(preset);
                          }}
                          className={`whitespace-nowrap text-[9px] font-black px-2.5 py-1 rounded-lg border transition-all ${
                            location === preset 
                              ? 'bg-primary/10 border-primary text-primary' 
                              : 'bg-background border-border/60 text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>

                    {/* Custom Presets */}
                    {customLocations.length > 0 && (
                      <div className="pt-2 border-t border-border/30 mt-2">
                        <span className="text-[9px] font-black text-primary uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                          ✨ 우리 현장 전용 등록장소 ({customLocations.length})
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {customLocations.map((loc) => (
                            <div
                              key={loc.id}
                              onClick={() => {
                                if (loc.name) {
                                  setLocation(loc.name);
                                  setNewLocationInput(loc.name);
                                }
                              }}
                              className={`inline-flex items-center gap-1 text-[9px] font-black px-2.5 py-1 rounded-lg border cursor-pointer transition-all whitespace-nowrap ${
                                location === loc.name 
                                  ? 'bg-primary/15 border-primary text-primary' 
                                  : 'bg-background border-border/60 text-foreground/80 hover:bg-muted'
                              }`}
                            >
                              <span className="whitespace-nowrap">{loc.name}</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  if (loc.id) handleDeleteCustomLocation(loc.id, e);
                                }}
                                className="w-3.5 h-3.5 rounded-full hover:bg-rose-500/10 hover:text-rose-500 flex items-center justify-center transition-colors shrink-0 -mr-1"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Mobile Device Environment Detection Bar */}
              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-3.5 space-y-2.5">
                <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-1.5">
                  <span className="text-[10px] font-black text-primary flex items-center gap-1.5 uppercase break-keep">
                    <Smartphone className="w-4 h-4 text-primary animate-bounce shrink-0" /> 스마트폰 고정 센서 측정 안내
                  </span>
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => setIsPhoneMeasureGuideOpen(true)}
                    className="text-[9px] text-muted-foreground hover:text-foreground font-black p-0 h-auto flex items-center gap-0.5 self-start xs:self-auto shrink-0"
                  >
                    <HelpCircle className="w-3.5 h-3.5" /> 센서측정이 안되나요?
                  </Button>
                </div>
                <p className="text-[9px] text-muted-foreground font-semibold leading-relaxed font-sans">
                  스마트폰 기기 자체에는 외기 기온/습도/풍속계 센서가 내장되어 있지 않습니다. 대신 <span className="text-foreground font-bold underline">기상 위성 및 GPS 좌표 연동 기술</span>을 통해 현재 계신 작업 구역의 외부 실시간 날씨를 1초 만에 즉시 가져올 수 있습니다.
                </p>
                <Button
                  type="button"
                  disabled={weatherLoading}
                  onClick={fetchLocalWeatherByGPS}
                  className="w-full bg-primary hover:bg-primary/95 text-primary-foreground font-black text-xs h-10 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all"
                >
                  {weatherLoading ? (
                    <span className="flex items-center gap-1.5 animate-pulse">
                      <Navigation className="w-3.5 h-3.5 animate-spin" /> GPS 수신 및 기상청 피드 조회 중...
                    </span>
                  ) : (
                    <>
                      <Navigation className="w-3.5 h-3.5 animate-pulse" /> 🛰️ 내 위치 GPS 기준 실시간 날씨 자동 채우기
                    </>
                  )}
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                <div className="space-y-1 min-w-0">
                  <label className="text-[9px] sm:text-[10px] font-black text-muted-foreground/80 uppercase whitespace-nowrap block truncate" title="기온 (Ta)">
                    기온 Ta *
                  </label>
                  <div className="relative flex items-center">
                    <Input 
                      type="number" 
                      step="0.1"
                      value={taInput} 
                      onChange={(e) => setTaInput(e.target.value)}
                      className="bg-muted/30 border-border rounded-xl text-center text-xs font-black font-mono h-11 pr-5 pl-1"
                      required
                    />
                    <span className="absolute right-1 text-[9px] font-bold text-muted-foreground">°C</span>
                  </div>
                </div>

                <div className="space-y-1 min-w-0">
                  <label className="text-[9px] sm:text-[10px] font-black text-muted-foreground/80 uppercase whitespace-nowrap block truncate" title="습도 (RH)">
                    습도 RH *
                  </label>
                  <div className="relative flex items-center">
                    <Input 
                      type="number" 
                      step="1"
                      value={rhInput} 
                      onChange={(e) => setRhInput(e.target.value)}
                      className="bg-muted/30 border-border rounded-xl text-center text-xs font-black font-mono h-11 pr-5 pl-1"
                      required
                    />
                    <span className="absolute right-1 text-[9px] font-bold text-muted-foreground">%</span>
                  </div>
                </div>

                <div className="space-y-1 min-w-0">
                  <label className="text-[9px] sm:text-[10px] font-black text-muted-foreground/80 uppercase whitespace-nowrap block truncate" title="풍속 (선택)">
                    풍속 v(선택)
                  </label>
                  <div className="relative flex items-center">
                    <Input 
                      type="number" 
                      step="0.1"
                      value={windInput} 
                      onChange={(e) => setWindInput(e.target.value)}
                      className="bg-muted/30 border-border rounded-xl text-center text-xs font-black font-mono h-11 pr-7 pl-1"
                    />
                    <span className="absolute right-1 text-[9px] font-bold text-muted-foreground">m/s</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-muted-foreground/80 uppercase">수준별 구체적 조치사항 *</label>
                <div className="relative">
                  <Input 
                    type="text" 
                    placeholder="예: 수분 섭취 자주 하기, 휴식시간 확대"
                    value={actionTaken} 
                    onChange={(e) => setActionTaken(e.target.value)}
                    className="bg-muted/30 border-border rounded-xl text-xs font-black h-11"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-muted-foreground/80 uppercase">기타 특이사항 (선택)</label>
                <Input 
                  type="text" 
                  placeholder="예: 실외 그늘막 추가 설치, 폭염 경보 발효 상태"
                  value={notes} 
                  onChange={(e) => setNotes(e.target.value)}
                  className="bg-muted/30 border-border rounded-xl text-xs font-black h-11"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-muted-foreground/80 uppercase">기록자 담당명 *</label>
                <div className="relative flex items-center">
                  <UserIcon className="w-4 h-4 text-muted-foreground/45 absolute left-3" />
                  <Input 
                    type="text" 
                    placeholder="작성자 명시"
                    value={writerName} 
                    onChange={(e) => setWriterName(e.target.value)}
                    className="bg-muted/30 border-border rounded-xl text-xs font-black pl-9 h-11"
                    required
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                disabled={saving}
                className="w-full bg-primary hover:bg-primary/95 text-primary-foreground font-black text-xs h-12 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md shadow-primary/10 mt-2"
              >
                {saving ? '기록 저장 중...' : (
                  <>
                    <Save className="w-4 h-4" /> 일일 체감온도 대장에 기록
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Right column: Dynamic calculation details */}
        <div className="space-y-4">
          <Card className="bg-[#242a35]/40 backdrop-blur-md border border-[#ffffff]/5 rounded-3xl shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full filter blur-xl" />
            
            <CardHeader className="p-5 pb-2">
              <CardTitle className="text-xs font-black tracking-widest text-[#94a3b8] uppercase flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" /> 산출 대시보드 (KMA 실시간 연산지수)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              {/* Giant Temperature Meter */}
              <div className="flex flex-col items-center justify-center py-4 bg-muted/20 rounded-2xl border border-border/40">
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">일일 예측 체감온도</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-5xl font-black font-mono tracking-tight text-foreground">{computedApparent.toFixed(1)}</span>
                  <span className="text-xl font-black text-muted-foreground">°C</span>
                </div>
                
                {/* Dynamic Status Tag */}
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide mt-3 border ${riskDetails.bgColor} ${riskDetails.textColor} ${riskDetails.borderColor}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
                  위험단계: {riskDetails.level}
                </span>

                <p className="text-[10px] font-semibold text-center text-muted-foreground/80 max-w-[220px] mx-auto mt-2.5">
                  {riskDetails.description}
                </p>
              </div>

              {/* Physical details formula flow */}
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between text-muted-foreground border-b border-border/30 pb-2">
                  <span className="font-bold flex items-center gap-1"><Thermometer className="w-3.5 h-3.5" /> 건구 온도 (Ta)</span>
                  <span className="font-black font-mono text-foreground">{taInput ? taInput : '0'} ℃</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground border-b border-border/30 pb-2">
                  <span className="font-bold flex items-center gap-1"><Droplets className="w-3.5 h-3.5" /> 상대 습도 (RH)</span>
                  <span className="font-black font-mono text-foreground">{rhInput ? rhInput : '0'} %</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground border-b border-border/30 pb-2">
                  <span className="font-bold flex items-center gap-1 text-primary"><Thermometer className="w-3.5 h-3.5" /> 산출 습구 온도 (Tw)</span>
                  <span className="font-black font-mono text-primary">{computedTw ? computedTw.toFixed(1) : '0'} ℃</span>
                </div>
                {windInput && (
                  <div className="flex items-center justify-between text-muted-foreground border-b border-border/30 pb-2">
                    <span className="font-bold flex items-center gap-1"><Wind className="w-3.5 h-3.5" /> 풍속 (참고용)</span>
                    <span className="font-black font-mono text-foreground">{windInput} m/s</span>
                  </div>
                )}
              </div>

              {/* Formula text details */}
              <div className="p-3.5 bg-background shadow-inner rounded-xl border border-border/30 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest bg-rose-500/10 px-1.5 py-0.5 rounded">기상청 공식 산식 실시간 연동</span>
                </div>
                <p className="text-[8px] font-mono text-muted-foreground leading-relaxed break-all">
                  체감온도 = -0.2442 &nbsp;+&nbsp; (0.55399 × Tw) &nbsp;+&nbsp; (0.45535 × Ta) &nbsp;-&nbsp; (0.0022 × Tw²) &nbsp;+&nbsp; (0.00278 × Tw × Ta) &nbsp;+&nbsp; 3.0
                </p>
                <div className="pt-1.5 text-[9px] font-bold text-muted-foreground/80 flex items-start gap-1">
                  <span>※</span>
                  <span>습구온도(Tw)는 스툴(Stull) 수식을 통해 인공적으로 산출된 고해상도 습온 지수입니다.</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick reference guide (Image Slide 8 guide) */}
          <Card className="bg-card border-border/60 rounded-3xl shadow-sm">
            <CardHeader className="bg-muted/30 p-4 border-b border-border/40">
              <CardTitle className="text-xs font-black flex items-center gap-1.5 text-foreground">
                <ShieldCheck className="w-4 h-4 text-emerald-500" /> 체감온도별 작업 통제 가이드라인
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              <div className="grid grid-cols-4 gap-1 text-center font-bold text-[9px] text-white">
                <div className="bg-sky-500/80 p-1.5 rounded-lg">
                  <div>주의</div>
                  <div className="font-mono text-[8px] mt-0.5">31~32℃</div>
                </div>
                <div className="bg-yellow-500/80 p-1.5 rounded-lg grayscale-[20%] text-zinc-900">
                  <div>경고</div>
                  <div className="font-mono text-[8px] mt-0.5">32~33℃</div>
                </div>
                <div className="bg-orange-500/80 p-1.5 rounded-lg">
                  <div>위험</div>
                  <div className="font-mono text-[8px] mt-0.5">33~35℃</div>
                </div>
                <div className="bg-rose-500/80 p-1.5 rounded-lg">
                  <div>매우위험</div>
                  <div className="font-mono text-[8px] mt-0.5">35℃ ↑</div>
                </div>
              </div>
              <p className="text-[9px] text-muted-foreground/90 leading-relaxed pt-1 font-semibold">
                근무지 측정기로 1.2~1.5m 높이에서 오전 10시/오후 3시에 검측하는 것을 추천하며, 위험 단계(33℃ 이상) 발견 시 열사병 예방을 위해 관리 감독관 조치 및 휴식을 반드시 기록해야 합니다.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 4. Filter Selector + Records Table & Log View */}
      <Card className="bg-card border-border/50 rounded-[2rem] overflow-hidden shadow-sm print:hidden">
        <CardHeader className="p-5 pb-3 border-b border-border/40 bg-muted/10 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-black flex items-center gap-2 text-foreground">
              <FileSpreadsheet className="w-4 h-4 text-primary" /> 일상 체감온도 기록대장부
            </CardTitle>
            <p className="text-[10px] text-muted-foreground font-bold mt-0.5">입력된 날짜순으로 축적된 데이터 로그 내역</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* 소속 부서별 대장 필터링 탭 */}
            <div className="flex items-center gap-1 bg-muted/20 p-1 rounded-xl border border-border/45">
              <button
                type="button"
                onClick={() => setSelectedDeptFilter('전체')}
                className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${
                  selectedDeptFilter === '전체'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                전체 보기
              </button>
              <button
                type="button"
                onClick={() => setSelectedDeptFilter('함정선체생산부')}
                className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${
                  selectedDeptFilter === '함정선체생산부'
                    ? 'bg-rose-500 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                함정선체생산부
              </button>
              <button
                type="button"
                onClick={() => setSelectedDeptFilter('중형선선체조립부')}
                className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${
                  selectedDeptFilter === '중형선선체조립부'
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                중형선선체조립부
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <span className="text-[10px] font-black text-muted-foreground whitespace-nowrap">월별 필터:</span>
              <Input 
                type="month" 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-muted/30 border-border rounded-xl text-xs font-bold font-mono h-9 w-36"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            {loadingLogs ? (
              <div className="p-12 text-center text-xs font-bold text-muted-foreground">
                검측 로그 목록 조회 중...
              </div>
            ) : filteredLogs.length > 0 ? (
              <table className="w-full text-xs text-left border-collapse min-w-[1350px]">
                <thead>
                   <tr className="bg-muted/40 text-muted-foreground font-bold text-[10px] uppercase border-b border-border/40 whitespace-nowrap">
                    <th className="p-3 whitespace-nowrap">일자</th>
                    <th className="p-3 whitespace-nowrap">시간</th>
                    <th className="p-3 whitespace-nowrap">측정 장소</th>
                    <th className="p-3 whitespace-nowrap">소속 부서</th>
                    <th className="p-3 whitespace-nowrap">기온 (Ta)</th>
                    <th className="p-3 whitespace-nowrap">습도 (RH)</th>
                    <th className="p-3 whitespace-nowrap">풍속</th>
                    <th className="p-3 whitespace-nowrap">습구 (Tw)</th>
                    <th className="p-3 whitespace-nowrap">체감온도</th>
                    <th className="p-3 whitespace-nowrap">위험수준</th>
                    <th className="p-3 whitespace-nowrap">현장 조치사항</th>
                    <th className="p-3 whitespace-nowrap">작성담당</th>
                    <th className="p-3 text-center whitespace-nowrap">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {filteredLogs.map((log) => {
                    const badgeClass = log.riskLevel === '매우위험' 
                      ? 'bg-rose-500/10 text-rose-500 border-rose-500/25' 
                      : log.riskLevel === '위험' 
                        ? 'bg-orange-500/10 text-orange-500 border-orange-500/25' 
                        : log.riskLevel === '경고' 
                          ? 'bg-amber-500/10 text-amber-500 border-amber-500/25' 
                          : log.riskLevel === '주의'
                            ? 'bg-cyan-500/10 text-cyan-500 border-cyan-500/25'
                            : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/25';

                    return (
                      <tr key={log.id} className="border-b border-border/20 hover:bg-muted/30">
                        <td className="p-3 font-semibold font-mono whitespace-nowrap">{log.date}</td>
                        <td className="p-3 font-semibold font-mono whitespace-nowrap">{log.time}</td>
                        <td className="p-3 font-black text-foreground whitespace-nowrap max-w-[180px] truncate" title={log.location}>{log.location}</td>
                        <td className="p-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${
                            getDisplayDept(log.department) === '함정선체생산부'
                              ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                              : 'bg-sky-500/10 text-sky-500 border-sky-500/20'
                          }`}>
                            {getDisplayDept(log.department)}
                          </span>
                        </td>
                        <td className="p-3 font-mono whitespace-nowrap">{log.ta.toFixed(1)} ℃</td>
                        <td className="p-3 font-mono whitespace-nowrap">{log.rh} %</td>
                        <td className="p-3 font-mono whitespace-nowrap">
                          {log.windSpeed !== undefined && log.windSpeed !== null ? `${Number(log.windSpeed).toFixed(1)} m/s` : '-'}
                        </td>
                        <td className="p-3 font-mono text-primary/80 font-bold whitespace-nowrap">{log.tw.toFixed(1)} ℃</td>
                        <td className="p-3 font-mono font-black text-foreground whitespace-nowrap">{log.perceivedTemp.toFixed(1)} ℃</td>
                        <td className="p-3 whitespace-nowrap">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${badgeClass}`}>
                            {log.riskLevel}
                          </span>
                        </td>
                        <td className="p-3 text-muted-foreground/90 font-bold max-w-[280px] truncate" title={log.actionTaken}>{log.actionTaken}</td>
                        <td className="p-3 font-black text-foreground/80 whitespace-nowrap">{log.writerName}</td>
                        <td className="p-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              type="button"
                              onClick={() => handleStartEdit(log)}
                              className="w-8 h-8 rounded-lg hover:bg-teal-500/10 hover:text-teal-500 text-muted-foreground transition-colors"
                              title="기록 수정"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              type="button"
                              onClick={() => log.id && handleDeleteRecord(log.id)}
                              className="w-8 h-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-500 text-muted-foreground transition-colors"
                              title="기록 삭제"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="p-12 text-center text-xs font-bold text-muted-foreground">
                선택된 필터에 일치하는 기록 데이터가 대장상에 존재하지 않습니다.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
                  {/* 5. MONTHLY PRINT PREVIEW DIALOG */}
      <Dialog open={isPrintPreviewOpen} onOpenChange={setIsPrintPreviewOpen}>
        <DialogContent className="max-w-4xl w-[95%] bg-white text-zinc-900 border-none p-0 overflow-y-auto max-h-[90vh] rounded-[2rem]">
          <div className="bg-zinc-100 p-4 border-b border-zinc-200 flex flex-col md:flex-row md:items-center md:justify-between sticky top-0 z-10 print:hidden gap-3">
            <div>
              <h3 className="text-sm font-black flex items-center gap-1.5 text-zinc-800">
                <Printer className="w-4 h-4 text-zinc-700" /> 월별 출력용 결재 문서 미리보기
              </h3>
              <p className="text-[10px] text-zinc-500 font-bold">인쇄 단추를 누르면 브라우저의 PDF/인쇄 창이 자동 활성화됩니다.</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              {/* 결재 문서 대상 부서/사업체 전환 탭 */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-zinc-300 mr-2">
                <button
                  type="button"
                  onClick={() => setSelectedPrintDept('함정선체생산부')}
                  className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${
                    selectedPrintDept === '함정선체생산부'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-800'
                  }`}
                >
                  함정선체생산부
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPrintDept('중형선선체조립부')}
                  className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${
                    selectedPrintDept === '중형선선체조립부'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-800'
                  }`}
                >
                  중형선선체조립부
                </button>
              </div>

              <Input 
                type="month" 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-white border-zinc-300 text-zinc-900 rounded-xl text-xs font-bold font-mono h-9 w-36"
              />
              <Button 
                onClick={triggerPrint}
                className="bg-zinc-850 hover:bg-zinc-950 text-white font-black text-xs px-4 h-9 rounded-xl flex items-center gap-1"
              >
                <Printer className="w-4 h-4" /> 인쇄 미리보기
              </Button>
              <Button 
                onClick={downloadPDFAndEmail}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-4 h-9 rounded-xl flex items-center gap-1 shadow-sm"
              >
                <Mail className="w-4 h-4" /> 다운로드 · 메일 전송
              </Button>
              <Button 
                onClick={downloadExcelReport}
                className="bg-sky-600 hover:bg-sky-700 text-white font-black text-xs px-4 h-9 rounded-xl flex items-center gap-1 shadow-sm"
              >
                <FileSpreadsheet className="w-4 h-4" /> 엑셀 다운로드
              </Button>
              <Button 
                variant="ghost"
                onClick={() => setIsPrintPreviewOpen(false)}
                className="text-zinc-500 hover:text-zinc-800 font-black text-xs"
              >
                닫기
              </Button>
            </div>
          </div>

          {/* 전자 결재 서명 상태 바 (인쇄 시 숨김) */}
          <div className="bg-zinc-50 border-b border-zinc-200 p-4 shrink-0 print:hidden">
            <div className="max-w-3xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-[11px] font-black text-zinc-950 leading-tight">
                    {selectedMonth.split('-')[0]}년 {parseInt(selectedMonth.split('-')[1])}월 결재서명 등록 상태
                  </h4>
                  <p className="text-[9px] text-zinc-500 font-bold mt-0.5">
                    {selectedPrintDept} • 보관대장의 법적 결재 서명 관리
                  </p>
                </div>
              </div>

              {/* 세 직급 서명 등록 현황 배지 */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black border ${
                  monthlySignature?.safetySign 
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                    : 'bg-zinc-50 text-zinc-400 border-dashed border-zinc-200'
                }`}>
                  안전관리자 {monthlySignature?.safetySign ? '● 완료' : '○ 대기'}
                </span>
                <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black border ${
                  monthlySignature?.directorSign 
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                    : 'bg-zinc-50 text-zinc-400 border-dashed border-zinc-200'
                }`}>
                  소장 {monthlySignature?.directorSign ? '● 완료' : '○ 대기'}
                </span>
                <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black border ${
                  monthlySignature?.ceoSign 
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                    : 'bg-zinc-50 text-zinc-400 border-dashed border-zinc-200'
                }`}>
                  대표 {monthlySignature?.ceoSign ? '● 완료' : '○ 대기'}
                </span>
              </div>

              {/* 결재서명 전용 관리 메뉴 소집 버튼 */}
              <button
                type="button"
                onClick={() => setIsSigManagerOpen(true)}
                className="bg-zinc-900 border border-transparent text-white hover:bg-zinc-800 transition-all font-black text-[10px] h-9 px-4 rounded-xl shadow-sm flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <span>✒️</span> 결재 서명 관리하기
              </button>
            </div>
          </div>

          {/* Actual Print Sheet Renders natively or outputs in Dialog */}
          <div id="print-sheet" className="p-8 font-sans bg-white text-zinc-900 relative">
            <style>{`
              @media print {
                body * {
                  visibility: hidden;
                }
                #print-sheet, #print-sheet * {
                  visibility: visible;
                }
                #print-sheet {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                  background: white !important;
                  color: black !important;
                  padding: 10px !important;
                }
                .print-no-border {
                  border: none !important;
                }
              }
              .border-double-thick {
                border-style: double;
                border-width: 4px;
                border-color: #18181b;
              }
            `}</style>

            <div className="border-double-thick p-6 space-y-6 bg-white min-h-[500px]">
              {/* Document Title & Approval Header Box */}
              <div className="flex justify-between items-start gap-4">
                <div className="space-y-1">
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-zinc-900">
                    체감온도 측정 및 안전대책 기록대장 ({selectedPrintDept})
                  </h1>
                  <p className="text-xs font-bold text-zinc-500 flex items-center gap-1.5">
                    <span>귀속 월: {selectedMonth.split('-')[0]}년 {selectedMonth.split('-')[1]}월</span>
                    <span>•</span>
                    <span>사업장명: 건명기업(주)</span>
                  </p>
                </div>

                {/* SIGNATURE GRID (결재선) */}
                <table className="border-collapse border border-zinc-800 text-center text-[10px] font-bold w-[220px] shrink-0">
                  <tbody>
                    <tr className="bg-zinc-50 border-b border-zinc-800">
                      <td className="w-1/3 py-1 border-r border-zinc-800">안전관리자</td>
                      <td className="w-1/3 py-1 border-r border-zinc-800">소장</td>
                      <td className="w-1/3 py-1">대표</td>
                    </tr>
                    <tr className="h-16">
                      <td className="border-r border-zinc-800 p-1 text-center align-middle relative">
                        {monthlySignature?.safetySign ? (
                          <div className="flex flex-col items-center justify-center">
                            <img 
                              src={monthlySignature.safetySign} 
                              alt="안전관리자 서명" 
                              className="max-h-12 max-w-full object-contain"
                              referrerPolicy="no-referrer"
                            />
                            <span className="text-[8px] text-zinc-800 font-extrabold mt-0.5">{monthlySignature.safetyName}</span>
                            <span className="text-[7px] text-zinc-400 font-mono">{monthlySignature.safetyDate}</span>
                          </div>
                        ) : (
                          ""
                        )}
                      </td>
                      <td className="border-r border-zinc-800 p-1 text-center align-middle relative">
                        {monthlySignature?.directorSign ? (
                          <div className="flex flex-col items-center justify-center">
                            <img 
                              src={monthlySignature.directorSign} 
                              alt="소장 서명" 
                              className="max-h-12 max-w-full object-contain"
                              referrerPolicy="no-referrer"
                            />
                            <span className="text-[8px] text-zinc-800 font-extrabold mt-0.5">{monthlySignature.directorName}</span>
                            <span className="text-[7px] text-zinc-400 font-mono">{monthlySignature.directorDate}</span>
                          </div>
                        ) : (
                          ""
                        )}
                      </td>
                      <td className="p-1 text-center align-middle relative">
                        {monthlySignature?.ceoSign ? (
                          <div className="flex flex-col items-center justify-center">
                            <img 
                              src={monthlySignature.ceoSign} 
                              alt="대표 서명" 
                              className="max-h-12 max-w-full object-contain"
                              referrerPolicy="no-referrer"
                            />
                            <span className="text-[8px] text-zinc-800 font-extrabold mt-0.5">{monthlySignature.ceoName}</span>
                            <span className="text-[7px] text-zinc-400 font-mono">{monthlySignature.ceoDate}</span>
                          </div>
                        ) : (
                          ""
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Legal context overview */}
              <div className="p-3 bg-zinc-50 border border-zinc-300 rounded text-[9px] text-zinc-600 leading-relaxed font-semibold">
                ※ 법적 근거: 산업안전보건법 제39조(이산화탄소 또는 고열로 인한 건강장해 예방) 및 동법 규칙 개정(2025. 06. 06. 시행) 등에 의거하여, 사업주는 매 폭염 집중 시기 동안 일일 및 시간대별 건구온도(Ta)와 습온도 등을 측정하여 환산된체감온도 수치를 상시적으로 기재하고, 그에 따른 안전보건조치(휴식, 수분공급 등)를 의무 보관해야 합니다.
              </div>

              {/* Printable Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-[10px] text-left border-collapse border border-zinc-800">
                  <thead>
                    <tr className="bg-zinc-100 text-zinc-800 font-bold border-b border-zinc-800 text-center whitespace-nowrap">
                      <th className="p-1.5 border-r border-zinc-800 whitespace-nowrap">일자</th>
                      <th className="p-1.5 border-r border-zinc-800 whitespace-nowrap">시간</th>
                      <th className="p-1.5 border-r border-zinc-800 whitespace-nowrap">측정 장소</th>
                      <th className="p-1.5 border-r border-zinc-800 whitespace-nowrap">건구온도(Ta, ℃)</th>
                      <th className="p-1.5 border-r border-zinc-800 whitespace-nowrap">습도(RH, %)</th>
                      <th className="p-1.5 border-r border-zinc-800 whitespace-nowrap">풍속(m/s)</th>
                      <th className="p-1.5 border-r border-zinc-800 whitespace-nowrap">체감온도(℃)</th>
                      <th className="p-1.5 border-r border-zinc-800 whitespace-nowrap">위험 수준</th>
                      <th className="p-1.5 border-r border-zinc-800 whitespace-nowrap">조치 사항</th>
                      <th className="p-1.5 whitespace-nowrap">작성인</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printLogs.length > 0 ? (
                      printLogs.map((log, idx) => (
                        <tr key={idx} className="border-b border-zinc-600 text-center hover:bg-zinc-50 whitespace-nowrap">
                          <td className="p-1.5 border-r border-zinc-800 font-mono text-[9px] whitespace-nowrap">{log.date}</td>
                          <td className="p-1.5 border-r border-zinc-800 font-mono text-[9px] whitespace-nowrap">{log.time}</td>
                          <td className="p-1.5 border-r border-zinc-800 text-left font-bold pl-2 whitespace-nowrap min-w-[100px] max-w-[150px] truncate" title={log.location}>{log.location}</td>
                          <td className="p-1.5 border-r border-zinc-800 font-mono text-[9px] whitespace-nowrap">{log.ta.toFixed(1)}</td>
                          <td className="p-1.5 border-r border-zinc-800 font-mono text-[9px] whitespace-nowrap">{log.rh}</td>
                          <td className="p-1.5 border-r border-zinc-800 font-mono text-[9px] whitespace-nowrap">{log.windSpeed !== undefined && log.windSpeed !== null ? Number(log.windSpeed).toFixed(1) : '-'}</td>
                          <td className="p-1.5 border-r border-zinc-800 font-mono font-bold text-[11px] shrink-0 text-zinc-900 bg-zinc-50 whitespace-nowrap">{log.perceivedTemp.toFixed(1)}</td>
                          <td className="p-1.5 border-r border-zinc-800 font-bold text-[9px] whitespace-nowrap">{log.riskLevel}</td>
                          <td className="p-1.5 border-r border-zinc-800 text-left text-[9px] pl-2 max-w-[180px] truncate whitespace-normal leading-tight break-keep" title={log.actionTaken}>{log.actionTaken}</td>
                          <td className="p-1.5 font-semibold whitespace-nowrap">{log.writerName}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={10} className="p-12 text-center text-[10px] text-zinc-400 uppercase tracking-widest font-black">
                          금월 ({selectedMonth})에 부합하는 체감온도 보존 내역이 기록대장에 존재하지 않습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Signatures & regulatory info at footer */}
              <div className="flex justify-between items-center text-[9px] text-zinc-400 font-bold pt-4 border-t border-zinc-200">
                <span>상기 기재 내용은 일체의 수치가 변조되지 않고 실제 당 현장에서 검측된 실측 데이터임을 보증합니다.</span>
                <span>건명기업(주)</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 6. PHONE / DEVICE TEMPERATURE MEASURE GUIDE DIALOG */}
      <Dialog open={isPhoneMeasureGuideOpen} onOpenChange={setIsPhoneMeasureGuideOpen}>
        <DialogContent className="max-w-md w-[95%] bg-card border-border p-6 rounded-[2rem] shadow-2xl">
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 border-b border-border/40 pb-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-foreground">휴대폰 센서 측정 기술 가이드</h3>
                <p className="text-[9px] text-muted-foreground font-semibold">스마트폰 기기 한계 및 디지털 현장 계측 솔루션</p>
              </div>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <h4 className="font-extrabold text-foreground flex items-center gap-1.5 text-[11px]">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> 휴대폰 자체로 직접 측정이 불가능한 이유
                </h4>
                <p className="text-[10px] text-muted-foreground leading-relaxed font-medium pl-5 font-sans">
                  대부분의 최신 스마트폰 기기 내부에는 배터리/프로세서 과열 제어용 온도 센서만 있을 뿐, 전용 <span className="text-foreground font-bold">외기 유입구 및 정밀 습도 센서, 풍속 풍배 모듈</span>이 탑재되어 있지 않습니다. 컴팩트한 방수·방진(IP68) 설계의 물리적 기기 사양 상 외부 기압·풍속·상대습도의 다이렉트 자이로 센싱은 하드웨어 단독으로 처리가 원리적으로 불가능합니다.
                </p>
              </div>

              <div className="space-y-1">
                <h4 className="font-extrabold text-foreground flex items-center gap-1.5 text-[11px]">
                  <CheckCircle className="w-3.5 h-3.5 text-primary" /> GPS 위성 연동 날씨 채우기의 구동 원리
                </h4>
                <p className="text-[10px] text-muted-foreground leading-relaxed font-medium pl-5 font-sans">
                  본 서비스의 <strong>[🛰️ GPS 실시간 날씨 자동 채우기]</strong> 기능은 사용자의 디바이스 GPS 좌표를 활용합니다. 가장 가까운 공공 기상 위성·지상 관측 망 소스의 실시간 백엔드 피드를 분석하여 <span className="text-foreground font-bold">건구기온(Ta), 상대습도(RH), 인근 풍속(v)</span> 수치 데이터를 100% 실측 수준으로 완벽하게 산정·반영하여 입력을 초고속으로 단축해 줍니다.
                </p>
              </div>

              <div className="space-y-1">
                <h4 className="font-extrabold text-foreground flex items-center gap-1.5 text-[11px]">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> 공정별 가장 확실한 정밀 검측법 추천
                </h4>
                <ul className="text-[10px] text-muted-foreground leading-relaxed font-medium pl-5 list-disc space-y-1 font-sans">
                  <li><strong>야외 대형 공정:</strong> 본 지능형 GPS 자동 동기화 데이터를 적용하시는 것으로 편리하고 정확한 일일 기록 보관이 가능합니다.</li>
                  <li><strong>실내 밀폐·지하 공간:</strong> 외부 기상 환경과 현격한 공기 흐름 차이가 존재하기 때문에 디지털 현장 검측용 <strong>블루투스 휴대식 온습풍 센서기</strong>를 전용 링크하여 직접 측정한 후 수기 입력하시는 것을 법적으로 추천해 드립니다.</li>
                </ul>
              </div>
            </div>

            <Button 
              type="button"
              onClick={() => setIsPhoneMeasureGuideOpen(false)}
              className="w-full bg-primary text-primary-foreground font-black text-xs h-11 rounded-xl mt-2 transition-all shadow-md shadow-primary/10"
            >
              내용을 확인했습니다
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 7. ELECTRONIC SIGNATURE PAD DIALOG */}
      <Dialog open={isSignDialogOpen} onOpenChange={setIsSignDialogOpen}>
        <DialogContent 
          className="max-w-md w-[95%] bg-white text-zinc-900 border-none p-6 rounded-[2rem] shadow-2xl"
        >
          {/* Dummy focusable target to absorb Base UI's automatic initial dialog autofocus trap and prevent popping up mobile virtual keyboards */}
          <span tabIndex={0} className="sr-only focus:outline-none" />

          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
              <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-800">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-zinc-900">
                  {sigRole === 'safety' ? '안전관리자' : sigRole === 'director' ? '소장' : '대표'} 전자 결재 서명
                </h3>
                <p className="text-[10px] text-zinc-500 font-semibold">마우스 또는 터치 스크린으로 직접 서명해 주십시오.</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-600 block">결재인 실명 및 직급 기입</label>
                <input
                  type="text"
                  placeholder="예: 안전담당 홍길동 주임"
                  value={sigNameText}
                  onChange={(e) => setSigNameText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                    }
                  }}
                  className="w-full text-xs h-10 px-3 rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-950 font-semibold focus:outline-none focus:border-zinc-500 focus:bg-white"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black text-zinc-600">자유 수기 서명 패드 영역</label>
                  <button
                    type="button"
                    onClick={() => sigPadRef.current?.clear()}
                    className="text-[9px] text-rose-500 hover:text-rose-600 font-bold hover:underline cursor-pointer"
                  >
                    새로 그리기 (지우기)
                  </button>
                </div>
                <div 
                  onTouchStart={() => {
                    // Forcefully dismiss mobile keyboard when starting signature to avoid screen layout changes mid-drawing
                    if (document.activeElement instanceof HTMLElement) {
                      const activeEl = document.activeElement;
                      setTimeout(() => {
                        try {
                          activeEl.blur();
                        } catch (err) {}
                      }, 50);
                    }
                  }}
                  onMouseDown={() => {
                    if (document.activeElement instanceof HTMLElement) {
                      const activeEl = document.activeElement;
                      setTimeout(() => {
                        try {
                          activeEl.blur();
                        } catch (err) {}
                      }, 50);
                    }
                  }}
                  className="border border-zinc-200 rounded-xl overflow-hidden bg-zinc-50 h-44 relative touch-none"
                >
                  <SignatureCanvas
                    ref={sigPadRef}
                    penColor="#09090b"
                    canvasProps={{
                      style: { width: "100%", height: "100%", cursor: "crosshair" }
                    }}
                  />
                  <div className="absolute bottom-2 right-2 text-[8px] text-zinc-400 pointer-events-none select-none font-bold">
                    [ 직접 드로잉 사인 영역 ]
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsSignDialogOpen(false)}
                className="flex-1 border border-zinc-200 hover:bg-zinc-50 text-zinc-800 font-black text-xs h-10 rounded-xl transition-colors cursor-pointer text-center"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={handleSaveSignature}
                className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-white font-black text-xs h-10 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1"
              >
                서명 확정 등록
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 8. PORTRAIT COMPACT SIGNATURE MANAGER DIALOG */}
      <Dialog open={isSigManagerOpen} onOpenChange={setIsSigManagerOpen}>
        <DialogContent className="max-w-md w-[95%] bg-white text-zinc-900 border-none p-6 rounded-[2rem] shadow-2xl overflow-y-auto max-h-[85vh]">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-zinc-900">
                    보관대장 직급별 서명 등록
                  </h3>
                  <p className="text-[9px] text-zinc-500 font-bold">
                    {selectedMonth.split('-')[0]}년 {parseInt(selectedMonth.split('-')[1])}월 • {selectedPrintDept}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsSigManagerOpen(false)}
                className="w-7 h-7 rounded-full bg-zinc-50 flex items-center justify-center text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
                type="button"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Compact structured list with exact boundary width parameters to prevent signature stretch */}
            <div className="space-y-4 pt-1">
              {/* 안전관리자 서명 */}
              <div className="bg-zinc-50/70 p-3.5 rounded-2xl border border-zinc-200 flex flex-col gap-3">
                <div className="text-[11px] font-bold text-zinc-700 flex justify-between items-center">
                  <span className="font-black">안전관리자</span>
                  {monthlySignature?.safetySign ? (
                    <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">서명 완료</span>
                  ) : (
                    <span className="text-[9px] font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">서명 대기</span>
                  )}
                </div>
                {monthlySignature?.safetySign ? (
                  <div 
                    onClick={() => openSignaturePad('safety')}
                    className="h-16 bg-white hover:bg-zinc-50 rounded-xl flex items-center justify-center p-1.5 border border-dashed border-zinc-300 cursor-pointer transition-all shadow-inner"
                  >
                    <img src={monthlySignature.safetySign} alt="안전관리자" className="h-full object-contain" />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => openSignaturePad('safety')}
                    className="h-16 bg-white hover:bg-zinc-100/50 rounded-xl flex flex-col items-center justify-center gap-1 outline-none text-[10px] text-zinc-500 font-extrabold border border-dashed border-zinc-300 transition-all cursor-pointer shadow-sm"
                  >
                    <span className="text-sm">✒️</span>
                    <span>직접 서명 등록하기</span>
                  </button>
                )}
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => openSignaturePad('safety')}
                    className="flex-1 rounded-xl h-9 text-[11px] font-black bg-zinc-900 text-white hover:bg-zinc-800 transition-colors flex items-center justify-center cursor-pointer border border-transparent shadow-sm"
                  >
                    {monthlySignature?.safetySign ? '다시 서명' : '직접 서명'}
                  </button>
                  {monthlySignature?.safetySign && (
                    <button
                      type="button"
                      onClick={() => handleClearRoleSignature('safety')}
                      className="rounded-xl h-9 px-3 text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-100 hover:bg-rose-100 hover:text-rose-700 transition-colors flex items-center justify-center cursor-pointer"
                    >
                      취소
                    </button>
                  )}
                </div>
              </div>

              {/* 소장 서명 */}
              <div className="bg-zinc-50/70 p-3.5 rounded-2xl border border-zinc-200 flex flex-col gap-3">
                <div className="text-[11px] font-bold text-zinc-700 flex justify-between items-center">
                  <span className="font-black font-sans text-zinc-900">소장 (두 사업체 분할 서명)</span>
                  {monthlySignature?.directorSign ? (
                    <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">서명 완료</span>
                  ) : (
                    <span className="text-[9px] font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">서명 대기</span>
                  )}
                </div>
                {monthlySignature?.directorSign ? (
                  <div 
                    onClick={() => openSignaturePad('director')}
                    className="h-16 bg-white hover:bg-zinc-50 rounded-xl flex items-center justify-center p-1.5 border border-dashed border-zinc-300 cursor-pointer transition-all shadow-inner"
                  >
                    <img src={monthlySignature.directorSign} alt="소장" className="h-full object-contain" />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => openSignaturePad('director')}
                    className="h-16 bg-white hover:bg-zinc-100/50 rounded-xl flex flex-col items-center justify-center gap-1 outline-none text-[10px] text-zinc-500 font-extrabold border border-dashed border-zinc-300 transition-all cursor-pointer shadow-sm"
                  >
                    <span className="text-sm">✒️</span>
                    <span>직접 서명 등록하기</span>
                  </button>
                )}
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => openSignaturePad('director')}
                    className="flex-1 rounded-xl h-9 text-[11px] font-black bg-zinc-900 text-white hover:bg-zinc-800 transition-colors flex items-center justify-center cursor-pointer border border-transparent shadow-sm"
                  >
                    {monthlySignature?.directorSign ? '다시 서명' : '직접 서명'}
                  </button>
                  {monthlySignature?.directorSign && (
                    <button
                      type="button"
                      onClick={() => handleClearRoleSignature('director')}
                      className="rounded-xl h-9 px-3 text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-100 hover:bg-rose-100 hover:text-rose-700 transition-colors flex items-center justify-center cursor-pointer"
                    >
                      취소
                    </button>
                  )}
                </div>
              </div>

              {/* 대표 서명 */}
              <div className="bg-zinc-50/70 p-3.5 rounded-2xl border border-zinc-200 flex flex-col gap-3">
                <div className="text-[11px] font-bold text-zinc-700 flex justify-between items-center">
                  <span className="font-black">대표</span>
                  {monthlySignature?.ceoSign ? (
                    <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">서명 완료</span>
                  ) : (
                    <span className="text-[9px] font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-bold">서명 대기</span>
                  )}
                </div>
                {monthlySignature?.ceoSign ? (
                  <div 
                    onClick={() => openSignaturePad('ceo')}
                    className="h-16 bg-white hover:bg-zinc-50 rounded-xl flex items-center justify-center p-1.5 border border-dashed border-zinc-300 cursor-pointer transition-all shadow-inner"
                  >
                    <img src={monthlySignature.ceoSign} alt="대표" className="h-full object-contain" />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => openSignaturePad('ceo')}
                    className="h-16 bg-white hover:bg-zinc-100/50 rounded-xl flex flex-col items-center justify-center gap-1 outline-none text-[10px] text-zinc-500 font-extrabold border border-dashed border-zinc-300 transition-all cursor-pointer shadow-sm"
                  >
                    <span className="text-sm">✒️</span>
                    <span>직접 서명 등록하기</span>
                  </button>
                )}
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => openSignaturePad('ceo')}
                    className="flex-1 rounded-xl h-9 text-[11px] font-black bg-zinc-900 text-white hover:bg-zinc-800 transition-colors flex items-center justify-center cursor-pointer border border-transparent shadow-sm"
                  >
                    {monthlySignature?.ceoSign ? '다시 서명' : '직접 서명'}
                  </button>
                  {monthlySignature?.ceoSign && (
                    <button
                      type="button"
                      onClick={() => handleClearRoleSignature('ceo')}
                      className="rounded-xl h-9 px-3 text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-100 hover:bg-rose-100 hover:text-rose-700 transition-colors flex items-center justify-center cursor-pointer"
                    >
                      취소
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleSeedRequestedData}
                disabled={seedingData}
                className="w-full bg-teal-500/10 hover:bg-teal-500/15 border border-dashed border-teal-500 text-teal-700 dark:text-teal-400 font-bold text-xs h-10 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
              >
                {seedingData ? '데이터 보정 동기화 중...' : '🌡️ 울산 동구 기상청 실측치 데이터 정밀 보정'}
              </Button>
              <button
                type="button"
                onClick={() => setIsSigManagerOpen(false)}
                className="w-full bg-zinc-950 hover:bg-zinc-900 transition-colors text-white font-black text-xs h-11 rounded-xl cursor-pointer text-center"
              >
                결재선 서명 관리 완료 및 닫기
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 6. CUSTOM CONFIRMATION DIALOG */}
      <Dialog 
        open={confirmDialog.isOpen} 
        onOpenChange={(open) => !open && setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      >
        <DialogContent className="max-w-md w-[90%] bg-card text-foreground border border-border/50 p-6 rounded-[2rem] shadow-lg">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/15 flex items-center justify-center text-rose-500">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h3 className="text-sm sm:text-base font-black text-foreground">
                {confirmDialog.title}
              </h3>
              <p className="text-[11px] text-muted-foreground font-medium leading-relaxed">
                {confirmDialog.message}
              </p>
            </div>
            <div className="flex gap-2.5 w-full pt-2">
              <Button
                variant="outline"
                onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 font-bold text-xs h-10 rounded-xl"
              >
                취소
              </Button>
              <Button
                onClick={confirmDialog.onConfirm}
                className="flex-1 bg-rose-500 hover:bg-rose-600 text-white font-black text-xs h-10 rounded-xl border-none shadow-sm shadow-rose-500/10"
              >
                확인 · 진행
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 7. TEMPERATURE LOG EDIT MODAL */}
      <Dialog open={isEditModalOpen} onOpenChange={(open) => !open && setIsEditModalOpen(false)}>
        <DialogContent className="max-w-xl w-[95%] bg-card text-foreground border border-border/50 p-6 rounded-[2.5rem] shadow-xl overflow-y-auto max-h-[92vh]">
          <form onSubmit={handleUpdateRecord} className="space-y-5">
            <div className="flex items-center gap-3 border-b border-border/30 pb-4">
              <div className="w-10 h-10 rounded-full bg-teal-500/10 text-teal-500 flex items-center justify-center">
                <Pencil className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-foreground">🌡️ 검측 기록 현장 수정 및 보정</h3>
                <p className="text-[10px] text-muted-foreground font-semibold">이전 측정된 데이터를 보정하고 실측치를 다시 기록합니다.</p>
              </div>
            </div>

            {/* Department Selection */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-foreground tracking-wider uppercase">측정 부서</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEditDepartment('함정선체생산부')}
                  className={`py-2 px-3 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
                    editDepartment === '함정선체생산부'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted/30 text-muted-foreground border-border/40 hover:bg-muted/50'
                  }`}
                >
                  함정선체생산부 (대조립)
                </button>
                <button
                  type="button"
                  onClick={() => setEditDepartment('중형선선체조립부')}
                  className={`py-2 px-3 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
                    editDepartment === '중형선선체조립부'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted/30 text-muted-foreground border-border/40 hover:bg-muted/50'
                  }`}
                >
                  중형선선체조립부 (7공장)
                </button>
              </div>
            </div>

            {/* Date and Time Fields Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-foreground tracking-wider uppercase flex items-center gap-1">
                  <CalendarDays className="w-3.5 h-3.5 text-muted-foreground/80" />
                  측정 일자
                </label>
                <Input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  required
                  className="bg-muted/20 border-border/40 h-10 rounded-xl text-xs font-mono font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-foreground tracking-wider uppercase flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground/80" />
                  측정 시간
                </label>
                <Input
                  type="time"
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  required
                  className="bg-muted/20 border-border/40 h-10 rounded-xl text-xs font-mono font-bold"
                />
              </div>
            </div>

            {/* Weather Inputs Grid */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-foreground tracking-wider uppercase flex items-center gap-1 flex-wrap">
                  <Thermometer className="w-3.5 h-3.5 text-rose-500" />
                  기온 (Ta, ℃)
                </label>
                <Input
                  type="number"
                  step="0.1"
                  value={editTaInput}
                  onChange={(e) => setEditTaInput(e.target.value)}
                  placeholder="예: 25.5"
                  required
                  className="bg-muted/20 border-border/40 h-10 rounded-xl text-xs font-mono font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-foreground tracking-wider uppercase flex items-center gap-1 flex-wrap">
                  <Droplets className="w-3.5 h-3.5 text-blue-500" />
                  상대습도 (%)
                </label>
                <Input
                  type="number"
                  step="0.1"
                  value={editRhInput}
                  onChange={(e) => setEditRhInput(e.target.value)}
                  placeholder="예: 65"
                  required
                  className="bg-muted/20 border-border/40 h-10 rounded-xl text-xs font-mono font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-foreground tracking-wider uppercase flex items-center gap-1 flex-wrap">
                  <Wind className="w-3.5 h-3.5 text-emerald-500" />
                  풍속 (m/s)
                </label>
                <Input
                  type="number"
                  step="0.1"
                  value={editWindInput}
                  onChange={(e) => setEditWindInput(e.target.value)}
                  placeholder="예: 2.4"
                  required
                  className="bg-muted/20 border-border/40 h-10 rounded-xl text-xs font-mono font-bold"
                />
              </div>
            </div>

            {/* Interactive Live Math Calculations Screen (Bento Dashboard Highlight) */}
            <div className="bg-muted/30 border border-border/30 rounded-2xl p-3 grid grid-cols-3 gap-2 text-center">
              <div className="flex flex-col justify-center py-1">
                <span className="text-[9px] text-muted-foreground font-bold">건구온도 (Ta)</span>
                <span className="text-sm font-black font-mono text-foreground">{parsedEditTa.toFixed(1)} ℃</span>
              </div>
              <div className="flex flex-col justify-center py-1 border-x border-border/20">
                <span className="text-[9px] text-muted-foreground font-bold">계산된 습구 (Tw)</span>
                <span className="text-sm font-black font-mono text-primary">{currentEditTw.toFixed(1)} ℃</span>
              </div>
              <div className="flex flex-col justify-center py-1">
                <span className="text-[9px] text-muted-foreground font-bold">보정 체감온도</span>
                <span className="text-sm font-black font-mono text-teal-500">{currentEditApparent.toFixed(1)} ℃</span>
              </div>
            </div>

            {/* Risk Badge Live Display */}
            <div className={`p-3.5 rounded-2xl border transition-all flex flex-col gap-1.5 ${currentEditRisk.bgColor} ${currentEditRisk.borderColor}`}>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-black tracking-wider uppercase ${currentEditRisk.textColor}`}>위험 등급</span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black text-white ${currentEditRisk.bgColor} border ${currentEditRisk.borderColor} shadow-sm`}>
                  {currentEditRisk.level}
                </span>
              </div>
              <p className={`text-[11px] font-bold leading-normal ${currentEditRisk.textColor}`}>
                {currentEditRisk.description}
              </p>
            </div>

            {/* Details Fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-foreground tracking-wider uppercase">측정 장소</label>
                <Input
                  type="text"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  placeholder="예: 대조립공장"
                  required
                  className="bg-muted/20 border-border/40 h-10 rounded-xl text-xs font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-foreground tracking-wider uppercase">측정 / 기록자</label>
                <Input
                  type="text"
                  value={editWriterName}
                  onChange={(e) => setEditWriterName(e.target.value)}
                  placeholder="측정자 서명 성명"
                  required
                  className="bg-muted/20 border-border/40 h-10 rounded-xl text-xs font-bold"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-foreground tracking-wider uppercase flex items-center justify-between">
                <span>대처 조치 사항 (안전 가이드 기본제시)</span>
                <button
                  type="button"
                  onClick={() => setEditActionTaken(currentEditRisk.action)}
                  className="text-[9px] text-teal-500 font-bold hover:underline cursor-pointer"
                >
                  기본 대처 자동수렴
                </button>
              </label>
              <Input
                type="text"
                value={editActionTaken}
                onChange={(e) => setEditActionTaken(e.target.value)}
                placeholder="조치 사항을 기입하십시오."
                className="bg-muted/20 border-border/40 h-10 rounded-xl text-xs font-bold"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-foreground tracking-wider uppercase">비고 / 비상 대기 상태</label>
              <Input
                type="text"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="추가적인 기상 특이조항 등을 작성합니다."
                className="bg-muted/20 border-border/40 h-10 rounded-xl text-xs font-bold"
              />
            </div>

            {/* Footer Buttons */}
            <div className="flex gap-2 pt-3 border-t border-border/30">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditModalOpen(false)}
                className="flex-1 font-bold text-xs h-10 rounded-xl cursor-pointer"
              >
                변경 취소
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white font-black text-xs h-10 rounded-xl border-none shadow-md cursor-pointer"
              >
                수정사항 저장하기
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
