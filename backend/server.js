import express from "express"
import { createServer } from "http"
import { Server } from "socket.io"
import cors from "cors"
import fs from "fs"
import { fileURLToPath } from "url"
import path from "path"
import * as db from "./db.js"
import nodeCrypto from "crypto"

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

const app    = express()
const server = createServer(app)
const io     = new Server(server, { cors: { origin: "*" } })

global.io = io

let statuses = [] // Array de estados en memoria

app.use(cors())
app.use(express.json({ limit: "50mb" }))
app.use(express.urlencoded({ limit: "50mb", extended: true }))
const LOGIN_HTML = "<!DOCTYPE html><html><head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Proyecto G</title><style>body{margin:0;height:100dvh;display:flex;align-items:center;justify-content:center;background:#0b141a;color:#e9edef;font-family:system-ui,sans-serif}.b{width:min(340px,90vw);text-align:center}input{width:100%;padding:14px;border-radius:12px;border:1px solid #2a3942;background:#202c33;color:#e9edef;font-size:16px;margin:16px 0;box-sizing:border-box}button{width:100%;padding:14px;border:none;border-radius:12px;background:#00a884;color:#000;font-size:16px;font-weight:600}p{color:#ff5c5c;min-height:20px}</style></head><body><div class=\"b\"><h2>Proyecto G</h2><input id=\"p\" type=\"password\" placeholder=\"Contraseña\" autofocus><button onclick=\"go()\">Entrar</button><p id=\"m\"></p></div><script>async function go(){const r=await fetch('/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pass:document.getElementById('p').value})});if(r.ok)location.href='/';else document.getElementById('m').textContent='Contraseña incorrecta'}document.getElementById('p').addEventListener('keydown',e=>{if(e.key==='Enter')go()})</script></body></html>"
const PASS_FILE = path.join(__dirname, "data/pass.txt")
const panelPass = () => { try { return fs.readFileSync(PASS_FILE, "utf8").trim() } catch { return "" } }
const tokenOf = p => nodeCrypto.createHash("sha256").update("pg:" + p).digest("hex")
const isLocal = a => ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(a)
const cookieTok = c => (String(c || "").match(/(?:^|;\s*)pg_token=([a-f0-9]+)/) || [])[1]
app.use((req, res, next) => {
  const pass = panelPass()
  if (!pass || isLocal(req.socket.remoteAddress) || cookieTok(req.headers.cookie) === tokenOf(pass)) return next()
  if (req.path === "/login" && req.method === "POST") {
    const done = body => {
      if ((body?.pass || "") === pass) { res.setHeader("Set-Cookie", "pg_token=" + tokenOf(pass) + "; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000"); return res.json({ ok: true }) }
      res.status(401).json({ ok: false })
    }
    if (req.body !== undefined) return done(req.body)
    let raw = ""
    req.on("data", d => { raw += d })
    return req.on("end", () => { try { done(JSON.parse(raw)) } catch { done({}) } })
  }
  if (req.path === "/login") return res.send(LOGIN_HTML)
  if (req.method === "GET" && !req.path.startsWith("/api") && !req.path.startsWith("/socket.io")) return res.redirect("/login")
  res.status(401).json({ error: "No autorizado" })
})
app.use(express.static(path.join(__dirname, "public")))
app.use("/media", express.static(db.MEDIA_DIR))

// ========================
// 🤖 IMPORTAR BOT
// ========================
let botModule = null

async function loadBot() {
  try {
    botModule = await import("../bot/index.js")
    await botModule.start()
    console.log("✅ Bot vinculado al servidor")
  } catch (e) {
    console.log("⚠️  Bot no disponible:", e.message)
  }
}

