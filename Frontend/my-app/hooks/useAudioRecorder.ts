'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import WaveSurfer    from 'wavesurfer.js';
import RecordPlugin  from 'wavesurfer.js/dist/plugins/record.esm.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RecordPluginInstance = any;


export interface UseAudioRecorderReturn {
    /** Whether recording is currently active (not paused). */
    isRecording:    boolean;
    isPaused:       boolean;
    /** Recorded duration in seconds. */
    timer:          number;
    /** Volume level 0-128, updated while recording. */
    volume:         number;
    /** Blob produced after recording stops; null while recording. */
    recordedBlob:   Blob | null;
    /** Available audio input devices, including the virtual system-audio entry. */
    devices:        MediaDeviceInfo[];
    selectedDeviceId: string;
    setSelectedDeviceId: (id: string) => Promise<void>;
    /** DOM ref to mount the WaveSurfer waveform canvas into. */
    waveContainerRef: React.RefObject<HTMLDivElement>;
    startRecording: (withSystemAudio?: boolean) => Promise<void>;
    pauseResume:    () => void;
    stopRecording:  () => void;
    resetRecording: () => void;
    isSystemAudioActive: boolean;
    isMicMuted: boolean;
    toggleMicMute: () => void;
}



// ── Hook ───────────────────────────────────────────────────────────────────────

/**
 * Manages the full WaveSurfer/RecordPlugin lifecycle, device enumeration,
 * system-audio capture via getDisplayMedia, and volume metering.
 *
 * Separation: this hook owns media capture state only.
 * Compression, transcription, and API calls are handled by sibling hooks.
 */
