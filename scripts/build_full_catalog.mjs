import fs from 'node:fs';
import path from 'node:path';
import mammoth from 'mammoth';

const BACKUP_DIR = 'P:\\Backups\\Karaoke\\MisLetrasCancionesEspañol';
const OUT_MD = path.resolve(process.cwd(), 'docs', 'FULL_SONG_CATALOG.md');
const OUT_JSON = path.resolve(process.cwd(), 'data', 'full_catalog.json');

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

async function extractMetadata(filePath, filename) {
  if (!filename.toLowerCase().endsWith('.docx')) {
    return {
      filename,
      title: normalizeTitle(filename),
      author: 'Unknown',
      firstLyrics: '',
    };
  }

  try {
    const buffer = fs.readFileSync(filePath);
    const { value: rawText } = await mammoth.extractRawText({ buffer });
    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

    let title = normalizeTitle(filename);
    let author = 'Traditional / Unknown';
    let firstLyrics = '';

    for (let i = 0; i < Math.min(lines.length, 10); i++) {
      const line = lines[i];

      // Check author/interpreter patterns
      const authorMatch = line.match(/(?:Autor|Compositor|Letra|Música|Intérprete|Canta|Por|De)\s*[:\-–]\s*(.+)/i);
      if (authorMatch) {
        author = authorMatch[1].trim();
        continue;
      }

      // Check if line is artist name directly under title (like Soda Stereo, Simón Díaz, Jesús Bonilla)
      if (i === 1 && !line.toLowerCase().includes('intro') && !line.includes('-') && line.length < 40 && !authorMatch) {
        author = line;
        continue;
      }

      // First lyrical line (non-chord, non-intro)
      if (!firstLyrics && !line.toLowerCase().startsWith('intro') && !line.includes('rem') && !line.includes('DoM') && line.length > 15) {
        firstLyrics = line;
      }
    }

    return {
      filename,
      title,
      author,
      firstLyrics,
    };
  } catch (err) {
    return {
      filename,
      title: normalizeTitle(filename),
      author: 'Error Reading',
      firstLyrics: '',
    };
  }
}

async function run() {
  console.log(`[Catalog] Scanning ${BACKUP_DIR}...`);
  const allFiles = fs.readdirSync(BACKUP_DIR);

  const songFiles = allFiles.filter(f => {
    const lower = f.toLowerCase();
    return (lower.endsWith('.docx') || lower.endsWith('.rtf')) &&
      !lower.includes('repertorio') &&
      !lower.includes('listado') &&
      !lower.includes('letras.docx') &&
      !lower.includes('todasmisletrs');
  });

  console.log(`[Catalog] Found ${songFiles.length} song documents. Extracting metadata...`);

  const catalogMap = new Map();

  for (const filename of songFiles) {
    const fullPath = path.join(BACKUP_DIR, filename);
    const meta = await extractMetadata(fullPath, filename);

    const normKey = meta.title.toLowerCase().replace(/[^a-z0-9]/g, '');

    if (!catalogMap.has(normKey)) {
      catalogMap.set(normKey, {
        id: normKey,
        cleanTitle: meta.title,
        author: meta.author,
        files: [filename],
        firstLyrics: meta.firstLyrics,
      });
    } else {
      const existing = catalogMap.get(normKey);
      existing.files.push(filename);
      if (existing.author === 'Traditional / Unknown' && meta.author !== 'Traditional / Unknown') {
        existing.author = meta.author;
      }
      if (!existing.firstLyrics && meta.firstLyrics) {
        existing.firstLyrics = meta.firstLyrics;
      }
    }
  }

  const uniqueSongs = Array.from(catalogMap.values()).sort((a, b) => a.cleanTitle.localeCompare(b.cleanTitle));
  console.log(`[Catalog] Deduplicated to ${uniqueSongs.length} unique songs.`);

  // Write JSON
  fs.writeFileSync(OUT_JSON, JSON.stringify(uniqueSongs, null, 2), 'utf8');
  console.log(`[Catalog] Wrote ${OUT_JSON}`);

  // Write Markdown Table
  let md = `# Comprehensive Song Catalog & Mapping Table\n\n`;
  md += `**Total Unique Songs**: ${uniqueSongs.length} (deduplicated from ${songFiles.length} files in \`MisLetrasCancionesEspañol\`)\n\n`;
  md += `| # | Song Title | Detected Author / Artist | Key / Capo Variants in Drive | First Lyric Snippet |\n`;
  md += `| :-: | :--- | :--- | :--- | :--- |\n`;

  uniqueSongs.forEach((s, idx) => {
    const fileVariants = s.files.map(f => `\`${f}\``).join(', ');
    const authorClean = s.author.replace(/\|/g, '/');
    const lyricClean = s.firstLyrics.replace(/\|/g, '/').substring(0, 50);
    md += `| **${idx + 1}** | **${s.cleanTitle}** | ${authorClean} | ${fileVariants} | *"${lyricClean}..."* |\n`;
  });

  fs.writeFileSync(OUT_MD, md, 'utf8');
  console.log(`[Catalog] Wrote ${OUT_MD}`);
}

run();