// ========================
// 🔌 SOCKET.IO
// ========================
io.on("connection", (socket) => {
  socket.on("join_chat", (chatId) => socket.join(chatId))

  socket.on("send_message", async (data) => {
    const { chatId, content = "", senderName, replyTo, mediaUrl, type } = data
    if (!chatId || (!content && !mediaUrl)) return

    const message = {
      type: mediaUrl ? (type || "image") : "text", content,
      mediaUrl: db.saveMedia(mediaUrl),
      fileName: data.fileName || null,
      senderName: senderName || "Panel",
      senderId: "panel", fromMe: true,
      replyTo: replyTo || null,
      timestamp: Date.now()
    }

    const name = db.saveMessage(chatId, null, message)

    io.to(chatId).emit("receive_message", message)
    io.emit("chat_updated", { chatId, name, lastMessage: message })

    try {
      if (botModule?.sendToWhatsApp) {
        const sent = await botModule.sendToWhatsApp(chatId, content, replyTo || null, mediaUrl ? { dataUrl: mediaToDataUrl(mediaUrl), type: type || "image", fileName: data.fileName, ptt: !!data.ptt } : null, data.mentions || null)
        if (sent?.key) { const m2 = db.setKey(chatId, message.timestamp, sent.key); if (m2) io.to(chatId).emit("message_updated", { chatId, msg: m2 }) }
      }
    } catch (e) {
      console.log("❌ Error enviando a WhatsApp:", e.message)
    }
  })

  socket.on("react", async ({ chatId, key, emoji }) => {
    if (!chatId || !key?.id) return
    try { await botModule.reactToWhatsApp(chatId, key, emoji) } catch (e) { return console.log("❌ Reacción:", e.message) }
    const m = db.updateMessage(chatId, key.id, x => { x.reactions = { ...(x.reactions || {}), me: emoji || undefined } })
    if (m) io.to(chatId).emit("message_updated", { chatId, msg: m })
  })

  socket.on("delete_message", async ({ chatId, key, everyone }) => {
    if (!chatId || !key?.id) return
    if (everyone) {
      try { await botModule.deleteForEveryone(chatId, key) } catch (e) { return console.log("❌ Borrar:", e.message) }
      const m = db.updateMessage(chatId, key.id, x => { x.revoked = true; x.originalContent = x.content })
      if (m) io.to(chatId).emit("message_revoked", { chatId, deletedId: key.id })
    } else {
      db.deleteMessage(chatId, key.id)
      io.to(chatId).emit("message_removed", { chatId, deletedId: key.id })
    }
  })

  socket.on("subscribe_presence", async ({ chatId }) => { try { await botModule?.getConn?.()?.presenceSubscribe(chatId) } catch {} })
  socket.on("typing", async ({ chatId }) => { try { await botModule?.getConn?.()?.sendPresenceUpdate("composing", chatId) } catch {} })

  socket.on("edit_message", async ({ chatId, key, text }) => {
    if (!chatId || !key?.id || !text) return
    try { await botModule.sendRaw(chatId, { text: String(text), edit: key }) } catch (e) { return console.log("❌ Editar:", e.message) }
    const m = applyEdit(chatId, key.id, String(text))
    if (m) io.to(chatId).emit("message_updated", { chatId, msg: m })
  })

  socket.on("pin_message", async ({ chatId, key, pin }) => {
    try { await botModule.sendRaw(chatId, { pin: key, type: pin ? 1 : 2, time: 604800 }) } catch (e) { console.log("ℹ️ Fijar en WhatsApp no disponible:", e.message) }
  })

  socket.on("send_poll", async ({ chatId, name, values }) => {
    try {
      const sent = await botModule.sendRaw(chatId, { poll: { name, values, selectableCount: 1 } })
      localOut(chatId, "📊 " + name + "\n" + values.map(v => "▫ " + v).join("\n"), sent)
    } catch (e) { console.log("❌ Encuesta:", e.message) }
  })

  socket.on("send_location", async ({ chatId, lat, lng }) => {
    try {
      const sent = await botModule.sendRaw(chatId, { location: { degreesLatitude: lat, degreesLongitude: lng } })
      localOut(chatId, "📍 https://maps.google.com/?q=" + lat + "," + lng, sent)
    } catch (e) { console.log("❌ Ubicación:", e.message) }
  })

  socket.on("send_contact", async ({ chatId, name, number }) => {
    const n = String(number || "").replace(/\D/g, "")
    if (!chatId || !name || !n) return
    try {
      const vcard = "BEGIN:VCARD\nVERSION:3.0\nFN:" + name + "\nTEL;type=CELL;waid=" + n + ":+" + n + "\nEND:VCARD"
      const sent = await botModule.sendRaw(chatId, { contacts: { displayName: name, contacts: [{ vcard }] } })
      localOut(chatId, "👤 Contacto: " + name + " (+" + n + ")", sent)
    } catch (e) { console.log("❌ Contacto:", e.message) }
  })

  socket.on("disconnect", () => {})
})

