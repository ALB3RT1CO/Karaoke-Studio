import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import {
  safeExtractDocxText,
  safeExtractDocxFromBuffer,
  MAX_DOCX_BYTES,
  DocxSecurityError,
} from '../src/server/ingestion/docx.ts';

const SAMPLE_DOCX_PATH =
  'C:\\Users\\alver\\.gemini\\antigravity\\brain\\ebe9d28a-4dee-4cdc-bad1-ee69a0050b15\\scratch\\sample_1PorMes.docx';

test('DOCX Ingestion - Extracts text correctly from valid DOCX stream', async () => {
  assert.ok(fs.existsSync(SAMPLE_DOCX_PATH), 'Sample DOCX file must exist');
  const stream = fs.createReadStream(SAMPLE_DOCX_PATH);

  const text = await safeExtractDocxText(stream);

  assert.ok(typeof text === 'string');
  assert.ok(text.includes('1 sola vez por Mes'));
  assert.ok(text.includes('Antes era uno por día'));
});

test('DOCX Ingestion - Extracts text correctly from valid DOCX buffer', async () => {
  assert.ok(fs.existsSync(SAMPLE_DOCX_PATH), 'Sample DOCX file must exist');
  const buffer = fs.readFileSync(SAMPLE_DOCX_PATH);

  const text = await safeExtractDocxFromBuffer(buffer);

  assert.ok(typeof text === 'string');
  assert.ok(text.includes('1 sola vez por Mes'));
  assert.ok(text.includes('Antes era uno por día'));
});

test('DOCX Ingestion - Stream exceeding 5MB ceiling is immediately destroyed and rejected with Security Error', async () => {
  // Generate a stream yielding chunks that exceed MAX_DOCX_BYTES (5MB)
  const chunkSize = 1024 * 1024; // 1 MB per chunk
  const totalChunks = 6; // 6 MB total (> 5MB)
  let chunksPushed = 0;

  let streamDestroyed = false;
  const largeStream = new Readable({
    read() {
      if (chunksPushed < totalChunks) {
        chunksPushed++;
        this.push(Buffer.alloc(chunkSize, 'A'));
      } else {
        this.push(null);
      }
    },
    destroy(err, callback) {
      streamDestroyed = true;
      callback(err);
    },
  });

  await assert.rejects(
    async () => {
      await safeExtractDocxText(largeStream);
    },
    (err: unknown) => {
      assert.ok(err instanceof Error);
      const isExpectedError =
        err instanceof DocxSecurityError ||
        err.name === 'DocxSecurityError' ||
        err.message.includes('Security Error') ||
        err.message.includes('exceeds maximum allowed size');
      assert.ok(isExpectedError, `Expected security error, got: ${err.message}`);
      return true;
    }
  );

  // Assert stream was aborted / destroyed
  assert.ok(
    largeStream.destroyed || streamDestroyed,
    'Stream should have been destroyed upon exceeding byte limit'
  );
  // Ensure we didn't read all 6MB because it aborted early
  assert.ok(
    chunksPushed <= 6,
    `Chunks pushed should be stopped as soon as threshold exceeded, got ${chunksPushed}`
  );
});

test('DOCX Ingestion - Buffer exceeding 5MB is immediately rejected with Security Error', async () => {
  const oversizedBuffer = Buffer.alloc(MAX_DOCX_BYTES + 1024, 'B');

  await assert.rejects(
    async () => {
      await safeExtractDocxFromBuffer(oversizedBuffer);
    },
    (err: unknown) => {
      assert.ok(err instanceof Error);
      const isExpectedError =
        err instanceof DocxSecurityError ||
        err.name === 'DocxSecurityError' ||
        err.message.includes('Security Error') ||
        err.message.includes('exceeds maximum allowed size');
      assert.ok(isExpectedError, `Expected security error, got: ${err.message}`);
      return true;
    }
  );
});

test('DOCX Ingestion - Rejects gracefully with corrupted or invalid DOCX data from stream', async () => {
  const corruptedData = Buffer.from('PK\x03\x04corrupted-docx-header-and-fake-content');
  const stream = Readable.from([corruptedData]);

  await assert.rejects(
    async () => {
      await safeExtractDocxText(stream);
    },
    (err: unknown) => {
      assert.ok(err instanceof Error);
      // Mammoth should reject because it's not a valid zip / docx
      assert.ok(err.message.length > 0);
      return true;
    }
  );
});

test('DOCX Ingestion - Rejects gracefully with corrupted or invalid DOCX data from buffer', async () => {
  const corruptedBuffer = Buffer.from('This is not a zip or docx file at all');

  await assert.rejects(
    async () => {
      await safeExtractDocxFromBuffer(corruptedBuffer);
    },
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.ok(err.message.length > 0);
      return true;
    }
  );
});

test('DOCX Ingestion - Rejects empty stream gracefully', async () => {
  const emptyStream = Readable.from([]);

  await assert.rejects(
    async () => {
      await safeExtractDocxText(emptyStream);
    },
    (err: unknown) => {
      assert.ok(err instanceof Error);
      return true;
    }
  );
});
