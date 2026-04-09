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
    /** DOM ref to mount the Mic waveform canvas into. */
    waveContainerRef: React.RefObject<HTMLDivElement>;
    /** DOM ref to mount the System Audio waveform canvas into. */
    systemWaveContainerRef: React.RefObject<HTMLDivElement>;
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

    const waveContainerRef        = useRef<HTMLDivElement>(null!);
    const systemWaveContainerRef  = useRef<HTMLDivElement>(null!);
    
    const wavesurferRef           = useRef<WaveSurfer | null>(null);
    const systemWavesurferRef     = useRef<WaveSurfer | null>(null);
    
    const recordPluginRef         = useRef<RecordPluginInstance | null>(null);
    const systemRecordPluginRef   = useRef<RecordPluginInstance | null>(null);
    const mediaRecorderRef        = useRef<MediaRecorder | null>(null);
    const chunksRef               = useRef<Blob[]>([]);
    
    const timerIntervalRef        = useRef<NodeJS.Timeout | null>(null);

    // Refs to avoid stale-closure issues in async callbacks
    const isRecordingRef          = useRef<boolean>(false);
    const isPausedRef             = useRef<boolean>(false);

    // ── Helpers ────────────────────────────────────────────────────────────────

    const cleanup = useCallback(() => {
        if (mediaRecorderRef.current) {
            try { 
                if (mediaRecorderRef.current.state !== 'inactive') {
                    mediaRecorderRef.current.stop(); 
                }
            } catch { /* ignored */ }
            mediaRecorderRef.current = null;
        }

        if (recordPluginRef.current) {
            try {
                if (recordPluginRef.current.isRecording() || recordPluginRef.current.isPaused()) {
                    recordPluginRef.current.stopRecording();
                }
            } catch { /* ignored */ }
            recordPluginRef.current = null;
        }

        if (systemRecordPluginRef.current) {
            try {
                if (systemRecordPluginRef.current.isRecording() || systemRecordPluginRef.current.isPaused()) {
                    systemRecordPluginRef.current.stopRecording();
                }
            } catch { /* ignored */ }
            systemRecordPluginRef.current = null;
        }

        if (wavesurferRef.current) {
            try { wavesurferRef.current.destroy(); } catch { /* ignored */ }
            wavesurferRef.current = null;
        }
        if (systemWavesurferRef.current) {
            try { systemWavesurferRef.current.destroy(); } catch { /* ignored */ }
            systemWavesurferRef.current = null;
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


    // ── Internal Methods ───────────────────────────────────────────────────────

    async function getMediaStreams(withSystemAudio: boolean) {
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
                            stopRecording();
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

        return { mixedStream, micStream, displayStream };
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

    async function initWaveSurfers(mixedStream: MediaStream, micStream: MediaStream, displayStream: MediaStream | null) {
        // 1. Setup Background MediaRecorder for the actual data
        const mediaRecorder = new MediaRecorder(mixedStream, { mimeType: 'audio/webm' });
        chunksRef.current = [];
        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        mediaRecorder.onstop = () => {
            const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
            setRecordedBlob(blob);
            
            // Cleanup streams
            mixedStream.getTracks().forEach(t => t.stop());
            if ((mixedStream as any)._originalStreams) {
                (mixedStream as any)._originalStreams.forEach((s: MediaStream) => s.getTracks().forEach((t: MediaStreamTrack) => t.stop()));
            }
            if ((mixedStream as any)._audioCtx) (mixedStream as any)._audioCtx.close();
            
            isRecordingRef.current = false;
            isPausedRef.current    = false;
            setIsRecording(false);
            setIsPaused(false);
            setIsSystemAudioActive(false);
        };
        mediaRecorder.start();
        mediaRecorderRef.current = mediaRecorder;

        // 2. Setup Microphones WaveSurfer (Visualization only) [Uses micStream]
        if (waveContainerRef.current) {
            const wavesurfer = WaveSurfer.create({
                container:     waveContainerRef.current,
                waveColor:     '#6366f1',
                progressColor: '#818cf8',
                height:        60,
                barWidth:      2,
                barGap:        2,
                barRadius:     2,
                interact:      false,
                cursorWidth:   0,
            });

            const record = wavesurfer.registerPlugin(
                RecordPlugin.create({ renderRecordedAudio: false, scrollingWaveform: true, scrollingWaveformWindow: 6 })
            ) as RecordPluginInstance;

            wavesurferRef.current   = wavesurfer;
            recordPluginRef.current = record;

            await record.startRecording({ stream: micStream });
        }

        // 3. Setup System Audio WaveSurfer (Visualization only)
        if (displayStream && systemWaveContainerRef.current) {
            const systemWavesurfer = WaveSurfer.create({
                container:     systemWaveContainerRef.current,
                waveColor:     '#ef4444',
                progressColor: '#f87171',
                height:        60,
                barWidth:      2,
                barGap:        2,
                barRadius:     2,
                interact:      false,
                cursorWidth:   0,
            });

            const systemRecord = systemWavesurfer.registerPlugin(
                RecordPlugin.create({ renderRecordedAudio: false, scrollingWaveform: true, scrollingWaveformWindow: 6 })
            ) as RecordPluginInstance;

            systemWavesurferRef.current   = systemWavesurfer;
            systemRecordPluginRef.current = systemRecord;

            // Extract only the audio track into an isolated stream for the visualizer
            const systemAudioTrack = displayStream.getAudioTracks()[0];
            const visualizerStream = systemAudioTrack
                ? new MediaStream([systemAudioTrack])
                : displayStream;
            await systemRecord.startRecording({ stream: visualizerStream });
        }

        attachVolumeMonitor(
            micStream,
            () => isRecordingRef.current && !isPausedRef.current,
        );
    }

    // ── Public controls ───────────────────────────────────────────────────────

    const changeMicrophone = async (deviceId: string) => {
        setSelectedDeviceId(deviceId);

        if (isRecording && wavesurferRef.current) {
            try {
                const newMicStream = await navigator.mediaDevices.getUserMedia({
                    audio: { deviceId }
                });

                if (isMicMuted) {
                    newMicStream.getAudioTracks().forEach(t => { t.enabled = false; });
                }

                // Update the Mixed Stream Backend
                const activeStream = (mediaRecorderRef.current as any).stream as MediaStream;
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

                // Update the visualizer
                if (recordPluginRef.current) {
                    recordPluginRef.current.stopRecording();
                    await recordPluginRef.current.startRecording({ stream: newMicStream });
                }

            } catch (err) {
                console.error("Failed to dynamically swap microphone:", err);
            }
        }
    };

    const startRecording = async (withSystemAudio: boolean = false) => {
        setRecordedBlob(null);
        setTimer(0);
        
        try {
            const { mixedStream, micStream, displayStream } = await getMediaStreams(withSystemAudio);
            
            setIsSystemAudioActive(withSystemAudio);
            isRecordingRef.current = true;
            isPausedRef.current    = false;
            setIsRecording(true);
            setIsPaused(false);

            // Give React time to mount the wave containers
            setTimeout(() => {
                initWaveSurfers(mixedStream, micStream, displayStream);
            }, 150);
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
        if (mediaRecorderRef.current) {
            if (isPaused) {
                mediaRecorderRef.current.resume();
                recordPluginRef.current?.resumeRecording();
                systemRecordPluginRef.current?.resumeRecording();
                isPausedRef.current = false;
                setIsPaused(false);
            } else {
                mediaRecorderRef.current.pause();
                recordPluginRef.current?.pauseRecording();
                systemRecordPluginRef.current?.pauseRecording();
                isPausedRef.current = true;
                setIsPaused(true);
            }
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            recordPluginRef.current?.stopRecording();
            systemRecordPluginRef.current?.stopRecording();
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
            if (mediaRecorderRef.current) {
                const stream = (mediaRecorderRef.current as any).stream as MediaStream;
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
        waveContainerRef, systemWaveContainerRef,
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