// ========================
// 💾 RECIBIR MENSAJE DEL BOT
// ========================
app.post("/message", (req, res) => {
  const {
    from, type, text, content, mediaUrl, fileName,
    pushName, senderName, senderId, isGroup,
    fromMe, waMessageKey, isViewOnce, deletedId, replyTo: rawReply
  } = req.body

  if (!from) return res.status(400).json({ error: "Falta 'from'" })

  // ── REVOKE ──
  if (type === 'revoke') {
    if (deletedId && db.markRevoked(from, deletedId)) {
      io.to(from).emit('message_revoked', { chatId: from, deletedId })
      console.log(`🗑️ Borrado en panel: ${deletedId}`)
    } else if (deletedId) pendingRevoke(from, deletedId)
    return res.json({ success: true })
  }

  const msgContent = content || text || ""
  const message = {
    type:         type || "text",
    content:      msgContent,
    mediaUrl:     db.saveMedia(mediaUrl),
    fileName:     fileName || null,
    senderName:   senderName || pushName || "Desconocido",
    senderId:     senderId || from,
    fromMe:       fromMe || false,
    isGroup:      isGroup || false,
    isViewOnce:   isViewOnce || false,
    revoked:      false,
    replyTo:      buildReply(rawReply, from),
    waMessageKey: waMessageKey || null,
    timestamp:    (Number(req.body.timestamp) > 0 ? Number(req.body.timestamp) : Date.now())
  }

  if (waMessageKey?.id) {
    if (db.hasMessage(from, waMessageKey.id)) {
      // Ya existe un mensaje con este ID (ej. el placeholder de "ver una vez").
      // Si ahora llega la media real, completamos el mensaje en vez de descartarlo.
      if (message.mediaUrl) {
        const updated = db.updateMessage(from, waMessageKey.id, x => {
          if (!x.mediaUrl) x.mediaUrl = message.mediaUrl
          if (!x.content && msgContent) x.content = msgContent
          if (isViewOnce) x.isViewOnce = true
        })
        if (updated) io.to(from).emit("message_updated", { chatId: from, msg: updated })
      }
      return res.json({ success: true, duplicate: true })
    }
    if (pendRev.delete(from + "|" + waMessageKey.id)) { message.revoked = true; message.originalContent = message.content }
  }
  const name = db.saveMessage(from, pushName, message)

  io.to(from).emit("receive_message", message)
  io.emit("chat_updated", { chatId: from, name, lastMessage: message })

  res.json({ success: true })
})

// ========================
// 📢 RECIBIR ESTADO DEL BOT
// ========================
app.post("/status-update", (req, res) => {
  const { senderId, senderName, type, text, mediaUrl, timestamp, messageKey } = req.body
  if (!senderId) return res.json({ success: true })

  // Buscar si ya existe estado de este contacto y actualizarlo
  const idx = statuses.findIndex(s => s.senderId === senderId)
  const status = { senderId, senderName, type, text, mediaUrl, timestamp, messageKey, seenAt: null }

  if (idx >= 0) {
    statuses[idx] = status
  } else {
    statuses.unshift(status)
  }

  // Máximo 100 estados en memoria
  if (statuses.length > 100) statuses = statuses.slice(0, 100)

  console.log(`📢 Estado de ${senderName}: ${type}`)

  // Notificar al frontend en tiempo real
  io.emit('new_status', status)

  res.json({ success: true })
})

// ========================
// 📥 ENDPOINTS
// ========================
app.get("/chats",        (req, res) => res.json(db.getChats()))
app.get("/chat/:id",     (req, res) => res.json(db.getChat(req.params.id)))
app.get("/statuses",     (req, res) => res.json(statuses))
const CALLS_PATH = path.join(__dirname, "data/calls.json")
let calls = []
try { calls = JSON.parse(fs.readFileSync(CALLS_PATH, "utf8")) } catch {}

app.post("/call", (req, res) => {
  const c = req.body
  if (!c?.id) return res.json({ success: false })
  const RANK = { offer: 1, timeout: 2, terminate: 2, reject: 3, accept: 3 }
  const i = calls.findIndex(x => x.id === c.id)
  if (i >= 0) {
    const o = calls[i]
    calls[i] = {
      ...o, ...c,
      status:  (RANK[o.status] || 0) > (RANK[c.status] || 0) ? o.status : c.status,
      from:    o.from || c.from,
      name:    o.name || c.name,
      isVideo: o.isVideo || c.isVideo,
      date:    o.date && c.date ? Math.min(o.date, c.date) : (o.date || c.date)
    }
  } else calls.push(c)
  calls.sort((a, b) => (b.date || 0) - (a.date || 0))
  calls = calls.slice(0, 200)
  fs.writeFileSync(CALLS_PATH, JSON.stringify(calls))
  io.emit("call_update", calls.find(x => x.id === c.id))
  res.json({ success: true })
})
app.get("/calls", (req, res) => res.json(calls))

