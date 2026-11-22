import {
    makeWASocket,
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    downloadMediaMessage,
    delay,
    Browsers
} from '@whiskeysockets/baileys';
import pino from 'pino';
import chalk from 'chalk';
import axios from 'axios';
import fsSecrets from 'fs';
import cryptoSecrets from 'crypto';
import { Boom } from '@hapi/boom';
import config from './config.js';
import { Handler } from './handler.js';

const logger  = pino({ level: 'warn' }); // TEMPORAL: para diagnosticar el viewOnce, luego volver a 'silent'
const handler = new Handler();
let reconnectAttempts        = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY        = 5000;
let isReady    = false;
let connGlobal = null;

// ========================
// 🌐 EXPORTS
// ========================
export function getConn() { return connGlobal; }

export async function sendRaw(chatId, body) {
    if (!connGlobal) throw new Error('Bot no conectado');
    return await connGlobal.sendMessage(chatId, body);
}

export async function reactToWhatsApp(chatId, key, emoji) {
    if (!connGlobal) throw new Error('Bot no conectado');
    await connGlobal.sendMessage(chatId, { react: { text: emoji, key } });
}

export async function deleteForEveryone(chatId, key) {
    if (!connGlobal) throw new Error('Bot no conectado');
    await connGlobal.sendMessage(chatId, { delete: key });
}

export async function sendToWhatsApp(chatId, content, replyTo = null, media = null, mentions = null) {
    if (!connGlobal) throw new Error('Bot no conectado');
    const options = {};
    if (replyTo?.waMessageKey) {
        options.quoted = {
            key: replyTo.waMessageKey,
            message: { conversation: replyTo.content || '' }
        };
    }
    if (media && media.dataUrl) {
        let buf  = Buffer.from(media.dataUrl.split(',')[1], 'base64');
        let mime = media.dataUrl.slice(5, media.dataUrl.indexOf(';'));
        const wantOgg  = media.type === 'audio' && media.ptt;
        const wantWebp = media.type === 'sticker' && mime !== 'image/webp';
        if (wantOgg || wantWebp) {
            const { execFile } = await import('child_process');
            const fsx = await import('fs'); const osx = await import('os'); const px = await import('path');
            const base = px.join(osx.tmpdir(), 'pg_' + Date.now());
            const out  = base + (wantOgg ? '.ogg' : '.webp');
            const args = wantOgg
                ? ['-y', '-i', base + '.in', '-vn', '-c:a', 'libopus', '-b:a', '32k', out]
                : ['-y', '-i', base + '.in', '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000', '-c:v', 'libwebp', '-q:v', '70', out];
            try {
                fsx.writeFileSync(base + '.in', buf);
                await new Promise((ok, no) => execFile('ffmpeg', args, e => e ? no(e) : ok()));
                buf  = fsx.readFileSync(out);
                mime = wantOgg ? 'audio/ogg; codecs=opus' : 'image/webp';
            } catch (e) {
                console.log('⚠️ Falta ffmpeg (pkg install ffmpeg):', e.message);
                if (wantOgg) mime = 'audio/ogg; codecs=opus';
            }
            try { fsx.unlinkSync(base + '.in'); fsx.unlinkSync(out); } catch (e) {}
        }
        const body = media.type === 'video' ? { video: buf, caption: content || undefined }
                   : media.type === 'audio' ? { audio: buf, mimetype: mime, ptt: !!media.ptt }
                   : media.type === 'sticker' ? { sticker: buf }
                   : media.type === 'document' ? { document: buf, fileName: media.fileName || 'archivo', mimetype: mime, caption: content || undefined }
                   : { image: buf, caption: content || undefined };
        return await connGlobal.sendMessage(chatId, body, options);
    }
    return await connGlobal.sendMessage(chatId, { text: content, ...(mentions && mentions.length ? { mentions } : {}) }, options);
}

export async function start() {
    showBanner();
    suppressLogs();
    process.on('unhandledRejection', e => console.error(chalk.red('❌ Unhandled:'), e));
    process.on('uncaughtException',  e => console.error(chalk.red('❌ Uncaught:'),  e));
    await connectToWhatsApp();
}

