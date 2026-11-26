// Actividad en tiempo real (escribiendo / grabando audio) para TODOS los chats.
// Se alimenta del POST /presence que ya envía el bot (Baileys: evento presence.update, estados
// 'composing' | 'recording' | 'paused' | 'available' | 'unavailable'). No cambia el flujo existente (usa next()).
const dig = j => String(j || "").split("@")[0].split(":")[0].replace(/\D/g, "")
const isLid = j => String(j || "").endsWith("@lid")
const isPn = j => String(j || "").endsWith("@s.whatsapp.net")
const clean = j => String(j || "").replace(/:\d+@/, "@")
const sleep = ms => new Promise(r => setTimeout(r, ms))
// Si WhatsApp deja de enviar eventos, el indicador caduca solo
const TTL = { composing: 25000, recording: 25000, available: 150000 }

export function registerActivity(app, { io, getBot, db }) {
  const state = new Map(), lastSent = new Map(), subbed = new Map()
  const conn = () => getBot()?.getConn?.()
  const meIds = () => { const c = conn(); return [dig(c?.user?.id), dig(c?.user?.lid)].filter(Boolean) }
  const lm = () => conn()?.signalRepository?.lidMapping

  async function aliases(chatId) {
    const out = new Set([chatId])
    try {
      if (isLid(chatId)) { const p = await lm()?.getPNForLID?.(chatId); if (p) out.add(clean(p)) }
      else if (isPn(chatId)) { const l = await lm()?.getLIDForPN?.(chatId); if (l) out.add(clean(l)) }
    } catch {}
    return [...out]
  }
  async function nameOf(chatId, jid) {
    let pn = dig(jid)
    if (isLid(jid)) { try { const p = await lm()?.getPNForLID?.(jid); if (p) pn = dig(p) } catch {} }
    const want = new Set([dig(jid), pn])
    try {
      for (const m of db.getChat(chatId, 300).messages) if (m.senderId && !m.fromMe && m.senderName && want.has(dig(m.senderId))) return m.senderName.split(" ")[0]
    } catch {}
    return pn.length >= 7 ? "+" + pn : ""
  }
  async function summary(chatId) {
    const m = state.get(chatId), now = Date.now()
    let kind = null, who = "", online = false, active = null
    if (m) for (const [jid, v] of m) {
      if (v.exp < now) { m.delete(jid); continue }
      online = true
      if (v.s === "recording") { kind = "recording"; active = jid }
      else if (v.s === "composing" && kind !== "recording") { kind = "composing"; active = jid }
    }
    const group = chatId.endsWith("@g.us")
    if (kind && group) who = await nameOf(chatId, active)
    return { chatId, aliases: await aliases(chatId), kind, who, online: group ? false : online }
  }
  async function emitIfChanged(chatId) {
    const p = await summary(chatId)
    const key = JSON.stringify([p.kind, p.who, p.online])
    if (lastSent.get(chatId) === key) return          // evita eventos duplicados
    lastSent.set(chatId, key)
    io.emit("chat_activity", p)
  }

  // Se engancha ANTES de la ruta existente y continúa con next(): el flujo actual no cambia.
  app.use("/presence", (req, res, next) => {
    try {
      const { chatId, list } = req.body || {}
      if (req.method === "POST" && chatId && chatId !== "status@broadcast" && Array.isArray(list)) {
        const m = state.get(chatId) || new Map(), now = Date.now(), me = meIds()
        for (const e of list) {
          if (!e || !e.jid || me.includes(dig(e.jid))) continue
          if (TTL[e.state]) m.set(e.jid, { s: e.state, exp: now + TTL[e.state] })
          else m.delete(e.jid)                          // paused / unavailable / sin dato
        }
        state.set(chatId, m)
        emitIfChanged(chatId).catch(() => {})
      }
    } catch {}
    next()
  })

  // Caducidad y desconexión del bot
  const sweep = setInterval(() => {
    if (!conn()) {
      state.clear()
      for (const [chatId, k] of [...lastSent]) { lastSent.delete(chatId); if (k !== JSON.stringify([null, "", false])) io.emit("chat_activity", { chatId, aliases: [chatId], kind: null, who: "", online: false }) }
      return
    }
    for (const [chatId, m] of state) { emitIfChanged(chatId).catch(() => {}); if (!m.size) state.delete(chatId) }
  }, 3000)
  sweep.unref?.()

  app.get("/api/activity", async (req, res) => {
    try {
      const out = []
      for (const chatId of state.keys()) { const p = await summary(chatId); if (p.kind || p.online) out.push(p) }
      res.json(out)
    } catch { res.json([]) }
  })

  // El panel pide recibir presencia de sus chats recientes (de uno en uno para no saturar WhatsApp)
  io.on("connection", socket => {
    socket.on("subscribe_presence_many", async ({ chatIds } = {}) => {
      const c = conn()
      if (!c || !Array.isArray(chatIds)) return
      for (const id of chatIds.slice(0, 80)) {
        if (typeof id !== "string" || id.endsWith("@broadcast") || id.endsWith("@newsletter")) continue
        if (Date.now() - (subbed.get(id) || 0) < 240000) continue
        subbed.set(id, Date.now())
        try { await c.presenceSubscribe(id) } catch {}
        await sleep(250)
      }
    })
  })
}