app.post("/calls/delete", (req, res) => {
  const ids = req.body?.ids
  calls = Array.isArray(ids) ? calls.filter(c => !ids.includes(c.id)) : []
  fs.writeFileSync(CALLS_PATH, JSON.stringify(calls))
  io.emit("calls_deleted", Array.isArray(ids) ? ids : null)
  res.json({ success: true })
})

function meOf(conn, g) {
  const n = j => String(j || "").split(":")[0].split("@")[0]
  const mine = [n(conn.user?.id), n(conn.user?.lid)].filter(Boolean)
  return g.participants.find(p => [p.id, p.phoneNumber, p.lid].some(x => x && mine.includes(n(x))))
}

app.get("/api/group/:id", async (req, res) => {
  try {
    const conn = botModule?.getConn?.()
    if (!conn || !req.params.id.endsWith("@g.us")) return res.json({ ok: false })
    const g = await conn.groupMetadata(req.params.id)
    const n = j => String(j || "").split(":")[0].split("@")[0]
    const names = {}
    for (const m of db.getChat(req.params.id, 2000).messages) if (m.senderId && m.senderName && !m.fromMe) names[n(m.senderId)] = m.senderName
    const me = meOf(conn, g)
    const nameOf = p => names[n(p.phoneNumber || p.id)] || names[n(p.id)] || names[n(p.lid)] || ""
    const owner = g.participants.find(p => p.admin === "superadmin")
    res.json({
      ok: true, subject: g.subject, desc: g.desc || "", creation: g.creation, size: g.participants.length,
      announce: !!g.announce, restrict: !!g.restrict, approval: !!g.joinApprovalMode, ephemeral: g.ephemeralDuration || 0,
      meAdmin: !!me?.admin,
      owner: owner ? { phone: owner.phoneNumber || owner.id, name: nameOf(owner), isMe: owner === me } : null,
      participants: await Promise.all(g.participants.map(async p => ({ id: p.id, phone: await pnFor(conn, p), name: nameOf(p), admin: p.admin || null, isMe: p === me })))
    })
  } catch { res.json({ ok: false }) }
})

app.get("/api/check/:num", async (req, res) => {
  try {
    const conn = botModule?.getConn?.()
    const r = await conn.onWhatsApp(req.params.num.replace(/\D/g, ""))
    res.json({ exists: !!r?.[0]?.exists, jid: r?.[0]?.jid || "" })
  } catch { res.json({ exists: false, jid: "", error: true }) }
})

app.post("/api/group-create", async (req, res) => {
  try {
    const conn = botModule?.getConn?.()
    const { subject, numbers } = req.body || {}
    const jids = (numbers || []).map(x => String(x).replace(/\D/g, "")).filter(Boolean).map(x => x + "@s.whatsapp.net")
    if (!subject || !jids.length) return res.json({ ok: false, error: "Falta nombre o miembros" })
    const g = await conn.groupCreate(String(subject).slice(0, 100), jids)
    res.json({ ok: true, id: g.id })
  } catch (e) { res.json({ ok: false, error: e?.message || "Error" }) }
})

function mediaToDataUrl(u) {
  if (!u || !u.startsWith("/media/")) return u
  const f = path.join(db.MEDIA_DIR, path.basename(u))
  const ext = path.extname(f).slice(1).toLowerCase()
  const mime = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", mp4: "video/mp4", ogg: "audio/ogg", mp3: "audio/mpeg", m4a: "audio/mp4", pdf: "application/pdf" }[ext] || "application/octet-stream"
  return "data:" + mime + ";base64," + fs.readFileSync(f).toString("base64")
}

app.post("/reaction", (req, res) => {
  const { chatId, msgId, from, fromMe, emoji } = req.body || {}
  if (!chatId || !msgId) return res.json({ success: false })
  const k = fromMe ? "me" : String(from || "").split("@")[0].split(":")[0]
  const m = db.updateMessage(chatId, msgId, x => {
    x.reactions = { ...(x.reactions || {}) }
    if (emoji) x.reactions[k] = emoji; else delete x.reactions[k]
  })
  if (m) io.to(chatId).emit("message_updated", { chatId, msg: m })
  res.json({ success: true })
})