// ========================
// 🎨 BANNER
// ========================
function showBanner() {
    console.clear();
    console.log(chalk.yellow.bold('╔════════════════════════════════════════╗'));
    console.log(chalk.yellow.bold('║         PROYECTO G - BOT v1.0          ║'));
    console.log(chalk.yellow.bold('╚════════════════════════════════════════╝\n'));
    console.log(chalk.cyan(`  🤖 ${config.botName}`));
    console.log(chalk.cyan(`  📱 ${config.number}`));
    console.log(chalk.cyan(`  ⚙️  Prefijo: ${config.prefix}\n`));
}

// ========================
// 🔇 SUPRIMIR LOGS
// ========================
function suppressLogs() {
    const originalLog   = console.log;
    const originalError = console.error;
    const blocked = ['Closing open session','SessionEntry','chainKey','ephemeralKeyPair','baseKey'];
    console.info = console.debug = console.warn = () => {};
    console.log   = (...a) => { const m = a.join(' '); if (blocked.some(p => m.includes(p))) return; originalLog(...a); };
    console.error = (...a) => { const m = a.join(' '); if (blocked.some(p => m.includes(p))) return; originalError(...a); };
}

// ========================
// 📲 CÓDIGO DE EMPAREJAMIENTO
// ========================
async function generatePairingCode(conn) {
    const phoneNumber = config.number?.replace(/[^0-9]/g, '');
    if (!phoneNumber) { console.log(chalk.red('❌ Configura el número en config.js\n')); process.exit(1); }
    await delay(2000);
    const code = await conn.requestPairingCode(phoneNumber);
    console.log(chalk.green.bold(`  📲 CÓDIGO: ${code}\n`));
    console.log(chalk.gray('  WhatsApp > Dispositivos > Vincular dispositivo\n'));
}

// ========================
// 🖼️ DESCARGAR MULTIMEDIA
// ========================
async function downloadMedia(conn, message) {
    try {
        const buffer = await downloadMediaMessage(
            message, 'buffer', {},
            { logger, reuploadRequest: conn.updateMediaMessage }
        );
        if (!buffer) return null;
        const msg = message.message;
        let mimeType = 'application/octet-stream';
        if      (msg?.imageMessage)    mimeType = msg.imageMessage.mimetype    || 'image/jpeg';
        else if (msg?.videoMessage)    mimeType = msg.videoMessage.mimetype    || 'video/mp4';
        else if (msg?.audioMessage)    mimeType = msg.audioMessage.mimetype    || 'audio/ogg';
        else if (msg?.documentMessage) mimeType = msg.documentMessage.mimetype || 'application/octet-stream';
        else if (msg?.stickerMessage)  mimeType = msg.stickerMessage.mimetype  || 'image/webp';
        return `data:${mimeType};base64,${buffer.toString('base64')}`;
    } catch (e) {
        console.log(chalk.yellow(`⚠️  Error descargando media: ${e.message}`));
        return null;
    }
}

// ========================
// 📨 ENVIAR AL PANEL
// ========================
async function sendToPanel(data) {
    try {
        data.timestamp = curTs || undefined;
        await axios.post('http://localhost:3000/message', data);
    } catch (e) {
        console.log(chalk.yellow(`⚠️  Panel no disponible: ${e.message}`));
    }
}

// ========================
// 📢 PROCESAR ESTADO
// ========================
async function processStatus(conn, message) {
    if (!message?.message) return;
    const raw      = message.message;
    const senderId = message.key.participant || message.key.remoteJid;
    const name     = message.pushName || senderId?.replace('@s.whatsapp.net','') || 'Desconocido';

    let mediaUrl = null;
    let text     = '';
    let type     = 'text';

    try {
        if (raw.conversation) {
            text = raw.conversation;
            type = 'text';
        } else if (raw.extendedTextMessage) {
            text = raw.extendedTextMessage.text;
            type = 'text';
        } else if (raw.imageMessage) {
            type     = 'image';
            text     = raw.imageMessage.caption || '';
            mediaUrl = await downloadMedia(conn, message);
        } else if (raw.videoMessage) {
            type     = 'video';
            text     = raw.videoMessage.caption || '';
            mediaUrl = await downloadMedia(conn, message);
        } else {
            return; // Ignorar tipos no soportados
        }

        console.log(chalk.magenta(`📢 Estado de ${name}: ${type}`));

        await axios.post('http://localhost:3000/status-update', {
            senderId,
            senderName: name,
            type,
            text,
            mediaUrl,
            timestamp: message.messageTimestamp
                ? message.messageTimestamp * 1000
                : Date.now(),
            messageKey: message.key
        });

    } catch (e) {
        console.log(chalk.yellow(`⚠️  Error procesando estado: ${e.message}`));
    }
}

