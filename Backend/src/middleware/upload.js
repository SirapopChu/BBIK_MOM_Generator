import multer from 'multer';

const MB = 1024 * 1024;

/**
 * Factory that returns a multer instance scoped to memory storage.
 * Centralises the upload limit definition — previously duplicated across
 * transcribe.routes.js and minutes.routes.js.
 *
 * @param {number} limitMB - Maximum file size in megabytes (default 50).
 */
export const createUpload = (limitMB = 50) =>
    multer({
        storage: multer.memoryStorage(),
        limits:  { fileSize: limitMB * MB },
    });

// Default shared instance used by all audio routes.
export const upload = createUpload(50);