app.post("/msg-status", (req, res) => {
  const { chatId, msgId, status } = req.body || {}
  if (!chatId || !msgId) return res.json({ success: false })
  const m = db.updateMessage(chatId, msgId, x => { x.status = Math.max(x.status || 0, Number(status) || 0) })
  if (m) io.to(chatId).emit("message_updated", { chatId, msg: m })
  res.json({ success: true })
})

app.post("/api/ephemeral", async (req, res) => {
  try {
    const conn = botModule?.getConn?.()
    const { chatId, seconds } = req.body || {}
    const s = Number(seconds) || 0
    if (String(chatId).endsWith("@g.us")) await conn.groupToggleEphemeral(chatId, s)
    else await conn.sendMessage(chatId, { disappearingMessagesInChat: s || false })
    res.json({ ok: true })
  } catch (e) { res.json({ ok: false, error: e?.message || "Error" }) }
})

app.get("/api/pfp/:id", async (req, res) => {
  try { const conn = botModule?.getConn?.(); res.json({ url: await conn.profilePictureUrl(req.params.id, "image") }) } catch { res.json({ url: "" }) }
})

app.get("/api/storage/:id", (req, res) => res.json(db.mediaStats(req.params.id)))
app.post("/api/storage/:id/purge", (req, res) => res.json({ ok: true, ...db.purgeMedia(req.params.id) }))

app.post("/presence", (req, res) => {
  const { chatId, list } = req.body || {}
  if (chatId) io.to(chatId).emit("presence", { chatId, list: list || [] })
  res.json({ success: true })
})

app.post("/api/starred", (req, res) => res.json(db.findByWaIds((req.body?.ids || []).slice(0, 500).map(String))))

app.get("/api/me", async (req, res) => {
  try {
    const conn = botModule?.getConn?.()
    const num = conn.user.id.split(":")[0].split("@")[0]
    const jid = num + "@s.whatsapp.net"
    let about = "", url = ""
    try { const r = await conn.fetchStatus(jid); about = r?.[0]?.status?.status ?? r?.status?.status ?? "" } catch {}
    try { url = await conn.profilePictureUrl(jid, "image") } catch {}
    res.json({ ok: true, name: conn.user.name || "", number: num, about, url })
  } catch { res.json({ ok: false }) }
})

app.post("/api/me", async (req, res) => {
  try {
    const conn = botModule?.getConn?.()
    const { name, about, photo } = req.body || {}
    const jid = conn.user.id.split(":")[0].split("@")[0] + "@s.whatsapp.net"
    if (name) await conn.updateProfileName(String(name).slice(0, 25))
    if (about !== undefined) await conn.updateProfileStatus(String(about).slice(0, 139))
    if (photo) await conn.updateProfilePicture(jid, Buffer.from(photo.split(",")[1], "base64"))
    res.json({ ok: true })
  } catch (e) { res.json({ ok: false, error: e?.message || "Error" }) }
})

app.post("/api/block", async (req, res) => {
  try {
    const conn = botModule?.getConn?.()
    const { chatId, block } = req.body || {}
    await conn.updateBlockStatus(chatId, block ? "block" : "unblock")
    res.json({ ok: true })
  } catch (e) { res.json({ ok: false, error: e?.message || "Error" }) }
})

app.get("/api/blocklist", async (req, res) => {
  try {
    const conn = botModule?.getConn?.()
    const jids = await conn.fetchBlocklist()
    // Las cuentas bloqueadas vienen como @lid (identificador interno nuevo de WhatsApp),
    // no como número de teléfono: hay que resolverlas a su número real.
    const numbers = await Promise.all(jids.map(async j => {
      if (String(j).endsWith("@lid")) {
        const pn = await conn?.signalRepository?.lidMapping?.getPNForLID?.(j).catch(() => "")
        return pn ? pn.split("@")[0].split(":")[0] : null
      }
      return j.split("@")[0].split(":")[0]
    }))
    res.json({ ok: true, count: jids.length, jids, numbers })
  } catch (e) { res.json({ ok: false, count: 0, jids: [], numbers: [], error: e?.message || "Error" }) }
})