// ========================
// 💬 PROCESAR MENSAJE
// ========================
async function processMessage(conn, message) {
    if (!message?.message) return;
    let raw = message.message;
    while (raw?.ephemeralMessage?.message) raw = raw.ephemeralMessage.message;
    // Documentos con texto adjunto llegan envueltos en este contenedor extra
    while (raw?.documentWithCaptionMessage?.message) raw = raw.documentWithCaptionMessage.message;

    if (raw.senderKeyDistributionMessage) return;

    // ── EDICIÓN CIFRADA (formato nuevo de WhatsApp) ──
    const se = findKeyDeep(raw, 'secretEncryptedMessage');
    if (se) {
        if (se.secretEncType === 2 || se.secretEncType === 'MESSAGE_EDIT') {
            const r = await decryptEdit(conn, message, se);
            if (r.pt) {
                try {
                    const bm = await import('@whiskeysockets/baileys');
                    const P  = bm.proto || bm.default?.proto;
                    const dm = P.Message.decode(r.pt);
                    const nt = dm.protocolMessage?.editedMessage;
                    const text = nt?.conversation || nt?.extendedTextMessage?.text || nt?.imageMessage?.caption || nt?.videoMessage?.caption;
                    console.log(chalk.cyan('✏️ Edición cifrada descifrada:'), se.targetMessageKey?.id, text ? '' : '(sin texto)');
                    if (text) await axios.post('http://localhost:3000/msg-edit', { chatId: message.key.remoteJid, msgId: se.targetMessageKey.id, text }).catch(() => {});
                } catch (e) { console.log(chalk.red('❌ Edición cifrada: no pude leer el contenido:'), e.message); }
            } else {
                console.log(chalk.yellow('⚠️ Edición cifrada ignorada:'), r.err);
            }
        }
        return;
    }

    // ── EDICIÓN (no es un mensaje nuevo) ──
    const findEdit = (o, d = 0) => {
        if (!o || typeof o !== 'object' || ArrayBuffer.isView(o) || d > 5) return null;
        if (o.protocolMessage && (o.protocolMessage.type === 14 || o.protocolMessage.editedMessage)) return o.protocolMessage;
        for (const k of Object.keys(o)) { const r = findEdit(o[k], d + 1); if (r) return r; }
        return null;
    };
    const pickText = (o, d = 0) => {
        if (!o || typeof o !== 'object' || ArrayBuffer.isView(o) || d > 5) return '';
        if (typeof o.conversation === 'string' && o.conversation) return o.conversation;
        if (o.extendedTextMessage && typeof o.extendedTextMessage.text === 'string') return o.extendedTextMessage.text;
        if (typeof o.caption === 'string' && o.caption) return o.caption;
        for (const k of Object.keys(o)) { const r = pickText(o[k], d + 1); if (r) return r; }
        return '';
    };
    const ed = findEdit(raw);
    if (ed) {
        const text = pickText(ed.editedMessage);
        console.log(chalk.cyan('✏️ Edición detectada:'), ed.key?.id, text ? '' : '(sin texto)');
        if (text && ed.key?.id) await axios.post('http://localhost:3000/msg-edit', { chatId: message.key.remoteJid, msgId: ed.key.id, text }).catch(() => {});
        return;
    }

    // ── REVOKE ──
    if (raw.protocolMessage?.type === 0) {
        const deletedId = raw.protocolMessage.key?.id;
        const chatId    = message.key.remoteJid;
        console.log(chalk.yellow(`🗑️ Borrado: ${deletedId}`));
        await sendToPanel({
            from: chatId, type: 'revoke', deletedId,
            pushName:   message.pushName || chatId,
            senderName: message.pushName || 'Desconocido',
            senderId:   message.key.participant || chatId,
            isGroup:    chatId.endsWith('@g.us'),
            fromMe:     message.key.fromMe || false,
            timestamp:  Date.now()
        });
        return;
    }

    if (raw.protocolMessage) return;

    // ── Detectar viewOnce ──
    let msgContent   = raw;
    let isViewOnce   = false;
    let viewOnceType = null;

    if (raw.viewOnceMessage?.message) {
        msgContent = raw.viewOnceMessage.message;
        isViewOnce = true;
    } else if (raw.viewOnceMessageV2?.message) {
        msgContent = raw.viewOnceMessageV2.message;
        isViewOnce = true;
    } else if (raw.viewOnceMessageV2Extension?.message) {
        msgContent = raw.viewOnceMessageV2Extension.message;
        isViewOnce = true;
    } else if (raw.imageMessage?.viewOnce) {
        isViewOnce   = true;
        viewOnceType = 'image';
    } else if (raw.videoMessage?.viewOnce) {
        isViewOnce   = true;
        viewOnceType = 'video';
    } else if (raw.audioMessage?.viewOnce) {
        isViewOnce   = true;
        viewOnceType = 'audio';
    }

    if (isViewOnce && viewOnceType) {
        const chatId     = message.key.remoteJid;
        const isGroup    = chatId.endsWith('@g.us');
        const senderName = message.pushName || 'Desconocido';
        const senderId   = message.key.participant || chatId;

        let chatName = chatId;
        try {
            chatName = isGroup
                ? (await conn.groupMetadata(chatId)).subject
                : message.pushName || chatId;
        } catch {}

        console.log(chalk.cyan(`👁️ ViewOnce placeholder: ${viewOnceType}`));

        await sendToPanel({
            from: chatId, type: viewOnceType, content: '', text: '',
            mediaUrl: null, pushName: chatName, senderName, senderId,
            isGroup, fromMe: message.key.fromMe || false,
            isViewOnce: true, waMessageKey: message.key
        });
        return;
    }

    const msgForDownload = { ...message, message: msgContent };

    try {
        const chatId     = message.key.remoteJid;
        const isGroup    = chatId.endsWith('@g.us');
        const fromMe     = message.key.fromMe || false;
        const senderId   = message.key.participant || chatId;
        const senderName = message.pushName || 'Desconocido';

        let chatName = chatId;
        try {
            chatName = isGroup
                ? (await conn.groupMetadata(chatId)).subject
                : message.pushName || chatId;
        } catch {}

        let msgType = 'text', text = '', mediaUrl = null, fileName = null;

        if      (msgContent.conversation)        { text    = msgContent.conversation; }
        else if (msgContent.extendedTextMessage) { text    = msgContent.extendedTextMessage.text; }
        else if (msgContent.imageMessage)        { msgType = 'image';    text = msgContent.imageMessage.caption    || ''; mediaUrl = await downloadMedia(conn, msgForDownload); }
        else if (msgContent.videoMessage)        { msgType = 'video';    text = msgContent.videoMessage.caption    || ''; mediaUrl = await downloadMedia(conn, msgForDownload); }
        else if (msgContent.audioMessage)        { msgType = 'audio';    mediaUrl = await downloadMedia(conn, msgForDownload); }
        else if (msgContent.documentMessage)     { msgType = 'document'; fileName = msgContent.documentMessage.fileName || 'archivo'; mediaUrl = await downloadMedia(conn, msgForDownload); }
        else if (msgContent.stickerMessage)      { msgType = 'sticker';  mediaUrl = await downloadMedia(conn, msgForDownload); }

        if (msgType === 'text' && !text && !mediaUrl) {
            const lm  = msgContent.locationMessage;
            const llm = msgContent.liveLocationMessage;
            const cm  = msgContent.contactMessage;
            const cam = msgContent.contactsArrayMessage;
            const gim = msgContent.groupInviteMessage;
            const btn = msgContent.buttonsResponseMessage;
            const lst = msgContent.listResponseMessage;
            const tpl = msgContent.templateButtonReplyMessage;
            const pl  = msgContent.pollCreationMessage || msgContent.pollCreationMessageV2 || msgContent.pollCreationMessageV3;
            if (lm)       text = '📍 Ubicación: https://maps.google.com/?q=' + lm.degreesLatitude + ',' + lm.degreesLongitude;
            else if (llm) text = '📍 Ubicación en vivo: https://maps.google.com/?q=' + llm.degreesLatitude + ',' + llm.degreesLongitude;
            else if (cam) text = '👤 Contactos: ' + (cam.contacts || []).map(c => c.displayName).filter(Boolean).join(', ');
            else if (cm)  text = '👤 Contacto: ' + (cm.displayName || '');
            else if (gim) text = '🔗 Invitación al grupo "' + (gim.groupName || '') + '"';
            else if (btn) text = btn.selectedDisplayText || btn.selectedButtonId || '';
            else if (lst) text = lst.title || lst.singleSelectReply?.selectedRowId || '';
            else if (tpl) text = tpl.selectedDisplayText || '';
            else if (pl)  text = '📊 ' + pl.name + '\n' + (pl.options || []).map(o => '▫ ' + o.optionName).join('\n');
            else {
                if (!msgContent.reactionMessage && !msgContent.pollUpdateMessage) console.log(chalk.gray('ℹ️ Mensaje sin contenido ignorado:'), Object.keys(msgContent).join(','));
                return;
            }
        }

        await sendToPanel({
            from: chatId, type: msgType, text, content: text,
            replyTo: extractReply(conn, msgContent, chatId),
            mediaUrl, fileName, pushName: chatName,
            senderId, senderName, isGroup, fromMe,
            isViewOnce, waMessageKey: message.key
        });

    } catch (e) {
        console.log(chalk.red(`❌ Error procesando: ${e.message}`));
    }
}

