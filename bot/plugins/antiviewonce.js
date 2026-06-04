import { downloadMediaMessage } from '@whiskeysockets/baileys';
import chalk from 'chalk';
import axios from 'axios';

export async function run({ conn, m, config }) {
    try {
        const raw = m.message;
        if (!raw) return;

        // ── Detectar viewOnce automáticamente ──
        let viewOnceMsg  = null;
        let mediaType    = '';
        let mediaMessage = null;

        if (raw.viewOnceMessageV2?.message) {
            viewOnceMsg = raw.viewOnceMessageV2.message;
        } else if (raw.viewOnceMessageV2Extension?.message) {
            viewOnceMsg = raw.viewOnceMessageV2Extension.message;
        } else if (raw.imageMessage?.viewOnce) {
            mediaMessage = raw.imageMessage;
            mediaType    = 'image';
        } else if (raw.videoMessage?.viewOnce) {
            mediaMessage = raw.videoMessage;
            mediaType    = 'video';
        } else if (raw.audioMessage?.viewOnce) {
            mediaMessage = raw.audioMessage;
            mediaType    = 'audio';
        }

        if (viewOnceMsg) {
            if (viewOnceMsg.imageMessage) { mediaMessage = viewOnceMsg.imageMessage; mediaType = 'image'; }
            else if (viewOnceMsg.videoMessage) { mediaMessage = viewOnceMsg.videoMessage; mediaType = 'video'; }
            else if (viewOnceMsg.audioMessage) { mediaMessage = viewOnceMsg.audioMessage; mediaType = 'audio'; }
        }

        if (!mediaMessage || !mediaType) return;

        console.log(chalk.magenta(`👁️ ViewOnce detectado: ${mediaType}`));

        // ── Quitar flag viewOnce para poder descargar ──
        const cleanMessage = { ...raw };
        if (cleanMessage.imageMessage) cleanMessage.imageMessage = { ...cleanMessage.imageMessage, viewOnce: false };
        if (cleanMessage.videoMessage) cleanMessage.videoMessage = { ...cleanMessage.videoMessage, viewOnce: false };
        if (cleanMessage.audioMessage) cleanMessage.audioMessage = { ...cleanMessage.audioMessage, viewOnce: false };
        if (cleanMessage.viewOnceMessageV2) cleanMessage.viewOnceMessageV2 = { message: { ...viewOnceMsg } };

        const msgForDownload = { ...m, message: cleanMessage };

        // ── Descargar ──
        const buffer = await downloadMediaMessage(
            msgForDownload, 'buffer', {},
            { logger: { level: 'silent' }, reuploadRequest: conn.updateMediaMessage }
        );

        if (!buffer) {
            console.log(chalk.yellow('⚠️ ViewOnce: no se pudo descargar'));
            return;
        }

        // ── Convertir a base64 ──
        const mimeMap = { image: 'image/jpeg', video: 'video/mp4', audio: 'audio/ogg' };
        const mime    = mediaMessage.mimetype || mimeMap[mediaType];
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

        // ── Enviar al panel ──
        await axios.post('http://localhost:3000/message', {
            from:      chatId,
            type:      mediaType,
            content:   '',
            text:      '',
            mediaUrl,
            pushName:  chatName,
            senderName,
            senderId,
            isGroup,
            fromMe:    m.key.fromMe || false,
            isViewOnce: true,
            waMessageKey: m.key
        });

        console.log(chalk.magenta(`✅ ViewOnce enviado al panel: ${mediaType}`));

    } catch (error) {
        console.log(chalk.yellow(`⚠️ AntiViewOnce error: ${error.message}`));
    }
}

// Plugin automático - sin comandos
export const command = [];
