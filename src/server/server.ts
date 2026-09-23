import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {
  initStore,
  getAllSongs,
  getSong,
  upsertSong,
  type SongKaraokeTrack,
} from './store.ts';

const PORT = parseInt(process.env.PORT || '3030', 10);
const PUBLIC_DIR = path.resolve(process.cwd(), 'public');

// Initialize the In-Memory Store
initStore();

// Load Verified Catalog from data/catalog.json
function seedInitialSongsIfEmpty() {
  const catalogPath = path.resolve(process.cwd(), 'data', 'catalog.json');
  if (!fs.existsSync(catalogPath)) return;

  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  console.log(`[Server] Loading ${catalog.length} verified songs from catalog.json...`);

  for (const item of catalog) {
    const existing = getSong(item.id);
    if (!existing) {
      const newTrack: SongKaraokeTrack = {
        id: item.id,
        title: `${item.cleanTitle} - ${item.artist}`,
        driveMd5Checksum: item.driveFile,
        youtubeVideoId: item.youtubeVideoId,
        lines: [
          {
            lineIndex: 0,
            start: 5.0,
            end: 12.0,
            chord: 'Rem',
            words: [
              { text: item.cleanTitle.split(' ')[0] || 'Canto', start: 5.0, end: 7.0 },
              { text: '...', start: 7.0, end: 12.0 }
            ]
          }
        ]
      };
      upsertSong(newTrack);
    } else {
      // Ensure verified YouTube ID and artist are attached
      existing.title = `${item.cleanTitle} - ${item.artist}`;
      existing.youtubeVideoId = item.youtubeVideoId;
      upsertSong(existing);
    }
  }
}

seedInitialSongsIfEmpty();

// MIME Types map
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API: GET /api/songs
  if (req.method === 'GET' && pathname === '/api/songs') {
    const songs = getAllSongs();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(songs));
    return;
  }

  // API: GET /api/songs/:id
  if (req.method === 'GET' && pathname.startsWith('/api/songs/')) {
    const id = pathname.replace('/api/songs/', '');
    const song = getSong(id);
    if (!song) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Song not found' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(song));
    return;
  }

  // API: POST /api/songs/:id/youtube (Update YouTube link)
  if (req.method === 'POST' && pathname.match(/^\/api\/songs\/([^/]+)\/youtube$/)) {
    const id = pathname.split('/')[3];
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const song = getSong(id);
        if (!song) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Song not found' }));
          return;
        }

        // Clean videoId from URL if full URL is supplied
        let videoId = payload.videoId?.trim() || '';
        const match = videoId.match(/(?:youtu\.be\/|v=|\/embed\/|\/watch\?v=|\/v\/)([^&#?]+)/);
        if (match) {
          videoId = match[1];
        }

        song.youtubeVideoId = videoId;
        upsertSong(song);

        console.log(`[Server] Updated YouTube video ID for "${song.title}" to: ${videoId}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, song }));
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // API: POST /api/songs/:id/timestamps
  if (req.method === 'POST' && pathname.match(/^\/api\/songs\/([^/]+)\/timestamps$/)) {
    const id = pathname.split('/')[3];
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const song = getSong(id);
        if (!song) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Song not found' }));
          return;
        }

        song.lines = payload.lines || song.lines;
        upsertSong(song);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, song }));
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Serve static files from public/
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(PUBLIC_DIR, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('500 Internal Server Error');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🎤 Karaoke Studio Web App running at:`);
  console.log(`👉 http://localhost:${PORT}`);
  console.log(`====================================================`);
});
