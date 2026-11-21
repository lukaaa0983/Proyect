let allChats      = {}
let chatState     = {}
let currentFilter = 'all'
let searchQuery   = ''
let ctxChatId     = null

function loadState() {
  try { const s = localStorage.getItem('chatState'); if (s) chatState = JSON.parse(s) } catch {}
}

function persistState() {
  try { localStorage.setItem('chatState', JSON.stringify(chatState)) } catch {}
}

function getState(chatId) {
  if (!chatState[chatId]) chatState[chatId] = { unread: 0, favorite: false, archived: false }
  return chatState[chatId]
}

// ========================
// 🤖 ESTADO DEL BOT
// ========================
async function checkBotStatus() {
  try {
    const data   = await API.getStatus()
    const dot    = document.getElementById('statusDot')
    const text   = document.getElementById('statusText')
    const online = data.bot === 'conectado'
    dot.className  = online ? 'online' : 'offline'
    text.className = online ? 'online' : 'offline'
    text.textContent = online ? `Bot activo · ${data.chats} chats` : 'Bot desconectado'
  } catch {
    document.getElementById('statusText').textContent = 'Sin conexión'
  }
}

// ========================
// 🔍 BUSCADOR
// ========================
function toggleSearch() {
  const bar = document.getElementById('searchBar')
  bar.classList.toggle('open')
  if (bar.classList.contains('open')) {
    document.getElementById('searchInput').focus()
  } else {
    document.getElementById('searchInput').value = ''
    searchQuery = ''
    renderChats()
  }
}

// ========================
// 🗂️ FILTROS
// ========================
function setFilter(filter) {
  currentFilter = filter
  // Quitar chip de archived si no existe en HTML (lo removimos)
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'))
  const chip = document.getElementById(`chip-${filter}`)
  if (chip) chip.classList.add('active')
  renderChats()
}

// ========================
// 📊 STATS (solo interno, sin mostrar contadores)
// ========================
function updateStats() {
  // Ya no mostramos contadores en chips
  // Solo se usa internamente
}

// ========================
// 🏗️ BUILD ITEM
// ========================
function buildItem(chatId, data) {
  const div     = document.createElement('div')
  const state   = getState(chatId)
  const unread  = state.unread || 0
  const isGroup = chatId.endsWith('@g.us')
  const last    = data.messages?.at(-1)
  const name    = data.name || chatId

  div.className  = `chat-item${unread > 0 ? ' has-unread' : ''}`
  div.dataset.chatId = chatId

  const time     = last ? UI.formatTime(last.timestamp) : ''
  const lastText = last
    ? (last.fromMe
        ? `${last.content || '📎 Multimedia'}`
        : (isGroup ? `${last.senderName?.split(' ')[0] || ''}: ` : '') + (last.content || '📎 Multimedia'))
    : 'Sin mensajes'

  const draft = localStorage.getItem('draft:' + chatId)
  const tick  = last && last.fromMe ? (last.status >= 4 ? '<span style="color:#53bdeb">✓✓</span> ' : (last.status != null && last.status <= 2 ? '✓ ' : '✓✓ ')) : ''
  // Avatar
  const avatarEl = document.createElement('div')
  avatarEl.className = 'avatar'

  if (isGroup) {
    avatarEl.textContent = '👥'
    avatarEl.style.background = 'linear-gradient(135deg, #2a3942, #1a2a32)'
  } else {
    avatarEl.textContent = name.charAt(0).toUpperCase()
  }

  if (state.favorite) {
    avatarEl.style.boxShadow = '0 0 0 2px var(--gold)'
  }

  div.appendChild(avatarEl)
  loadPfp(chatId, avatarEl)
  div._cid = chatId

  // Info
  const info = document.createElement('div')
  info.className = 'chat-info'
  info.innerHTML = `
    <div class="chat-row1">
      <div class="chat-name">${name}${state.favorite ? ' ⭐' : ''}${state.muted ? ' 🔕' : ''}</div>
      <div class="chat-time ${unread > 0 ? 'gold' : ''}">${time}</div>
    </div>
    <div class="chat-row2">
      <div class="chat-preview">${draft ? '<span style="color:#00a884">Borrador:</span> ' + draft.replace(/</g, '&lt;') : tick + lastText}</div>
      ${unread > 0 ? `<div class="badge"${state.muted ? ' style="background:var(--surface3);color:var(--text-dim)"' : ''}>${unread > 99 ? '99+' : unread}</div>` : (state.pinned ? '<div style="font-size:13px;opacity:.7">📌</div>' : '')}
    </div>
  `
  div.appendChild(info)

  div.onclick = () => {
    if (div._lp) { div._lp = false; return }
    getState(chatId).unread = 0
    persistState()
    location.href = '/chat.html?id=' + encodeURIComponent(chatId)
  }

  let pressTimer
  const cancel = () => clearTimeout(pressTimer)
  div.addEventListener('touchstart', () => {
    div._lp = false
    pressTimer = setTimeout(() => { div._lp = true; navigator.vibrate?.(15); openCtxMenu(chatId, div) }, 450)
  }, { passive: true })
  div.addEventListener('touchend', cancel)
  div.addEventListener('touchmove', cancel, { passive: true })
  div.addEventListener('touchcancel', cancel)
  div.addEventListener('contextmenu', (e) => { e.preventDefault(); div._lp = true; openCtxMenu(chatId, div) })

  return div
}

