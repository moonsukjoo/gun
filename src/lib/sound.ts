import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { Capacitor } from '@capacitor/core';

/**
 * Sound manager for playing high-tech notification chimes
 * and speaking notifications with Text-To-Speech (TTS).
 */
export class AlertSoundPlayer {
  private static audioCtx: AudioContext | null = null;

  private static initAudio() {
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
    } catch (e) {
      console.warn("AudioContext initialization failed:", e);
    }
  }

  /**
   * Play a cute, high-tech notification chime
   */
  public static playChime() {
    try {
      this.initAudio();
      const ctx = this.audioCtx;
      if (!ctx) return;

      const now = ctx.currentTime;

      // Primary crisp frequency (A5 -> E6 chime)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(880, now);
      osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.12);
      
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.15, now + 0.04);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Secondary delay chime (C6 -> G6 sparkle chime)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1046.5, now + 0.06);
      osc2.frequency.exponentialRampToValueAtTime(1568, now + 0.18);

      gain2.gain.setValueAtTime(0, now + 0.06);
      gain2.gain.linearRampToValueAtTime(0.12, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.06);
      osc2.stop(now + 0.45);
    } catch (e) {
      console.warn("Chime playback failed:", e);
    }
  }

  // Keep references to active utterances to prevent Garbage Collection in Android WebView/Chrome
  private static activeUtterances: SpeechSynthesisUtterance[] = [];
  private static activeAudio: HTMLAudioElement | null = null;
  private static audioQueue: string[] = [];
  private static isPlayingQueue = false;

  public static getNarrator(): 'standard-female' | 'deep-male' | 'cheerful-female' {
    return (localStorage.getItem('preferred_narrator') as any) || 'standard-female';
  }

  public static setNarrator(val: 'standard-female' | 'deep-male' | 'cheerful-female') {
    localStorage.setItem('preferred_narrator', val);
  }

  private static getNarratorSettings() {
    const narrator = this.getNarrator();
    let rate = 1.0;
    let pitch = 1.0;
    let nameSearch: string[] = [];

    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (narrator === 'deep-male') {
      rate = isMobile ? 0.90 : 0.95;
      pitch = isMobile ? 0.80 : 0.85;
      nameSearch = ['male', '남성', 'daehyun', 'minsu', 'korean male'];
    } else if (narrator === 'cheerful-female') {
      rate = isMobile ? 1.02 : 1.05;
      pitch = isMobile ? 1.10 : 1.15;
      nameSearch = ['female', '여성', 'yuna', 'sora', 'cheerful'];
    } else { // standard-female
      rate = isMobile ? 0.98 : 1.0;
      pitch = isMobile ? 1.0 : 1.02;
      nameSearch = ['female', '여성', 'yuna', 'sora', 'google'];
    }

    return { rate, pitch, nameSearch };
  }

  /**
   * Speak a text message using robust HTML5 Audio + Google Translate TTS stream,
   * falling back to native browser SpeechSynthesis if offline/failed.
   */
  public static speak(text: string) {
    try {
      // 1. Stop all current playback and speech
      this.stop();

      const cleanText = text.trim();
      if (!cleanText) return;

      // 2. Play using Capacitor Native TTS on Android/iOS devices (100% reliable)
      if (Capacitor.isNativePlatform()) {
        this.speakNativeDevice(cleanText);
        return;
      }

      // 3. On web, if a custom narrator is chosen (deep-male / cheerful-female),
      // we must use Web SpeechSynthesis so we can apply pitch/rate shifts perfectly!
      const narrator = this.getNarrator();
      if (narrator !== 'standard-female') {
        this.speakNative(cleanText);
        return;
      }

      // 4. Fallback: play using Google Translate TTS Audio (stable for default female on web)
      this.audioQueue = this.splitTextForTts(cleanText);
      this.isPlayingQueue = true;
      this.playNextInQueue();

    } catch (e) {
      console.warn("SpeechSynthesis failed, trying fallback:", e);
      this.speakNative(text);
    }
  }

  private static async speakNativeDevice(text: string) {
    try {
      const settings = this.getNarratorSettings();
      await TextToSpeech.speak({
        text: text,
        lang: 'ko-KR',
        rate: settings.rate,
        pitch: settings.pitch,
        volume: 1.0,
        category: 'ambient',
      });
    } catch (e) {
      console.warn("Capacitor native TTS failed, falling back to browser speak:", e);
      this.speakNative(text);
    }
  }

  /**
   * Stops any currently active speech synthesis or audio playback
   */
  public static stop() {
    this.isPlayingQueue = false;
    this.audioQueue = [];
    
    if (Capacitor.isNativePlatform()) {
      try {
        TextToSpeech.stop();
      } catch (err) {
        console.warn("Failed to stop native TTS:", err);
      }
    }

    if (this.activeAudio) {
      try {
        this.activeAudio.pause();
        this.activeAudio = null;
      } catch (err) {
        console.warn("Failed to stop active audio:", err);
      }
    }

    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (err) {
        console.warn("Failed to cancel native speech synthesis:", err);
      }
    }
    this.activeUtterances = [];
  }

  /**
   * Split text into chunks of maximum 150 characters for Google Translate TTS limits.
   * Splits at punctuation/spaces to keep natural sounding pauses.
   */
  private static splitTextForTts(text: string): string[] {
    const sentences = text.split(/([.!?,\n]+)/);
    const chunks: string[] = [];
    let currentChunk = "";

    for (let i = 0; i < sentences.length; i++) {
      const part = sentences[i];
      if (!part) continue;

      if ((currentChunk + part).length > 150) {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = part;
      } else {
        currentChunk += part;
      }
    }
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    // Secondary split if any single chunk exceeds 150 chars (safety fallback)
    const finalChunks: string[] = [];
    for (const chunk of chunks) {
      if (chunk.length <= 150) {
        finalChunks.push(chunk);
      } else {
        const words = chunk.split(' ');
        let subChunk = "";
        for (const word of words) {
          if ((subChunk + " " + word).length > 150) {
            if (subChunk.trim()) finalChunks.push(subChunk.trim());
            subChunk = word;
          } else {
            subChunk += (subChunk ? " " : "") + word;
          }
        }
        if (subChunk.trim()) {
          finalChunks.push(subChunk.trim());
        }
      }
    }

    return finalChunks;
  }

  /**
   * Plays the next chunk in the TTS audio queue sequentially
   */
  private static playNextInQueue() {
    if (!this.isPlayingQueue || this.audioQueue.length === 0) {
      this.isPlayingQueue = false;
      return;
    }

    const nextText = this.audioQueue.shift();
    if (!nextText) {
      this.isPlayingQueue = false;
      return;
    }

    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=ko&client=tw-ob&q=${encodeURIComponent(nextText)}`;
    const audio = new Audio(ttsUrl);
    this.activeAudio = audio;

    let nextCalled = false;
    const triggerNext = () => {
      if (nextCalled) return;
      nextCalled = true;

      audio.onended = null;
      audio.onerror = null;

      setTimeout(() => {
        this.playNextInQueue();
      }, 300);
    };

    audio.onended = () => {
      triggerNext();
    };

    audio.onerror = (e) => {
      console.warn("Google TTS chunk playback failed, falling back to native SpeechSynthesis:", e);
      this.speakNative(nextText);
      const estimatedDuration = Math.max(2000, nextText.length * 120);
      setTimeout(() => {
        triggerNext();
      }, estimatedDuration);
    };

    audio.play().catch(err => {
      console.warn("Google TTS audio blocked or failed. Playing native fallback:", err);
      this.speakNative(nextText);
      const estimatedDuration = Math.max(2000, nextText.length * 120);
      setTimeout(() => {
        triggerNext();
      }, estimatedDuration);
    });
  }

  /**
   * Fallback native SpeechSynthesis
   */
  private static speakNative(text: string) {
    try {
      if (!('speechSynthesis' in window)) return;
      
      const synth = window.speechSynthesis;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ko-KR';
      
      const settings = this.getNarratorSettings();
      utterance.rate = settings.rate;
      utterance.pitch = settings.pitch;
      
      this.activeUtterances.push(utterance);
      
      utterance.onend = () => {
        this.activeUtterances = this.activeUtterances.filter(u => u !== utterance);
      };
      utterance.onerror = () => {
        this.activeUtterances = this.activeUtterances.filter(u => u !== utterance);
      };
      
      const voices = synth.getVoices();
      const koVoices = voices.filter(v => v.lang.includes('ko') || v.lang.includes('KO'));
      
      let voiceToUse: SpeechSynthesisVoice | null = null;
      if (koVoices.length > 0) {
        for (const searchName of settings.nameSearch) {
          const match = koVoices.find(v => v.name.toLowerCase().includes(searchName));
          if (match) {
            voiceToUse = match;
            break;
          }
        }
        if (!voiceToUse) {
          voiceToUse = koVoices[0];
        }
      }
      
      if (voiceToUse) {
        utterance.voice = voiceToUse;
      }
      
      synth.speak(utterance);
      if (synth.paused) {
        synth.resume();
      }
    } catch (e) {
      console.warn("Native SpeechSynthesis failed:", e);
    }
  }

  /**
   * Combined chime and speaking alert
   */
  public static trigger(type: 'notice' | 'accident' | 'general', detail?: string) {
    this.playChime();
    
    // Play speech shortly after the chime is heard
    setTimeout(() => {
      let ttsText = "건명 안전!";
      if (type === 'notice') {
        ttsText = detail ? `건명! 공지사항, ${detail}` : "건명! 새로운 공지사항이 등록되었습니다.";
      } else if (type === 'accident') {
        ttsText = detail ? `건명! 사고 속보, ${detail}` : "건명! 새로운 사고 속보가 등록되었습니다. 주의하여 주십시오.";
      } else if (detail) {
        ttsText = `건명! ${detail}`;
      }
      this.speak(ttsText);
    }, 400);
  }
}
