const params  = new URLSearchParams(location.search)
const chatId  = params.get('id')
if (!chatId) location.href = '/'

const messagesEl = document.getElementById('messages')
let replyTo      = null
let lastDate     = null
let isAtBottom   = true
let lightboxMsg  = null
let pendingImage = null

SocketManager.joinChat(chatId)

messagesEl.addEventListener('scroll', () => {
  const atBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 80
  isAtBottom = atBottom
  if (atBottom) document.getElementById('newMsgIndicator').classList.remove('visible')
})

function scrollToBottom(smooth = true) {
  messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: smooth ? 'smooth' : 'instant' })
  document.getElementById('newMsgIndicator').classList.remove('visible')
}

function maybeAddDateDivider(ts) {
  const label = UI.getDateLabel(ts)
  if (label === lastDate) return
  lastDate = label
  const div = document.createElement('div')
  div.className = 'date-divider'
  div.innerHTML = `<div class="date-label">${label}</div>`
  messagesEl.insertBefore(div, document.getElementById('newMsgIndicator'))
}

function renderMessage(msg, animate = false) {
  maybeAddDateDivider(msg.timestamp)
  const isSent = msg.fromMe === true
  const wrap   = document.createElement('div')
  wrap.className = `msg-wrap ${isSent ? 'sent' : 'received'}`

  if (msg.waMessageKey?.id) wrap.dataset.msgId = msg.waMessageKey.id

  if (animate) {
    wrap.style.opacity    = '0'
    wrap.style.transform  = 'translateY(8px)'
    wrap.style.transition = 'opacity 0.25s, transform 0.25s'
  }

  if (!isSent && msg.senderName) {
    const sl = document.createElement('div')
    sl.className = 'msg-sender-label'
    sl.textContent = msg.senderName
    wrap.appendChild(sl)
  }

  const bubble = document.createElement('div')
  bubble.className = `bubble ${isSent ? 'sent' : 'received'}`

  if (msg.replyTo) {
    const rq = document.createElement('div')
    rq.className = 'reply-quote'
    rq.innerHTML = `<b>${msg.replyTo.senderName || 'Tú'}:</b> ${msg.replyTo.content || '[Multimedia]'}`
    bubble.appendChild(rq)
  }

  bubble.appendChild(UI.buildMediaElement(msg, openLightbox))

  const timeEl = document.createElement('div')
  timeEl.className = 'msg-time'
  timeEl.textContent = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  // Si ya estaba borrado al cargar el historial
  if (msg.revoked) {
    const icon = document.createElement('span')
    icon.className = 'revoked-icon'
    icon.textContent = ' 🚫'
    icon.style.cssText = 'font-size:12px;margin-left:4px'
    timeEl.appendChild(icon)
  }

  bubble.appendChild(timeEl)
  wrap.appendChild(bubble)

  let pressTimer
  wrap.addEventListener('touchstart', () => { pressTimer = setTimeout(() => setReply(msg), 500) })
  wrap.addEventListener('touchend',   () => clearTimeout(pressTimer))
  wrap.addEventListener('mousedown',  () => { pressTimer = setTimeout(() => setReply(msg), 600) })
  wrap.addEventListener('mouseup',    () => clearTimeout(pressTimer))

  messagesEl.insertBefore(wrap, document.getElementById('newMsgIndicator'))

  if (animate) requestAnimationFrame(() => { wrap.style.opacity = '1'; wrap.style.transform = 'translateY(0)' })
}

// ── ANTI-REVOKE en tiempo real ──
socket.on('message_revoked', ({ chatId: rChatId, deletedId }) => {
  if (rChatId !== chatId) return
  const wrap = document.querySelector(`[data-msg-id="${deletedId}"]`)
  if (!wrap) return
  const timeEl = wrap.querySelector('.msg-time')
  if (timeEl && !timeEl.querySelector('.revoked-icon')) {
    const icon = document.createElement('span')
    icon.className = 'revoked-icon'
    icon.textContent = ' 🚫'
    icon.style.cssText = 'font-size:12px;margin-left:4px'
    timeEl.appendChild(icon)
  }
})

