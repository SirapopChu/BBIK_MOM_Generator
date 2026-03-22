'use client';

import { useRef, useState } from 'react';
import { FFmpeg }            from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

const FFMPEG_CORE_URL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
// Files above this threshold are compressed before upload.
const COMPRESS_THRESHOLD_MB = 22;

/**
 * Manages FFmpeg WASM lifecycle and audio compression.
 * Lazy-initialises FFmpeg — safe in Next.js SSR because no instance is
 * created at module load time (the previous SSR error root cause).
 *
 * @returns {{ compressAudioFile, compressionProgress }}
 */
export function useCompressedUpload() {
    const ffmpegRef = useRef<FFmpeg | null>(null);
    const [compressionProgress, setCompressionProgress] = useState<string | null>(null);

    async function ensureLoaded(): Promise<FFmpeg> {
        if (!ffmpegRef.current) ffmpegRef.current = new FFmpeg();
        const ffmpeg = ffmpegRef.current;
        if (ffmpeg.loaded) return ffmpeg;

        setCompressionProgress('Loading compression engine...');
        await ffmpeg.load({
            coreURL: await toBlobURL(`${FFMPEG_CORE_URL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${FFMPEG_CORE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
        return ffmpeg;
    }

    /**
     * Compresses a File or Blob to 32kbps mono MP3 suitable for Whisper.
     * No-ops if the file is already under COMPRESS_THRESHOLD_MB.
     *
     * @param source - Input audio File or Blob.
     * @param name   - Filename used for the virtual FS (extension matters).
     * @returns Original blob if small enough, otherwise compressed MP3 Blob.
     */
    async function compressAudioFile(source: File | Blob, name: string): Promise<Blob> {
        if (source.size <= COMPRESS_THRESHOLD_MB * 1024 * 1024) return source;

        const ffmpeg    = await ensureLoaded();
        const inputName = `in_${Date.now()}_${name}`;
        const outName   = `out_${Date.now()}.mp3`;

        ffmpeg.on('progress', ({ progress }) => {
            setCompressionProgress(`Compressing: ${Math.round(progress * 100)}%`);
        });

        setCompressionProgress('Compressing...');
        await ffmpeg.writeFile(inputName, await fetchFile(source));
        await ffmpeg.exec(['-i', inputName, '-b:a', '32k', '-ac', '1', outName]);
        const data = await ffmpeg.readFile(outName);

        // Cleanup virtual FS
        await ffmpeg.deleteFile(inputName).catch(() => {});
        await ffmpeg.deleteFile(outName).catch(() => {});

        setCompressionProgress(null);
        return new Blob([data as any], { type: 'audio/mp3' });
    }

    return { compressAudioFile, compressionProgress };
}
