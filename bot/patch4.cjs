const fs = require('fs');
const file = 'index.js';
let src = fs.readFileSync(file, 'utf8');

const oldStr = `        conn.ev.on('messages.update', (list) => list.forEach(u => {
            const em = u.update?.message?.editedMessage?.message || u.update?.message?.protocolMessage?.editedMessage;
            if (!em) return;
            const text = em.conversation || em.extendedTextMessage?.text || em.imageMessage?.caption || em.videoMessage?.caption;
            if (text) axios.post('http://localhost:3000/msg-edit', { chatId: u.key.remoteJid, msgId: u.key.id, text }).catch(() => {});
        }));`;

const newStr = `        conn.ev.on('messages.update', (list) => list.forEach(u => {
            const em = u.update?.message?.editedMessage?.message || u.update?.message?.protocolMessage?.editedMessage;
            if (!em) return;
            const text = em.conversation || em.extendedTextMessage?.text || em.imageMessage?.caption || em.videoMessage?.caption;
            if (text) axios.post('http://localhost:3000/msg-edit', { chatId: u.key.remoteJid, msgId: u.key.id, text }).catch(() => {});
        }));
        // ── DIAGNÓSTICO + resolución de placeholders (viewOnce, media reenviada) ──
        conn.ev.on('messages.update', (list) => list.forEach(u => {
            const um = u.update?.message;
            console.log(chalk.gray('🧪 messages.update | id=' + u.key?.id + ' | updateKeys=' + Object.keys(u.update || {}).join(',') + ' | messageKeys=' + (um ? Object.keys(um).join(',') : '(sin message)')));
            if (!um || typeof um !== 'object') return;
            if (u.update?.status != null) return;
            if (um.editedMessage || um.protocolMessage?.editedMessage) return;
            const hasRealContent = um.imageMessage || um.videoMessage || um.audioMessage || um.documentMessage
                || um.viewOnceMessage || um.viewOnceMessageV2 || um.viewOnceMessageV2Extension || um.stickerMessage;
            if (!hasRealContent) return;
            console.log(chalk.cyan('📬 Contenido real llegó por messages.update (probable viewOnce resuelto): ' + u.key?.id));
            const fakeMsg = { key: u.key, message: um, messageTimestamp: Math.floor(Date.now() / 1000) };
            msgQueue = msgQueue.then(() => handleOne(conn, fakeMsg, 'notify')).catch(e => console.log(chalk.red('❌ Cola (update): ' + e.message)));
        }));`;

if (!src.includes(oldStr)) {
  console.error('❌ No encontré el bloque esperado.');
  process.exit(1);
}
src = src.replace(oldStr, newStr);
fs.writeFileSync(file, src);
console.log('✅ Listener de messages.update agregado.');
