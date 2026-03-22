'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import WaveSurfer    from 'wavesurfer.js';
import RecordPlugin  from 'wavesurfer.js/dist/plugins/record.esm.js';

// ── Types ──────────────────────────────────────────────────────────────────────

type RecordPluginInstance = ReturnType<typeof RecordPlugin.create> & {
    stream?: MediaStream;
    originalDisplayStream?: MediaStream;
    renderMicStream: (s: MediaStream) => { onDestroy: () => void; onEnd: () => void };
    micStream: { onDestroy: () => void; onEnd: () => void } | null;
    unsubscribeDestroy?: () => void;
    unsubscribeRecordEnd?: () => void;
};

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
    setSelectedDeviceId: (id: string) => void;
    /** DOM ref to mount the WaveSurfer waveform canvas into. */
    waveContainerRef: React.RefObject<HTMLDivElement>;
    startRecording: () => void;
    pauseResume:    () => void;
    stopRecording:  () => void;
    resetRecording: () => void;
}

// Virtual device entry appended to the real device list.
const SYSTEM_AUDIO_DEVICE: MediaDeviceInfo = {
    deviceId: 'system_audio',
    label:    'System Audio (Zoom/Teams/Meet)',
    kind:     'audioinput',
    groupId:  'system_virtual',
} as MediaDeviceInfo;

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
                const origStream = rec.originalDisplayStream;
                if (origStream) origStream.getTracks().forEach(t => t.stop());
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
                s?.getTracks().forEach(t => t.stop());
            }
            const all    = await navigator.mediaDevices.enumerateDevices();
            const inputs = all.filter(d => d.kind === 'audioinput');
            setDevices([...inputs, SYSTEM_AUDIO_DEVICE]);
            if (inputs.length > 0 && !selectedDeviceId) {
                setSelectedDeviceId(inputs.find(d => d.deviceId === 'default')?.deviceId ?? inputs[0].deviceId);
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

    // ── WaveSurfer init on recording start ────────────────────────────────────

    useEffect(() => {
        if (!isRecording || isPaused) return;
        const timeout = setTimeout(() => initWaveSurfer(), 100);
        return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isRecording]);

    // ── initWaveSurfer ────────────────────────────────────────────────────────

    async function getMediaStream(): Promise<MediaStream> {
        if (selectedDeviceId !== 'system_audio') {
            return navigator.mediaDevices.getUserMedia({ audio: { deviceId: selectedDeviceId } });
        }

        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        const audioTrack    = displayStream.getAudioTracks()[0];

        if (!audioTrack) {
            displayStream.getTracks().forEach(t => t.stop());
            throw new Error('Please check "Share audio" when sharing your screen or tab.');
        }

        // Auto-stop recording when screen-share ends via native browser controls.
        const videoTrack = displayStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.onended = () => {
                if (recordPluginRef.current?.isRecording()) recordPluginRef.current.stopRecording();
            };
        }

        (displayStream as any)._originalRef = displayStream;
        return new MediaStream([audioTrack]);
    }

    function attachVolumeMonitor(stream: MediaStream, getActive: () => boolean) {
        const ctx      = new AudioContext();
        const source   = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
            if (!getActive()) return;
            analyser.getByteFrequencyData(data);
            const avg = data.reduce((a, b) => a + b, 0) / data.length;
            setVolume(avg);
            requestAnimationFrame(tick);
        };
        tick();
    }

    async function initWaveSurfer() {
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
                // Stop screen-share stream if applicable.
                const orig = record.originalDisplayStream;
                if (orig) orig.getTracks().forEach(t => t.stop());
                setRecordedBlob(blob);
                setIsRecording(false);
                setIsPaused(false);
            });

            const stream = await getMediaStream();

            // Attach system-audio display stream reference for later cleanup.
            if (selectedDeviceId === 'system_audio') {
                const micStream = record.renderMicStream(stream);
                record.micStream           = micStream;
                record.unsubscribeDestroy  = record.once('destroy', micStream.onDestroy.bind(micStream));
                record.unsubscribeRecordEnd = record.once('record-end', micStream.onEnd.bind(micStream));
                (record as any).stream           = stream;
                await record.startRecording();
            } else {
                await record.startRecording({ deviceId: selectedDeviceId });
            }

            attachVolumeMonitor(
                (record as any).stream ?? stream,
                () => isRecording && !isPaused,
            );

        } catch (err: any) {
            const msg = err.message ?? '';
            if (msg.includes('Share audio') || msg.includes('screen')) {
                alert(`System Audio error: ${msg}`);
            } else if (msg.includes('system')) {
                alert('Microphone access is blocked. Go to System Settings > Privacy & Security > Microphone.');
            } else {
                alert(`Microphone error: ${msg}. Ensure permissions are granted.`);
            }
            setIsRecording(false);
            cleanup();
        }
    }

    // ── Public controls ───────────────────────────────────────────────────────

    const startRecording = () => {
        setRecordedBlob(null);
        setTimer(0);
        setIsRecording(true);
        setIsPaused(false);
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

    return {
        isRecording, isPaused, timer, volume, recordedBlob,
        devices, selectedDeviceId, setSelectedDeviceId,
        waveContainerRef,
        startRecording, pauseResume, stopRecording, resetRecording,
    };
}

// Export formatTime as a standalone utility for the component.
export function formatTime(seconds: number): string {
    const h   = Math.floor(seconds / 3600);
    const m   = Math.floor((seconds % 3600) / 60);
    const s   = seconds % 60;
    return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
}
