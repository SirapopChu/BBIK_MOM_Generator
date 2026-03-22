import { generateMinutesText }   from './llm.service.js';
import { buildDocxBuffer }       from './docx.service.js';
import { transcribeAudio }       from './transcription.service.js';
import * as taskService          from './task.service.js';

/**
 * Core Audio Processing Pipeline
 * 
 * Orchesrates the Transcribe -> Analyze -> Format workflow.
 * Can be called directly (sync/async) or via a BullMQ Worker.
 *
 * @param {string}        taskId
 * @param {{ buffer: Buffer, mimetype: string, originalname: string }} file
 * @param {string}        language
 * @param {object|null}   metadata
 * @param {string|null}   model
 */
export async function runAudioPipeline(taskId, file, language, metadata, model = null) {
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

        const { result } = await generateMinutesText(transcriptResult.text, model);

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
        throw err; // Re-throw to let BullMQ handle retries if applicable
    }
}