// ========================
// 💬 MENSAJES ENTRANTES
// ========================
// ===== Ediciones cifradas de WhatsApp =====
const SECRETS_FILE = 'secrets.jsonl';
const secretStore  = new Map();
let msgQueue = Promise.resolve();
function extractReply(conn, content, chatId) {
    let ci = null;
    for (const v of Object.values(content || {})) {
        if (v && typeof v === 'object' && v.contextInfo && v.contextInfo.quotedMessage) { ci = v.contextInfo; break; }
    }
    if (!ci || !ci.stanzaId) return null;
    const qm = ci.quotedMessage;
    const text = qm.conversation || qm.extendedTextMessage?.text || qm.imageMessage?.caption || qm.videoMessage?.caption || qm.documentMessage?.caption || '';
    const type = qm.imageMessage ? 'image' : qm.videoMessage ? 'video' : qm.audioMessage ? 'audio' : qm.stickerMessage ? 'sticker'
        : qm.documentMessage ? 'document' : qm.locationMessage ? 'location' : qm.contactMessage ? 'contact' : 'text';
    const n  = j => String(j || '').split(':')[0].split('@')[0];
    const me = [n(conn.user?.id), n(conn.user?.lid)].filter(Boolean);
    return { id: ci.stanzaId, participant: ci.participant || null, text, type, isMe: !!ci.participant && me.includes(n(ci.participant)) };
}
let connectedAt = 0, curTs = 0, backfillCount = 0;
function tsOf(m) { const t = Number(m?.messageTimestamp?.toString?.() ?? m?.messageTimestamp); return t > 0 ? t * 1000 : 0; }
try { for (const l of fsSecrets.readFileSync(SECRETS_FILE, 'utf8').split('\n')) { if (!l) continue; const [k, v] = JSON.parse(l); secretStore.set(k, v); } } catch (e) {}

