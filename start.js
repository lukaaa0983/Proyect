console.log('🚀 Iniciando Proyecto G...\n')
import('./backend/server.js').catch(e => {
  console.error('❌ Error en servidor:', e.message)
  process.exit(1)
})