// ========================
// 🎨 RENDER LISTA
// ========================
function renderChats() {
  renderListChips()
  const container  = document.getElementById('chatList')
  const emptyState = document.getElementById('emptyState')
  container.innerHTML = ''
  container.appendChild(emptyState)

  // ── Fila archivados al tope (solo en filtro 'all') ──
  const archivedIds = Object.keys(allChats).filter(id => getState(id).archived)
  if (currentFilter === 'all' && archivedIds.length > 0) {
    const archRow = document.createElement('div')
    archRow.style.cssText = `
      padding: 14px 16px;
      display: flex;
      align-items: center;
      gap: 14px;
      cursor: pointer;
      border-bottom: 1px solid var(--border);
      background: var(--bg);
      transition: background 0.15s;
    `
    archRow.innerHTML = `
      <div style="width:52px;height:52px;border-radius:50%;background:var(--surface2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">📦</div>
      <div>
        <div style="font-size:16px;font-weight:600;color:var(--gold-light)">Archivados</div>
        <div style="font-size:13px;color:var(--text-dim);margin-top:2px">${archivedIds.length} chat${archivedIds.length > 1 ? 's' : ''}</div>
      </div>
    `
    archRow.addEventListener('touchstart', () => archRow.style.background = 'var(--surface)')
    archRow.addEventListener('touchend',   () => archRow.style.background = 'var(--bg)')
    archRow.onclick = () => setFilter('archived')
    container.appendChild(archRow)
  }

  let entries = Object.entries(allChats)

  // Filtros
  if (currentFilter === 'unread')    entries = entries.filter(([id]) => (getState(id).unread || 0) > 0)
  if (currentFilter === 'favorites') entries = entries.filter(([id]) => getState(id).favorite)
  if (currentFilter === 'groups')    entries = entries.filter(([id]) => id.endsWith('@g.us'))
  if (currentFilter === 'archived')  entries = entries.filter(([id]) => getState(id).archived)
  if (currentFilter === 'all')       entries = entries.filter(([id]) => !getState(id).archived)
  if (currentFilter.startsWith('list:')) entries = entries.filter(([id]) => (getState(id).lists || []).includes(currentFilter.slice(5)))
  if (!searchQuery) entries = entries.filter(([id]) => !getState(id).restricted)

  // Búsqueda
  if (searchQuery) entries = entries.filter(([id, data]) =>
    (data.name || id).toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Ordenar: favoritos primero, luego por timestamp
  entries.sort((a, b) => {
    const favA = getState(a[0]).favorite ? 1 : 0
    const favB = getState(b[0]).favorite ? 1 : 0
    if (favB !== favA) return favB - favA
    const pinA = getState(a[0]).pinned ? 1 : 0
    const pinB = getState(b[0]).pinned ? 1 : 0
    if (pinB !== pinA) return pinB - pinA
    return (b[1].messages?.at(-1)?.timestamp || 0) - (a[1].messages?.at(-1)?.timestamp || 0)
  })

  if (entries.length === 0) {
    emptyState.style.display = 'flex'
    return
  }
  emptyState.style.display = 'none'

  const favs    = entries.filter(([id]) => getState(id).favorite)
  const nonFavs = entries.filter(([id]) => !getState(id).favorite)

  if (favs.length > 0 && currentFilter !== 'favorites') {
    const l = document.createElement('div')
    l.className = 'section-label'
    l.textContent = 'Favoritos'
    container.appendChild(l)
    favs.forEach(([id, data]) => container.appendChild(buildItem(id, data)))

    if (nonFavs.length > 0) {
      const l2 = document.createElement('div')
      l2.className = 'section-label'
      l2.textContent = 'Todos los chats'
      container.appendChild(l2)
    }
  }

  const toRender = (favs.length > 0 && currentFilter !== 'favorites') ? nonFavs : entries
  toRender.forEach(([id, data]) => container.appendChild(buildItem(id, data)))
}

// ========================
// 📋 CONTEXT MENU
// ========================
function openCtxMenu(chatId, el) {
  ctxChatId = chatId
  const state = getState(chatId)
  document.getElementById('ctx-fav-label').textContent     = state.favorite ? 'Quitar favorito' : 'Agregar favorito'
  document.getElementById('ctx-archive-label').textContent = state.archived ? 'Desarchivar' : 'Archivar'
  document.getElementById('ctx-pin-label').textContent     = state.pinned ? 'Desfijar chat' : 'Fijar chat'
  document.getElementById('ctx-mute-label').textContent    = state.muted ? 'Dejar de silenciar' : 'Silenciar'
  document.getElementById('ctx-read-label').textContent    = state.unread ? 'Marcar como leído' : 'Marcar como no leído'
  const menu = document.getElementById('ctxMenu')
  const rect = el.getBoundingClientRect()
  menu.style.top   = Math.min(rect.bottom, window.innerHeight - 220) + 'px'
  menu.style.left  = '16px'
  menu.style.right = '16px'
  menu.style.width = 'auto'
  document.getElementById('overlay').classList.add('open')
  menu.classList.add('open')
}

function closeCtxMenu() {
  document.getElementById('ctxMenu').classList.remove('open')
  document.getElementById('overlay').classList.remove('open')
  ctxChatId = null
}

function ctxAction(action) {
  if (!ctxChatId) return
  const state = getState(ctxChatId)
  if (action === 'fav')    { state.favorite = !state.favorite }
  if (action === 'archive') { state.archived = !state.archived; state.favorite = false }
  if (action === 'read')   { state.unread = state.unread ? 0 : 1 }
  if (action === 'mute')   { state.muted = !state.muted }
  if (action === 'pin') {
    if (!state.pinned && Object.keys(chatState).filter(k => chatState[k].pinned).length >= 3) { closeCtxMenu(); alert('Solo puedes fijar hasta 3 chats'); return }
    state.pinned = !state.pinned
  }
  if (action === 'delete') {
    if (confirm('¿Eliminar este chat del panel?')) {
      delete allChats[ctxChatId]
      delete chatState[ctxChatId]
    }
  }
  persistState()
  closeCtxMenu()
  renderChats()
}

// ========================
// 📥 CARGAR CHATS
// ========================
async function loadChats() {
  allChats = await API.getChats()
  renderChats()
}

// ========================
// ⚡ TIEMPO REAL
// ========================
SocketManager.onChatUpdated(({ chatId, name, lastMessage }) => {
  if (!allChats[chatId]) allChats[chatId] = { name, messages: [] }
  allChats[chatId].name = name
  allChats[chatId].messages = allChats[chatId].messages || []
  allChats[chatId].messages.push(lastMessage)
  if (!lastMessage.fromMe) {
    getState(chatId).unread = (getState(chatId).unread || 0) + 1
    persistState()
  }
  renderChats()
})

// ========================
// 🔍 BUSCADOR
// ========================
document.getElementById('searchInput').addEventListener('input', (e) => {
  searchQuery = e.target.value
  renderChats()
})

// ========================
// ▶️ INIT
// ========================
loadState()
loadChats()
checkBotStatus()
setInterval(checkBotStatus, 15000)

// Link a estados
const statusLink = document.createElement('div')
statusLink.style.cssText = 'padding:14px 16px;display:flex;gap:12px;align-items:center;cursor:pointer;border-bottom:1px solid var(--border);background:var(--surface)'
statusLink.innerHTML = '<div style="width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#9c27b0,#673ab7);display:flex;align-items:center;justify-content:center;font-size:24px">📢</div><div><div style="font-weight:600">Estados</div><div style="font-size:12px;color:var(--text-dim)">Mira los últimos</div></div>'
statusLink.onclick = () => location.href = '/statuses.html'

document.getElementById('chatList').insertBefore(statusLink, document.getElementById('chatList').firstChild)

document.addEventListener('keydown', e => e.key === 'Escape' && closeCtxMenu())
window.addEventListener('pageshow', e => { if (e.persisted) { closeCtxMenu(); loadChats() } })

function plusMenu() {
  const ov = document.createElement('div')
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:900;display:flex;align-items:flex-end'
  ov.onclick = e => { if (e.target === ov) ov.remove() }
  const box = document.createElement('div')
  box.style.cssText = 'background:var(--surface);width:100%;border-radius:20px 20px 0 0;padding:10px 0 calc(14px + env(safe-area-inset-bottom))'
  ;[['💬 Nuevo chat', newChat], ['👥 Nuevo grupo', newGroup], ['⭐ Mensajes destacados', () => { location.href = '/starred.html' }], ['👤 Perfil', () => { location.href = '/profile.html' }], ['✅ Marcar todos como leídos', markAllRead], ['⚙️ Ajustes', () => { location.href = '/settings.html' }]].forEach(([l, fn]) => {
    const d = document.createElement('div')
    d.textContent = l
    d.style.cssText = 'padding:16px 22px;cursor:pointer'
    d.onclick = () => { ov.remove(); fn() }
    box.appendChild(d)
  })
  ov.appendChild(box)
  document.body.appendChild(ov)
}
async function newChat() {
  const v = prompt('Número con código de país (ej: 59899123456)')
  const n = (v || '').replace(/\D/g, '')
  if (!n) return
  const r = await (await fetch('/api/check/' + n)).json()
  if (!r.exists) { alert(r.error ? 'No se pudo verificar el número' : 'Ese número no tiene WhatsApp'); return }
  location.href = '/chat.html?id=' + encodeURIComponent(r.jid)
}
async function newGroup() {
  const subject = prompt('Nombre del grupo')
  if (!subject || !subject.trim()) return
  const v = prompt('Números de los miembros, separados por coma')
  const numbers = (v || '').split(',').map(x => x.replace(/\D/g, '')).filter(Boolean)
  if (!numbers.length) return
  const r = await (await fetch('/api/group-create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subject: subject.trim(), numbers }) })).json()
  if (!r.ok) { alert(r.error || 'No se pudo crear el grupo'); return }
  location.href = '/chat.html?id=' + encodeURIComponent(r.id)
}

function renderListChips() {
  const anchor = document.getElementById('chip-groups')
  if (!anchor) return
  const bar = anchor.parentElement
  bar.querySelectorAll('.list-chip').forEach(n => n.remove())
  const names = [...new Set(Object.values(chatState).flatMap(s => s.lists || []))]
  names.forEach(n => {
    const c = document.createElement('div')
    c.className = 'filter-chip list-chip' + (currentFilter === 'list:' + n ? ' active' : '')
    c.id = 'chip-list:' + n
    c.textContent = n
    c.onclick = () => setFilter('list:' + n)
    bar.appendChild(c)
  })
}

function beep() {
  try {
    const c = new (window.AudioContext || window.webkitAudioContext)()
    const o = c.createOscillator(), g = c.createGain()
    o.connect(g); g.connect(c.destination)
    o.frequency.value = 880; g.gain.value = 0.08
    o.start(); o.stop(c.currentTime + 0.15)
  } catch (e) {}
}
SocketManager.onChatUpdated(({ chatId, name, lastMessage }) => {
  let s = {}
  try { s = JSON.parse(localStorage.getItem('settings') || '{}') } catch (e) {}
  if (!s.notif || !lastMessage || lastMessage.fromMe) return
  if (chatState[chatId] && chatState[chatId].muted) return
  if (s.sound !== false) beep()
  if (window.Notification && Notification.permission === 'granted') new Notification(name || chatId, { body: lastMessage.content || '📎 Multimedia' })
})

const PFP = (() => { try { return JSON.parse(localStorage.getItem('pfpCache') || '{}') } catch (e) { return {} } })()
function loadPfp(id, el) {
  const show = u => { const im = new Image(); im.onload = () => { el.textContent = ''; el.style.backgroundImage = 'url("' + u + '")'; el.style.backgroundSize = 'cover'; el.style.backgroundPosition = 'center' }; im.src = u }
  const c = PFP[id]
  if (c && c.url) show(c.url)
  if (c && Date.now() - c.t < 6 * 3600e3) return
  fetch('/api/pfp/' + encodeURIComponent(id)).then(r => r.json()).then(r => {
    PFP[id] = { url: r.url || '', t: Date.now() }
    localStorage.setItem('pfpCache', JSON.stringify(PFP))
    if (r.url) show(r.url)
  }).catch(() => {})
}
function markAllRead() {
  Object.keys(chatState).forEach(k => { chatState[k].unread = 0 })
  persistState()
  renderChats()
}
setInterval(() => {
  const n = Object.values(chatState).reduce((a, s) => a + (s.unread || 0), 0)
  document.title = (n ? '(' + n + ') ' : '') + 'Proyecto G'
}, 1000)

function unmuteExpired() {
  let ch = false
  Object.values(chatState).forEach(s => { if (s.muted && s.mutedUntil && s.mutedUntil < Date.now()) { s.muted = false; s.mutedUntil = 0; ch = true } })
  if (ch) { persistState(); renderChats() }
}
setInterval(unmuteExpired, 30000)
unmuteExpired()

const __sf = setFilter
setFilter = function (f) {
  __sf(f)
  const arch = f === 'archived'
  document.body.classList.toggle('arch-mode', arch)
  const row = document.getElementById('chip-all') && document.getElementById('chip-all').parentElement
  if (row) row.style.display = arch ? 'none' : ''
}
const __rc = renderChats
renderChats = function () {
  __rc()
  const c = document.getElementById('chatList')
  const row = [...c.children].find(x => !x.classList.contains('chat-item') && /Archivados/.test(x.textContent || ''))
  if (row && !row.dataset.wa) {
    row.dataset.wa = '1'
    const n = (row.textContent.match(/(\d+)\s*chat/) || [])[1] || ''
    row.style.cssText = 'padding:12px 16px;display:flex;align-items:center;gap:22px;cursor:pointer;background:transparent'
    row.innerHTML = '<div style="width:52px;text-align:center;font-size:22px;color:#8696a0">🗃</div><div style="flex:1;color:#e9edef;font-size:17px">Archivados</div><div style="color:#00a884;font-size:14px;padding-right:4px">' + n + '</div>'
  }
}

// ===== Selección de chats estilo WhatsApp y pantalla de nuevo chat =====
const selChats = new Set()
function markSel() {
  document.querySelectorAll('.chat-item').forEach(el => { el.style.background = el._cid && selChats.has(el._cid) ? '#182229' : '' })
}
function clearSel() {
  selChats.clear()
  renderSelBar()
  renderChats()
}
function toggleChatSel(id) {
  if (selChats.has(id)) selChats.delete(id); else selChats.add(id)
  renderSelBar()
  markSel()
}
function selApply(fn) {
  selChats.forEach(id => fn(getState(id), id))
  persistState()
  clearSel()
}
function renderSelBar() {
  let bar = document.getElementById('selbar2')
  if (!selChats.size) { if (bar) bar.remove(); return }
  if (!bar) {
    bar = document.createElement('div')
    bar.id = 'selbar2'
    bar.style.cssText = 'position:fixed;top:0;left:0;right:0;height:60px;background:#202c33;z-index:980;display:flex;align-items:center;gap:20px;padding:0 16px;color:#e9edef;font-size:21px'
    document.body.appendChild(bar)
  }
  bar.innerHTML = ''
  const mk = (t, fn) => { const s = document.createElement('span'); s.textContent = t; s.style.cssText = 'cursor:pointer;padding:4px'; s.onclick = fn; return s }
  const cnt = document.createElement('span')
  cnt.textContent = selChats.size
  cnt.style.cssText = 'flex:1;font-size:19px;font-weight:600'
  const ids = [...selChats]
  bar.append(
    mk('✕', clearSel), cnt,
    mk('📌', () => {
      const add = ids.filter(i => !getState(i).pinned).length
      const cur = Object.keys(chatState).filter(k => chatState[k].pinned && !selChats.has(k)).length
      const allPinned = ids.every(i => getState(i).pinned)
      if (!allPinned && cur + add > 3) return alert('Solo puedes fijar hasta 3 chats')
      selApply(s => { s.pinned = !allPinned })
    }),
    mk('🔕', () => { const all = ids.every(i => getState(i).muted); selApply(s => { s.muted = !all }) }),
    mk('📦', () => { const all = ids.every(i => getState(i).archived); selApply(s => { s.archived = !all; if (!all) s.favorite = false }) }),
    mk('⋮', () => {
      const ov = document.createElement('div')
      ov.style.cssText = 'position:fixed;inset:0;z-index:990'
      ov.onclick = () => ov.remove()
      const m = document.createElement('div')
      m.style.cssText = 'position:absolute;top:56px;right:10px;background:#1f2c34;border-radius:14px;min-width:230px;padding:6px 0;box-shadow:0 6px 24px rgba(0,0,0,.55)'
      const allUnread = ids.every(i => !getState(i).unread)
      const allFav = ids.every(i => getState(i).favorite)
      const rows = [
        [allUnread ? 'Marcar como no leído' : 'Marcar como leído', () => selApply(s => { s.unread = allUnread ? 1 : 0 })],
        [allFav ? 'Quitar de favoritos' : 'Agregar a favoritos', () => selApply(s => { s.favorite = !allFav })],
        ['Eliminar chat', () => { if (!confirm('¿Eliminar ' + ids.length + ' chat(s) del panel?')) return; ids.forEach(i => { delete allChats[i]; delete chatState[i] }); persistState(); clearSel() }]
      ]
      rows.forEach(([l, fn]) => { const d = document.createElement('div'); d.textContent = l; d.style.cssText = 'padding:14px 22px;font-size:16px;cursor:pointer;color:#e9edef'; d.onclick = () => fn(); m.appendChild(d) })
      ov.appendChild(m)
      document.body.appendChild(ov)
    })
  )
}
openCtxMenu = function (chatId) { toggleChatSel(chatId) }
document.getElementById('chatList').addEventListener('click', e => {
  if (!selChats.size) return
  const it = e.target.closest('.chat-item')
  if (!it || !it._cid) return
  e.preventDefault(); e.stopPropagation()
  toggleChatSel(it._cid)
}, true)
const __rc2 = renderChats
renderChats = function () { __rc2(); markSel() }

async function newChatByNumber() {
  const v = prompt('Número con código de país (ej: 59899123456)')
  const n = (v || '').replace(/\D/g, '')
  if (!n) return
  const r = await (await fetch('/api/check/' + n)).json()
  if (!r.exists) { alert(r.error ? 'No se pudo verificar el número' : 'Ese número no tiene WhatsApp'); return }
  location.href = '/chat.html?id=' + encodeURIComponent(r.jid)
}
newChat = function () {
  const ov = document.createElement('div')
  ov.style.cssText = 'position:fixed;inset:0;background:#0b141a;z-index:995;display:flex;flex-direction:column;color:#e9edef'
  ov.innerHTML = '<div style="display:flex;align-items:center;gap:18px;padding:14px 16px;font-size:22px"><span id="ncBack" style="cursor:pointer;padding:0 6px">←</span><div><div style="font-size:18px;font-weight:600">Seleccionar contacto</div><div id="ncCount" style="font-size:13px;color:#8696a0"></div></div></div><input id="ncq" placeholder="Buscar nombre o número..." style="margin:4px 16px 10px;padding:11px 16px;border-radius:22px;border:none;background:#202c33;color:#e9edef;font-size:15px;outline:none"><div id="nclist" style="flex:1;overflow:auto"></div>'
  document.body.appendChild(ov)
  ov.querySelector('#ncBack').onclick = () => ov.remove()
  const list = ov.querySelector('#nclist')
  const row = (icon, title, sub, fn, green) => {
    const d = document.createElement('div')
    d.style.cssText = 'display:flex;align-items:center;gap:16px;padding:10px 16px;cursor:pointer'
    const a = document.createElement('div')
    a.style.cssText = 'width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;background:' + (green ? '#00a884' : '#2a3942') + ';background-size:cover;background-position:center'
    a.textContent = icon
    const t = document.createElement('div')
    t.innerHTML = '<div style="font-size:17px"></div><div style="font-size:13px;color:#8696a0;margin-top:2px"></div>'
    t.firstChild.textContent = title
    t.lastChild.textContent = sub || ''
    d.append(a, t)
    d.onclick = fn
    list.appendChild(d)
    return a
  }
  const draw = () => {
    const q = ov.querySelector('#ncq').value.trim().toLowerCase()
    list.innerHTML = ''
    if (!q) {
      row('👥', 'Nuevo grupo', '', () => { ov.remove(); newGroup() }, true)
      row('➕', 'Nuevo contacto', 'Por número de teléfono', () => { ov.remove(); newChatByNumber() }, true)
    }
    const people = Object.entries(allChats).filter(([id]) => !id.endsWith('@g.us') && !id.endsWith('@broadcast'))
      .map(([id, c]) => ({ id, name: c.name || id.split('@')[0] }))
      .filter(p => !q || p.name.toLowerCase().includes(q) || p.id.includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
    ov.querySelector('#ncCount').textContent = people.length + ' contactos'
    people.forEach(p => {
      const a = row((p.name[0] || '?').toUpperCase(), p.name, '', () => { location.href = '/chat.html?id=' + encodeURIComponent(p.id) }, false)
      const c = PFP[p.id]
      if (c && c.url) { const im = new Image(); im.onload = () => { a.textContent = ''; a.style.backgroundImage = 'url("' + c.url + '")' }; im.src = c.url }
    })
    if (q && /^[+\d][\d\s-]{6,}$/.test(q)) row('💬', 'Chatear con ' + q, 'Número nuevo', () => { ov.remove(); newChatByNumberWith(q) }, true)
  }
  ov.querySelector('#ncq').oninput = draw
  draw()
}
async function newChatByNumberWith(q) {
  const n = q.replace(/\D/g, '')
  const r = await (await fetch('/api/check/' + n)).json()
  if (!r.exists) { alert(r.error ? 'No se pudo verificar el número' : 'Ese número no tiene WhatsApp'); return }
  location.href = '/chat.html?id=' + encodeURIComponent(r.jid)
}
