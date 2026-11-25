// Nuevo grupo estilo WhatsApp: 1) participantes  2) datos del grupo  3) permisos
;(function () {
  'use strict'
  const $ = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e }
  const S = (p, w) => '<svg viewBox="0 0 24 24" width="' + (w || 24) + '" height="' + (w || 24) + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>'
  const IC = {
    back: S('<path d="M20 12H5M11 5l-7 7 7 7"/>'),
    arrow: S('<path d="M4 12h16M13 5l7 7-7 7"/>', 26),
    check: S('<path d="M5 12.5l4.5 4.5L19 7"/>', 26),
    dial: '<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">' + [4, 12, 20].map(x => [3, 10, 17].map(y => '<circle cx="' + x + '" cy="' + y + '" r="1.8"/>').join('')).join('') + '<circle cx="12" cy="22" r="1.8"/></svg>',
    kbd: S('<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>'),
    cam: S('<path d="M4 8a2 2 0 0 1 2-2h1.2l1-1.6h5.6l1 1.6H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.3"/>', 30),
    emoji: S('<circle cx="12" cy="12" r="9.5"/><path d="M8 14.5c1 1.6 2.4 2.3 4 2.3s3-.7 4-2.3M9 9.5h.01M15 9.5h.01"/>', 28),
    timer: S('<path d="M12 7v5l3 2"/><path d="M20.4 9.5A9 9 0 1 0 21 12" stroke-dasharray="0"/>', 26),
    gear: S('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>', 26),
    addp: S('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-5.5 6.5-5.5M18 14v6M15 17h6"/>'),
    link: S('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1"/>'),
    appr: S('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-5.5 6.5-5.5"/><circle cx="17.5" cy="17.5" r="4.5"/><path d="M17.5 15v2.7l1.6 1"/>'),
    msg: S('<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M7.5 9.5h9M7.5 13.5h6"/>'),
    pen: S('<path d="M4 20l1-4L16.5 4.5a2 2 0 0 1 3 3L8 19z"/>'),
    person: '<svg viewBox="0 0 24 24" width="55%" height="55%" fill="currentColor"><circle cx="12" cy="8" r="4.3"/><path d="M3.8 21c0-4.2 3.6-6.6 8.2-6.6s8.2 2.4 8.2 6.6z"/></svg>',
    x: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  }
  const PAL = [['#0d3b4f', '#4db8e8'], ['#0f3f38', '#4fd1b5'], ['#133b22', '#3fd07a'], ['#3d2f1c', '#e8b64d'], ['#3a2147', '#c58be8'], ['#4a2326', '#ef8a8a']]
  const EMOJIS = '😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 😉 😍 🥰 😘 😋 😜 🤪 😎 🤩 🥳 😏 😒 😔 😢 😭 😤 😡 🥺 😱 😴 🤔 🙄 😬 🤗 🤝 👍 👎 👏 🙌 🙏 💪 👀 🔥 ✨ 🎉 🎂 🎁 💯 ❤️ 🧡 💛 💚 💙 💜 🖤 💔 ⚽ 🏀 🎮 🎵 🎧 📸 ✈️ 🚗 🏠 🍕 🍔 🍟 🍻 ☕ 🌎 🌙 ☀️ ⭐ 🌈 🐶 🐱 🦁 🐼'.split(' ')
  const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const fmt = n => !n ? '' : (typeof ncFmtNumber === 'function' ? ncFmtNumber(n) : '+' + n)
  const toast = t => (typeof toast2 === 'function' ? toast2(t) : alert(t))
  const dispName = c => c.name || c.notify || fmt(c.number) || 'Contacto'
  const hue = id => { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0; return PAL[h % PAL.length] }

  const css = $('style'); css.id = 'ng-style'
  css.textContent = `
.ng{position:fixed;inset:0;z-index:996;background:#0b1014;color:#e9edef;display:flex;flex-direction:column;font-family:Roboto,system-ui,sans-serif;animation:ngIn .18s ease-out}
@keyframes ngIn{from{transform:translateX(24px);opacity:0}to{transform:none;opacity:1}}
.ng-ic{display:flex;align-items:center;justify-content:center;cursor:pointer;color:#e9edef;flex-shrink:0}
.ng-search{margin:8px 12px 4px;height:48px;border-radius:24px;background:#181d21;display:flex;align-items:center;padding:0 14px 0 12px;gap:12px;flex-shrink:0}
.ng-search input{flex:1;min-width:0;background:transparent;border:0;outline:0;color:#e9edef;font-size:17px;caret-color:#21c063}
.ng-search input::placeholder{color:#8d979e}
.ng-strip{display:flex;gap:14px;overflow-x:auto;padding:8px 16px 6px;flex-shrink:0;border-bottom:1px solid #1a1f23}
.ng-chip{width:60px;flex-shrink:0;text-align:center;font-size:12px;color:#c4cbd0;position:relative;cursor:pointer}
.ng-chip .ng-av{width:50px;height:50px;margin:0 auto 4px}
.ng-chip b{position:absolute;top:34px;right:2px;width:18px;height:18px;border-radius:50%;background:#2a3238;border:2px solid #0b1014;display:flex;align-items:center;justify-content:center;color:#e9edef}
.ng-chip span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ng-count{padding:8px 16px 0;color:#8d979e;font-size:13px;flex-shrink:0}
.ng-list{flex:1;overflow-y:auto;padding-bottom:100px}
.ng-sec{padding:20px 16px 8px;color:#8d979e;font-size:15.5px}
.ng-row{display:flex;align-items:center;gap:16px;padding:0 16px;height:66px;cursor:pointer;content-visibility:auto;contain-intrinsic-size:0 66px}
.ng-row:active{background:#12181c}
.ng-av{width:48px;height:48px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background-size:cover;background-position:center;font-weight:600;overflow:hidden}
.ng-txt{flex:1;min-width:0;height:100%;display:flex;flex-direction:column;justify-content:center;border-bottom:1px solid #161b1f}
.ng-nm{font-size:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ng-sub{font-size:13.5px;color:#8d979e;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ng-ck{width:30px;height:30px;border-radius:50%;border:2px solid #7d878e;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#0b1014}
.ng-row.on .ng-ck{background:#21c063;border-color:#21c063}
.ng-ck svg{display:none;width:18px;height:18px}.ng-row.on .ng-ck svg{display:block}
.ng-fab{position:absolute;right:18px;bottom:calc(22px + env(safe-area-inset-bottom));width:56px;height:56px;border-radius:17px;border:0;background:#21c063;color:#0b1014;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(0,0,0,.45);cursor:pointer}
.ng-fab:active{filter:brightness(.9)}.ng-fab.busy{opacity:.6;pointer-events:none}
.ng-bar{height:56px;display:flex;align-items:center;gap:22px;padding:0 16px;flex-shrink:0;border-bottom:1px solid #161b1f;font-size:22px}
.ng-top{display:flex;align-items:center;gap:14px;padding:14px 12px 8px}
.ng-cam{width:47px;height:47px;border-radius:50%;background:#2a3138;color:#aab3b9;display:flex;align-items:center;justify-content:center;background-size:cover;background-position:center;cursor:pointer;flex-shrink:0}
.ng-name{flex:1;min-width:0;height:54px;border:2px solid #21c063;border-radius:12px;display:flex;align-items:center;padding:0 14px}
.ng-name input{flex:1;min-width:0;background:transparent;border:0;outline:0;color:#e9edef;font-size:18px;caret-color:#21c063}
.ng-name input::placeholder{color:#8d979e}
.ng-opt{display:flex;align-items:center;padding:14px 16px;cursor:pointer;gap:12px}
.ng-opt:active{background:#12181c}
.ng-opt .t{font-size:19px}.ng-opt .s{font-size:16px;color:#8d979e;margin-top:3px}.ng-opt .i{margin-left:auto;color:#aab3b9}
.ng-mem{padding:22px 16px 6px;color:#8d979e;font-size:16px}
.ng-grid{display:flex;flex-wrap:wrap;gap:6px 4px;padding:8px 10px 120px;overflow-y:auto}
.ng-m{width:78px;text-align:center;font-size:14px;color:#aab3b9;position:relative;cursor:pointer}
.ng-m .ng-av{width:54px;height:54px;margin:0 auto 6px}.ng-m span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ng-m b{position:absolute;top:36px;right:8px;width:20px;height:20px;border-radius:50%;background:#2a3238;border:2px solid #0b1014;display:flex;align-items:center;justify-content:center;color:#e9edef}
.ng-emo{display:none;flex-wrap:wrap;gap:2px;padding:8px;background:#12171b;max-height:36vh;overflow-y:auto;flex-shrink:0;margin-top:auto}
.ng-emo.open{display:flex}.ng-emo span{width:12.5%;text-align:center;font-size:25px;padding:6px 0;cursor:pointer}
.ng-psec{padding:24px 24px 6px;color:#8d979e;font-size:15.5px;font-weight:500}
.ng-prow{display:flex;gap:26px;align-items:center;padding:14px 24px;cursor:pointer}.ng-prow:active{background:#12181c}
.ng-prow .i{color:#8d979e;width:26px;flex-shrink:0}.ng-prow .t{font-size:19px}.ng-prow .s{font-size:16px;color:#8d979e;margin-top:3px}
.ng-prow.off .t,.ng-prow.off .i{opacity:.55}
.ng-dim{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1000;display:flex;align-items:center;justify-content:center;padding:24px}
.ng-dlg{width:100%;max-width:340px;background:#1d2226;border-radius:28px;padding:24px 24px 14px}
.ng-dlg h3{margin:0 0 14px;font-size:21px;font-weight:500}.ng-dlg p{margin:0 0 6px;color:#c4cbd0;font-size:16px;line-height:1.4}
.ng-rad{display:flex;align-items:center;gap:18px;padding:13px 0;font-size:18px;cursor:pointer}
.ng-rad i{width:22px;height:22px;border-radius:50%;border:2px solid #8d979e;display:flex;align-items:center;justify-content:center}
.ng-rad.on i{border-color:#21c063}.ng-rad.on i:after{content:"";width:12px;height:12px;border-radius:50%;background:#21c063}
.ng-btns{display:flex;justify-content:flex-end;gap:22px;padding-top:12px}.ng-btns span{color:#21c063;font-size:17px;font-weight:500;padding:8px 4px;cursor:pointer}
.ng-load{padding:40px 16px;text-align:center;color:#8d979e}`
  document.head.appendChild(css)

  // ---------- navegación (el botón atrás de Android cierra la pantalla de arriba) ----------
  const stack = []
  const push = el => { document.body.appendChild(el); stack.push(el); history.pushState({ ng: stack.length }, '') }
  const back = () => { if (stack.length) history.back() }
  window.addEventListener('popstate', () => { const el = stack.pop(); if (el) el.remove() })

  function dialog(title, bodyHtml, buttons) {
    const dim = $('div', 'ng-dim'), box = $('div', 'ng-dlg', '<h3></h3>')
    box.firstChild.textContent = title
    if (bodyHtml instanceof Node) box.appendChild(bodyHtml); else box.insertAdjacentHTML('beforeend', bodyHtml)
    const bt = $('div', 'ng-btns')
    buttons.forEach(([l, fn]) => { const s = $('span'); s.textContent = l; s.onclick = () => { dim.remove(); fn && fn() }; bt.appendChild(s) })
    box.appendChild(bt); dim.appendChild(box)
    dim.onclick = e => { if (e.target === dim) dim.remove() }
    document.body.appendChild(dim)
  }
  function choose(title, opts, cur, cb) {
    const w = $('div')
    opts.forEach(([v, l]) => { const r = $('div', 'ng-rad' + (v === cur ? ' on' : ''), '<i></i><span></span>'); r.lastChild.textContent = l; r.onclick = () => { w.closest('.ng-dim').remove(); cb(v) }; w.appendChild(r) })
    dialog(title, w, [['Cancelar']])
  }

  // ---------- avatares ----------
  const pfpQ = []; let pfpBusy = 0
  const pfpPump = () => {
    while (pfpBusy < 4 && pfpQ.length) {
      const [id, el] = pfpQ.shift(); pfpBusy++
      const done = () => { pfpBusy--; pfpPump() }
      const cache = typeof PFP !== 'undefined' ? PFP : {}
      const c = cache[id]
      const show = u => { const im = new Image(); im.onload = () => { el.innerHTML = ''; el.style.backgroundImage = 'url("' + u + '")' }; im.src = u }
      if (c && c.url) show(c.url)
      if (c && Date.now() - c.t < 6 * 3600e3) { done(); continue }
      fetch('/api/pfp/' + encodeURIComponent(id)).then(r => r.json()).then(r => {
        cache[id] = { url: r.url || '', t: Date.now() }
        try { localStorage.setItem('pfpCache', JSON.stringify(cache)) } catch {}
        if (r.url) show(r.url)
      }).catch(() => {}).finally(done)
    }
  }
  let obs = null
  function avatar(c, cls) {
    const [bg, fg] = hue(c.id || 'x')
    const a = $('div', 'ng-av' + (cls ? ' ' + cls : ''), IC.person)
    a.style.cssText = 'background-color:' + bg + ';color:' + fg
    const pid = c.jid || c.lid
    if (pid) { a._pid = pid; (obs || (obs = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { obs.unobserve(e.target); pfpQ.push([e.target._pid, e.target]); pfpPump() } }), { rootMargin: '200px' }))).observe(a) }
    return a
  }

  // ---------- estado ----------
  let contacts = [], frequent = [], me = { number: '', name: '' }, agendaCount = 0, caps = {}
  const sel = new Map()
  const st = { subject: '', photo: '', ephemeral: 0, add: 'all', approval: false, send: 'all', edit: 'all' }
  let creating = false

  async function open() {
    if (document.querySelector('.ng')) return
    st.subject = ''; st.photo = ''; st.ephemeral = 0; st.add = 'all'; st.approval = false; st.send = 'all'; st.edit = 'all'; sel.clear(); creating = false
    screen1()
    try {
      const [a, b] = await Promise.all([fetch('/api/contacts').then(r => r.json()), fetch('/api/group-capabilities').then(r => r.json()).catch(() => ({}))])
      caps = b || {}
      if (!a.ok) { toast(a.error || 'No se pudieron cargar los contactos'); contacts = [] } else { contacts = a.contacts; frequent = a.frequent; me = a.me; agendaCount = a.agendaCount }
    } catch { toast('No se pudo conectar con el servidor') }
    if (window.__ngRender) window.__ngRender()
  }

  // ---------- pantalla 1 ----------
  function screen1() {
    const el = $('div', 'ng')
    const bar = $('div', 'ng-search', '<span class="ng-ic" id="b">' + IC.back + '</span><input placeholder="Nombre, número o nombre de usuario" autocomplete="off"><span class="ng-ic" id="d" style="color:#aab3b9">' + IC.dial + '</span>')
    const inp = bar.querySelector('input')
    const strip = $('div', 'ng-strip'), count = $('div', 'ng-count'), list = $('div', 'ng-list')
    const fab = $('button', 'ng-fab', IC.arrow)
    el.append(bar, strip, count, list, fab)
    list.innerHTML = '<div class="ng-load">Cargando contactos…</div>'
    bar.querySelector('#b').onclick = back
    bar.querySelector('#d').onclick = function () {
      const tel = inp.inputMode !== 'tel'
      inp.inputMode = tel ? 'tel' : 'text'; this.innerHTML = tel ? IC.kbd : IC.dial
      inp.blur(); setTimeout(() => inp.focus(), 60)
    }
    fab.onclick = () => { if (!sel.size) return toast('Selecciona al menos un contacto'); screen2() }

    const rowEl = c => {
      const r = $('div', 'ng-row' + (sel.has(c.id) ? ' on' : ''), '<div class="ng-txt"><div class="ng-nm"></div><div class="ng-sub"></div></div><div class="ng-ck">' + IC.check + '</div>')
      r.insertBefore(avatar(c), r.firstChild)
      r.querySelector('.ng-nm').textContent = dispName(c)
      const sub = c.number && c.name ? fmt(c.number) : (c.notify && c.name && c.notify !== c.name ? '~' + c.notify : (!c.number && !c.name ? 'Número oculto' : ''))
      const s = r.querySelector('.ng-sub'); if (sub) s.textContent = sub; else s.remove()
      r.dataset.id = c.id
      r.onclick = () => { toggle(c); r.classList.toggle('on', sel.has(c.id)) }
      return r
    }
    const toggle = c => { sel.has(c.id) ? sel.delete(c.id) : sel.set(c.id, c); drawStrip() }
    function drawStrip() {
      strip.innerHTML = ''
      strip.style.display = sel.size ? 'flex' : 'none'
      sel.forEach(c => {
        const ch = $('div', 'ng-chip', '<b>' + IC.x + '</b><span></span>')
        ch.insertBefore(avatar(c), ch.firstChild); ch.lastChild.textContent = dispName(c).split(' ')[0]
        ch.onclick = () => { sel.delete(c.id); drawStrip(); const r = list.querySelector('.ng-row[data-id="' + CSS.escape(c.id) + '"]'); if (r) r.classList.remove('on') }
        strip.appendChild(ch)
      })
      count.textContent = sel.size ? sel.size + ' seleccionado' + (sel.size === 1 ? '' : 's') + ' de ' + contacts.length : ''
      count.style.display = sel.size ? 'block' : 'none'
    }
    function render() {
      const raw = inp.value.trim(), q = norm(raw), isNum = /^[+\d\s-]+$/.test(raw), qd = raw.replace(/\D/g, '')
      const ok = c => !q || norm(c.name + ' ' + c.notify).includes(q) || (isNum && qd && c.number.includes(qd))
      list.innerHTML = ''
      const sec = t => list.appendChild($('div', 'ng-sec', t))
      const byId = new Map(contacts.map(c => [c.id, c]))
      if (!q) {
        const f = frequent.map(i => byId.get(i)).filter(Boolean)
        if (f.length) { sec('Contactos frecuentes'); f.forEach(c => list.appendChild(rowEl(c))) }
        const sorted = (a, b) => (dispName(a).replace(/^\+/, '')).localeCompare(dispName(b).replace(/^\+/, ''), 'es', { sensitivity: 'base', numeric: true })
        const main = contacts.filter(c => !c.onlyGroups).sort(sorted), grp = contacts.filter(c => c.onlyGroups).sort(sorted)
        if (main.length) { sec('Contactos en WhatsApp'); main.forEach(c => list.appendChild(rowEl(c))) }
        if (grp.length) { sec('Conocidos por tus grupos'); grp.forEach(c => list.appendChild(rowEl(c))) }
        if (!contacts.length) list.innerHTML = '<div class="ng-load">No hay contactos disponibles.</div>'
        else if (!agendaCount) list.appendChild($('div', 'ng-count', 'Solo se muestran los contactos que el bot conoce (chats y grupos). La agenda del teléfono no se ha sincronizado con el bot.'))
      } else {
        const m = contacts.filter(ok).sort((a, b) => b.ts - a.ts)
        if (m.length) { sec('Contactos'); m.forEach(c => list.appendChild(rowEl(c))) }
        if (isNum && qd.length >= 7 && !contacts.some(c => c.number === qd)) {
          const add = $('div', 'ng-row', '<div class="ng-txt"><div class="ng-nm"></div><div class="ng-sub">Comprobar que tiene WhatsApp</div></div>')
          add.insertBefore($('div', 'ng-av', IC.person), add.firstChild); add.firstChild.style.cssText = 'background:#21c063;color:#0b1014'
          add.querySelector('.ng-nm').textContent = 'Añadir +' + qd
          add.onclick = async () => {
            try {
              const r = await (await fetch('/api/check/' + qd)).json()
              if (!r.exists) return toast(r.error ? 'No se pudo verificar el número' : 'Ese número no tiene WhatsApp')
              const jid = r.jid || qd + '@s.whatsapp.net', n = jid.split('@')[0].split(':')[0]
              let c = contacts.find(x => x.number === n)
              if (!c) { c = { id: n + '@s.whatsapp.net', jid: n + '@s.whatsapp.net', lid: '', number: n, name: '', notify: '', ts: 0, onlyGroups: false }; contacts.push(c) }
              sel.set(c.id, c); drawStrip(); inp.value = ''; render()
            } catch { toast('Error de conexión') }
          }
          list.appendChild(add)
        }
        if (!m.length && !(isNum && qd.length >= 7)) list.innerHTML = '<div class="ng-load">No se encontraron contactos</div>'
      }
    }
    inp.oninput = render
    window.__ngRender = () => { if (document.body.contains(el)) { render(); drawStrip() } }
    drawStrip()
    push(el)
    setTimeout(() => inp.focus(), 80)
  }

  // ---------- pantalla 2 ----------
  const ephLabel = s => ({ 0: 'Desactivados', 86400: '24 horas', 604800: '7 días', 7776000: '90 días' })[s]
  function screen2() {
    const el = $('div', 'ng')
    el.innerHTML = '<div class="ng-bar"><span class="ng-ic" id="b">' + IC.back + '</span><span>Nuevo grupo</span></div>' +
      '<div class="ng-top"><div class="ng-cam" id="ph">' + IC.cam + '</div><div class="ng-name"><input id="nm" maxlength="100" placeholder="Nombre del grupo (opcional)"><span class="ng-ic" id="em" style="color:#aab3b9">' + IC.emoji + '</span></div></div>' +
      '<div class="ng-opt" id="eph"><div><div class="t">Mensajes temporales</div><div class="s"></div></div><span class="i">' + IC.timer + '</span></div>' +
      '<div class="ng-opt" id="perm"><div><div class="t">Permisos del grupo</div></div><span class="i">' + IC.gear + '</span></div>' +
      '<div class="ng-mem"></div><div class="ng-grid"></div><div class="ng-emo"></div>' +
      '<button class="ng-fab">' + IC.check + '</button>'
    const q = s => el.querySelector(s)
    const nm = q('#nm'), emo = q('.ng-emo'), grid = q('.ng-grid')
    nm.value = st.subject
    nm.oninput = () => { st.subject = nm.value }
    q('#b').onclick = back
    const upPhoto = () => { const p = q('#ph'); p.style.backgroundImage = st.photo ? 'url("' + st.photo + '")' : ''; p.innerHTML = st.photo ? '' : IC.cam }
    upPhoto()
    EMOJIS.forEach(e => { const s = $('span'); s.textContent = e; s.onclick = () => { const a = nm.selectionStart ?? nm.value.length, b = nm.selectionEnd ?? a; nm.value = nm.value.slice(0, a) + e + nm.value.slice(b); nm.selectionStart = nm.selectionEnd = a + e.length; st.subject = nm.value }; emo.appendChild(s) })
    q('#em').onclick = function () { const o = emo.classList.toggle('open'); this.innerHTML = o ? IC.kbd : IC.emoji; if (o) nm.blur(); else nm.focus() }
    const upEph = () => { q('#eph .s').textContent = ephLabel(st.ephemeral) }
    upEph()
    q('#eph').onclick = () => choose('Mensajes temporales', [[86400, '24 horas'], [604800, '7 días'], [7776000, '90 días'], [0, 'Desactivados']], st.ephemeral, v => { st.ephemeral = v; upEph() })
    q('#perm').onclick = screen3
    q('#ph').onclick = () => {
      const inpf = (cap) => { const f = $('input'); f.type = 'file'; f.accept = 'image/*'; if (cap) f.capture = 'environment'; f.onchange = () => f.files[0] && cropSquare(f.files[0]).then(u => { st.photo = u; upPhoto() }).catch(() => toast('No se pudo leer la imagen')); f.click() }
      const w = $('div')
      ;[['Galería', () => inpf(false)], ['Cámara', () => inpf(true)], ...(st.photo ? [['Quitar foto', () => { st.photo = ''; upPhoto() }]] : [])].forEach(([l, fn]) => { const r = $('div', 'ng-rad'); r.textContent = l; r.onclick = () => { w.closest('.ng-dim').remove(); fn() }; w.appendChild(r) })
      dialog('Foto del grupo', w, [['Cancelar']])
    }
    const drawMembers = () => {
      q('.ng-mem').textContent = 'Miembros: ' + (sel.size + 1)
      grid.innerHTML = ''
      const mine = $('div', 'ng-m', '<span></span>')
      mine.insertBefore(avatar({ id: 'me', jid: me.number ? me.number + '@s.whatsapp.net' : '' }), mine.firstChild); mine.lastChild.textContent = 'Tú'
      grid.appendChild(mine)
      sel.forEach(c => {
        const m = $('div', 'ng-m', '<b>' + IC.x + '</b><span></span>')
        m.insertBefore(avatar(c), m.firstChild); m.lastChild.textContent = dispName(c)
        m.onclick = () => { sel.delete(c.id); if (!sel.size) { toast('Un grupo necesita al menos un participante'); return back() } drawMembers() }
        grid.appendChild(m)
      })
    }
    drawMembers()
    const fab = q('.ng-fab')
    fab.onclick = () => create(fab)
    push(el)
  }

  function cropSquare(file) {
    return new Promise((ok, no) => {
      const u = URL.createObjectURL(file), im = new Image()
      im.onload = () => {
        const s = Math.min(im.width, im.height), c = document.createElement('canvas'); c.width = c.height = Math.min(640, s)
        c.getContext('2d').drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, c.width, c.height)
        URL.revokeObjectURL(u); ok(c.toDataURL('image/jpeg', 0.85))
      }
      im.onerror = no; im.src = u
    })
  }

  // ---------- pantalla 3 ----------
  function screen3() {
    const el = $('div', 'ng')
    el.innerHTML = '<div class="ng-bar"><span class="ng-ic" id="b">' + IC.back + '</span><span>Permisos del grupo</span></div><div id="body"></div>'
    el.querySelector('#b').onclick = back
    const who = [['all', 'Todos'], ['admin', 'Solo admin.']]
    const L = v => v === 'all' ? 'Todos' : 'Solo admin.'
    const draw = () => {
      const b = el.querySelector('#body'); b.innerHTML = ''
      const sec = t => b.appendChild($('div', 'ng-psec', t))
      const row = (ic, t, s, fn, off) => { const r = $('div', 'ng-prow' + (off ? ' off' : ''), '<span class="i">' + ic + '</span><div><div class="t"></div><div class="s"></div></div>'); r.querySelector('.t').textContent = t; r.querySelector('.s').textContent = s; r.onclick = fn; b.appendChild(r) }
      sec('Unirse al grupo')
      caps.memberAddMode === false
        ? row(IC.addp, 'Añadir nuevos miembros', 'No disponible en esta versión', () => dialog('No disponible', '<p>Esta versión de Baileys no incluye el ajuste «Añadir nuevos miembros».</p>', [['Aceptar']]), true)
        : row(IC.addp, 'Añadir nuevos miembros', L(st.add), () => choose('Añadir nuevos miembros', who, st.add, v => { st.add = v; draw() }))
      row(IC.link, 'Compartir invitación al grupo', 'Solo admin. (no configurable)', () => dialog('No disponible', '<p>Baileys 7.0.0-rc14 no tiene una llamada para cambiar quién puede compartir el enlace de invitación, así que este ajuste no se puede aplicar desde el panel. Se queda con el valor por defecto de WhatsApp.</p>', [['Aceptar']]), true)
      row(IC.appr, 'Requerir aprobación de admin.', st.approval ? 'Activado' : 'Desactivado', () => choose('Requerir aprobación de admin.', [[true, 'Activado'], [false, 'Desactivado']], st.approval, v => { st.approval = v; draw() }))
      sec('Enviar mensajes')
      row(IC.msg, 'Envía nuevos mensajes', L(st.send), () => choose('Envía nuevos mensajes', who, st.send, v => { st.send = v; draw() }))
      sec('Administrar el grupo')
      row(IC.pen, 'Editar ajustes del grupo', L(st.edit), () => choose('Editar ajustes del grupo', who, st.edit, v => { st.edit = v; draw() }))
    }
    draw(); push(el)
  }

  // ---------- crear ----------
  async function create(fab) {
    if (creating) return
    creating = true; fab.classList.add('busy')
    const body = {
      requestId: Date.now() + '-' + Math.random().toString(36).slice(2),
      subject: st.subject.trim(),
      participants: [...sel.values()].map(c => ({ id: c.id, jid: c.jid, lid: c.lid, number: c.number, name: dispName(c) })),
      settings: { memberAddMode: st.add, announce: st.send === 'admin', locked: st.edit === 'admin', approval: st.approval, ephemeral: st.ephemeral },
      photo: st.photo || null
    }
    let r
    try { r = await (await fetch('/api/group-create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json() }
    catch { creating = false; fab.classList.remove('busy'); return toast('Error de conexión. Si el grupo se llegó a crear, aparecerá en tu lista; al reintentar no se duplicará.') }
    creating = false; fab.classList.remove('busy')
    if (!r.ok) {
      const extra = (r.skipped || []).map(x => x.name + ': ' + x.reason).join('\n')
      dialog('No se pudo crear el grupo', '<p></p>', [['Aceptar']])
      const p = document.querySelector('.ng-dlg p'); p.style.whiteSpace = 'pre-line'; p.textContent = (r.error || 'Error desconocido') + (extra ? '\n\n' + extra : '')
      return
    }
    const lines = []
    ;(r.skipped || []).forEach(x => lines.push('• ' + x.name + ': ' + x.reason))
    ;(r.notAdded || []).forEach(x => lines.push('• ' + x.name + ': ' + x.reason))
    ;(r.failed || []).forEach(x => lines.push('• ' + x.what + ' no se aplicó: ' + x.error))
    const go = () => { location.href = '/chat.html?id=' + encodeURIComponent(r.id) }
    if (!lines.length) return go()
    dialog('Grupo creado', '<p></p>', [['Abrir grupo', go]])
    const p = document.querySelector('.ng-dlg p'); p.style.whiteSpace = 'pre-line'; p.textContent = 'Algunas cosas no se pudieron completar:\n\n' + lines.join('\n')
  }

  window.newGroup = open
})()
