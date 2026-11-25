// Preferencias globales del panel (clave 'settings' de localStorage, la misma que ya usan chat.js e index.js).
// Este archivo solo aplica ajustes visuales/de interacción; no envía nada ni toca el bot.
(function () {
  'use strict'
  var CSS =
    'html.pref-reduce-motion *,html.pref-reduce-motion *::before,html.pref-reduce-motion *::after{animation-duration:.001ms !important;animation-iteration-count:1 !important;transition-duration:.001ms !important;scroll-behavior:auto !important}' +
    'html.pref-contrast{--text-dim:#c9d1d5}' +
    'html.pref-contrast .chat-preview,html.pref-contrast .chat-time,html.pref-contrast .rs,html.pref-contrast .st-sub,html.pref-contrast .msg-time,html.pref-contrast [style*="#8696a0"]{color:#d3dadd !important}' +
    'html.pref-touch .icon-btn,html.pref-touch .back{min-width:48px;min-height:48px}' +
    'html.pref-touch .chat-item{padding-top:17px !important;padding-bottom:17px !important}' +
    'html.pref-touch .ctx-item,html.pref-touch .mi,html.pref-touch .cm-item,html.pref-touch .row{min-height:56px}' +
    'html.pref-touch .filter-chip{min-height:40px}'

  function read() {
    try { return JSON.parse(localStorage.getItem('settings') || '{}') || {} } catch (e) { return {} }
  }

  function apply() {
    var s = read()
    var r = document.documentElement
    r.classList.toggle('pref-reduce-motion', !!s.reduceMotion)
    r.classList.toggle('pref-contrast', !!s.contrast)
    r.classList.toggle('pref-touch', !!s.bigTouch)
    if (!document.getElementById('pg-prefs-css')) {
      var st = document.createElement('style')
      st.id = 'pg-prefs-css'
      st.textContent = CSS
      ;(document.head || r).appendChild(st)
    }
  }

  window.PGPrefs = { read: read, apply: apply }
  apply()
  window.addEventListener('storage', function (e) { if (!e.key || e.key === 'settings') apply() })
  window.addEventListener('pageshow', apply)
})()