function openLightbox(msg) {
  lightboxMsg = msg
  document.getElementById('lightbox-img').src = msg.mediaUrl
  document.getElementById('lightbox-sender').textContent = msg.fromMe ? 'Tú' : (msg.senderName || 'Usuario')
  document.getElementById('lightbox-time').textContent   = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  document.getElementById('lightbox').classList.add('open')
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open')
  document.getElementById('lightbox-img').src = ''
  lightboxMsg = null
}

function downloadMedia() {
  if (!lightboxMsg?.mediaUrl) return
  const a = document.createElement('a')
  a.href = lightboxMsg.mediaUrl
  a.download = `foto_${Date.now()}.jpg`
  a.click()
}

function replyFromLightbox() {
  if (!lightboxMsg) return
  setReply(lightboxMsg)
  closeLightbox()
  document.getElementById('msgInput').focus()
}

function setReply(msg) {
  replyTo = msg
  document.getElementById('replyPreview').classList.add('visible')
  document.getElementById('replyPreview-name').textContent    = msg.fromMe ? 'Tú' : (msg.senderName || 'Usuario')
  document.getElementById('replyPreview-content').textContent = msg.content || (msg.type === 'image' ? '📷 Foto' : msg.type === 'audio' ? '🎵 Audio' : '[Multimedia]')
  document.getElementById('msgInput').focus()
}

function cancelReply() {
  replyTo = null
  document.getElementById('replyPreview').classList.remove('visible')
}

document.getElementById('imgInput').addEventListener('change', (e) => {
  const file = e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => {
    pendingImage = { dataUrl: ev.target.result, name: file.name, type: file.type }
    document.getElementById('imgPreviewThumb').src = ev.target.result
    document.getElementById('imgPreviewName').textContent = file.name
    document.getElementById('imgPreviewBar').classList.add('visible')
  }
  reader.readAsDataURL(file)
  e.target.value = ''
})

function cancelImage() {
  pendingImage = null
  document.getElementById('imgPreviewBar').classList.remove('visible')
  document.getElementById('imgPreviewThumb').src = ''
}

function sendMessage() {
  const content = document.getElementById('msgInput').value.trim()
  if (!content && !pendingImage) return

  const payload = {
    chatId, content: content || '', senderName: 'Panel',
    replyTo: replyTo ? {
      senderName: replyTo.fromMe ? 'Tú' : (replyTo.senderName || 'Usuario'),
      content:    replyTo.content || '[Multimedia]'
    } : null
  }

  if (pendingImage) {
    payload.type     = pendingImage.type.startsWith('video') ? 'video' : 'image'
    payload.mediaUrl = pendingImage.dataUrl
    payload.fileName = pendingImage.name
    cancelImage()
  }

  SocketManager.sendMessage(payload)
  document.getElementById('msgInput').value = ''
  document.getElementById('msgInput').style.height = 'auto'
  cancelReply()
}

SocketManager.onReceiveMessage((msg) => {
  renderMessage(msg, true)
  if (isAtBottom) scrollToBottom()
  else document.getElementById('newMsgIndicator').classList.add('visible')
})

document.getElementById('lightbox-body').addEventListener('click', (e) => {
  if (e.target === document.getElementById('lightbox-body')) closeLightbox()
})

const input = document.getElementById('msgInput')
input.addEventListener('input', () => {
  input.style.height = 'auto'
  input.style.height = Math.min(input.scrollHeight, 120) + 'px'
})
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
})

async function loadChat() {
  const data = await API.getChat(chatId)
  const name = data.name || chatId
  document.getElementById('chatName').textContent   = name
  document.getElementById('avatar').textContent     = name.charAt(0).toUpperCase()
  document.getElementById('chatStatus').textContent = chatId.endsWith('@g.us') ? 'Grupo de WhatsApp' : 'WhatsApp'
  document.title = name
  messagesEl.querySelectorAll('.msg-wrap, .date-divider').forEach(el => el.remove())
  lastDate = null
  const messages = data.messages || []
  messages.forEach(msg => renderMessage(msg, false))
  scrollToBottom(false)
}
loadChat()
