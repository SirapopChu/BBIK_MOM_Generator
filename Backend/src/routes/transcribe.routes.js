import { Router }          from 'express';
import { upload }           from '../middleware/upload.js';
import { transcribeAudio }  from '../services/transcription.service.js';

const router = Router();

/**
 * POST /api/transcribe
 *
 * Body (multipart/form-data):
 *   audio    (file)   — audio file (webm, mp3, wav, m4a, ...)
 *   language (string) — optional BCP-47 code e.g. "th" or "en" (default: auto)
 *
 * Response 200:
 *   { text, language, duration, segments: [{ id, start, end, text }] }
 */
router.post('/', upload.single('audio'), async (req, res, next) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Audio file is required. Send it as multipart field "audio".' });
    }

    const { mimetype: mimeType, originalname: filename, size, buffer } = req.file;
    const language = (req.body.language || '').trim();

    console.log(`[${new Date().toISOString()}] [Whisper] Received: ${filename} (${(size / 1024).toFixed(1)} KB) lang=${language || 'auto'}`);

    try {
        const result = await transcribeAudio(buffer, mimeType, filename, language);
        console.log(`[${new Date().toISOString()}] [Whisper] Done: ${result.text.length} chars, lang=${result.language}, dur=${result.duration}s`);
        res.json(result);
    } catch (err) {
        next(err); // delegate to global error handler
    }
});

export default router;
