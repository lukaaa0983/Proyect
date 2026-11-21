import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import * as db from "./db.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const JSON_PATH = path.join(__dirname, "data/chats.json")

if (!fs.existsSync(JSON_PATH)) { console.log("No hay chats.json, nada que migrar"); process.exit(0) }
if (db.countMessages() > 0)    { console.log("La base ya tiene mensajes, migración cancelada"); process.exit(1) }

const chats = JSON.parse(fs.readFileSync(JSON_PATH, "utf8"))
let total = 0

db.transaction(() => {
  for (const [chatId, chat] of Object.entries(chats)) {
    for (const m of chat.messages || []) {
      const msg = {
        ...m,
        type:     m.type || "text",
        content:  m.content || m.text || "",
        mediaUrl: db.saveMedia(m.mediaUrl)
      }
      delete msg.text
      db.saveMessage(chatId, chat.name, msg)
      total++
    }
  }
})

fs.renameSync(JSON_PATH, JSON_PATH + ".bak")
console.log(`✅ ${Object.keys(chats).length} chats y ${total} mensajes migrados`)
console.log("📦 Respaldo: data/chats.json.bak")
