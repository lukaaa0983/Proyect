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
  if (msg.type === 'system') {
    const d = document.createElement('div')
    d.className = 'sys-msg'
    d.textContent = msg.content
    messagesEl.insertBefore(d, document.getElementById('newMsgIndicator'))
    return
  }
  const isSent = msg.fromMe === true
  const wrap   = document.createElement('div')
  wrap.className = `msg-wrap ${isSent ? 'sent' : 'received'}`

  if (msg.waMessageKey?.id) wrap.dataset.msgId = msg.waMessageKey.id
  wrap.dataset.ts = msg.timestamp

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
    rq.style.cursor = 'pointer'
    rq.onclick = () => {
      const id = msg.replyTo.waMessageKey && msg.replyTo.waMessageKey.id
      const t = id && document.querySelector('[data-msg-id="' + id + '"]')
      if (t) { t.scrollIntoView({ behavior: 'smooth', block: 'center' }); t.style.transition = 'background .3s'; t.style.background = 'rgba(201,168,76,.25)'; setTimeout(() => { t.style.background = '' }, 1200) }
    }
    rq.innerHTML = `
      <div class="reply-quote-name">${msg.replyTo.senderName || 'Tú'}</div>
      <div class="reply-quote-text">${msg.replyTo.content || '[Multimedia]'}</div>
    `
    bubble.appendChild(rq)
  }

  { const be = UI.buildMediaElement(msg, openLightbox); be.classList.add('msg-body'); linkify(be); bubble.appendChild(be) }

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

  if (isStarred(msg)) timeEl.insertBefore(document.createTextNode('⭐ '), timeEl.firstChild)
  bubble.appendChild(timeEl)
  if (isSent) { const tk = document.createElement('span'); tk.className = 'ticks'; timeEl.appendChild(tk); setTicks(bubble, msg) }
  renderReactions(bubble, msg)
  renderEdited(bubble, msg)
  addLongPress(bubble, msg)
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
  const lbImg  = document.getElementById('lightbox-img')
  const lbBody = document.getElementById('lightbox-body')
  const oldVid = document.getElementById('lightbox-video')
  if (oldVid) { oldVid.pause(); oldVid.remove() }
  if (msg.type === 'video') {
    lbImg.style.display = 'none'
    lbImg.removeAttribute('src')
    const v = document.createElement('video')
    v.id = 'lightbox-video'
    v.src = msg.mediaUrl
    v.controls = true
    v.autoplay = true
    v.playsInline = true
    v.style.cssText = 'max-width:100%;max-height:100%;border-radius:12px;background:#000'
    lbBody.appendChild(v)
  } else {
    lbImg.style.display = ''
    lbImg.src = msg.mediaUrl
  }
  document.getElementById('lightbox-sender').textContent = msg.fromMe ? 'Tú' : (msg.senderName || 'Usuario')
  document.getElementById('lightbox-time').textContent   = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  document.getElementById('lightbox').classList.add('open')
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open')
  const lbVid = document.getElementById('lightbox-video')
  if (lbVid) { lbVid.pause(); lbVid.remove() }
  document.getElementById('lightbox-img').style.display = ''
  document.getElementById('lightbox-img').src = ''
  lightboxMsg = null
}

