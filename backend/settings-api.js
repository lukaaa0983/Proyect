// Rutas del apartado Ajustes. Se mantiene en un archivo aparte para no tocar el resto del servidor.
// Todo lo que hace WhatsApp pasa por Baileys (conn.*); aquí no se simula nada.
import fs from "fs"
import path from "path"

// clave del panel -> { método de Baileys, valores que Baileys acepta }
export const PRIVACY = {
  last:         { fn: "updateLastSeenPrivacy",       values: ["all", "contacts", "none"] },
  online:       { fn: "updateOnlinePrivacy",         values: ["all", "match_last_seen"] },
  profile:      { fn: "updateProfilePicturePrivacy", values: ["all", "contacts", "none"] },
  status:       { fn: "updateStatusPrivacy",         values: ["all", "contacts", "none"] },
  readreceipts: { fn: "updateReadReceiptsPrivacy",   values: ["all", "none"] },
  groupadd:     { fn: "updateGroupsAddPrivacy",      values: ["all", "contacts"] }
}

const errMsg = e => e?.message || "Error"
const NO_API = "Esta versión de Baileys no ofrece esta operación"

async function dirStats(dir) {
  let files = 0, bytes = 0
  let names = []
  try { names = await fs.promises.readdir(dir) } catch { return { files, bytes } }
  for (const n of names) {
    try {
      const st = await fs.promises.stat(path.join(dir, n))
      if (st.isFile()) { files++; bytes += st.size }
    } catch {}
  }
  return { files, bytes }
}

export function registerSettingsRoutes(app, { getConn, mediaDir, dataDir, rootDir }) {
  // ── Privacidad: leer ──
  app.get("/api/privacy", async (req, res) => {
    try {
      const conn = getConn()
      if (!conn) return res.json({ ok: false, error: "El bot no está conectado" })
      if (typeof conn.fetchPrivacySettings !== "function") return res.json({ ok: false, error: NO_API })
      const s = await conn.fetchPrivacySettings(true)
      const out = {}
      for (const k of Object.keys(PRIVACY)) if (s && s[k] !== undefined) out[k] = s[k]
      res.json({ ok: true, settings: out })
    } catch (e) { res.json({ ok: false, error: errMsg(e) }) }
  })

  // ── Privacidad: cambiar. Después se vuelve a consultar a WhatsApp para comprobar que lo aceptó ──
  app.post("/api/privacy", async (req, res) => {
    try {
      const { key, value } = req.body || {}
      const def = Object.prototype.hasOwnProperty.call(PRIVACY, key) ? PRIVACY[key] : null
      if (!def) return res.json({ ok: false, error: "Opción de privacidad desconocida" })
      if (!def.values.includes(value)) return res.json({ ok: false, error: "Valor no permitido para esta opción" })
      const conn = getConn()
      if (!conn) return res.json({ ok: false, error: "El bot no está conectado" })
      if (typeof conn[def.fn] !== "function") return res.json({ ok: false, error: NO_API })
      await conn[def.fn](value)
      const after = await conn.fetchPrivacySettings(true)
      if (after && after[key] !== undefined && after[key] !== value) {
        return res.json({ ok: false, error: "WhatsApp no aplicó el cambio", current: after[key] })
      }
      res.json({ ok: true, value: after && after[key] !== undefined ? after[key] : value, verified: !!(after && after[key] !== undefined) })
    } catch (e) { res.json({ ok: false, error: errMsg(e) }) }
  })

  // ── Almacenamiento: solo lectura ──
  app.get("/api/storage-summary", async (req, res) => {
    try {
      const media = await dirStats(mediaDir)
      let db = 0
      for (const f of ["chat.db", "chat.db-wal", "chat.db-shm"]) {
        try { db += (await fs.promises.stat(path.join(dataDir, f))).size } catch {}
      }
      res.json({ ok: true, media, dbBytes: db })
    } catch (e) { res.json({ ok: false, error: errMsg(e) }) }
  })

  // ── Información del panel ──
  app.get("/api/about", (req, res) => {
    let version = ""
    try { version = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8")).version || "" } catch {}
    const conn = getConn()
    res.json({
      ok: true, name: "Proyecto G Chat", version,
      node: process.version, uptime: Math.round(process.uptime()),
      bot: conn ? "conectado" : "desconectado"
    })
  })
}

// Añade <script src="/js/prefs.js"> a las páginas HTML para que las preferencias de accesibilidad
// se apliquen en todo el panel sin editar cada página.
export function prefsInjector(publicDir) {
  const root = path.resolve(publicDir)
  const TAG = '<script src="/js/prefs.js"></script>'
  return (req, res, next) => {
    if (req.method !== "GET") return next()
    let p
    try { p = decodeURIComponent(req.path) } catch { return next() }
    if (p.endsWith("/")) p += "index.html"
    if (!/\.html$/i.test(p)) return next()
    const file = path.resolve(root, "." + p)
    if (!file.startsWith(root + path.sep)) return next()
    fs.readFile(file, "utf8", (err, html) => {
      if (err) return next()
      if (!html.includes("/js/prefs.js")) html = html.includes("</head>") ? html.replace("</head>", () => TAG + "</head>") : TAG + html
      res.type("html").send(html)
    })
  }
}
