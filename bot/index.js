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
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { format } from 'util';
import { fileURLToPath } from 'url';
import { Boom } from '@hapi/boom';
import config from './config.js';
import { Handler } from './handler.js';
import { attachContacts, getContacts as getKnownContacts } from './lib/contacts.js';
export { getKnownContacts as getContacts };

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ========================
// ⚙️ AJUSTES
// ========================
// Para ver los logs de diagnóstico: BOT_DEBUG=1 npm start
const DEBUG             = !!process.env.BOT_DEBUG;
const PANEL_URL         = 'http://localhost:3000';
const SPOOL_DIR         = path.join(__dirname, 'pendientes');   // cola en disco si el panel no responde
const SECRETS_FILE      = 'secrets.jsonl';
const RECONNECT_BASE_MS = 3000;
const RECONNECT_MAX_MS  = 60000;
const FRESH_MS          = 60000;   // solo mensajes de los últimos 60s pueden ejecutar comandos

const logger  = pino({ level: DEBUG ? 'warn' : 'silent' });
const dbg     = (...a) => { if (DEBUG) console.log(...a); };
const handler = new Handler();

let reconnectAttempts = 0;
let connecting        = false;
let pluginsLoaded     = false;
let connGlobal        = null;   // solo está definido mientras la conexión está abierta
let msgQueue          = Promise.resolve();
let connectedAt = 0, curTs = 0, backfillCount = 0;

const tsOf = m => { const t = Number(m?.messageTimestamp?.toString?.() ?? m?.messageTimestamp); return t > 0 ? t * 1000 : 0; };
const isFresh = m => { const t = tsOf(m); return !t || Date.now() - t < FRESH_MS; };
const withTimeout = (p, ms, label = 'operación') =>
    Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error(label + ' tardó demasiado')), ms))]);

// ========================
// 📨 ENTREGA AL PANEL (con reintentos en disco)
// ========================
const http = axios.create({ baseURL: PANEL_URL, timeout: 30000, maxBodyLength: Infinity, maxContentLength: Infinity });
const isRetryable = e => { const s = e?.response?.status; return !s || s >= 500 || s === 408 || s === 429; };

