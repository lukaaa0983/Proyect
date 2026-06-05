import { downloadMediaMessage } from '@whiskeysockets/baileys';
import chalk from 'chalk';
import axios from 'axios';

export async function run({ conn, m, config }) {
    try {
        const raw = m.message;
        if (!raw) return;

        let viewOnceMsg  = null;
        let mediaType    = '';
        let mediaMessage = null;
        let captionText  = '';

        // ── CASO 1: viewOnce directo en el mensaje ──
        if (raw.viewOnceMessageV2?.message) {
            viewOnceMsg = raw.viewOnceMessageV2.message;
        } else if (raw.viewOnceMessageV2Extension?.message) {
            viewOnceMsg = raw.viewOnceMessageV2Extension.message;
        } else if (raw.imageMessage?.viewOnce) {
            mediaMessage = raw.imageMessage;
            mediaType    = 'image';
            captionText  = raw.imageMessage.caption || '';
        } else if (raw.videoMessage?.viewOnce) {
            mediaMessage = raw.videoMessage;
            mediaType    = 'video';
            captionText  = raw.videoMessage.caption || '';
        } else if (raw.audioMessage?.viewOnce) {
            mediaMessage = raw.audioMessage;
            mediaType    = 'audio';
        }

        // ── CASO 2: viewOnce en el quotedMessage (alguien respondió el viewOnce) ──
        if (!mediaMessage && !viewOnceMsg) {
            const quoted = raw.extendedTextMessage?.contextInfo?.quotedMessage
                        || raw.imageMessage?.contextInfo?.quotedMessage
                        || raw.videoMessage?.contextInfo?.quotedMessage
                        || raw.audioMessage?.contextInfo?.quotedMessage;

            if (quoted) {
                if (quoted.viewOnceMessageV2?.message) {
                    viewOnceMsg = quoted.viewOnceMessageV2.message;
                } else if (quoted.viewOnceMessageV2Extension?.message) {
                    viewOnceMsg = quoted.viewOnceMessageV2Extension.message;
                } else if (quoted.imageMessage?.viewOnce) {
                    mediaMessage = quoted.imageMessage;
                    mediaType    = 'image';
                    captionText  = quoted.imageMessage.caption || '';
                } else if (quoted.videoMessage?.viewOnce) {
                    mediaMessage = quoted.videoMessage;
                    mediaType    = 'video';
                    captionText  = quoted.videoMessage.caption || '';
                } else if (quoted.audioMessage?.viewOnce) {
                    mediaMessage = quoted.audioMessage;
                    mediaType    = 'audio';
                }
            }
        }

        if (viewOnceMsg) {
            if (viewOnceMsg.imageMessage)      { mediaMessage = viewOnceMsg.imageMessage; mediaType = 'image'; captionText = viewOnceMsg.imageMessage.caption || ''; }
            else if (viewOnceMsg.videoMessage) { mediaMessage = viewOnceMsg.videoMessage; mediaType = 'video'; captionText = viewOnceMsg.videoMessage.caption || ''; }
            else if (viewOnceMsg.audioMessage) { mediaMessage = viewOnceMsg.audioMessage; mediaType = 'audio'; }
        }

        if (!mediaMessage || !mediaType) return;

        console.log(chalk.magenta(`👁️ ViewOnce detectado: ${mediaType}`));

        // ── Quitar flag viewOnce para descargar ──
        const cleanMessage = { ...raw };
        if (cleanMessage.imageMessage) cleanMessage.imageMessage = { ...cleanMessage.imageMessage, viewOnce: false };
        if (cleanMessage.videoMessage) cleanMessage.videoMessage = { ...cleanMessage.videoMessage, viewOnce: false };
        if (cleanMessage.audioMessage) cleanMessage.audioMessage = { ...cleanMessage.audioMessage, viewOnce: false };
        if (cleanMessage.viewOnceMessageV2) cleanMessage.viewOnceMessageV2 = { message: { ...viewOnceMsg } };

        // Si era quoted, construir mensaje descargable con el contenido del quoted
        let msgForDownload = { ...m, message: cleanMessage };

        // Si el viewOnce estaba en el quoted, necesitamos un mensaje especial para descargarlo
        const quoted = raw.extendedTextMessage?.contextInfo
                    || raw.imageMessage?.contextInfo
                    || raw.videoMessage?.contextInfo
                    || raw.audioMessage?.contextInfo;

        if (quoted?.quotedMessage && (
            quoted.quotedMessage.viewOnceMessageV2 ||
            quoted.quotedMessage.viewOnceMessageV2Extension ||
            quoted.quotedMessage.imageMessage?.viewOnce ||
            quoted.quotedMessage.videoMessage?.viewOnce ||
            quoted.quotedMessage.audioMessage?.viewOnce
        )) {
            const cleanQuoted = { ...quoted.quotedMessage };
            if (cleanQuoted.imageMessage) cleanQuoted.imageMessage = { ...cleanQuoted.imageMessage, viewOnce: false };
            if (cleanQuoted.videoMessage) cleanQuoted.videoMessage = { ...cleanQuoted.videoMessage, viewOnce: false };
            if (cleanQuoted.audioMessage) cleanQuoted.audioMessage = { ...cleanQuoted.audioMessage, viewOnce: false };
            if (cleanQuoted.viewOnceMessageV2) cleanQuoted.viewOnceMessageV2 = { message: { ...viewOnceMsg } };

            msgForDownload = {
                key: {
                    remoteJid:   m.key.remoteJid,
                    id:          quoted.stanzaId,
                    participant: quoted.participant
                },
                message: cleanQuoted
            };
        }

        // ── Descargar ──
        const buffer = await downloadMediaMessage(
            msgForDownload, 'buffer', {},
            { logger: { level: 'silent' }, reuploadRequest: conn.updateMediaMessage }
        );

        if (!buffer) {
            console.log(chalk.yellow('⚠️ ViewOnce: no se pudo descargar'));
            return;
        }

        // ── Base64 ──
        const mimeMap  = { image: 'image/jpeg', video: 'video/mp4', audio: 'audio/ogg' };
        const mime     = mediaMessage.mimetype || mimeMap[mediaType];
        const mediaUrl = `data:${mime};base64,${buffer.toString('base64')}`;

        const chatId     = m.key.remoteJid;
        const isGroup    = chatId.endsWith('@g.us');
        const senderName = m.pushName || 'Desconocido';
        const senderId   = m.key.participant || chatId;

        let chatName = chatId;
        try {
            chatName = isGroup
                ? (await conn.groupMetadata(chatId)).subject
                : m.pushName || chatId;
        } catch {}

        // Texto del reply (lo que escribió al responder)
        const replyText = raw.extendedTextMessage?.text
                       || raw.imageMessage?.caption
                       || raw.videoMessage?.caption
                       || '';

        // ── Enviar al panel ──
        await axios.post('http://localhost:3000/message', {
            from:         chatId,
            type:         mediaType,
            content:      captionText || replyText,
            text:         captionText || replyText,
            mediaUrl,
            pushName:     chatName,
            senderName,
            senderId,
            isGroup,
            fromMe:       m.key.fromMe || false,
            isViewOnce:   true,
            waMessageKey: m.key
        });

        console.log(chalk.magenta(`✅ ViewOnce enviado al panel: ${mediaType}${replyText ? ` — "${replyText}"` : ''}`));

    } catch (error) {
        console.log(chalk.yellow(`⚠️ AntiViewOnce error: ${error.message}`));
    }
}

export const command = [];