function downloadMedia() {
  if (!lightboxMsg?.mediaUrl) return
  const a = document.createElement('a')
  a.href = lightboxMsg.mediaUrl
  a.download = lightboxMsg.type === 'video' ? `video_${Date.now()}.mp4` : `foto_${Date.now()}.jpg`
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
    document.getElementById('imgPreviewThumb').src = file.type.startsWith('image') ? ev.target.result : 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='
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
    payload.type     = pendingImage.type.startsWith('video') ? 'video' : pendingImage.type.startsWith('audio') ? 'audio' : pendingImage.type.startsWith('image') ? 'image' : 'document'
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

// ===== Acciones de mensaje estilo WhatsApp =====
;(function () {
  const st = document.createElement('style')
  st.textContent = '.bubble{position:relative}.bubble.has-react{margin-bottom:14px}.reacts{position:absolute;bottom:-13px;right:8px;background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:1px 6px;font-size:13px}#mact{display:none;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:900;align-items:flex-end}#mact.open{display:flex}#mbox{background:var(--surface);width:100%;border-radius:20px 20px 0 0;padding:10px 0 calc(14px + env(safe-area-inset-bottom))}#mrx{display:flex;justify-content:space-around;padding:6px 10px 12px;border-bottom:1px solid var(--border)}#mrx span{font-size:28px;padding:4px 6px;border-radius:50%;cursor:pointer}#mrx span.on{background:var(--surface3)}.mi{padding:15px 22px;cursor:pointer}.mi:active{background:var(--surface2)}.mi.red{color:#ff5c5c}.bubble.hl{outline:2px solid var(--gold-dim)}#csearch{display:none;padding:8px 12px;background:var(--surface);border-bottom:1px solid var(--border);gap:8px;align-items:center}#csearch input{flex:1;padding:9px 14px;border-radius:18px;border:1px solid var(--border);background:var(--surface2);color:var(--text);outline:none}'
  document.head.appendChild(st)

  const ov = document.createElement('div')
  ov.id = 'mact'
  ov.innerHTML = '<div id="mbox"><div id="mrx"></div><div id="mlist"></div></div>'
  ov.onclick = e => { if (e.target === ov) ov.classList.remove('open') }
  document.body.appendChild(ov)

  const EMO = ['👍', '❤️', '😂', '😮', '😢', '🙏']
  const stars = () => { try { return JSON.parse(localStorage.getItem('star:' + chatId) || '[]') } catch { return [] } }
  window.isStarred = m => !!m.waMessageKey && stars().includes(m.waMessageKey.id)

  window.renderReactions = (bubble, m) => {
    const old = bubble.querySelector('.reacts')
    if (old) old.remove()
    const list = m.reactions ? Object.values(m.reactions).filter(Boolean) : []
    bubble.classList.toggle('has-react', list.length > 0)
    if (!list.length) return
    const d = document.createElement('div')
    d.className = 'reacts'
    d.textContent = list.join(' ')
    bubble.appendChild(d)
  }

  window.openMsgMenu = m => {
    const key = m.waMessageKey
    const close = () => ov.classList.remove('open')
    const rx = document.getElementById('mrx')
    rx.innerHTML = ''
    rx.style.display = key ? 'flex' : 'none'
    if (key) EMO.forEach(e => {
      const s = document.createElement('span')
      s.textContent = e
      if (m.reactions && m.reactions.me === e) s.className = 'on'
      s.onclick = () => { close(); socket.emit('react', { chatId, key, emoji: m.reactions && m.reactions.me === e ? '' : e }) }
      rx.appendChild(s)
    })
    const items = [['↩ Responder', () => setReply(m)], ['↪ Reenviar', () => forwardMsg(m)]]
    if (key) items.push([pinnedId() === key.id ? '📌 Desfijar' : '📌 Fijar', () => togglePin(m)])
    if (key && m.fromMe && m.type === 'text' && m.content && !m.revoked) items.push(['✏ Editar', () => editMsg(m)])
    if (key) items.push(['☑ Seleccionar', () => startSelect(m)])
    if (chatId.endsWith('@g.us') && !m.fromMe) items.push(['💬 Responder en privado', () => memberDM(m)])
    items.push(['ℹ Info', () => msgInfo(m)])
    if (m.content) items.push(['📋 Copiar', () => navigator.clipboard && navigator.clipboard.writeText(m.content)])
    if (key) items.push([isStarred(m) ? '☆ Quitar destacado' : '⭐ Destacar', () => {
      const s = stars(), i = s.indexOf(key.id)
      if (i >= 0) s.splice(i, 1); else s.push(key.id)
      localStorage.setItem('star:' + chatId, JSON.stringify(s))
      const t = document.querySelector('[data-msg-id="' + key.id + '"] .msg-time')
      if (t) {
        if (i >= 0) { if (t.firstChild && t.firstChild.nodeValue === '⭐ ') t.firstChild.remove() }
        else t.insertBefore(document.createTextNode('⭐ '), t.firstChild)
      }
    }])
    if (key) items.push(['🗑 Borrar para mí', () => { if (confirm('¿Borrar este mensaje del panel?')) socket.emit('delete_message', { chatId, key, everyone: false }) }, true])
    if (key && m.fromMe && !m.revoked) items.push(['🗑 Borrar para todos', () => { if (confirm('¿Borrar este mensaje para todos?')) socket.emit('delete_message', { chatId, key, everyone: true }) }, true])
    const list = document.getElementById('mlist')
    list.innerHTML = ''
    items.forEach(([label, fn, red]) => {
      const d = document.createElement('div')
      d.className = 'mi' + (red ? ' red' : '')
      d.textContent = label
      d.onclick = () => { close(); fn() }
      list.appendChild(d)
    })
    ov.classList.add('open')
  }

  window.addLongPress = (bubble, m) => {
    let t, x = 0, y = 0
    bubble._m = m
    bubble.addEventListener('touchstart', e => {
      x = e.touches[0].clientX; y = e.touches[0].clientY
      t = setTimeout(() => { bubble._lp = true; if (navigator.vibrate) navigator.vibrate(15); openMsgMenu(m) }, 450)
    }, { passive: true })
    bubble.addEventListener('touchmove', e => {
      if (Math.abs(e.touches[0].clientX - x) > 10 || Math.abs(e.touches[0].clientY - y) > 10) clearTimeout(t)
    }, { passive: true })
    ;['touchend', 'touchcancel'].forEach(ev => bubble.addEventListener(ev, () => clearTimeout(t), { passive: true }))
    bubble.addEventListener('contextmenu', e => { e.preventDefault(); openMsgMenu(m) })
    bubble.addEventListener('click', e => { if (bubble._lp) { e.stopPropagation(); e.preventDefault(); bubble._lp = false } }, true)
  }

  socket.on('message_updated', ({ chatId: c, msg }) => {
    if (c !== chatId || !msg.waMessageKey) return
    let w = document.querySelector('[data-msg-id="' + msg.waMessageKey.id + '"]')
    if (!w) { w = document.querySelector('[data-ts="' + msg.timestamp + '"]'); if (w) w.dataset.msgId = msg.waMessageKey.id }
    const b = w && w.querySelector('.bubble')
    const hadMedia = !!(b && b._m && b._m.mediaUrl)
    if (b) { if (b._m) Object.assign(b._m, msg); renderReactions(b, msg); setTicks(b, msg) }
    const mediaJustArrived = !hadMedia && !!msg.mediaUrl
    if (b && (msg.edited || mediaJustArrived)) {
      const old = b.querySelector('.msg-body')
      if (old) { const nb = UI.buildMediaElement(msg, openLightbox); nb.classList.add('msg-body'); linkify(nb); old.replaceWith(nb) }
      if (msg.edited) renderEdited(b, msg)
    }
  })
  socket.on('message_removed', ({ chatId: c, deletedId }) => {
    if (c !== chatId) return
    const w = document.querySelector('[data-msg-id="' + deletedId + '"]')
    if (w) w.remove()
  })

  // ----- Buscar dentro del chat -----
  const hdr = document.getElementById('header-info') && document.getElementById('header-info').parentElement
  if (hdr) {
    const bar = document.createElement('div')
    bar.id = 'csearch'
    bar.innerHTML = '<input placeholder="Buscar en el chat"><span id="scount" style="font-size:12px;color:var(--text-dim)"></span><span id="sclose" style="cursor:pointer;padding:6px">✕</span>'
    hdr.after(bar)
    const inp = bar.querySelector('input')
    const run = () => {
      const q = inp.value.trim().toLowerCase()
      let n = 0
      document.querySelectorAll('.msg-wrap').forEach(w => {
        const b = w.querySelector('.bubble')
        const hit = !q || (b ? b.textContent : '').toLowerCase().includes(q)
        w.style.display = hit ? '' : 'none'
        if (b) b.classList.toggle('hl', !!q && hit)
        if (q && hit) n++
      })
      document.getElementById('scount').textContent = q ? n + ' resultados' : ''
    }
    inp.oninput = run
    const btn = document.createElement('div')
    btn.textContent = '🔍'
    btn.style.cssText = 'font-size:20px;padding:8px;cursor:pointer;margin-left:auto'
    btn.onclick = () => { bar.style.display = 'flex'; inp.focus() }
    window.openChatSearch = btn.onclick
    document.getElementById('sclose').onclick = () => { inp.value = ''; run(); bar.style.display = 'none' }
  }
})()

async function loadChat() {
  const data = await API.getChat(chatId)
  const isGroup = chatId.endsWith('@g.us')
  let phone = ''

  if (!isGroup) {
    if (chatId.endsWith('@s.whatsapp.net')) {
      phone = chatId.split('@')[0].split(':')[0].replace(/\D/g, '')
    } else if (chatId.endsWith('@lid')) {
      try {
        const r = await (await fetch('/api/pn/' + encodeURIComponent(chatId))).json()
        phone = String(r.pn || '').replace(/\D/g, '')
      } catch {}
    }
  }

  const rawName = String(data.name || '').trim()
  const nameIsNumber = rawName && /^[+\d\s().-]+$/.test(rawName)
  const name = isGroup
    ? (rawName || 'Grupo')
    : (rawName && rawName !== chatId && !nameIsNumber
      ? rawName
      : (phone ? '+' + phone : (rawName || 'Contacto')))

  document.getElementById('chatName').textContent = name
  document.getElementById('avatar').textContent = name.charAt(0).toUpperCase()
  document.getElementById('chatStatus').textContent =
    isGroup ? 'Grupo de WhatsApp' : ''
  document.title = name

  if (!isGroup) {
    fetch('/api/pfp/' + encodeURIComponent(chatId))
      .then(r => r.json())
      .then(r => {
        if (r.url) {
          const avatar = document.getElementById('avatar')
          avatar.innerHTML = '<img src="' + r.url + '" alt="">'
        }
      }).catch(() => {})
  }

  messagesEl.querySelectorAll('.msg-wrap, .date-divider').forEach(el => el.remove())
  lastDate = null
  const messages = data.messages || []
  messages.forEach(msg => renderMessage(msg, false))
  scrollToBottom(false)
}

loadChat()

async function forwardMsg(m) {
  const chats = await (await fetch('/chats')).json()
  const ov = document.createElement('div')
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:950;display:flex;align-items:flex-end'
  ov.onclick = e => { if (e.target === ov) ov.remove() }
  const box = document.createElement('div')
  box.style.cssText = 'background:var(--surface);width:100%;max-height:75dvh;overflow:auto;border-radius:20px 20px 0 0;padding:14px 0 calc(14px + env(safe-area-inset-bottom))'
  const h = document.createElement('div')
  h.textContent = 'Reenviar a...'
  h.style.cssText = 'padding:4px 22px 10px;color:var(--gold);font-weight:700'
  box.appendChild(h)
  Object.entries(chats).forEach(([id, c]) => {
    const d = document.createElement('div')
    d.textContent = (id.endsWith('@g.us') ? '👥 ' : '👤 ') + (c.name || id)
    d.style.cssText = 'padding:14px 22px;cursor:pointer'
    d.onclick = () => {
      ov.remove()
      ;(Array.isArray(m) ? m : [m]).forEach(x => socket.emit('send_message', { chatId: id, content: x.content || '', senderName: 'Panel', type: x.type === 'sticker' ? 'image' : x.type, mediaUrl: x.mediaUrl || undefined, fileName: x.fileName }))
    }
    box.appendChild(d)
  })
  ov.appendChild(box)
  document.body.appendChild(ov)
}

function setTicks(bubble, m) {
  const tk = bubble.querySelector('.ticks')
  if (!tk) return
  const s = m.status
  tk.textContent = ' ' + (s != null && s <= 2 ? '✓' : '✓✓')
  tk.style.color = s >= 4 ? '#53bdeb' : ''
}

function waSheet(title, rows) {
  const ov = document.createElement('div')
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:950;display:flex;align-items:flex-end'
  ov.onclick = e => { if (e.target === ov) ov.remove() }
  const box = document.createElement('div')
  box.style.cssText = 'background:#1f2c34;width:100%;border-radius:20px 20px 0 0;padding:14px 0 calc(14px + env(safe-area-inset-bottom))'
  if (title) { const h = document.createElement('div'); h.textContent = title; h.style.cssText = 'padding:4px 22px 10px;color:#8696a0;font-size:14px'; box.appendChild(h) }
  rows.forEach(([l, fn]) => {
    const d = document.createElement('div')
    d.textContent = l
    d.style.cssText = 'padding:15px 22px;cursor:pointer;color:#e9edef'
    d.onclick = () => { ov.remove(); if (fn) fn() }
    box.appendChild(d)
  })
  ov.appendChild(box)
  document.body.appendChild(ov)
}

function toggleChatMenu(e) {
  if (e) e.stopPropagation()
  let m = document.getElementById('cmenu')
  if (m) { m.remove(); return }
  const isG = chatId.endsWith('@g.us')
  const muted = localStorage.getItem('mute:' + chatId) === '1'
  const items = [
    [isG ? 'Info. del grupo' : 'Ver contacto', () => { location.href = (chatId.endsWith('@g.us') ? '/group.html?id=' : '/contact.html?id=') + encodeURIComponent(chatId) }],
    ['Buscar', () => { if (window.openChatSearch) window.openChatSearch() }],
    ['Archivos, enlaces y docs.', () => { location.href = '/group.html?id=' + encodeURIComponent(chatId) + '&tab=1' }],
    [muted ? 'Dejar de silenciar' : 'Silenciar notificaciones', () => { if (muted) localStorage.removeItem('mute:' + chatId); else localStorage.setItem('mute:' + chatId, '1') }],
    ['Mensajes temporales', ephemeralSheet],
    ['Nuevo grupo', newGroupFlow],
    ['Más  ▸', moreSheet]
  ]
  m = document.createElement('div')
  m.id = 'cmenu'
  items.forEach(([l, fn], i) => {
    const d = document.createElement('div')
    d.className = 'cm-item' + (i >= 5 ? ' sep' : '')
    d.textContent = l
    d.onclick = () => { m.remove(); fn() }
    m.appendChild(d)
  })
  document.body.appendChild(m)
  setTimeout(() => document.addEventListener('click', function h() {
    const x = document.getElementById('cmenu')
    if (x) x.remove()
    document.removeEventListener('click', h)
  }), 0)
}

function openContact() {
  const num = '+' + chatId.split('@')[0].split(':')[0]
  const name = document.getElementById('chatName').textContent
  waSheet(name + ' · ' + num, [['Copiar número', () => navigator.clipboard && navigator.clipboard.writeText(num)], ['Cerrar']])
}

function ephemeralSheet() {
  const set = async s => {
    const r = await (await fetch('/api/ephemeral', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chatId, seconds: s }) })).json()
    if (!r.ok) alert(r.error || 'No se pudo cambiar')
  }
  waSheet('Mensajes temporales', [['Desactivados', () => set(0)], ['24 horas', () => set(86400)], ['7 días', () => set(604800)], ['90 días', () => set(7776000)]])
}

