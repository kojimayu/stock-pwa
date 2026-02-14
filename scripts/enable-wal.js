const Database = require('better-sqlite3');
const db = new Database('prisma/dev.db');
db.pragma('journal_mode = WAL');
console.log('WAL mode enabled');
const mode = db.pragma('journal_mode', { simple: true });
console.log(`Current mode: ${mode}`);
