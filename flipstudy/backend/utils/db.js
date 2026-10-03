/* Tiny JSON-file database. Each file holds one object keyed by username.
   Writes go to a temp file first and are then renamed, so a crash
   mid-write cannot leave a half-written (corrupt) file behind. */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

function filePathFor(name){ return path.join(DATA_DIR, `${name}.json`); }

function readDB(name){
  const file = filePathFor(name);
  if (!fs.existsSync(file)) fs.writeFileSync(file, '{}');
  const raw = fs.readFileSync(file, 'utf8').trim();
  try { return raw ? JSON.parse(raw) : {}; }
  catch (e) { console.error(`[db] ${name}.json is unreadable:`, e.message); throw new Error('Database read failed'); }
}

function writeDB(name, data){
  const file = filePathFor(name);
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

module.exports = { readDB, writeDB };
