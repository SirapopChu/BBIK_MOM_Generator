import { Router } from 'express';
import multer from 'multer';
import { generateMinutesText } from '../services/llm.service.js';
import { buildDocxBuffer } from '../services/docx.service.js';

const router  = Router();
const upload  = multer({ storage: multer.memoryStorage() });

/**
 * POST /api/minutes/generate
 *
 * Body (multipart/form-data):
 *   transcript (file) — .txt file OR
 *   text       (string) — raw transcript text
 *
 * Returns: application/json  { text, usage }
 */
router.post('/generate', upload.single('transcript'), async (req, res) => {
    try {
        const transcript = req.file
            ? req.file.buffer.toString('utf8')
            : req.body.text;

        if (!transcript?.trim()) {
            return res.status(400).json({ error: 'Transcript text is required (file or body.text).' });
        }

        const { result, usage } = await generateMinutesText(transcript);
        res.json({ result, usage });
    } catch (err) {
        console.error('[POST /generate]', err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/minutes/export-docx
 *
 * Body (multipart/form-data):
 *   transcript (file) — .txt OR
 *   text       (string)
 *   filename   (string, optional) — desired output filename (without extension)
 *
 * Returns: application/vnd.openxmlformats-officedocument.wordprocessingml.document
 */
router.post('/export-docx', upload.single('transcript'), async (req, res) => {
    try {
        const transcript = req.file
            ? req.file.buffer.toString('utf8')
            : req.body.text;

        if (!transcript?.trim()) {
            return res.status(400).json({ error: 'Transcript text is required (file or body.text).' });
        }

        const outputName = req.body.filename
            ? `${req.body.filename}.docx`
            : `meeting_minutes_${Date.now()}.docx`;

        const { result } = await generateMinutesText(transcript);
        const buffer     = await buildDocxBuffer(result);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${outputName}"`);
        res.send(buffer);
    } catch (err) {
        console.error('[POST /export-docx]', err.message);
        res.status(500).json({ error: err.message });
    }
});

export default router;
