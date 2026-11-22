import { downloadMediaMessage } from '@whiskeysockets/baileys';
import chalk from 'chalk';
import axios from 'axios';

// Desenvuelve los distintos formatos de "ver una vez" (v1, v2, v2 extension)
function unwrap(msg) {
    return msg?.viewOnceMessage?.message || msg?.viewOnceMessageV2?.message || msg?.viewOnceMessageV2Extension?.message || null;
}

// Encuentra el contenido de media "ver una vez" dentro de un mensaje, venga envuelto o directo
function getMedia(msg) {
    if (!msg) return null;
    const wrapped  = unwrap(msg);
    const isWrapped = !!wrapped;
    const u = wrapped || msg;
    if (u.imageMessage && (isWrapped || u.imageMessage.viewOnce)) return { type: 'image', media: u.imageMessage };
    if (u.videoMessage && (isWrapped || u.videoMessage.viewOnce)) return { type: 'video', media: u.videoMessage };
    if (u.audioMessage && (isWrapped || u.audioMessage.viewOnce)) return { type: 'audio', media: u.audioMessage };
    return null;
}

export async function run({ conn, m, config }) {
    try {
        const raw = m.message;
        if (!raw) return;

        // ── CASO 1: viewOnce directo en el mensaje ──
        let found = getMedia(raw);
        let downloadKey = m.key;

        // ── CASO 2: viewOnce citado (alguien respondió al viewOnce) ──
        if (!found) {
            const ci = raw.extendedTextMessage?.contextInfo
                     || raw.imageMessage?.contextInfo
                     || raw.videoMessage?.contextInfo
                     || raw.audioMessage?.contextInfo;
            const quoted = ci?.quotedMessage;
            if (quoted) {
                const qFound = getMedia(quoted);
                if (qFound) {
                    found = qFound;
                    downloadKey = { remoteJid: m.key.remoteJid, id: ci.stanzaId, participant: ci.participant };
                }
            }
        }

        if (!found) return;
        const { type: mediaType, media: mediaMessage } = found;

        console.log(chalk.magenta(`👁️ ViewOnce detectado: ${mediaType}`));

        // Mensaje "mínimo": solo el tipo de media correspondiente, sin envolturas ni
        // campos extra que puedan confundir a Baileys sobre qué tipo de contenido es.
        // (Antes se clonaba/"limpiaba" el mensaje entero y eso rompía la descarga.)
        const downloadMsg = { key: downloadKey, message: { [mediaType + 'Message']: mediaMessage } };

        const buffer = await downloadMediaMessage(
            downloadMsg, 'buffer', {},
            { logger: { level: 'silent' }, reuploadRequest: conn.updateMediaMessage }
        );

        if (!buffer) {
            console.log(chalk.yellow('⚠️ ViewOnce: no se pudo descargar'));
            return;
        }

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

        const replyText    = raw.extendedTextMessage?.text || raw.imageMessage?.caption || raw.videoMessage?.caption || '';
        const captionText  = mediaMessage.caption || '';

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
