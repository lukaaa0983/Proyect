// Contactos reales y creación de grupos (Baileys 7.0.0-rc14). Rutas: /api/contacts, /api/group-capabilities, /api/group-create
import crypto from "crypto"

const dig   = j => String(j || "").split("@")[0].split(":")[0].replace(/\D/g, "")
const isPn  = j => String(j || "").endsWith("@s.whatsapp.net")
const isLid = j => String(j || "").endsWith("@lid")
const sleep = ms => new Promise(r => setTimeout(r, ms))
const validNum = d => d.length >= 7 && d.length <= 15

export function registerGroupRoutes(app, { getConn, getContacts, db, io }) {
  const lm = conn => conn?.signalRepository?.lidMapping
  const pnOfLid = async (conn, lid) => { try { const r = await lm(conn)?.getPNForLID?.(lid); return r ? dig(r) : "" } catch { return "" } }
  const meOf = conn => ({ pn: dig(conn?.user?.id), lid: dig(conn?.user?.lid) })

  let gcache = { t: 0, list: [] }
  async function groupPeople(conn) {
    if (Date.now() - gcache.t < 300000) return gcache.list
    const out = []
    try {
      const gs = await conn.groupFetchAllParticipating()
      for (const g of Object.values(gs)) for (const p of g.participants || [])
        out.push({ pn: dig(p.phoneNumber || (isPn(p.id) ? p.id : "")), lid: isLid(p.id) ? p.id : (p.lid || "") })
    } catch {}
    gcache = { t: Date.now(), list: out }
    return out
  }

  // ---------- CONTACTOS ----------
  app.get("/api/contacts", async (req, res) => {
    try {
      const conn = getConn()
      if (!conn) return res.json({ ok: false, error: "Bot no conectado" })
      const me = meOf(conn)
      const byPn = new Map(), byLid = new Map(), all = []
      const find = (pn, lid) => (pn && byPn.get(pn)) || (lid && byLid.get(lid)) || null
      const put = e => {
        let c = find(e.pn, e.lid)
        if (!c) { c = { pn: "", lid: "", name: "", notify: "", agenda: false, ts: 0, src: new Set() }; all.push(c) }
        if (e.pn && !c.pn) c.pn = e.pn
        if (e.lid && !c.lid) c.lid = e.lid
        if (e.name && !c.name) c.name = e.name
        if (e.notify && !c.notify) c.notify = e.notify
        if (e.agenda) c.agenda = true
        if (e.ts > c.ts) c.ts = e.ts
        c.src.add(e.src)
        if (c.pn) byPn.set(c.pn, c)
        if (c.lid) byLid.set(c.lid, c)
      }
      const known = getContacts?.() || []
      for (const k of known) put({ pn: k.pn || "", lid: k.lid || "", name: k.name || "", notify: k.notify || k.verified || "", agenda: !!k.name, ts: 0, src: "agenda" })
      const chats = db.getChats()
      for (const [id, c] of Object.entries(chats)) {
        if (!isPn(id) && !isLid(id)) continue
        const n = dig(id)
        const nm = c.name && !c.name.includes("@") && dig(c.name) !== n ? c.name : ""
        put({ pn: isPn(id) ? n : "", lid: isLid(id) ? id : "", name: "", notify: nm, ts: c.messages?.at(-1)?.timestamp || 0, src: "chat" })
      }
      for (const p of await groupPeople(conn)) put({ ...p, ts: 0, src: "grupo" })
      // Resuelve LID -> número real (nunca se inventa: si no hay mapeo queda sin número)
      await Promise.all(all.filter(c => !c.pn && c.lid).map(async c => { const pn = await pnOfLid(conn, c.lid); if (pn) { c.pn = pn; if (!byPn.has(pn)) byPn.set(pn, c) } }))
      const out = []
      const seen = new Set()
      for (const c of all) {
        if (c.pn && (c.pn === me.pn)) continue
        if (c.lid && dig(c.lid) === me.lid) continue
        if (c.pn && !validNum(c.pn)) continue
        const key = c.pn ? c.pn + "@s.whatsapp.net" : c.lid
        if (!key || seen.has(key)) continue
        seen.add(key)
        const src = [...c.src]
        out.push({ id: key, jid: c.pn ? c.pn + "@s.whatsapp.net" : "", lid: c.lid || "", number: c.pn || "", name: c.name || c.notify || "", notify: c.notify || "", agenda: c.agenda, ts: c.ts, onlyGroups: src.length === 1 && src[0] === "grupo" })
      }
      const frequent = out.filter(c => c.ts > 0).sort((a, b) => b.ts - a.ts).slice(0, 5).map(c => c.id)
      res.json({ ok: true, me: { number: me.pn, name: conn.user?.name || "" }, agendaCount: known.filter(k => k.name).length, contacts: out, frequent })
    } catch (e) { res.json({ ok: false, error: e?.message || "Error" }) }
  })

  app.get("/api/group-capabilities", (req, res) => {
    const conn = getConn()
    res.json({
      ok: !!conn,
      memberAddMode: typeof conn?.groupMemberAddMode === "function",
      joinApproval: typeof conn?.groupJoinApprovalMode === "function",
      announce: typeof conn?.groupSettingUpdate === "function",
      ephemeral: typeof conn?.groupToggleEphemeral === "function",
      photo: typeof conn?.updateProfilePicture === "function",
      invitePermission: false
    })
  })

  // ---------- CREAR GRUPO ----------
  const inflight = new Map(), done = new Map()

  async function resolveEntries(conn, list, me) {
    const out = [], seen = new Set(), skipped = []
    for (const p of list) {
      const label = p.name || (p.number ? "+" + p.number : "Contacto")
      let pn = isPn(p.jid) ? dig(p.jid) : (isPn(p.id) ? dig(p.id) : dig(p.number))
      let lid = isLid(p.lid) ? p.lid : (isLid(p.id) ? p.id : "")
      if (!pn && lid) pn = await pnOfLid(conn, lid)
      if (pn && !validNum(pn)) { skipped.push({ name: label, reason: "Número no válido" }); continue }
      if (!pn && !lid) { skipped.push({ name: label, reason: "Sin identificador" }); continue }
      if (pn === me.pn || (lid && dig(lid) === me.lid)) continue
      const k = pn || lid
      if (seen.has(k)) continue
      seen.add(k)
      out.push({ pn, lid, label })
    }
    return { out, skipped }
  }

  async function doCreate(conn, body) {
    const subject = String(body.subject || "").trim().slice(0, 100)
    const me = meOf(conn)
    const raw = Array.isArray(body.participants) ? body.participants : (body.numbers || []).map(n => ({ number: String(n) }))
    const { out: entries, skipped } = await resolveEntries(conn, raw, me)
    if (!entries.length) return { ok: false, error: "No hay participantes válidos", skipped }

    // Verifica que cada número exista en WhatsApp (en lotes)
    const pns = entries.filter(e => e.pn).map(e => e.pn)
    const canon = new Map()
    let verified = true
    try {
      for (let i = 0; i < pns.length; i += 40) {
        const r = await conn.onWhatsApp(...pns.slice(i, i + 40))
        for (const x of r || []) if (x?.exists) canon.set(dig(x.jid), x.jid)
      }
    } catch { verified = false }
    const good = [], laterLids = []
    for (const e of entries) {
      if (e.pn) {
        if (verified && !canon.has(e.pn)) { skipped.push({ name: e.label, reason: "No tiene WhatsApp" }); continue }
        good.push({ ...e, jid: canon.get(e.pn) || e.pn + "@s.whatsapp.net" })
      } else laterLids.push(e)
    }
    if (!good.length && !laterLids.length) return { ok: false, error: "Ningún participante válido", skipped }

    let g
    try { g = await conn.groupCreate(subject, good.length ? good.map(e => e.jid) : laterLids.map(e => e.lid)) }
    catch (e) {
      const m = String(e?.message || "")
      return { ok: false, error: /rate|overlimit|429/i.test(m) ? "WhatsApp limitó la creación de grupos. Espera unos minutos." : (!subject ? "WhatsApp no aceptó crear el grupo sin nombre desde el bot: escribe un nombre. (" + m + ")" : m || "No se pudo crear el grupo"), skipped }
    }
    const gid = g.id
    const applied = [], failed = []
    const step = async (what, fn) => { try { await fn(); applied.push(what) } catch (e) { failed.push({ what, error: e?.message || "Error" }) } await sleep(350) }
    const s = body.settings || {}

    if (good.length && laterLids.length) await step("Participantes con ID oculto", async () => {
      const r = await conn.groupParticipantsUpdate(gid, laterLids.map(e => e.lid), "add")
      for (const x of r || []) if (String(x.status) !== "200") throw new Error("no se pudo añadir a " + dig(x.jid))
    })
    let meta = g
    try { meta = await conn.groupMetadata(gid) } catch {}
    const sec = Number(s.ephemeral) || 0
    if (sec > 0) await step("Mensajes temporales", () => conn.groupToggleEphemeral(gid, sec))
    if (typeof conn.groupMemberAddMode === "function") {
      const all = s.memberAddMode !== "admin"
      if (meta.memberAddMode === undefined ? !all : !!meta.memberAddMode !== all) await step("Añadir nuevos miembros", () => conn.groupMemberAddMode(gid, all ? "all_member_add" : "admin_add"))
    }
    if (!!meta.announce !== !!s.announce) await step("Quién envía mensajes", () => conn.groupSettingUpdate(gid, s.announce ? "announcement" : "not_announcement"))
    if (!!meta.restrict !== !!s.locked) await step("Quién edita ajustes", () => conn.groupSettingUpdate(gid, s.locked ? "locked" : "unlocked"))
    if (!!meta.joinApprovalMode !== !!s.approval) await step("Aprobación de admin", () => conn.groupJoinApprovalMode(gid, s.approval ? "on" : "off"))
    if (body.photo && /^data:image\//.test(body.photo)) await step("Foto del grupo", () => conn.updateProfilePicture(gid, Buffer.from(String(body.photo).split(",")[1], "base64")))

    let finalMeta = meta
    try { finalMeta = await conn.groupMetadata(gid) } catch {}
    const present = new Set()
    for (const p of finalMeta.participants || []) for (const x of [p.id, p.phoneNumber, p.lid]) if (x) present.add(dig(x))
    const notAdded = [...good, ...laterLids].filter(e => !((e.pn && present.has(e.pn)) || (e.lid && present.has(dig(e.lid))))).map(e => ({ name: e.label, reason: "No se pudo añadir (privacidad del contacto o no disponible)" }))

    const name = finalMeta.subject || subject || gid
    const msg = { type: "system", content: "Creaste el grupo \"" + name + "\"", fromMe: true, senderName: "", senderId: gid, isGroup: true, timestamp: Date.now(), waMessageKey: null, mediaUrl: null, replyTo: null }
    try {
      const nm = db.saveMessage(gid, name, msg)
      io.emit("chat_updated", { chatId: gid, name: nm, lastMessage: msg })
    } catch {}
    return { ok: true, id: gid, subject: name, size: finalMeta.participants?.length || entries.length + 1, applied, failed, skipped, notAdded, unsupported: ["Compartir invitación al grupo"] }
  }

  app.post("/api/group-create", async (req, res) => {
    try {
      const conn = getConn()
      if (!conn) return res.json({ ok: false, error: "El bot no está conectado a WhatsApp" })
      const body = req.body || {}
      const ids = (Array.isArray(body.participants) ? body.participants : (body.numbers || [])).map(p => typeof p === "object" ? (p.id || p.jid || p.lid || p.number) : p).map(String).sort()
      const fp = crypto.createHash("sha1").update(String(body.subject || "").trim() + "|" + ids.join(",")).digest("hex")
      const prev = done.get(fp)
      if (prev && Date.now() - prev.t < 120000) return res.json({ ...prev.r, duplicate: true })
      if (inflight.has(fp)) return res.json({ ...(await inflight.get(fp)), duplicate: true })
      const p = doCreate(conn, body)
      inflight.set(fp, p)
      try {
        const r = await p
        if (r.ok) done.set(fp, { t: Date.now(), r })
        res.json(r)
      } finally { inflight.delete(fp) }
    } catch (e) { res.json({ ok: false, error: e?.message || "Error" }) }
  })
}
