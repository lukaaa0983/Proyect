import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Handler - Sistema de gestión de plugins
 */
export class Handler {
    constructor() {
        this.plugins = new Map();
        this.autoPlugins = [];
        this.config = null;
    }

    /**
     * Inicializa el handler con la configuración
     */
    init(config) {
        this.config = config;
    }

    /**
     * Verifica si un número es owner
     */
    isOwner(number) {
        if (!this.config) return false;
        
        // Soportar tanto 'owner' como 'owners'
        const ownerList = this.config.owners || this.config.owner || [];
        const cleanNumber = number.split('@')[0];
        
        return ownerList.includes(cleanNumber);
    }

    /**
     * Carga plugins desde /plugins
     */
    async loadPlugins() {
        const pluginsPath = path.join(__dirname, 'plugins');

        if (!fs.existsSync(pluginsPath)) {
            fs.mkdirSync(pluginsPath, { recursive: true });
            console.log(chalk.yellow('📁 Carpeta plugins/ creada'));
            return;
        }

        const files = fs.readdirSync(pluginsPath).filter(file => file.endsWith('.js'));

        console.log(chalk.cyan('\n  ⚙️  Cargando plugins...\n'));

        for (const file of files) {
            try {
                const filePath = path.join(pluginsPath, file);
                const fileUrl = `file://${filePath}?update=${Date.now()}`;
                const plugin = await import(fileUrl);

                if (!plugin.run) continue;

                const commands = Array.isArray(plugin.command) ? plugin.command : [plugin.command];

                // Plugin automático (sin comandos o array vacío)
                if (!plugin.command || commands.length === 0) {
                    this.autoPlugins.push({
                        run: plugin.run,
                        file: file
                    });
                    console.log(chalk.magenta(`  ⚡ ${file.padEnd(25)} [automático]`));
                    continue;
                }

                // Plugin con comandos
                commands.forEach(cmd => {
                    this.plugins.set(cmd.toLowerCase(), {
                        run: plugin.run,
                        file: file
                    });
                });

                console.log(chalk.green(`  ✓ ${file.padEnd(25)} [${commands.join(', ')}]`));
            } catch (error) {
                console.log(chalk.red(`  ✗ ${file}: ${error.message}`));
            }
        }

        console.log(chalk.cyan(`\n  📦 ${this.plugins.size} comandos cargados`));
        console.log(chalk.magenta(`  ⚡ ${this.autoPlugins.length} plugins automáticos\n`));
    }

    /**
     * Procesa mensajes y ejecuta comandos
     */
    async handleMessage(conn, m, config) {
        try {
            if (!m.message) return;

            // Ejecutar plugins automáticos
            for (const autoPlugin of this.autoPlugins) {
                try {
                    await autoPlugin.run({ conn, m, config });
                } catch (e) {
                    // Silenciar errores
                }
            }

            // Extraer información del mensaje
            const messageType = Object.keys(m.message)[0];
            const body =
                m.message.conversation ||
                m.message[messageType]?.text ||
                m.message[messageType]?.caption ||
                '';

            const remoteJid = m.key.remoteJid;
            if (!remoteJid) return;

            const isGroup = remoteJid.endsWith('@g.us');
            const sender = m.key.fromMe
                ? conn.user?.id?.split(':')[0] + '@s.whatsapp.net'
                : isGroup ? m.key.participant : remoteJid;

            if (!sender) return;

            const pushName = m.pushName || 'Desconocido';
            const senderNumber = sender.split('@')[0];

            // Log del mensaje
            if (body && body.trim()) {
                await this.logMessage(conn, {
                    body,
                    remoteJid,
                    isGroup,
                    pushName,
                    senderNumber
                });
            }

            // Verificar si es comando
            if (!body.startsWith(config.prefix)) return;

            // Verificar si es owner
            if (!this.isOwner(sender)) {
                // Ignorar silenciosamente
                return;
            }

            // Procesar comando
            const args = body.slice(config.prefix.length).trim().split(/ +/);
            const commandName = args.shift().toLowerCase();

            const plugin = this.plugins.get(commandName);
            if (!plugin) return;

            console.log(chalk.cyan(`  ⚡ Ejecutando: ${commandName} (${pushName})`));

            await plugin.run({
                conn,
                m,
                args,
                remoteJid,
                sender,
                isGroup,
                body,
                config,
                pushName
            });

        } catch (error) {
            console.error(chalk.red(`  ❌ Error: ${error.message}`));
        }
    }

    /**
     * Muestra log del mensaje recibido
     */
    async logMessage(conn, { body, remoteJid, isGroup, pushName, senderNumber }) {
        const timestamp = new Date().toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit'
        });

        if (isGroup) {
            let groupName = 'Grupo';
            try {
                const groupMetadata = await conn.groupMetadata(remoteJid);
                if (groupMetadata?.subject) {
                    groupName = groupMetadata.subject;
                }
            } catch (e) {
                // Silenciar error
            }

            console.log(
                chalk.gray(`[${timestamp}] `) +
                chalk.blue(groupName) + chalk.gray(' │ ') +
                chalk.yellow(pushName) + chalk.gray(` (${senderNumber})`) +
                chalk.gray(' │ ') + chalk.white(body)
            );
        } else {
            console.log(
                chalk.gray(`[${timestamp}] `) +
                chalk.green('Privado') + chalk.gray(' │ ') +
                chalk.yellow(pushName) + chalk.gray(` (${senderNumber})`) +
                chalk.gray(' │ ') + chalk.white(body)
            );
        }
    }
}
