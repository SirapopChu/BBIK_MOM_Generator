import { describe, it, expect } from 'vitest';

// Helper functions copied from minutes.routes.js for testing purposes
// because they are not exported from the module.

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


describe('Minutes Route Helpers', () => {

    describe('parseMetadata', () => {
        it('should correctly parse a valid JSON string', () => {
            const jsonString = '{"key": "value", "num": 123}';
            expect(parseMetadata(jsonString)).toEqual({ key: 'value', num: 123 });
        });

        it('should return null for an invalid JSON string', () => {
            const invalidJson = '{"key": "value",';
            expect(parseMetadata(invalidJson)).toBeNull();
        });

        it('should return null for a non-string input that is not valid JSON', () => {
            const notJson = 'just a string';
            expect(parseMetadata(notJson)).toBeNull();
        });

        it('should return null for a null input', () => {
            expect(parseMetadata(null)).toBeNull();
        });

        it('should return null for an undefined input', () => {
            expect(parseMetadata(undefined)).toBeNull();
        });
    });

    describe('resolveFilenames', () => {
        it('should use metadata title for filenames and replace spaces', () => {
            const base = 'default-name';
            const meta = { title: 'My Meeting Report' };
            const { docName, outputName } = resolveFilenames(base, meta);
            expect(docName).toBe('My_Meeting_Report');
            expect(outputName).toBe('My_Meeting_Report_meeting_minutes.docx');
        });

        it('should use the base name if metadata is null', () => {
            const base = 'base-file-name';
            const { docName, outputName } = resolveFilenames(base, null);
            expect(docName).toBe('base-file-name');
            expect(outputName).toBe('base-file-name_meeting_minutes.docx');
        });

        it('should use the base name if metadata exists but has no title', () => {
            const base = 'another-base-name';
            const meta = { attendees: ['Alice', 'Bob'] };
            const { docName, outputName } = resolveFilenames(base, meta);
            expect(docName).toBe('another-base-name');
            expect(outputName).toBe('another-base-name_meeting_minutes.docx');
        });

        it('should handle special characters in base name', () => {
            const base = 'file/with\\special$chars';
            const { docName, outputName } = resolveFilenames(base, null);
            expect(docName).toBe('file/with\\special$chars');
            expect(outputName).toBe('file/with\\special$chars_meeting_minutes.docx');
        });
    });
});