function moreSheet() {
  waSheet('', [
    ['📊 Crear encuesta', () => {
      askText('Pregunta de la encuesta', '', q => {
        if (!q || !q.trim()) return
        askText('Opciones separadas por coma (mínimo 2)', '', v => {
          const o = (v || '').split(',').map(x => x.trim()).filter(Boolean)
          if (o.length < 2) return alert('Pon al menos 2 opciones')
          socket.emit('send_poll', { chatId, name: q.trim(), values: o.slice(0, 12) })
        })
      })
    }],
    ['📍 Enviar mi ubicación', () => {
      if (!navigator.geolocation) return alert('Este navegador no tiene ubicación')
      navigator.geolocation.getCurrentPosition(p => socket.emit('send_location', { chatId, lat: p.coords.latitude, lng: p.coords.longitude }), () => alert('No se pudo obtener la ubicación'))
    }],
    ['Exportar chat', async () => {
      const c = await (await fetch('/chat/' + encodeURIComponent(chatId))).json()
      const t = c.messages.map(m => '[' + new Date(m.timestamp).toLocaleString() + '] ' + (m.fromMe ? 'Tú' : (m.senderName || '')) + ': ' + (m.content || (m.mediaUrl ? '<multimedia>' : ''))).join(String.fromCharCode(10))
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([t], { type: 'text/plain' }))
      a.download = (c.name || 'chat') + '.txt'
      a.click()
    }],
    ['Vaciar chat', async () => {
      if (!confirm('¿Vaciar todos los mensajes de este chat en el panel?')) return
      await fetch('/chat/' + encodeURIComponent(chatId) + '/clear', { method: 'POST' })
      location.reload()
    }]
  ])
}

async function newGroupFlow() {
  const subject = prompt('Nombre del grupo')
  if (!subject || !subject.trim()) return
  const v = prompt('Números de los miembros, separados por coma')
  const numbers = (v || '').split(',').map(x => x.replace(/\D/g, '')).filter(Boolean)
  if (!numbers.length) return
  const r = await (await fetch('/api/group-create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subject: subject.trim(), numbers }) })).json()
  if (!r.ok) { alert(r.error || 'No se pudo crear el grupo'); return }
  location.href = '/chat.html?id=' + encodeURIComponent(r.id)
}

// ===== Barra de entrada estilo WhatsApp =====
const EMOJIS = Array.from('😀😃😄😁😆😅😂🤣😊😇🙂😉😍🥰😘😋😛😜🤪🤨🧐😎🥳😏😒😞😔😟😕🙁😣😖😫😩🥺😢😭😤😠😡🤬🤯😳🥵🥶😱😨😰😥😓🤗🤔🤭🤫🙄😯😦😧😮😲😴🤤😪😵🤐🥴🤢🤮🤧😷🤒🤕🤑🤠😈👻💀👽🤖💩👍👎👌🤞🤟🤘👏🙌🙏💪💖💝💙💚💛🧡💜🖤💔💕💞🔥✨🎉🎂🌹🍕🍔🍺⚽🎮')
let rec = null, recChunks = [], recTimer = null, recStart = 0

/* wa-input-patched */
const SEND_ICONS = { mic: "<svg viewBox=\"0 0 24 24\" width=\"26\" height=\"26\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"><rect x=\"9\" y=\"3\" width=\"6\" height=\"11\" rx=\"3\" fill=\"currentColor\" stroke=\"none\"/><path d=\"M5.8 11.5a6.2 6.2 0 0 0 12.4 0M12 18v3M9.5 21h5\"/></svg>", send: "<svg viewBox=\"0 0 24 24\" width=\"26\" height=\"26\" fill=\"currentColor\"><path d=\"M3.4 20.4 21 12 3.4 3.6 3.4 10.2 15 12 3.4 13.8z\"/></svg>" }
function setSendIcon(has) {
  const b = document.getElementById('sendBtn')
  const k = has ? 'send' : 'mic'
  if (b.dataset.ic === k) return
  b.dataset.ic = k
  b.innerHTML = SEND_ICONS[k]
}
function updateSendIcon() {
  if (rec) return
  const has = document.getElementById('msgInput').value.trim() || pendingImage
  setSendIcon(!!has)
}
setInterval(updateSendIcon, 250)

function sendOrRecord() {
  if (rec) return stopRecording(true)
  if (document.getElementById('msgInput').value.trim() || pendingImage) return sendMessage()
  startRecording()
}

document.getElementById('camInput').addEventListener('change', e => {
  const f = e.target.files[0]
  if (!f) return
  const dt = new DataTransfer()
  dt.items.add(f)
  const inp = document.getElementById('imgInput')
  inp.files = dt.files
  inp.dispatchEvent(new Event('change'))
  e.target.value = ''
})

document.getElementById('avatar').style.cursor = 'pointer'
document.getElementById('avatar').onclick = () => { location.href = (chatId.endsWith('@g.us') ? '/group.html?id=' : '/contact.html?id=') + encodeURIComponent(chatId) }

async function startRecording() {
  let stream
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }) } catch (e) { alert('No se pudo acceder al micrófono'); return }
  recChunks = []
  rec = new MediaRecorder(stream)
  rec.ondataavailable = e => { if (e.data.size) recChunks.push(e.data) }
  rec.start()
  recStart = Date.now()
  document.getElementById('pill').style.display = 'none'
  const bar = document.createElement('div')
  bar.id = 'recbar'
  bar.innerHTML = '<span onclick="stopRecording(false)" style="font-size:22px;cursor:pointer">🗑</span><span style="color:#ff5c5c">●</span><span id="rectime">0:00</span>'
  document.getElementById('sendBtn').before(bar)
  setSendIcon(true)
  recTimer = setInterval(() => {
    const s = Math.floor((Date.now() - recStart) / 1000)
    document.getElementById('rectime').textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')
  }, 500)
}

function stopRecording(send) {
  if (!rec) return
  const r = rec
  rec = null
  clearInterval(recTimer)
  r.onstop = () => {
    r.stream.getTracks().forEach(t => t.stop())
    if (send && recChunks.length) {
      const blob = new Blob(recChunks, { type: r.mimeType || 'audio/webm' })
      const fr = new FileReader()
      fr.onload = () => {
        socket.emit('send_message', { chatId, content: '', senderName: 'Panel', type: 'audio', ptt: true, mediaUrl: fr.result, replyTo: replyTo || undefined })
        if (replyTo && typeof cancelReply === 'function') cancelReply()
      }
      fr.readAsDataURL(blob)
    }
  }
  r.stop()
  const bar = document.getElementById('recbar')
  if (bar) bar.remove()
  document.getElementById('pill').style.display = ''
}

