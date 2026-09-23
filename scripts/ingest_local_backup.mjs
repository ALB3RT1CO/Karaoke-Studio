import fs from 'node:fs';
import path from 'node:path';
import mammoth from 'mammoth';

const BACKUP_DIR = 'P:\\Backups\\Karaoke\\MisLetrasCancionesEspañol';
const DATA_JSONL = path.resolve(process.cwd(), 'data.jsonl');
const CATALOG_JSON = path.resolve(process.cwd(), 'data', 'catalog.json');
const MASTER_MD = path.resolve(process.cwd(), 'docs', 'SONG_CATALOG_MASTER.md');

// Load verified catalog
const verifiedCatalog = fs.existsSync(CATALOG_JSON) ? JSON.parse(fs.readFileSync(CATALOG_JSON, 'utf8')) : [];
const verifiedMap = new Map();
verifiedCatalog.forEach(c => {
  const key = c.cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
  verifiedMap.set(key, c);
});

// Helper to normalize title
function normalizeTitle(rawName) {
  return rawName
    .replace(/\.(docx|rtf|txt|gdoc)$/i, '')
    .replace(/[-–]\s*(rem|dom|sim|mim|lam|fam|solm|reM|doM|siM|miM|laM|faM|solM|capo[^\s]*|facil|acorde.*)/gi, '')
    .replace(/\([^)]+\)/g, '')
    .replace(/\[\d+\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Extract chord tag from line if present
function extractChordTag(lineText) {
  const match = lineText.match(/\b(Rem|Solm|La7|Sim|Mim|Fa#7|DoM|Sol7|Lam|FaM|MiM|ReM|Si7|Re7|Sib7)\b/i);
  return match ? match[1] : undefined;
}

// Convert raw text into structured LyricLine[]
function parseTextToLyricLines(rawText) {
  const rawLines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const lines = [];

  // Skip header lines (intro, title, author)
  let startIndex = 0;
  for (let i = 0; i < Math.min(rawLines.length, 5); i++) {
    const l = rawLines[i].toLowerCase();
    if (l.includes('autor:') || l.includes('intérprete') || l.includes('intro:') || l.includes('ritmo:')) {
      startIndex = i + 1;
    }
  }

  const lyricLines = rawLines.slice(startIndex).filter(l => !l.toLowerCase().startsWith('intro'));

  let currentTime = 10.0; // Start at 10s default intro

  lyricLines.forEach((textLine, lIdx) => {
    const chord = extractChordTag(textLine);
    const cleanWords = textLine
      .replace(/\b(rem|solm|la7|sim|mim|fa#7|dom|sol7|lam|fam|mim|rem|si7|re7|sib7)\b/gi, '')
      .split(/\s+/)
      .filter(w => w.length > 0);

    if (cleanWords.length === 0) return;

    const lineStart = currentTime;
    const words = cleanWords.map((w, wIdx) => {
      const wStart = parseFloat(currentTime.toFixed(2));
      const wDuration = Math.min(Math.max(w.length * 0.12, 0.3), 0.8);
      const wEnd = parseFloat((wStart + wDuration).toFixed(2));
      currentTime = wEnd + 0.1;
      return {
        text: w,
        start: wStart,
        end: wEnd,
      };
    });

    const lineEnd = words[words.length - 1].end;
    currentTime = lineEnd + 1.5; // Gap between lines

    lines.push({
      lineIndex: lines.length,
      start: lineStart,
      end: lineEnd,
      chord: chord || undefined,
      words,
    });
  });

  return lines;
}

async function run() {
  console.log('[Ingest] Reading files from P:\\Backups\\Karaoke\\MisLetrasCancionesEspañol...');
  const files = fs.readdirSync(BACKUP_DIR).filter(f => {
    const l = f.toLowerCase();
    return (l.endsWith('.docx') || l.endsWith('.rtf')) &&
      !l.includes('repertorio') &&
      !l.includes('listado') &&
      !l.includes('letras.docx') &&
      !l.includes('todasmisletrs');
  });

  console.log(`[Ingest] Processing ${files.length} document files...`);

  const processedSongs = new Map();
  const allSongRecords = [];

  for (const file of files) {
    const fullPath = path.join(BACKUP_DIR, file);
    const cleanTitle = normalizeTitle(file);
    const key = cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Deduplicate if already processed
    if (processedSongs.has(key)) {
      const existing = processedSongs.get(key);
      existing.variants.push(file);
      continue;
    }

    let rawText = '';
    let author = 'Traditional / Unknown';

    if (file.toLowerCase().endsWith('.docx')) {
      try {
        const buffer = fs.readFileSync(fullPath);
        const res = await mammoth.extractRawText({ buffer });
        rawText = res.value;

        // Detect author from text
        const firstLines = rawText.split(/\r?\n/).slice(0, 8);
        for (let i = 0; i < firstLines.length; i++) {
          const l = firstLines[i].trim();
          const match = l.match(/(?:Autor|Compositor|Letra|Intérprete|De)\s*[:\-–]\s*(.+)/i);
          if (match) {
            author = match[1].trim();
            break;
          }
          if (i === 1 && l.length < 35 && !l.toLowerCase().includes('intro') && !l.includes('-')) {
            author = l;
          }
        }
      } catch (err) {
        console.warn(`[Ingest] Warning: Could not parse ${file}: ${err.message}`);
      }
    } else {
      // RTF fallback
      try {
        rawText = fs.readFileSync(fullPath, 'latin1');
      } catch (e) {}
    }

    // Check if we have verified metadata in catalog.json
    const verified = verifiedMap.get(key);
    let youtubeVideoId = verified ? verified.youtubeVideoId : undefined;
    if (verified && verified.artist) {
      author = verified.artist;
    }

    const lines = parseTextToLyricLines(rawText);

    const songRecord = {
      id: key || file.replace(/\.[^.]+$/, ''),
      cleanTitle,
      author,
      title: `${cleanTitle} - ${author}`,
      driveMd5Checksum: file,
      youtubeVideoId: youtubeVideoId || undefined,
      variants: [file],
      lines: lines.length > 0 ? lines : [
        {
          lineIndex: 0,
          start: 5.0,
          end: 10.0,
          chord: 'Rem',
          words: [{ text: cleanTitle, start: 5.0, end: 10.0 }]
        }
      ]
    };

    processedSongs.set(key, songRecord);
    allSongRecords.push(songRecord);
  }

  console.log(`[Ingest] Deduplicated into ${allSongRecords.length} unique songs.`);

  // Write new data.jsonl (purging old test placeholders)
  const logLines = allSongRecords.map(s => {
    const event = {
      type: 'UPSERT_SONG',
      payload: {
        id: s.id,
        title: s.title,
        driveMd5Checksum: s.driveMd5Checksum,
        youtubeVideoId: s.youtubeVideoId,
        lines: s.lines,
      },
      timestamp: new Date().toISOString(),
    };
    return JSON.stringify(event);
  });

  fs.writeFileSync(DATA_JSONL, logLines.join('\n') + '\n', 'utf8');
  console.log(`[Ingest] Wrote ${logLines.length} songs to ${DATA_JSONL}`);

  // Generate Master Markdown Table
  let md = `# Master Song Catalog & Verified YouTube Mapping\n\n`;
  md += `**Total Unique Songs Ingested**: ${allSongRecords.length} (from 383 files in \`P:\\Backups\\Karaoke\\MisLetrasCancionesEspañol\`)\n\n`;
  md += `| # | Song Title | Author / Artist | Key / Capo Variants | YouTube Video ID | YouTube Link |\n`;
  md += `| :-: | :--- | :--- | :--- | :---: | :---: |\n`;

  allSongRecords.sort((a, b) => a.cleanTitle.localeCompare(b.cleanTitle)).forEach((s, idx) => {
    const ytId = s.youtubeVideoId || '---';
    const ytLink = s.youtubeVideoId ? `[Watch Video](https://www.youtube.com/watch?v=${s.youtubeVideoId})` : 'Pending Mapping';
    const vars = s.variants.map(v => `\`${v}\``).join(', ');
    md += `| **${idx + 1}** | **${s.cleanTitle}** | ${s.author} | ${vars} | \`${ytId}\` | ${ytLink} |\n`;
  });

  fs.writeFileSync(MASTER_MD, md, 'utf8');
  console.log(`[Ingest] Wrote master catalog document to ${MASTER_MD}`);
}

run();
