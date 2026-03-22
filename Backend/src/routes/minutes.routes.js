import { Router }                from 'express';
import { upload }                from '../middleware/upload.js';
import { generateMinutesText }   from '../services/llm.service.js';
import { buildDocxBuffer }       from '../services/docx.service.js';
import { transcribeAudio }       from '../services/transcription.service.js';
import * as taskService          from '../services/task.service.js';

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Safe JSON parse that returns null on failure.
 * Avoids duplicated try/catch blocks across route handlers.
 *
 * @param {string|undefined} raw
 * @returns {object|null}
 */
function parseMetadata(raw) {
    if (!raw) return null;
    try { return JSON.parse(raw); }
    catch { return null; }
}

/**
 * Resolves DOCX output filename from optional user-supplied metadata.
 *
 * @param {string}      base
 * @param {object|null} meta
 * @returns {{ outputName: string, docName: string }}
 */
function resolveFilenames(base, meta) {
    const docName    = meta?.title?.replace(/\s+/g, '_') ?? base;
    const outputName = `${docName}_meeting_minutes.docx`;
    return { docName, outputName };
}

/**
 * Named pipeline function for the full audio processing workflow.
 * Extracted from the anonymous IIFE that was previously inline in the route.
 * Runs asynchronously after the HTTP response (taskId) is already sent.
 *
 * @param {string}        taskId
 * @param {Express.Multer.File} file
 * @param {string}        language
 * @param {object|null}   metadata
 */
async function runAudioPipeline(taskId, file, language, metadata) {
    const checkCancelled = async () => {
        const current = await taskService.getTaskById(taskId);
        if (current?.status === 'cancelled') throw new Error('Task cancelled by user');
    };

    try {
        // Step 1: Transcribe
        await checkCancelled();
        await taskService.updateTask(taskId, { currentStep: 'transcribe', progress: 10 });
        await taskService.addLog(taskId, `Starting transcription for ${file.originalname}...`);

        const transcriptResult = await transcribeAudio(
            file.buffer, file.mimetype, file.originalname, language
        );

        await checkCancelled();
        await taskService.addLog(taskId, `Transcription complete. Detected language: ${transcriptResult.language}`);

        // Step 2: Analyze with Claude
        await checkCancelled();
        await taskService.updateTask(taskId, { currentStep: 'analyze', progress: 40 });
        await taskService.addLog(taskId, 'Sending transcript to Claude AI for minute generation...');

        const { result } = await generateMinutesText(transcriptResult.text);

        await checkCancelled();
        await taskService.addLog(taskId, 'Claude analysis complete.');

        // Step 3: Build DOCX
        await checkCancelled();
        await taskService.updateTask(taskId, { currentStep: 'format', progress: 75 });
        await taskService.addLog(taskId, 'Formatting and building DOCX document...');

        const buffer = await buildDocxBuffer(result, metadata);

        await checkCancelled();
        await taskService.updateTask(taskId, { status: 'completed', progress: 100, currentStep: 'ready' }, buffer);
        await taskService.addLog(taskId, 'Process completed! Document is ready for download.');

    } catch (err) {
        console.error(`[${new Date().toISOString()}] [Pipeline ${taskId}]`, err.message);
        await taskService.updateTask(taskId, { status: 'failed', error: err.message });
        await taskService.addLog(taskId, `ERROR: ${err.message}`);
    }
}

// ── Routes ────────────────────────────────────────────────────────────────────

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

        taskId = await taskService.createTask(base, 'docx_generation');
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
router.post('/process-audio', upload.single('audio'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Audio file is required.' });

    const base     = req.file.originalname.replace(/\.(mp3|wav|m4a|webm)$/i, '');
    const language = (req.body.language || '').trim();
    const metadata = parseMetadata(req.body.metadata);

    taskService.createTask(base, 'full_workflow').then(taskId => {
        // Respond immediately with taskId; pipeline runs in background.
        res.json({ taskId });
        runAudioPipeline(taskId, req.file, language, metadata);
    }).catch(err => {
        console.error('Failed to create task:', err);
        res.status(500).json({ error: 'Failed to initialize processing task.' });
    });
});

export default router;