function closeEmoji() { const p = document.getElementById('epanel'); if (p) p.remove() }

function toggleEmoji() {
  if (document.getElementById('epanel')) return closeEmoji()
  const p = document.createElement('div')
  p.id = 'epanel'
  p.style.cssText = 'height:38dvh;background:#111b21;display:flex;flex-direction:column;flex-shrink:0'
  const tabs = document.createElement('div')
  tabs.style.cssText = 'display:flex;border-bottom:1px solid #2a3942'
  const body = document.createElement('div')
  body.style.cssText = 'flex:1;overflow:auto'
  const show = i => {
    ;[...tabs.children].forEach((t, k) => { t.style.color = k === i ? '#00a884' : '#8696a0'; t.style.borderBottom = k === i ? '2px solid #00a884' : '2px solid transparent' })
    if (i === 1) return loadStickers(body)
    body.innerHTML = ''
    const g = document.createElement('div')
    g.style.cssText = 'display:grid;grid-template-columns:repeat(8,1fr);padding:8px;font-size:26px;text-align:center'
    EMOJIS.forEach(e => {
      const s = document.createElement('span')
      s.textContent = e
      s.style.cssText = 'padding:6px 0;cursor:pointer'
      s.onclick = () => { const t = document.getElementById('msgInput'); t.value += e; t.dispatchEvent(new Event('input')) }
      g.appendChild(s)
    })
    body.appendChild(g)
  }
  ;['😊 Emojis', '🖼 Stickers'].forEach((l, i) => {
    const t = document.createElement('div')
    t.textContent = l
    t.style.cssText = 'flex:1;text-align:center;padding:12px;cursor:pointer'
    t.onclick = () => show(i)
    tabs.appendChild(t)
  })
  p.appendChild(tabs)
  p.appendChild(body)
  document.getElementById('inputArea').after(p)
  show(0)
}

async function loadStickers(box) {
  box.innerHTML = ''
  const add = document.createElement('div')
  add.textContent = '➕ Crear sticker desde una imagen'
  add.style.cssText = 'padding:12px 14px;color:#00a884;cursor:pointer'
  add.onclick = () => {
    const f = document.createElement('input')
    f.type = 'file'
    f.accept = 'image/*'
    f.onchange = () => {
      const fl = f.files[0]
      if (!fl) return
      const fr = new FileReader()
      fr.onload = () => { socket.emit('send_message', { chatId, content: '', senderName: 'Panel', type: 'sticker', mediaUrl: fr.result }); closeEmoji() }
      fr.readAsDataURL(fl)
    }
    f.click()
  }
  box.appendChild(add)
  const c = await (await fetch('/chat/' + encodeURIComponent(chatId))).json()
  const seen = new Set()
  const grid = document.createElement('div')
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:8px'
  c.messages.filter(m => m.type === 'sticker' && m.mediaUrl).reverse().forEach(m => {
    if (seen.has(m.mediaUrl)) return
    seen.add(m.mediaUrl)
    const i = document.createElement('img')
    i.src = m.mediaUrl
    i.style.cssText = 'width:100%;aspect-ratio:1;object-fit:contain;cursor:pointer'
    i.onclick = () => { socket.emit('send_message', { chatId, content: '', senderName: 'Panel', type: 'sticker', mediaUrl: m.mediaUrl }); closeEmoji() }
    grid.appendChild(i)
  })
  box.appendChild(grid)
  if (!seen.size) {
    const p = document.createElement('div')
    p.textContent = 'Aquí aparecerán los stickers que recibas en este chat'
    p.style.cssText = 'padding:8px 14px;color:#8696a0;font-size:13px'
    box.appendChild(p)
  }
}

if (params.get('search')) setTimeout(() => { if (window.openChatSearch) window.openChatSearch() }, 500)
if (localStorage.getItem('mediavis:' + chatId) === 'no') {
  const s = document.createElement('style')
  s.textContent = '.bubble img.msg-img,.bubble video,.bubble audio{display:none !important}'
  document.head.appendChild(s)
}

// ===== Presencia, borradores y ajustes =====
socket.emit('subscribe_presence', { chatId })
let lastTyping = 0
document.getElementById('msgInput').addEventListener('input', () => {
  if (Date.now() - lastTyping > 3000) { lastTyping = Date.now(); socket.emit('typing', { chatId }) }
})
socket.on('presence', ({ chatId: c, list }) => {
  if (c !== chatId) return
  const el = document.getElementById('chatStatus')
  if (!el) return
  const act = list.find(p => p.state === 'composing' || p.state === 'recording')
  el.textContent = act ? waTyping(c, act)
    : (!c.endsWith('@g.us') && list.some(p => p.state === 'available') ? 'en línea' : (window.__def || 'WhatsApp'))
})
;(function () {
  const t = document.getElementById('msgInput')
  const k = 'draft:' + chatId
  const d = localStorage.getItem(k)
  if (d) t.value = d
  t.addEventListener('input', () => { if (t.value) localStorage.setItem(k, t.value); else localStorage.removeItem(k) })
  setInterval(() => { if (!t.value) localStorage.removeItem(k) }, 500)
})()
;(function () {
  let s = {}
  try { s = JSON.parse(localStorage.getItem('settings') || '{}') } catch (e) {}
  const css = []
  if (s.wall && s.wall !== 'doodle') css.push('#messages{background-image:none !important;background-color:' + s.wall + ' !important}')
  if (s.font) css.push('.bubble{font-size:' + s.font + 'px !important}')
  if (css.length) { const st = document.createElement('style'); st.textContent = css.join(''); document.head.appendChild(st) }
  if (s.enterSend === false) document.getElementById('msgInput').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) e.stopImmediatePropagation() }, true)
})()

;(function () {
  const av = document.getElementById('avatar')
  fetch('/api/pfp/' + encodeURIComponent(chatId)).then(r => r.json()).then(r => {
    if (!r.url) return
    const im = new Image()
    im.onload = () => { av.textContent = ''; av.style.backgroundImage = 'url("' + r.url + '")'; av.style.backgroundSize = 'cover'; av.style.backgroundPosition = 'center' }
    im.src = r.url
  }).catch(() => {})
  if (chatId.endsWith('@g.us')) fetch('/api/group/' + encodeURIComponent(chatId)).then(r => r.json()).then(g => {
    if (!g.ok) return
    window.__def = g.size + ' participantes'
    const el = document.getElementById('chatStatus')
    if (el && el.textContent === 'WhatsApp') el.textContent = window.__def
  }).catch(() => {})
})()

// ===== Editar, fijar, info, menciones y no leídos =====
const pinKey = () => 'pin:' + chatId
function pinnedId() { try { return (JSON.parse(localStorage.getItem(pinKey())) || {}).id } catch (e) { return null } }
function renderPin() {
  let bar = document.getElementById('pinbar')
  let p = null
  try { p = JSON.parse(localStorage.getItem(pinKey())) } catch (e) {}
  if (!p) { if (bar) bar.remove(); return }
  if (!bar) {
    bar = document.createElement('div')
    bar.id = 'pinbar'
    bar.style.cssText = 'padding:8px 16px;background:#182229;color:#e9edef;font-size:14px;border-bottom:1px solid #2a3942;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis'
    document.getElementById('header-info').parentElement.after(bar)
  }
  bar.textContent = '📌 ' + p.text
  bar.onclick = () => { const t = document.querySelector('[data-msg-id="' + p.id + '"]'); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'center' }) }
}
function togglePin(m) {
  const key = m.waMessageKey
  if (pinnedId() === key.id) { localStorage.removeItem(pinKey()); socket.emit('pin_message', { chatId, key, pin: false }) }
  else { localStorage.setItem(pinKey(), JSON.stringify({ id: key.id, text: (m.content || '📎 Multimedia').slice(0, 80) })); socket.emit('pin_message', { chatId, key, pin: true }) }
  renderPin()
}
renderPin()

function editMsg(m) {
  askText('Editar mensaje', m.content, v => {
    v = (v || '').trim()
    if (v && v !== m.content) socket.emit('edit_message', { chatId, key: m.waMessageKey, text: v })
  })
}
function msgInfo(m) {
  const s = m.status
  const st = !m.fromMe ? 'Recibido' : (s >= 4 ? 'Leído' : s === 3 ? 'Entregado' : 'Enviado')
  waSheet('Info del mensaje', [['Fecha: ' + new Date(m.timestamp).toLocaleString()], ['Estado: ' + st], ['Tipo: ' + (m.type || 'text')]])
}

