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

const logger = pino({ level: 'silent', stream: { write: () => {} } });
const handler = new Handler();
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 5000;
let isReady = false;

// ========================
// 🌐 CONEXIÓN GLOBAL
// Expuesta para que server.js pueda usarla
// ========================
let connGlobal = null;

export function getConn() {
    return connGlobal;
}

// ========================
// 📤 ENVIAR MENSAJE A WHATSAPP
// Llamado desde server.js cuando el panel envía
// ========================
export async function sendToWhatsApp(chatId, content, replyTo = null) {
    if (!connGlobal) throw new Error('Bot no conectado');

    const options = {}

    // Si hay reply, construir la cita
    if (replyTo?.waMessageKey) {
        options.quoted = { key: replyTo.waMessageKey }
    }

    await connGlobal.sendMessage(chatId, { text: content }, options);
}

// ========================
// 🎨 BANNER
// ========================
function showBanner() {
    console.clear();
    console.log(chalk.yellow.bold('╔════════════════════════════════════════╗'));
    console.log(chalk.yellow.bold('║       BOT WHATSAPP BASE v1.0           ║'));
    console.log(chalk.yellow.bold('╚════════════════════════════════════════╝\n'));
    console.log(chalk.cyan(`  🤖 ${config.botName}`));
    console.log(chalk.cyan(`  📱 ${config.number}`));
    console.log(chalk.cyan(`  ⚙️  Prefijo: ${config.prefix}\n`));
}

// ========================
// 🔇 SUPRIMIR LOGS
// ========================
function suppressLogs() {
    const originalLog = console.log;
    const originalError = console.error;
    const suppressPatterns = [
        'Closing open session', 'SessionEntry',
        'chainKey', 'ephemeralKeyPair', 'baseKey'
    ];

    console.info = console.debug = console.warn = () => {};

    console.log = (...args) => {
        const msg = args.join(' ');
        if (suppressPatterns.some(p => msg.includes(p))) return;
        originalLog(...args);
    };

    console.error = (...args) => {
        const msg = args.join(' ');
        if (suppressPatterns.some(p => msg.includes(p))) return;
        originalError(...args);
    };
}

// ========================
// 📲 CÓDIGO DE EMPAREJAMIENTO
// ========================
async function generatePairingCode(conn) {
    const phoneNumber = config.number?.replace(/[^0-9]/g, '');
    if (!phoneNumber) {
        console.log(chalk.red('❌ Configura el número en config.js\n'));
        process.exit(1);
    }
    await delay(2000);
    const code = await conn.requestPairingCode(phoneNumber);
    console.log(chalk.green.bold(`  📲 CÓDIGO: ${code}\n`));
    console.log(chalk.gray('  WhatsApp > Dispositivos > Vincular dispositivo\n'));
}

// ========================
// 🖼️ DESCARGAR MULTIMEDIA
// Convierte media de WhatsApp a base64
// ========================
async function downloadMedia(conn, message) {
    try {
        const buffer = await downloadMediaMessage(
            message,
            'buffer',
            {},
            { logger, reuploadRequest: conn.updateMediaMessage }
        );

        if (!buffer) return null;

        const msg = message.message;
        let mimeType = 'application/octet-stream';

        if (msg.imageMessage)    mimeType = msg.imageMessage.mimetype    || 'image/jpeg';
        if (msg.videoMessage)    mimeType = msg.videoMessage.mimetype    || 'video/mp4';
        if (msg.audioMessage)    mimeType = msg.audioMessage.mimetype    || 'audio/ogg';
        if (msg.documentMessage) mimeType = msg.documentMessage.mimetype || 'application/octet-stream';
        if (msg.stickerMessage)  mimeType = msg.stickerMessage.mimetype  || 'image/webp';

        const base64 = buffer.toString('base64');
        return `data:${mimeType};base64,${base64}`;

    } catch (e) {
        console.log(chalk.yellow(`⚠️  Error descargando media: ${e.message}`));
        return null;
    }
}

