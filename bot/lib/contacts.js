// Agenda real que Baileys entrega al bot (contacts.upsert / contacts.update / historial).
// Se guarda en bot/contactos.json para no perderla al reiniciar.
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const FILE  = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'contactos.json')
const store = new Map()
let timer = null

const dig  = j => String(j || '').split('@')[0].split(':')[0].replace(/\D/g, '')
const isPn = j => String(j || '').endsWith('@s.whatsapp.net')
const isLid = j => String(j || '').endsWith('@lid')

try { for (const c of JSON.parse(fs.readFileSync(FILE, 'utf8'))) store.set(c.key, c) } catch {}

function saveSoon() {
  clearTimeout(timer)
  timer = setTimeout(() => { try { fs.writeFileSync(FILE, JSON.stringify([...store.values()])) } catch {} }, 3000)
}

function absorb(c) {
  if (!c || !c.id) return
  const pnJid = isPn(c.id) ? c.id : (c.phoneNumber && isPn(c.phoneNumber) ? c.phoneNumber : (c.pn && isPn(c.pn) ? c.pn : ''))
  const lid   = isLid(c.id) ? c.id : (c.lid && isLid(c.lid) ? c.lid : '')
  const pn    = dig(pnJid)
  const key   = pn || lid
  if (!key) return
  let cur = store.get(key)
  // Si antes estaba guardado solo con LID y ahora conocemos el número, se unifica.
  if (!cur && pn && lid && store.has(lid)) { cur = store.get(lid); store.delete(lid) }
  cur = cur || { key }
  cur.key = key
  if (pn) cur.pn = pn
  if (lid) cur.lid = lid
  if (c.name) cur.name = c.name
  if (c.notify) cur.notify = c.notify
  if (c.verifiedName) cur.verified = c.verifiedName
  store.set(key, cur)
  saveSoon()
}

export function getContacts() { return [...store.values()] }

export function attachContacts(conn) {
  try {
    conn.ev.on('contacts.upsert', list => (list || []).forEach(absorb))
    conn.ev.on('contacts.update', list => (list || []).forEach(absorb))
    conn.ev.on('messaging-history.set', ({ contacts }) => (contacts || []).forEach(absorb))
    conn.ev.on('lid-mapping.update', m => { if (m?.lid && m?.pn) absorb({ id: m.pn, lid: m.lid }) })
  } catch {}
}