;(function () {
  if (!chatId.endsWith('@g.us')) return
  let members = []
  const picked = {}
  fetch('/api/group/' + encodeURIComponent(chatId)).then(r => r.json()).then(g => { if (g.ok) members = g.participants.filter(p => !p.isMe) }).catch(() => {})
  const input = document.getElementById('msgInput')
  const bar = document.createElement('div')
  bar.style.cssText = 'display:none;background:#1f2c34;max-height:30dvh;overflow:auto;border-top:1px solid #2a3942'
  document.getElementById('inputArea').before(bar)
  input.addEventListener('input', () => {
    const m = input.value.match(/@([^\s@]*)$/)
    if (!m) { bar.style.display = 'none'; return }
    const q = m[1].toLowerCase()
    const hits = members.filter(p => (p.name || '').toLowerCase().includes(q) || String(p.phone).includes(q)).slice(0, 8)
    bar.innerHTML = ''
    hits.forEach(p => {
      const nm = p.name || ('+' + String(p.phone).split('@')[0].split(':')[0])
      const d = document.createElement('div')
      d.textContent = nm
      d.style.cssText = 'padding:12px 18px;cursor:pointer;color:#e9edef'
      d.onclick = () => { input.value = input.value.replace(/@([^\s@]*)$/, '@' + nm + ' '); picked[nm] = p.id; bar.style.display = 'none'; input.focus(); input.dispatchEvent(new Event('input')) }
      bar.appendChild(d)
    })
    bar.style.display = hits.length ? 'block' : 'none'
  })
  const _emit = socket.emit.bind(socket)
  socket.emit = function (ev, data) {
    if (ev === 'send_message' && data && data.chatId === chatId && data.content) {
      const ms = Object.keys(picked).filter(n => data.content.includes('@' + n)).map(n => picked[n])
      if (ms.length) data.mentions = ms
    }
    return _emit.apply(null, arguments)
  }
})()

window.addEventListener('pagehide', () => localStorage.setItem('lastseen:' + chatId, Date.now()))
setTimeout(() => {
  const ls = +localStorage.getItem('lastseen:' + chatId) || 0
  if (!ls) return
  const w = [...document.querySelectorAll('.msg-wrap')].filter(x => +x.dataset.ts > ls && !x.querySelector('.bubble.sent'))
  if (!w.length) return
  const d = document.createElement('div')
  d.textContent = w.length + (w.length === 1 ? ' mensaje no leído' : ' mensajes no leídos')
  d.style.cssText = 'text-align:center;margin:10px auto;padding:5px 14px;border-radius:12px;background:#182229;color:#8696a0;font-size:12.5px;width:fit-content'
  w[0].before(d)
  d.scrollIntoView({ block: 'center' })
}, 900)

// ===== Historial de ediciones, mensajes eliminados y enlaces =====
function askText(title, initial, cb) {
  const ov = document.createElement('div')
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:990;display:flex;align-items:center;justify-content:center;padding:20px'
  const box = document.createElement('div')
  box.style.cssText = 'background:#1f2c34;border-radius:16px;padding:18px;width:100%;max-width:420px;color:#e9edef'
  const h = document.createElement('div')
  h.textContent = title
  h.style.cssText = 'font-size:16px;margin-bottom:12px'
  const t = document.createElement('textarea')
  t.value = initial || ''
  t.rows = 4
  t.style.cssText = 'width:100%;box-sizing:border-box;background:#111b21;border:1px solid #2a3942;border-radius:10px;color:#e9edef;font-size:16px;padding:10px;outline:none;resize:none'
  const row = document.createElement('div')
  row.style.cssText = 'display:flex;justify-content:flex-end;gap:12px;margin-top:14px'
  const mk = (l, f, c) => { const b = document.createElement('div'); b.textContent = l; b.style.cssText = 'padding:10px 18px;border-radius:18px;cursor:pointer;font-weight:600;' + (c || 'color:#8696a0'); b.onclick = f; return b }
  const close = () => { t.blur(); ov.remove(); window.scrollTo(0, 0) }
  row.append(mk('Cancelar', close), mk('Aceptar', () => { const v = t.value; close(); cb(v) }, 'background:#00a884;color:#000'))
  box.append(h, t, row)
  ov.appendChild(box)
  document.body.appendChild(ov)
  setTimeout(() => { t.focus(); t.setSelectionRange(t.value.length, t.value.length) }, 50)
}

function infoModal(title, items) {
  const ov = document.createElement('div')
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:990;display:flex;align-items:flex-end'
  ov.onclick = e => { if (e.target === ov) ov.remove() }
  const box = document.createElement('div')
  box.style.cssText = 'background:#1f2c34;width:100%;max-height:75dvh;overflow:auto;border-radius:20px 20px 0 0;padding:16px 18px calc(18px + env(safe-area-inset-bottom));color:#e9edef'
  const h = document.createElement('div')
  h.textContent = title
  h.style.cssText = 'font-size:17px;font-weight:600;margin-bottom:10px;color:#00a884'
  box.appendChild(h)
  items.forEach(it => {
    const d = document.createElement('div')
    d.style.cssText = 'padding:10px 0;border-top:1px solid #2a3942'
    const l = document.createElement('div')
    l.textContent = it.label
    l.style.cssText = 'font-size:12.5px;color:#8696a0;margin-bottom:4px'
    const t = document.createElement('div')
    t.textContent = it.text
    t.style.cssText = 'white-space:pre-wrap;word-break:break-word;font-size:15px'
    d.append(l, t)
    box.appendChild(d)
  })
  ov.appendChild(box)
  document.body.appendChild(ov)
}

function showEdits(m) {
  const old = m.edits || []
  const n = old.length
  const items = old.map((v, i) => ({ label: (i === 0 ? 'Original' : 'Edición ' + i) + ' · ' + new Date(v.t).toLocaleString(), text: v.text || '(vacío)' }))
  items.push({ label: 'Actual (edición ' + n + ') · ' + new Date(m.lastEditAt || m.timestamp).toLocaleString(), text: m.content || '' })
  infoModal('Historial · ' + n + (n === 1 ? ' edición' : ' ediciones'), items)
}

function renderEdited(bubble, m) {
  const tm = bubble.querySelector('.msg-time')
  if (!tm) return
  const old = tm.querySelector('.edtag')
  if (old) old.remove()
  if (!m.edited) return
  const tag = document.createElement('span')
  tag.className = 'edtag'
  tag.textContent = '✏ editado' + ((m.edits || []).length > 1 ? ' (' + m.edits.length + ')' : '') + ' '
  tag.style.cssText = 'cursor:pointer;color:#53bdeb'
  tag.onclick = e => { e.stopPropagation(); showEdits(m) }
  tm.insertBefore(tag, tm.firstChild)
}

