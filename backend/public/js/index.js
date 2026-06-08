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
        ? `Tú: ${last.content || '📎'}`
        : (isGroup ? `${last.senderName?.split(' ')[0] || ''}: ` : '') + (last.content || '📎 Multimedia'))
    : 'Sin mensajes'

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

  // Info
  const info = document.createElement('div')
  info.className = 'chat-info'
  info.innerHTML = `
    <div class="chat-row1">
      <div class="chat-name">${name}${state.favorite ? ' ⭐' : ''}</div>
      <div class="chat-time ${unread > 0 ? 'gold' : ''}">${time}</div>
    </div>
    <div class="chat-row2">
      <div class="chat-preview">${lastText}</div>
      ${unread > 0 ? `<div class="badge">${unread > 99 ? '99+' : unread}</div>` : ''}
    </div>
  `
  div.appendChild(info)

  div.onclick = () => {
    getState(chatId).unread = 0
    persistState()
    location.href = '/chat.html?id=' + encodeURIComponent(chatId)
  }

  let pressTimer
  div.addEventListener('touchstart',  () => { pressTimer = setTimeout(() => openCtxMenu(chatId, div), 500) })
  div.addEventListener('touchend',    () => clearTimeout(pressTimer))
  div.addEventListener('contextmenu', (e) => { e.preventDefault(); openCtxMenu(chatId, div) })

  return div
}

// ========================
// 🎨 RENDER LISTA
// ========================
function renderChats() {
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

  // Búsqueda
  if (searchQuery) entries = entries.filter(([id, data]) =>
    (data.name || id).toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Ordenar: favoritos primero, luego por timestamp
  entries.sort((a, b) => {
    const favA = getState(a[0]).favorite ? 1 : 0
    const favB = getState(b[0]).favorite ? 1 : 0
    if (favB !== favA) return favB - favA
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
  if (action === 'read')   { state.unread = 0 }
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
