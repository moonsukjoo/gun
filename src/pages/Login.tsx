import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '@/src/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { HardHat, Lock, User, Chrome, ArrowLeft, RefreshCw, Smartphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { PinKeypad } from '@/src/components/PinKeypad';
import { cn } from '@/lib/utils';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  
  // Remembered User States
  const [rememberedId, setRememberedId] = useState<string | null>(null);
  const [rememberedName, setRememberedName] = useState<string | null>(null);
  const [isRememberedMode, setIsRememberedMode] = useState(false);

  useEffect(() => {
    const savedId = localStorage.getItem('remembered_employeeId');
    const savedName = localStorage.getItem('remembered_displayName');
    if (savedId) {
      setRememberedId(savedId);
      setRememberedName(savedName || savedId);
      setEmployeeId(savedId);
      setIsRememberedMode(true);
    }
  }, []);

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success('구글 로그인 성공');
      navigate('/');
    } catch (error: any) {
      console.error("Google login failed:", error);
      toast.error('구글 로그인에 실패했습니다.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    const idValue = (isRememberedMode ? (rememberedId || '') : employeeId).trim();
    const passValue = password;
    
    if (!idValue || !passValue) {
      toast.error('정보를 모두 입력해주세요.');
      return;
    }

    setIsLoading(true);
    try {
      // Use employeeId as part of email for Firebase Auth
      const email = `${idValue.toLowerCase()}@shipyard.com`;
      
      try {
        await signInWithEmailAndPassword(auth, email, passValue);
      } catch (signInError: any) {
        // If user doesn't exist or credentials invalid, try auto-reg for default password
        if (
          signInError.code === 'auth/user-not-found' || 
          signInError.code === 'auth/invalid-credential' ||
          signInError.code === 'auth/invalid-email'
        ) {
          // If in remembered mode, invalid credential just means wrong PIN
          if (isRememberedMode) throw signInError;

          try {
            // Only auto-reg if password matches ID (original logic)
            if (passValue === idValue) {
              await createUserWithEmailAndPassword(auth, email, passValue);
            } else {
              throw signInError;
            }
          } catch (createError: any) {
            if (createError.code === 'auth/email-already-in-use') {
              throw signInError;
            }
            throw createError;
          }
        } else {
          throw signInError;
        }
      }
      
      // Save ID for next time if login is successful
      localStorage.setItem('remembered_employeeId', idValue);
      
      toast.success('로그인 성공');
      navigate('/');
    } catch (error: any) {
      console.error("Login Error:", error);
      let message = '로그인 실패: 정보를 확인하세요.';
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
        message = isRememberedMode 
          ? '비밀번호(PIN)가 올바르지 않습니다. 다시 확인해주세요.' 
          : '사번 또는 비밀번호가 올바르지 않습니다. 처음이시라면 사번을 비밀번호에 입력해보세요.';
      } else if (error.code === 'auth/too-many-requests') {
        message = '너무 많은 로그인 시도가 있었습니다. 잠시 후 다시 시도해주세요.';
      }
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinInput = (digit: string) => {
    if (password.length >= 6) return;
    const newPass = password + digit;
    setPassword(newPass);
    // Auto login if 6 digits (or whatever PIN length is)
    // But let's check profile first? No, we don't know the PIN length here.
    // Usually PINs are 4-6. Let's wait for user to click login or just auto-trigger if length hits 6.
  };

  const handlePinDelete = () => {
    setPassword(prev => prev.slice(0, -1));
  };

  const handlePinClear = () => {
    setPassword('');
  };

  useEffect(() => {
    // If it's 6 digits and in remembered mode, we could auto-login
    if (isRememberedMode && password.length === 6) {
      handleLogin(new Event('submit') as any);
    }
  }, [password, isRememberedMode]);

  const clearRememberedUser = () => {
    setIsRememberedMode(false);
    setEmployeeId('');
    setPassword('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white sm:bg-slate-50 relative overflow-hidden">
      {isRememberedMode ? (
        <div className="w-full max-w-md h-screen sm:h-auto sm:min-h-[700px] flex flex-col bg-white overflow-hidden sm:rounded-[2.5rem] sm:shadow-2xl">
          {/* Top Section */}
          <div className="flex-1 flex flex-col items-center justify-center px-8 pt-12 pb-8 gap-8">
            <div className="flex items-center gap-2">
              <HardHat className="w-8 h-8 text-[#0066CC]" />
              <h3 className="text-2xl font-black tracking-tighter text-[#0066CC]">건명 인사기술</h3>
            </div>

            <div className="text-center space-y-2">
              <h4 className="text-2xl font-black text-slate-900 tracking-tight">비밀번호를 입력해주세요</h4>
              <p className="text-sm font-bold text-slate-400">{rememberedName}님, 다시 만나서 반가워요!</p>
            </div>

            {/* PIN Dots */}
            <div className="flex gap-4">
              {[...Array(6)].map((_, i) => (
                <div 
                  key={i} 
                  className={cn(
                    "w-4 h-4 rounded-full transition-all duration-200 border-2",
                    password.length > i 
                      ? "bg-[#0066CC] border-[#0066CC] scale-110" 
                      : "bg-slate-100 border-slate-200"
                  )} 
                />
              ))}
            </div>

            {isLoading && (
              <div className="flex items-center gap-2 text-[#0066CC] font-black text-xs animate-pulse">
                <RefreshCw className="w-3 h-3 animate-spin" />
                보안 서버 연결 중...
              </div>
            )}
          </div>

          <div className="px-8 pb-8 flex flex-col items-center gap-4">
            {password.length >= 4 && (
              <Button 
                onClick={(e) => handleLogin(e as any)}
                disabled={isLoading}
                className="w-full h-14 rounded-2xl font-black text-lg bg-[#0066CC] shadow-lg shadow-[#0066CC]/20 animate-in fade-in zoom-in-95"
              >
                {isLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : '로그인'}
              </Button>
            )}
            
            <button 
              type="button"
              onClick={clearRememberedUser}
              className="text-slate-400 hover:text-primary transition-colors py-2 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest"
            >
              다른 계정으로 로그인 (사번 입력)
            </button>
          </div>

          {/* Keypad Section */}
          <PinKeypad 
            onInput={handlePinInput} 
            onDelete={handlePinDelete} 
            onClear={handlePinClear} 
            className="shrink-0"
          />
        </div>
      ) : (
        <Card className="w-full max-w-md border-none shadow-none sm:shadow-2xl sm:rounded-[2.5rem] overflow-hidden bg-white">
          <CardHeader className="text-center space-y-2 pb-8 pt-12">
            <div className="mx-auto w-20 h-20 rounded-[2rem] bg-[#0066CC]/10 flex items-center justify-center text-[#0066CC] mb-2 shadow-inner">
              <HardHat className="w-10 h-10" />
            </div>
            <CardTitle className="text-4xl font-black tracking-tighter text-slate-900">
              건명 <span className="text-[#0066CC] italic">HRM</span>
            </CardTitle>
            <CardDescription className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px]">
              차세대 통합 인사기록 관리 시스템
            </CardDescription>
          </CardHeader>
          
          <CardContent className="px-8 pb-12">
            <form onSubmit={handleLogin} className="space-y-6 animate-in fade-in duration-500">
              <div className="space-y-2">
                <Label htmlFor="employeeId" className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">사원번호</Label>
                <div className="relative">
                  <User className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <Input
                    id="employeeId"
                    placeholder="사원번호를 입력하세요"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    className="h-16 pl-14 rounded-2xl bg-slate-50 border-transparent focus:border-[#0066CC]/20 focus:ring-0 transition-all font-bold text-lg"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password" className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">비밀번호</Label>
                <div className="relative">
                  <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-16 pl-14 rounded-2xl bg-slate-50 border-transparent focus:border-[#0066CC]/20 focus:ring-0 transition-all font-bold text-lg"
                  />
                </div>
              </div>

              <div className="pt-2">
                <Button 
                  type="submit"
                  disabled={isLoading || isGoogleLoading}
                  className="w-full h-16 rounded-2xl font-black text-xl bg-[#0066CC] hover:bg-[#0052a3] shadow-lg shadow-[#0066CC]/20 active:scale-[0.98] transition-all"
                >
                  {isLoading ? <RefreshCw className="w-6 h-6 animate-spin" /> : '로그인하기'}
                </Button>
              </div>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-100" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase font-black text-slate-300 tracking-[0.3em]">
                  <span className="bg-white px-4">또는</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                disabled={isLoading || isGoogleLoading}
                onClick={handleGoogleLogin}
                className="w-full h-16 rounded-2xl border-2 border-slate-100 hover:bg-slate-50 transition-all flex items-center justify-center gap-3 font-black text-slate-600 active:scale-[0.98]"
              >
                <Chrome className="w-6 h-6 text-[#4285F4]" />
                {isGoogleLoading ? '계정 연결 중...' : 'Google 계정으로 계속'}
              </Button>
            </form>
            
            <div className="mt-16 text-center space-y-4">
              <div className="flex items-center justify-center gap-4 text-slate-300">
                <div className="w-8 h-[1px] bg-slate-100" />
                <Smartphone className="w-4 h-4" />
                <div className="w-8 h-[1px] bg-slate-100" />
              </div>
              <p className="text-[10px] text-slate-300 font-bold tracking-[0.2em] uppercase">
                © 2024 건명 정보기술 협력 업체 시스템
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

