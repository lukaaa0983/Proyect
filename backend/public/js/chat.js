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

// ── Colores por sender ──
const senderColors = {}
const colorPalette = ['#c9a84c','#53bdeb','#25d366','#e17055','#a29bfe','#fd79a8','#fdcb6e','#00cec9']
let colorIndex = 0

function getSenderColor(senderId) {
  if (!senderColors[senderId]) {
    senderColors[senderId] = colorPalette[colorIndex % colorPalette.length]
    colorIndex++
  }
  return senderColors[senderId]
}

// ── Fix número: solo mostrar si es número real ──
function formatNumber(senderId) {
  if (!senderId) return ''
  // Limpiar sufijos
  const clean = senderId
    .replace('@s.whatsapp.net', '')
    .replace('@lid', '')
    .replace('@g.us', '')
    .trim()
  // Solo mostrar si son puro números (no LID que tiene letras/guiones)
  if (/^\d{7,15}$/.test(clean)) return '+' + clean
  return ''
}

function renderMessage(msg, animate = false) {
  maybeAddDateDivider(msg.timestamp)
  const isSent = msg.fromMe === true
  const wrap   = document.createElement('div')
  wrap.className = `msg-wrap ${isSent ? 'sent' : 'received'}`

  if (msg.waMessageKey?.id) wrap.dataset.msgId = msg.waMessageKey.id

  if (animate) {
    wrap.style.opacity    = '0'
    wrap.style.transform  = `translateY(8px) translateX(${isSent ? '8px' : '-8px'})`
    wrap.style.transition = 'opacity 0.25s, transform 0.25s'
  }

  // ── Avatar — solo para recibidos ──
  if (!isSent) {
    const avatarEl = document.createElement('div')
    avatarEl.className = 'msg-avatar'
    const name = msg.senderName || '?'
    avatarEl.textContent = name.charAt(0).toUpperCase()
    avatarEl.style.borderColor = getSenderColor(msg.senderId || msg.senderName)
    wrap.appendChild(avatarEl)
  }

  // ── Columna ──
  const col = document.createElement('div')
  col.className = 'msg-col'

  // ── Meta: nombre + número — solo recibidos con nombre ──
  if (!isSent && msg.senderName) {
    const meta = document.createElement('div')
    meta.className = 'msg-meta'

    const nameEl = document.createElement('span')
    nameEl.className = 'msg-meta-name'
    nameEl.textContent = msg.senderName
    nameEl.style.color = getSenderColor(msg.senderId || msg.senderName)
    meta.appendChild(nameEl)

    const num = formatNumber(msg.senderId)
    if (num) {
      const numEl = document.createElement('span')
      numEl.className = 'msg-meta-number'
      numEl.textContent = num
      meta.appendChild(numEl)
    }

    col.appendChild(meta)
  }

  // ── Burbuja ──
  const bubble = document.createElement('div')
  bubble.className = `bubble ${isSent ? 'sent' : 'received'}`

  if (msg.replyTo) {
    const rq = document.createElement('div')
    rq.className = 'reply-quote'
    rq.innerHTML = `
      <div class="reply-quote-name">${msg.replyTo.senderName || 'Tú'}</div>
      <div class="reply-quote-text">${msg.replyTo.content || '[Multimedia]'}</div>
    `
    bubble.appendChild(rq)
  }

  bubble.appendChild(UI.buildMediaElement(msg, openLightbox))

  const timeEl = document.createElement('div')
  timeEl.className = 'msg-time'
  timeEl.textContent = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  if (msg.revoked) {
    const icon = document.createElement('span')
    icon.className = 'revoked-icon'
    icon.textContent = ' 🚫'
    icon.style.cssText = 'font-size:12px;margin-left:4px'
    timeEl.appendChild(icon)
  }

  bubble.appendChild(timeEl)
  col.appendChild(bubble)

  // ── SWIPE para responder ──
  addSwipeToReply(wrap, col, msg)

  wrap.appendChild(col)

  messagesEl.insertBefore(wrap, document.getElementById('newMsgIndicator'))

  if (animate) requestAnimationFrame(() => {
    wrap.style.opacity   = '1'
    wrap.style.transform = 'translateY(0) translateX(0)'
  })
}

// ========================
// 👆 SWIPE PARA RESPONDER
// ========================
function addSwipeToReply(wrap, col, msg) {
  const isSent   = msg.fromMe === true
  let startX     = 0
  let startY     = 0
  let isDragging = false
  let triggered  = false
  const THRESHOLD = 60

  // Ícono de reply que aparece al deslizar
  const replyIcon = document.createElement('div')
  replyIcon.style.cssText = `
    position: absolute;
    ${isSent ? 'left: -40px' : 'right: -40px'};
    top: 50%;
    transform: translateY(-50%) scale(0);
    width: 32px; height: 32px;
    border-radius: 50%;
    background: var(--gold);
    display: flex; align-items: center; justify-content: center;
    font-size: 14px;
    transition: transform 0.15s;
    pointer-events: none;
    z-index: 5;
  `
  replyIcon.textContent = '↩'
  wrap.style.position = 'relative'
  wrap.appendChild(replyIcon)

  wrap.addEventListener('touchstart', (e) => {
    startX     = e.touches[0].clientX
    startY     = e.touches[0].clientY
    isDragging = false
    triggered  = false
    col.style.transition = 'none'
  }, { passive: true })

  wrap.addEventListener('touchmove', (e) => {
    const dx = e.touches[0].clientX - startX
    const dy = e.touches[0].clientY - startY

    // Solo horizontal
    if (!isDragging && Math.abs(dy) > Math.abs(dx)) return
    isDragging = true

    // Dirección según sent/received
    const valid = isSent ? dx < 0 : dx > 0
    if (!valid) return

    const dist = Math.min(Math.abs(dx), THRESHOLD)
    const move = isSent ? -dist : dist

    col.style.transform = `translateX(${move}px)`

    // Mostrar ícono
    const pct = dist / THRESHOLD
    replyIcon.style.transform = `translateY(-50%) scale(${pct})`

    if (dist >= THRESHOLD && !triggered) {
      triggered = true
      replyIcon.style.background = 'var(--green)'
      // Vibración haptica
      if (navigator.vibrate) navigator.vibrate(30)
    }
  }, { passive: true })

  wrap.addEventListener('touchend', () => {
    col.style.transition = 'transform 0.25s'
    col.style.transform  = 'translateX(0)'
    replyIcon.style.transform = 'translateY(-50%) scale(0)'
    replyIcon.style.background = 'var(--gold)'

    if (triggered) setReply(msg)
    isDragging = false
    triggered  = false
  })
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
    chatId,
    content: content || '',
    senderName: 'Panel',
    replyTo: replyTo ? {
      senderName:   replyTo.fromMe ? 'Tú' : (replyTo.senderName || 'Usuario'),
      content:      replyTo.content || '[Multimedia]',
      waMessageKey: replyTo.waMessageKey || null
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
  if (msg.isViewOnce && msg.mediaUrl && msg.waMessageKey?.id) {
    const existing = document.querySelector(`[data-viewonce-id="${msg.waMessageKey.id}"]`)
    if (existing) {
      const label = msg.type === 'video' ? 'Video' : msg.type === 'audio' ? 'Audio' : 'Foto'
      existing.innerHTML = `
        <div class="viewonce-icon" style="border-color:var(--gold)">🕐</div>
        <div class="viewonce-info">
          <div class="viewonce-label">${label}</div>
          <div class="viewonce-sub" style="color:var(--gold)">Toca para ver</div>
        </div>
      `
      existing.onclick = () => openLightbox(msg)
      return
    }
  }

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
