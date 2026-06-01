const express = require("express")
const http = require("http")
const { Server } = require("socket.io")
const cors = require("cors")
const fs = require("fs")

const app = express()
const server = http.createServer(app)

const io = new Server(server, {
cors: {
origin: "*"
}
})

global.io = io

let chats = {}

try {
chats = JSON.parse(
fs.readFileSync("./data/chats.json", "utf8")
)
} catch {
chats = {}
}

app.use(cors())
app.use(express.json())
app.use(express.static("public"))

app.get("/", (req, res) => {
res.send("Proyecto G Chat Online")
})

io.on("connection", (socket) => {
console.log("Usuario conectado:", socket.id)

socket.on("send_message", (data) => {
io.emit("receive_message", data)
})

socket.on("disconnect", () => {
console.log("Usuario desconectado")
})
})

app.post("/message", (req, res) => {
const {
from,
text,
pushName,
senderName,
senderId,
isGroup
} = req.body

if (!chats[from]) {
chats[from] = {
name: pushName || from,
messages: []
}
}

chats[from].messages.push({
text,
senderName,
senderId,
isGroup,
timestamp: Date.now()
})

const MAX_MESSAGES = 1000

if (chats[from].messages.length > MAX_MESSAGES) {
chats[from].messages.shift()
}

fs.writeFileSync(
"./data/chats.json",
JSON.stringify(chats, null, 2)
)

io.emit("new_message", {
from,
text,
pushName
})

res.json({
success: true
})
})

app.get("/chats", (req, res) => {
res.json(chats)
})

app.get("/chat/:id", (req, res) => {
const id = req.params.id

res.json(
chats[id]?.messages || []
)
})

server.listen(3000, () => {
console.log("Servidor corriendo en puerto 3000")
})
