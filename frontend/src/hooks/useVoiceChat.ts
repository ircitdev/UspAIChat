import { useState, useRef, useCallback, useEffect } from 'react';

interface UseVoiceChatOptions {
  lang?: string;
  autoSpeak?: boolean;
  onTranscript?: (text: string) => void;
}

interface VoiceChatState {
  isListening: boolean;
  isSpeaking: boolean;
  transcript: string;
  supported: boolean;
  autoSpeak: boolean;
}

const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export function useVoiceChat(options: UseVoiceChatOptions = {}) {
  const { lang = 'ru-RU', onTranscript } = options;
  const [state, setState] = useState<VoiceChatState>({
    isListening: false,
    isSpeaking: false,
    transcript: '',
    supported: !!SpeechRecognition,
    autoSpeak: false,
  });

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef(window.speechSynthesis);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

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
    // Cancel current speech
    synthRef.current.cancel();

    // Clean markdown for speech
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
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // Try to find a good Russian voice
    const voices = synthRef.current.getVoices();
    const langPrefix = lang.split('-')[0];
    const preferredVoice = voices.find(v => v.lang.startsWith(langPrefix) && v.name.includes('Google'))
      || voices.find(v => v.lang.startsWith(langPrefix));
    if (preferredVoice) utterance.voice = preferredVoice;

    utterance.onstart = () => setState(s => ({ ...s, isSpeaking: true }));
    utterance.onend = () => setState(s => ({ ...s, isSpeaking: false }));
    utterance.onerror = () => setState(s => ({ ...s, isSpeaking: false }));

    utteranceRef.current = utterance;
    synthRef.current.speak(utterance);
  }, [lang]);

  const stopSpeaking = useCallback(() => {
    synthRef.current?.cancel();
    setState(s => ({ ...s, isSpeaking: false }));
  }, []);

  const toggleAutoSpeak = useCallback(() => {
    setState(s => ({ ...s, autoSpeak: !s.autoSpeak }));
  }, []);

  return {
    ...state,
    startListening,
    stopListening,
    toggleListening,
    speak,
    stopSpeaking,
    toggleAutoSpeak,
  };
}