app.post("/api/status", async (req, res) => {
  try {
    const conn = botModule?.getConn?.()
    const { text, mediaUrl, type, caption, color } = req.body || {}
    const jids = Object.keys(db.getChats()).filter(j => j.endsWith("@s.whatsapp.net"))
    jids.push(conn.user.id.split(":")[0].split("@")[0] + "@s.whatsapp.net")
    const opts = { statusJidList: jids, backgroundColor: color || "#128c7e", font: 1 }
    if (mediaUrl) {
      const buf = Buffer.from(mediaUrl.split(",")[1], "base64")
      await conn.sendMessage("status@broadcast", type === "video" ? { video: buf, caption } : { image: buf, caption }, opts)
    } else if (text) await conn.sendMessage("status@broadcast", { text: String(text).slice(0, 700) }, opts)
    else return res.json({ ok: false, error: "Estado vacío" })
    res.json({ ok: true, to: jids.length })
  } catch (e) { res.json({ ok: false, error: e?.message || "Error" }) }
})

app.get("/api/resolve", async (req, res) => {
  const jid = String(req.query.jid || ""), name = String(req.query.name || "").toLowerCase()
  const all = db.getChats()
  if (all[jid]) return res.json({ id: jid })
  try {
    const conn = botModule?.getConn?.()
    const lid = await conn.signalRepository?.lidMapping?.getLIDForPN?.(jid)
    if (lid && all[lid]) return res.json({ id: lid })
  } catch {}
  const num = jid.split("@")[0].split(":")[0]
  const hit = Object.entries(all).find(([id, c]) => !id.endsWith("@g.us") && (id.startsWith(num) || (name && String(c.name).toLowerCase() === name)))
  res.json({ id: hit ? hit[0] : jid })
})

app.post("/api/group-photo", async (req, res) => {
  try {
    const conn = botModule?.getConn?.()
    const { chatId, photo } = req.body || {}
    await conn.updateProfilePicture(chatId, Buffer.from(String(photo).split(",")[1], "base64"))
    res.json({ ok: true })
  } catch (e) { res.json({ ok: false, error: e?.message || "Error" }) }
})

io.use((socket, next) => {
  const pass = panelPass()
  if (!pass || isLocal(socket.handshake.address) || cookieTok(socket.handshake.headers.cookie) === tokenOf(pass)) return next()
  next(new Error("unauthorized"))
})

function localOut(chatId, content, sent) {
  const message = { type: "text", content, fromMe: true, senderName: "Tú", timestamp: Date.now(), waMessageKey: sent?.key || null, mediaUrl: null, replyTo: null }
  const name = db.saveMessage(chatId, null, message)
  io.to(chatId).emit("receive_message", message)
  io.emit("chat_updated", { chatId, name, lastMessage: message })
}

app.get("/api/common/:id", async (req, res) => {
  try {
    const conn = botModule?.getConn?.()
    const n = j => String(j || "").split(":")[0].split("@")[0]
    const target = n(req.params.id)
    const groups = await conn.groupFetchAllParticipating()
    res.json(Object.values(groups)
      .filter(g => g.participants.some(p => [p.id, p.phoneNumber, p.lid].some(x => x && n(x) === target)))
      .map(g => ({ id: g.id, name: g.subject })))
  } catch { res.json([]) }
})

function applyEdit(chatId, id, text) {
  return db.updateMessage(chatId, id, x => {
    if (x.content === text) return
    x.edits = [...(x.edits || []), { text: x.content || "", t: x.lastEditAt || x.timestamp }]
    x.lastEditAt = Date.now()
    x.content = text
    x.edited = true
  })
}

async function pnFor(conn, p) {
  const pn = p.phoneNumber || (String(p.id).endsWith("@s.whatsapp.net") ? p.id : "")
  if (pn) return pn
  try { return (await conn.signalRepository?.lidMapping?.getPNForLID?.(p.id)) || p.id } catch { return p.id }
}

app.get("/api/pn/:id", async (req, res) => {
  try {
    const conn = botModule?.getConn?.()
    const id = req.params.id
    const pn = id.endsWith("@lid") ? ((await conn.signalRepository?.lidMapping?.getPNForLID?.(id)) || "") : id
    res.json({ pn: String(pn).split("@")[0].split(":")[0] })
  } catch { res.json({ pn: "" }) }
})

app.post("/msg-edit", (req, res) => {
  const { chatId, msgId, text } = req.body || {}
  if (!chatId || !msgId || !text) return res.json({ success: false })
  const m = applyEdit(chatId, msgId, String(text))
  if (m) io.to(chatId).emit("message_updated", { chatId, msg: m })
  else console.log("⚠️ Edición recibida pero no encontré el mensaje original:", msgId)
  res.json({ success: true })
})

