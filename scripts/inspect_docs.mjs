import fs from 'node:fs';
import path from 'node:path';
import mammoth from 'mammoth';

const BACKUP_DIR = 'P:\\Backups\\Karaoke\\MisLetrasCancionesEspañol';

async function check(filename) {
  const p = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(p)) return;
  const buf = fs.readFileSync(p);
  const res = await mammoth.extractRawText({ buffer: buf });
  console.log(`\n================== [ ${filename} ] ==================`);
  const lines = res.value.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  console.log(lines.slice(0, 8).join('\n'));
}

async function run() {
  await check('1PorMes.docx');
  await check('Almohada.docx');
  await check('LunaLiberiana.docx');
  await check('Contigo.docx');
  await check('De Música Ligera.docx');
  await check('CañaDulce.docx');
  await check('Caballo Viejo.docx');
}

run();