function spool(route, data) {
    try {
        fs.mkdirSync(SPOOL_DIR, { recursive: true });
        const name = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}.json`;
        fs.writeFileSync(path.join(SPOOL_DIR, name), JSON.stringify({ route, data }));
        dbg(chalk.yellow(`📦 Panel no disponible, guardado para reintentar: ${route}`));
    } catch (e) {
        console.log(chalk.red(`❌ No pude guardar el mensaje pendiente: ${e.message}`));
    }
}

// Nunca lanza error. Si el panel no responde, el evento queda en ./bot/pendientes y se reenvía solo.
async function post(route, data, { critical = true } = {}) {
    try {
        await http.post(route, data);
        return true;
    } catch (e) {
        if (critical && isRetryable(e)) spool(route, data);
        else dbg(chalk.yellow(`⚠️ Panel ${route}: ${e.message}`));
        return false;
    }
}

let flushing = false;
const spoolTries = new Map();
async function flushSpool() {
    if (flushing) return;
    flushing = true;
    try {
        let files;
        try { files = fs.readdirSync(SPOOL_DIR).filter(f => f.endsWith('.json')).sort(); } catch { return; }
        let delivered = 0;
        for (const f of files) {
            const file = path.join(SPOOL_DIR, f);
            let item;
            try { item = JSON.parse(fs.readFileSync(file, 'utf8')); }
            catch { try { fs.renameSync(file, file + '.corrupto'); } catch {} continue; }
            try {
                await http.post(item.route, item.data);
                fs.unlinkSync(file);
                spoolTries.delete(f);
                delivered++;
            } catch (e) {
                if (!isRetryable(e)) { try { fs.renameSync(file, file + '.descartado'); } catch {} continue; }
                const n = (spoolTries.get(f) || 0) + 1;
                spoolTries.set(f, n);
                if (n >= 20) { try { fs.renameSync(file, file + '.fallido'); } catch {} spoolTries.delete(f); continue; }
                break;   // el panel sigue caído: reintentar luego, manteniendo el orden
            }
        }
        if (delivered) console.log(chalk.green(`📬 ${delivered} mensaje(s) pendiente(s) entregados al panel`));
    } finally {
        flushing = false;
    }
}

function sendToPanel(data) {
    data.timestamp = curTs || undefined;
    return post('/message', data);
}

// ========================
// 🔁 ECOS DE LO QUE ENVÍA EL PANEL
// ========================
// Baileys re-emite como "append" lo que enviamos nosotros. Esos ecos se descartan
// (el panel ya guardó el mensaje); todo lo demás se acepta, esté el bot encendido o no.
let sendingNow = 0;
const sentIds = new Map();

async function tracked(fn) {
    sendingNow++;
    try {
        const r = await fn();
        const id = r?.key?.id;
        if (id) {
            sentIds.set(id, Date.now() + 5 * 60e3);
            if (sentIds.size > 500) for (const [k, exp] of sentIds) if (exp < Date.now()) sentIds.delete(k);
        }
        return r;
    } finally {
        setTimeout(() => { sendingNow = Math.max(0, sendingNow - 1); }, 2000);
    }
}

function isOwnEcho(m) {
    if (!m.key?.fromMe) return false;
    const exp = sentIds.get(m.key.id);
    if (exp) { if (exp > Date.now()) return true; sentIds.delete(m.key.id); }
    return sendingNow > 0;
}

// ========================
// 🌐 EXPORTS
// ========================
const need = () => { if (!connGlobal) throw new Error('Bot no conectado'); return connGlobal; };

export function getConn() { return connGlobal; }

export async function sendRaw(chatId, body) {
    const conn = need();
    return await tracked(() => conn.sendMessage(chatId, body));
}

export async function reactToWhatsApp(chatId, key, emoji) {
    const conn = need();
    await tracked(() => conn.sendMessage(chatId, { react: { text: emoji, key } }));
}

export async function deleteForEveryone(chatId, key) {
    const conn = need();
    await tracked(() => conn.sendMessage(chatId, { delete: key }));
}

export async function sendToWhatsApp(chatId, content, replyTo = null, media = null, mentions = null) {
    const conn = need();
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
            const base = path.join(os.tmpdir(), 'pg_' + Date.now());
            const out  = base + (wantOgg ? '.ogg' : '.webp');
            const args = wantOgg
                ? ['-y', '-i', base + '.in', '-vn', '-c:a', 'libopus', '-b:a', '32k', out]
                : ['-y', '-i', base + '.in', '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000', '-c:v', 'libwebp', '-q:v', '70', out];
            try {
                fs.writeFileSync(base + '.in', buf);
                await new Promise((ok, no) => execFile('ffmpeg', args, e => e ? no(e) : ok()));
                buf  = fs.readFileSync(out);
                mime = wantOgg ? 'audio/ogg; codecs=opus' : 'image/webp';
            } catch (e) {
                console.log(chalk.yellow('⚠️ Falta ffmpeg (pkg install ffmpeg): ' + e.message));
                if (wantOgg) mime = 'audio/ogg; codecs=opus';
            }
            try { fs.unlinkSync(base + '.in'); fs.unlinkSync(out); } catch (e) {}
        }
        const body = media.type === 'video' ? { video: buf, caption: content || undefined }
                   : media.type === 'audio' ? { audio: buf, mimetype: mime, ptt: !!media.ptt }
                   : media.type === 'sticker' ? { sticker: buf }
                   : media.type === 'document' ? { document: buf, fileName: media.fileName || 'archivo', mimetype: mime, caption: content || undefined }
                   : { image: buf, caption: content || undefined, ...(media.viewOnce ? { viewOnce: true } : {}) };
        return await tracked(() => conn.sendMessage(chatId, body, options));
    }
    return await tracked(() => conn.sendMessage(chatId, { text: content, ...(mentions && mentions.length ? { mentions } : {}) }, options));
}

export async function start() {
    showBanner();
    suppressLogs();
    process.on('unhandledRejection', e => console.error(chalk.red('❌ Unhandled:'), e?.message || e));
    process.on('uncaughtException',  e => console.error(chalk.red('❌ Uncaught:'),  e?.message || e));
    flushSpool();
    setInterval(flushSpool, 15000);
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
// 🔇 SUPRIMIR LOGS MOLESTOS (libsignal / Baileys)
// ========================
function suppressLogs() {
    const originalLog   = console.log;
    const originalError = console.error;
    const blocked = [
        'Closing open session', 'Closing session', 'Opening session', 'Removing old closed session',
        'Migrating session', 'Decrypted message with closed session', 'SessionEntry', 'chainKey',
        'ephemeralKeyPair', 'baseKey', 'Bad MAC', 'Session error', 'Failed to decrypt',
        'No matching sessions', 'No session found', 'MessageCounterError'
    ];
    const isNoise = a => { const m = format(...a); return blocked.some(p => m.includes(p)); };
    console.info = console.debug = console.warn = () => {};
    console.log   = (...a) => { if (!isNoise(a)) originalLog(...a); };
    console.error = (...a) => { if (!isNoise(a)) originalError(...a); };
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
        const buffer = await withTimeout(
            downloadMediaMessage(message, 'buffer', {}, { logger, reuploadRequest: conn.updateMediaMessage }),
            60000, 'descarga de multimedia'
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
        dbg(chalk.yellow(`⚠️  Error descargando media: ${e.message}`));
        return null;
    }
}

// Nombre del chat. Los grupos se cachean para no pedir metadata por cada mensaje
// (al recuperar mensajes pendientes eso saturaba la conexión y bloqueaba la cola).
const groupNames = new Map();
async function chatNameOf(conn, chatId, isGroup, pushName, fromMe) {
    if (isGroup) {
        const c = groupNames.get(chatId);
        if (c && c.exp > Date.now()) return c.name;
        try {
            const g = await withTimeout(conn.groupMetadata(chatId), 10000, 'groupMetadata');
            if (g?.subject) { groupNames.set(chatId, { name: g.subject, exp: Date.now() + 10 * 60e3 }); return g.subject; }
        } catch {}
        return c?.name || chatId;
    }
    // En privados, el pushName de un mensaje propio es MI nombre: no debe renombrar el chat.
    return fromMe ? chatId : (pushName || chatId);
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

        dbg(chalk.magenta(`📢 Estado de ${name}: ${type}`));

        await post('/status-update', {
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
        dbg(chalk.yellow(`⚠️  Error procesando estado: ${e.message}`));
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
                    dbg(chalk.cyan('✏️ Edición cifrada descifrada:'), se.targetMessageKey?.id, text ? '' : '(sin texto)');
                    if (text) await post('/msg-edit', { chatId: message.key.remoteJid, msgId: se.targetMessageKey.id, text });
                } catch (e) { dbg(chalk.red('❌ Edición cifrada: no pude leer el contenido:'), e.message); }
            } else {
                dbg(chalk.yellow('⚠️ Edición cifrada ignorada:'), r.err);
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
        dbg(chalk.cyan('✏️ Edición detectada:'), ed.key?.id, text ? '' : '(sin texto)');
        if (text && ed.key?.id) await post('/msg-edit', { chatId: message.key.remoteJid, msgId: ed.key.id, text });
        return;
    }

    // ── REVOKE ──
    if (raw.protocolMessage?.type === 0) {
        const deletedId = raw.protocolMessage.key?.id;
        const chatId    = message.key.remoteJid;
        dbg(chalk.yellow(`🗑️ Borrado: ${deletedId}`));
        await sendToPanel({
            from: chatId, type: 'revoke', deletedId,
            pushName:   message.pushName || chatId,
            senderName: message.pushName || 'Desconocido',
            senderId:   message.key.participant || chatId,
            isGroup:    chatId.endsWith('@g.us'),
            fromMe:     message.key.fromMe || false
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
        const fromMe     = message.key.fromMe || false;
        const senderName = message.pushName || 'Desconocido';
        const senderId   = message.key.participant || chatId;
        const chatName   = await chatNameOf(conn, chatId, isGroup, message.pushName, fromMe);

        dbg(chalk.cyan(`👁️ ViewOnce placeholder: ${viewOnceType}`));

        await sendToPanel({
            from: chatId, type: viewOnceType, content: '', text: '',
            mediaUrl: null, pushName: chatName, senderName, senderId,
            isGroup, fromMe,
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
        const chatName   = await chatNameOf(conn, chatId, isGroup, message.pushName, fromMe);

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
                if (!msgContent.reactionMessage && !msgContent.pollUpdateMessage) dbg(chalk.gray('ℹ️ Mensaje sin contenido ignorado:'), Object.keys(msgContent).join(','));
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
// ✏️ Ediciones cifradas de WhatsApp
// ========================
const secretStore = new Map();

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

try { for (const l of fs.readFileSync(SECRETS_FILE, 'utf8').split('\n')) { if (!l) continue; const [k, v] = JSON.parse(l); secretStore.set(k, v); } } catch (e) {}

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
        fs.appendFileSync(SECRETS_FILE, JSON.stringify([id, b64]) + '\n');
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
            const key  = Buffer.from(crypto.hkdfSync('sha256', secret, Buffer.alloc(0), info, 32));
            const dec  = crypto.createDecipheriv('aes-256-gcm', key, iv);
            dec.setAuthTag(tag);
            return { pt: Buffer.concat([dec.update(ct), dec.final()]) };
        } catch (e) {}
    }
    return { err: 'no se pudo autenticar la edición (identificadores no coinciden)' };
}

// ========================
// 💬 MENSAJES ENTRANTES
// ========================
// Se aceptan TODOS los mensajes que entrega Baileys, tanto en vivo ("notify") como los que
// WhatsApp tenía en cola mientras el bot estaba apagado ("append"). Los duplicados no hacen
// daño: el panel descarta lo que ya tiene (mismo ID de WhatsApp).
async function handleMessages(conn, { messages, type }) {
    const list = (messages || []).slice().sort((a, b) => tsOf(a) - tsOf(b));   // en orden cronológico
    dbg(chalk.gray(`🧪 upsert type=${type} cantidad=${list.length}`));
    for (const m of list) rememberSecret(m);

    for (const mm of list) {
        // Mensaje vacío: WhatsApp no mandó el contenido real todavía (típico de "ver una vez").
        if (!mm?.message || Object.keys(mm.message).length === 0) {
            if (type === 'notify' && mm?.key?.id) {
                try {
                    Promise.resolve(conn.requestPlaceholderResend(mm.key))
                        .then(() => dbg(chalk.cyan('🔁 Pedido reenvío de mensaje placeholder: ' + mm.key.id)))
                        .catch(e => dbg(chalk.yellow('⚠️ Rechazo al pedir placeholder: ' + e.message)));
                } catch (e) {
                    dbg(chalk.red('❌ Error al pedir placeholder: ' + e.message));
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
        if (isOwnEcho(message)) return;   // eco de lo que envió el panel
        const ts = tsOf(message);
        if (ts && ts < connectedAt - 3000) backfillCount++;
    }
    curTs = tsOf(message);

    await processMessage(conn, message);

    // Los comandos solo se ejecutan con mensajes recientes (nunca al recuperar mensajes viejos)
    if (type === 'notify' && isFresh(message)) try {
        await handler.handleMessage(conn, message, config);
    } catch (e) {
        console.error(chalk.red(`❌ Handler: ${e.message}`));
    }
}

// ========================
// 🔌 MANEJO DE CONEXIÓN
// ========================
async function scheduleReconnect(code) {
    reconnectAttempts++;
    const wait = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** Math.min(reconnectAttempts - 1, 5));
    console.log(chalk.yellow(`🔄 Sin conexión${code ? ` (${code})` : ''}. Reintentando en ${Math.round(wait / 1000)}s...`));
    await delay(wait);
    await connectToWhatsApp();
}

async function handleConnectionUpdate(conn, update) {
    const { connection, lastDisconnect } = update;

    if (update.receivedPendingNotifications) {
        msgQueue = msgQueue.then(() => {
            if (backfillCount) console.log(chalk.green(`📥 ${backfillCount} mensaje(s) recuperados de cuando el bot estaba apagado`));
            backfillCount = 0;
        });
    }

    if (connection === 'open') {
        reconnectAttempts = 0;
        connGlobal    = conn;
        connectedAt   = Date.now();
        backfillCount = 0;
        console.log(chalk.green(`✅ Conectado como ${conn.user?.id?.split(':')[0]}`));
        handler.init(config);
        if (!pluginsLoaded) { pluginsLoaded = true; await handler.loadPlugins(); }
        console.log(chalk.green('🚀 Bot activo\n'));
        flushSpool();
    } else if (connection === 'close') {
        if (connGlobal === conn) connGlobal = null;
        const code = new Boom(lastDisconnect?.error)?.output?.statusCode;

        if (code === DisconnectReason.loggedOut) {
            console.log(chalk.red('🛑 Sesión cerrada desde el teléfono. Borra la carpeta ./sesion y reinicia para vincular de nuevo.\n'));
            return;
        }
        if (code === DisconnectReason.connectionReplaced) {
            console.log(chalk.red('🛑 La sesión se abrió en otro lugar (¿otro bot corriendo con la misma sesión?). Cierra la otra instancia y reinicia.\n'));
            return;
        }
        scheduleReconnect(code).catch(e => console.log(chalk.red('❌ Reconexión: ' + e.message)));
    } else if (connection === 'connecting') {
        dbg(chalk.blue('⏳ Conectando...'));
    }
}

// ========================
// 🚀 CONECTAR WHATSAPP
// ========================
async function connectToWhatsApp() {
    if (connecting) return;
    connecting = true;
    try {
        return await buildSocket();
    } catch (e) {
        console.error(chalk.red(`\n❌ Error al conectar: ${e.message}\n`));
        scheduleReconnect().catch(() => {});
    } finally {
        connecting = false;
    }
}

async function buildSocket() {
    const { state, saveCreds } = await useMultiFileAuthState('./sesion');
    let version;
    try { ({ version } = await fetchLatestBaileysVersion()); } catch {}   // si falla, usa la versión por defecto

    const conn = makeWASocket({
        ...(version ? { version } : {}),
        logger,
        printQRInTerminal: false,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        ...(state.creds.registered ? { browser: Browsers.android('Chrome') } : {}),
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true,
        defaultQueryTimeoutMs: 60000,   // antes sin límite: una consulta colgada bloqueaba todo
        connectTimeoutMs: 60000,
        syncFullHistory: false,
        getMessage: async () => undefined,
    });

    if (!conn.authState.creds.registered) await generatePairingCode(conn);

    conn.ev.on('connection.update', (update) => handleConnectionUpdate(conn, update));
    conn.ev.on('creds.update',      saveCreds);
    attachContacts(conn);

    conn.ev.on('messages.reaction', (list) => list.forEach(r => post('/reaction', {
        chatId: r.key.remoteJid, msgId: r.key.id,
        from:   r.reaction.key?.participant || r.reaction.key?.remoteJid,
        fromMe: !!r.reaction.key?.fromMe,
        emoji:  r.reaction.text || ''
    })));

    conn.ev.on('presence.update', ({ id, presences }) => post('/presence', {
        chatId: id,
        list: Object.entries(presences || {}).map(([jid, p]) => ({ jid, state: p.lastKnownPresence || p.lastPresence }))
    }, { critical: false }));

    conn.ev.on('messages.update', (list) => list.forEach(u => {
        // 1) ticks de entrega
        if (u.update?.status != null && u.key?.fromMe) {
            post('/msg-status', { chatId: u.key.remoteJid, msgId: u.key.id, status: u.update.status }, { critical: false });
        }
        const um = u.update?.message;
        if (!um || typeof um !== 'object') return;

        // 2) ediciones
        const em = um.editedMessage?.message || um.protocolMessage?.editedMessage;
        if (em) {
            const text = em.conversation || em.extendedTextMessage?.text || em.imageMessage?.caption || em.videoMessage?.caption;
            if (text) post('/msg-edit', { chatId: u.key.remoteJid, msgId: u.key.id, text });
            return;
        }

        // 3) llegó el contenido real de un placeholder (viewOnce, media reenviada)
        if (u.update?.status != null) return;
        const hasRealContent = um.imageMessage || um.videoMessage || um.audioMessage || um.documentMessage
            || um.viewOnceMessage || um.viewOnceMessageV2 || um.viewOnceMessageV2Extension || um.stickerMessage;
        if (!hasRealContent) return;
        dbg(chalk.cyan('📬 Contenido real llegó por messages.update: ' + u.key?.id));
        const fakeMsg = { key: u.key, message: um, messageTimestamp: Math.floor(Date.now() / 1000) };
        msgQueue = msgQueue.then(() => handleOne(conn, fakeMsg, 'notify')).catch(e => console.log(chalk.red('❌ Cola (update): ' + e.message)));
    }));

    conn.ev.on('messaging-history.set', ({ messages }) => {
        const cutoff = Date.now() - 3 * 24 * 3600e3;
        const list = (messages || [])
            .filter(m => m?.message && m.key?.remoteJid && m.key.remoteJid !== 'status@broadcast' && tsOf(m) >= cutoff)
            .sort((a, b) => tsOf(a) - tsOf(b)).slice(-300);
        if (list.length) dbg(chalk.cyan('📥 Historial recibido: ' + list.length + ' mensajes'));
        for (const m of list) { rememberSecret(m); msgQueue = msgQueue.then(() => handleOne(conn, m, 'append')).catch(() => {}); }
    });

    conn.ev.on('group-participants.update', ({ id, participants, action, author }) => {
        const ids = (participants || []).map(p => typeof p === 'string' ? p : p.id);
        post('/api/system-event', { chatId: id, action, participants: ids, author });
    });

    conn.ev.on('groups.update', (list) => list.forEach(u => {
        if (u.subject) groupNames.set(u.id, { name: u.subject, exp: Date.now() + 10 * 60e3 });
        const say = text => post('/api/system-event', { chatId: u.id, text });
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
        post('/call', {
            id, status,
            from:    c.attrs.caller_pn || undefined,
            name:    n.attrs.notify || undefined,
            isVideo: !!c.content?.some?.(x => x.tag === 'video'),
            isGroup: !!c.attrs['group-jid'],
            date:    (+n.attrs.t || 0) * 1000 || Date.now()
        });
    });

    conn.ev.on('messages.upsert', (data) => handleMessages(conn, data));
    conn.ws.on('error', () => dbg(chalk.yellow('⚠️  Error de socket')));

    return conn;
}