function findSecret(o, d = 0) {
    if (!o || typeof o !== 'object' || ArrayBuffer.isView(o) || d > 6) return null;
    if (o.messageSecret && o.messageSecret.length) return o.messageSecret;
    for (const k of Object.keys(o)) { const r = findSecret(o[k], d + 1); if (r) return r; }
    return null;
}
function findKeyDeep(o, name, d = 0) {
    if (!o || typeof o !== 'object' || ArrayBuffer.isView(o) || d > 6) return null;
    if (o[name]) return o[name];
    for (const k of Object.keys(o)) { const r = findKeyDeep(o[k], name, d + 1); if (r) return r; }
    return null;
}
function rememberSecret(m) {
    try {
        const id = m?.key?.id;
        if (!id || secretStore.has(id) || !m.message) return;
        const s = findSecret(m.message);
        if (!s) return;
        const b64 = Buffer.from(s).toString('base64');
        secretStore.set(id, b64);
        fsSecrets.appendFileSync(SECRETS_FILE, JSON.stringify([id, b64]) + '\n');
    } catch (e) {}
}
async function decryptEdit(conn, message, se) {
    const target = se.targetMessageKey || {};
    const b64 = secretStore.get(target.id);
    if (!b64) return { err: 'no tengo el secreto del mensaje original (es anterior a esta actualización)' };
    const secret  = Buffer.from(b64, 'base64');
    const iv      = Buffer.from(se.encIv);
    const payload = Buffer.from(se.encPayload);
    const ct      = payload.subarray(0, payload.length - 16);
    const tag     = payload.subarray(payload.length - 16);
    const strip   = j => j ? String(j).replace(/:\d+@/, '@') : null;
    const base    = [message.key.participant, message.key.participantAlt, message.key.remoteJid, message.key.remoteJidAlt, target.participant, target.remoteJid]
        .map(strip).filter(j => j && !j.endsWith('@g.us'));
    const cands = new Set(base);
    const lm = conn.signalRepository?.lidMapping;
    for (const j of base) {
        try {
            const alt = j.endsWith('@lid') ? await lm?.getPNForLID?.(j) : await lm?.getLIDForPN?.(j);
            if (alt) cands.add(strip(alt));
        } catch (e) {}
    }
    for (const sender of cands) for (const editor of cands) {
        try {
            const info = Buffer.from(String(target.id) + sender + editor + 'Message Edit');
            const key  = Buffer.from(cryptoSecrets.hkdfSync('sha256', secret, Buffer.alloc(0), info, 32));
            const dec  = cryptoSecrets.createDecipheriv('aes-256-gcm', key, iv);
            dec.setAuthTag(tag);
            return { pt: Buffer.concat([dec.update(ct), dec.final()]) };
        } catch (e) {}
    }
    return { err: 'no se pudo autenticar la edición (identificadores no coinciden)' };
}

