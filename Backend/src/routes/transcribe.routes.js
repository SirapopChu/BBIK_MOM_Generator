import { Router }  from 'express';
import multer        from 'multer';
import { transcribeAudio } from '../services/transcription.service.js';

const router = Router();

// Accept files up to 50 MB (OpenAI Whisper limit is 25 MB, but we allow more in backend for future-proofing or error handling)
const upload = multer({
    storage: multer.memoryStorage(),
    limits:  { fileSize: 50 * 1024 * 1024 },
});

/**
 * POST /api/transcribe
 *
 * Body (multipart/form-data):
 *   audio    (file)   — audio file (webm, mp3, wav, m4a, …)
 *   language (string) — optional BCP-47 code e.g. "th" or "en" (default: auto)
 *
 * Response 200:
 *   {
 *     text:     string,           // full transcript
 *     language: string | null,    // detected language
 *     duration: number | null,    // seconds
 *     segments: { id, start, end, text }[]
 *   }
 */
router.post('/', upload.single('audio'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Audio file is required. Send it as multipart field "audio".' });
    }

    const mimeType    = req.file.mimetype || 'audio/webm';
    const filename    = req.file.originalname || 'recording.webm';
    const language    = (req.body.language || '').trim();

    console.log(`[Whisper] Received: ${filename} (${(req.file.size / 1024).toFixed(1)} KB) lang=${language || 'auto'}`);

    try {
        const result = await transcribeAudio(req.file.buffer, mimeType, filename, language);
        console.log(`[Whisper] Done: ${result.text.length} chars, lang=${result.language}, dur=${result.duration}s`);
        res.json(result);
    } catch (err) {
        console.error('[Whisper] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

export default router;
