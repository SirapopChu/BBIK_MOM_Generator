/**
 * API Service Layer (Facade Pattern)
 *
 * Centralises all HTTP calls to the backend.
 * - Prevents fetch() calls from being scattered across components and hooks.
 * - Base URL is resolved from the NEXT_PUBLIC_API_URL env var so it works
 *   in both local dev (localhost:3001) and Docker/production environments.
 * - All functions throw a typed Error on non-2xx responses so callers can
 *   handle errors uniformly without response-parsing boilerplate.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/** @throws {Error} with server-provided message on non-2xx */
async function checkResponse(res: Response): Promise<Response> {
    if (!res.ok) {
        const body = await res.json().catch(() => ({ error: `Server error ${res.status}` }));
        throw new Error(body.error ?? `Server error ${res.status}`);
    }
    return res;
}

// ── Transcription ──────────────────────────────────────────────────────────────

export interface TranscriptSegment {
    id:    number;
    start: number;
    end:   number;
    text:  string;
}

export interface TranscriptResult {
    text:     string;
    language: string | null;
    duration: number | null;
    segments: TranscriptSegment[];
}

/**
 * Sends an audio blob to the Whisper transcription endpoint.
 *
 * @param audioBlob - Compressed or raw audio Blob.
 * @param filename  - Suggested filename including extension (e.g. "recording.mp3").
 * @param language  - BCP-47 language hint (e.g. "th", "en", or "" for auto-detect).
 */
export async function transcribeAudio(
    audioBlob: Blob,
    filename:  string,
    language:  string = 'th',
): Promise<TranscriptResult> {
    const form = new FormData();
    form.append('audio', audioBlob, filename);
    form.append('language', language);

    const res = await fetch(`${BASE_URL}/api/transcribe`, { method: 'POST', body: form });
    await checkResponse(res);
    return res.json();
}

// ── Minutes / Document Pipeline ────────────────────────────────────────────────

export interface ProcessAudioResult {
    taskId: string;
}

/**
 * Starts the full audio -> transcript -> minutes -> DOCX pipeline.
 * Returns a taskId; poll /api/tasks/:id for status.
 */
export async function processAudio(
    audioBlob: Blob,
    filename:  string,
    language:  string  = 'th',
    metadata?: string | null,
): Promise<ProcessAudioResult> {
    const form = new FormData();
    form.append('audio', audioBlob, filename);
    form.append('language', language);
    if (metadata) form.append('metadata', metadata);

    const res = await fetch(`${BASE_URL}/api/minutes/process-audio`, { method: 'POST', body: form });
    await checkResponse(res);
    return res.json();
}

/**
 * Generates a DOCX from an existing transcript text and downloads it as a Blob.
 */
export async function exportDocx(
    text:      string,
    filename:  string,
    metadata?: string | null,
): Promise<Blob> {
    const form = new FormData();
    form.append('text', text);
    form.append('filename', filename);
    if (metadata) form.append('metadata', metadata);

    const res = await fetch(`${BASE_URL}/api/minutes/export-docx`, { method: 'POST', body: form });
    await checkResponse(res);
    return res.blob();
}

// ── Task Polling ───────────────────────────────────────────────────────────────

export interface TaskStatus {
    id:          string;
    title:       string;
    status:      'processing' | 'completed' | 'failed' | 'cancelled' | 'queued';
    currentStep: string;
    progress:    number;
    completedAt: string | null;
    error:       string | null;
}

export async function getTask(taskId: string): Promise<TaskStatus> {
    const res = await fetch(`${BASE_URL}/api/tasks/${taskId}`);
    await checkResponse(res);
    const data = await res.json();
    return data.task;
}

export async function cancelTask(taskId: string): Promise<void> {
    await fetch(`${BASE_URL}/api/tasks/${taskId}/cancel`, { method: 'POST' });
}

/**
 * Triggers a browser download for the completed task's DOCX result.
 */
export function downloadTaskResult(taskId: string, filename: string): void {
    const a    = document.createElement('a');
    a.href     = `${BASE_URL}/api/tasks/${taskId}/download`;
    a.download = filename;
    a.click();
}