const pendRev = new Map()
function pendingRevoke(chatId, id) {
  const key = chatId + "|" + id
  pendRev.set(key, true)
  setTimeout(() => {
    if (!pendRev.delete(key)) return
    const message = { type: "text", content: "🚫 Mensaje eliminado (se borró antes de que el bot pudiera recibirlo)", mediaUrl: null, fileName: null, senderName: "Desconocido", senderId: chatId, fromMe: false, isGroup: chatId.endsWith("@g.us"), isViewOnce: false, revoked: true, originalContent: "", waMessageKey: { id, remoteJid: chatId }, timestamp: Date.now() }
    const name = db.saveMessage(chatId, null, message)
    io.to(chatId).emit("receive_message", message)
    io.emit("chat_updated", { chatId, name, lastMessage: message })
  }, 15000)
}

function isPrivateHost(h) { return /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[?::1\]?$)|\.local$/i.test(h) }
function metaTags(html) {
  const out = {}
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const a = {}
    for (const x of m[0].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) a[x[1].toLowerCase()] = x[2] ?? x[3]
    const k = (a.property || a.name || "").toLowerCase()
    if (k && a.content && !out[k]) out[k] = a.content
  }
  return out
}
const prevCache = new Map()
app.get("/api/preview", async (req, res) => {
  const url = String(req.query.url || "")
  try {
    const u = new URL(url)
    if (!/^https?:$/.test(u.protocol) || isPrivateHost(u.hostname)) return res.json({})
    if (prevCache.has(url)) return res.json(prevCache.get(url))
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), 6000)
    const r = await fetch(url, { signal: ctl.signal, headers: { "User-Agent": "Mozilla/5.0 (compatible; PanelBot/1.0)", Accept: "text/html" } })
    clearTimeout(t)
    if (!(r.headers.get("content-type") || "").includes("text/html")) return res.json({})
    const html = (await r.text()).slice(0, 200000)
    const mt = metaTags(html)
    const title = mt["og:title"] || (html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1] || ""
    let image = mt["og:image"] || ""
    try { if (image) image = new URL(image, url).href } catch { image = "" }
    const out = { title: title.trim().slice(0, 140), desc: (mt["og:description"] || mt.description || "").slice(0, 200), image }
    prevCache.set(url, out)
    res.json(out)
  } catch { res.json({}) }
})

