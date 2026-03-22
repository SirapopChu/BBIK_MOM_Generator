import { Router }                from 'express';
import { upload }                from '../middleware/upload.js';
import { generateMinutesText }   from '../services/llm.service.js';
import { buildDocxBuffer }       from '../services/docx.service.js';
import * as taskService          from '../services/task.service.js';
import { enqueueAudioTask }      from '../services/queue.service.js';

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Safe JSON parse that returns null on failure.
 */
function parseMetadata(raw) {
    if (!raw) return null;
    try { return JSON.parse(raw); }
    catch { return null; }
}

/**
 * Resolves DOCX output filename.
 */
function resolveFilenames(base, meta) {
    const docName    = meta?.title?.replace(/\s+/g, '_') ?? base;
    const outputName = `${docName}_meeting_minutes.docx`;
    return { docName, outputName };
}

/**
 * POST /api/minutes/generate
 * Body: { text } or multipart transcript file
 */
router.post('/generate', upload.single('transcript'), async (req, res, next) => {
    try {
        const transcript = req.file ? req.file.buffer.toString('utf8') : req.body.text;
        if (!transcript?.trim()) {
            return res.status(400).json({ error: 'Transcript text is required (file or body.text).' });
        }
        const { result, usage } = await generateMinutesText(transcript);
        res.json({ result, usage });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/minutes/export-docx
 * Body: { text, filename?, metadata? } or multipart transcript file
 * Returns: application/vnd.openxmlformats-officedocument.wordprocessingml.document
 */
router.post('/export-docx', upload.single('transcript'), async (req, res, next) => {
    let taskId = null;
    try {
        const transcript = req.file ? req.file.buffer.toString('utf8') : req.body.text;
        if (!transcript?.trim()) {
            return res.status(400).json({ error: 'Transcript text is required (file or body.text).' });
        }

        const base     = req.body.filename || 'meeting_minutes';
        const metadata = parseMetadata(req.body.metadata);
        const { outputName } = resolveFilenames(base, metadata);

        taskId = await taskService.createTask(base, req.user.id, 'docx_generation');
        await taskService.addLog(taskId, 'Starting Claude analysis and document generation.');
        await taskService.updateTask(taskId, { currentStep: 'analyze', progress: 20 });
        await taskService.addLog(taskId, 'Contacting Anthropic Claude API...');

        const { result } = await generateMinutesText(transcript);
        await taskService.addLog(taskId, 'Claude analysis complete.');
        await taskService.updateTask(taskId, { progress: 60, currentStep: 'format' });
        await taskService.addLog(taskId, `Formatting results for DOCX: ${outputName}`);

        const buffer = await buildDocxBuffer(result, metadata);
        await taskService.addLog(taskId, 'DOCX buffer generated successfully.');
        await taskService.updateTask(taskId, { status: 'completed', progress: 100, currentStep: 'export' });

        const encodedFilename = encodeURIComponent(outputName);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`);
        res.send(buffer);
    } catch (err) {
        if (taskId) {
            await taskService.updateTask(taskId, { status: 'failed' });
            await taskService.addLog(taskId, `ERROR: ${err.message}`);
        }
        next(err);
    }
});

/**
 * POST /api/minutes/process-audio
 * One-click full workflow: Transcribe -> Analyze -> DOCX
 * Returns: { taskId } immediately; processing continues in background.
 */
router.post('/process-audio', upload.single('audio'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Audio file is required.' });

    const base     = req.file.originalname.replace(/\.(mp3|wav|m4a|webm)$/i, '');
    const language = (req.body.language || '').trim();
    const model    = (req.body.model || '').trim();
    const metadata = parseMetadata(req.body.metadata);

    try {
        const taskId = await taskService.createTask(base, req.user.id, 'full_workflow');

        // Respond immediately with taskId
        res.json({ taskId });

        // Offload to background worker via BullMQ
        await enqueueAudioTask(taskId, req.user.id, req.file.buffer, req.file.originalname, req.file.mimetype, language, metadata, model || null);
        
        await taskService.addLog(taskId, 'Task enqueued for background processing.');
    } catch (err) {
        console.error('Failed to initialize task:', err);
        res.status(500).json({ error: 'Failed to initialize processing task.' });
    }
});

export default router;