async function handleMessages(conn, { messages, type }) {
    console.log('🧪 handleMessages | type=' + type + ' | cantidad=' + (messages?.length || 0) + ' | isReady=' + isReady + ' | tienePlaceholderResend=' + (typeof conn.requestPlaceholderResend));
    for (const m of messages || []) rememberSecret(m);
    if (!isReady) return;
    for (const mm of messages || []) {
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
    }
}

async function handleOne(conn, message, type) {
    const remoteJid = message.key.remoteJid;

    // ── Estados de WhatsApp ──
    if (remoteJid === 'status@broadcast') {
        await processStatus(conn, message);
        return;
    }

    // ── Mensajes normales ──
    if (type !== 'notify' && type !== 'append') return;
    if (type === 'append') {
        // Solo mensajes de la cola offline o del historial (anteriores a la conexión). Los demás son ecos de lo que envía el panel.
        const ts = tsOf(message);
        if (!(ts && ts < connectedAt - 3000)) return;
        backfillCount++;
        if (backfillCount === 1) console.log(chalk.cyan('📥 Recuperando mensajes pendientes...'));
    }
    curTs = tsOf(message);

    await processMessage(conn, message);
    if (type === 'notify') try {
        await handler.handleMessage(conn, message, config);
    } catch (e) {
        console.error(chalk.red(`❌ Handler: ${e.message}`));
    }
}

// ========================
// 🔌 MANEJO DE CONEXIÓN
// ========================
async function handleConnectionUpdate(conn, update) {
    const { connection, lastDisconnect } = update;
    if (update.receivedPendingNotifications) {
        msgQueue = msgQueue.then(() => console.log(chalk.green('✅ Mensajes pendientes recuperados: ' + backfillCount)));
    }

    if (connection === 'close') {
        const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
        if (code !== DisconnectReason.loggedOut) {
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                reconnectAttempts++;
                console.log(chalk.yellow(`🔄 Reconectando... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})\n`));
                await delay(RECONNECT_DELAY);
                await connectToWhatsApp();
            } else {
                console.log(chalk.red('❌ Máximo de intentos alcanzado\n'));
                process.exit(1);
            }
        } else {
            console.log(chalk.red('🛑 Sesión cerrada\n'));
            process.exit(0);
        }
    } else if (connection === 'open') {
        reconnectAttempts = 0;
        isReady = true;
        connectedAt = Date.now();
        backfillCount = 0;
        console.log(chalk.green('✅ Conectado'));
        console.log(chalk.cyan(`  📱 ${conn.user?.id.split(':')[0]}\n`));
        handler.init(config);
        await handler.loadPlugins();
        console.log(chalk.green('🚀 Bot activo\n'));
    } else if (connection === 'connecting') {
        console.log(chalk.blue('⏳ Conectando...\n'));
    }
}

