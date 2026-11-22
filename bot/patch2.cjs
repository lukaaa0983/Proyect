const fs = require('fs');
const file = 'index.js';
let src = fs.readFileSync(file, 'utf8');

const oldStr = `async function handleMessages(conn, { messages, type }) {
    for (const m of messages || []) rememberSecret(m);
    for (const m of messages || []) {
        console.log('🔎 DEBUG upsert | type=' + type, '| keys=' + Object.keys(m?.message || {}).join(','), '| fromMe=' + m?.key?.fromMe, '| id=' + m?.key?.id);
    }
    if (!isReady) return;
    for (const mm of messages || []) {
        if (!mm?.message) continue;
        msgQueue = msgQueue.then(() => handleOne(conn, mm, type)).catch(e => console.log(chalk.red('❌ Cola: ' + e.message)));
    }
}`;

const newStr = `async function handleMessages(conn, { messages, type }) {
    for (const m of messages || []) rememberSecret(m);
    if (!isReady) return;
    for (const mm of messages || []) {
        if (!mm?.message) continue;
        // ── Placeholder vacío (WhatsApp lo manda así para "ver una vez" y similares) ──
        // No trae contenido real todavía: hay que pedirle a WhatsApp que lo reenvíe.
        // El contenido de verdad llega después en otro evento messages.upsert.
        if (Object.keys(mm.message).length === 0) {
            if (type === 'notify' && mm.key?.id) {
                conn.requestPlaceholderResend(mm.key)
                    .then(() => console.log(chalk.cyan('🔁 Pedido reenvío de mensaje placeholder: ' + mm.key.id)))
                    .catch(e => console.log(chalk.yellow('⚠️ No se pudo pedir el placeholder: ' + e.message)));
            }
            continue;
        }
        msgQueue = msgQueue.then(() => handleOne(conn, mm, type)).catch(e => console.log(chalk.red('❌ Cola: ' + e.message)));
    }
}`;

if (!src.includes(oldStr)) {
  console.error('❌ No encontré el bloque con el DEBUG. ¿Seguro que lo aplicaste tal cual antes?');
  process.exit(1);
}
src = src.replace(oldStr, newStr);
fs.writeFileSync(file, src);
console.log('✅ Arreglo de placeholder/viewOnce aplicado.');
