import OpenAI from 'openai';
import { toFile } from 'openai';
import { config } from '../config/index.js';

const openai = new OpenAI({ apiKey: config.openai.apiKey });

/**
 * Transcribes audio using OpenAI Whisper large-v2.
 *
 * @param {Buffer} audioBuffer  - Raw audio bytes
 * @param {string} mimeType     - e.g. 'audio/webm', 'audio/mpeg', 'audio/wav'
 * @param {string} originalName - Original filename hint (e.g. 'recording.webm')
 * @param {string} language     - BCP-47 language code, e.g. 'th' or 'en'. Empty = auto-detect.
 * @returns {Promise<{ text: string, language: string, duration: number | null }>}
 */
export async function transcribeAudio(audioBuffer, mimeType, originalName = 'audio.webm', language = '') {
    // OpenAI SDK requires a File-like object
    const file = await toFile(audioBuffer, originalName, { type: mimeType });

    const params = {
        file,
        model:             'whisper-1',   // OpenAI's whisper-1 == large-v2 under the hood
        response_format:   'verbose_json',
        timestamp_granularities: ['segment'],
    };

    if (language) params.language = language;

    const response = await openai.audio.transcriptions.create(params);

    return {
        text:     response.text,
        language: response.language ?? null,
        duration: response.duration ?? null,
        segments: (response.segments ?? []).map(seg => ({
            id:    seg.id,
            start: seg.start,
            end:   seg.end,
            text:  seg.text.trim(),
        })),
    };
}
