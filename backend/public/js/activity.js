// Indicadores «escribiendo…» / «grabando audio…» en la lista de chats y dentro del chat + avisos de llamadas programadas
;(function () {
  'use strict'
  if (window.__pgAct) return
  window.__pgAct = true
  const sock = (typeof socket !== 'undefined' && socket) ? socket : (typeof io === 'function' ? io() : null)
  if (!sock) return
  const GREEN = '#21c063', MIC = '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" style="vertical-align:-2px;margin-right:3px"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.8 11.5a6.2 6.2 0 0 0 12.4 0M12 18v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))

  // chatId -> { aliases:Set, kind, who, online, t }
  const act = new Map()
  const find = id => { for (const v of act.values()) if (v.aliases.has(id)) return v; return null }
  const label = (a, chatId) => {
    const g = chatId.endsWith('@g.us'), who = g && a.who ? esc(a.who) + ' ' : ''
    return a.kind === 'recording' ? MIC + who + (g && a.who ? 'está ' : '') + 'grabando audio…' : who + (g && a.who ? 'está ' : '') + 'escribiendo…'
  }

  // ---------- lista de chats (index) ----------
  function paintList() {
    document.querySelectorAll('.chat-item').forEach(el => {
      const id = el._cid, pv = el.querySelector('.chat-preview')
      if (!id || !pv) return
      const a = find(id)
      if (a && a.kind) {
        const html = '<span style="color:' + GREEN + '">' + label(a, id) + '</span>'
        if (pv.dataset.act !== html) { if (pv.dataset.act === undefined) pv._orig = pv.innerHTML; pv.dataset.act = html; pv.innerHTML = html }
      } else if (pv.dataset.act !== undefined) { pv.innerHTML = pv._orig; delete pv.dataset.act }
    })
  }
  if (typeof renderChats === 'function') {
    const __r = renderChats
    renderChats = function () { __r.apply(this, arguments); paintList() }
  }

  // ---------- dentro del chat ----------
  const inChat = typeof chatId !== 'undefined'
  function paintChat() {
    if (!inChat) return
    const el = document.getElementById('chatStatus')
    if (!el) return
    const a = find(chatId)
    if (a && a.kind) { el.innerHTML = label(a, chatId); el.style.setProperty('color', GREEN, 'important'); return }
    el.style.removeProperty('color')
    el.textContent = a && a.online && !chatId.endsWith('@g.us') ? 'en línea' : (window.__def || 'WhatsApp')
  }
  if (inChat) { try { sock.off('presence') } catch (e) {} }   // sustituye al indicador antiguo, que podía quedarse pegado

  function paint() { paintList(); paintChat() }
  sock.on('chat_activity', p => {
    if (!p || !p.chatId) return
    if (p.kind || p.online) act.set(p.chatId, { aliases: new Set([p.chatId, ...(p.aliases || [])]), kind: p.kind, who: p.who || '', online: !!p.online, t: Date.now() })
    else act.delete(p.chatId)
    paint()
  })
  // Un mensaje nuevo del contacto cierra su indicador (como en WhatsApp)
  sock.on('chat_updated', ({ chatId: id, lastMessage }) => {
    if (!lastMessage || lastMessage.fromMe) return
    const a = find(id)
    if (a && a.kind) { a.kind = null; a.who = ''; setTimeout(paint, 0) }
  })
  // Seguridad en el navegador: si no llegan eventos, caduca a los 35 s
  setInterval(() => {
    let ch = false
    for (const [k, v] of act) if (v.kind && Date.now() - v.t > 35000) { v.kind = null; ch = true }
    if (ch) paint()
  }, 2000)
  const resync = () => fetch('/api/activity').then(r => r.json()).then(l => { act.clear(); l.forEach(p => act.set(p.chatId, { aliases: new Set([p.chatId, ...(p.aliases || [])]), kind: p.kind, who: p.who || '', online: !!p.online, t: Date.now() })); paint() }).catch(() => {})
  sock.on('disconnect', () => { act.clear(); paint() })
  sock.on('connect', () => { resync(); subscribe(true) })
  resync()

  // ---------- suscripción de presencia de los chats recientes ----------
  function subscribe(force) {
    if (typeof allChats === 'undefined') return
    const ids = Object.entries(allChats).filter(([id]) => !id.endsWith('@broadcast')).sort((a, b) => (b[1].messages?.at(-1)?.timestamp || 0) - (a[1].messages?.at(-1)?.timestamp || 0)).slice(0, 40).map(e => e[0])
    if (ids.length) sock.emit('subscribe_presence_many', { chatIds: ids })
    return ids.length
  }
  if (typeof allChats !== 'undefined') {
    const t = setInterval(() => { if (subscribe()) clearInterval(t) }, 800)
    setInterval(subscribe, 4 * 60 * 1000)
    setInterval(paintList, 1500)   // por si el listado se redibuja
  }
  setTimeout(paint, 700)

  // ---------- recordatorios de llamadas programadas ----------
  sock.on('call_reminder', s => {
    const who = s.name || (s.number ? '+' + s.number : 'un contacto')
    const b = document.createElement('div')
    b.style.cssText = 'position:fixed;top:calc(10px + env(safe-area-inset-top));left:10px;right:10px;z-index:3000;background:#1d2226;color:#e9edef;border-radius:16px;padding:14px 16px;box-shadow:0 6px 24px rgba(0,0,0,.6);font-family:Roboto,system-ui,sans-serif;display:flex;gap:12px;align-items:center'
    b.innerHTML = '<div style="flex:1"><div style="font-weight:600">⏰ Hora de llamar a ' + esc(who) + '</div><div style="font-size:13px;color:#8d979e;margin-top:2px">' + esc(s.note || 'Recordatorio de llamada programada') + '</div></div><span style="color:' + GREEN + ';font-weight:600;cursor:pointer;padding:6px">Abrir</span><span style="color:#8d979e;cursor:pointer;padding:6px">✕</span>'
    b.children[1].onclick = () => { location.href = '/calls.html#programadas' }
    b.children[2].onclick = () => b.remove()
    document.body.appendChild(b); setTimeout(() => b.remove(), 30000)
    try { if (window.Notification && Notification.permission === 'granted') new Notification('Hora de llamar a ' + who, { body: s.note || 'Llamada programada' }) } catch (e) {}
    try { navigator.vibrate && navigator.vibrate([200, 100, 200]) } catch (e) {}
  })
})()
