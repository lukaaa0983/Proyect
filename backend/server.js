import express from "express"
import { createServer } from "http"
import { Server } from "socket.io"
import cors from "cors"
import fs from "fs"
import { fileURLToPath } from "url"
import path from "path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const server = createServer(app)

const io = new Server(server, {
  cors: { origin: "*" }
})

global.io = io

// ========================
// 📦 CARGA DE CHATS
// ========================
const DATA_PATH = path.join(__dirname, "./data/chats.json")
const MAX_MESSAGES = 1000

let chats = {}

try {
  chats = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"))
} catch {
  chats = {}
}

function saveChats() {
  fs.writeFileSync(DATA_PATH, JSON.stringify(chats, null, 2))
}

app.use(cors())
app.use(express.json({ limit: "50mb" }))
app.use(express.urlencoded({ limit: "50mb", extended: true }))
app.use(express.static(path.join(__dirname, "public")))

// ========================
// 🤖 IMPORTAR BOT
// ========================
let botModule = null

async function loadBot() {
  try {
    botModule = await import("../bot/index.js")
    console.log("✅ Bot vinculado al servidor")
  } catch (e) {
    console.log("⚠️  Bot no disponible:", e.message)
    console.log("   El panel funcionará pero no enviará a WhatsApp real")
  }
}

// ========================
// 🔌 SOCKET.IO — ROOMS
// ========================
io.on("connection", (socket) => {
  console.log("Usuario conectado:", socket.id)

  socket.on("join_chat", (chatId) => {
    socket.join(chatId)
  })

  socket.on("send_message", async (data) => {
    const { chatId, content, senderName, replyTo } = data
    if (!chatId || !content) return

    const message = {
      type: "text",
      content,
      senderName: senderName || "Panel",
      senderId: "panel",
      fromMe: true,
      replyTo: replyTo || null,
      timestamp: Date.now()
    }

    if (!chats[chatId]) {
      chats[chatId] = { name: chatId, messages: [] }
    }
    chats[chatId].messages.push(message)
    if (chats[chatId].messages.length > MAX_MESSAGES) {
      chats[chatId].messages.shift()
    }
    saveChats()

    io.to(chatId).emit("receive_message", message)
    io.emit("chat_updated", {
      chatId,
      name: chats[chatId].name,
      lastMessage: message
    })

    // 📲 ENVIAR A WHATSAPP REAL
    try {
      if (botModule?.sendToWhatsApp) {
        await botModule.sendToWhatsApp(chatId, content, replyTo || null)
        console.log(`📤 Enviado a WhatsApp: [${chatId}] ${content}`)
      } else {
        console.log("⚠️  Bot no disponible, mensaje solo guardado en panel")
      }
    } catch (e) {
      console.log("❌ Error enviando a WhatsApp:", e.message)
    }
  })

  socket.on("disconnect", () => {
    console.log("Usuario desconectado:", socket.id)
  })
})

// ========================
// 💾 RECIBIR MENSAJE DEL BOT
// ========================
app.post("/message", (req, res) => {
  const {
    from, type, text, content, mediaUrl,
    fileName, pushName, senderName,
    senderId, isGroup, fromMe, waMessageKey
  } = req.body

  if (!from) return res.status(400).json({ error: "Falta 'from'" })

  const msgContent = content || text || ""

  if (!chats[from]) {
    chats[from] = { name: pushName || from, messages: [] }
  }

  if (pushName && pushName !== from) {
    chats[from].name = pushName
  }

  const message = {
    type:         type || "text",
    content:      msgContent,
    mediaUrl:     mediaUrl || null,
    fileName:     fileName || null,
    senderName:   senderName || pushName || "Desconocido",
    senderId:     senderId || from,
    fromMe:       fromMe || false,
    isGroup:      isGroup || false,
    waMessageKey: waMessageKey || null,
    timestamp:    Date.now()
  }

  chats[from].messages.push(message)
  if (chats[from].messages.length > MAX_MESSAGES) {
    chats[from].messages.shift()
  }
  saveChats()

  io.to(from).emit("receive_message", message)
  io.emit("chat_updated", {
    chatId: from,
    name: chats[from].name,
    lastMessage: message
  })

  res.json({ success: true })
})

// ========================
// 📥 ENDPOINTS
// ========================
app.get("/chats", (req, res) => res.json(chats))

app.get("/chat/:id", (req, res) => {
  const id = req.params.id
  res.json(chats[id] || { name: id, messages: [] })
})

app.get("/status", (req, res) => {
  res.json({
    status: "ok",
    chats: Object.keys(chats).length,
    bot: botModule?.getConn?.() ? "conectado" : "desconectado"
  })
})

// ========================
// 🚀 ARRANCAR
// ========================
server.listen(3000, async () => {
  console.log("✅ Servidor corriendo en http://localhost:3000")
  await loadBot()
})
