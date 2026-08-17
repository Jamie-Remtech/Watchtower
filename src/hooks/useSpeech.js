import { useState, useRef, useCallback, useEffect } from 'react';

// Speech-to-text via the browser's built-in recognition (Chrome/Edge/
// Android natively; iOS Safari 14.5+). No server, no keys. Continuous
// mode with auto-restart, because engines stop on silence.
export const useSpeech = ({ onFinal }) => {
  const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
  const supported = Boolean(SR);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const recRef = useRef(null);
  const wantRef = useRef(false);
  const onFinalRef = useRef(onFinal);
  useEffect(() => { onFinalRef.current = onFinal; }, [onFinal]);

  const start = useCallback(() => {
    if (!supported || wantRef.current) return;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || 'en-US';
    rec.onresult = (e) => {
      let interimText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) onFinalRef.current?.(t.trim());
        else interimText += t;
      }
      setInterim(interimText);
    };
    rec.onend = () => {
      setInterim('');
      // engines stop on silence — restart while the user wants to listen
      if (wantRef.current) { try { rec.start(); } catch { /* already starting */ } }
      else setListening(false);
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        wantRef.current = false;
        setListening(false);
      }
    };
    recRef.current = rec;
    wantRef.current = true;
    try { rec.start(); setListening(true); } catch { /* ignore double-start */ }
  }, [SR, supported]);

  const stop = useCallback(() => {
    wantRef.current = false;
    try { recRef.current?.stop(); } catch { /* not started */ }
    setListening(false);
    setInterim('');
  }, []);

  useEffect(() => () => { wantRef.current = false; try { recRef.current?.stop(); } catch { /* unmount */ } }, []);

  return { supported, listening, interim, start, stop };
};