function linkify(root) {
  const re = /(https?:\/\/[^\s<]+)/g
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes = []
  while (w.nextNode()) nodes.push(w.currentNode)
  nodes.forEach(n => {
    if (!/https?:\/\//.test(n.nodeValue) || (n.parentNode.closest && n.parentNode.closest('a'))) return
    const f = document.createDocumentFragment()
    n.nodeValue.split(re).forEach((part, i) => {
      if (i % 2) { const a = document.createElement('a'); a.href = part; a.target = '_blank'; a.rel = 'noopener'; a.textContent = part; a.style.color = '#53bdeb'; f.appendChild(a) }
      else f.appendChild(document.createTextNode(part))
    })
    n.parentNode.replaceChild(f, n)
  })
  addPreview(root)
}

document.addEventListener('click', e => {
  const i = e.target.closest && e.target.closest('.revoked-icon')
  if (!i) return
  const b = i.closest('.bubble')
  const m = b && b._m
  infoModal('Mensaje eliminado', [{ label: 'Contenido original', text: (m && (m.originalContent || m.content)) || '(no se guardó el contenido)' }])
})

// ===== Números legibles, selección múltiple =====
function fmtPhone(d) {
  d = String(d || '').replace(/\D/g, '')
  if (d.startsWith('598') && d.length === 11) return '+598 ' + d.slice(3).replace(/^(\d{2})(\d{3})(\d{3})$/, '$1 $2 $3')
  return d ? '+' + d : ''
}
let __memP = null
function membersOnce() {
  if (!chatId.endsWith('@g.us')) return Promise.resolve([])
  if (!__memP) __memP = fetch('/api/group/' + encodeURIComponent(chatId)).then(r => r.json()).then(g => g.ok ? g.participants : []).catch(() => [])
  return __memP
}
window.__pnmap = {}
async function fixNumbers() {
  const els = [...document.querySelectorAll('.msg-meta-number:not([data-fx]), .reply-quote-name:not([data-fx])')]
  if (!els.length) return
  els.forEach(e => { e.dataset.fx = '1' })
  const mem = await membersOnce()
  for (const el of els) {
    if (el.classList.contains('reply-quote-name') && !/^\+/.test(el.textContent || '')) continue
    const d = (el.textContent || '').replace(/\D/g, '')
    if (!d) continue
    let pn = window.__pnmap[d]
    if (pn === undefined) {
      pn = ''
      const m = mem.find(p => String(p.id).split('@')[0].split(':')[0] === d)
      if (m && m.phone && !String(m.phone).endsWith('@lid')) pn = String(m.phone).split('@')[0].split(':')[0]
      if (!pn) { try { pn = (await (await fetch('/api/pn/' + d + '@lid')).json()).pn || '' } catch (e) {} }
      window.__pnmap[d] = pn
    }
    el.textContent = fmtPhone(pn || d)
  }
}
new MutationObserver(() => fixNumbers()).observe(messagesEl, { childList: true, subtree: true })
setTimeout(fixNumbers, 600)

const selected = new Map()
const isSelecting = () => selected.size > 0
function updateSelBar() {
  let bar = document.getElementById('selbar')
  if (!selected.size) { if (bar) bar.remove(); return }
  if (!bar) {
    bar = document.createElement('div')
    bar.id = 'selbar'
    bar.style.cssText = 'position:fixed;top:0;left:0;right:0;height:60px;background:#202c33;z-index:970;display:flex;align-items:center;gap:22px;padding:0 18px;color:#e9edef;font-size:22px'
    document.body.appendChild(bar)
  }
  bar.innerHTML = ''
  const mk = (t, fn) => { const s = document.createElement('span'); s.textContent = t; s.style.cursor = 'pointer'; s.onclick = fn; return s }
  const cnt = document.createElement('span')
  cnt.textContent = selected.size
  cnt.style.cssText = 'flex:1;font-size:19px'
  bar.append(mk('✕', endSelect), cnt, mk('⭐', starSelected), mk('↪', () => { const l = [...selected.values()]; endSelect(); forwardMsg(l) }), mk('🗑', delSelected))
}
function toggleSel(m) {
  const k = m.waMessageKey && m.waMessageKey.id
  if (!k) return
  if (selected.has(k)) selected.delete(k); else selected.set(k, m)
  const b = document.querySelector('[data-msg-id="' + k + '"] .bubble')
  if (b) b.style.outline = selected.has(k) ? '2px solid #00a884' : ''
  updateSelBar()
}
function startSelect(m) { toggleSel(m) }
function endSelect() {
  selected.forEach((m, k) => { const b = document.querySelector('[data-msg-id="' + k + '"] .bubble'); if (b) b.style.outline = '' })
  selected.clear()
  updateSelBar()
}
function delSelected() {
  if (!confirm('¿Borrar ' + selected.size + ' mensajes del panel?')) return
  selected.forEach(m => socket.emit('delete_message', { chatId, key: m.waMessageKey, everyone: false }))
  endSelect()
}
function starSelected() {
  const k = 'star:' + chatId
  let s = []
  try { s = JSON.parse(localStorage.getItem(k) || '[]') } catch (e) {}
  const ids = [...selected.keys()]
  const all = ids.every(i => s.includes(i))
  s = all ? s.filter(i => !ids.includes(i)) : [...new Set([...s, ...ids])]
  localStorage.setItem(k, JSON.stringify(s))
  endSelect()
  location.reload()
}
const __openMenu = window.openMsgMenu
window.openMsgMenu = m => { if (isSelecting()) toggleSel(m); else __openMenu(m) }
messagesEl.addEventListener('click', e => {
  if (!isSelecting()) return
  const b = e.target.closest && e.target.closest('.bubble')
  if (!b || !b._m) return
  e.preventDefault(); e.stopPropagation()
  toggleSel(b._m)
}, true)

// ===== Menú de miembros, adjuntos, llamadas y botón de bajar =====
let __gp = null
function groupOnce() {
  if (!chatId.endsWith('@g.us')) return Promise.resolve(null)
  if (!__gp) __gp = fetch('/api/group/' + encodeURIComponent(chatId)).then(r => r.json()).then(g => g.ok ? g : null).catch(() => null)
  return __gp
}
function digitsOf(j) { return String(j || '').split('@')[0].split(':')[0].replace(/\D/g, '') }
async function groupAct(type, ids) {
  return (await fetch('/group/' + encodeURIComponent(chatId) + '/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, ids }) })).json()
}
function sheetX(title, rows) {
  const ov = document.createElement('div')
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:950;display:flex;align-items:flex-end'
  ov.onclick = e => { if (e.target === ov) ov.remove() }
  const box = document.createElement('div')
  box.style.cssText = 'background:#1f2c34;width:100%;border-radius:20px 20px 0 0;padding:14px 0 calc(14px + env(safe-area-inset-bottom))'
  if (title) { const h = document.createElement('div'); h.textContent = title; h.style.cssText = 'padding:4px 22px 12px;color:#8696a0;font-size:14px;border-bottom:1px solid #2a3942;margin-bottom:4px'; box.appendChild(h) }
  rows.forEach(([l, fn, red]) => {
    const d = document.createElement('div')
    d.textContent = l
    d.style.cssText = 'padding:15px 22px;cursor:pointer;white-space:pre;color:' + (red ? '#ff5c5c' : '#e9edef')
    d.onclick = () => { ov.remove(); if (fn) fn() }
    box.appendChild(d)
  })
  ov.appendChild(box)
  document.body.appendChild(ov)
}
async function openMemberMenu(m) {
  const g = await groupOnce()
  const sid = digitsOf(m.senderId)
  const p = g && g.participants.find(x => digitsOf(x.id) === sid || digitsOf(x.phone) === sid)
  const name = (p && p.name) || m.senderName || ('+' + sid)
  const pn = p && p.phone && !String(p.phone).endsWith('@lid') ? digitsOf(p.phone) : ((window.__pnmap && window.__pnmap[sid]) || '')
  const open = async path => {
    const jid = pn ? pn + '@s.whatsapp.net' : (p ? p.id : m.senderId)
    const r = await (await fetch('/api/resolve?jid=' + encodeURIComponent(jid) + '&name=' + encodeURIComponent(name))).json()
    location.href = path + encodeURIComponent(r.id)
  }
  const rows = [
    ['💬   Enviar mensaje a ' + name, () => open('/chat.html?id=')],
    ['📞   Llamada de voz', () => { if (pn) location.href = 'tel:+' + pn; else alert('No tengo el número de este contacto') }],
    ['📹   Videollamada', () => { if (pn) window.open('https://wa.me/' + pn); else alert('No tengo el número de este contacto') }],
    ['👤   Ver a ' + name, () => open('/contact.html?id=')]
  ]
  if (g && g.meAdmin && p && !p.isMe) {
    rows.push([(p.admin ? '⭐   Quitar como admin del grupo' : '⭐   Hacer admin del grupo'), async () => {
      const r = await groupAct(p.admin ? 'demote' : 'promote', [p.id])
      if (r.ok) { __gp = null; alert(p.admin ? 'Ya no es admin del grupo' : 'Ahora es admin del grupo') } else alert(r.error || 'No se pudo completar')
    }])
    rows.push(['🚫   Eliminar a ' + name + ' del grupo', async () => {
      if (!confirm('¿Eliminar a ' + name + ' del grupo?')) return
      const r = await groupAct('remove', [p.id])
      if (r.ok) { __gp = null; alert('Eliminado del grupo') } else alert(r.error || 'No se pudo completar')
    }, true])
  }
  sheetX(name + (pn ? ' · ' + fmtPhone(pn) : ''), rows)
}
messagesEl.addEventListener('click', e => {
  if (!chatId.endsWith('@g.us') || isSelecting()) return
  const t = e.target.closest && e.target.closest('.msg-meta-name, .msg-meta-number, .msg-avatar')
  if (!t) return
  const w = t.closest('.msg-wrap')
  const b = w && w.querySelector('.bubble')
  if (b && b._m) { e.stopPropagation(); openMemberMenu(b._m) }
})

async function callPeer(video) {
  let pn = ''
  if (chatId.endsWith('@s.whatsapp.net')) pn = digitsOf(chatId)
  else if (chatId.endsWith('@lid')) { try { pn = (await (await fetch('/api/pn/' + encodeURIComponent(chatId))).json()).pn || '' } catch (e) {} }
  if (!pn) return alert('No tengo el número de este contacto')
  if (video) window.open('https://wa.me/' + pn); else location.href = 'tel:+' + pn
}
if (chatId.endsWith('@g.us')) ['hdrVideo', 'hdrCall'].forEach(i => { const el = document.getElementById(i); if (el) el.style.display = 'none' })

function makePoll() {
  askText('Pregunta de la encuesta', '', q => {
    if (!q || !q.trim()) return
    askText('Opciones separadas por coma (mínimo 2)', '', v => {
      const o = (v || '').split(',').map(x => x.trim()).filter(Boolean)
      if (o.length < 2) return alert('Pon al menos 2 opciones')
      socket.emit('send_poll', { chatId, name: q.trim(), values: o.slice(0, 12) })
    })
  })
}
function sendLocation() {
  if (!navigator.geolocation) return alert('Este navegador no tiene ubicación')
  navigator.geolocation.getCurrentPosition(p => socket.emit('send_location', { chatId, lat: p.coords.latitude, lng: p.coords.longitude }), () => alert('No se pudo obtener la ubicación'))
}
function shareContact() {
  askText('Nombre del contacto', '', nm => {
    if (!nm || !nm.trim()) return
    askText('Número con código de país', '', num => {
      const d = (num || '').replace(/\D/g, '')
      if (d) socket.emit('send_contact', { chatId, name: nm.trim(), number: d })
    })
  })
}
function attachSheet() {
  const ov = document.createElement('div')
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:950;display:flex;align-items:flex-end'
  ov.onclick = e => { if (e.target === ov) ov.remove() }
  const box = document.createElement('div')
  box.style.cssText = 'background:#1f2c34;width:100%;border-radius:22px 22px 0 0;padding:26px 18px calc(24px + env(safe-area-inset-bottom));display:grid;grid-template-columns:repeat(3,1fr);gap:24px 8px'
  const pick = accept => { const i = document.getElementById('imgInput'); i.accept = accept; i.click() }
  const items = [
    ['📄', 'Documento', '#7f66ff', () => pick('*/*')],
    ['📷', 'Cámara', '#ff2e74', () => document.getElementById('camInput').click()],
    ['🖼', 'Galería', '#bf59cf', () => pick('image/*,video/*')],
    ['🎧', 'Audio', '#f96533', () => pick('audio/*')],
    ['📍', 'Ubicación', '#1fa855', sendLocation],
    ['👤', 'Contacto', '#009de2', shareContact],
    ['📊', 'Encuesta', '#ffbc38', makePoll]
  ]
  items.forEach(([ic, l, c, fn]) => {
    const d = document.createElement('div')
    d.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;color:#e9edef;font-size:13px'
    const k = document.createElement('div')
    k.textContent = ic
    k.style.cssText = 'width:58px;height:58px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:26px;background:' + c
    const t = document.createElement('div')
    t.textContent = l
    d.append(k, t)
    d.onclick = () => { ov.remove(); fn() }
    box.appendChild(d)
  })
  ov.appendChild(box)
  document.body.appendChild(ov)
}
document.getElementById('imgBtn').onclick = attachSheet

;(function () {
  const btn = document.createElement('div')
  btn.id = 'toBottom'
  btn.textContent = '⌄'
  btn.style.cssText = 'position:fixed;right:14px;bottom:86px;width:42px;height:42px;border-radius:50%;background:#1f2c34;color:#8696a0;display:none;align-items:center;justify-content:center;font-size:26px;box-shadow:0 2px 8px rgba(0,0,0,.5);z-index:30;cursor:pointer'
  const cnt = document.createElement('span')
  cnt.style.cssText = 'position:absolute;top:-8px;right:-2px;background:#00a884;color:#0b141a;border-radius:10px;font-size:12px;font-weight:700;padding:1px 6px;display:none'
  btn.appendChild(cnt)
  document.body.appendChild(btn)
  let missed = 0
  const upd = () => {
    const far = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight > 300
    btn.style.display = far ? 'flex' : 'none'
    if (!far) { missed = 0; cnt.style.display = 'none' }
  }
  messagesEl.addEventListener('scroll', upd)
  btn.onclick = () => messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: 'smooth' })
  socket.on('receive_message', m => { if (btn.style.display === 'flex' && !m.fromMe) { missed++; cnt.textContent = missed; cnt.style.display = 'block' } })
})()

// ===== Tarjeta de contacto, fotos de perfil, vista previa de enlaces y zoom =====
async function memberInfo(m) {
  const g = await groupOnce()
  const sid = digitsOf(m.senderId)
  const p = g && g.participants.find(x => digitsOf(x.id) === sid || digitsOf(x.phone) === sid)
  const name = (p && p.name) || m.senderName || ('+' + sid)
  const pn = p && p.phone && !String(p.phone).endsWith('@lid') ? digitsOf(p.phone) : ((window.__pnmap && window.__pnmap[sid]) || '')
  const jid = pn ? pn + '@s.whatsapp.net' : (p ? p.id : m.senderId)
  return { g, p, name, pn, jid }
}
async function goChatOf(info, path) {
  const r = await (await fetch('/api/resolve?jid=' + encodeURIComponent(info.jid) + '&name=' + encodeURIComponent(info.name))).json()
  location.href = path + encodeURIComponent(r.id)
}
async function memberDM(m) { goChatOf(await memberInfo(m), '/chat.html?id=') }

async function openMemberCard(m) {
  const info = await memberInfo(m)
  const { g, p, name, pn } = info
  const ov = document.createElement('div')
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:960;display:flex;align-items:center;justify-content:center;padding:24px'
  ov.onclick = e => { if (e.target === ov) ov.remove() }
  const card = document.createElement('div')
  card.style.cssText = 'width:100%;max-width:300px;background:#1f2c34;border-radius:14px;overflow:hidden;color:#e9edef;box-shadow:0 10px 40px rgba(0,0,0,.6)'
  const photo = document.createElement('div')
  photo.style.cssText = 'position:relative;height:240px;background:#3a2c1e;display:flex;align-items:center;justify-content:center;background-size:cover;background-position:center'
  photo.innerHTML = '<svg width="90" height="90" viewBox="0 0 24 24" fill="#f6c36b"><circle cx="12" cy="8" r="4.2"/><path d="M3.5 21c0-4.6 3.8-7.2 8.5-7.2s8.5 2.6 8.5 7.2z"/></svg>'
  const head = document.createElement('div')
  head.style.cssText = 'position:absolute;top:0;left:0;right:0;padding:12px 16px;background:linear-gradient(rgba(0,0,0,.6),transparent);font-size:17px;font-weight:600'
  head.textContent = name
  photo.appendChild(head)
  fetch('/api/pfp/' + encodeURIComponent(info.jid)).then(r => r.json()).then(r => {
    if (!r.url) return
    const im = new Image()
    im.onload = () => { photo.innerHTML = ''; photo.style.backgroundImage = 'url("' + r.url + '")'; photo.appendChild(head) }
    im.src = r.url
  }).catch(() => {})
  const bar = document.createElement('div')
  bar.style.cssText = 'display:flex;justify-content:space-around;padding:12px 6px;border-bottom:1px solid #2a3942'
  const btn = (ic, fn) => { const b = document.createElement('div'); b.textContent = ic; b.style.cssText = 'font-size:24px;padding:6px 14px;cursor:pointer;color:#00a884'; b.onclick = () => { ov.remove(); fn() }; return b }
  bar.append(
    btn('💬', () => goChatOf(info, '/chat.html?id=')),
    btn('📞', () => { if (pn) location.href = 'tel:+' + pn; else alert('No tengo el número de este contacto') }),
    btn('📹', () => { if (pn) window.open('https://wa.me/' + pn); else alert('No tengo el número de este contacto') }),
    btn('ℹ', () => goChatOf(info, '/contact.html?id='))
  )
  card.append(photo, bar)
  if (g && g.meAdmin && p && !p.isMe) {
    const row = (t, red, fn) => { const d = document.createElement('div'); d.textContent = t; d.style.cssText = 'padding:14px 18px;cursor:pointer;font-size:15px;color:' + (red ? '#ff5c5c' : '#e9edef'); d.onclick = () => { ov.remove(); fn() }; return d }
    card.append(
      row(p.admin ? 'Quitar como admin del grupo' : 'Hacer admin del grupo', false, async () => {
        const r = await groupAct(p.admin ? 'demote' : 'promote', [p.id])
        if (r.ok) { __gp = null; alert(p.admin ? 'Ya no es admin del grupo' : 'Ahora es admin del grupo') } else alert(r.error || 'No se pudo completar')
      }),
      row('Eliminar a ' + name + ' del grupo', true, async () => {
        if (!confirm('¿Eliminar a ' + name + ' del grupo?')) return
        const r = await groupAct('remove', [p.id])
        if (r.ok) { __gp = null; alert('Eliminado del grupo') } else alert(r.error || 'No se pudo completar')
      })
    )
  }
  ov.appendChild(card)
  document.body.appendChild(ov)
}
openMemberMenu = openMemberCard

const __pfc = (() => { try { return JSON.parse(localStorage.getItem('pfpCache') || '{}') } catch (e) { return {} } })()
const __pfPend = {}
function getPfp(id) {
  const c = __pfc[id]
  if (c && Date.now() - c.t < 6 * 3600e3) return Promise.resolve(c.url)
  if (!__pfPend[id]) {
    __pfPend[id] = fetch('/api/pfp/' + encodeURIComponent(id)).then(r => r.json()).then(r => {
      __pfc[id] = { url: r.url || '', t: Date.now() }
      localStorage.setItem('pfpCache', JSON.stringify(__pfc))
      return r.url || ''
    }).catch(() => '')
  }
  return __pfPend[id]
}
function applyAvatars() {
  document.querySelectorAll('.msg-avatar:not([data-pf])').forEach(async el => {
    el.dataset.pf = '1'
    const w = el.closest('.msg-wrap')
    const b = w && w.querySelector('.bubble')
    const m = b && b._m
    if (!m || !m.senderId) return
    const u = await getPfp(m.senderId)
    if (!u) return
    const im = new Image()
    im.onload = () => { el.textContent = ''; el.style.backgroundImage = 'url("' + u + '")'; el.style.backgroundSize = 'cover'; el.style.backgroundPosition = 'center' }
    im.src = u
  })
}
new MutationObserver(applyAvatars).observe(messagesEl, { childList: true, subtree: true })
setTimeout(applyAvatars, 700)

function addPreview(body) {
  const a = body.querySelector('a[href^="http"]')
  if (!a || body.dataset.pv) return
  body.dataset.pv = '1'
  const url = a.href
  const cache = window.__pv = window.__pv || {}
  const show = d => {
    if (!d || !d.title) return
    const card = document.createElement('a')
    card.href = url; card.target = '_blank'; card.rel = 'noopener'
    card.style.cssText = 'display:block;margin-top:6px;background:rgba(0,0,0,.25);border-radius:8px;overflow:hidden;text-decoration:none;color:#e9edef'
    if (d.image) { const im = document.createElement('img'); im.src = d.image; im.style.cssText = 'width:100%;max-height:150px;object-fit:cover;display:block'; im.onerror = () => im.remove(); card.appendChild(im) }
    const t = document.createElement('div')
    t.style.cssText = 'padding:8px 10px;font-size:13px'
    const h = document.createElement('div'); h.textContent = d.title; h.style.fontWeight = '600'; t.appendChild(h)
    if (d.desc) { const p = document.createElement('div'); p.textContent = d.desc; p.style.cssText = 'color:#8696a0;margin-top:2px;max-height:34px;overflow:hidden'; t.appendChild(p) }
    card.appendChild(t)
    body.appendChild(card)
  }
  if (cache[url] !== undefined) return show(cache[url])
  fetch('/api/preview?url=' + encodeURIComponent(url)).then(r => r.json()).then(d => { cache[url] = d; show(d) }).catch(() => {})
}

;(function () {
  const img = document.getElementById('lightbox-img')
  if (!img) return
  let s = 1, tx = 0, ty = 0, sx = 0, sy = 0, d0 = 0, s0 = 1, last = 0
  const apply = () => { img.style.transition = 'none'; img.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + s + ')' }
  const reset = () => { s = 1; tx = 0; ty = 0; img.style.transition = 'transform .2s'; img.style.transform = '' }
  const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
  img.addEventListener('touchstart', e => {
    if (e.touches.length === 2) { d0 = dist(e.touches); s0 = s }
    else if (e.touches.length === 1) {
      sx = e.touches[0].clientX - tx; sy = e.touches[0].clientY - ty
      const n = Date.now()
      if (n - last < 300) { if (s > 1) reset(); else { s = 2.5; tx = 0; ty = 0; apply() } }
      last = n
    }
  }, { passive: true })
  img.addEventListener('touchmove', e => {
    if (e.touches.length === 2) { s = Math.min(6, Math.max(1, s0 * dist(e.touches) / d0)); apply(); e.preventDefault() }
    else if (e.touches.length === 1 && s > 1) { tx = e.touches[0].clientX - sx; ty = e.touches[0].clientY - sy; apply(); e.preventDefault() }
  }, { passive: false })
  const __cl = closeLightbox
  closeLightbox = function () { reset(); __cl() }
})()

// ===== Interfaz de grupos: rachas, admins, menciones, nombres y eventos =====
if (!chatId.endsWith('@g.us')) document.body.classList.add('dm')

function waTyping(c, act) {
  const base = act.state === 'recording' ? 'grabando audio…' : 'escribiendo…'
  if (!c.endsWith('@g.us')) return base
  const g = window.__gpv
  const d = digitsOf(act.jid)
  const p = g && g.participants.find(x => digitsOf(x.id) === d || digitsOf(x.phone) === d)
  const nm = p ? (p.name || fmtPhone(digitsOf(p.phone))) : ''
  return (nm ? nm + ' ' : '') + base
}

function waGroupRuns() {
  if (!chatId.endsWith('@g.us')) return
  const kids = [...messagesEl.children]
  let prev = null
  kids.forEach(el => {
    if (!el.classList || !el.classList.contains('msg-wrap') || el.classList.contains('sent')) { prev = null; return }
    const b = el.querySelector('.bubble')
    const m = b && b._m
    if (!m) { prev = null; return }
    const sid = m.senderId || m.senderName
    const cont = prev && prev.sid === sid && Math.abs(m.timestamp - prev.ts) < 5 * 60e3
    el.classList.toggle('cont', !!cont)
    el._sid = sid
    prev = { sid, ts: m.timestamp }
  })
  kids.forEach((el, i) => {
    if (!el.classList || !el.classList.contains('msg-wrap') || el.classList.contains('sent')) return
    const nx = kids[i + 1]
    const same = nx && nx.classList && nx.classList.contains('msg-wrap') && nx.classList.contains('cont') && nx._sid === el._sid
    el.classList.toggle('noav', !!same)
  })
}

function waMention(root, byDigits) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes = []
  while (w.nextNode()) nodes.push(w.currentNode)
  nodes.forEach(n => {
    if (!/@\d{6,}/.test(n.nodeValue) || (n.parentNode.closest && n.parentNode.closest('a'))) return
    const f = document.createDocumentFragment()
    n.nodeValue.split(/(@\d{6,})/).forEach((part, i) => {
      if (i % 2) {
        const d = part.slice(1)
        const p = byDigits[d]
        const label = p ? (p.name || fmtPhone(digitsOf(p.phone))) : fmtPhone((window.__pnmap && window.__pnmap[d]) || d)
        const s = document.createElement('span')
        s.className = 'mention'
        s.textContent = '@' + label
        f.appendChild(s)
      } else f.appendChild(document.createTextNode(part))
    })
    n.parentNode.replaceChild(f, n)
  })
}

