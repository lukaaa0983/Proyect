const UI = {

  formatTime(ts) {
    const date = new Date(ts)
    const now  = new Date()
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    if (date.toDateString() === now.toDateString())
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    if (date.toDateString() === yesterday.toDateString()) return 'Ayer'
    return date.toLocaleDateString([], { day: '2-digit', month: '2-digit' })
  },

  formatAudioTime(s) {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  },

  getDateLabel(ts) {
    const date = new Date(ts)
    const now  = new Date()
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    if (date.toDateString() === now.toDateString()) return 'Hoy'
    if (date.toDateString() === yesterday.toDateString()) return 'Ayer'
    return date.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })
  },

  buildAudioPlayer(src) {
    const audio = new Audio(src)
    const id    = 'audio_' + Date.now()
    const div   = document.createElement('div')
    div.className = 'audio-player'
    div.innerHTML = `
      <button class="audio-play-btn" id="btn_${id}">▶</button>
      <div class="audio-info">
        <div class="audio-bar" id="bar_${id}">
          <div class="audio-bar-fill" id="fill_${id}"></div>
        </div>
        <div class="audio-duration" id="dur_${id}">0:00</div>
      </div>
    `
    const btn  = div.querySelector(`#btn_${id}`)
    const fill = div.querySelector(`#fill_${id}`)
    const dur  = div.querySelector(`#dur_${id}`)
    const bar  = div.querySelector(`#bar_${id}`)
    let playing = false

    btn.onclick = () => {
      if (playing) { audio.pause(); btn.textContent = '▶'; playing = false }
      else         { audio.play();  btn.textContent = '⏸'; playing = true }
    }
    audio.ontimeupdate = () => {
      const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0
      fill.style.width = pct + '%'
      dur.textContent  = UI.formatAudioTime(audio.currentTime)
    }
    audio.onended = () => { btn.textContent = '▶'; playing = false; fill.style.width = '0%' }
    audio.onloadedmetadata = () => { dur.textContent = UI.formatAudioTime(audio.duration) }
    bar.onclick = (e) => {
      const rect = bar.getBoundingClientRect()
      if (audio.duration) audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration
    }
    return div
  },

  // ── Etiqueta según tipo de viewOnce ──
  viewOnceLabel(type) {
    if (type === 'video') return 'Video'
    if (type === 'audio') return 'Audio'
    return 'Foto'
  },

  buildMediaElement(msg, onLightbox) {
    const wrap = document.createElement('div')

    // ── Ver una vez ──
    if (msg.isViewOnce) {
      const label    = UI.viewOnceLabel(msg.type)
      const hasMedia = !!msg.mediaUrl
      const isAudio  = msg.type === 'audio'

      wrap.className  = 'viewonce-bubble'
      wrap.dataset.viewonceId = msg.waMessageKey?.id || ''

      if (hasMedia) {
        // Ya tenemos la media — mostrar disponible
        wrap.innerHTML = `
          <div class="viewonce-icon" style="border-color:var(--gold)">🕐</div>
          <div class="viewonce-info">
            <div class="viewonce-label">${label}</div>
            <div class="viewonce-sub" style="color:var(--gold)">Toca para ver</div>
          </div>
        `
        if (isAudio) {
          // Audio viewOnce — mostrar player directo
          wrap.innerHTML = ''
          wrap.style.cssText = 'display:flex;flex-direction:column;gap:6px'
          const tag = document.createElement('div')
          tag.style.cssText = 'font-size:11px;color:var(--gold);display:flex;align-items:center;gap:4px'
          tag.innerHTML = '🕐 Audio · Ver una vez'
          wrap.appendChild(tag)
          wrap.appendChild(UI.buildAudioPlayer(msg.mediaUrl))
        } else {
          wrap.onclick = () => onLightbox(msg)
        }
      } else {
        // Sin media aún — esperando
        wrap.innerHTML = `
          <div class="viewonce-icon" style="border-color:#666;opacity:0.6">🕐</div>
          <div class="viewonce-info">
            <div class="viewonce-label" style="color:var(--text-dim)">${label}</div>
            <div class="viewonce-sub" style="color:var(--text-dim);font-style:italic">Ver una vez (esperando...)</div>
          </div>
        `
      }
      return wrap
    }

    if (msg.type === 'image' && msg.mediaUrl) {
      const img = document.createElement('img')
      img.className = 'msg-img'
      img.src = msg.mediaUrl
      img.loading = 'lazy'
      img.onclick = () => onLightbox(msg)
      wrap.appendChild(img)
      if (msg.content) {
        const cap = document.createElement('div')
        cap.style.marginTop = '6px'
        cap.textContent = msg.content
        wrap.appendChild(cap)
      }
      return wrap
    }

    if (msg.type === 'audio' && msg.mediaUrl) {
      wrap.appendChild(UI.buildAudioPlayer(msg.mediaUrl))
      return wrap
    }

    if (msg.type === 'video' && msg.mediaUrl) {
      const vid = document.createElement('video')
      vid.className = 'msg-video'
      vid.src = msg.mediaUrl
      vid.controls = true
      wrap.appendChild(vid)
      return wrap
    }

    if (msg.type === 'document' && msg.mediaUrl) {
      const a = document.createElement('a')
      a.className = 'multimedia-tag'
      a.href = msg.mediaUrl
      a.download = msg.fileName || 'archivo'
      a.innerHTML = `📄 ${msg.fileName || 'Documento'}`
      wrap.appendChild(a)
      return wrap
    }

    if (msg.type === 'sticker' && msg.mediaUrl) {
      const img = document.createElement('img')
      img.src = msg.mediaUrl
      img.style.cssText = 'max-width:120px;background:transparent;border:none'
      wrap.appendChild(img)
      return wrap
    }

    const t = document.createElement('div')
    t.textContent = msg.originalContent || msg.content || ''
    wrap.appendChild(t)
    return wrap
  }
}
