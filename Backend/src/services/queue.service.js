import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis.js';

/**
 * BullMQ Queue Configuration
 * 
 * 'audio-pipeline' is the central queue for all background 
 * transcription and minute generation tasks.
 */
export const audioPipelineQueue = new Queue('audio-pipeline', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: 100, // Keep logs for last 100 failures
  },
});

/**
 * Adds a new job to the audio processing pipeline.
 * 
 * @param {string} taskId 
 * @param {Buffer} buffer 
 * @param {string} filename 
 * @param {string} mimetype 
 * @param {string} language 
 * @param {object|null} metadata 
 */
export async function enqueueAudioTask(taskId, buffer, filename, mimetype, language, metadata, model = null) {
  return await audioPipelineQueue.add(
    'process-audio',
    {
      taskId,
      file: {
        buffer: buffer.toString('base64'),
        originalname: filename,
        mimetype: mimetype,
      },
      language,
      metadata,
      model,
    },
    { jobId: taskId }
  );
}
