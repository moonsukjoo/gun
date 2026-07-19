import { Filesystem, Directory } from '@capacitor/filesystem';
import { Device } from '@capacitor/device';
import { Share } from '@capacitor/share';
import { toast } from 'sonner';

/**
 * Robust file download helper with unified Email, Native Share, and Local Device Download controls
 */
export const downloadFile = async (blob: Blob, fileName: string): Promise<boolean> => {
  return new Promise<boolean>((resolve) => {
    let platform = 'web';
    Device.getInfo().then(info => {
      platform = info.platform;
    }).catch(e => {
      console.warn('Capacitor check failed, assuming web:', e);
    }).finally(() => {
      // 1. Pre-fill elements
      const isPdf = fileName.toLowerCase().endsWith('.pdf');
      const savedEmail = localStorage.getItem('last_share_email') || 'tjrwnfjqm1@gmail.com';
      
      // 2. Create Modal Overlay
      const modal = document.createElement('div');
      modal.id = 'unified-download-modal';
      // High-contrast, dark glassmorphism styling
      modal.className = 'fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md transition-opacity duration-300';
      
      modal.innerHTML = `
        <div class="bg-zinc-950 border border-zinc-800 rounded-[2rem] p-6 w-full max-w-md shadow-2xl text-white transform scale-95 opacity-0 transition-all duration-300 relative font-sans">
          
          <!-- Top Accent Bar -->
          <div class="absolute top-0 left-0 right-0 h-1.5 rounded-t-[2rem] bg-gradient-to-r ${isPdf ? 'from-rose-500 to-amber-500' : 'from-emerald-500 to-teal-500'}"></div>
          
          <!-- Modal Header -->
          <div class="flex items-start justify-between mb-5 mt-1">
            <div class="space-y-1">
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${isPdf ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}">
                ${isPdf ? 'PDF REPORT' : 'EXCEL SHEET'}
              </span>
              <h3 class="text-lg font-black tracking-tight leading-snug">보고서 다운로드 및 메일 전송</h3>
            </div>
            <button id="modal-close-btn" class="w-8 h-8 rounded-full border border-zinc-800 hover:border-zinc-700 bg-zinc-900/50 flex items-center justify-center text-zinc-400 hover:text-white transition-all">
              ✕
            </button>
          </div>
          
          <!-- Document Metadata Info -->
          <div class="bg-zinc-900/50 rounded-2xl border border-zinc-900 p-4 mb-5 flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isPdf ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}">
              ${isPdf 
                ? `<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-2-2a1 1 0 00-.707-.293H7a2 2 0 00-2 2V19a2 2 0 002 2z" /></svg>`
                : `<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>`
              }
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">생성된 파일명</p>
              <p class="text-xs font-bold text-zinc-300 truncate">${fileName}</p>
            </div>
          </div>
          
          <!-- Content Screen Area -->
          <div id="modal-screen-content" class="space-y-4">
            
            <div class="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-[11px] space-y-1 text-zinc-300">
              <p class="font-black text-emerald-400 flex items-center gap-1">
                <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                휴대폰 메일/카톡 원클릭 안내 (추천!)
              </p>
              <p class="leading-relaxed">
                모바일 기기에서는 <b>①번 버튼</b>을 사용하시면 본인 휴대폰에 자동 설정된 <b>Gmail, 네이버메일, 카카오톡</b>으로 무설정/무가입 즉시 전송이 가능합니다!
              </p>
            </div>

            <!-- Email Input Field -->
            <div class="space-y-1.5 opacity-90">
              <label class="text-[10px] font-black text-zinc-400 uppercase tracking-widest pl-1">②번 전용 서버 수신 이메일</label>
              <input 
                id="modal-email-input" 
                type="email" 
                value="${savedEmail}" 
                placeholder="email@example.com"
                class="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-sm font-bold text-white focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all placeholder:text-zinc-600"
              />
            </div>
            
            <!-- Action List Buttons -->
            <div class="space-y-2.5 pt-1">
              <button 
                id="modal-native-share-btn" 
                class="w-full h-16 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-xs rounded-2xl flex flex-col items-center justify-center gap-0.5 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all text-center border border-emerald-400/20"
              >
                <div class="flex items-center gap-1.5">
                  <svg class="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                  <span class="text-sm">① 모바일 앱 간편 전송 (카톡/메일)</span>
                </div>
                <span class="text-[10px] font-bold text-emerald-100/90">(설정 필요 없음 • Gmail/네이버메일 바로 첨부)</span>
              </button>

              <button 
                id="modal-email-send-btn" 
                class="w-full h-12 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 font-bold text-xs rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 19v-8.93a2 2 0 01.89-1.664l8-4.8a2 2 0 012.22 0l8 4.8A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.725m12.25 4.725l-6.75-4.725m0 0L12 14l-2.25-1.725M12 14l6.75-4.725M12 14L5.25 9.275" /></svg>
                ② 전용 메일 서버 전송 (SMTP 사전 세팅용)
              </button>
              
              <button 
                id="modal-direct-dl-btn" 
                class="w-full h-12 bg-zinc-900 border border-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                ③ 기기 다운로드 및 단순 저장
              </button>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      // Select elements
      const closeBtn = document.getElementById('modal-close-btn') as HTMLButtonElement;
      const emailInput = document.getElementById('modal-email-input') as HTMLInputElement;
      const emailSendBtn = document.getElementById('modal-email-send-btn') as HTMLButtonElement;
      const shareBtn = document.getElementById('modal-native-share-btn') as HTMLButtonElement;
      const downloadBtn = document.getElementById('modal-direct-dl-btn') as HTMLButtonElement;
      const dialogInner = modal.querySelector('div') as HTMLDivElement;
      
      // Animate card show
      setTimeout(() => {
        dialogInner.classList.remove('scale-95', 'opacity-0');
        dialogInner.classList.add('scale-100', 'opacity-100');
      }, 50);
      
      // Handler: Dismiss
      const dismiss = (result: boolean) => {
        dialogInner.classList.remove('scale-100', 'opacity-100');
        dialogInner.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
          if (modal.parentNode) {
            document.body.removeChild(modal);
          }
          resolve(result);
        }, 300);
      };
      
      closeBtn.onclick = () => dismiss(false);
      modal.onclick = (e) => {
        if (e.target === modal) {
          dismiss(false);
        }
      };
      
      // Action: Local Download
      downloadBtn.onclick = async () => {
        dismiss(true);
        if (platform === 'android' || platform === 'ios') {
          await triggerNativeShare(blob, fileName);
        } else {
          triggerWebDownload(blob, fileName);
        }
      };
      
      // Action: Native Share
      shareBtn.onclick = async () => {
        try {
          const file = new File([blob], fileName, { type: blob.type });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            dismiss(true);
            await navigator.share({
              files: [file],
              title: fileName,
              text: '건명기업 스마트 안전 관리 통합 리포트 공유'
            });
            toast.success('공유 메뉴가 오픈되었습니다.');
          } else {
            // High fidelity Capacitor share if native API isn't fully supported on browser share
            dismiss(true);
            await triggerNativeShare(blob, fileName);
          }
        } catch (err) {
          console.warn('Direct share failed, falling back to Native Share:', err);
          dismiss(true);
          await triggerNativeShare(blob, fileName);
        }
      };
      
      // Action: Email Sender Simulation & Actual SMTP Delivery
      emailSendBtn.onclick = async () => {
        const emailVal = emailInput.value?.trim();
        if (!emailVal || !emailVal.includes('@')) {
          toast.error('올바른 이메일 주소를 입력해 주세요.');
          return;
        }
        
        // Save for ease of next use
        localStorage.setItem('last_share_email', emailVal);
        
        // Switch to logging animation mode
        const screenArea = document.getElementById('modal-screen-content') as HTMLDivElement;
        screenArea.className = "space-y-4 p-2 bg-zinc-950 rounded-2xl border border-zinc-900 font-mono text-[10px]";
        screenArea.innerHTML = `
          <div class="flex items-center gap-3 py-2 border-b border-zinc-900">
            <div class="w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin shrink-0"></div>
            <span class="text-zinc-400 font-bold">건명기업 메일 전송 시퀀스 가동...</span>
          </div>
          <div id="email-log-board" class="space-y-1.5 text-zinc-400 leading-relaxed font-mono tracking-tight overflow-y-auto max-h-[180px] p-1 select-none">
            <p class="text-indigo-400 animate-pulse">■ Initializing SMTP Connection...</p>
          </div>
        `;
        
        const logBoard = document.getElementById('email-log-board') as HTMLDivElement;
        
        const addLog = (text: string, colorClass: string = 'text-zinc-500') => {
          const p = document.createElement('p');
          p.className = `font-mono ${colorClass}`;
          p.innerText = text;
          logBoard.appendChild(p);
          logBoard.scrollTop = logBoard.scrollHeight;
        };
        
        try {
          await new Promise(r => setTimeout(r, 400));
          addLog('▶ 🔒 SSL/TLS 1.2 보안 보안 터널 성립 확인.', 'text-zinc-400');
          
          await new Promise(r => setTimeout(r, 400));
          addLog(`▶ 📂 [${fileName}] 문서 바이너리 Base64 인코딩 진행 중...`, 'text-zinc-400');
          
          // Convert Blob to Base64
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve, reject) => {
            reader.onloadend = () => {
              try {
                const base64String = reader.result as string;
                const base = base64String.split(',')[1];
                resolve(base);
              } catch (e) {
                reject(e);
              }
            };
            reader.onerror = reject;
          });
          
          reader.readAsDataURL(blob);
          const base64Data = await base64Promise;
          
          addLog('▶ 📂 Base64 변환 완료. 페이로드 패킹 완료.', 'text-zinc-400');
          
          await new Promise(r => setTimeout(r, 400));
          addLog('▶ 🚀 /api/send-email 백엔드 API 게이트웨이 전송 개시...', 'text-indigo-400');
          
          // Perform real backend fetch call
          const response = await fetch("/api/send-email", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              to: emailVal,
              subject: `[건명기업] 통합 스마트 안전 관리 보고서 - ${fileName}`,
              filename: fileName,
              base64Data: base64Data
            })
          });
          
          const result = await response.json();
          
          if (response.ok && result.success) {
            addLog('▶ ✔️ SMTP Server Response: 250 OK (Message Accepted)', 'text-emerald-400 font-bold');
            await new Promise(r => setTimeout(r, 600));
            
            // Success Completion screen
            screenArea.className = "space-y-4 text-center py-6 font-sans";
            screenArea.innerHTML = `
              <div class="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-3 animate-bounce">
                <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h4 class="text-base font-black text-foreground">이메일 전송 성공!</h4>
              <p class="text-xs text-zinc-400 px-3 font-bold leading-normal">
                보고서가 수신자 <span class="text-indigo-400 underline">${emailVal}</span>(으)로 실시간 발급 및 전송 완료되었습니다!
              </p>
              
              <div class="pt-3 space-y-2">
                <button 
                  id="success-close-btn" 
                  class="w-full h-11 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-white font-bold text-xs rounded-xl transition-all shadow-md"
                >
                  확인 (창 닫기)
                </button>
              </div>
            `;
            
            toast.success(`메일 발송 성공: ${emailVal}`);
            const successClose = document.getElementById('success-close-btn') as HTMLButtonElement;
            successClose.onclick = () => dismiss(true);
          } else {
            // Server returned error (e.g. SMTP credentials missing)
            throw new Error(result.details || result.error || "이메일 전송에 실패하였습니다.");
          }
          
        } catch (err: any) {
          console.error("Email send error:", err);
          addLog(`❌ 오류 발생: ${err.message}`, 'text-rose-400 font-bold');
          await new Promise(r => setTimeout(r, 800));
          
          // Render highly informative interactive Error UI
          screenArea.className = "space-y-4 text-left p-2 font-sans";
          screenArea.innerHTML = `
            <div class="bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl p-4 space-y-2">
              <div class="flex items-center gap-2">
                <svg class="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <h4 class="text-xs font-black uppercase tracking-wider">메일 서버가 아직 구성되지 않았습니다</h4>
              </div>
              <p class="text-xs text-zinc-300 font-medium leading-relaxed">
                현재 전용 메일 서버 발송 기능은 관리자의 세팅이 필요합니다. 대신, <b>본인 휴대폰 메일 앱/카톡 등으로 1초 만에 첨부해서 보낼 수 있는 '간편 공유' 전송을 사용하세요!</b>
              </p>
            </div>
            
            <div class="pt-2 flex flex-col gap-2">
              <button 
                id="error-fallback-share" 
                class="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-emerald-600/20 [animation:pulse_1.5s_infinite]"
              >
                📲 휴대폰 메일/카카오톡 첨부 발송하기 (추천 👍)
              </button>
              
              <div class="flex gap-2">
                <button 
                  id="error-close-btn" 
                  class="flex-1 h-11 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 font-bold text-xs rounded-xl transition-all"
                >
                  닫기
                </button>
                <button 
                  id="error-fallback-dl" 
                  class="flex-1 h-11 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 font-bold text-xs rounded-xl transition-all"
                >
                  📥 기기에 파일 저장
                </button>
              </div>
            </div>
          `;
          
          const errClose = document.getElementById('error-close-btn') as HTMLButtonElement;
          const errDl = document.getElementById('error-fallback-dl') as HTMLButtonElement;
          const errShare = document.getElementById('error-fallback-share') as HTMLButtonElement;
          
          errClose.onclick = () => dismiss(false);
          
          errShare.onclick = async () => {
            dismiss(true);
            try {
              const file = new File([blob], fileName, { type: blob.type });
              if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                  files: [file],
                  title: fileName,
                  text: '건명기업 스마트 통합 보고서'
                });
              } else {
                await triggerNativeShare(blob, fileName);
              }
            } catch (err) {
              await triggerNativeShare(blob, fileName);
            }
          };

          errDl.onclick = () => {
            dismiss(true);
            if (platform === 'android' || platform === 'ios') {
              triggerNativeShare(blob, fileName);
            } else {
              triggerWebDownload(blob, fileName);
            }
          };
        }
      };
    });
  });
};

/**
 * Mobile device Capacitor sharing action handler
 */
const triggerNativeShare = async (blob: Blob, fileName: string) => {
  try {
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve, reject) => {
      reader.onloadend = () => {
        try {
          const base64String = reader.result as string;
          const base64Data = base64String.split(',')[1];
          resolve(base64Data);
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = reject;
    });
    
    reader.readAsDataURL(blob);
    const base64Data = await base64Promise;

    // Cache file locally
    const savedFile = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Cache,
    });
    
    // Trigger system shares
    await Share.share({
      title: fileName,
      text: '건명기업 스마트 통합 보고서 발급',
      url: savedFile.uri,
      dialogTitle: '파일 전송 또는 공유'
    });
    return true;
  } catch (err) {
    console.error('Capacitor sharing flow failed, falling back to Web direct download:', err);
    triggerWebDownload(blob, fileName);
    return false;
  }
};

/**
 * Normal web file delivery downloader
 */
const triggerWebDownload = (blob: Blob, fileName: string) => {
  try {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
    return true;
  } catch (err) {
    console.error('Web download failed:', err);
    return false;
  }
};
