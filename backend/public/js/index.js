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

async function checkBotStatus() {
  try {
    const data = await API.getStatus()
    const dot  = document.getElementById('statusDot')
    const text = document.getElementById('statusText')
    const online = data.bot === 'conectado'
    dot.className  = online ? 'online' : 'offline'
    text.className = online ? 'online' : 'offline'
    text.textContent = online ? `Bot activo · ${data.chats} chats` : 'Bot desconectado'
  } catch {
    document.getElementById('statusText').textContent = 'Sin conexión'
  }
}

function setFilter(filter) {
  currentFilter = filter
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'))
  document.getElementById(`chip-${filter}`).classList.add('active')
  renderChats()
}

function updateStats() {
  const ids = Object.keys(allChats)
  document.getElementById('count-all').textContent       = ids.filter(id => !getState(id).archived).length
  document.getElementById('count-unread').textContent    = ids.filter(id => (getState(id).unread || 0) > 0).length
  document.getElementById('count-favorites').textContent = ids.filter(id => getState(id).favorite).length
  document.getElementById('count-groups').textContent    = ids.filter(id => id.endsWith('@g.us')).length
  document.getElementById('count-archived').textContent  = ids.filter(id => getState(id).archived).length
}

function buildItem(chatId, data) {
  const div     = document.createElement('div')
  const state   = getState(chatId)
  const unread  = state.unread || 0
  const isGroup = chatId.endsWith('@g.us')
  const last    = data.messages?.at(-1)
  const name    = data.name || chatId

  div.className = `chat-item${unread > 0 ? ' has-unread' : ''}${state.archived ? ' archived' : ''}`
  div.dataset.chatId = chatId

  const time = last ? UI.formatTime(last.timestamp) : ''
  const lastText = last
    ? (last.fromMe ? `Tú: ${last.content || '📎'}` : (isGroup ? `${last.senderName?.split(' ')[0] || ''}: ` : '') + (last.content || '📎 Multimedia'))
    : 'Sin mensajes'

  div.innerHTML = `
    <div class="avatar ${isGroup ? 'group' : ''} ${state.favorite ? 'fav' : ''}" style="width:52px;height:52px;font-size:20px">
      ${isGroup ? '👥' : name.charAt(0).toUpperCase()}
    </div>
    <div class="chat-info">
      <div class="chat-row1">
        <div class="chat-name">${name}${state.favorite ? ' <span style="font-size:12px">⭐</span>' : ''}${state.archived ? ' <span style="font-size:11px;color:var(--text-dim)">📦</span>' : ''}</div>
        <div class="chat-time ${unread > 0 ? 'gold' : ''}">${time}</div>
      </div>
      <div class="chat-row2">
        <div class="chat-preview">${lastText}</div>
        ${unread > 0 ? `<div class="badge">${unread > 99 ? '99+' : unread}</div>` : ''}
      </div>
    </div>
  `

  div.onclick = () => {
    getState(chatId).unread = 0
    persistState()
    updateStats()
    location.href = '/chat.html?id=' + encodeURIComponent(chatId)
  }

  let pressTimer
  div.addEventListener('touchstart',   () => { pressTimer = setTimeout(() => openCtxMenu(chatId, div), 500) })
  div.addEventListener('touchend',     () => clearTimeout(pressTimer))
  div.addEventListener('contextmenu',  (e) => { e.preventDefault(); openCtxMenu(chatId, div) })

  return div
}

function renderChats() {
  const container  = document.getElementById('chatList')
  const emptyState = document.getElementById('emptyState')
  container.innerHTML = ''
  container.appendChild(emptyState)

  let entries = Object.entries(allChats)

  if (currentFilter === 'unread')    entries = entries.filter(([id]) => (getState(id).unread || 0) > 0)
  if (currentFilter === 'favorites') entries = entries.filter(([id]) => getState(id).favorite)
  if (currentFilter === 'groups')    entries = entries.filter(([id]) => id.endsWith('@g.us'))
  if (currentFilter === 'archived')  entries = entries.filter(([id]) => getState(id).archived)
  if (currentFilter === 'all')       entries = entries.filter(([id]) => !getState(id).archived)

  if (searchQuery) entries = entries.filter(([id, data]) => (data.name || id).toLowerCase().includes(searchQuery.toLowerCase()))

  entries.sort((a, b) => {
    const favA = getState(a[0]).favorite ? 1 : 0
    const favB = getState(b[0]).favorite ? 1 : 0
    if (favB !== favA) return favB - favA
    return (b[1].messages?.at(-1)?.timestamp || 0) - (a[1].messages?.at(-1)?.timestamp || 0)
  })

  if (entries.length === 0) { emptyState.style.display = 'flex'; return }
  emptyState.style.display = 'none'

  const favs    = entries.filter(([id]) => getState(id).favorite)
  const nonFavs = entries.filter(([id]) => !getState(id).favorite)

  if (favs.length > 0 && currentFilter !== 'favorites') {
    const l = document.createElement('div'); l.className = 'section-label'; l.textContent = '⭐ Favoritos'
    container.appendChild(l)
    favs.forEach(([id, data]) => container.appendChild(buildItem(id, data)))
    if (nonFavs.length > 0) {
      const l2 = document.createElement('div'); l2.className = 'section-label'; l2.textContent = 'Todos los chats'
      container.appendChild(l2)
    }
  }

  const toRender = favs.length > 0 && currentFilter !== 'favorites' ? nonFavs : entries
  toRender.forEach(([id, data]) => container.appendChild(buildItem(id, data)))
  updateStats()
}

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
  if (action === 'fav')     { state.favorite = !state.favorite }
  if (action === 'archive') { state.archived = !state.archived; state.favorite = false }
  if (action === 'read')    { state.unread = 0 }
  if (action === 'delete')  { if (confirm('¿Eliminar este chat del panel?')) { delete allChats[ctxChatId]; delete chatState[ctxChatId] } }
  persistState()
  closeCtxMenu()
  renderChats()
}

async function loadChats() {
  allChats = await API.getChats()
  renderChats()
  updateStats()
}

// Tiempo real
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

document.getElementById('searchInput').addEventListener('input', (e) => {
  searchQuery = e.target.value
  renderChats()
})

loadState()
loadChats()
checkBotStatus()
setInterval(checkBotStatus, 15000)
