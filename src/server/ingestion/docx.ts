import { Readable } from 'node:stream';
import mammoth from 'mammoth';

/**
 * Maximum allowed size for DOCX files (5 MB ceiling for lyric documents).
 * Prevents decompression bomb attacks and excessive memory usage.
 */
export const MAX_DOCX_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Custom error thrown when DOCX processing violates security constraints.
 */
export class DocxSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocxSecurityError';
  }
}

/**
 * Safely extracts raw text from a DOCX buffer in-memory.
 * Immune to Zip Slip attacks (no files written to disk) and enforces size ceiling.
 *
 * @param buffer In-memory Buffer containing DOCX zip contents
 * @returns Promise resolving to extracted raw text string
 */
export async function safeExtractDocxFromBuffer(buffer: Buffer): Promise<string> {
  if (!buffer || buffer.length === 0) {
    throw new Error('Invalid DOCX data: Buffer is empty');
  }

  if (buffer.length > MAX_DOCX_BYTES) {
    throw new DocxSecurityError(
      `Security Error: File size (${buffer.length} bytes) exceeds maximum allowed size of ${MAX_DOCX_BYTES} bytes (5MB)`
    );
  }

  // Mammoth handles XML parsing in-memory (XXE-safe, no disk extraction)
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

/**
 * Safely extracts raw text from a Readable stream containing DOCX data.
 * Counts bytes as chunks arrive and immediately destroys the stream if
 * MAX_DOCX_BYTES is exceeded, preventing Decompression Bomb / DoS attacks.
 *
 * @param stream Node.js Readable stream
 * @returns Promise resolving to extracted raw text string
 */
export async function safeExtractDocxText(stream: Readable): Promise<string> {
  if (!stream) {
    throw new Error('Invalid argument: stream is required');
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;

  try {
    for await (const chunk of stream) {
      const bufChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += bufChunk.length;

      if (totalBytes > MAX_DOCX_BYTES) {
        const securityError = new DocxSecurityError(
          `Security Error: Stream byte count (${totalBytes}) exceeds maximum allowed size of ${MAX_DOCX_BYTES} bytes (5MB)`
        );
        stream.destroy(securityError);
        throw securityError;
      }

      chunks.push(bufChunk);
    }
  } catch (err) {
    if (stream && !stream.destroyed) {
      stream.destroy();
    }
    throw err;
  }

  if (chunks.length === 0 || totalBytes === 0) {
    throw new Error('Invalid DOCX data: Stream is empty');
  }

  const fullBuffer = Buffer.concat(chunks, totalBytes);
  return safeExtractDocxFromBuffer(fullBuffer);
}
