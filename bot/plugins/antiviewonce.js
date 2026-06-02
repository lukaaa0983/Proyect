import { downloadMediaMessage } from '@whiskeysockets/baileys';
import chalk from 'chalk';

export async function run({ conn, m, config }) {
    try {
        // Validar que config existe
        if (!config) return;

        // Soportar tanto 'owner' como 'owners'
        const ownerList = config.owners || config.owner || [];
        if (!Array.isArray(ownerList) || ownerList.length === 0) return;

        // Solo el owner puede usar esta función
        const sender = m.key.fromMe
            ? conn.user.id.split(':')[0]
            : m.key.participant?.split('@')[0] || m.key.remoteJid.split('@')[0];

        const isOwner = ownerList.includes(sender);
        if (!isOwner) return;

        // Verificar que el mensaje actual es una respuesta
        const quotedMsg = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quotedMsg) return;

        // Detectar viewonce en el mensaje citado
        let viewOnceMsg = null;
        let mediaType = '';
        let mediaMessage = null;

        // ViewOnce V2
        if (quotedMsg.viewOnceMessageV2) {
            viewOnceMsg = quotedMsg.viewOnceMessageV2.message;
        }
        // ViewOnce V2 Extension
        else if (quotedMsg.viewOnceMessageV2Extension) {
            viewOnceMsg = quotedMsg.viewOnceMessageV2Extension.message;
        }
        // ViewOnce directo en imagen
        else if (quotedMsg.imageMessage?.viewOnce) {
            mediaMessage = quotedMsg.imageMessage;
            mediaType = 'image';
        }
        // ViewOnce directo en video
        else if (quotedMsg.videoMessage?.viewOnce) {
            mediaMessage = quotedMsg.videoMessage;
            mediaType = 'video';
        }
        // ViewOnce directo en audio
        else if (quotedMsg.audioMessage?.viewOnce) {
            mediaMessage = quotedMsg.audioMessage;
            mediaType = 'audio';
        }

        // Si encontramos viewOnceMsg, extraer el medio
        if (viewOnceMsg) {
            if (viewOnceMsg.imageMessage) {
                mediaMessage = viewOnceMsg.imageMessage;
                mediaType = 'image';
            } else if (viewOnceMsg.videoMessage) {
                mediaMessage = viewOnceMsg.videoMessage;
                mediaType = 'video';
            } else if (viewOnceMsg.audioMessage) {
                mediaMessage = viewOnceMsg.audioMessage;
                mediaType = 'audio';
            }
        }

        // Si no es viewonce, salir silenciosamente
        if (!mediaMessage || !mediaType) return;

        // Crear el mensaje para descargar
        const messageToDownload = {
            key: m.message.extendedTextMessage.contextInfo.stanzaId 
                ? {
                    remoteJid: m.key.remoteJid,
                    id: m.message.extendedTextMessage.contextInfo.stanzaId,
                    participant: m.message.extendedTextMessage.contextInfo.participant
                  }
                : m.key,
            message: quotedMsg
        };

        // Descargar el medio
        const buffer = await downloadMediaMessage(
            messageToDownload,
            'buffer',
            {},
            {
                logger: { level: 'silent' },
                reuploadRequest: conn.updateMediaMessage
            }
        );

        if (!buffer) return;

        // Número del owner (tu número privado)
        const ownerJid = ownerList[0] + '@s.whatsapp.net';

        // Enviar al privado del owner según el tipo
        if (mediaType === 'image') {
            await conn.sendMessage(ownerJid, {
                image: buffer,
                caption: '📸 AntiViewOnce capturado'
            });
        } else if (mediaType === 'video') {
            await conn.sendMessage(ownerJid, {
                video: buffer,
                caption: '🎥 AntiViewOnce capturado'
            });
        } else if (mediaType === 'audio') {
            await conn.sendMessage(ownerJid, {
                audio: buffer,
                mimetype: 'audio/mp4',
                ptt: mediaMessage.ptt || false
            });
            await conn.sendMessage(ownerJid, {
                text: '🎵 AntiViewOnce capturado'
            });
        }

        console.log(chalk.magenta('📸 AntiViewOnce capturado'));

    } catch (error) {
        // Silenciar errores
    }
}

// Plugin automático - se ejecuta cuando respondes a mensajes
export const command = [];
