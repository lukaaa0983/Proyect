export async function run({ conn, m, args, remoteJid, isGroup }) {
    const mensaje = args.length > 0 
        ? `✅ Recibido: ${args.join(' ')}` 
        : '✅ El sistema de plugins funciona correctamente!';
    
    const info = `${mensaje}

📍 Ubicación: ${isGroup ? 'Grupo' : 'Chat privado'}
📊 Args: ${args.length}`;
    
    await conn.sendMessage(remoteJid, { 
        text: info 
    }, { quoted: m });
}

export const command = ["test", "t", "prueba"];
export const owner = false;
