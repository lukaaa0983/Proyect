import { DatabaseSync } from "node:sqlite"
import fs from "fs"
import path from "path"
import crypto from "crypto"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR  = path.join(__dirname, "data")
export const MEDIA_DIR = path.join(DATA_DIR, "media")
fs.mkdirSync(MEDIA_DIR, { recursive: true })

const db = new DatabaseSync(path.join(DATA_DIR, "chat.db"))
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS chats (
    id   TEXT PRIMARY KEY,
    name TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS messages (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id   TEXT NOT NULL,
    wa_id     TEXT,
    timestamp INTEGER NOT NULL,
    data      TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_msg_chat ON messages (chat_id, id);
  CREATE INDEX IF NOT EXISTS idx_msg_wa   ON messages (chat_id, wa_id);
`)

const q = {
  getChat:   db.prepare("SELECT name FROM chats WHERE id = ?"),
  addChat:   db.prepare("INSERT OR IGNORE INTO chats (id, name) VALUES (?, ?)"),
  setName:   db.prepare("UPDATE chats SET name = ? WHERE id = ?"),
  addMsg:    db.prepare("INSERT INTO messages (chat_id, wa_id, timestamp, data) VALUES (?, ?, ?, ?)"),
  lastMsgs:  db.prepare("SELECT data FROM messages WHERE chat_id = ? ORDER BY timestamp DESC, id DESC LIMIT ?"),
  allChats:  db.prepare("SELECT id, name FROM chats"),
  findWa:    db.prepare("SELECT id, data FROM messages WHERE chat_id = ? AND wa_id = ?"),
  updMsg:    db.prepare("UPDATE messages SET data = ? WHERE id = ?"),
  count:     db.prepare("SELECT COUNT(*) AS n FROM chats"),
  countMsgs: db.prepare("SELECT COUNT(*) AS n FROM messages")
}

export const countChats    = () => q.count.get().n
export const countMessages = () => q.countMsgs.get().n

// Guarda un mensaje y devuelve el nombre actual del chat
export function saveMessage(chatId, name, msg) {
  q.addChat.run(chatId, name || chatId)
  if (name && name !== chatId) q.setName.run(name, chatId)
  q.addMsg.run(chatId, msg.waMessageKey?.id || null, msg.timestamp || Date.now(), JSON.stringify(msg))
  return q.getChat.get(chatId).name
}

// Misma forma que antes: { [id]: { name, messages: [ultimoMensaje] } }
export function getChats() {
  const out = {}
  for (const c of q.allChats.all()) {
    const last = q.lastMsgs.get(c.id, 1)
    out[c.id] = { name: c.name, messages: last ? [JSON.parse(last.data)] : [] }
  }
  return out
}

export function getChat(chatId, limit = 500) {
  const row = q.getChat.get(chatId)
  const rows = q.lastMsgs.all(chatId, limit).reverse()
  return { name: row?.name || chatId, messages: rows.map(r => JSON.parse(r.data)) }
}

export function markRevoked(chatId, waId) {
  let found = false
  for (const r of q.findWa.all(chatId, waId)) {
    const m = JSON.parse(r.data)
    m.revoked = true
    m.originalContent = m.content
    q.updMsg.run(JSON.stringify(m), r.id)
    found = true
  }
  return found
}

const EXT = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "video/mp4": "mp4", "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a",
  "application/pdf": "pdf"
}

// data:...;base64,XXXX  ->  /media/<hash>.<ext>  (otros valores se devuelven igual)
export function saveMedia(url) {
  if (!url || !url.startsWith("data:")) return url || null
  const m = url.match(/^data:([^;,]+)[^,]*;base64,(.*)$/s)
  if (!m) return null
  const buf  = Buffer.from(m[2], "base64")
  const mime = m[1].toLowerCase()
  const ext  = EXT[mime] || mime.split("/")[1]?.replace(/[^a-z0-9]/g, "") || "bin"
  const name = crypto.createHash("sha1").update(buf).digest("hex") + "." + ext
  const file = path.join(MEDIA_DIR, name)
  if (!fs.existsSync(file)) fs.writeFileSync(file, buf)
  return "/media/" + name
}

export function clearChat(chatId) { db.prepare("DELETE FROM messages WHERE chat_id = ?").run(chatId) }

export function updateMessage(chatId, waId, fn) {
  let last = null
  for (const r of q.findWa.all(chatId, waId)) {
    const m = JSON.parse(r.data)
    fn(m)
    q.updMsg.run(JSON.stringify(m), r.id)
    last = m
  }
  return last
}

export function deleteMessage(chatId, waId) {
  db.prepare("DELETE FROM messages WHERE chat_id = ? AND wa_id = ?").run(chatId, waId)
}

export function setKey(chatId, timestamp, key) {
  const row = db.prepare("SELECT id, data FROM messages WHERE chat_id = ? AND timestamp = ? AND wa_id IS NULL ORDER BY id DESC LIMIT 1").get(chatId, timestamp)
  if (!row) return null
  const m = JSON.parse(row.data)
  m.waMessageKey = key
  db.prepare("UPDATE messages SET wa_id = ?, data = ? WHERE id = ?").run(key.id, JSON.stringify(m), row.id)
  return m
}

export function mediaStats(chatId) {
  const names = new Set()
  for (const r of db.prepare("SELECT data FROM messages WHERE chat_id = ?").all(chatId)) {
    const u = JSON.parse(r.data).mediaUrl
    if (u && u.startsWith("/media/")) names.add(path.basename(u))
  }
  let bytes = 0
  for (const n of names) { try { bytes += fs.statSync(path.join(MEDIA_DIR, n)).size } catch {} }
  return { files: names.size, bytes }
}

export function purgeMedia(chatId) {
  const mine = new Set(), others = new Set()
  for (const r of db.prepare("SELECT chat_id, data FROM messages").all()) {
    const u = JSON.parse(r.data).mediaUrl
    if (!u || !u.startsWith("/media/")) continue
    ;(r.chat_id === chatId ? mine : others).add(path.basename(u))
  }
  let freed = 0
  for (const n of mine) {
    if (others.has(n)) continue
    try { const f = path.join(MEDIA_DIR, n); freed += fs.statSync(f).size; fs.unlinkSync(f) } catch {}
  }
  for (const r of db.prepare("SELECT id, data FROM messages WHERE chat_id = ?").all(chatId)) {
    const m = JSON.parse(r.data)
    if (m.mediaUrl && m.mediaUrl.startsWith("/media/")) { m.mediaUrl = null; m.mediaRemoved = true; q.updMsg.run(JSON.stringify(m), r.id) }
  }
  return { freed }
}

export function findByWaIds(ids) {
  if (!ids.length) return []
  const rows = db.prepare("SELECT chat_id, data FROM messages WHERE wa_id IN (" + ids.map(() => "?").join(",") + ") ORDER BY timestamp DESC").all(...ids)
  return rows.map(r => ({ chatId: r.chat_id, name: q.getChat.get(r.chat_id)?.name || r.chat_id, msg: JSON.parse(r.data) }))
}

export function purgeEmpty(dry = false) {
  let n = 0
  for (const r of db.prepare("SELECT id, data FROM messages").all()) {
    const m = JSON.parse(r.data)
    if (!m.content && !m.mediaUrl && !m.mediaRemoved && !m.revoked && !m.reactions && (m.type === "text" || !m.type)) {
      if (!dry) db.prepare("DELETE FROM messages WHERE id = ?").run(r.id)
      n++
    }
  }
  return n
}

export function hasMessage(chatId, waId) {
  return !!db.prepare("SELECT 1 AS x FROM messages WHERE chat_id = ? AND wa_id = ? LIMIT 1").get(chatId, waId)
}

export function transaction(fn) {
  db.exec("BEGIN")
  try { fn(); db.exec("COMMIT") } catch (e) { db.exec("ROLLBACK"); throw e }
}
