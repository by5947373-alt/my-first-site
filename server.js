// Minimal zero-dependency guestbook server: static hosting + SQLite-backed API.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8080;

// DB lives in a dedicated dir so it can be mounted to a persistent volume.
const DB_DIR = process.env.DB_DIR || join(__dirname, 'data');
mkdirSync(DB_DIR, { recursive: true });
const db = new DatabaseSync(join(DB_DIR, 'guestbook.db'));
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    message    TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

const listStmt = db.prepare(
  'SELECT id, name, message, created_at FROM messages ORDER BY id DESC LIMIT 200'
);
const insertStmt = db.prepare(
  'INSERT INTO messages (name, message) VALUES (?, ?)'
);

const NAME_MAX = 40;
const MSG_MAX = 280;

function sendJSON(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readBody(req, limit = 10_000) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('payload too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function serveIndex(res) {
  try {
    const data = await readFile(join(__dirname, 'index.html'));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  // --- API ---
  if (path === '/api/messages' && req.method === 'GET') {
    return sendJSON(res, 200, { messages: listStmt.all() });
  }

  if (path === '/api/messages' && req.method === 'POST') {
    let payload;
    try {
      payload = JSON.parse(await readBody(req));
    } catch {
      return sendJSON(res, 400, { error: '格式錯誤' });
    }
    const name = String(payload?.name ?? '').trim();
    const message = String(payload?.message ?? '').trim();
    if (!name || !message) {
      return sendJSON(res, 400, { error: '名字和留言都要填喔' });
    }
    if (name.length > NAME_MAX || message.length > MSG_MAX) {
      return sendJSON(res, 400, { error: '字數超過上限了' });
    }
    const info = insertStmt.run(name, message);
    const row = db
      .prepare('SELECT id, name, message, created_at FROM messages WHERE id = ?')
      .get(info.lastInsertRowid);
    return sendJSON(res, 201, { message: row });
  }

  // --- Static ---
  if (path === '/' || path === '/index.html') {
    return serveIndex(res);
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`Guestbook server listening on :${PORT} (db: ${DB_DIR})`);
});