async function waDecorate() {
  if (!chatId.endsWith('@g.us')) return
  const g = await groupOnce()
  window.__gpv = g
  const mem = g ? g.participants : []
  const byDigits = {}
  mem.forEach(p => { byDigits[digitsOf(p.id)] = p; byDigits[digitsOf(p.phone)] = p })
  messagesEl.querySelectorAll('.msg-wrap').forEach(el => {
    const b = el.querySelector('.bubble')
    const m = b && b._m
    if (!m) return
    const meta = el.querySelector('.msg-meta')
    if (meta && !meta.dataset.adm) {
      meta.dataset.adm = '1'
      const p = byDigits[digitsOf(m.senderId)]
      if (p && p.admin) { const t = document.createElement('span'); t.className = 'adm-tag'; t.textContent = p.admin === 'superadmin' ? 'Creador' : 'Admin'; meta.appendChild(t) }
    }
    const body = el.querySelector('.msg-body')
    if (body && !body.dataset.mn) { body.dataset.mn = '1'; waMention(body, byDigits) }
  })
}

;(function () {
  let raf = 0
  const run = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { waGroupRuns(); waDecorate() }) }
  new MutationObserver(run).observe(messagesEl, { childList: true })
  setTimeout(run, 800)
  groupOnce().then(g => {
    if (!g) return
    window.__gpv = g
    const names = g.participants.map(p => p.isMe ? 'Tú' : (p.name || fmtPhone(digitsOf(p.phone))))
      .sort((a, b) => a === 'Tú' ? 1 : b === 'Tú' ? -1 : a.localeCompare(b))
    window.__def = names.join(', ')
    const el = document.getElementById('chatStatus')
    if (el && (/participantes$/.test(el.textContent) || el.textContent === 'WhatsApp')) el.textContent = window.__def
  })
})()
