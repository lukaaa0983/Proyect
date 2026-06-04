import {
    makeWASocket,
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    downloadMediaMessage,
    delay
} from '@whiskeysockets/baileys';
import pino from 'pino';
import chalk from 'chalk';
import axios from 'axios';
import { Boom } from '@hapi/boom';
import config from './config.js';
import { Handler } from './handler.js';

const logger  = pino({ level: 'silent', stream: { write: () => {} } });
const handler = new Handler();
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY        = 5000;
let isReady    = false;
let connGlobal = null;

// ========================
// 🌐 EXPORTS
// ========================
export function getConn() { return connGlobal; }

export async function sendToWhatsApp(chatId, content, replyTo = null) {
    if (!connGlobal) throw new Error('Bot no conectado');
    const options = {};
    if (replyTo?.waMessageKey) options.quoted = { key: replyTo.waMessageKey };
    await connGlobal.sendMessage(chatId, { text: content }, options);
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
        await axios.post('http://localhost:3000/message', data);
    } catch (e) {
        console.log(chalk.yellow(`⚠️  Panel no disponible: ${e.message}`));
    }
}

// ========================
// 💬 PROCESAR MENSAJE
// ========================
async function processMessage(conn, message) {
    if (!message?.message) return;

    const raw = message.message;

    // ── Ignorar mensajes de sistema ──
    if (raw.senderKeyDistributionMessage) return;

    // ── Detectar REVOKE (mensaje borrado) ──
    if (raw.protocolMessage?.type === 0) {
        const deletedId = raw.protocolMessage.key?.id;
        const chatId    = message.key.remoteJid;
        console.log(chalk.yellow(`🗑️ Borrado: ${deletedId}`));
        await sendToPanel({
            from:       chatId,
            type:       'revoke',
            deletedId,
            pushName:   message.pushName || chatId,
            senderName: message.pushName || 'Desconocido',
            senderId:   message.key.participant || chatId,
            isGroup:    chatId.endsWith('@g.us'),
            fromMe:     message.key.fromMe || false,
            timestamp:  Date.now()
        });
        return;
    }

    // Ignorar otros protocolMessage
    if (raw.protocolMessage) return;

    // ── Desenvolver viewOnce ──
    let msgContent = raw;
    let isViewOnce = false;

    if (raw.viewOnceMessageV2?.message)          { msgContent = raw.viewOnceMessageV2.message;          isViewOnce = true; }
    else if (raw.viewOnceMessageV2Extension?.message) { msgContent = raw.viewOnceMessageV2Extension.message; isViewOnce = true; }
    else if (raw.imageMessage?.viewOnce || raw.videoMessage?.viewOnce || raw.audioMessage?.viewOnce) { isViewOnce = true; }

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

        if      (msgContent.conversation)        { text = msgContent.conversation; }
        else if (msgContent.extendedTextMessage) { text = msgContent.extendedTextMessage.text; }
        else if (msgContent.imageMessage)        { msgType = 'image';    text = msgContent.imageMessage.caption    || ''; mediaUrl = await downloadMedia(conn, msgForDownload); }
        else if (msgContent.videoMessage)        { msgType = 'video';    text = msgContent.videoMessage.caption    || ''; mediaUrl = await downloadMedia(conn, msgForDownload); }
        else if (msgContent.audioMessage)        { msgType = 'audio';    mediaUrl = await downloadMedia(conn, msgForDownload); }
        else if (msgContent.documentMessage)     { msgType = 'document'; fileName = msgContent.documentMessage.fileName || 'archivo'; mediaUrl = await downloadMedia(conn, msgForDownload); }
        else if (msgContent.stickerMessage)      { msgType = 'sticker';  mediaUrl = await downloadMedia(conn, msgForDownload); }

        await sendToPanel({
            from: chatId, type: msgType, text, content: text,
            mediaUrl, fileName, pushName: chatName,
            senderId, senderName, isGroup, fromMe,
            isViewOnce, waMessageKey: message.key
        });

    } catch (e) {
        console.log(chalk.red(`❌ Error procesando: ${e.message}`));
    }
}

// ========================
// 🔌 MANEJO DE CONEXIÓN
// ========================
async function handleConnectionUpdate(update) {
    const { connection, lastDisconnect } = update;

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
        console.log(chalk.green('✅ Conectado'));
        console.log(chalk.cyan(`  📱 ${this.user?.id.split(':')[0]}\n`));
        handler.init(config);
        await handler.loadPlugins();
        console.log(chalk.green('🚀 Bot activo\n'));

        // ── Suscribirse a presencia de todos los chats ──
        setTimeout(async () => {
            try {
                const res    = await axios.get('http://localhost:3000/chats')
                const chats  = res.data
                const ids    = Object.keys(chats).filter(id => !id.endsWith('@g.us'))
                for (const id of ids) {
                    try { await this.presenceSubscribe(id) } catch {}
                }
                console.log(chalk.cyan(`👤 Suscrito a presencia de ${ids.length} contactos\n`))
            } catch {}
        }, 4000)

    } else if (connection === 'connecting') {
        console.log(chalk.blue('⏳ Conectando...\n'));
    }
}

// ========================
// 👤 PRESENCIA (en línea)
// ========================
async function handlePresence(conn, { id, presences }) {
    if (!isReady) return;

    for (const [participant, presence] of Object.entries(presences)) {
        const status    = presence.lastKnownPresence // 'available', 'unavailable', 'composing', 'recording'
        const lastSeen  = presence.lastSeen || null
        const chatId    = id

        console.log(chalk.cyan(`👤 ${participant}: ${status}`))

        try {
            await axios.post('http://localhost:3000/presence', {
                chatId,
                participant,
                status,
                lastSeen
            })
        } catch {}
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
            browser: ['Ubuntu', 'Chrome', '20.0.04'],
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: true,
            defaultQueryTimeoutMs: undefined,
            syncFullHistory: false,
            getMessage: async () => undefined,
        });

        connGlobal = conn;
        if (!conn.authState.creds.registered) await generatePairingCode(conn);

        conn.ev.on('connection.update', handleConnectionUpdate.bind(conn));
        conn.ev.on('creds.update',      saveCreds);
        conn.ev.on('messages.upsert',   (data) => handleMessages(conn, data));
        conn.ev.on('presence.update',   (data) => handlePresence(conn, data));
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

// ========================
// 💬 MENSAJES ENTRANTES
// ========================
async function handleMessages(conn, { messages, type }) {
    if (type !== 'notify' || !messages[0]?.message) return;
    if (!isReady) return;
    const message = messages[0];
    await processMessage(conn, message);
    try {
        await handler.handleMessage(conn, message, config);
    } catch (e) {
        console.error(chalk.red(`❌ Handler: ${e.message}`));
    }
}

// ========================
// ▶️ INIT
// ========================
(async () => {
    showBanner();
    suppressLogs();
    process.on('unhandledRejection', e => console.error(chalk.red('❌ Unhandled:'), e));
    process.on('uncaughtException',  e => console.error(chalk.red('❌ Uncaught:'),  e));
    await connectToWhatsApp();
})();
