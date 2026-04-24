import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { auth, googleProvider, db } from '@/src/firebase';
import { collection, query, where, getDocs, updateDoc, doc, limit } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Lock, User, Chrome, RefreshCw, KeyRound, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { PinKeypad } from '@/src/components/PinKeypad';
import { cn } from '@/lib/utils';
import { UserProfile } from '../types';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isRememberId, setIsRememberId] = useState(false);
  
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [forgotPasswordStep, setForgotPasswordStep] = useState<1 | 2>(1);
  const [forgotPasswordForm, setForgotPasswordForm] = useState({
    employeeId: '',
    displayName: '',
    phoneNumber: ''
  });
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [resetUserUid, setResetUserUid] = useState<string | null>(null);
  
  const [rememberedId, setRememberedId] = useState<string | null>(null);
  const [rememberedName, setRememberedName] = useState<string | null>(null);
  const [isRememberedMode, setIsRememberedMode] = useState(false);

  useEffect(() => {
    const savedId = localStorage.getItem('remembered_employeeId');
    const savedName = localStorage.getItem('remembered_displayName');
    const isRemembered = localStorage.getItem('save_employee_id') === 'true';
    if (isRemembered && savedId) {
      setIsRememberId(true);
      setEmployeeId(savedId);
      if (savedName) {
        setRememberedId(savedId);
        setRememberedName(savedName);
        setIsRememberedMode(true);
      }
    }
  }, []);

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success('로그인 성공');
      navigate('/');
    } catch (e) { toast.error('로그인 실패'); } finally { setIsGoogleLoading(false); }
  };

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isLoading) return;
    const id = (isRememberedMode ? (rememberedId || '') : employeeId).trim();
    if (!id || !password) { toast.error('정보를 입력하세요'); return; }
    setIsLoading(true);
    try {
      const email = id.includes('@') ? id : `${id.toLowerCase()}@shipyard.com`;
      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (err: any) {
        if (!isRememberedMode && password === id && password.length >= 6) {
          await createUserWithEmailAndPassword(auth, email, password);
        } else throw err;
      }
      if (isRememberId) {
        localStorage.setItem('remembered_employeeId', id);
        localStorage.setItem('save_employee_id', 'true');
      } else {
        localStorage.removeItem('remembered_employeeId');
        localStorage.setItem('save_employee_id', 'false');
      }
      toast.success('로그인 성공');
      navigate('/');
    } catch (e) { toast.error('로그인 실패'); } finally { setIsLoading(false); }
  };

  const handlePinInput = (digit: string) => {
    if (password.length < 6) setPassword(prev => prev + digit);
  };

  const handlePinDelete = () => setPassword(prev => prev.slice(0, -1));
  const handlePinClear = () => setPassword('');

  useEffect(() => {
    if (isRememberedMode && password.length === 6) handleLogin();
  }, [password, isRememberedMode]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {isRememberedMode ? (
        <div className="w-full max-w-sm flex flex-col h-full space-y-12 animate-in fade-in duration-700">
           <div className="flex flex-col items-center gap-6 py-10">
              <div className="w-20 h-20 bg-white rounded-3xl p-3 shadow-2xl flex items-center justify-center">
                 <img src="/company_logo.png" alt="logo" className="w-full h-full object-contain" />
              </div>
              <div className="text-center space-y-2">
                 <h2 className="text-2xl font-black text-white">{rememberedName}님,</h2>
                 <p className="text-muted-foreground font-bold">비밀번호를 입력해 주세요</p>
              </div>
              <div className="flex gap-4 h-4 items-center">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className={cn("w-3 h-3 rounded-full transition-all duration-300", password.length > i ? "bg-primary scale-125 shadow-[0_0_10px_#3182f6]" : "bg-white/10")} />
                ))}
              </div>
           </div>
           <PinKeypad onInput={handlePinInput} onDelete={handlePinDelete} onClear={handlePinClear} />
           <button onClick={() => setIsRememberedMode(false)} className="text-xs font-black text-white/20 uppercase tracking-widest text-center w-full hover:text-white transition-colors pb-10">다른 계정으로 로그인</button>
        </div>
      ) : (
        <div className="w-full max-w-sm space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
           <div className="flex flex-col gap-4 text-center">
              <div className="w-16 h-16 bg-white rounded-2xl mx-auto p-3 shadow-xl flex items-center justify-center border border-white/10">
                 <img src="/company_logo.png" alt="logo" className="w-full h-full object-contain" />
              </div>
              <div className="space-y-1">
                 <h1 className="text-3xl font-black text-white tracking-tighter">건명기업 <span className="text-primary">HRM</span></h1>
              </div>
           </div>

           <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                 <div className="relative">
                    <User className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                    <Input 
                      placeholder="사원번호" 
                      value={employeeId} 
                      onChange={e => setEmployeeId(e.target.value)} 
                      className="h-16 pl-14 bg-card border-none rounded-2xl text-lg font-black text-white placeholder:text-muted-foreground/30 focus:ring-1 focus:ring-primary/50 transition-all"
                    />
                 </div>
                 <div className="relative">
                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                    <Input 
                      type="password" 
                      placeholder="비밀번호" 
                      value={password} 
                      onChange={e => setPassword(e.target.value)} 
                      className="h-16 pl-14 bg-card border-none rounded-2xl text-lg font-black text-white placeholder:text-muted-foreground/30 focus:ring-1 focus:ring-primary/50 transition-all"
                    />
                 </div>
                 <div className="flex items-center justify-between px-1 pt-1">
                    <div className="flex items-center gap-2">
                       <Checkbox id="rem" checked={isRememberId} onCheckedChange={v => setIsRememberId(!!v)} className="bg-card border-white/10" />
                       <label htmlFor="rem" className="text-xs font-black text-muted-foreground">자동 로그인</label>
                    </div>
                    <button type="button" className="text-xs font-black text-primary hover:underline">비밀번호 찾기</button>
                 </div>
              </div>

              <Button type="submit" disabled={isLoading} className="w-full h-16 bg-primary text-white font-black text-lg rounded-2xl shadow-lg shadow-primary/20 active:scale-95 transition-all">
                 {isLoading ? <RefreshCw className="w-6 h-6 animate-spin" /> : '로그인하기'}
              </Button>

              <div className="relative py-4">
                 <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5" /></div>
                 <div className="relative flex justify-center text-[10px] uppercase font-black text-muted-foreground/20"><span className="bg-background px-4">OR</span></div>
              </div>

              <Button variant="outline" type="button" onClick={handleGoogleLogin} className="w-full h-16 bg-white/5 border-none text-white font-black rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all">
                 <Chrome className="w-6 h-6 text-primary" /> 구글 계정으로 계속하기
              </Button>
           </form>

           <div className="pt-10 text-center">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-20">© 2024 건명기업</p>
           </div>
        </div>
      )}
    </div>
  );
};