function escHtml(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") }
function buildReply(r, chatId) {
  if (!r || !r.id) return null
  const orig = db.findByWaIds([String(r.id)]).find(x => x.chatId === chatId)
  const m = orig && orig.msg
  const who = r.isMe || (m && m.fromMe) ? "Tú" : (m && m.senderName) || (r.participant ? "+" + String(r.participant).split("@")[0].split(":")[0] : "Mensaje citado")
  const label = { image: "📷 Foto", video: "🎥 Video", audio: "🎧 Audio", sticker: "Sticker", document: "📄 Documento", location: "📍 Ubicación", contact: "👤 Contacto" }
  const content = r.text || (m && m.content) || label[r.type] || (m && m.mediaUrl ? "📎 Multimedia" : "") || "[Multimedia]"
  return { waMessageKey: { id: String(r.id), remoteJid: chatId, participant: r.participant || null }, senderName: escHtml(who), content: escHtml(content), type: r.type || (m && m.type) || "text" }
}

app.post("/api/system-event", async (req, res) => {
  try {
    const { chatId, action, participants = [], author, text, timestamp } = req.body || {}
    if (!chatId) return res.json({ ok: false })
    const conn = botModule?.getConn?.()
    const n = j => String(j || "").split(":")[0].split("@")[0]
    const known = db.getChat(chatId, 2000).messages
    const nameOf = async j => {
      const d = n(j)
      for (const m of known) if (m.senderId && n(m.senderId) === d && m.senderName && !m.fromMe) return m.senderName
      if (conn && (n(conn.user?.id) === d || n(conn.user?.lid) === d)) return "Tú"
      let pn = String(j).endsWith("@lid") ? ((await conn?.signalRepository?.lidMapping?.getPNForLID?.(j).catch(() => "")) || "") : j
      return "+" + n(pn || j)
    }
    const names = await Promise.all(participants.map(nameOf))
    const who = author ? await nameOf(author) : ""
    const list = names.join(", ")
    let content = text
    if (!content) {
      if (action === "add") content = (who && who !== list) ? who + " añadió a " + list : list + " se unió al grupo"
      else if (action === "remove") content = (who && who !== list) ? who + " eliminó a " + list : list + " salió del grupo"
      else if (action === "promote") content = list + " ahora es admin del grupo"
      else if (action === "demote") content = list + " ya no es admin del grupo"
      else return res.json({ ok: false })
    }
    const message = { type: "system", content, fromMe: false, senderName: "", senderId: chatId, isGroup: true, timestamp: Number(timestamp) > 0 ? Number(timestamp) : Date.now(), waMessageKey: null, mediaUrl: null, replyTo: null }
    db.saveMessage(chatId, null, message)
    io.to(chatId).emit("receive_message", message)
    res.json({ ok: true })
  } catch { res.json({ ok: false }) }
})

app.post("/chat/:id/clear", (req, res) => { db.clearChat(req.params.id); res.json({ success: true }) })

app.post("/group/:id/action", async (req, res) => {
  const { type, value, ids } = req.body || {}
  const jid = req.params.id
  try {
    const conn = botModule?.getConn?.()
    if (!conn || !jid.endsWith("@g.us")) return res.json({ ok: false, error: "Bot no conectado" })
    const g = await conn.groupMetadata(jid)
    const admin = !!meOf(conn, g)?.admin
    const adminOnly = ["add", "remove", "promote", "demote", "announce", "locked", "approval", "ephemeral", "invite", "revoke", "requests", "request"]
    if (adminOnly.includes(type) && !admin) return res.json({ ok: false, error: "Solo los admins pueden hacerlo" })
    if (["subject", "desc"].includes(type) && g.restrict && !admin) return res.json({ ok: false, error: "Solo los admins pueden editar la info" })
    switch (type) {
      case "subject": await conn.groupUpdateSubject(jid, String(value).slice(0, 100)); break
      case "desc": await conn.groupUpdateDescription(jid, String(value).slice(0, 2048)); break
      case "add": case "remove": case "promote": case "demote":
        await conn.groupParticipantsUpdate(jid, ids.map(x => type === "add" ? String(x).replace(/\D/g, "") + "@s.whatsapp.net" : x), type); break
      case "announce": await conn.groupSettingUpdate(jid, value ? "announcement" : "not_announcement"); break
      case "locked": await conn.groupSettingUpdate(jid, value ? "locked" : "unlocked"); break
      case "approval": await conn.groupJoinApprovalMode(jid, value ? "on" : "off"); break
      case "ephemeral": await conn.groupToggleEphemeral(jid, Number(value) || 0); break
      case "invite": return res.json({ ok: true, code: await conn.groupInviteCode(jid) })
      case "revoke": return res.json({ ok: true, code: await conn.groupRevokeInvite(jid) })
      case "requests": return res.json({ ok: true, list: await conn.groupRequestParticipantsList(jid) })
      case "request": await conn.groupRequestParticipantsUpdate(jid, ids, value); break
      case "leave": await conn.groupLeave(jid); break
      default: return res.json({ ok: false, error: "Acción desconocida" })
    }
    res.json({ ok: true })
  } catch (e) { res.json({ ok: false, error: e?.message || "Error" }) }
})

app.get("/group/:id", async (req, res) => {
  try {
    const conn = botModule?.getConn?.()
    if (!conn || !req.params.id.endsWith("@g.us")) return res.json({ ok: false })
    const g = await conn.groupMetadata(req.params.id)
    res.json({
      ok: true, subject: g.subject, desc: g.desc || "", creation: g.creation, size: g.participants.length,
      announce: !!g.announce, restrict: !!g.restrict, approval: !!g.joinApprovalMode, ephemeral: g.ephemeralDuration || 0,
      owner: g.ownerPn || g.owner || "", meAdmin: !!meOf(conn, g)?.admin,
      participants: g.participants.map(p => ({ id: p.id, phone: p.phoneNumber || p.id, admin: p.admin || null, isMe: p === meOf(conn, g) }))
    })
  } catch { res.json({ ok: false }) }
})

app.get("/status",       (req, res) => res.json({
  status: "ok",
  chats:  db.countChats(),
  bot:    botModule?.getConn?.() ? "conectado" : "desconectado"
}))

// ========================
// 🚀 ARRANCAR
// ========================
server.listen(3000, async () => {
  console.log("✅ Servidor corriendo en http://localhost:3000")
  await loadBot()
})