// ========================
// 🔌 MANEJO DE CONEXIÓN
// ========================
async function handleConnectionUpdate(update) {
    const { connection, lastDisconnect } = update;

    if (connection === 'close') {
        const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        if (shouldReconnect) {
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
    }
    else if (connection === 'open') {
        reconnectAttempts = 0;
        isReady = true;

        console.log(chalk.green('✅ Conectado'));
        console.log(chalk.cyan(`  📱 ${this.user?.id.split(':')[0]}\n`));

        handler.init(config);
        await handler.loadPlugins();

        console.log(chalk.green('🚀 Bot activo\n'));
    }
    else if (connection === 'connecting') {
        console.log(chalk.blue('⏳ Conectando...\n'));
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
// 💬 MENSAJES ENTRANTES
// ========================
async function handleMessages(conn, { messages, type }) {
    if (type !== 'notify' || !messages[0]?.message) return;

    // 🔑 Bloquear mensajes históricos
    if (!isReady) return;

    const message = messages[0];
    const msgContent = message.message;

    try {
        const chatId   = message.key.remoteJid;
        const isGroup  = chatId.endsWith('@g.us');
        const fromMe   = message.key.fromMe || false;
        const senderId = message.key.participant || chatId;
        const senderName = message.pushName || 'Desconocido';

        // Nombre del chat
        let chatName = chatId;
        try {
            if (isGroup) {
                const metadata = await conn.groupMetadata(chatId);
                chatName = metadata.subject;
            } else {
                chatName = message.pushName || chatId;
            }
        } catch {}

        // ── Detectar tipo de mensaje ──
        let msgType    = 'text';
        let text       = '';
        let mediaUrl   = null;
        let fileName   = null;

        if (msgContent.conversation) {
            text = msgContent.conversation;

        } else if (msgContent.extendedTextMessage) {
            text = msgContent.extendedTextMessage.text;

        } else if (msgContent.imageMessage) {
            msgType  = 'image';
            text     = msgContent.imageMessage.caption || '';
            mediaUrl = await downloadMedia(conn, message);

        } else if (msgContent.videoMessage) {
            msgType  = 'video';
            text     = msgContent.videoMessage.caption || '';
            mediaUrl = await downloadMedia(conn, message);

        } else if (msgContent.audioMessage) {
            msgType  = 'audio';
            mediaUrl = await downloadMedia(conn, message);

        } else if (msgContent.documentMessage) {
            msgType   = 'document';
            fileName  = msgContent.documentMessage.fileName || 'archivo';
            mediaUrl  = await downloadMedia(conn, message);

        } else if (msgContent.stickerMessage) {
            msgType  = 'sticker';
            mediaUrl = await downloadMedia(conn, message);

        } else {
            text = '[Tipo no soportado]';
        }

        // ── Enviar al panel ──
        await sendToPanel({
            from:      chatId,
            type:      msgType,
            text,
            content:   text,
            mediaUrl,
            fileName,
            pushName:  chatName,
            senderId,
            senderName,
            isGroup,
            fromMe,
            // Guardamos la key para poder citar en reply futuro
            waMessageKey: message.key
        });

    } catch (e) {
        console.log(chalk.red(`❌ Error procesando mensaje: ${e.message}`));
    }

    // ── Procesar comando del bot ──
    try {
        await handler.handleMessage(conn, message, config);
    } catch (error) {
        console.error(chalk.red(`❌ Error en handler: ${error.message}`));
    }
}

// ========================
// 🚀 CONECTAR WHATSAPP
// ========================
async function connectToWhatsApp() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('./sesion');
        const { version } = await fetchLatestBaileysVersion();

        const conn = makeWASocket({
            version,
            logger,
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

        // Guardar conexión global
        connGlobal = conn;

        if (!conn.authState.creds.registered) {
            await generatePairingCode(conn);
        }

        conn.ev.on('connection.update', handleConnectionUpdate.bind(conn));
        conn.ev.on('creds.update', saveCreds);
        conn.ev.on('messages.upsert', (data) => handleMessages(conn, data));

        conn.ws.on('error', () => {
            console.error(chalk.yellow('⚠️  Error de socket, reconectando...'));
        });

        return conn;

    } catch (error) {
        console.error(chalk.red(`\n❌ Error: ${error.message}\n`));

        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            console.log(chalk.yellow(`🔄 Reintentando... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})\n`));
            await delay(RECONNECT_DELAY);
            return connectToWhatsApp();
        }

        process.exit(1);
    }
}

// ========================
// ▶️ INIT
// ========================
(async () => {
    showBanner();
    suppressLogs();

    process.on('unhandledRejection', (error) => {
        console.error(chalk.red('❌ Error no manejado:'), error);
    });

    process.on('uncaughtException', (error) => {
        console.error(chalk.red('❌ Excepción no capturada:'), error);
    });

    await connectToWhatsApp();
})();
