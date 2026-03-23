import { useState, useRef, useCallback, useEffect } from 'react';

interface UseVoiceChatOptions {
  lang?: string;
  autoSpeak?: boolean;
  onTranscript?: (text: string) => void;
}

interface VoiceOption {
  name: string;
  lang: string;
  voiceURI: string;
  isGoogle: boolean;
}

interface VoiceChatState {
  isListening: boolean;
  isSpeaking: boolean;
  transcript: string;
  supported: boolean;
  autoSpeak: boolean;
  voices: VoiceOption[];
  selectedVoice: string | null; // voiceURI
}

const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

const VOICE_STORAGE_KEY = 'uspaichat_tts_voice';

export function useVoiceChat(options: UseVoiceChatOptions = {}) {
  const { lang = 'ru-RU', onTranscript } = options;
  const [state, setState] = useState<VoiceChatState>({
    isListening: false,
    isSpeaking: false,
    transcript: '',
    supported: !!SpeechRecognition,
    autoSpeak: false,
    voices: [],
    selectedVoice: localStorage.getItem(VOICE_STORAGE_KEY),
  });

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef(window.speechSynthesis);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Load available voices
  const loadVoices = useCallback(() => {
    const allVoices = synthRef.current?.getVoices() || [];
    const mapped: VoiceOption[] = allVoices
      .filter(v => v.lang.startsWith(lang.split('-')[0]))
      .map(v => ({
        name: v.name,
        lang: v.lang,
        voiceURI: v.voiceURI,
        isGoogle: v.name.includes('Google'),
      }));

    // Also include English voices for variety
    const enVoices: VoiceOption[] = allVoices
      .filter(v => v.lang.startsWith('en') && !mapped.some(m => m.voiceURI === v.voiceURI))
      .slice(0, 5)
      .map(v => ({
        name: v.name,
        lang: v.lang,
        voiceURI: v.voiceURI,
        isGoogle: v.name.includes('Google'),
      }));

    const voices = [...mapped, ...enVoices];
    setState(s => ({ ...s, voices }));
  }, [lang]);

  useEffect(() => {
    loadVoices();
    // Voices may load async
    speechSynthesis.onvoiceschanged = loadVoices;
    return () => { speechSynthesis.onvoiceschanged = null; };
  }, [loadVoices]);

  // Initialize recognition
  useEffect(() => {
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += t;
        } else {
          interimTranscript += t;
        }
      }
      const transcript = finalTranscript || interimTranscript;
      setState(s => ({ ...s, transcript }));
      if (finalTranscript && onTranscript) {
        onTranscript(finalTranscript);
      }
    };

    recognition.onend = () => {
      setState(s => ({ ...s, isListening: false }));
    };

    recognition.onerror = () => {
      setState(s => ({ ...s, isListening: false }));
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
  }, [lang, onTranscript]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.lang = lang;
      recognitionRef.current.start();
      setState(s => ({ ...s, isListening: true, transcript: '' }));
    } catch {}
  }, [lang]);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    recognitionRef.current.stop();
    setState(s => ({ ...s, isListening: false }));
  }, []);

  const toggleListening = useCallback(() => {
    if (state.isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [state.isListening, startListening, stopListening]);

  const speak = useCallback((text: string) => {
    if (!synthRef.current) return;
    synthRef.current.cancel();

    const cleanText = text
      .replace(/```[\s\S]*?```/g, ' (блок кода) ')
      .replace(/`[^`]+`/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[#*_~>|]/g, '')
      .replace(/\n+/g, '. ')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = lang;
    utterance.rate = 1.7;
    utterance.pitch = 1.0;

    // Use selected voice or find best default
    const voices = synthRef.current.getVoices();
    const langPrefix = lang.split('-')[0];

    if (state.selectedVoice) {
      const selected = voices.find(v => v.voiceURI === state.selectedVoice);
      if (selected) {
        utterance.voice = selected;
        utterance.lang = selected.lang;
      }
    } else {
      const preferredVoice = voices.find(v => v.lang.startsWith(langPrefix) && v.name.includes('Google'))
        || voices.find(v => v.lang.startsWith(langPrefix));
      if (preferredVoice) utterance.voice = preferredVoice;
    }

    utterance.onstart = () => setState(s => ({ ...s, isSpeaking: true }));
    utterance.onend = () => setState(s => ({ ...s, isSpeaking: false }));
    utterance.onerror = () => setState(s => ({ ...s, isSpeaking: false }));

    utteranceRef.current = utterance;
    synthRef.current.speak(utterance);
  }, [lang, state.selectedVoice]);

  const stopSpeaking = useCallback(() => {
    synthRef.current?.cancel();
    setState(s => ({ ...s, isSpeaking: false }));
  }, []);

  const toggleAutoSpeak = useCallback(() => {
    setState(s => ({ ...s, autoSpeak: !s.autoSpeak }));
  }, []);

  const setVoice = useCallback((voiceURI: string | null) => {
    setState(s => ({ ...s, selectedVoice: voiceURI }));
    if (voiceURI) {
      localStorage.setItem(VOICE_STORAGE_KEY, voiceURI);
    } else {
      localStorage.removeItem(VOICE_STORAGE_KEY);
    }
  }, []);

  return {
    isListening: state.isListening,
    isSpeaking: state.isSpeaking,
    transcript: state.transcript,
    supported: state.supported,
    autoSpeak: state.autoSpeak,
    voices: state.voices,
    selectedVoice: state.selectedVoice,
    startListening,
    stopListening,
    toggleListening,
    speak,
    stopSpeaking,
    toggleAutoSpeak,
    setVoice,
  };
}
