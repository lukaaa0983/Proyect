// Apartado de Llamadas estilo WhatsApp. Usa: /calls, /calls/delete, /chats, /api/me, /api/pfp, /api/pn, /api/check,
// /api/call-favorites, /api/call-schedule (los dos últimos son nuevos).
;(function () {
  'use strict'
  const $ = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e }
  const SV = (p, w, sw, fill) => '<svg viewBox="0 0 24 24" width="' + (w || 24) + '" height="' + (w || 24) + '" fill="' + (fill || 'none') + '" stroke="' + (fill ? 'none' : 'currentColor') + '" stroke-width="' + (sw || 1.9) + '" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>'
  const PH = 'M20 15.5c-1.25 0-2.45-.2-3.57-.57a1 1 0 0 0-1.02.24l-2.2 2.2a15 15 0 0 1-6.59-6.59l2.2-2.21a1 1 0 0 0 .25-1A11.4 11.4 0 0 1 8.5 4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.5c0-.55-.45-1-1-1z'
  const IC = {
    search: SV('<circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.8-4.8"/>', 26, 2),
    dots: '<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>',
    back: SV('<path d="M20 12H5M11 5l-7 7 7 7"/>', 26, 2),
    x: SV('<path d="M6 6l12 12M18 6L6 18"/>', 24, 2),
    phone: SV('<path d="' + PH + '"/>', 28, 1.7), phoneF: SV('<path d="' + PH + '"/>', 26, 0, 'currentColor'),
    video: SV('<rect x="3" y="6.5" width="12.5" height="11" rx="2.6"/><path d="M15.5 10.5l5.5-3v9l-5.5-3"/>', 28, 1.7),
    cal: SV('<rect x="3.5" y="5" width="17" height="15.5" rx="2.6"/><path d="M8 3v4M16 3v4M3.5 10h17M8 14h.01M12 14h.01M16 14h.01M8 17.3h.01M12 17.3h.01"/>', 28, 1.8),
    keys: '<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">' + [5, 12, 19].map(x => [4, 10, 16].map(y => '<circle cx="' + x + '" cy="' + y + '" r="1.9"/>').join('')).join('') + '<circle cx="12" cy="22" r="1.9"/></svg>',
    people: '<svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor"><circle cx="9" cy="8" r="3.6"/><path d="M2.3 20c0-3.6 3.2-5.6 6.7-5.6s6.7 2 6.7 5.6z"/><circle cx="17.4" cy="9" r="2.8"/><path d="M17.8 14.4c2.5.2 4.2 1.9 4.2 4.4v1.2h-4.4c0-2-.6-3.8-1.7-5.1.5-.4 1.1-.5 1.9-.5z"/></svg>',
    heart: SV('<path d="M12 20.3S4.2 15.6 2.8 10.7C1.9 7.6 4 4.9 6.9 4.9c2 0 3.6 1 5.1 3.1 1.5-2.1 3.1-3.1 5.1-3.1 2.9 0 5 2.7 4.1 5.8-1.4 4.9-9.2 9.6-9.2 9.6z"/>', 28, 1.8),
    heartF: SV('<path d="M12 20.3S4.2 15.6 2.8 10.7C1.9 7.6 4 4.9 6.9 4.9c2 0 3.6 1 5.1 3.1 1.5-2.1 3.1-3.1 5.1-3.1 2.9 0 5 2.7 4.1 5.8-1.4 4.9-9.2 9.6-9.2 9.6z"/>', 26, 0, 'currentColor'),
    in: SV('<path d="M17.5 6.5l-10 10M7 9.5V17h7.5"/>', 20, 2), out: SV('<path d="M6.5 17.5l10-10M9.5 7H17v7.5"/>', 20, 2),
    fab: '<svg viewBox="0 0 24 24" width="30" height="30"><path fill="currentColor" d="' + PH + '" transform="translate(-1.5 1.5) scale(.9)"/><path d="M17.5 3v6M14.5 6h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>',
    trash: SV('<path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13M10 11v5M14 11v5"/>', 26, 1.9),
    person: '<svg viewBox="0 0 24 24" width="52%" height="52%" fill="currentColor"><circle cx="12" cy="8" r="4.2"/><path d="M3.8 21c0-4.2 3.6-6.6 8.2-6.6s8.2 2.4 8.2 6.6z"/></svg>',
    bksp: SV('<path d="M21 5H9l-6 7 6 7h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1zM17 9.5l-5 5M12 9.5l5 5"/>', 28, 1.8),
    info: SV('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>', 24, 2),
    chat: SV('<path d="M4 5h16v11H9l-5 4z"/>', 24, 1.8), wa: SV('<path d="M4.2 19.8l1.3-4.2A8.3 8.3 0 1 1 8.6 18.6z"/><path d="M9 8.6c.2 2.9 2.6 5.5 5.6 6.4l1.4-1.5-2.1-1.2-.9.7c-.8-.4-1.5-1.1-1.9-1.9l.7-.9L10.6 8z"/>', 24, 1.7)
  }
  const PAL = [['#0d3b4f', '#4db8e8'], ['#0f3f38', '#4fd1b5'], ['#133b22', '#3fd07a'], ['#3d2f1c', '#e8b64d'], ['#3a2147', '#c58be8'], ['#4a2326', '#ef8a8a']]
  const hue = k => { let h = 0; for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0; return PAL[h % PAL.length] }
  const dig = s => String(s || '').split('@')[0].split(':')[0].replace(/\D/g, '')
  const fmtNum = n => !n ? '' : (n.startsWith('598') && n.length === 11 ? '+598 ' + n.slice(3).replace(/^(\d{2})(\d{3})(\d{3})$/, '$1 $2 $3') : '+' + n)
  const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

  // ---------- estado ----------
  let calls = [], chats = {}, favs = [], me = { number: '' }
  let filter = 'all', query = '', searching = false
  const sel = new Set()
  const DEF = { group: true, showGroupCalls: true, rejectedAsMissed: true, h12: false }
  let S = { ...DEF }; try { S = { ...DEF, ...JSON.parse(localStorage.getItem('callSettings') || '{}') } } catch (e) {}
  const saveS = () => { try { localStorage.setItem('callSettings', JSON.stringify(S)) } catch (e) {} }

  // ---------- utilidades de interfaz ----------
  let tT
  const toast = t => { document.querySelectorAll('.wc-toast').forEach(x => x.remove()); const m = $('div', 'wc-toast'); m.textContent = t; document.body.appendChild(m); clearTimeout(tT); tT = setTimeout(() => m.remove(), 2600) }
  const layers = []
  const push = f => { layers.push(f); history.pushState({ wc: layers.length }, '') }
  const pop = () => { if (layers.length) history.back() }
  window.addEventListener('popstate', () => { const f = layers.pop(); if (f) f() })
  function dlg(title, msg, btns) {
    const d = $('div', 'wc-dim', '<div class="wc-dlg"><h3></h3><p></p><div class="wc-bt"></div></div>')
    d.querySelector('h3').textContent = title; d.querySelector('p').textContent = msg
    if (!title) d.querySelector('h3').remove(); if (!msg) d.querySelector('p').remove()
    btns.forEach(([l, f, red]) => { const s = $('span'); s.textContent = l; if (red) s.style.color = '#f0536a'; s.onclick = () => { d.remove(); f && f() }; d.querySelector('.wc-bt').appendChild(s) })
    d.onclick = e => { if (e.target === d) d.remove() }
    document.body.appendChild(d)
  }
  function sheet(title, rows, note) {
    const d = $('div', 'wc-dim wc-end', '<div class="wc-sheet"><div class="wc-st"></div><div class="rows"></div><div class="wc-note"></div></div>')
    d.querySelector('.wc-st').textContent = title
    rows.forEach(([ic, t, sub, fn, red]) => {
      const r = $('div', 'wc-sr', '<span class="i">' + ic + '</span><div><div class="t"></div><div class="s"></div></div>')
      r.querySelector('.t').textContent = t; if (sub) r.querySelector('.s').textContent = sub; else r.querySelector('.s').remove()
      if (red) r.firstChild.style.color = r.querySelector('.t').style.color = '#f0536a'
      r.onclick = () => { d.remove(); fn && fn() }; d.querySelector('.rows').appendChild(r)
    })
    if (note) d.querySelector('.wc-note').textContent = note; else d.querySelector('.wc-note').remove()
    d.onclick = e => { if (e.target === d) d.remove() }
    document.body.appendChild(d)
  }
  function screen(title, bodyEl, actions) {
    const el = $('div', 'wc-scr', '<div class="wc-sh"><span class="wc-ib" id="sb">' + IC.back + '</span><div class="wc-stt"></div><div class="wc-sa"></div></div><div class="wc-sb"></div>')
    el.querySelector('.wc-stt').textContent = title
    el.querySelector('#sb').onclick = pop
    ;(actions || []).forEach(a => el.querySelector('.wc-sa').appendChild(a))
    el.querySelector('.wc-sb').appendChild(bodyEl)
    document.body.appendChild(el); push(() => el.remove())
    return el
  }

  // ---------- avatares ----------
  const PFP = (() => { try { return JSON.parse(localStorage.getItem('pfpCache') || '{}') } catch (e) { return {} } })()
  const pq = []; let pb = 0
  const pump = () => {
    while (pb < 4 && pq.length) {
      const [id, el] = pq.shift(); pb++
      const end = () => { pb--; pump() }, c = PFP[id]
      const show = u => { const im = new Image(); im.onload = () => { el.innerHTML = ''; el.style.backgroundImage = 'url("' + u + '")' }; im.src = u }
      if (c && c.url) show(c.url)
      if (c && Date.now() - c.t < 6 * 3600e3) { end(); continue }
      fetch('/api/pfp/' + encodeURIComponent(id)).then(r => r.json()).then(r => { PFP[id] = { url: r.url || '', t: Date.now() }; try { localStorage.setItem('pfpCache', JSON.stringify(PFP)) } catch (e) {} if (r.url) show(r.url) }).catch(() => {}).finally(end)
    }
  }
  const io2 = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { io2.unobserve(e.target); pq.push([e.target._pid, e.target]); pump() } }), { rootMargin: '150px' }) : null
  function avatar(key, jid, size) {
    const [bg, fg] = hue(key || 'x'), a = $('div', 'wc-av', IC.person)
    a.style.cssText = 'background-color:' + bg + ';color:' + fg + ';width:' + size + 'px;height:' + size + 'px'
    if (jid) { a._pid = jid; if (io2) io2.observe(a); else { pq.push([jid, a]); pump() } }
    return a
  }

  // ---------- datos de llamadas ----------
  const numOf = c => dig(c.from)
  const dirOf = c => me.number && numOf(c) === me.number ? 'out' : 'in'
  function kindOf(c) {
    if (c.status === 'timeout') return 'missed'
    if (c.status === 'reject') return 'rejected'
    if (c.status === 'accept') return dirOf(c)
    return 'other'                       // offer / terminate sin más datos: no se inventa un estado
  }
  const isMissed = c => { const k = kindOf(c); return k === 'missed' || (S.rejectedAsMissed && k === 'rejected') }
  const STXT = { missed: 'Perdida', rejected: 'Rechazada', in: 'Entrante · contestada', out: 'Saliente · contestada', other: 'Sin resolver' }
  const nameByNum = () => {
    const m = {}
    for (const [id, c] of Object.entries(chats)) {
      if (!id.endsWith('@s.whatsapp.net')) continue
      const nm = c.name && !c.name.includes('@') && dig(c.name) !== dig(id) ? c.name : ''
      if (nm) m[dig(id)] = nm
    }
    return m
  }
  function dateStr(ts) {
    const d = new Date(ts), now = new Date(), y = new Date(now); y.setDate(y.getDate() - 1)
    const hm = d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hour12: S.h12 })
    const day = d.toDateString() === now.toDateString() ? 'Hoy' : d.toDateString() === y.toDateString() ? 'Ayer' : d.getDate() + ' de ' + MES[d.getMonth()] + (d.getFullYear() !== now.getFullYear() ? ' de ' + d.getFullYear() : '')
    return day + ', ' + hm
  }
  function view() {
    const nm = nameByNum(), q = norm(query), qd = query.replace(/\D/g, '')
    let list = calls.slice().sort((a, b) => (b.date || 0) - (a.date || 0))
    if (!S.showGroupCalls) list = list.filter(c => !c.isGroup)
    if (filter === 'missed') list = list.filter(isMissed)
    const rows = list.map(c => { const n = numOf(c); return { c, num: n, title: c.name || nm[n] || fmtNum(n) || 'Desconocido', kind: kindOf(c) } })
    const f = q ? rows.filter(r => norm(r.title).includes(q) || (qd && r.num.includes(qd)) || norm(dateStr(r.c.date || 0)).includes(q)) : rows
    if (!S.group) return f.map(r => ({ ...r, items: [r.c] }))
    const out = []
    for (const r of f) {
      const l = out[out.length - 1], key = r.num || r.c.from || r.title
      if (l && l.key === key && l.kind === r.kind && new Date(l.c.date || 0).toDateString() === new Date(r.c.date || 0).toDateString() && !!l.c.isVideo === !!r.c.isVideo) l.items.push(r.c)
      else out.push({ ...r, key, items: [r.c] })
    }
    return out
  }

  // ---------- pantalla principal ----------
  const main = document.getElementById('wcMain'), head = document.getElementById('wcHead')
  function drawHead() {
    head.innerHTML = ''
    if (sel.size) {
      head.className = 'wc-head sel'
      const x = $('span', 'wc-ib', IC.x); x.onclick = () => { sel.clear(); drawHead(); drawList() }
      const n = $('div', 'wc-hn'); n.textContent = sel.size
      const t = $('span', 'wc-ib', IC.trash); t.onclick = () => delIds([...sel], '¿Borrar las llamadas seleccionadas?')
      head.append(x, n, t); return
    }
    if (searching) {
      head.className = 'wc-head'
      const b = $('span', 'wc-ib', IC.back); b.onclick = () => { searching = false; query = ''; drawHead(); drawList() }
      const i = $('input', 'wc-si'); i.placeholder = 'Buscar'; i.value = query; i.oninput = () => { query = i.value; drawList() }
      head.append(b, i); setTimeout(() => i.focus(), 50); return
    }
    head.className = 'wc-head'
    const t = $('div', 'wc-title'); t.textContent = 'Llamadas'
    const s = $('span', 'wc-ib', IC.search); s.onclick = () => { searching = true; drawHead() }
    const m = $('span', 'wc-ib', IC.dots); m.onclick = openMenu
    head.append(t, s, m)
  }
  function openMenu() {
    const d = $('div', 'wc-dim wc-clear', '<div class="wc-menu"></div>')
    ;[['Borrar registro de llamadas', askClear], ['Llamadas programadas', openScheduled], ['Ajustes', openSettings]].forEach(([l, f]) => { const r = $('div', 'wc-mi'); r.textContent = l; r.onclick = () => { d.remove(); f() }; d.firstChild.appendChild(r) })
    d.onclick = e => { if (e.target === d) d.remove() }
    document.body.appendChild(d)
  }
  function askClear() {
    const ids = filter === 'missed' ? calls.filter(isMissed).map(c => c.id) : null
    if (!calls.length) return toast('No hay llamadas en el registro')
    if (ids && !ids.length) return toast('No hay llamadas perdidas')
    dlg('Borrar registro de llamadas', ids ? '¿Borrar las ' + ids.length + ' llamadas perdidas?' : '¿Borrar todo el registro de llamadas? No se puede deshacer.', [['Cancelar'], ['Borrar', () => delIds(ids, null), true]])
  }
  async function delIds(ids, ask) {
    const go = async () => {
      try { const r = await fetch('/calls/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) }); if (!r.ok) throw 0 } catch (e) { return toast('No se pudo borrar. Inténtalo de nuevo.') }
      calls = ids ? calls.filter(c => !ids.includes(c.id)) : []
      sel.clear(); drawHead(); drawList(); toast('Registro borrado')
    }
    if (ask) dlg('', ask, [['Cancelar'], ['Borrar', go, true]]); else go()
  }

  function quick() {
    const q = $('div', 'wc-quick')
    ;[['Llamar', IC.phone, () => pickContact(t => callSheet(t)), ''], ['Programar', IC.cal, () => openScheduleForm(), ''], ['Teclado', IC.keys, openKeypad, ''], ['Grupo', IC.people, groupInfo, 'g'], ['Favoritos', IC.heart, openFavs, '']].forEach(([l, ic, fn, cls]) => {
      const b = $('div', 'wc-q', '<div class="c ' + cls + '">' + ic + '</div><div class="l"></div>'); b.querySelector('.l').textContent = l; b.onclick = fn; q.appendChild(b)
    })
    return q
  }
  function drawList() {
    main.innerHTML = ''
    if (!searching || !query) main.appendChild(quick())
    const hr = $('div', 'wc-rh', '<div class="wc-rt"></div><div class="wc-chips"></div>')
    hr.firstChild.textContent = searching && query ? 'Resultados' : 'Recientes'
    ;[['all', 'Todas'], ['missed', 'Perdidas']].forEach(([k, l]) => { const c = $('span', 'wc-chip' + (filter === k ? ' on' : '')); c.textContent = l; c.onclick = () => { filter = k; drawList() }; hr.lastChild.appendChild(c) })
    main.appendChild(hr)
    const gs = view()
    if (!gs.length) {
      const e = $('div', 'wc-empty'); e.textContent = query ? 'No se encontraron llamadas' : (filter === 'missed' ? 'No hay llamadas perdidas' : 'Sin llamadas todavía. Las llamadas que recibas aparecerán aquí.'); main.appendChild(e)
    }
    gs.forEach(g => main.appendChild(row(g)))
    main.appendChild($('div', 'wc-pad'))
  }
  function row(g) {
    const c = g.c, miss = g.kind === 'missed' || g.kind === 'rejected', ids = g.items.map(x => x.id), on = ids.every(i => sel.has(i))
    const r = $('div', 'wc-row' + (on ? ' on' : ''), '<div class="av"></div><div class="tx"><div class="nm"></div><div class="sb"></div></div><span class="cb"></span>')
    r.querySelector('.av').replaceWith(avatar(g.key, c.from || (g.num ? g.num + '@s.whatsapp.net' : ''), 54))
    const nm = r.querySelector('.nm'); nm.textContent = g.title + (g.items.length > 1 ? ' (' + g.items.length + ')' : ''); if (miss) nm.style.color = '#f0536a'
    const ar = g.kind === 'out' ? IC.out : IC.in
    r.querySelector('.sb').innerHTML = '<span class="ar" style="color:' + (miss ? '#f0536a' : g.kind === 'other' ? '#8d979e' : '#21c063') + '">' + ar + '</span><span></span>'
    r.querySelector('.sb').lastChild.textContent = dateStr(c.date || 0)
    const cb = r.querySelector('.cb'); cb.innerHTML = c.isVideo ? IC.video : IC.phone
    cb.onclick = e => { e.stopPropagation(); callSheet({ jid: c.from || '', number: g.num, name: g.title === fmtNum(g.num) ? '' : g.title, video: !!c.isVideo }) }
    let t, lp = false
    r.addEventListener('touchstart', () => { lp = false; t = setTimeout(() => { lp = true; navigator.vibrate?.(15); toggleSel(ids) }, 450) }, { passive: true })
    ;['touchend', 'touchmove', 'touchcancel'].forEach(ev => r.addEventListener(ev, () => clearTimeout(t), { passive: true }))
    r.addEventListener('contextmenu', e => { e.preventDefault(); toggleSel(ids) })
    r.onclick = () => { if (lp) { lp = false; return } if (sel.size) toggleSel(ids); else detail(g) }
    return r
  }
  function toggleSel(ids) { const all = ids.every(i => sel.has(i)); ids.forEach(i => all ? sel.delete(i) : sel.add(i)); drawHead(); drawList() }

  function detail(g) {
    const c = g.c, name = g.title, isFav = favs.some(f => f.id === (g.num || c.from))
    const rows = [
      [IC.phone, 'Volver a llamar', 'Opciones para llamar', () => callSheet({ jid: c.from || '', number: g.num, name: g.title === fmtNum(g.num) ? '' : g.title, video: !!c.isVideo })],
      [IC.chat, 'Abrir chat en el panel', '', () => openChat(c)],
      [isFav ? IC.heartF : IC.heart, isFav ? 'Quitar de favoritos' : 'Añadir a favoritos', '', () => toggleFav({ jid: c.from || '', number: g.num, name: g.title === fmtNum(g.num) ? '' : g.title })],
      [IC.trash, g.items.length > 1 ? 'Eliminar estos ' + g.items.length + ' registros' : 'Eliminar este registro', '', () => delIds(g.items.map(x => x.id), null), true]
    ]
    const lines = g.items.slice(0, 6).map(x => STXT[kindOf(x)] + (x.isVideo ? ' (vídeo)' : '') + ' · ' + dateStr(x.date || 0)).join('\n')
    sheet(name + (g.num ? ' · ' + fmtNum(g.num) : ''), rows, lines + (g.items.length > 6 ? '\n…' : ''))
  }
  async function openChat(c) {
    try { const r = await (await fetch('/api/resolve?jid=' + encodeURIComponent(c.from || '') + '&name=' + encodeURIComponent(c.name || ''))).json(); location.href = '/chat.html?id=' + encodeURIComponent(r.id) } catch (e) { toast('No se pudo abrir el chat') }
  }

  // ---------- llamar (opciones reales) ----------
  async function ensureNumber(t) {
    if (t.number) return t.number
    if (t.jid && t.jid.endsWith('@lid')) { try { const r = await (await fetch('/api/pn/' + encodeURIComponent(t.jid))).json(); if (r.pn) { t.number = r.pn; return r.pn } } catch (e) {} }
    return ''
  }
  async function callSheet(t) {
    const n = await ensureNumber(t), name = t.name || (n ? fmtNum(n) : 'Contacto')
    const rows = []
    if (n) {
      rows.push([IC.phone, 'Llamar por teléfono', 'Marcador del móvil: llamada normal, no de WhatsApp', () => { location.href = 'tel:+' + n }])
      rows.push([IC.wa, 'Abrir en WhatsApp', 'Allí puedes iniciar la llamada de ' + (t.video ? 'vídeo' : 'voz'), () => { window.open('https://wa.me/' + n, '_blank') }])
    }
    rows.push([IC.chat, 'Abrir chat en el panel', '', async () => { try { const jid = t.jid || (n + '@s.whatsapp.net'); const r = await (await fetch('/api/resolve?jid=' + encodeURIComponent(jid) + '&name=' + encodeURIComponent(t.name || ''))).json(); location.href = '/chat.html?id=' + encodeURIComponent(r.id) } catch (e) { toast('No se pudo abrir el chat') } }])
    sheet(name, rows, n ? 'Este panel no puede iniciar llamadas de WhatsApp: Baileys solo informa de las llamadas entrantes.' : 'No tengo el número de este contacto, por eso no se puede llamar.')
  }

  // ---------- selector de contacto ----------
  function pickContact(cb, title) {
    const body = $('div', 'wc-pk', '<div class="wc-pks"><input placeholder="Buscar nombre o número"></div><div class="lst"></div>')
    const inp = body.querySelector('input'), lst = body.querySelector('.lst')
    const people = Object.entries(chats).filter(([id]) => (id.endsWith('@s.whatsapp.net') || id.endsWith('@lid'))).map(([id, c]) => {
      const n = id.endsWith('@lid') ? '' : dig(id), nm = c.name && !c.name.includes('@') && dig(c.name) !== n ? c.name : ''
      return { id, jid: id, number: n, name: nm, title: nm || fmtNum(n) || 'Contacto', ts: c.messages?.at(-1)?.timestamp || 0 }
    }).filter(p => p.number !== me.number).sort((a, b) => norm(a.title).localeCompare(norm(b.title)))
    const draw = () => {
      const q = norm(inp.value), raw = inp.value.trim(), qd = raw.replace(/\D/g, ''), isNum = /^[+\d][\d\s-]{5,}$/.test(raw)
      lst.innerHTML = ''
      if (isNum && qd.length >= 7) { const r = $('div', 'wc-pr', '<div class="a" style="background:#21c063;color:#08130c">' + IC.phone + '</div><div class="t"><div class="n"></div><div class="s">Usar este número</div></div>'); r.querySelector('.n').textContent = 'Llamar a +' + qd; r.onclick = () => { pop(); setTimeout(() => cb({ jid: qd + '@s.whatsapp.net', number: qd, name: '' }), 60) }; lst.appendChild(r) }
      const f = people.filter(p => !q || norm(p.title).includes(q) || (qd && p.number.includes(qd)))
      f.forEach(p => { const r = $('div', 'wc-pr', '<div class="t"><div class="n"></div><div class="s"></div></div>'); r.insertBefore(avatar(p.id, p.jid, 46), r.firstChild); r.querySelector('.n').textContent = p.title; r.querySelector('.s').textContent = p.number && p.name ? fmtNum(p.number) : ''; r.onclick = () => { pop(); setTimeout(() => cb({ jid: p.jid, number: p.number, name: p.name }), 60) }; lst.appendChild(r) })
      if (!f.length && !(isNum && qd.length >= 7)) { const e = $('div', 'wc-empty'); e.textContent = 'No se encontraron contactos. Escribe un número con código de país.'; lst.appendChild(e) }
    }
    inp.oninput = draw; draw()
    screen(title || 'Seleccionar contacto', body); setTimeout(() => inp.focus(), 80)
  }

  // ---------- teclado ----------
  function openKeypad() {
    let num = ''
    const body = $('div', 'wc-kp', '<div class="dsp"></div><div class="chk"></div><div class="grid"></div><div class="act"></div>')
    const dsp = body.querySelector('.dsp'), chk = body.querySelector('.chk'), grid = body.querySelector('.grid')
    let timer = 0
    const upd = () => {
      dsp.textContent = num ? (num.length >= 11 && num.startsWith('598') ? fmtNum(num) : '+' + num) : 'Escribe un número con código de país'
      dsp.classList.toggle('ph', !num); chk.textContent = ''
      clearTimeout(timer)
      if (num.length >= 8) timer = setTimeout(async () => {
        chk.textContent = 'Comprobando…'
        try { const r = await (await fetch('/api/check/' + num)).json(); if (num) chk.textContent = r.error ? 'No se pudo comprobar si tiene WhatsApp' : (r.exists ? '✓ Tiene WhatsApp' : 'No tiene WhatsApp'); chk.style.color = r.exists ? '#21c063' : '#8d979e' } catch (e) { chk.textContent = '' }
      }, 700)
    }
    ;['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].forEach(k => {
      const b = $('div', 'k' + (k === '' ? ' z' : ''), k === '⌫' ? IC.bksp : k)
      if (k) b.onclick = () => { if (k === '⌫') num = num.slice(0, -1); else if (num.length < 15) num += k; upd() }
      if (k === '⌫') { let h; b.addEventListener('touchstart', () => { h = setTimeout(() => { num = ''; upd() }, 600) }, { passive: true }); ;['touchend', 'touchcancel'].forEach(e => b.addEventListener(e, () => clearTimeout(h), { passive: true })) }
      grid.appendChild(b)
    })
    const go = $('button', 'wc-callbtn', IC.phoneF); body.querySelector('.act').appendChild(go)
    go.onclick = () => { if (num.length < 7) return toast('Escribe un número válido (con código de país)'); callSheet({ jid: num + '@s.whatsapp.net', number: num, name: '' }) }
    upd(); screen('Teclado', body)
  }

  // ---------- grupo ----------
  function groupInfo() {
    dlg('Llamadas de grupo no disponibles', 'Baileys no permite iniciar ni recibir llamadas de grupo, así que el panel no puede crearlas. Lo que sí puedes hacer es crear un grupo de chat desde la pestaña Chats.', [['Entendido']])
  }

  // ---------- favoritos ----------
  const favKey = t => t.number || t.jid
  async function toggleFav(t) {
    const n = await ensureNumber(t), has = favs.some(f => f.id === (n || t.jid))
    try {
      const r = await (await fetch('/api/call-favorites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: has ? 'remove' : 'add', jid: t.jid, number: n, name: t.name }) })).json()
      if (!r.ok) return toast(r.error || 'No se pudo guardar')
      favs = r.favorites; toast(has ? 'Quitado de favoritos' : 'Añadido a favoritos')
    } catch (e) { toast('No se pudo guardar') }
  }
  function openFavs() {
    const body = $('div', 'wc-pk', '<div class="lst"></div>'), lst = body.querySelector('.lst')
    const draw = () => {
      lst.innerHTML = ''
      const add = $('div', 'wc-pr', '<div class="a" style="background:#21c063;color:#08130c">' + IC.heartF + '</div><div class="t"><div class="n">Añadir favorito</div></div>')
      add.onclick = () => pickContact(async t => { await toggleFav(t); draw() }, 'Añadir favorito'); lst.appendChild(add)
      if (!favs.length) { const e = $('div', 'wc-empty'); e.textContent = 'Aún no tienes favoritos. Añade contactos para llamarles más rápido.'; lst.appendChild(e) }
      favs.forEach(f => {
        const r = $('div', 'wc-pr', '<div class="t"><div class="n"></div><div class="s"></div></div><span class="wc-ib" style="color:#8d979e">' + IC.x + '</span>')
        r.insertBefore(avatar(f.id, f.jid, 46), r.firstChild); r.querySelector('.n').textContent = f.name || fmtNum(f.number) || 'Contacto'; r.querySelector('.s').textContent = f.name && f.number ? fmtNum(f.number) : ''
        r.onclick = () => callSheet({ jid: f.jid, number: f.number, name: f.name })
        r.lastChild.onclick = async e => { e.stopPropagation(); await toggleFav({ jid: f.jid, number: f.number, name: f.name }); draw() }
        lst.appendChild(r)
      })
    }
    draw()
    screen('Favoritos', body)
  }

  // ---------- llamadas programadas (RECORDATORIOS) ----------
  const NOTE = 'Baileys no permite iniciar llamadas, así que el panel no llama solo. Una llamada programada es un recordatorio: a la hora indicada te avisa aquí (y con notificación si la activas en Ajustes).'
  async function loadSched() { try { return await (await fetch('/api/call-schedule')).json() } catch (e) { return [] } }
  async function openScheduled() {
    const body = $('div', 'wc-pk', '<div class="wc-info"></div><div class="lst"></div>'), lst = body.querySelector('.lst')
    body.querySelector('.wc-info').textContent = NOTE
    const draw = async () => {
      const l = await loadSched(); lst.innerHTML = ''
      const add = $('div', 'wc-pr', '<div class="a" style="background:#21c063;color:#08130c">' + IC.cal + '</div><div class="t"><div class="n">Nuevo recordatorio de llamada</div></div>'); add.onclick = () => openScheduleForm(null, draw); lst.appendChild(add)
      if (!l.length) { const e = $('div', 'wc-empty'); e.textContent = 'No hay llamadas programadas.'; lst.appendChild(e) }
      l.forEach(s => {
        const past = s.fired || s.at < Date.now()
        const r = $('div', 'wc-pr', '<div class="t"><div class="n"></div><div class="s"></div></div><span class="wc-ib" style="color:#8d979e">' + IC.trash + '</span>')
        r.insertBefore(avatar(s.id, s.jid, 46), r.firstChild)
        r.querySelector('.n').textContent = (s.video ? '📹 ' : '📞 ') + (s.name || fmtNum(s.number) || 'Contacto')
        r.querySelector('.s').textContent = dateStr(s.at) + (past ? ' · Pasada' : ' · Pendiente') + (s.note ? ' · ' + s.note : '')
        if (past) r.querySelector('.n').style.opacity = r.querySelector('.s').style.opacity = '.7'
        r.onclick = () => callSheet({ jid: s.jid, number: s.number, name: s.name, video: s.video })
        r.lastChild.onclick = e => { e.stopPropagation(); dlg('', '¿Eliminar este recordatorio?', [['Cancelar'], ['Eliminar', async () => { await fetch('/api/call-schedule/' + s.id, { method: 'DELETE' }); draw() }, true]]) }
        lst.appendChild(r)
      })
    }
    draw(); screen('Llamadas programadas', body)
  }
  function openScheduleForm(pre, done) {
    const st = { t: pre || null, video: false }
    const d0 = new Date(Date.now() + 3600e3); d0.setMinutes(0, 0, 0)
    const p2 = n => String(n).padStart(2, '0')
    const body = $('div', 'wc-form', '<div class="wc-info"></div><div class="lbl">Contacto</div><div class="pick"></div><div class="lbl">Fecha</div><input type="date" id="fd"><div class="lbl">Hora</div><input type="time" id="ft"><div class="lbl">Tipo</div><div class="seg"><span class="on" data-v="0">Voz</span><span data-v="1">Vídeo</span></div><div class="lbl">Nota (opcional)</div><input type="text" id="fn" maxlength="120" placeholder="Ej.: preguntar por el pedido"><button class="wc-save">Guardar recordatorio</button>')
    body.querySelector('.wc-info').textContent = NOTE
    const pick = body.querySelector('.pick'), setT = () => { pick.textContent = st.t ? (st.t.name || fmtNum(st.t.number) || 'Contacto') : 'Elegir contacto o número'; pick.style.color = st.t ? '' : '#8d979e' }
    setT(); pick.onclick = () => pickContact(t => { st.t = t; setT() })
    body.querySelector('#fd').value = d0.getFullYear() + '-' + p2(d0.getMonth() + 1) + '-' + p2(d0.getDate()); body.querySelector('#ft').value = p2(d0.getHours()) + ':' + p2(d0.getMinutes())
    body.querySelectorAll('.seg span').forEach(s => s.onclick = () => { body.querySelectorAll('.seg span').forEach(z => z.classList.remove('on')); s.classList.add('on'); st.video = s.dataset.v === '1' })
    body.querySelector('.wc-save').onclick = async () => {
      if (!st.t) return toast('Elige un contacto o número')
      const at = new Date(body.querySelector('#fd').value + 'T' + body.querySelector('#ft').value).getTime()
      if (!at || at < Date.now()) return toast('Elige una fecha y hora futuras')
      const n = await ensureNumber(st.t)
      try {
        const r = await (await fetch('/api/call-schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jid: st.t.jid, number: n, name: st.t.name, at, note: body.querySelector('#fn').value, video: st.video }) })).json()
        if (!r.ok) return toast(r.error || 'No se pudo guardar')
        toast('Recordatorio guardado'); pop(); if (done) done()
      } catch (e) { toast('No se pudo guardar') }
    }
    screen('Programar llamada', body)
  }

  // ---------- ajustes ----------
  function openSettings() {
    const body = $('div', 'wc-pk', '<div class="lst"></div><div class="wc-info" id="lim"></div>'), lst = body.querySelector('.lst')
    const sw = (key, t, sub) => { const r = $('div', 'wc-sw', '<div class="tx"><div class="t"></div><div class="s"></div></div><span class="sw"><i></i></span>'); r.querySelector('.t').textContent = t; r.querySelector('.s').textContent = sub; const s = r.querySelector('.sw'); s.classList.toggle('on', !!S[key]); r.onclick = () => { S[key] = !S[key]; saveS(); s.classList.toggle('on', !!S[key]); drawList() }; lst.appendChild(r) }
    sw('group', 'Agrupar llamadas consecutivas', 'Une las llamadas seguidas del mismo contacto y tipo en el mismo día')
    sw('showGroupCalls', 'Mostrar llamadas de grupo', 'Muestra u oculta las llamadas de grupo recibidas')
    sw('rejectedAsMissed', 'Contar rechazadas como perdidas', 'Afecta al filtro «Perdidas»')
    sw('h12', 'Hora en formato de 12 horas', 'Por ejemplo 1:46 p. m.')
    const nr = $('div', 'wc-sw', '<div class="tx"><div class="t">Notificaciones de recordatorios</div><div class="s"></div></div>'), ns = nr.querySelector('.s')
    const perm = () => ns.textContent = !window.Notification ? 'Este navegador no admite notificaciones' : ({ granted: 'Activadas', denied: 'Bloqueadas en el navegador', default: 'Toca para activar' })[Notification.permission]
    perm(); nr.onclick = async () => { if (window.Notification && Notification.permission === 'default') { await Notification.requestPermission(); perm() } else if (window.Notification) toast(Notification.permission === 'granted' ? 'Ya están activadas' : 'Actívalas en los ajustes del sitio del navegador') }
    lst.appendChild(nr)
    body.querySelector('#lim').textContent = 'Limitaciones: este panel no puede iniciar, contestar ni rechazar llamadas de WhatsApp. Baileys solo avisa de las llamadas entrantes (oferta, contestada, rechazada o perdida), por eso solo se registra lo que llega.'
    screen('Ajustes de llamadas', body)
  }

  // ---------- botón flotante y arranque ----------
  document.getElementById('wcFab').onclick = () => pickContact(t => callSheet(t))
  async function init() {
    drawHead(); drawList()
    const get = (u, d) => fetch(u).then(r => r.json()).catch(() => d)
    ;[calls, chats, favs] = await Promise.all([get('/calls', []), get('/chats', null).then(x => x || get('/api/chats', {})), get('/api/call-favorites', [])])
    const m = await get('/api/me', {}); if (m.ok) me = { number: m.number }
    drawList()
    if (location.hash === '#programadas') openScheduled()
  }
  const sk = typeof socket !== 'undefined' ? socket : io()
  sk.on('calls_deleted', ids => { calls = ids ? calls.filter(c => !ids.includes(c.id)) : []; drawList() })
  sk.on('call_update', c => { const i = calls.findIndex(x => x.id === c.id); if (i >= 0) calls[i] = c; else calls.unshift(c); drawList() })
  window.addEventListener('pageshow', e => { if (e.persisted) location.reload() })
  init()
})()
