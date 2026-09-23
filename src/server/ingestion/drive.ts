import { Readable } from 'node:stream';
import { google, type drive_v3 } from 'googleapis';
import {
  Store,
  defaultStore,
  type SongKaraokeTrack,
  type LyricLine,
  type WordTiming,
} from '../store.ts';
import { safeExtractDocxText } from './docx.ts';

export interface DriveSongFile {
  id: string;
  name: string;
  mimeType: string;
  md5Checksum?: string;
  modifiedTime?: string;
  size?: string;
}

export interface SyncFolderOptions {
  store?: Store;
  driveClient?: any;
  force?: boolean;
}

export interface SyncResult {
  synced: SongKaraokeTrack[];
  skipped: string[];
  errors: Array<{ fileId: string; fileName: string; error: string }>;
}

/**
 * Creates Google Drive v3 client from Service Account JSON.
 * Looks for credentialsJson argument first, then process.env.GOOGLE_SERVICE_ACCOUNT_KEY.
 */
export function getDriveClient(credentialsJson?: string): drive_v3.Drive {
  const creds = credentialsJson || process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!creds) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not defined.');
  }

  const credentials = typeof creds === 'string' ? JSON.parse(creds) : creds;
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  return google.drive({ version: 'v3', auth });
}

/**
 * Strips file extensions and musical chord/key annotations from filenames
 * to create clean song titles suitable for display and YouTube search.
 */
export function cleanSongTitle(fileName: string): string {
  return fileName
    .replace(/\.(docx|rtf|txt|gdoc)$/i, '')
    // Remove musical chord/key annotations, e.g. - rem, - sim-Capo-1erTr, (sim)
    .replace(/[-–]\s*(rem|dom|sim|mim|lam|fam|solm|reM|doM|siM|miM|laM|faM|solM|capo[^\s]*)/gi, '')
    .replace(/\([^)]+\)/g, '')
    .trim();
}

/**
 * Parses raw text into an array of LyricLine objects with initial empty timings.
 */
export function parseRawTextToLines(rawText: string): LyricLine[] {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  return lines.map((lineText, index) => {
    const words: WordTiming[] = lineText
      .split(/\s+/)
      .filter((w) => w.length > 0)
      .map((word) => ({
        text: word,
        start: 0,
        end: 0,
      }));
    return {
      lineIndex: index,
      start: 0,
      end: 0,
      words,
    };
  });
}

/**
 * Helper to convert a readable text stream to a string.
 */
async function streamToString(stream: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * Lists all files in a Google Drive folder using strict fields mask and pagination.
 */
export async function listFolderFiles(
  folderId: string,
  driveClient?: any
): Promise<DriveSongFile[]> {
  const drive = driveClient || getDriveClient();
  const files: DriveSongFile[] = [];
  let pageToken: string | undefined = undefined;

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, md5Checksum, modifiedTime, size)',
      pageSize: 100,
      pageToken,
    });

    if (res.data?.files) {
      files.push(...(res.data.files as DriveSongFile[]));
    }
    pageToken = res.data?.nextPageToken || undefined;
  } while (pageToken);

  return files;
}

/**
 * Returns a readable stream for a Google Drive file.
 * Correctly routes Google Docs to export(text/plain) and binary files to get(alt: media).
 */
export async function getFileStream(
  fileId: string,
  mimeType: string,
  driveClient?: any
): Promise<Readable> {
  const drive = driveClient || getDriveClient();

  // Google Docs cannot use alt='media'
  if (mimeType === 'application/vnd.google-apps.document') {
    const res = await drive.files.export(
      { fileId, mimeType: 'text/plain' },
      { responseType: 'stream' }
    );
    return res.data;
  }

  // Binary files (.docx, .rtf, .zip) use alt='media'
  const res = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream' }
  );
  return res.data;
}

/**
 * Ingests a Google Drive folder:
 * - Lists files in the folder.
 * - Compares checksum with existing store songs (incremental sync).
 * - Downloads and extracts text via docx/export pipeline.
 * - Upserts songs into the store.
 */
export async function syncDriveFolder(
  folderId: string,
  options?: SyncFolderOptions
): Promise<SyncResult> {
  const store = options?.store || defaultStore;
  const drive = options?.driveClient || getDriveClient();
  const force = options?.force ?? false;

  const files = await listFolderFiles(folderId, drive);
  const synced: SongKaraokeTrack[] = [];
  const skipped: string[] = [];
  const errors: Array<{ fileId: string; fileName: string; error: string }> = [];

  for (const file of files) {
    const checksum = file.md5Checksum || file.modifiedTime || 'no-checksum';
    const existing = store.getSong(file.id);

    if (existing && !force && existing.driveMd5Checksum === checksum) {
      skipped.push(file.id);
      continue;
    }

    try {
      const stream = await getFileStream(file.id, file.mimeType, drive);
      let rawText = '';

      const isDocx =
        file.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.name.toLowerCase().endsWith('.docx');

      if (isDocx) {
        rawText = await safeExtractDocxText(stream);
      } else {
        rawText = await streamToString(stream);
      }

      const lines = parseRawTextToLines(rawText);
      const track: SongKaraokeTrack = {
        id: file.id,
        title: cleanSongTitle(file.name),
        driveMd5Checksum: checksum,
        youtubeVideoId: existing?.youtubeVideoId,
        lines,
      };

      store.upsertSong(track);
      synced.push(track);
    } catch (err: any) {
      errors.push({
        fileId: file.id,
        fileName: file.name,
        error: err?.message || String(err),
      });
    }
  }

  return { synced, skipped, errors };
}
