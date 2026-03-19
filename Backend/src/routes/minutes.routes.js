import { Router } from 'express';
import multer from 'multer';
import { generateMinutesText } from '../services/llm.service.js';
import { buildDocxBuffer } from '../services/docx.service.js';
import { transcribeAudio } from '../services/transcription.service.js';
import * as taskService from '../services/task.service.js';

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
    let taskId = null;
    try {
        const transcript = req.file
            ? req.file.buffer.toString('utf8')
            : req.body.text;

        if (!transcript?.trim()) {
            return res.status(400).json({ error: 'Transcript text is required (file or body.text).' });
        }

        const baseTitle = req.body.filename || 'meeting_minutes';
        const outputName = req.body.filename
            ? `${req.body.filename}.docx`
            : `meeting_minutes_${Date.now()}.docx`;

        // Start Tracking
        taskId = taskService.createTask(baseTitle, 'docx_generation');
        taskService.addLog(taskId, 'Starting Claude analysis and document generation.');

        taskService.updateTask(taskId, { currentStep: 'analyze', progress: 20 });
        taskService.addLog(taskId, 'Contacting Anthropic Claude API for transcription analysis...');
        
        const { result } = await generateMinutesText(transcript);
        taskService.addLog(taskId, 'Claude analysis complete. Agenda and bilingual summary extracted.');
        taskService.updateTask(taskId, { progress: 60 });

        taskService.updateTask(taskId, { currentStep: 'format', progress: 75 });
        taskService.addLog(taskId, `Formatting results for DOCX: ${outputName}`);
        
        let metadata = null;
        if (req.body.metadata) {
            try {
                metadata = JSON.parse(req.body.metadata);
            } catch (e) {
                console.warn('Failed to parse metadata', e.message);
            }
        }

        const buffer = await buildDocxBuffer(result, metadata);
        taskService.addLog(taskId, 'DOCX buffer generated successfully.');
        
        taskService.updateTask(taskId, { currentStep: 'export' });
        taskService.updateTask(taskId, { status: 'completed', progress: 100 });

        const encodedFilename = encodeURIComponent(outputName);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`);
        res.send(buffer);
    } catch (err) {
        console.error('[POST /export-docx]', err.message);
        if (taskId) {
            taskService.updateTask(taskId, { status: 'failed' });
            taskService.addLog(taskId, `ERROR: ${err.message}`);
        }
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/minutes/process-audio
 * One-click full workflow: Transcribe -> Analyze -> DOCX
 */
router.post('/process-audio', upload.single('audio'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Audio file is required.' });

    const filename = req.file.originalname || 'meeting_audio';
    const baseTitle = filename.replace(/\.(mp3|wav|m4a|webm)$/i, '');
    const language = (req.body.language || '').trim();

    // 1. Create Task
    const taskId = taskService.createTask(baseTitle, 'full_workflow');
    
    // 2. Respond immediately with taskId
    res.json({ taskId });

    // 3. Process in background
    (async () => {
        try {
            const checkCancelled = () => {
                const updatedTask = taskService.getTaskById(taskId);
                if (updatedTask?.status === 'cancelled') {
                    throw new Error('Task cancelled by user');
                }
            };

            // STEP 1: Transcribe
            checkCancelled();
            taskService.updateTask(taskId, { currentStep: 'transcribe', progress: 10 });
            taskService.addLog(taskId, `Starting transcription for ${filename}...`);
            
            const transcriptResult = await transcribeAudio(req.file.buffer, req.file.mimetype, filename, language);
            
            checkCancelled();
            taskService.addLog(taskId, `Transcription complete. Detected language: ${transcriptResult.language}`);
            
            // STEP 2: Analyze with Claude
            checkCancelled();
            taskService.updateTask(taskId, { currentStep: 'analyze', progress: 40 });
            taskService.addLog(taskId, 'Sending transcript to Claude AI for minute generation...');
            
            const { result } = await generateMinutesText(transcriptResult.text);
            
            checkCancelled();
            taskService.addLog(taskId, 'Claude analysis complete.');

            // STEP 3: Build DOCX
            checkCancelled();
            taskService.updateTask(taskId, { currentStep: 'format', progress: 75 });
            taskService.addLog(taskId, 'Formatting and building DOCX document...');

            const buffer = await buildDocxBuffer(result);

            checkCancelled();
            // FINISH
            taskService.updateTask(taskId, { 
                status: 'completed', 
                progress: 100, 
                currentStep: 'ready' 
            }, buffer);
            taskService.addLog(taskId, 'Process completed! Document is ready for download.');

        } catch (err) {
            console.error(`[Background Task ${taskId}]`, err);
            taskService.updateTask(taskId, { status: 'failed', error: err.message });
            taskService.addLog(taskId, `ERROR: ${err.message}`);
        }
    })();
});

export default router;
