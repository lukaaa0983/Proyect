const fs = require('fs');
const file = 'index.js';
let src = fs.readFileSync(file, 'utf8');

const oldStr = `    for (const mm of messages || []) {
        if (!mm?.message) continue;
        if (Object.keys(mm.message).length === 0) {
            if (type === 'notify' && mm.key?.id) {
                try {
                    const p = conn.requestPlaceholderResend(mm.key);
                    Promise.resolve(p)
                        .then(() => console.log(chalk.cyan('🔁 Pedido reenvío de mensaje placeholder: ' + mm.key.id)))
                        .catch(e => console.log(chalk.yellow('⚠️ Rechazo al pedir placeholder: ' + e.message)));
                } catch (e) {
                    console.log(chalk.red('❌ Error SINCRÓNICO al pedir placeholder: ' + e.message));
                }
            }
            continue;
        }
        msgQueue = msgQueue.then(() => handleOne(conn, mm, type)).catch(e => console.log(chalk.red('❌ Cola: ' + e.message)));
    }`;

const newStr = `    for (const mm of messages || []) {
        // Mensaje vacío o nulo: WhatsApp no mandó el contenido real todavía
        // (típico en fotos/videos "ver una vez"). Antes esto se descartaba
        // en el "if (!mm?.message) continue" de arriba SIN pedir el reenvío.
        if (!mm?.message || Object.keys(mm.message).length === 0) {
            if (type === 'notify' && mm?.key?.id) {
                try {
                    Promise.resolve(conn.requestPlaceholderResend(mm.key))
                        .then(() => console.log(chalk.cyan('🔁 Pedido reenvío de mensaje placeholder: ' + mm.key.id)))
                        .catch(e => console.log(chalk.yellow('⚠️ Rechazo al pedir placeholder: ' + e.message)));
                } catch (e) {
                    console.log(chalk.red('❌ Error SINCRÓNICO al pedir placeholder: ' + e.message));
                }
            }
            continue;
        }
        msgQueue = msgQueue.then(() => handleOne(conn, mm, type)).catch(e => console.log(chalk.red('❌ Cola: ' + e.message)));
    }`;

if (!src.includes(oldStr)) {
  console.error('❌ No encontré el bloque esperado.');
  process.exit(1);
}
src = src.replace(oldStr, newStr);
fs.writeFileSync(file, src);
console.log('✅ Corrección aplicada: ahora sí se pide el reenvío cuando message es null.');
