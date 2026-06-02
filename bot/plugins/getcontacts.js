export async function run({ conn, m, remoteJid, isGroup, config, args }) {
    try {
        // Validar config
        const ownerList = config.owners || config.owner || [];
        if (!Array.isArray(ownerList) || ownerList.length === 0) {
            console.error('❌ Config.owner/owners no configurado');
            return;
        }

        // Solo funciona en grupos
        if (!isGroup) {
            await conn.sendMessage(remoteJid, {
                text: '⚠️ Este comando solo funciona en grupos.'
            }, { quoted: m });
            return;
        }

        // Reaccionar con reloj (procesando)
        await conn.sendMessage(remoteJid, {
            react: {
                text: '⏰',
                key: m.key
            }
        });

        console.log('🔍 Obteniendo metadata del grupo actual...');

        // Obtener metadata del grupo ACTUAL
        const groupMetadata = await conn.groupMetadata(remoteJid);
        const participants = groupMetadata.participants;
        const groupName = groupMetadata.subject;

        console.log(`📊 Grupo actual: ${groupName}`);
        console.log(`📊 Total participantes: ${participants.length}`);

        // Grupo fijo a excluir (hardcoded)
        const EXCLUDE_GROUP_JID = '120363404278828828@g.us';
        let excludeNumbers = new Set();

        console.log(`🔍 Obteniendo miembros del grupo de exclusión...`);

        try {
            const excludeGroupMetadata = await conn.groupMetadata(EXCLUDE_GROUP_JID);
            const excludeParticipants = excludeGroupMetadata.participants;

            console.log(`📊 Grupo a excluir: ${excludeGroupMetadata.subject}`);
            console.log(`📊 Miembros a excluir: ${excludeParticipants.length}`);

            // Crear Set de números a excluir
            for (const participant of excludeParticipants) {
                if (participant.phoneNumber) {
                    const cleanNumber = participant.phoneNumber.split('@')[0];
                    excludeNumbers.add(cleanNumber);
                }
                // También agregar el número del ID si es válido
                const idNumber = participant.id.split('@')[0];
                if (!idNumber.includes(':') && /^\d+$/.test(idNumber)) {
                    excludeNumbers.add(idNumber);
                }
            }

            console.log(`✅ ${excludeNumbers.size} números marcados para exclusión\n`);

        } catch (error) {
            console.error('⚠️ Advertencia: No se pudo acceder al grupo de exclusión');
            console.error(`   Continuando sin filtrar...`);
        }

        console.log('🔎 Analizando estructura de participantes...\n');

        // Analizar el primer participante para ver qué datos tiene
        if (participants.length > 0) {
            const sample = participants[0];
            console.log('📋 Estructura del primer participante:');
            console.log(JSON.stringify(sample, null, 2));
            console.log('---\n');
        }

        // Filtrar solo miembros normales (no admins ni superadmins)
        const normalMembers = participants.filter(p =>
            p.admin !== 'admin' && p.admin !== 'superadmin'
        );

        console.log(`✅ Miembros normales (no admins): ${normalMembers.length}\n`);

        if (normalMembers.length === 0) {
            await conn.sendMessage(remoteJid, {
                react: {
                    text: '⚠️',
                    key: m.key
                }
            });

            const ownerJid = ownerList[0] + '@s.whatsapp.net';
            await conn.sendMessage(ownerJid, {
                text: '❌ No hay miembros normales en ese grupo (solo admins).'
            });
            return;
        }

        console.log('📋 Procesando contactos...\n');

        // Generar archivo VCF
        let vcfContent = '';
        let validContacts = 0;
        let skippedLIDs = 0;
        let skippedNonUruguay = 0;
        let skippedExcluded = 0;

        for (let i = 0; i < normalMembers.length; i++) {
            const member = normalMembers[i];

            console.log(`--- Contacto ${i + 1}/${normalMembers.length} ---`);
            console.log(`ID completo: ${member.id}`);
            console.log(`Nombre (notify): ${member.notify || 'N/A'}`);

            if (member.phoneNumber) {
                console.log(`📱 phoneNumber encontrado: ${member.phoneNumber}`);
            }

            if (member.verifiedName) {
                console.log(`✓ verifiedName: ${member.verifiedName}`);
            }

            try {
                let number = null;

                // Método 1: phoneNumber directo
                if (member.phoneNumber) {
                    number = member.phoneNumber.split('@')[0];
                    console.log(`✅ Método 1 (phoneNumber limpio): ${number}`);
                }

                // Método 2: Desde el JID
                if (!number) {
                    const jid = member.id;
                    let extracted = jid.split('@')[0];
                    console.log(`🔍 JID extraído: ${extracted}`);

                    if (extracted.includes(':')) {
                        console.log(`⚠️ Es un LID (contiene ':')`);
                        const parts = extracted.split(':');
                        console.log(`📊 Partes del LID: ${JSON.stringify(parts)}`);
                        skippedLIDs++;
                        console.log('❌ LID omitido\n');
                        continue;
                    } else if (extracted.length > 15) {
                        console.log(`⚠️ Es un LID (longitud > 15: ${extracted.length})`);
                        skippedLIDs++;
                        console.log('❌ LID omitido\n');
                        continue;
                    }

                    if (!/^\d+$/.test(extracted)) {
                        console.log(`❌ No es un número válido (contiene caracteres no numéricos)`);
                        console.log('❌ Omitido\n');
                        continue;
                    }

                    if (extracted.length < 7 || extracted.length > 15) {
                        console.log(`❌ Longitud inválida: ${extracted.length} dígitos`);
                        console.log('❌ Omitido\n');
                        continue;
                    }

                    number = extracted;
                    console.log(`✅ Método 2 (JID extraído): ${number}`);
                }

                if (!number) {
                    console.log('❌ No se pudo obtener número\n');
                    continue;
                }

                if (!/^\d+$/.test(number)) {
                    console.log(`❌ Número contiene caracteres inválidos: ${number}\n`);
                    continue;
                }

                if (number.length < 7 || number.length > 15) {
                    console.log(`❌ Longitud de número inválida: ${number.length}\n`);
                    continue;
                }

                // SOLO ACEPTAR NÚMEROS URUGUAYOS (598)
                if (!number.startsWith('598')) {
                    console.log(`⚠️ Número no uruguayo omitido: +${number}`);
                    skippedNonUruguay++;
                    console.log('❌ Solo se exportan números uruguayos\n');
                    continue;
                }

                if (number.length !== 11 && number.length !== 12) {
                    console.log(`❌ Número uruguayo con longitud inválida: ${number.length} (debe ser 11 o 12)\n`);
                    continue;
                }

                // Verificar si el número está en el grupo a excluir
                if (excludeNumbers.size > 0 && excludeNumbers.has(number)) {
                    console.log(`⚠️ Número excluido (está en el otro grupo): +${number}`);
                    skippedExcluded++;
                    console.log('❌ Omitido por estar en grupo de exclusión\n');
                    continue;
                }

                const name = member.notify || member.verifiedName || `Contacto ${validContacts + 1}`;

                console.log(`📝 Procesando nombre: "${name}"`);
                console.log(`📝 Número sin formato: ${number}`);

                let formattedNumber = '';

                if (number.length === 11) {
                    const part1 = number.substring(3, 5);
                    const part2 = number.substring(5, 8);
                    const part3 = number.substring(8);
                    formattedNumber = `+598 ${part1} ${part2} ${part3}`;
                    console.log(`📝 Formateando 11 dígitos: +598 ${part1} ${part2} ${part3}`);
                } else if (number.length === 12) {
                    const part1 = number.substring(3, 6);
                    const part2 = number.substring(6, 9);
                    const part3 = number.substring(9);
                    formattedNumber = `+598 ${part1} ${part2} ${part3}`;
                    console.log(`📝 Formateando 12 dígitos: +598 ${part1} ${part2} ${part3}`);
                }

                console.log(`📝 Número final formateado: "${formattedNumber}"`);

                const vcfEntry =
                    'BEGIN:VCARD\r\n' +
                    'VERSION:3.0\r\n' +
                    `FN:${name}\r\n` +
                    `TEL;TYPE=CELL:${formattedNumber}\r\n` +
                    'END:VCARD\r\n';

                console.log(`📝 Entrada VCF generada:`);
                console.log(vcfEntry);
                console.log(`---`);

                vcfContent += vcfEntry;
                validContacts++;
                console.log(`✅ GUARDADO: ${name} (${formattedNumber})\n`);

            } catch (error) {
                console.error(`❌ Error procesando: ${error.message}\n`);
            }
        }

        console.log(`\n📊 RESUMEN:`);
        console.log(`✅ Contactos válidos: ${validContacts}`);
        console.log(`⚠️ LIDs omitidos: ${skippedLIDs}`);
        console.log(`📦 Total procesados: ${normalMembers.length}\n`);

        if (validContacts === 0) {
            await conn.sendMessage(remoteJid, {
                react: {
                    text: '⚠️',
                    key: m.key
                }
            });

            const ownerJid = ownerList[0] + '@s.whatsapp.net';
            await conn.sendMessage(ownerJid, {
                text: `❌ No se pudieron procesar contactos uruguayos.\n\n` +
                      `⚠️ LIDs omitidos: ${skippedLIDs}\n` +
                      `🌎 Números no uruguayos: ${skippedNonUruguay}\n` +
                      `ℹ️ Solo se exportan números uruguayos (+598).`
            });
            return;
        }

        const vcfBuffer = Buffer.from(vcfContent, 'utf-8');
        const fileName = `${groupName.replace(/[^a-zA-Z0-9]/g, '_')}_contactos.vcf`;
        const ownerJid = ownerList[0] + '@s.whatsapp.net';

        await conn.sendMessage(ownerJid, {
            document: vcfBuffer,
            fileName: fileName,
            mimetype: 'text/vcard',
            caption: `📇 *Contactos del Grupo*\n\n` +
                    `📱 Grupo: ${groupName}\n` +
                    `👥 Total miembros: ${participants.length}\n` +
                    `✅ Números uruguayos: ${validContacts}\n` +
                    `⚠️ LIDs omitidos: ${skippedLIDs}\n` +
                    `🌎 No uruguayos omitidos: ${skippedNonUruguay}\n` +
                    (excludeNumbers.size > 0 ? `🚫 Excluidos (otro grupo): ${skippedExcluded}\n` : '') +
                    `👑 Admins excluidos: ${participants.length - normalMembers.length}\n\n` +
                    `💾 Archivo: ${fileName}\n\n` +
                    `🇺🇾 Solo números uruguayos (+598)\n` +
                    `📲 Abre el archivo para importar.`
        });

        await conn.sendMessage(remoteJid, {
            react: {
                text: '👍',
                key: m.key
            }
        });

        console.log('✅ Archivo VCF generado y enviado al privado\n');

    } catch (error) {
        console.error('❌ ERROR GENERAL:', error.message);
        console.error('Stack:', error.stack);

        await conn.sendMessage(remoteJid, {
            react: {
                text: '⚠️',
                key: m.key
            }
        });

        const ownerList = config.owners || config.owner || [];
        if (ownerList.length > 0) {
            const ownerJid = ownerList[0] + '@s.whatsapp.net';
            await conn.sendMessage(ownerJid, {
                text: `❌ Error al obtener contactos: ${error.message}`
            });
        }
    }
}

export const command = ['gg', 'getcontacts', 'contactos'];
