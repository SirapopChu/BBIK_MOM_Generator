'use client';

import { useState } from 'react';
import { transcribeAudio as apiTranscribeAudio, TranscriptResult } from '../services/api';
import { useCompressedUpload } from './useCompressedUpload';

/**
 * Encapsulates all Whisper transcription logic.
 * Delegates compression to useCompressedUpload so it remains a peer concern.
 *
 * @returns {{ transcribe, isTranscribing, transcriptResult, transcriptError, reset }}
 */
export function useTranscription() {
    const { compressAudioFile, compressionProgress } = useCompressedUpload();

    const [isTranscribing,   setIsTranscribing]   = useState(false);
    const [transcriptResult, setTranscriptResult] = useState<TranscriptResult | null>(null);
    const [transcriptError,  setTranscriptError]  = useState<string | null>(null);

    /**
     * Transcribes the supplied blob, compressing it if necessary.
     *
     * @param blob        - Raw audio Blob.
     * @param recordingName - Used to derive the filename hint.
     */
    async function transcribe(blob: Blob, recordingName: string): Promise<void> {
        setIsTranscribing(true);
        setTranscriptResult(null);
        setTranscriptError(null);

        try {
            const compressed = await compressAudioFile(blob, recordingName);

            const isMp3 = compressed.type === 'audio/mp3';
            const ext   = isMp3              ? 'mp3'
                        : blob.type.includes('mp4') ? 'mp4'
                        : blob.type.includes('wav') ? 'wav'
                        : 'webm';

            const result = await apiTranscribeAudio(compressed, `${recordingName}.${ext}`, 'th');
            setTranscriptResult(result);
        } catch (err: any) {
            setTranscriptError(err.message ?? 'Unknown error');
        } finally {
            setIsTranscribing(false);
        }
    }

    function reset() {
        setTranscriptResult(null);
        setTranscriptError(null);
        setIsTranscribing(false);
    }

    return { transcribe, isTranscribing, transcriptResult, transcriptError, compressionProgress, reset };
}
