// Envío de fotografías desde el editor del panel. Ruta: POST /api/send-image
// Solo guarda y muestra el mensaje en el panel DESPUÉS de que WhatsApp aceptó el envío.
const MAX_BYTES = 16 * 1024 * 1024
const withTimeout = (p, ms) => { let t; return Promise.race([p, new Promise((_, no) => { t = setTimeout(() => no(new Error("WhatsApp tardó demasiado en responder")), ms) })]).finally(() => clearTimeout(t)) }

export function registerPhotoRoutes(app, { getBot, db, io }) {
  const done = new Map(), inflight = new Map()

  async function run(b) {
    const { chatId, dataUrl, caption, viewOnce, replyTo } = b
    const bot = getBot()
    if (!bot?.sendToWhatsApp || !bot.getConn?.()) return { ok: false, error: "El bot no está conectado a WhatsApp" }
    let sent
    try {
      sent = await withTimeout(bot.sendToWhatsApp(chatId, caption, replyTo || null, { dataUrl, type: "image", viewOnce: !!viewOnce }, null), 120000)
    } catch (e) {
      return { ok: false, error: /not connected|no conectado|closed/i.test(e?.message || "") ? "Sin conexión con WhatsApp. Inténtalo de nuevo." : (e?.message || "No se pudo enviar la foto") }
    }
    const message = {
      type: "image", content: caption, mediaUrl: db.saveMedia(dataUrl), fileName: null,
      senderName: "Panel", senderId: "panel", fromMe: true, isViewOnce: !!viewOnce,
      replyTo: replyTo || null, waMessageKey: sent?.key || null, timestamp: Date.now()
    }
    const name = db.saveMessage(chatId, null, message)
    io.to(chatId).emit("receive_message", message)
    io.emit("chat_updated", { chatId, name, lastMessage: message })
    return { ok: true, key: sent?.key || null }
  }

  app.post("/api/send-image", async (req, res) => {
    try {
      const x = req.body || {}
      const chatId = String(x.chatId || "")
      const dataUrl = String(x.dataUrl || "")
      const m = /^data:(image\/(?:jpeg|png|webp));base64,/.exec(dataUrl)
      if (!chatId) return res.json({ ok: false, error: "Falta el chat" })
      if (!m) return res.json({ ok: false, error: "Formato de imagen no válido (usa JPG, PNG o WebP)" })
      if (dataUrl.length * 0.75 > MAX_BYTES) return res.json({ ok: false, error: "La imagen supera los 16 MB" })
      const rid = String(x.requestId || "")
      if (rid && done.has(rid)) return res.json({ ...done.get(rid), duplicate: true })
      if (rid && inflight.has(rid)) return res.json({ ...(await inflight.get(rid)), duplicate: true })
      const p = run({ chatId, dataUrl, caption: String(x.caption || "").slice(0, 1024), viewOnce: !!x.viewOnce, replyTo: x.replyTo })
      if (rid) inflight.set(rid, p)
      try {
        const r = await p
        if (r.ok && rid) { done.set(rid, r); setTimeout(() => done.delete(rid), 300000).unref?.() }
        res.json(r)
      } finally { if (rid) inflight.delete(rid) }
    } catch (e) { res.json({ ok: false, error: e?.message || "Error" }) }
  })
}
