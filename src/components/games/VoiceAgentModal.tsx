import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, X, Loader2, Volume2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface VoiceAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const BASE_WS = `${import.meta.env.VITE_SUPABASE_URL.replace(/^http/, 'ws')}/functions/v1/inworld-realtime`;

type Status = 'idle' | 'connecting' | 'listening' | 'speaking' | 'error';

const VOICES = [
  { id: 'Hana', label: 'Hana (žena)' },
  { id: 'Adam', label: 'Adam (muž)' },
];

export function VoiceAgentModal({ isOpen, onClose }: VoiceAgentModalProps) {
  const { t } = useTranslation();
  const [voice, setVoice] = useState<string>('Hana');
  const [status, setStatus] = useState<Status>('idle');
  const [transcript, setTranscript] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const wsRef = useRef<WebSocket | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const procRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const queueRef = useRef<ArrayBuffer[]>([]);
  const playingRef = useRef(false);
  const nextPlayTimeRef = useRef(0);
  const currentSrcRef = useRef<AudioBufferSourceNode | null>(null);

  const cleanup = () => {
    try { wsRef.current?.close(); } catch {}
    try { procRef.current?.disconnect(); } catch {}
    try { sourceRef.current?.disconnect(); } catch {}
    streamRef.current?.getTracks().forEach((t) => t.stop());
    try { currentSrcRef.current?.stop(); } catch {}
    try { ctxRef.current?.close(); } catch {}
    wsRef.current = null;
    procRef.current = null;
    sourceRef.current = null;
    streamRef.current = null;
    ctxRef.current = null;
    currentSrcRef.current = null;
    queueRef.current = [];
    playingRef.current = false;
    nextPlayTimeRef.current = 0;
  };

  useEffect(() => {
    if (!isOpen) {
      cleanup();
      setStatus('idle');
      setTranscript('');
      setErrorMsg('');
    }
    return () => cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const playNext = () => {
    const ctx = ctxRef.current;
    if (!ctx || !queueRef.current.length) {
      playingRef.current = false;
      if (status === 'speaking') setStatus('listening');
      return;
    }
    playingRef.current = true;
    const buf = queueRef.current.shift()!;
    const pcm16 = new Int16Array(buf);
    const len = pcm16.length;
    const fade = 48;
    const f32 = new Float32Array(len);
    for (let i = 0; i < len; i++) f32[i] = pcm16[i] / 32768;
    for (let i = 0; i < fade && i < len; i++) {
      f32[i] *= i / fade;
      f32[len - 1 - i] *= i / fade;
    }
    const audioBuf = ctx.createBuffer(1, len, 24000);
    audioBuf.getChannelData(0).set(f32);
    const src = ctx.createBufferSource();
    src.buffer = audioBuf;
    src.connect(ctx.destination);
    const tStart = Math.max(ctx.currentTime, nextPlayTimeRef.current);
    nextPlayTimeRef.current = tStart + audioBuf.duration;
    src.onended = playNext;
    src.start(tStart);
    currentSrcRef.current = src;
  };

  const stopAudio = () => {
    queueRef.current = [];
    playingRef.current = false;
    nextPlayTimeRef.current = 0;
    try { currentSrcRef.current?.stop(); } catch {}
    currentSrcRef.current = null;
  };

  const start = async () => {
    setErrorMsg('');
    setStatus('connecting');
    try {
      const ctx = new AudioContext({ sampleRate: 24000 });
      ctxRef.current = ctx;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 24000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      const wsUrl = `${BASE_WS}?lang=cs&voice=${encodeURIComponent(voice)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('listening');
        const source = ctx.createMediaStreamSource(stream);
        sourceRef.current = source;
        const proc = ctx.createScriptProcessor(2048, 1, 1);
        procRef.current = proc;
        proc.onaudioprocess = ({ inputBuffer }) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const f = inputBuffer.getChannelData(0);
          const pcm = new Int16Array(f.length);
          for (let i = 0; i < f.length; i++) {
            pcm[i] = Math.max(-32768, Math.min(32767, f[i] * 32768));
          }
          let s = '';
          const b = new Uint8Array(pcm.buffer);
          for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
          ws.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: btoa(s) }));
        };
        source.connect(proc);
        proc.connect(ctx.destination);
      };

      ws.onmessage = ({ data }) => {
        try {
          const e = JSON.parse(data);
          if (e.type === 'response.output_audio.delta' || e.type === 'response.audio.delta') {
            setStatus('speaking');
            const buf = Uint8Array.from(atob(e.delta), (c) => c.charCodeAt(0)).buffer;
            queueRef.current.push(buf);
            if (!playingRef.current) playNext();
          } else if (e.type === 'input_audio_buffer.speech_started') {
            stopAudio();
            setStatus('listening');
          } else if (
            e.type === 'response.output_audio_transcript.delta' ||
            e.type === 'response.audio_transcript.delta'
          ) {
            setTranscript((prev) => prev + (e.delta || ''));
          } else if (
            e.type === 'response.output_audio_transcript.done' ||
            e.type === 'response.audio_transcript.done'
          ) {
            setTranscript((prev) => prev + '\n');
          } else if (e.type === 'error') {
            setErrorMsg(e.error?.message || 'Chyba');
            setStatus('error');
          }
        } catch {}
      };

      ws.onerror = () => {
        setErrorMsg(t('voice.error'));
        setStatus('error');
      };
      ws.onclose = () => {
        setStatus('idle');
      };
    } catch (err) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : t('voice.error'));
      setStatus('error');
      cleanup();
    }
  };

  const stop = () => {
    cleanup();
    setStatus('idle');
  };

  if (!isOpen) return null;

  const isActive = status === 'listening' || status === 'speaking';
  const settingsDisabled = status !== 'idle' && status !== 'error';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-pink-500/10 to-rose-500/10">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center">
              <Volume2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h3 className="font-semibold">{t('voice.title')}</h3>
              <p className="text-xs text-muted-foreground">🇨🇿 Čeština</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{t('voice.voiceLabel')}</label>
            <Select value={voice} onValueChange={setVoice} disabled={settingsDisabled}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {VOICES.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col items-center gap-4 pt-2">
            <div
              className={cn(
                'relative w-28 h-28 rounded-full flex items-center justify-center transition-all',
                status === 'listening' && 'bg-pink-500/20 animate-pulse',
                status === 'speaking' && 'bg-rose-500/30 scale-110',
                (status === 'idle' || status === 'error' || status === 'connecting') && 'bg-muted'
              )}
            >
              {status === 'connecting' ? (
                <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
              ) : isActive ? (
                <Mic className="h-10 w-10 text-pink-500" />
              ) : (
                <MicOff className="h-10 w-10 text-muted-foreground" />
              )}
            </div>

            <p className="text-sm text-muted-foreground text-center min-h-[20px]">
              {status === 'idle' && t('voice.idle')}
              {status === 'connecting' && t('voice.connecting')}
              {status === 'listening' && t('voice.listening')}
              {status === 'speaking' && t('voice.speaking')}
              {status === 'error' && `${t('voice.error')}: ${errorMsg}`}
            </p>

            {transcript && (
              <div className="w-full max-h-32 overflow-y-auto p-3 rounded-lg bg-muted/50 text-sm whitespace-pre-wrap">
                {transcript}
              </div>
            )}

            {!isActive && status !== 'connecting' ? (
              <Button onClick={start} size="lg" className="rounded-full px-8">
                <Mic className="mr-2 h-5 w-5" /> {t('voice.start')}
              </Button>
            ) : (
              <Button onClick={stop} size="lg" variant="destructive" className="rounded-full px-8">
                <MicOff className="mr-2 h-5 w-5" /> {t('voice.stop')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
