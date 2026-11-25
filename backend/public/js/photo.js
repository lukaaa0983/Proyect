// Cámara + editor de fotos estilo WhatsApp (recortar/girar, stickers, texto, dibujo, HD, ver una vez, comentario)
;(function () {
  'use strict'
  if (typeof chatId === 'undefined') return
  const $ = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e }
  const SV = (p, w, x) => '<svg viewBox="0 0 24 24" width="' + (w || 24) + '" height="' + (w || 24) + '" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" ' + (x || '') + '>' + p + '</svg>'
  const IC = {
    x: SV('<path d="M6 6l12 12M18 6L6 18"/>'),
    back: SV('<path d="M20 12H5M11 5l-7 7 7 7"/>'),
    dl: SV('<path d="M12 4v11M7.5 11l4.5 4.5 4.5-4.5M5 19.5h14"/>'),
    hd: '<svg viewBox="0 0 24 24" width="32" height="32"><rect x="2.5" y="5.5" width="19" height="13" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><text x="12" y="15.3" text-anchor="middle" font-size="8.6" font-weight="800" font-family="Arial,sans-serif" fill="currentColor">HD</text></svg>',
    crop: SV('<path d="M7 2.5v13.5a1 1 0 0 0 1 1h13.5M2.5 7H16a1 1 0 0 1 1 1v13.5"/><path d="M13 3.2a8 8 0 0 1 7.8 7.8M17.2 11.4l3.6-.4.4-3.6"/>'),
    sticker: SV('<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5V13l-7 7H6.5A2.5 2.5 0 0 1 4 17.5z"/><path d="M13 20v-4a3 3 0 0 1 3-3h4M9 9.5h.01M15 9.5h.01M8.8 13.2c1 1 2.3 1.3 3.4.9"/>'),
    aa: '<svg viewBox="0 0 24 24" width="30" height="30"><text x="12" y="17.5" text-anchor="middle" font-size="17" font-weight="500" font-family="Roboto,Arial,sans-serif" fill="currentColor">Aa</text></svg>',
    pen: SV('<path d="M4 20l1-4.3L16.7 4a2 2 0 0 1 2.8 2.8L7.8 18.5z"/><path d="M14.5 6.2l3.3 3.3"/>'),
    add: SV('<rect x="3" y="5" width="15" height="14" rx="2.5"/><path d="M3.5 16l4-4 3 3 3-3.5 4.5 5M7.7 9h.01M20 3v5M17.5 5.5h5"/>'),
    once: SV('<circle cx="12" cy="12" r="9.2" stroke-dasharray="2.6 2.8"/><path d="M10.4 9.8l2-1.4V16"/>', 30),
    send: '<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M3.4 20.4 21 12 3.4 3.6 3.4 10.2 15 12 3.4 13.8z"/></svg>',
    undo: SV('<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'),
    trash: SV('<path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13M10 11v5M14 11v5"/>', 28),
    bolt: SV('<path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z"/>'),
    flip: SV('<path d="M4 8.5a8 8 0 0 1 14-2.5M20 15.5A8 8 0 0 1 6 18"/><path d="M18.5 3v3.5H15M5.5 21v-3.5H9"/>', 26),
    check: SV('<path d="M5 12.5l4.5 4.5L19 7"/>', 26),
    gal: SV('<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3.5 16.5l4.5-4.5 3.5 3.5 3-3 6 5.5M8 9h.01"/>', 28),
    rot: SV('<path d="M4 9a8.5 8.5 0 0 1 15-2M20 4v4h-4M20 15a8.5 8.5 0 0 1-15 2M4 20v-4h4"/>', 24)
  }
  const COLORS = ['#ffffff', '#000000', '#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#00c7be', '#32ade6', '#5856d6', '#af52de', '#ff2d92', '#8e8e93']
  const EMO = {
    '😀': '😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 😉 😍 🥰 😘 😋 😜 🤪 😎 🤩 🥳 😏 😒 😔 😢 😭 😤 😡 🥺 😱 😴 🤔 🙄 😬 🤗 🤭 🤫 😈 👻 💀 🤡 💩 🤖',
    '👍': '👍 👎 👌 ✌️ 🤞 🤟 🤘 👏 🙌 🙏 💪 👀 👋 🤝 ☝️ 👉 👈 ✍️ 🖕 🫶 ❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💔 💕 💞 💯 🔥 ✨ ⭐ 💥 💫 🎉 🎊',
    '🐶': '🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐔 🐧 🐦 🦆 🦅 🦉 🐺 🐴 🦄 🐝 🦋 🐢 🐍 🐙 🐬 🐳 🦈 🌹 🌸 🌻 🌴 🍀',
    '🍕': '🍕 🍔 🍟 🌭 🌮 🍗 🍖 🍣 🍩 🍪 🎂 🍰 🍫 🍿 🍎 🍌 🍓 🍉 🍇 🥑 🍺 🍻 🥂 🍷 🍹 ☕ 🧉 🥤',
    '⚽': '⚽ 🏀 🏈 ⚾ 🎾 🏐 🎮 🎯 🎲 🎵 🎧 🎤 🎸 📸 📱 💻 🚗 🏍️ ✈️ 🚀 🏠 🌎 🌙 ☀️ ⛅ ⚡ 🌈 🎁 💰 🔔 📌 ❌ ✅ ❓ ❗ 🇺🇾 🇦🇷 🇧🇷'
  }
  const FONTS = ['Roboto,Arial,sans-serif', 'Georgia,serif', '"Courier New",monospace', '"Comic Sans MS",cursive']
  const MAXB = 4096, STD = { px: 1600, q: 0.75 }, HDQ = { px: 4096, q: 0.92 }

  const css = $('style'); css.id = 'pg-style'
  css.textContent = `
.pg,.pgc,.pgs,.pgt,.pgd{font-family:Roboto,system-ui,sans-serif;color:#fff;box-sizing:border-box}
.pg{position:fixed;left:0;right:0;top:0;height:100dvh;background:#000;z-index:2000;display:flex;flex-direction:column;touch-action:manipulation;user-select:none;-webkit-user-select:none}
.pg-top{display:flex;align-items:center;gap:6px;padding:calc(10px + env(safe-area-inset-top)) 12px 8px;flex-shrink:0}
.pg-b{width:min(46px,11.2vw);height:min(46px,11.2vw);border-radius:50%;background:#10161b;color:#fff;border:0;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;padding:0}
.pg-b:active{filter:brightness(1.6)}.pg-b.dim{color:#7d868c}.pg-b.on{color:#fff;background:#2b3640}
.pg-sp{flex:1}
.pg-stage{flex:1;position:relative;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden}
.pg-cv{touch-action:none;display:block}
.pg-trash{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);width:62px;height:62px;border-radius:50%;background:rgba(40,46,52,.92);display:none;align-items:center;justify-content:center;color:#fff}
.pg-trash.show{display:flex}.pg-trash.hot{background:#e5484d;transform:translateX(-50%) scale(1.2)}
.pg-bot{flex-shrink:0;background:#000;padding:0 8px calc(6px + env(safe-area-inset-bottom))}
.pg-th{display:flex;gap:8px;overflow-x:auto;padding:6px 6px 8px}
.pg-th canvas{width:54px;height:54px;border-radius:10px;object-fit:cover;border:2px solid transparent;flex-shrink:0;background:#111}.pg-th canvas.on{border-color:#21c063}
.pg-cap{display:flex;align-items:center;gap:6px;background:#11171b;border-radius:26px;padding:0 10px 0 12px;min-height:52px}
.pg-cap input{flex:1;min-width:0;background:transparent;border:0;outline:0;color:#e9edef;font-size:18px;padding:12px 4px;caret-color:#21c063}
.pg-cap input::placeholder{color:#a3adb3}
.pg-cap .ic{color:#e9edef;display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:50%;cursor:pointer;flex-shrink:0}
.pg-cap .ic.on{background:#21c063;color:#08130c}
.pg-foot{display:flex;align-items:center;justify-content:space-between;background:#0b1014;margin:8px -8px 0;padding:10px 14px 6px}
.pg-chip{background:#202a31;border-radius:20px;padding:9px 16px;font-size:16px;color:#e9edef;max-width:62vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pg-send{width:60px;height:60px;border-radius:50%;background:#21c063;color:#08130c;border:0;display:flex;align-items:center;justify-content:center;cursor:pointer}
.pg-send:disabled{opacity:.55}.pg-send:active{filter:brightness(.9)}
.pg-tools{display:none;flex-shrink:0;background:#000;padding:10px 14px calc(14px + env(safe-area-inset-bottom))}
.pg-pal{display:flex;gap:10px;overflow-x:auto;padding:6px 2px 10px}.pg-pal i{width:30px;height:30px;border-radius:50%;border:3px solid #333;flex-shrink:0;cursor:pointer}.pg-pal i.on{border-color:#fff;transform:scale(1.15)}
.pg-rng{display:flex;align-items:center;gap:12px;color:#aab3b9;font-size:14px}.pg-rng input{flex:1;accent-color:#21c063}
.pg.draw .pg-bot{display:none}.pg.draw .pg-tools{display:block}
.pgc{position:fixed;inset:0;z-index:2050;background:#000;display:flex;flex-direction:column}
.pgc-area{flex:1;position:relative;display:flex;align-items:center;justify-content:center;min-height:0;padding-top:env(safe-area-inset-top)}
.pgc-bar{flex-shrink:0;padding:8px 10px calc(10px + env(safe-area-inset-bottom));background:#0b1014}
.pgc-ra{display:flex;gap:8px;overflow-x:auto;padding:4px 2px 10px}.pgc-ra span{padding:8px 14px;border-radius:18px;background:#202a31;font-size:14px;white-space:nowrap;cursor:pointer}.pgc-ra span.on{background:#21c063;color:#08130c}
.pgc-act{display:flex;align-items:center;justify-content:space-between}
.pgc-act span{padding:10px 14px;font-size:16px;cursor:pointer}
.pgs{position:fixed;left:0;right:0;bottom:0;z-index:2100;background:#111b21;border-radius:22px 22px 0 0;height:52dvh;display:flex;flex-direction:column;padding-bottom:env(safe-area-inset-bottom);box-shadow:0 -8px 30px rgba(0,0,0,.6)}
.pgs-tabs{display:flex;border-bottom:1px solid #243038;padding:6px 6px 0;overflow-x:auto;flex-shrink:0}.pgs-tabs span{padding:10px 14px;font-size:22px;cursor:pointer;border-bottom:3px solid transparent;white-space:nowrap}.pgs-tabs span.on{border-color:#21c063}
.pgs-g{flex:1;overflow-y:auto;display:grid;grid-template-columns:repeat(7,1fr);padding:8px;font-size:30px;text-align:center;align-content:start}.pgs-g span{padding:8px 0;cursor:pointer}
.pgs-g.st{grid-template-columns:repeat(4,1fr);gap:8px}.pgs-g.st img{width:100%;aspect-ratio:1;object-fit:contain;cursor:pointer}
.pgs-n{padding:14px;color:#8696a0;font-size:14px;grid-column:1/-1;text-align:left}
.pgt{position:fixed;inset:0;z-index:2100;background:rgba(0,0,0,.88);display:flex;flex-direction:column}
.pgt-mid{flex:1;display:flex;align-items:center;justify-content:center;padding:0 18px;min-height:0}
.pgt textarea{width:100%;max-height:100%;background:transparent;border:0;outline:0;resize:none;text-align:center;font-weight:600;line-height:1.25;overflow:hidden;caret-color:#21c063}
.pgt-bt{padding:6px 14px calc(14px + env(safe-area-inset-bottom))}
.pgd{position:fixed;inset:0;z-index:2200;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:24px}
.pgd div.b{background:#1d2226;border-radius:24px;padding:24px 24px 12px;max-width:340px;width:100%}.pgd p{margin:0 0 14px;font-size:17px;line-height:1.4;color:#e9edef;white-space:pre-line}
.pgd .bt{display:flex;justify-content:flex-end;gap:22px}.pgd .bt span{color:#21c063;font-weight:500;font-size:16px;padding:10px 4px;cursor:pointer}
.pgm{position:fixed;left:50%;bottom:calc(150px + env(safe-area-inset-bottom));transform:translateX(-50%);background:rgba(32,42,49,.97);color:#e9edef;padding:10px 18px;border-radius:20px;font-size:14.5px;z-index:2300;max-width:86vw;text-align:center;pointer-events:none}
.pgcam{position:fixed;inset:0;z-index:1990;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Roboto,system-ui,sans-serif;color:#fff}
.pgcam video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#000}
.pgcam .top{position:absolute;left:0;right:0;top:0;padding:calc(12px + env(safe-area-inset-top)) 14px;display:flex;justify-content:space-between;z-index:2}
.pgcam .bot{position:absolute;left:0;right:0;bottom:0;padding:18px 28px calc(26px + env(safe-area-inset-bottom));display:flex;align-items:center;justify-content:space-between;z-index:2;background:linear-gradient(transparent,rgba(0,0,0,.55))}
.pgcam .sh{width:78px;height:78px;border-radius:50%;border:5px solid #fff;background:rgba(255,255,255,.2);cursor:pointer;padding:0}.pgcam .sh:active{background:#fff}
.pgcam .err{position:relative;z-index:3;text-align:center;padding:24px;max-width:340px}.pgcam .err p{font-size:16px;line-height:1.45;color:#e9edef}.pgcam .err .bt{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:12px}.pgcam .err .bt span{padding:11px 18px;border-radius:22px;background:#21c063;color:#08130c;font-weight:600;cursor:pointer}.pgcam .err .bt span.g{background:#2a3138;color:#fff}`
  document.head.appendChild(css)

  // ---------- utilidades ----------
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c }
  let toastT
  const toast = t => { document.querySelectorAll('.pgm').forEach(x => x.remove()); const m = $('div', 'pgm'); m.textContent = t; document.body.appendChild(m); clearTimeout(toastT); toastT = setTimeout(() => m.remove(), 2600) }
  const dlg = (msg, btns) => { const d = $('div', 'pgd', '<div class="b"><p></p><div class="bt"></div></div>'); d.querySelector('p').textContent = msg; btns.forEach(([l, f]) => { const s = $('span'); s.textContent = l; s.onclick = () => { d.remove(); f && f() }; d.querySelector('.bt').appendChild(s) }); document.body.appendChild(d) }
  const lum = c => { const n = parseInt(c.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 }
  const readURL = b => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(b) })
  const toBlob = (c, q) => new Promise((ok, no) => c.toBlob(b => b ? ok(b) : no(new Error('No se pudo generar la imagen')), 'image/jpeg', q))

  // Capas de navegación: el botón «atrás» de Android cierra la capa superior
  const layers = []
  let reuseEntry = false
  const pushLayer = fn => { layers.push(fn); if (reuseEntry) reuseEntry = false; else history.pushState({ pg: layers.length }, '') }
  const popLayer = () => { if (layers.length) history.back() }
  window.addEventListener('popstate', () => { const f = layers.pop(); if (f) f() })

  // ================= CÁMARA =================
  let cam = null
  function stopStream() { if (cam && cam.stream) { cam.stream.getTracks().forEach(t => t.stop()); cam.stream = null; cam.track = null } }
  function closeCamera() { if (!cam) return; stopStream(); cam.el.remove(); cam = null }
  function camLayer() { closeCamera() }
  function nativeFallback(why) {
    if (why) toast(why)
    const f = $('input'); f.type = 'file'; f.accept = 'image/*'; f.setAttribute('capture', 'environment')
    f.onchange = () => { if (f.files[0]) openEditor([f.files[0]]) }
    f.click()
  }
  async function openCamera() {
    if (cam || E.el) return
    if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)
      return nativeFallback('La cámara en vivo necesita https o localhost. Se usará la cámara del teléfono.')
    const el = $('div', 'pgcam', '<video autoplay playsinline muted></video><div class="top"><button class="pg-b" id="c_x">' + IC.x + '</button><button class="pg-b" id="c_f" style="display:none">' + IC.bolt + '</button></div><div class="bot"><button class="pg-b" id="c_g" style="background:rgba(0,0,0,.45)">' + IC.gal + '</button><button class="sh" id="c_s"></button><button class="pg-b" id="c_w" style="background:rgba(0,0,0,.45)">' + IC.flip + '</button></div>')
    document.body.appendChild(el)
    cam = { el, video: el.querySelector('video'), facing: 'environment', flash: false, stream: null, track: null }
    pushLayer(camLayer)
    const q = s => el.querySelector(s)
    q('#c_x').onclick = popLayer
    q('#c_g').onclick = () => { popLayer(); pickGallery() }
    q('#c_w').onclick = () => { cam.facing = cam.facing === 'user' ? 'environment' : 'user'; cam.flash = false; startCam() }
    q('#c_f').onclick = async () => {
      if (!cam.track) return
      try { await cam.track.applyConstraints({ advanced: [{ torch: !cam.flash }] }); cam.flash = !cam.flash; q('#c_f').style.background = cam.flash ? '#f5c518' : ''; q('#c_f').style.color = cam.flash ? '#000' : '' } catch { toast('Este dispositivo no permite usar el flash') }
    }
    q('#c_s').onclick = shoot
    startCam()
  }
  async function startCam() {
    if (!cam) return
    stopStream()
    const el = cam.el
    el.querySelectorAll('.err').forEach(x => x.remove())
    try {
      cam.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: cam.facing }, width: { ideal: 2560 }, height: { ideal: 1440 } }, audio: false })
    } catch (e) {
      const m = { NotAllowedError: 'No hay permiso para usar la cámara. Actívalo en los ajustes del navegador (icono del candado) y vuelve a intentarlo.', NotFoundError: 'No se encontró ninguna cámara en este dispositivo.', NotReadableError: 'La cámara está siendo usada por otra aplicación. Ciérrala e inténtalo de nuevo.', OverconstrainedError: 'La cámara no admite esa configuración.' }[e && e.name] || ('No se pudo abrir la cámara' + (e && e.message ? ': ' + e.message : ''))
      const er = $('div', 'err', '<p></p><div class="bt"><span id="r1">Reintentar</span><span class="g" id="r2">Galería</span><span class="g" id="r3">Cerrar</span></div>')
      er.querySelector('p').textContent = m
      er.querySelector('#r1').onclick = startCam
      er.querySelector('#r2').onclick = () => { popLayer(); pickGallery() }
      er.querySelector('#r3').onclick = popLayer
      el.appendChild(er); return
    }
    cam.track = cam.stream.getVideoTracks()[0]
    const v = cam.video
    v.srcObject = cam.stream
    v.style.transform = (cam.track.getSettings && cam.track.getSettings().facingMode === 'user') || cam.facing === 'user' ? 'scaleX(-1)' : ''
    try { await v.play() } catch {}
    const caps = (cam.track.getCapabilities && cam.track.getCapabilities()) || {}
    el.querySelector('#c_f').style.display = caps.torch ? 'flex' : 'none'
    try { const n = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput').length; el.querySelector('#c_w').style.visibility = n > 1 ? 'visible' : 'hidden' } catch {}
  }
  function shoot() {
    if (!cam || !cam.stream) return
    const v = cam.video
    if (!v.videoWidth || v.readyState < 2) return toast('La cámara aún no está lista')
    const c = mk(v.videoWidth, v.videoHeight), x = c.getContext('2d')
    x.drawImage(v, 0, 0, c.width, c.height)
    // Detecta imagen negra (cámara fallida) en vez de enviarla como foto válida
    const sm = mk(32, 32), sx = sm.getContext('2d'); sx.drawImage(c, 0, 0, 32, 32)
    const s = sx.getImageData(0, 0, 32, 32)
    let max = 0; for (let i = 0; i < s.data.length; i += 4) max = Math.max(max, s.data[i], s.data[i + 1], s.data[i + 2])
    if (max < 8) return toast('La cámara devolvió una imagen negra. Prueba a cambiar de cámara o reiniciarla.')
    const name = 'camara_' + Date.now() + '.jpg'
    const li = layers.indexOf(camLayer); if (li >= 0) { layers.splice(li, 1); reuseEntry = true }
    closeCamera()
    openEditorPages([newPage(c, name)])
  }
  document.addEventListener('visibilitychange', () => { if (!cam) return; if (document.hidden) stopStream(); else startCam() })
  window.addEventListener('pagehide', stopStream)

  function pickGallery() {
    const i = document.getElementById('imgInput')
    i.accept = 'image/*'; i.click()
  }

  // ================= EDITOR =================
  const E = { el: null, pages: [], i: 0, hd: false, once: false, mode: '', sel: null, busy: false, color: '#ffffff', width: 6, ks: 1, dpr: 1, cv: null, prev: null }
  const cur = () => E.pages[E.i]
  const minSide = p => Math.min(p.base.width, p.base.height)

  function newPage(src, name) {
    const w = src.width || src.naturalWidth, h = src.height || src.naturalHeight
    const k = Math.min(1, MAXB / Math.max(w, h))
    const c = mk(w * k, h * k), x = c.getContext('2d')
    x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height)
    x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, c.width, c.height)
    if (src.close) src.close()
    return { name, base: c, strokes: [], items: [], caption: '', edited: false }
  }
  async function pageFromFile(f) {
    let b
    try { b = await createImageBitmap(f, { imageOrientation: 'from-image' }) }
    catch { b = await new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = URL.createObjectURL(f) }) }
    return newPage(b, f.name)
  }
  async function openEditor(files) {
    toast('Abriendo foto…')
    const pages = []
    for (const f of files) { try { pages.push(await pageFromFile(f)) } catch { toast('No se pudo leer «' + f.name + '». Prueba con JPG o PNG.') } }
    if (pages.length) openEditorPages(pages)
  }

  // ---- dibujo de capas (compartido por vista y exportación) ----
  const MC = mk(2, 2).getContext('2d')
  const fontOf = it => (it.style === 2 ? 'bold ' : '600 ') + it.size + 'px ' + FONTS[it.font || 0]
  function metrics(it) {
    if (it.kind === 'img') { it.w = it.iw; it.h = it.ih; return }
    if (it.kind === 'emoji') { it.w = it.h = it.size * 1.3; return }
    MC.font = fontOf(it)
    it.lines = it.text.split('\n')
    let mw = 0; it.lines.forEach(l => { mw = Math.max(mw, MC.measureText(l).width) })
    it.pad = it.style === 1 ? it.size * 0.35 : 0
    it.w = mw + it.pad * 2; it.h = it.lines.length * it.size * 1.25 + it.pad * 2
  }
  function rr(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath() }
  function drawItem(x, it, k) {
    x.save(); x.translate(it.x * k, it.y * k); x.rotate(it.rot); x.scale(it.scale * k, it.scale * k)
    if (it.kind === 'img') x.drawImage(it.img, -it.w / 2, -it.h / 2, it.w, it.h)
    else if (it.kind === 'emoji') { x.font = it.size + 'px "Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(it.text, 0, it.size * 0.05) }
    else {
      x.font = fontOf(it); x.textAlign = 'center'; x.textBaseline = 'middle'
      let tc = it.color
      if (it.style === 1) { x.fillStyle = it.color; rr(x, -it.w / 2, -it.h / 2, it.w, it.h, it.size * 0.3); x.fill(); tc = lum(it.color) > 0.6 ? '#000' : '#fff' }
      const lh = it.size * 1.25
      it.lines.forEach((l, i) => {
        const y = -it.h / 2 + it.pad + lh * (i + 0.5)
        if (it.style === 2) { x.lineWidth = it.size * 0.2; x.lineJoin = 'round'; x.strokeStyle = lum(it.color) > 0.5 ? '#000' : '#fff'; x.strokeText(l, 0, y) }
        else if (it.style === 0) { x.shadowColor = 'rgba(0,0,0,.45)'; x.shadowBlur = it.size * 0.12 }
        x.fillStyle = tc; x.fillText(l, 0, y); x.shadowBlur = 0
      })
    }
    x.restore()
  }
  function drawStroke(x, s, k) {
    const p = s.pts
    x.strokeStyle = x.fillStyle = s.color; x.lineWidth = s.w * k; x.lineCap = x.lineJoin = 'round'
    x.beginPath()
    if (p.length === 1) { x.arc(p[0][0] * k, p[0][1] * k, s.w * k / 2, 0, 7); x.fill(); return }
    x.moveTo(p[0][0] * k, p[0][1] * k)
    for (let i = 1; i < p.length - 1; i++) x.quadraticCurveTo(p[i][0] * k, p[i][1] * k, (p[i][0] + p[i + 1][0]) / 2 * k, (p[i][1] + p[i + 1][1]) / 2 * k)
    x.lineTo(p[p.length - 1][0] * k, p[p.length - 1][1] * k); x.stroke()
  }
  function paint(x, p, k) { p.strokes.forEach(s => drawStroke(x, s, k)); p.items.forEach(it => drawItem(x, it, k)) }

  // ---- vista ----
  function layout() {
    if (!E.el) return
    const p = cur(), st = E.stage.getBoundingClientRect()
    if (!st.width || !st.height) return
    const ks = Math.min(st.width / p.base.width, st.height / p.base.height)
    E.dpr = Math.min(window.devicePixelRatio || 1, 2); E.ks = ks
    const cw = Math.floor(p.base.width * ks), ch = Math.floor(p.base.height * ks)
    E.cv.style.width = cw + 'px'; E.cv.style.height = ch + 'px'
    E.cv.width = Math.round(cw * E.dpr); E.cv.height = Math.round(ch * E.dpr)
    E.prev = mk(E.cv.width, E.cv.height)
    const x = E.prev.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(p.base, 0, 0, E.prev.width, E.prev.height)
    redraw()
  }
  let raf = 0
  function redraw() { cancelAnimationFrame(raf); raf = requestAnimationFrame(doDraw) }
  function doDraw() {
    if (!E.el || !E.prev) return
    const p = cur(), x = E.cv.getContext('2d'), k = E.ks * E.dpr
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, E.cv.width, E.cv.height); x.drawImage(E.prev, 0, 0)
    paint(x, p, k)
    if (E.sel && E.mode !== 'draw' && p.items.includes(E.sel)) {
      const it = E.sel, m = 10
      x.save(); x.translate(it.x * k, it.y * k); x.rotate(it.rot); x.scale(it.scale * k, it.scale * k)
      x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = 2 / (it.scale * k); x.setLineDash([8 / (it.scale * k), 6 / (it.scale * k)])
      x.strokeRect(-it.w / 2 - m, -it.h / 2 - m, it.w + 2 * m, it.h + 2 * m); x.restore()
    }
  }
  const toBase = e => { const r = E.cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / E.ks, y: (e.clientY - r.top) / E.ks } }
  function hit(p, x, y) {
    const m = 14 / E.ks
    for (let i = p.items.length - 1; i >= 0; i--) {
      const it = p.items[i], dx = x - it.x, dy = y - it.y, c = Math.cos(-it.rot), s = Math.sin(-it.rot)
      const lx = (dx * c - dy * s) / it.scale, ly = (dx * s + dy * c) / it.scale
      if (Math.abs(lx) <= it.w / 2 + m && Math.abs(ly) <= it.h / 2 + m) return it
    }
    return null
  }
  function addItem(it) {
    const p = cur(); it.x = p.base.width / 2; it.y = p.base.height / 2; it.rot = 0; it.scale = 1
    metrics(it); p.items.push(it); p.edited = true; E.sel = it; redraw()
  }

  // ---- renderizado final ----
  async function exportPage(p, hd) {
    const q = hd ? HDQ : STD, k = Math.min(1, q.px / Math.max(p.base.width, p.base.height))
    const c = mk(p.base.width * k, p.base.height * k), x = c.getContext('2d')
    x.imageSmoothingQuality = 'high'; x.drawImage(p.base, 0, 0, c.width, c.height); paint(x, p, k)
    return toBlob(c, q.q)
  }
  function thumbOf(p) {
    const k = 108 / Math.max(p.base.width, p.base.height), c = mk(p.base.width * k, p.base.height * k), x = c.getContext('2d')
    x.drawImage(p.base, 0, 0, c.width, c.height); paint(x, p, k); return c
  }
  function renderThumbs() {
    const t = E.el.querySelector('.pg-th'); t.innerHTML = ''
    t.style.display = E.pages.length > 1 ? 'flex' : 'none'
    E.pages.forEach((p, n) => { const c = thumbOf(p); c.style.width = c.style.height = '54px'; if (n === E.i) c.className = 'on'; c.onclick = () => select(n); t.appendChild(c) })
  }
  function select(n) {
    if (E.cap) cur().caption = E.cap.value
    E.i = n; E.sel = null; E.cap.value = cur().caption || ''
    renderThumbs(); layout()
  }

  function openEditorPages(pages) {
    if (E.el) { const first = E.pages.length; E.pages.push(...pages); select(first); return }
    const msgIn = document.getElementById('msgInput')
    if (msgIn && msgIn.value.trim()) pages[0].caption = msgIn.value.trim()
    Object.assign(E, { pages, i: 0, mode: '', sel: null, busy: false, hd: false, once: false })
    const who = (document.getElementById('chatName') || {}).textContent || ''
    const el = $('div', 'pg',
      '<div class="pg-top"><button class="pg-b" id="e_x">' + IC.x + '</button><div class="pg-sp"></div>' +
      '<button class="pg-b" id="e_dl">' + IC.dl + '</button><button class="pg-b dim" id="e_hd">' + IC.hd + '</button>' +
      '<button class="pg-b" id="e_cr">' + IC.crop + '</button><button class="pg-b" id="e_st">' + IC.sticker + '</button>' +
      '<button class="pg-b" id="e_tx">' + IC.aa + '</button><button class="pg-b" id="e_dw">' + IC.pen + '</button></div>' +
      '<div class="pg-stage"><canvas class="pg-cv"></canvas><div class="pg-trash">' + IC.trash + '</div></div>' +
      '<div class="pg-tools"><div class="pg-pal"></div><div class="pg-rng"><span>Grosor</span><input type="range" min="2" max="30" value="6"></div></div>' +
      '<div class="pg-bot"><div class="pg-th"></div><div class="pg-cap"><span class="ic" id="e_add">' + IC.add + '</span><input id="e_cap" placeholder="Añade un comentario…" maxlength="1024" enterkeyhint="send" autocomplete="off"><span class="ic" id="e_once">' + IC.once + '</span></div>' +
      '<div class="pg-foot"><div class="pg-chip"></div><button class="pg-send" id="e_send">' + IC.send + '</button></div></div>')
    el.querySelector('.pg-chip').textContent = who
    document.body.appendChild(el)
    E.el = el; E.stage = el.querySelector('.pg-stage'); E.cv = el.querySelector('.pg-cv'); E.cap = el.querySelector('#e_cap'); E.cap.value = pages[0].caption
    const q = s => el.querySelector(s)
    pushLayer(() => closeEditor(true))
    q('#e_x').onclick = tryClose
    q('#e_dl').onclick = saveFile
    q('#e_hd').onclick = () => { E.hd = !E.hd; q('#e_hd').classList.toggle('dim', !E.hd); q('#e_hd').classList.toggle('on', E.hd); toast(E.hd ? 'Calidad HD activada (hasta 4096 px)' : 'Calidad estándar (1600 px)') }
    q('#e_cr').onclick = openCrop
    q('#e_st').onclick = openStickers
    q('#e_tx').onclick = () => openText(null)
    q('#e_dw').onclick = () => setDraw(true)
    q('#e_once').onclick = () => { E.once = !E.once; q('#e_once').classList.toggle('on', E.once); toast(E.once ? 'Se enviará para ver una sola vez' : 'Envío normal') }
    q('#e_add').onclick = () => { const f = $('input'); f.type = 'file'; f.accept = 'image/*'; f.multiple = true; f.onchange = () => f.files.length && openEditor([...f.files]); f.click() }
    q('#e_send').onclick = send
    E.cap.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); send() } })
    E.cap.addEventListener('input', () => { cur().caption = E.cap.value })
    // palette dibujo
    const pal = q('.pg-pal'); COLORS.forEach(c => { const i = $('i'); i.style.background = c; if (c === E.color) i.className = 'on'; i.onclick = () => { E.color = c; pal.querySelectorAll('i').forEach(z => z.className = ''); i.className = 'on' }; pal.appendChild(i) })
    q('.pg-tools input').oninput = e => { E.width = +e.target.value }
    bindPointers()
    // teclado virtual: ajusta la altura al área visible
    const vv = window.visualViewport
    E.vvf = () => { if (!E.el) return; if (vv) { E.el.style.height = vv.height + 'px'; E.el.style.top = vv.offsetTop + 'px' } layout() }
    if (vv) { vv.addEventListener('resize', E.vvf); vv.addEventListener('scroll', E.vvf) }
    window.addEventListener('resize', E.vvf); window.addEventListener('orientationchange', E.vvf)
    renderThumbs(); requestAnimationFrame(() => { E.vvf() })
  }
  function hasEdits() { return E.pages.some(p => p.edited) }
  function tryClose() {
    if (E.busy) return
    if (hasEdits()) dlg('¿Descartar los cambios y salir del editor?', [['Cancelar'], ['Descartar', popLayer]])
    else popLayer()
  }
  function closeEditor(fromPop) {
    if (!E.el) return
    const vv = window.visualViewport
    if (vv && E.vvf) { vv.removeEventListener('resize', E.vvf); vv.removeEventListener('scroll', E.vvf) }
    window.removeEventListener('resize', E.vvf); window.removeEventListener('orientationchange', E.vvf)
    cancelAnimationFrame(raf)
    E.el.remove(); E.el = null; E.pages = []; E.prev = null; E.sel = null; E.mode = ''
    document.querySelectorAll('.pgc,.pgs,.pgt').forEach(x => x.remove())
  }
  async function saveFile() {
    try {
      cur().caption = E.cap.value
      const b = await exportPage(cur(), E.hd), a = $('a')
      a.href = URL.createObjectURL(b); a.download = 'foto_' + Date.now() + '.jpg'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000)
      toast('Imagen guardada en Descargas')
    } catch { toast('No se pudo guardar la imagen') }
  }

  // ---- gestos ----
  function setDraw(on) {
    E.mode = on ? 'draw' : ''; E.sel = null
    E.el.classList.toggle('draw', on)
    const top = E.el.querySelector('.pg-top')
    if (on) {
      top.dataset.html = top.innerHTML
      top.innerHTML = '<button class="pg-b" id="d_ok">' + IC.check + '</button><div class="pg-sp"></div><button class="pg-b" id="d_clr">' + IC.trash + '</button><button class="pg-b" id="d_un">' + IC.undo + '</button>'
      top.querySelector('#d_ok').onclick = () => setDraw(false)
      top.querySelector('#d_un').onclick = () => { const s = cur().strokes; s.pop(); redraw() }
      top.querySelector('#d_clr').onclick = () => { if (cur().strokes.length) dlg('¿Borrar todos los trazos?', [['Cancelar'], ['Borrar', () => { cur().strokes = []; redraw() }]]) }
    } else {
      top.innerHTML = top.dataset.html
      const q = s => top.querySelector(s)
      q('#e_x').onclick = tryClose; q('#e_dl').onclick = saveFile
      q('#e_hd').onclick = () => { E.hd = !E.hd; q('#e_hd').classList.toggle('dim', !E.hd); q('#e_hd').classList.toggle('on', E.hd); toast(E.hd ? 'Calidad HD activada (hasta 4096 px)' : 'Calidad estándar (1600 px)') }
      q('#e_cr').onclick = openCrop; q('#e_st').onclick = openStickers; q('#e_tx').onclick = () => openText(null); q('#e_dw').onclick = () => setDraw(true)
      q('#e_hd').classList.toggle('dim', !E.hd); q('#e_hd').classList.toggle('on', E.hd)
    }
    redraw(); setTimeout(layout, 30)
  }
  function bindPointers() {
    const cv = E.cv, ptrs = new Map()
    let mv = null, pin = null, stroke = null
    const trash = () => E.el.querySelector('.pg-trash')
    const overTrash = (cx, cy) => { const r = trash().getBoundingClientRect(); return cx >= r.left - 12 && cx <= r.right + 12 && cy >= r.top - 12 && cy <= r.bottom + 12 }
    const dist = () => { const [a, b] = [...ptrs.values()]; return Math.hypot(a.x - b.x, a.y - b.y) }
    const ang = () => { const [a, b] = [...ptrs.values()]; return Math.atan2(b.y - a.y, b.x - a.x) }
    cv.addEventListener('pointerdown', e => {
      cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY })
      const p = cur(), b = toBase(e)
      if (E.mode === 'draw') {
        if (ptrs.size === 1) { stroke = { color: E.color, w: E.width * minSide(p) / 300, pts: [[b.x, b.y]] }; p.strokes.push(stroke); p.edited = true; redraw() }
        return
      }
      if (ptrs.size === 1) {
        const h = hit(p, b.x, b.y); E.sel = h
        if (h) { p.items.splice(p.items.indexOf(h), 1); p.items.push(h); mv = { it: h, ox: b.x - h.x, oy: b.y - h.y, sx: e.clientX, sy: e.clientY, t: Date.now(), moved: false } } else mv = null
      } else if (ptrs.size === 2 && E.sel) { pin = { d: dist(), a: ang(), s: E.sel.scale, r: E.sel.rot }; mv = null }
      redraw()
    })
    cv.addEventListener('pointermove', e => {
      if (!ptrs.has(e.pointerId)) return
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY })
      const p = cur()
      if (E.mode === 'draw') { if (stroke && ptrs.size === 1) { const b = toBase(e); stroke.pts.push([b.x, b.y]); redraw() } return }
      if (pin && ptrs.size === 2 && E.sel) { E.sel.scale = Math.max(0.15, Math.min(10, pin.s * dist() / pin.d)); E.sel.rot = pin.r + (ang() - pin.a); p.edited = true; redraw(); return }
      if (mv && ptrs.size === 1) {
        const b = toBase(e)
        if (!mv.moved && Math.hypot(e.clientX - mv.sx, e.clientY - mv.sy) > 6) { mv.moved = true; trash().classList.add('show') }
        if (mv.moved) { mv.it.x = b.x - mv.ox; mv.it.y = b.y - mv.oy; p.edited = true; trash().classList.toggle('hot', overTrash(e.clientX, e.clientY)); redraw() }
      }
    })
    const up = e => {
      if (!ptrs.has(e.pointerId)) return
      ptrs.delete(e.pointerId)
      const p = cur()
      if (E.mode === 'draw') { stroke = null; return }
      if (mv && ptrs.size === 0) {
        if (mv.moved && overTrash(e.clientX, e.clientY)) { p.items.splice(p.items.indexOf(mv.it), 1); E.sel = null }
        else if (!mv.moved && mv.it.kind === 'text' && Date.now() - mv.t < 450) openText(mv.it)
        mv = null; trash().classList.remove('show', 'hot'); redraw()
      }
      if (ptrs.size < 2) pin = null
    }
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up)
    cv.addEventListener('wheel', e => { if (!E.sel) return; e.preventDefault(); E.sel.scale = Math.max(0.15, Math.min(10, E.sel.scale * (e.deltaY < 0 ? 1.08 : 0.92))); cur().edited = true; redraw() }, { passive: false })
  }

  // ---- recortar y girar ----
  function openCrop() {
    if (E.mode || document.querySelector('.pgc')) return
    const p = cur(), B = p.base, pk = Math.min(1, 1400 / Math.max(B.width, B.height)), pv = mk(B.width * pk, B.height * pk)
    pv.getContext('2d').drawImage(B, 0, 0, pv.width, pv.height)
    const c = { rot: 0, rw: B.width, rh: B.height, rect: { x: 0, y: 0, w: B.width, h: B.height }, ratio: 0, f: 1, dw: 0, dh: 0 }
    const ov = $('div', 'pgc', '<div class="pgc-area"><canvas style="touch-action:none"></canvas></div><div class="pgc-bar"><div class="pgc-ra"></div><div class="pgc-act"><span id="k_c">Cancelar</span><button class="pg-b" id="k_r">' + IC.rot + '</button><span id="k_o" style="color:#21c063;font-weight:600">Hecho</span></div></div>')
    document.body.appendChild(ov)
    pushLayer(() => { ov.remove(); window.removeEventListener('resize', fit) })
    const cc = ov.querySelector('canvas'), area = ov.querySelector('.pgc-area'), ra = ov.querySelector('.pgc-ra')
    const RAT = [['Libre', 0], ['Original', -1], ['1:1', 1], ['4:3', 4 / 3], ['3:4', 3 / 4], ['16:9', 16 / 9], ['9:16', 9 / 16]]
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
    const fit = () => {
      const r = area.getBoundingClientRect(), f = Math.min((r.width - 40) / c.rw, (r.height - 40) / c.rh)
      c.f = f; c.dw = Math.floor(c.rw * f); c.dh = Math.floor(c.rh * f)
      const d = Math.min(window.devicePixelRatio || 1, 2)
      cc.style.width = c.dw + 'px'; cc.style.height = c.dh + 'px'; cc.width = c.dw * d; cc.height = c.dh * d; c.d = d; draw()
    }
    const draw = () => {
      const x = cc.getContext('2d'), d = c.d, R = c.rect, f = c.f
      x.setTransform(d, 0, 0, d, 0, 0); x.clearRect(0, 0, c.dw, c.dh)
      x.save(); x.translate(c.dw / 2, c.dh / 2); x.rotate(c.rot * Math.PI / 2)
      const s = c.rot % 2 ? c.dw / pv.height : c.dw / pv.width
      x.drawImage(pv, -pv.width * s / 2, -pv.height * s / 2, pv.width * s, pv.height * s); x.restore()
      const rx = R.x * f, ry = R.y * f, rw = R.w * f, rh = R.h * f
      x.fillStyle = 'rgba(0,0,0,.6)'; x.fillRect(0, 0, c.dw, ry); x.fillRect(0, ry + rh, c.dw, c.dh - ry - rh); x.fillRect(0, ry, rx, rh); x.fillRect(rx + rw, ry, c.dw - rx - rw, rh)
      x.strokeStyle = '#fff'; x.lineWidth = 1.5; x.strokeRect(rx, ry, rw, rh)
      x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 1; x.beginPath()
      for (let i = 1; i < 3; i++) { x.moveTo(rx + rw * i / 3, ry); x.lineTo(rx + rw * i / 3, ry + rh); x.moveTo(rx, ry + rh * i / 3); x.lineTo(rx + rw, ry + rh * i / 3) }
      x.stroke(); x.strokeStyle = '#fff'; x.lineWidth = 4; x.lineCap = 'square'; x.beginPath()
      const L = Math.min(22, rw / 3, rh / 3)
      ;[[rx, ry, 1, 1], [rx + rw, ry, -1, 1], [rx, ry + rh, 1, -1], [rx + rw, ry + rh, -1, -1]].forEach(([a, b, sx, sy]) => { x.moveTo(a + sx * L, b); x.lineTo(a, b); x.lineTo(a, b + sy * L) })
      if (!c.ratio) { x.moveTo(rx + rw / 2 - L / 2, ry); x.lineTo(rx + rw / 2 + L / 2, ry); x.moveTo(rx + rw / 2 - L / 2, ry + rh); x.lineTo(rx + rw / 2 + L / 2, ry + rh); x.moveTo(rx, ry + rh / 2 - L / 2); x.lineTo(rx, ry + rh / 2 + L / 2); x.moveTo(rx + rw, ry + rh / 2 - L / 2); x.lineTo(rx + rw, ry + rh / 2 + L / 2) }
      x.stroke()
    }
    const setRatio = r => {
      c.ratio = r; if (!r) return draw()
      const W = c.rw, H = c.rh, w = Math.min(W, H * r), h = w / r, R = c.rect
      c.rect = { x: clamp(R.x + R.w / 2 - w / 2, 0, W - w), y: clamp(R.y + R.h / 2 - h / 2, 0, H - h), w, h }; draw()
    }
    RAT.forEach(([l, r], n) => { const s = $('span', n === 0 ? 'on' : ''); s.textContent = l; s.onclick = () => { ra.querySelectorAll('span').forEach(z => z.className = ''); s.className = 'on'; setRatio(r === -1 ? c.rw / c.rh : r) }; ra.appendChild(s) })
    ov.querySelector('#k_r').onclick = () => {
      const R = c.rect, H = c.rh
      c.rect = { x: H - (R.y + R.h), y: R.x, w: R.h, h: R.w }; c.rot = (c.rot + 1) % 4
      const t = c.rw; c.rw = c.rh; c.rh = t; if (c.ratio) c.ratio = 1 / c.ratio; fit()
    }
    ov.querySelector('#k_c').onclick = popLayer
    ov.querySelector('#k_o').onclick = () => { commit(); popLayer() }
    // arrastre
    let drag = null
    const pos = e => { const r = cc.getBoundingClientRect(); return { x: (e.clientX - r.left) / c.f, y: (e.clientY - r.top) / c.f } }
    cc.addEventListener('pointerdown', e => {
      cc.setPointerCapture(e.pointerId)
      const q = pos(e), R = c.rect, tol = 30 / c.f
      const nl = Math.abs(q.x - R.x) < tol, nr = Math.abs(q.x - (R.x + R.w)) < tol, nt = Math.abs(q.y - R.y) < tol, nb = Math.abs(q.y - (R.y + R.h)) < tol
      const inX = q.x > R.x - tol && q.x < R.x + R.w + tol, inY = q.y > R.y - tol && q.y < R.y + R.h + tol
      let h = ''
      if ((nl || nr) && (nt || nb)) h = (nt ? 't' : 'b') + (nl ? 'l' : 'r')
      else if (!c.ratio && inY && (nl || nr)) h = nl ? 'l' : 'r'
      else if (!c.ratio && inX && (nt || nb)) h = nt ? 't' : 'b'
      else if (q.x > R.x && q.x < R.x + R.w && q.y > R.y && q.y < R.y + R.h) h = 'm'
      drag = h ? { h, q, R: { ...R } } : null
    })
    cc.addEventListener('pointermove', e => {
      if (!drag) return
      const q = pos(e), W = c.rw, H = c.rh, S = drag.R, MIN = Math.max(40, Math.min(W, H) * 0.05), dx = q.x - drag.q.x, dy = q.y - drag.q.y, h = drag.h
      if (h === 'm') { c.rect = { x: clamp(S.x + dx, 0, W - S.w), y: clamp(S.y + dy, 0, H - S.h), w: S.w, h: S.h }; return draw() }
      let x1 = S.x, y1 = S.y, x2 = S.x + S.w, y2 = S.y + S.h
      if (c.ratio && h.length === 2) {
        const ax = h.includes('l') ? x2 : x1, ay = h.includes('t') ? y2 : y1
        const maxW = h.includes('l') ? ax : W - ax, maxH = h.includes('t') ? ay : H - ay
        let nw = Math.abs(q.x - ax); nw = Math.max(MIN, Math.min(nw, maxW, maxH * c.ratio)); const nh = nw / c.ratio
        x1 = h.includes('l') ? ax - nw : ax; x2 = x1 + nw; y1 = h.includes('t') ? ay - nh : ay; y2 = y1 + nh
      } else {
        if (h.includes('l')) x1 = clamp(S.x + dx, 0, x2 - MIN)
        if (h.includes('r')) x2 = clamp(S.x + S.w + dx, x1 + MIN, W)
        if (h.includes('t')) y1 = clamp(S.y + dy, 0, y2 - MIN)
        if (h.includes('b')) y2 = clamp(S.y + S.h + dy, y1 + MIN, H)
      }
      c.rect = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }; draw()
    })
    const end = () => { drag = null }
    cc.addEventListener('pointerup', end); cc.addEventListener('pointercancel', end)
    const commit = () => {
      const R = c.rect, r = c.rot, W = B.width, H = B.height
      const rx = Math.round(R.x), ry = Math.round(R.y), rw = Math.max(1, Math.round(R.w)), rh = Math.max(1, Math.round(R.h))
      if (r === 0 && rx === 0 && ry === 0 && rw >= W - 1 && rh >= H - 1) return
      const oc = mk(rw, rh), x = oc.getContext('2d'), M = [[1, 0, 0, 1, 0, 0], [0, 1, -1, 0, H, 0], [-1, 0, 0, -1, W, H], [0, -1, 1, 0, 0, W]][r]
      x.setTransform(M[0], M[1], M[2], M[3], M[4] - rx, M[5] - ry); x.drawImage(B, 0, 0)
      const T = (px, py) => { const a = r === 0 ? [px, py] : r === 1 ? [H - py, px] : r === 2 ? [W - px, H - py] : [py, W - px]; return [a[0] - rx, a[1] - ry] }
      p.strokes.forEach(s => { s.pts = s.pts.map(q => T(q[0], q[1])) })
      p.items.forEach(it => { const t = T(it.x, it.y); it.x = t[0]; it.y = t[1]; it.rot += r * Math.PI / 2 })
      p.base = oc; p.edited = true; E.sel = null; layout(); renderThumbs()
    }
    requestAnimationFrame(fit)
    window.addEventListener('resize', fit)
  }

  // ---- stickers y emojis ----
  function openStickers() {
    if (E.mode || document.querySelector('.pgs')) return
    const sh = $('div', 'pgs', '<div class="pgs-tabs"></div><div class="pgs-g"></div>')
    document.body.appendChild(sh); pushLayer(() => sh.remove())
    const tabs = sh.querySelector('.pgs-tabs'), g = sh.querySelector('.pgs-g'), p = cur()
    const show = k => {
      ;[...tabs.children].forEach(t => t.classList.toggle('on', t.dataset.k === k)); g.innerHTML = ''; g.className = 'pgs-g'
      if (k === 'st') { g.classList.add('st'); loadStickers(g); return }
      EMO[k].split(' ').forEach(e => { const s = $('span'); s.textContent = e; s.onclick = () => { addItem({ kind: 'emoji', text: e, size: minSide(p) * 0.22 }); popLayer() }; g.appendChild(s) })
    }
    Object.keys(EMO).concat('st').forEach(k => { const t = $('span'); t.dataset.k = k; t.textContent = k === 'st' ? '🖼️' : k; t.onclick = () => show(k); tabs.appendChild(t) })
    async function loadStickers(box) {
      box.innerHTML = '<div class="pgs-n">Cargando…</div>'
      let list = []
      try { const c = await (await fetch('/chat/' + encodeURIComponent(chatId))).json(); const seen = new Set(); list = c.messages.filter(m => m.type === 'sticker' && m.mediaUrl && !seen.has(m.mediaUrl) && seen.add(m.mediaUrl)).reverse().slice(0, 60) } catch {}
      box.innerHTML = ''
      if (!list.length) { box.innerHTML = '<div class="pgs-n">Aquí aparecerán los stickers que recibas en este chat.</div>'; return }
      list.forEach(m => {
        const im = $('img'); im.src = m.mediaUrl
        im.onclick = () => { const full = new Image(); full.onload = () => { const s = minSide(p) * 0.4 / Math.max(full.naturalWidth, full.naturalHeight); addItem({ kind: 'img', img: full, iw: full.naturalWidth * s, ih: full.naturalHeight * s }); popLayer() }; full.onerror = () => toast('No se pudo cargar el sticker'); full.src = m.mediaUrl }
        box.appendChild(im)
      })
    }
    show(Object.keys(EMO)[0])
  }

  // ---- texto ----
  function openText(item) {
    if (E.mode === 'draw' || document.querySelector('.pgt')) return
    const p = cur(), ms = minSide(p)
    const t = item ? { color: item.color, style: item.style, font: item.font || 0, pct: Math.round(item.size / ms * 100), text: item.text } : { color: E.tcolor || '#ffffff', style: 0, font: 0, pct: 9, text: '' }
    const ov = $('div', 'pgt', '<div class="pg-top"><button class="pg-b" id="t_x">' + IC.x + '</button><div class="pg-sp"></div><button class="pg-b" id="t_s" title="Estilo">' + IC.aa + '</button><button class="pg-b" id="t_f"><b style="font-size:17px">Ab</b></button><button class="pg-b" id="t_o" style="background:#21c063;color:#08130c">' + IC.check + '</button></div><div class="pgt-mid"><textarea rows="1" placeholder="Escribe un texto" maxlength="400"></textarea></div><div class="pgt-bt"><div class="pg-pal"></div><div class="pg-rng"><span>Tamaño</span><input type="range" min="3" max="22"></div></div>')
    document.body.appendChild(ov); pushLayer(() => ov.remove())
    const ta = ov.querySelector('textarea'), pal = ov.querySelector('.pg-pal'), rg = ov.querySelector('input')
    ta.value = t.text; rg.value = t.pct
    const apply = () => {
      ta.style.fontSize = Math.max(14, ms * t.pct / 100 * E.ks) + 'px'; ta.style.fontFamily = FONTS[t.font]
      ta.style.background = t.style === 1 ? t.color : 'transparent'; ta.style.color = t.style === 1 ? (lum(t.color) > 0.6 ? '#000' : '#fff') : t.color
      ta.style.borderRadius = t.style === 1 ? '14px' : '0'; ta.style.padding = t.style === 1 ? '8px 12px' : '0'
      ta.style.webkitTextStroke = t.style === 2 ? '2px ' + (lum(t.color) > 0.5 ? '#000' : '#fff') : '0'; ta.style.paintOrder = 'stroke fill'
      ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'
    }
    COLORS.forEach(c => { const i = $('i'); i.style.background = c; if (c === t.color) i.className = 'on'; i.onclick = () => { t.color = c; E.tcolor = c; pal.querySelectorAll('i').forEach(z => z.className = ''); i.className = 'on'; apply() }; pal.appendChild(i) })
    ov.querySelector('#t_s').onclick = () => { t.style = (t.style + 1) % 3; toast(['Texto simple', 'Con fondo', 'Con contorno'][t.style]); apply() }
    ov.querySelector('#t_f').onclick = () => { t.font = (t.font + 1) % FONTS.length; apply() }
    rg.oninput = () => { t.pct = +rg.value; apply() }
    ta.oninput = apply
    ov.querySelector('#t_x').onclick = popLayer
    ov.querySelector('#t_o').onclick = () => {
      const txt = ta.value.replace(/\s+$/, ''), size = ms * t.pct / 100
      if (!txt) { if (item) { p.items.splice(p.items.indexOf(item), 1); E.sel = null; p.edited = true } }
      else if (item) { Object.assign(item, { text: txt, color: t.color, style: t.style, font: t.font, size }); metrics(item); E.sel = item; p.edited = true }
      else addItem({ kind: 'text', text: txt, color: t.color, style: t.style, font: t.font, size })
      popLayer(); redraw()
    }
    apply(); setTimeout(() => { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length) }, 120)
  }

  // ---- enviar ----
  async function send() {
    if (E.busy || !E.el) return
    cur().caption = E.cap.value
    E.busy = true
    const btn = E.el.querySelector('#e_send'); btn.disabled = true
    const rid = Date.now() + '-' + Math.random().toString(36).slice(2, 8), total = E.pages.length
    const rp = (typeof replyTo !== 'undefined' && replyTo) ? { senderName: replyTo.fromMe ? 'Tú' : (replyTo.senderName || 'Usuario'), content: replyTo.content || '[Multimedia]', waMessageKey: replyTo.waMessageKey || null } : null
    let sent = 0
    for (let n = 0; n < total; n++) {
      const pg = E.pages[0]
      toast('Enviando ' + (n + 1) + ' de ' + total + '…')
      let r
      try {
        const blob = await exportPage(pg, E.hd), dataUrl = await readURL(blob)
        const res = await fetch('/api/send-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chatId, dataUrl, caption: (pg.caption || '').trim(), viewOnce: E.once, hd: E.hd, requestId: rid + '-' + n, replyTo: n === 0 ? rp : null }) })
        r = await res.json()
      } catch (e) { r = { ok: false, error: 'Error de conexión con el servidor. La foto NO se envió.' } }
      if (!r.ok) {
        E.busy = false; btn.disabled = false
        if (sent) { E.i = 0; E.cap.value = E.pages[0].caption || ''; renderThumbs(); layout() }
        dlg((r.error || 'No se pudo enviar la foto') + (sent ? '\n\nSe enviaron ' + sent + ' de ' + total + '. Las demás siguen en el editor.' : '\n\nNo se perdió nada: puedes reintentar.'), [['Aceptar']])
        return
      }
      E.pages.shift(); sent++
    }
    // éxito: limpia el campo de mensaje y cierra
    const mi = document.getElementById('msgInput')
    if (mi) { mi.value = ''; mi.style.height = 'auto'; try { localStorage.removeItem('draft:' + chatId) } catch {} }
    if (typeof cancelReply === 'function' && rp) cancelReply()
    E.busy = false; E.pages = [{ base: mk(1, 1), strokes: [], items: [] }]
    toast(E.once ? 'Foto de una sola visualización enviada' : (total > 1 ? total + ' fotos enviadas' : 'Foto enviada'))
    popLayer()
  }

  // ================= ENGANCHES CON EL CHAT (sin tocar chat.js) =================
  const isImg = f => /^image\/(jpeg|png|webp|bmp)$/i.test(f.type) || /\.(jpe?g|png|webp|bmp)$/i.test(f.name || '')
  const camBtn = document.getElementById('camBtn'), camInput = document.getElementById('camInput'), imgInput = document.getElementById('imgInput')
  if (camBtn) camBtn.onclick = openCamera
  if (camInput) camInput.addEventListener('click', e => { e.preventDefault(); e.stopImmediatePropagation(); openCamera() }, true)
  if (imgInput) {
    imgInput.addEventListener('click', () => { imgInput.multiple = /image\/\*/.test(imgInput.accept) && !/\*\/\*/.test(imgInput.accept) }, true)
    imgInput.addEventListener('change', e => {
      const fs = [...imgInput.files]
      if (!fs.length || !isImg(fs[0])) return          // vídeos, audio, documentos y GIF siguen por el flujo anterior
      e.stopImmediatePropagation()
      const imgs = fs.filter(isImg)
      if (imgs.length < fs.length) toast('Solo se abrieron las imágenes; envía los vídeos por separado')
      imgInput.value = ''; imgInput.multiple = false
      openEditor(imgs)
    }, true)
  }
})()
