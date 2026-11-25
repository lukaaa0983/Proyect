// Ajustes de Proyecto G. Todo se dibuja con elementos DOM + textContent (los datos de WhatsApp nunca van a innerHTML).
// Preferencias: clave 'settings' de localStorage (la misma que ya leen chat.js e index.js) + prefs.js (accesibilidad).
(function () {
  'use strict'
  var d = document
  var app = d.getElementById('app')
  var titleEl = d.getElementById('title')

  // ───────── utilidades ─────────
  function add(el, c) {
    if (c == null || c === false) return
    if (Array.isArray(c)) { c.forEach(function (x) { add(el, x) }); return }
    if (typeof c === 'string' || typeof c === 'number') el.appendChild(d.createTextNode(String(c)))
    else el.appendChild(c)
  }
  function h(tag, props) {
    var el = d.createElement(tag)
    props = props || {}
    Object.keys(props).forEach(function (k) {
      var v = props[k]
      if (v == null || v === false) return
      if (k === 'class') el.className = v
      else if (k === 'text') el.textContent = v
      else if (k === 'svg') el.innerHTML = v            // SOLO con los iconos fijos de ICONS
      else if (k.slice(0, 2) === 'on') el[k] = v
      else el.setAttribute(k, v === true ? '' : v)
    })
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i])
    return el
  }
  var ICONS = {
    account: '<circle cx="8" cy="12" r="3.5"/><path d="M11.5 12H21M17 12v3M20 12v2"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3M12 15v2"/>',
    lists: '<rect x="6" y="3" width="13" height="14" rx="2"/><path d="M3 7v12a2 2 0 0 0 2 2h11M9 8h7M9 12h7"/>',
    chats: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M7 10h10M7 14h6"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-.5-.2-.9-.5-1.2-.3-.4-.5-.8-.5-1.3 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4C21 6.5 17 3 12 3z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10.5" cy="7.5" r="1"/><circle cx="15" cy="7.5" r="1"/>',
    bell: '<path d="M6 17v-6a6 6 0 0 1 12 0v6l1.5 2h-15zM10 21h4"/>',
    storage: '<path d="M20.5 12A8.5 8.5 0 1 1 12 3.5"/><path d="M12 3.5V12h8.5"/>',
    access: '<circle cx="12" cy="4.5" r="1.8"/><path d="M5 8.5l7 1.5 7-1.5M12 10v5M9 21l3-6 3 6"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17v.01"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>',
    block: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
    sound: '<path d="M4 10v4h4l5 4V6L8 10zM16.5 9a4 4 0 0 1 0 6"/>'
  }
  function ico(name) { return h('span', { class: 'ico', svg: '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || '') + '</svg>' }) }

  var toastTimer = null
  function toast(t) {
    var e = d.getElementById('toast')
    e.textContent = t
    e.style.display = 'block'
    clearTimeout(toastTimer)
    toastTimer = setTimeout(function () { e.style.display = 'none' }, 2800)
  }
  var errors = []
  window.addEventListener('error', function (e) { errors.push(String(e && e.message || 'error')) })

  function api(path, opts) {
    return fetch(path, opts).then(function (r) { return r.json() }).catch(function () { return { ok: false, error: 'No se pudo conectar con el panel' } })
  }
  function postJSON(path, body) { return api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) }
  function fmtBytes(n) {
    n = Number(n) || 0
    if (n < 1024) return n + ' B'
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB'
    if (n < 1073741824) return (n / 1048576).toFixed(1) + ' MB'
    return (n / 1073741824).toFixed(2) + ' GB'
  }
  function fmtDur(s) {
    s = Math.max(0, Math.round(Number(s) || 0))
    var dd = Math.floor(s / 86400), hh = Math.floor(s % 86400 / 3600), mm = Math.floor(s % 3600 / 60)
    return dd ? dd + ' d ' + hh + ' h' : hh ? hh + ' h ' + mm + ' min' : mm + ' min'
  }
  function safeUrl(u) { return /^https?:\/\//i.test(String(u || '')) ? String(u).replace(/["'\\\n\r()]/g, '') : '' }

  // ───────── preferencias ─────────
  var DEF = { wall: 'doodle', font: 15, enterSend: true, notif: false, sound: true, contrast: false, reduceMotion: false, bigTouch: false }
  function prefs() {
    try { return Object.assign({}, DEF, JSON.parse(localStorage.getItem('settings') || '{}')) } catch (e) { return Object.assign({}, DEF) }
  }
  function setPrefs(p) {
    localStorage.setItem('settings', JSON.stringify(Object.assign(prefs(), p)))
    if (window.PGPrefs) window.PGPrefs.apply()
  }

  // ───────── diálogos ─────────
  function overlay(mid) { var ov = h('div', { class: 'ov' + (mid ? ' mid' : '') }); d.body.appendChild(ov); return ov }
  function confirmDlg(title, msg, okText, danger) {
    return new Promise(function (res) {
      var ov = overlay(true)
      var done = function (v) { ov.remove(); res(v) }
      ov.onclick = function (e) { if (e.target === ov) done(false) }
      ov.appendChild(h('div', { class: 'dlg', role: 'dialog' },
        h('h3', { text: title, style: 'margin:0 0 8px' }),
        h('div', { class: 'rs', text: msg, style: 'margin:0 0 8px' }),
        h('div', { class: 'acts' },
          h('button', { class: 'btn', type: 'button', text: 'Cancelar', onclick: function () { done(false) } }),
          h('button', { class: 'btn ' + (danger ? 'red' : 'fill'), type: 'button', text: okText || 'Aceptar', onclick: function () { done(true) } }))))
    })
  }
  function askText(title, initial, placeholder, max) {
    return new Promise(function (res) {
      var ov = overlay(true)
      var inp = h('input', { class: 'inp', type: 'text', value: initial || '', placeholder: placeholder || '', maxlength: max || 40 })
      var done = function (v) { ov.remove(); res(v) }
      var ok = function () { done(inp.value) }
      inp.onkeydown = function (e) { if (e.key === 'Enter') ok() }
      ov.onclick = function (e) { if (e.target === ov) done(null) }
      ov.appendChild(h('div', { class: 'dlg', role: 'dialog' }, h('h3', { text: title, style: 'margin:0 0 12px' }), inp,
        h('div', { class: 'acts' },
          h('button', { class: 'btn', type: 'button', text: 'Cancelar', onclick: function () { done(null) } }),
          h('button', { class: 'btn fill', type: 'button', text: 'Aceptar', onclick: ok }))))
      setTimeout(function () { if (inp.focus) inp.focus() }, 30)
    })
  }
  function sheetRadio(title, options, current) {
    return new Promise(function (res) {
      var ov = overlay(false)
      var done = function (v) { ov.remove(); res(v) }
      ov.onclick = function (e) { if (e.target === ov) done(null) }
      ov.appendChild(h('div', { class: 'sheet', role: 'dialog' }, h('h3', { text: title }),
        options.map(function (o) {
          return h('button', { class: 'opt' + (o.v === current ? ' on' : ''), type: 'button', onclick: function () { done(o.v) } }, h('span', { class: 'rad' }), h('span', { text: o.t }))
        })))
    })
  }
  // items: [{id, name}] · selected: array de ids · devuelve array de ids o null si se cancela
  function pickChats(title, items, selected) {
    return new Promise(function (res) {
      var sel = {}
      selected.forEach(function (i) { sel[i] = true })
      var ov = overlay(false)
      var done = function (v) { ov.remove(); res(v) }
      var list = h('div')
      var q = h('input', { class: 'inp search', type: 'text', placeholder: 'Buscar chat…', style: 'margin:0 20px 8px;width:calc(100% - 40px)' })
      var draw = function () {
        var f = String(q.value || '').toLowerCase()
        list.innerHTML = ''
        var shown = items.filter(function (it) { return !f || it.name.toLowerCase().indexOf(f) >= 0 })
        if (!shown.length) list.appendChild(h('div', { class: 'empty', text: 'No hay chats que coincidan' }))
        shown.forEach(function (it) {
          var row = h('button', { class: 'opt' + (sel[it.id] ? ' on' : ''), type: 'button' }, h('span', { class: 'chk' }), h('span', { text: it.name }))
          row.onclick = function () { if (sel[it.id]) delete sel[it.id]; else sel[it.id] = true; draw() }
          list.appendChild(row)
        })
      }
      q.oninput = draw
      ov.onclick = function (e) { if (e.target === ov) done(null) }
      ov.appendChild(h('div', { class: 'sheet', role: 'dialog' }, h('h3', { text: title }), q, list,
        h('div', { class: 'acts', style: 'padding:6px 20px 0' },
          h('button', { class: 'btn', type: 'button', text: 'Cancelar', onclick: function () { done(null) } }),
          h('button', { class: 'btn fill', type: 'button', text: 'Aceptar', onclick: function () { done(Object.keys(sel)) } }))))
      draw()
    })
  }

  // ───────── componentes ─────────
  function row(o) {
    var cls = 'row' + (o.onclick ? '' : ' static')
    var tag = o.onclick ? 'button' : 'div'
    var el = h(tag, { class: cls, type: o.onclick ? 'button' : null },
      o.icon ? ico(o.icon) : null,
      h('span', { class: 'rt' }, h('div', { class: 'rtt' + (o.danger ? ' danger' : ''), text: o.title }), o.sub ? h('div', { class: 'rs', text: o.sub }) : null),
      o.value ? h('span', { class: 'rv', text: o.value }) : null,
      o.right || null)
    if (o.onclick) el.onclick = o.onclick
    return el
  }
  function toggleRow(o) {
    var sw = h('span', { class: 'sw' + (o.on ? ' on' : ''), role: 'switch', 'aria-checked': o.on ? 'true' : 'false' })
    return row({ icon: o.icon, title: o.title, sub: o.sub, right: sw, onclick: function () { o.onChange(!o.on) } })
  }
  function section(t) { return h('div', { class: 'sec', text: t }) }
  function note(t) { return h('div', { class: 'note', text: t }) }
  function pill(on, a, b) { return h('span', { class: 'pill' + (on ? '' : ' off'), text: on ? a : b }) }

  var WALLS = ['doodle', '#0b141a', '#13231c', '#1e1a2b', '#2a1f1f', '#10202b', '#1f2933', '#22301f', '#2d2a1c', '#2b1f2a']
  var FONTS = [{ n: 13, t: 'Pequeña' }, { n: 15, t: 'Mediana' }, { n: 18, t: 'Grande' }]
  var wallCss = function (w) { return w === 'doodle' ? 'linear-gradient(135deg,#0b141a,#1f2c34)' : w }

  function chatLook(rerender) {
    var s = prefs()
    return [
      h('div', { class: 'rtt', text: 'Fondo de pantalla', style: 'padding:14px 20px 0' }),
      h('div', { class: 'dots' }, WALLS.map(function (w) {
        return h('button', { class: 'dot' + (s.wall === w ? ' on' : ''), type: 'button', 'aria-label': 'Fondo ' + w, style: 'background:' + wallCss(w),
          onclick: function () { setPrefs({ wall: w }); rerender() } })
      })),
      h('div', { class: 'preview', style: 'background:' + wallCss(s.wall) },
        h('div', { class: 'bub r', style: 'font-size:' + s.font + 'px', text: 'Así se verán los mensajes recibidos' }),
        h('div', { class: 'bub s', style: 'font-size:' + s.font + 'px', text: 'Y así los que envías' })),
      fontChips(rerender, FONTS)
    ]
  }
  function fontChips(rerender, list) {
    var s = prefs()
    return h('div', null,
      h('div', { class: 'rtt', text: 'Tamaño de letra', style: 'padding:6px 20px 0' }),
      h('div', { class: 'chips' }, list.map(function (f) {
        return h('button', { class: 'chip' + (s.font === f.n ? ' on' : ''), type: 'button', text: f.t, onclick: function () { setPrefs({ font: f.n }); rerender() } })
      })))
  }

  // ───────── datos de chats / listas (mismo formato que usa index.js) ─────────
  function chatState() { try { return JSON.parse(localStorage.getItem('chatState') || '{}') || {} } catch (e) { return {} } }
  function saveChatState(st) { localStorage.setItem('chatState', JSON.stringify(st)) }
  function listsMap(st) {
    var m = {}
    Object.keys(st).forEach(function (id) { ((st[id] && st[id].lists) || []).forEach(function (n) { (m[n] = m[n] || []).push(id) }) })
    return m
  }
  function stOf(st, id) { if (!st[id]) st[id] = { unread: 0, favorite: false, archived: false }; return st[id] }
  function chatItems(all) {
    return Object.keys(all || {}).filter(function (id) { return !/@broadcast$/.test(id) }).map(function (id) {
      var c = all[id] || {}
      var nm = c.name && String(c.name).indexOf('@') < 0 ? String(c.name) : (/@g\.us$/.test(id) ? 'Grupo' : '+' + id.split('@')[0].split(':')[0])
      return { id: id, name: nm }
    }).sort(function (a, b) { return a.name.localeCompare(b.name) })
  }
  function nameFor(items, id) { for (var i = 0; i < items.length; i++) if (items[i].id === id) return items[i].name; return '+' + id.split('@')[0] }
  function validListName(name, st, except) {
    name = String(name || '').trim().slice(0, 30)
    if (!name) return { err: 'Escribe un nombre' }
    var low = name.toLowerCase(), ex = (except || '').toLowerCase(), m = listsMap(st)
    if (Object.keys(m).some(function (n) { return n.toLowerCase() === low && n.toLowerCase() !== ex })) return { err: 'Ya existe una lista con ese nombre' }
    return { name: name }
  }

  // ───────── router ─────────
  var nav = 0, lastDepth = 0, curKey = '', curArg = ''
  function parseHash() {
    var p = String(location.hash || '').replace(/^#\/?/, '').split('/')
    var arg = ''
    try { arg = p.length > 1 ? decodeURIComponent(p.slice(1).join('/')) : '' } catch (e) { arg = '' }
    return { key: p[0] || '', arg: arg }
  }
  function go(key, arg) { nav++; location.hash = '#/' + key + (arg ? '/' + encodeURIComponent(arg) : '') }
  // profundidad y pantalla "padre" (para la flecha de volver)
  function depthOf(key, arg) { return !key ? 0 : (key === 'bloqueados' || (key === 'listas' && arg)) ? 2 : 1 }
  function parentHash(key, arg) { return key === 'bloqueados' ? '#/privacidad' : (key === 'listas' && arg) ? '#/listas' : '#/' }
  var S = {}
  function render() {
    var p = parseHash()
    var key = p.key, sec = S[key]
    if (!sec) { key = ''; sec = S[''] }
    curKey = key; curArg = p.arg
    titleEl.textContent = typeof sec.title === 'function' ? sec.title(p.arg) : sec.title
    app.innerHTML = ''
    Promise.resolve().then(function () { return sec.build(p.arg) }).then(function (node) {
      if (curKey !== key || curArg !== p.arg) return
      app.innerHTML = ''
      add(app, node)
    }).catch(function () {
      app.innerHTML = ''
      app.appendChild(note('No se pudo cargar esta pantalla. Recarga la página e inténtalo de nuevo.'))
    })
    if (typeof scrollTo === 'function') scrollTo(0, 0)
  }
  function rerender() {
    var y = window.scrollY || 0
    render()
    setTimeout(function () { if (typeof scrollTo === 'function') scrollTo(0, y) }, 0)
  }
  d.getElementById('back').onclick = function () {
    if (nav > 0) { history.back(); return }
    if (curKey) { location.replace(parentHash(curKey, curArg)); return }
    if (history.length > 1) history.back(); else location.href = '/'
  }
  window.addEventListener('hashchange', function () {
    var p = parseHash(), depth = depthOf(p.key, p.arg)
    if (depth < lastDepth && nav > 0) nav--
    lastDepth = depth
    render()
  })

  // ───────── pantalla principal ─────────
  S[''] = {
    title: 'Ajustes',
    build: function () {
      var avatar = h('div', { class: 'pav' }), nameEl = h('div', { class: 'pname', text: 'Proyecto G' }), aboutEl = h('div', { class: 'pabout', text: 'Cargando…' })
      avatar.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z"/></svg>'
      api('/api/me').then(function (r) {
        if (!r.ok) { aboutEl.textContent = 'Bot desconectado: no se puede leer el perfil'; return }
        nameEl.textContent = r.name || ('+' + r.number)
        aboutEl.textContent = r.about || ('+' + r.number)
        var u = safeUrl(r.url)
        if (u) { avatar.innerHTML = ''; avatar.style.backgroundImage = 'url("' + u + '")' }
      })
      var item = function (key, icon, title, sub) { return row({ icon: icon, title: title, sub: sub, onclick: function () { go(key) } }) }
      return h('div', null,
        h('div', { class: 'profile', role: 'button', tabindex: '0', onclick: function () { location.href = '/profile.html' } }, avatar, nameEl, aboutEl),
        row({ icon: 'star', title: 'Mensajes destacados', sub: 'Tus mensajes marcados', onclick: function () { location.href = '/starred.html' } }),
        item('cuenta', 'account', 'Cuenta', 'Número, estado de conexión y sesión'),
        item('privacidad', 'lock', 'Privacidad', 'Última vez, foto de perfil, bloqueados'),
        item('listas', 'lists', 'Listas', 'Administrar listas de chats'),
        item('chats', 'chats', 'Chats', 'Fondo de pantalla, tamaño de letra, Enter'),
        item('apariencia', 'palette', 'Apariencia', 'Tema, fondo y tamaño de texto'),
        item('notificaciones', 'bell', 'Notificaciones', 'Mensajes y sonido'),
        item('almacenamiento', 'storage', 'Almacenamiento y datos', 'Espacio usado, caché, restablecer'),
        item('accesibilidad', 'access', 'Accesibilidad', 'Texto, contraste, animaciones, táctil'),
        item('idioma', 'globe', 'Idioma de la aplicación', 'Español'),
        item('ayuda', 'help', 'Ayuda y comentarios', 'Versión, estado del bot, diagnóstico'))
    }
  }

  // ───────── Cuenta ─────────
  S.cuenta = {
    title: 'Cuenta',
    build: async function () {
      var r = await Promise.all([api('/api/me'), api('/status'), api('/api/about')])
      var me = r[0], st = r[1], ab = r[2]
      var online = st && st.bot === 'conectado'
      return h('div', null,
        section('Cuenta de WhatsApp conectada'),
        row({ icon: 'user', title: 'Nombre', value: me.ok ? (me.name || '—') : '—' }),
        row({ icon: 'account', title: 'Número de WhatsApp', value: me.ok ? '+' + me.number : '—' }),
        row({ icon: 'info', title: 'Info', value: me.ok ? (me.about || '—') : '—' }),
        row({ icon: 'refresh', title: 'Estado de conexión', right: pill(online, 'Conectado', 'Desconectado') }),
        row({ icon: 'chats', title: 'Chats en el panel', value: st && st.chats != null ? String(st.chats) : '—' }),
        section('Sesión'),
        row({ icon: 'storage', title: 'Panel en ejecución desde hace', value: ab && ab.ok ? fmtDur(ab.uptime) : '—' }),
        note('La sesión de WhatsApp se guarda en el servidor, en la carpeta sesion/. El panel no la muestra, no la copia y no la borra.'),
        row({ icon: 'user', title: 'Editar perfil', sub: 'Nombre, info y foto', onclick: function () { location.href = '/profile.html' } }),
        row({ icon: 'lock', title: 'Privacidad y contactos bloqueados', onclick: function () { go('privacidad') } }),
        note('Solo desde la app oficial de WhatsApp: verificación en dos pasos, cambiar de número, eliminar la cuenta y gestionar dispositivos vinculados. El panel no puede hacerlo.'))
    }
  }

  // ───────── Privacidad ─────────
  var PV = {
    last: { t: 'Última vez', opts: [{ v: 'all', t: 'Todos' }, { v: 'contacts', t: 'Mis contactos' }, { v: 'none', t: 'Nadie' }] },
    online: { t: 'En línea', opts: [{ v: 'all', t: 'Todos' }, { v: 'match_last_seen', t: 'Igual que la última vez' }] },
    profile: { t: 'Foto de perfil', opts: [{ v: 'all', t: 'Todos' }, { v: 'contacts', t: 'Mis contactos' }, { v: 'none', t: 'Nadie' }] },
    status: { t: 'Info', opts: [{ v: 'all', t: 'Todos' }, { v: 'contacts', t: 'Mis contactos' }, { v: 'none', t: 'Nadie' }] },
    groupadd: { t: 'Grupos', opts: [{ v: 'all', t: 'Todos' }, { v: 'contacts', t: 'Mis contactos' }] }
  }
  var PV_EXTRA = { contact_blacklist: 'Mis contactos, excepto…' }
  function pvLabel(k, v) {
    var o = PV[k].opts.filter(function (x) { return x.v === v })[0]
    return o ? o.t : (PV_EXTRA[v] || String(v))
  }
  S.privacidad = {
    title: 'Privacidad',
    build: async function () {
      var r = await api('/api/privacy')
      if (!r.ok) {
        return h('div', null, note('No se pudo leer la privacidad de WhatsApp: ' + (r.error || 'error desconocido')),
          row({ icon: 'refresh', title: 'Reintentar', onclick: rerender }))
      }
      var s = r.settings || {}
      var change = async function (key, value) {
        var res = await postJSON('/api/privacy', { key: key, value: value })
        toast(res.ok ? 'Guardado en WhatsApp' : (res.error || 'WhatsApp rechazó el cambio'))
        rerender()
      }
      var items = ['last', 'online', 'profile', 'status', 'groupadd'].filter(function (k) { return s[k] !== undefined }).map(function (k) {
        return row({ title: PV[k].t, sub: pvLabel(k, s[k]), onclick: async function () {
          var v = await sheetRadio(PV[k].t, PV[k].opts, s[k])
          if (v != null && v !== s[k]) change(k, v)
        } })
      })
      return h('div', null,
        section('Quién puede ver mi información personal'), items,
        s.readreceipts !== undefined ? toggleRow({ title: 'Confirmaciones de lectura', sub: 'Si las desactivas, tampoco verás las confirmaciones de los demás', on: s.readreceipts === 'all',
          onChange: function (on) { change('readreceipts', on ? 'all' : 'none') } }) : null,
        section('Contactos'),
        row({ icon: 'block', title: 'Contactos bloqueados', sub: 'Ver y desbloquear', onclick: function () { go('bloqueados') } }),
        note('Mensajes temporales: se configuran por chat, en el menú del chat. El modo predeterminado, el bloqueo de la app y la verificación en dos pasos solo se cambian desde WhatsApp oficial.'))
    }
  }
  S.bloqueados = {
    title: 'Contactos bloqueados',
    build: async function () {
      var r = await api('/api/blocklist')
      if (!r.ok) return h('div', null, note('No se pudo leer la lista: ' + (r.error || 'error desconocido')), row({ icon: 'refresh', title: 'Reintentar', onclick: rerender }))
      var jids = r.jids || [], nums = r.numbers || []
      if (!jids.length) return h('div', { class: 'empty', text: 'No tienes contactos bloqueados' })
      return h('div', null, jids.map(function (jid, i) {
        var label = nums[i] ? '+' + nums[i] : 'Cuenta sin número visible'
        return h('div', { class: 'row static' }, h('span', { class: 'av', text: nums[i] ? String(nums[i]).slice(-2) : '?' }),
          h('span', { class: 'rt' }, h('div', { class: 'rtt', text: label })),
          h('button', { class: 'btn', type: 'button', text: 'Desbloquear', onclick: async function () {
            if (!await confirmDlg('Desbloquear', '¿Desbloquear a ' + label + '?', 'Desbloquear')) return
            var res = await postJSON('/api/block', { chatId: jid, block: false })
            toast(res.ok ? 'Desbloqueado' : (res.error || 'No se pudo desbloquear'))
            rerender()
          } }))
      }))
    }
  }

  // ───────── Listas ─────────
  async function listasIndex() {
    var st = chatState(), m = listsMap(st), names = Object.keys(m).sort()
    return h('div', null,
      note('Son listas internas del panel (no son listas de difusión de WhatsApp). Aparecen como filtros en la pantalla de chats. El panel solo recuerda las listas que tienen al menos un chat.'),
      names.length ? names.map(function (n) {
        return row({ icon: 'lists', title: n, sub: m[n].length + (m[n].length === 1 ? ' chat' : ' chats'), onclick: function () { go('listas', n) } })
      }) : h('div', { class: 'empty', text: 'Todavía no tienes listas' }),
      h('button', { class: 'fab', type: 'button', 'aria-label': 'Nueva lista', svg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>', onclick: async function () {
        var items = chatItems(await api('/chats'))
        if (!items.length) { toast('Todavía no hay chats en el panel'); return }
        var name = await askText('Nueva lista', '', 'Nombre de la lista', 30)
        if (name == null) return
        var st2 = chatState(), v = validListName(name, st2)
        if (v.err) { toast(v.err); return }
        var ids = await pickChats('Chats de «' + v.name + '»', items, [])
        if (!ids) return
        if (!ids.length) { toast('Elige al menos un chat'); return }
        ids.forEach(function (id) { var s = stOf(st2, id); s.lists = (s.lists || []).concat(v.name) })
        saveChatState(st2)
        toast('Lista creada')
        rerender()
      } }))
  }
  S.listas = {
    title: function (arg) { return arg || 'Listas' },
    build: function (arg) { return arg ? listaDetalle(arg) : listasIndex() }
  }
  async function listaDetalle(name) {
    var all = await api('/chats'), items = chatItems(all)
    var st = chatState(), ids = listsMap(st)[name] || []
    if (!ids.length) return h('div', null, h('div', { class: 'empty', text: 'Esta lista ya no existe' }), row({ title: 'Volver a Listas', onclick: function () { location.replace('#/listas') } }))
    return h('div', null,
      section(ids.length + (ids.length === 1 ? ' chat en la lista' : ' chats en la lista')),
      ids.map(function (id) {
        var nm = nameFor(items, id)
        return h('div', { class: 'row static' }, h('span', { class: 'av', text: (Array.from(nm)[0] || '?').toUpperCase() }),
          h('span', { class: 'rt' }, h('div', { class: 'rtt', text: nm })),
          h('button', { class: 'btn red', type: 'button', text: 'Quitar', onclick: function () {
            var s2 = chatState(), s = s2[id]
            if (s && s.lists) s.lists = s.lists.filter(function (n) { return n !== name })
            saveChatState(s2)
            toast('Chat quitado')
            if (ids.length === 1) location.replace('#/listas'); else rerender()
          } }))
      }),
      section('Administrar'),
      row({ icon: 'plus', title: 'Añadir o quitar chats', onclick: async function () {
        var picked = await pickChats('Chats de «' + name + '»', items, ids)
        if (!picked) return
        if (!picked.length) { toast('Para eliminar la lista usa «Eliminar lista»'); return }
        var s2 = chatState()
        Object.keys(s2).forEach(function (id) { if (s2[id] && s2[id].lists) s2[id].lists = s2[id].lists.filter(function (n) { return n !== name }) })
        picked.forEach(function (id) { var s = stOf(s2, id); s.lists = (s.lists || []).concat(name) })
        saveChatState(s2)
        toast('Lista actualizada')
        rerender()
      } }),
      row({ icon: 'info', title: 'Cambiar nombre', onclick: async function () {
        var nn = await askText('Cambiar nombre', name, 'Nombre de la lista', 30)
        if (nn == null) return
        var s2 = chatState(), v = validListName(nn, s2, name)
        if (v.err) { toast(v.err); return }
        Object.keys(s2).forEach(function (id) { var s = s2[id]; if (s && s.lists) s.lists = s.lists.map(function (n) { return n === name ? v.name : n }) })
        saveChatState(s2)
        toast('Nombre cambiado')
        location.replace('#/listas/' + encodeURIComponent(v.name))
      } }),
      row({ icon: 'trash', title: 'Eliminar lista', danger: true, sub: 'Los chats no se borran, solo dejan de estar en la lista', onclick: async function () {
        if (!await confirmDlg('Eliminar lista', '¿Eliminar la lista «' + name + '»? Los chats no se borran.', 'Eliminar', true)) return
        var s2 = chatState()
        Object.keys(s2).forEach(function (id) { var s = s2[id]; if (s && s.lists) s.lists = s.lists.filter(function (n) { return n !== name }) })
        saveChatState(s2)
        toast('Lista eliminada')
        location.replace('#/listas')
      } }))
  }

  // ───────── Chats ─────────
  S.chats = {
    title: 'Chats',
    build: function () {
      var s = prefs()
      return h('div', null,
        section('Pantalla de chat'), chatLook(rerender),
        section('Teclado'),
        toggleRow({ title: 'La tecla Enter envía', sub: s.enterSend ? 'Enter envía el mensaje; Mayús + Enter hace un salto de línea' : 'Enter hace un salto de línea; para enviar usa el botón de enviar',
          on: s.enterSend, onChange: function (on) { setPrefs({ enterSend: on }); rerender() } }),
        section('Organización'),
        row({ icon: 'lists', title: 'Listas', sub: 'Agrupa chats y verlos como filtro', onclick: function () { go('listas') } }),
        note('Los cambios se aplican la próxima vez que abras un chat.'))
    }
  }

  // ───────── Apariencia ─────────
  S.apariencia = {
    title: 'Apariencia',
    build: function () {
      return h('div', null,
        section('Tema'),
        row({ icon: 'palette', title: 'Tema oscuro', sub: 'Activo', right: pill(true, 'Activo', '') }),
        note('El tema claro y los colores de acento no están disponibles: las pantallas del panel usan colores fijos y no se podrían cambiar sin romper su diseño.'),
        section('Chats'), chatLook(rerender))
    }
  }

  // ───────── Notificaciones ─────────
  function playBeep() {
    try {
      var C = window.AudioContext || window.webkitAudioContext
      var c = new C(), o = c.createOscillator(), g = c.createGain()
      o.connect(g); g.connect(c.destination)
      o.frequency.value = 880; g.gain.value = 0.08
      o.start(); o.stop(c.currentTime + 0.15)
      return true
    } catch (e) { return false }
  }
  S.notificaciones = {
    title: 'Notificaciones',
    build: function () {
      var s = prefs()
      var supported = !!window.Notification
      var perm = supported ? Notification.permission : 'unsupported'
      var notifOn = !!s.notif && supported && perm === 'granted'
      var permTxt = { granted: 'Permitidas', denied: 'Bloqueadas en el navegador', default: 'Sin permitir', unsupported: 'No compatible' }[perm]
      return h('div', null,
        section('Mensajes'),
        toggleRow({ icon: 'bell', title: 'Notificaciones de mensajes', sub: 'Avisan de mensajes nuevos con el panel abierto en el navegador', on: notifOn,
          onChange: async function (on) {
            if (on && supported && Notification.permission !== 'granted') {
              var p = await Notification.requestPermission()
              if (p !== 'granted') { toast('Permiso de notificaciones denegado'); setPrefs({ notif: false }); rerender(); return }
            }
            if (on && !supported) { toast('Este navegador no admite notificaciones'); return }
            setPrefs({ notif: on }); rerender()
          } }),
        row({ icon: 'info', title: 'Permiso del navegador', value: permTxt }),
        perm === 'denied' ? note('El navegador bloqueó las notificaciones para este sitio. Actívalas desde los ajustes del sitio en el navegador (icono junto a la dirección) y recarga.') : null,
        section('Sonido'),
        toggleRow({ icon: 'sound', title: 'Sonido de mensajes', sub: 'Un aviso corto al recibir un mensaje', on: s.sound !== false, onChange: function (on) { setPrefs({ sound: on }); rerender() } }),
        row({ icon: 'sound', title: 'Probar sonido', onclick: function () { if (!playBeep()) toast('Este navegador no puede reproducir el sonido') } }),
        note('Importante: las notificaciones y el sonido solo funcionan mientras el panel está abierto en una pestaña. Con el panel cerrado no llegan avisos (no hay notificaciones push en segundo plano).'),
        note('Para silenciar un chat concreto, mantenlo pulsado en la lista de chats y usa el botón de silenciar.'))
    }
  }

  // ───────── Almacenamiento y datos ─────────
  S.almacenamiento = {
    title: 'Almacenamiento y datos',
    build: async function () {
      var sum = await api('/api/storage-summary')
      var local = 0
      try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); local += (k.length + String(localStorage.getItem(k) || '').length) * 2 } } catch (e) {}
      var est = null
      try { if (navigator.storage && navigator.storage.estimate) est = await navigator.storage.estimate() } catch (e) {}
      return h('div', null,
        section('Uso de espacio'),
        row({ icon: 'storage', title: 'Multimedia guardada en el servidor', value: sum.ok ? sum.media.files + ' archivos · ' + fmtBytes(sum.media.bytes) : '—' }),
        row({ icon: 'chats', title: 'Base de datos de chats', value: sum.ok ? fmtBytes(sum.dbBytes) : '—' }),
        row({ icon: 'user', title: 'Datos de este navegador', sub: 'Ajustes, listas, borradores y caché de fotos', value: fmtBytes(local) }),
        est && est.quota ? row({ icon: 'info', title: 'Cuota del navegador', value: fmtBytes(est.usage || 0) + ' de ' + fmtBytes(est.quota) }) : null,
        section('Caché'),
        row({ icon: 'trash', title: 'Borrar caché de fotos de perfil', sub: 'Elimina solo las fotos de perfil guardadas en este navegador. Se vuelven a descargar al usarlas. No borra chats, multimedia, listas ni la sesión.',
          onclick: async function () {
            if (!await confirmDlg('Borrar caché de fotos', 'Se eliminarán las fotos de perfil guardadas en este navegador. Tus chats, multimedia, listas y la sesión de WhatsApp no se tocan.', 'Borrar', true)) return
            localStorage.removeItem('pfpCache')
            toast('Caché de fotos borrada')
            rerender()
          } }),
        section('Descarga automática'),
        note('El bot descarga siempre la multimedia que recibe para poder mostrarla en el panel. Limitarlo exigiría cambiar el bot, por eso no hay controles aquí.'),
        section('Datos'),
        row({ icon: 'refresh', title: 'Restablecer ajustes', danger: true, sub: 'Vuelve a los valores iniciales de Ajustes. No borra chats, listas, mensajes ni la sesión.',
          onclick: async function () {
            if (!await confirmDlg('Restablecer ajustes', 'Se restablecerán fondo, tamaño de letra, Enter, notificaciones, sonido y accesibilidad. Chats, listas y la sesión no se tocan.', 'Restablecer', true)) return
            localStorage.removeItem('settings')
            if (window.PGPrefs) window.PGPrefs.apply()
            toast('Ajustes restablecidos')
            rerender()
          } }))
    }
  }

  // ───────── Accesibilidad ─────────
  S.accesibilidad = {
    title: 'Accesibilidad',
    build: function () {
      var s = prefs()
      var tg = function (key, icon, title, sub) {
        return toggleRow({ icon: icon, title: title, sub: sub, on: !!s[key], onChange: function (on) { var p = {}; p[key] = on; setPrefs(p); rerender() } })
      }
      return h('div', null,
        section('Texto'), fontChips(rerender, FONTS.concat([{ n: 21, t: 'Extra grande' }])),
        note('El tamaño de letra cambia el texto de los mensajes dentro de los chats.'),
        section('Visión'),
        tg('contrast', 'access', 'Aumentar contraste', 'Textos secundarios más claros en todo el panel'),
        tg('reduceMotion', 'refresh', 'Reducir animaciones', 'Quita transiciones y animaciones'),
        section('Interacción táctil'),
        tg('bigTouch', 'user', 'Botones y filas más grandes', 'Áreas táctiles más amplias en listas y menús'))
    }
  }

  // ───────── Idioma ─────────
  S.idioma = {
    title: 'Idioma de la aplicación',
    build: function () {
      return h('div', null,
        h('div', { class: 'opt on', style: 'cursor:default' }, h('span', { class: 'rad' }), h('span', { text: 'Español (predeterminado)' })),
        note('Por ahora el panel solo está disponible en español. No se añaden idiomas hasta que todas las pantallas estén traducidas.'))
    }
  }

  // ───────── Ayuda y comentarios ─────────
  function diag(ab, st) {
    var s = prefs()
    return ['Proyecto G Chat — informe de diagnóstico',
      'Versión del panel: ' + (ab && ab.version || '—'), 'Node del servidor: ' + (ab && ab.node || '—'),
      'Panel activo: ' + (ab && ab.ok ? fmtDur(ab.uptime) : '—'), 'Bot: ' + (st && st.bot || '—'), 'Chats: ' + (st && st.chats != null ? st.chats : '—'),
      'Navegador: ' + (navigator.userAgent || '—'), 'Notificaciones: ' + (window.Notification ? Notification.permission : 'no compatible'),
      'Ajustes: ' + JSON.stringify(s), 'Errores de esta pantalla: ' + (errors.length ? errors.slice(-5).join(' | ') : 'ninguno')].join('\n')
  }
  S.ayuda = {
    title: 'Ayuda y comentarios',
    build: async function () {
      var r = await Promise.all([api('/api/about'), api('/status')])
      var ab = r[0], st = r[1], online = st && st.bot === 'conectado'
      return h('div', null,
        section('Proyecto'),
        row({ icon: 'info', title: 'Proyecto G Chat', sub: 'Panel web para WhatsApp' }),
        row({ icon: 'info', title: 'Versión del panel', value: ab.ok ? (ab.version || '—') : '—' }),
        row({ icon: 'info', title: 'Servidor', value: ab.ok ? 'Node ' + ab.node : '—' }),
        row({ icon: 'refresh', title: 'Estado del bot', right: pill(online, 'Conectado', 'Desconectado') }),
        row({ icon: 'chats', title: 'Chats en el panel', value: st && st.chats != null ? String(st.chats) : '—' }),
        section('Reportar un problema'),
        row({ icon: 'copy', title: 'Copiar informe de diagnóstico', sub: 'Versión, estado, navegador y ajustes (sin mensajes ni números)', onclick: async function () {
          var txt = diag(ab, st)
          try { await navigator.clipboard.writeText(txt); toast('Informe copiado'); return } catch (e) {}
          var ta = h('textarea', { class: 'inp', rows: '9', readonly: true }); ta.value = txt
          var ov = overlay(true)
          ov.onclick = function (e) { if (e.target === ov) ov.remove() }
          ov.appendChild(h('div', { class: 'dlg' }, h('h3', { text: 'Informe de diagnóstico' }), ta, h('div', { class: 'acts' }, h('button', { class: 'btn fill', type: 'button', text: 'Cerrar', onclick: function () { ov.remove() } }))))
        } }),
        note('Si algo falla, copia el informe y revisa la consola del servidor (la terminal donde ejecutas npm start): ahí aparecen los errores del bot y de WhatsApp.'),
        section('Funciones no disponibles'),
        row({ title: 'Difusiones', sub: 'No implementado: Baileys no ofrece una API para crear ni administrar listas de difusión (solo existen en la app del teléfono). Sin soporte real no se simula.' }),
        row({ title: 'Eventos', sub: 'No implementado: no hay soporte confirmado de eventos en la versión de Baileys usada. Sin soporte real no se simulan.' }),
        row({ title: 'Verificación en dos pasos, cambio de número, eliminar cuenta, dispositivos vinculados', sub: 'Solo se pueden hacer desde la app oficial de WhatsApp.' }),
        row({ title: 'Tema claro e idiomas adicionales', sub: 'No disponibles: requerirían rehacer todas las pantallas del panel.' }))
    }
  }

  // ───────── arranque ─────────
  var first = parseHash()
  lastDepth = depthOf(first.key, first.arg)
  render()
})()
