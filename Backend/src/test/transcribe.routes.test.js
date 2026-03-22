import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import transcribeRouter from '../routes/transcribe.routes.js';
import { transcribeAudio } from '../services/transcription.service.js';

// Mock the transcription service
vi.mock('../services/transcription.service.js', () => ({
    transcribeAudio: vi.fn(),
}));

// Set up express app
const app = express();
app.use(express.json());
app.use('/api/transcribe', transcribeRouter);

// Global error handler mock to test if next(err) is called
const errorHandler = vi.fn((err, req, res, next) => {
    res.status(500).json({ error: err.message });
});
app.use(errorHandler);


describe('Transcribe API Route', () => {

    beforeEach(() => {
        vi.resetAllMocks();
    });

    describe('POST /api/transcribe', () => {

        it('should return 400 if no audio file is provided', async () => {
            const response = await request(app)
                .post('/api/transcribe')
                .send({}); // No file attached

            expect(response.status).toBe(400);
            expect(response.body).toEqual({ error: 'Audio file is required. Send it as multipart field "audio".' });
        });

        it('should call transcribeAudio and return result on successful upload', async () => {
            const mockTranscription = {
                text: 'Hello world',
                language: 'en',
                duration: 1.23,
                segments: [],
            };
            transcribeAudio.mockResolvedValue(mockTranscription);

            const response = await request(app)
                .post('/api/transcribe')
                .field('language', 'en')
                .attach('audio', Buffer.from('fake-audio-data'), 'test.mp3');

            expect(response.status).toBe(200);
            expect(response.body).toEqual(mockTranscription);
            
            // Check if the service was called correctly
            expect(transcribeAudio).toHaveBeenCalledOnce();
            expect(transcribeAudio).toHaveBeenCalledWith(
                expect.any(Buffer), // buffer
                'audio/mpeg',      // mimeType
                'test.mp3',        // filename
                'en'               // language
            );
        });

        it('should handle service errors by passing them to the global error handler', async () => {
            const serviceError = new Error('Transcription service failed');
            transcribeAudio.mockRejectedValue(serviceError);

            const response = await request(app)
                .post('/api/transcribe')
                .attach('audio', Buffer.from('some-data'), 'error.wav');

            // Check that the global error handler was called
            expect(errorHandler).toHaveBeenCalledOnce();
            
            // Check the response sent by the mocked error handler
            expect(response.status).toBe(500);
            expect(response.body).toEqual({ error: 'Transcription service failed' });
        });

        it('should handle auto-language detection if language field is empty', async () => {
            transcribeAudio.mockResolvedValue({ text: 'Test' });

            await request(app)
                .post('/api/transcribe')
                .attach('audio', Buffer.from('fake-audio-data'), 'test.mp3');

            expect(transcribeAudio).toHaveBeenCalledWith(
                expect.any(Buffer),
                'audio/mpeg',
                'test.mp3',
                '' // Language should be an empty string for auto-detection
            );
        });
    });
});