// ========================
// 🚀 CONECTAR WHATSAPP
// ========================
async function connectToWhatsApp() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('./sesion');
        const { version }          = await fetchLatestBaileysVersion();

        const conn = makeWASocket({
            version, logger,
            printQRInTerminal: false,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger),
            },
            ...(state.creds.registered ? { browser: Browsers.android('Chrome') } : {}),
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: true,
            defaultQueryTimeoutMs: undefined,
            syncFullHistory: false,
            getMessage: async () => undefined,
        });

        connGlobal = conn;
        if (!conn.authState.creds.registered) await generatePairingCode(conn);

        conn.ev.on('connection.update', (update) => handleConnectionUpdate(conn, update));
        conn.ev.on('creds.update',      saveCreds);
        conn.ev.on('messages.reaction', (list) => list.forEach(r => axios.post('http://localhost:3000/reaction', {
            chatId: r.key.remoteJid, msgId: r.key.id,
            from:   r.reaction.key?.participant || r.reaction.key?.remoteJid,
            fromMe: !!r.reaction.key?.fromMe,
            emoji:  r.reaction.text || ''
        }).catch(() => {})));
        conn.ev.on('messages.update', (list) => list.forEach(u => {
            if (u.update?.status != null && u.key?.fromMe) axios.post('http://localhost:3000/msg-status', { chatId: u.key.remoteJid, msgId: u.key.id, status: u.update.status }).catch(() => {});
        }));
        conn.ev.on('presence.update', ({ id, presences }) => axios.post('http://localhost:3000/presence', {
            chatId: id,
            list: Object.entries(presences || {}).map(([jid, p]) => ({ jid, state: p.lastKnownPresence || p.lastPresence }))
        }).catch(() => {}));
        conn.ev.on('messages.update', (list) => list.forEach(u => {
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
        }));
        conn.ev.on('messaging-history.set', ({ messages }) => {
            const cutoff = Date.now() - 3 * 24 * 3600e3;
            const list = (messages || [])
                .filter(m => m?.message && m.key?.remoteJid && m.key.remoteJid !== 'status@broadcast' && tsOf(m) >= cutoff)
                .sort((a, b) => tsOf(a) - tsOf(b)).slice(-300);
            if (list.length) console.log(chalk.cyan('📥 Historial recibido: ' + list.length + ' mensajes'));
            for (const m of list) { rememberSecret(m); msgQueue = msgQueue.then(() => handleOne(conn, m, 'append')).catch(() => {}); }
        });
        conn.ev.on('group-participants.update', ({ id, participants, action, author }) => {
            const ids = (participants || []).map(p => typeof p === 'string' ? p : p.id);
            axios.post('http://localhost:3000/api/system-event', { chatId: id, action, participants: ids, author }).catch(() => {});
        });
        conn.ev.on('groups.update', (list) => list.forEach(u => {
            const say = text => axios.post('http://localhost:3000/api/system-event', { chatId: u.id, text }).catch(() => {});
            if (u.subject) say('El asunto del grupo cambió a "' + u.subject + '"');
            if (u.announce === true)  say('Ahora solo los admins pueden enviar mensajes');
            if (u.announce === false) say('Ahora todos pueden enviar mensajes');
            if (u.restrict === true)  say('Ahora solo los admins pueden editar la info del grupo');
            if (u.restrict === false) say('Ahora todos pueden editar la info del grupo');
        }));
        conn.ws.on('CB:call', (n) => {
            const c  = n.content?.[0];
            const id = c?.attrs?.['call-id'];
            if (!id) return;
            let status = ({ offer: 'offer', accept: 'accept', reject: 'reject', terminate: 'timeout' })[c.tag];
            if (!status) return;
            if (c.tag === 'terminate' && c.attrs.reason === 'accepted_elsewhere') status = 'accept';
            if (c.tag === 'offer' && c.attrs.is_call_ended) status = 'timeout';
            axios.post('http://localhost:3000/call', {
                id, status,
                from:    c.attrs.caller_pn || undefined,
                name:    n.attrs.notify || undefined,
                isVideo: !!c.content?.some?.(x => x.tag === 'video'),
                isGroup: !!c.attrs['group-jid'],
                date:    (+n.attrs.t || 0) * 1000 || Date.now()
            }).catch(() => {});
        });
        conn.ev.on('messages.upsert',   (data)   => handleMessages(conn, data));
        conn.ws.on('error', () => console.error(chalk.yellow('⚠️  Error de socket')));

        return conn;
    } catch (e) {
        console.error(chalk.red(`\n❌ Error: ${e.message}\n`));
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            await delay(RECONNECT_DELAY);
            return connectToWhatsApp();
        }
        process.exit(1);
    }
}
