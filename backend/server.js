const express = require("express")
const http = require("http")
const { Server } = require("socket.io")
const cors = require("cors")
const fs = require("fs")

const app = express()
const server = http.createServer(app)

const io = new Server(server, {
  cors: { origin: "*" }
})

global.io = io

// ========================
// 📦 CARGA DE CHATS
// ========================
const DATA_PATH = "./data/chats.json"
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
app.use(express.json())
app.use(express.static("public"))

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html")
})

// ========================
// 🔌 SOCKET.IO — ROOMS
// ========================
io.on("connection", (socket) => {
  console.log("Usuario conectado:", socket.id)

  // El frontend se une al room de un chat específico
  socket.on("join_chat", (chatId) => {
    socket.join(chatId)
    console.log(`Socket ${socket.id} se unió al room: ${chatId}`)
  })

  // Mensaje enviado DESDE el panel web hacia WhatsApp
  socket.on("send_message", (data) => {
    const { chatId, content, senderName } = data

    if (!chatId || !content) return

    const message = {
      type: "text",
      content,
      senderName: senderName || "Panel",
      senderId: "panel",
      fromMe: true,
      timestamp: Date.now()
    }

    // Guardar en JSON
    if (!chats[chatId]) {
      chats[chatId] = { name: chatId, messages: [] }
    }

    chats[chatId].messages.push(message)
    if (chats[chatId].messages.length > MAX_MESSAGES) {
      chats[chatId].messages.shift()
    }
    saveChats()

    // Emitir solo al room de ese chat
    io.to(chatId).emit("receive_message", message)

    // Actualizar lista de chats en el index
    io.emit("chat_updated", {
      chatId,
      name: chats[chatId].name,
      lastMessage: message
    })
  })

  socket.on("disconnect", () => {
    console.log("Usuario desconectado:", socket.id)
  })
})

// ========================
// 💾 RECIBIR MENSAJE DEL BOT
// ========================
app.post("/message", (req, res) => {
  const { from, type, text, content, pushName, senderName, senderId, isGroup } = req.body

  if (!from) return res.status(400).json({ error: "Falta 'from'" })

  const msgContent = content || text || ""

  if (!chats[from]) {
    chats[from] = { name: pushName || from, messages: [] }
  }

  // Actualizar nombre si llega nuevo pushName
  if (pushName && pushName !== from) {
    chats[from].name = pushName
  }

  const message = {
    type: type || "text",
    content: msgContent,
    senderName: senderName || pushName || "Desconocido",
    senderId: senderId || from,
    fromMe: false,
    isGroup: isGroup || false,
    timestamp: Date.now()
  }

  chats[from].messages.push(message)

  if (chats[from].messages.length > MAX_MESSAGES) {
    chats[from].messages.shift()
  }

  saveChats()

  // 🎯 Emitir solo al room del chat correspondiente
  io.to(from).emit("receive_message", message)

  // 🔔 Notificar al index que hay chat nuevo/actualizado
  io.emit("chat_updated", {
    chatId: from,
    name: chats[from].name,
    lastMessage: message
  })

  res.json({ success: true })
})

// ========================
// 📥 OBTENER TODOS LOS CHATS
// ========================
app.get("/chats", (req, res) => {
  res.json(chats)
})

// ========================
// 📥 CHAT POR ID
// ========================
app.get("/chat/:id", (req, res) => {
  const id = req.params.id
  res.json(chats[id] || { name: id, messages: [] })
})

// ========================
// 🚀 INICIAR SERVIDOR
// ========================
server.listen(3000, () => {
  console.log("✅ Servidor corriendo en http://localhost:3000")
})
