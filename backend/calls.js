// Favoritos de llamadas y recordatorios de llamadas programadas.
// IMPORTANTE: Baileys no puede iniciar llamadas; "programar" crea un RECORDATORIO, no una llamada automática.
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import crypto from "crypto"

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "data")
const FAV = path.join(DIR, "call-favorites.json"), SCH = path.join(DIR, "call-schedule.json")
const load = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")) } catch { return d } }
const save = (f, v) => { try { fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(f, JSON.stringify(v)) } catch (e) { console.log("⚠️ No pude guardar", path.basename(f) + ":", e.message) } }
const dig = s => String(s || "").replace(/\D/g, "")

export function registerCallRoutes(app, { io }) {
  let favs = load(FAV, []), sch = load(SCH, [])

  app.get("/api/call-favorites", (req, res) => res.json(favs))
  app.post("/api/call-favorites", (req, res) => {
    const { action, jid, number, name } = req.body || {}
    const n = dig(number), id = n || String(jid || "")
    if (!id) return res.json({ ok: false, error: "Falta el contacto" })
    if (action === "remove") favs = favs.filter(f => f.id !== id)
    else if (action === "add") { if (favs.length >= 100) return res.json({ ok: false, error: "Máximo 100 favoritos" }); if (!favs.some(f => f.id === id)) favs.push({ id, jid: jid || (n ? n + "@s.whatsapp.net" : ""), number: n, name: String(name || "").slice(0, 80) }) }
    else return res.json({ ok: false, error: "Acción desconocida" })
    save(FAV, favs)
    res.json({ ok: true, favorites: favs })
  })

  app.get("/api/call-schedule", (req, res) => res.json(sch.slice().sort((a, b) => a.at - b.at)))
  app.post("/api/call-schedule", (req, res) => {
    const { jid, number, name, at, note, video } = req.body || {}
    const when = Number(at), n = dig(number)
    if (!when || when < Date.now() - 60000) return res.json({ ok: false, error: "Elige una fecha y hora futuras" })
    if (!n && !jid) return res.json({ ok: false, error: "Falta el contacto o número" })
    if (sch.length >= 200) return res.json({ ok: false, error: "Demasiados recordatorios" })
    const item = { id: crypto.randomBytes(5).toString("hex"), jid: jid || (n ? n + "@s.whatsapp.net" : ""), number: n, name: String(name || "").slice(0, 80), at: when, note: String(note || "").slice(0, 200), video: !!video, fired: false, created: Date.now() }
    sch.push(item); save(SCH, sch)
    res.json({ ok: true, item })
  })
  app.delete("/api/call-schedule/:id", (req, res) => { const l = sch.length; sch = sch.filter(s => s.id !== req.params.id); if (sch.length !== l) save(SCH, sch); res.json({ ok: true }) })
  app.delete("/api/call-schedule", (req, res) => { sch = []; save(SCH, sch); res.json({ ok: true }) })

  // Aviso a la hora indicada (también si el servidor estuvo apagado: avisa al volver)
  const t = setInterval(() => {
    const now = Date.now(); let ch = false
    for (const s of sch) if (!s.fired && s.at <= now) { s.fired = true; s.firedAt = now; ch = true; io.emit("call_reminder", s) }
    if (ch) save(SCH, sch)
  }, 15000)
  t.unref?.()
}