export function useAudioRecorder(): UseAudioRecorderReturn {
    const [isRecording,       setIsRecording]       = useState(false);
    const [isPaused,          setIsPaused]           = useState(false);
    const [timer,             setTimer]              = useState(0);
    const [volume,            setVolume]             = useState(0);
    const [recordedBlob,      setRecordedBlob]       = useState<Blob | null>(null);
    const [devices,           setDevices]            = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId,  setSelectedDeviceId]   = useState<string>('');
    const [isSystemAudioActive, setIsSystemAudioActive] = useState<boolean>(false);
    const [isMicMuted, setIsMicMuted] = useState<boolean>(false);

    const waveContainerRef  = useRef<HTMLDivElement>(null!);
    const wavesurferRef     = useRef<WaveSurfer | null>(null);
    const recordPluginRef   = useRef<RecordPluginInstance | null>(null);
    const timerIntervalRef  = useRef<NodeJS.Timeout | null>(null);

    // ── Helpers ────────────────────────────────────────────────────────────────

    const formatTime = (s: number) => {
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        return [h, m, sec].map(n => String(n).padStart(2, '0')).join(':');
    };

    const cleanup = useCallback(() => {
        if (recordPluginRef.current) {
            try {
                const rec = recordPluginRef.current;
                const stream = (rec as any).stream;
                if (stream) {
                    stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
                    if (stream._originalStreams) {
                        stream._originalStreams.forEach((s: MediaStream) => s.getTracks().forEach((t: MediaStreamTrack) => t.stop()));
                    }
                }
                if (rec.isRecording() || rec.isPaused()) rec.stopRecording();
            } catch { /* best effort */ }
            recordPluginRef.current = null;
        }
        if (wavesurferRef.current) {
            try { wavesurferRef.current.destroy(); } catch { /* best effort */ }
            wavesurferRef.current = null;
        }
    }, []);

    // ── Device enumeration ────────────────────────────────────────────────────

    const enumerateDevices = useCallback(async () => {
        if (!navigator.mediaDevices?.enumerateDevices) return;
        try {
            const pre = await navigator.mediaDevices.enumerateDevices();
            if (!pre.some(d => d.label)) {
                const s = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
                if (s) s.getTracks().forEach(t => t.stop());
            }
            const all    = await navigator.mediaDevices.enumerateDevices();
            const inputs = all.filter(d => d.kind === 'audioinput');
            setDevices(inputs);
            if (inputs.length > 0 && !selectedDeviceId) {
                const def = inputs.find(d => d.deviceId === 'default') || inputs[0];
                setSelectedDeviceId(def.deviceId);
            }
        } catch { /* non-critical */ }
    }, [selectedDeviceId]);

    useEffect(() => { enumerateDevices(); }, [enumerateDevices]);

    // ── Timer ─────────────────────────────────────────────────────────────────

    useEffect(() => {
        if (isRecording && !isPaused) {
            timerIntervalRef.current = setInterval(() => setTimer(t => t + 1), 1000);
        } else {
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        }
        return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
    }, [isRecording, isPaused]);

    // ── Unmount cleanup ───────────────────────────────────────────────────────

    useEffect(() => () => cleanup(), [cleanup]);



    // ── initWaveSurfer ────────────────────────────────────────────────────────

    const changeMicrophone = async (deviceId: string) => {
        setSelectedDeviceId(deviceId);

        if (isRecording && recordPluginRef.current) {
            try {
                const newMicStream = await navigator.mediaDevices.getUserMedia({
                    audio: { deviceId }
                });

                if (isMicMuted) {
                    newMicStream.getAudioTracks().forEach(t => { t.enabled = false; });
                }

                const activeStream = (recordPluginRef.current as any).stream as MediaStream;
                const audioCtx = (activeStream as any)._audioCtx as AudioContext;
                if (audioCtx) {
                    const destination = (activeStream as any)._destination as MediaStreamAudioDestinationNode;
                    const oldMicSource = (activeStream as any)._micSource as MediaStreamAudioSourceNode;
                    const oldMicStream = (activeStream as any)._originalStreams[0] as MediaStream;

                    if (oldMicStream) oldMicStream.getTracks().forEach(t => t.stop());
                    if (oldMicSource) oldMicSource.disconnect();

                    const newMicSource = audioCtx.createMediaStreamSource(newMicStream);
                    newMicSource.connect(destination);

                    (activeStream as any)._micSource = newMicSource;
                    (activeStream as any)._originalStreams[0] = newMicStream;
                }
            } catch (err) {
                console.error("Failed to dynamically swap microphone:", err);
            }
        }
    };

    async function getMediaStream(withSystemAudio: boolean): Promise<MediaStream> {
        const micStream = await navigator.mediaDevices.getUserMedia({ 
            audio: selectedDeviceId ? { deviceId: selectedDeviceId } : true 
        });

        if (isMicMuted) {
            micStream.getAudioTracks().forEach(t => { t.enabled = false; });
        }

        const audioCtx = new AudioContext();
        const destination = audioCtx.createMediaStreamDestination();
        const micSource = audioCtx.createMediaStreamSource(micStream);
        micSource.connect(destination);

        let displayStream: MediaStream | null = null;
        let systemSource: MediaStreamAudioSourceNode | null = null;

        if (withSystemAudio) {
            try {
                displayStream = await navigator.mediaDevices.getDisplayMedia({ 
                    video: true, 
                    audio: {
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false,
                    } as any
                });

                const systemAudioTrack = displayStream.getAudioTracks()[0];
                if (systemAudioTrack) {
                    systemSource = audioCtx.createMediaStreamSource(new MediaStream([systemAudioTrack]));
                    systemSource.connect(destination);

                    const videoTrack = displayStream.getVideoTracks()[0];
                    if (videoTrack) {
                        videoTrack.onended = () => {
                            if (recordPluginRef.current?.isRecording()) {
                                recordPluginRef.current.stopRecording();
                            }
                        };
                    }
                } else {
                    displayStream.getTracks().forEach(t => t.stop());
                    displayStream = null;
                }
            } catch (err) {
                console.error('getDisplayMedia failed, falling back to MIC:', err);
            }
        }

        const mixedStream = destination.stream;
        (mixedStream as any)._originalStreams = [micStream];
        if (displayStream) {
            (mixedStream as any)._originalStreams.push(displayStream);
        }
        (mixedStream as any)._audioCtx = audioCtx;
        (mixedStream as any)._destination = destination;
        (mixedStream as any)._micSource = micSource;

        return mixedStream;
    }

    function attachVolumeMonitor(stream: MediaStream, getActive: () => boolean) {
        const ctx      = new AudioContext();
        const source   = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
            if (!getActive()) {
                ctx.close();
                return;
            }
            analyser.getByteFrequencyData(data);
            const avg = data.reduce((a, b) => a + b, 0) / data.length;
            setVolume(avg);
            requestAnimationFrame(tick);
        };
        tick();
    }

    async function initWaveSurfer(stream: MediaStream) {
        if (!waveContainerRef.current) return;
        cleanup();

        try {
            const wavesurfer = WaveSurfer.create({
                container:     waveContainerRef.current,
                waveColor:     '#6366f1',
                progressColor: '#818cf8',
                height:        90,
                barWidth:      3,
                barGap:        3,
                barRadius:     2,
                interact:      false,
                cursorWidth:   0,
            });

            const record = wavesurfer.registerPlugin(
                RecordPlugin.create({ renderRecordedAudio: false, scrollingWaveform: true, scrollingWaveformWindow: 10 })
            ) as RecordPluginInstance;

            wavesurferRef.current   = wavesurfer;
            recordPluginRef.current = record;

            record.on('record-end', (blob: Blob) => {
                const stream = (record as any).stream;
                if (stream) {
                    stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
                    if (stream._originalStreams) {
                        stream._originalStreams.forEach((s: MediaStream) => s.getTracks().forEach((t: MediaStreamTrack) => t.stop()));
                    }
                    if (stream._audioCtx) stream._audioCtx.close();
                }
                setRecordedBlob(blob);
                setIsRecording(false);
                setIsPaused(false);
                setIsSystemAudioActive(false);
            });

            (record as any).stream = stream;

            // For RecordPlugin to work with our manual stream, we bypass its internal getUserMedia
            await record.startRecording({ stream });

            attachVolumeMonitor(
                stream,
                () => isRecording && !isPaused,
            );

        } catch (err: any) {
            console.error('initWaveSurfer error:', err);
            const msg = err.message ?? '';
            if (msg.includes('Permission denied')) {
                alert('Permissions denied. Please allow camera/microphone access in your browser settings.');
            } else {
                alert(`Recording error: ${msg}`);
            }
            setIsRecording(false);
            cleanup();
        }
    }

    // ── Public controls ───────────────────────────────────────────────────────

    const startRecording = async (withSystemAudio: boolean = false) => {
        setRecordedBlob(null);
        setTimer(0);
        
        try {
            // Retrieve stream immediately on user click to avoid browser permission block
            const stream = await getMediaStream(withSystemAudio);
            
            setIsSystemAudioActive(withSystemAudio);
            setIsRecording(true);
            setIsPaused(false);

            // Give React time to mount the wave container before initializing WaveSurfer
            setTimeout(() => {
                initWaveSurfer(stream);
            }, 100);
        } catch (err: any) {
            console.error('startRecording error:', err);
            const msg = err.message ?? '';
            if (msg.includes('Permission denied') || msg.includes('NotAllowedError')) {
                alert('Permissions denied or user dismissed dialog. Please allow camera/microphone access in your browser settings.');
            } else {
                alert(`Recording error: ${msg}`);
            }
        }
    };

    const pauseResume = () => {
        if (!recordPluginRef.current) return;
        if (isPaused) {
            recordPluginRef.current.resumeRecording();
            setIsPaused(false);
        } else {
            recordPluginRef.current.pauseRecording();
            setIsPaused(true);
        }
    };

    const stopRecording = () => {
        if (recordPluginRef.current) {
            recordPluginRef.current.stopRecording();
        } else {
            setIsRecording(false);
            setIsPaused(false);
            cleanup();
        }
    };

    const resetRecording = () => {
        setRecordedBlob(null);
        setTimer(0);
        cleanup();
    };

    const toggleMicMute = () => {
        setIsMicMuted(prev => {
            const nextMuted = !prev;
            if (recordPluginRef.current) {
                const stream = (recordPluginRef.current as any).stream as MediaStream;
                if (stream) {
                    let micStreamToMute: MediaStream | undefined = stream;
                    if ((stream as any)._originalStreams && (stream as any)._originalStreams.length > 0) {
                        micStreamToMute = (stream as any)._originalStreams[0];
                    }
                    if (micStreamToMute) {
                        micStreamToMute.getAudioTracks().forEach(t => t.enabled = !nextMuted);
                    }
                }
            }
            return nextMuted;
        });
    };

    return {
        isRecording, isPaused, timer, volume, recordedBlob,
        devices, selectedDeviceId, setSelectedDeviceId: changeMicrophone,
        waveContainerRef,
        startRecording, pauseResume, stopRecording, resetRecording,
        isSystemAudioActive,
        isMicMuted, toggleMicMute,
    };
}

// Export formatTime as a standalone utility for the component.
export function formatTime(seconds: number): string {
    const h   = Math.floor(seconds / 3600);
    const m   = Math.floor((seconds % 3600) / 60);
    const s   = seconds % 60;
    return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
}
