# 📡 Proyecto G

Panel web en tiempo real para **monitorear y manejar WhatsApp desde el navegador**. Un bot basado en [Baileys](https://github.com/WhiskeySockets/Baileys) se vincula a tu cuenta como dispositivo y reenvía todo al panel; desde el panel también puedes responder, reaccionar, editar, borrar y administrar grupos.

---

## 🧱 Arquitectura

```
start.js                  ← punto de entrada
└── backend/server.js     ← Express 5 + Socket.io + API (puerto 3000)
    ├── backend/db.js     ← SQLite (node:sqlite) + media en disco
    ├── backend/public/   ← frontend web (HTML/CSS/JS vanilla)
    └── bot/index.js      ← cliente WhatsApp (Baileys), cargado por el servidor
        ├── bot/handler.js    ← sistema de plugins / comandos
        └── bot/plugins/      ← comandos y plugins automáticos
```

El servidor arranca el bot automáticamente (`loadBot()`). El bot le envía los eventos al servidor por HTTP (`localhost:3000`) y el servidor los reparte al panel por Socket.io.

---

## 🛠️ Tecnologías

- **Node.js 22.13+** (usa el módulo nativo `node:sqlite`)
- Express 5, Socket.io 4, CORS
- `@whiskeysockets/baileys` 7.0.0-rc14, axios, pino, chalk
- SQLite (modo WAL) para mensajes y chats
- Frontend vanilla: HTML5 / CSS3 / JavaScript
- *Opcional:* **ffmpeg** (notas de voz → Opus y stickers → WebP)

---

## ⚙️ Instalación

El proyecto tiene dependencias en dos carpetas, hay que instalar en ambas:

```bash
git clone https://github.com/lukaaa0983/Proyect.git
cd Proyect

cd backend && npm install && cd ..
cd bot && npm install && cd ..
```

### Configuración del bot

Edita `bot/config.js`:

```js
export default {
  owners: ["TU_NUMERO"],   // quienes pueden usar comandos (solo dígitos, con código de país)
  prefix: ".",             // prefijo de los comandos
  botName: "Bot Base",
  number: "TU_NUMERO"      // número que se vincula con el código de emparejamiento
}
```

### Contraseña del panel (recomendado)

Crea el archivo `backend/data/pass.txt` con la contraseña en texto plano. Si existe, el panel pide login (cookie `pg_token`). Desde `localhost` no se pide contraseña. **Si el archivo no existe, el panel queda abierto para cualquiera que llegue al puerto 3000.**

---

## ▶️ Ejecución

```bash
npm start        # desde la raíz (ejecuta start.js)
```

Panel: **http://localhost:3000**

**Primera vez:** la consola muestra un **código de emparejamiento**. En WhatsApp ve a *Dispositivos vinculados → Vincular dispositivo → Vincular con número de teléfono* e ingresa el código. La sesión se guarda en `./sesion` (relativa a la carpeta desde donde ejecutas el comando).

---

## ✨ Funcionalidades

### 💬 Mensajería
- Recibir y enviar texto, imágenes, video, audio (notas de voz), stickers y documentos
- Respuestas (citas), reacciones, ubicación, contactos y encuestas
- Estado de entrega de los mensajes, indicador de "escribiendo" y presencia
- Vista previa de enlaces
- Edición de mensajes, incluyendo el formato cifrado nuevo de WhatsApp
- Borrar para mí o para todos; los mensajes eliminados por otros **se conservan** marcados como eliminados
- Captura de mensajes de **"ver una vez"** (imagen, video y audio)
- Recuperación de mensajes pendientes e historial reciente al conectar

### 👥 Grupos
- Info del grupo y participantes, grupos en común con un contacto
- Crear grupos, cambiar nombre, descripción y foto
- Agregar, quitar, promover y degradar participantes
- Ajustes: solo admins escriben, info bloqueada, aprobación de ingreso, mensajes temporales
- Link de invitación (ver / revocar), solicitudes de ingreso, salir del grupo
- Eventos del sistema (alguien entró, salió, cambió el asunto, etc.) en el chat

### 📢 Otros
- **Estados:** ver los de tus contactos y publicar los tuyos (texto, imagen, video)
- **Llamadas:** historial de llamadas (entrantes, perdidas, video, grupales)
- **Perfil propio:** nombre, info y foto
- Bloquear / desbloquear contactos y lista de bloqueados
- Mensajes destacados
- Almacenamiento por chat: ver el espacio de multimedia y limpiarlo
- Verificar si un número tiene WhatsApp

### 🖥️ Páginas del panel (`backend/public/`)

| Página | Función |
|---|---|
| `index.html` | Lista de chats |
| `chat.html` | Chat individual |
| `group.html` | Info y administración de grupo |
| `contact.html` | Info de contacto |
| `statuses.html` | Estados |
| `calls.html` | Llamadas |
| `communities.html` | Comunidades |
| `starred.html` | Mensajes destacados |
| `profile.html` / `settings.html` / `contacts-settings.html` | Perfil y ajustes |

---

## 🤖 Comandos del bot

Solo responden a los números en `owners`, con el prefijo configurado (por defecto `.`).

| Comando | Descripción |
|---|---|
| `.test` · `.t` · `.prueba` | Verifica que el sistema de plugins funciona |
| `.gg` · `.getcontacts` · `.contactos` | En un grupo: exporta los miembros (sin admins) a un `.vcf` y te lo envía por privado. Solo números de Uruguay (+598) y excluye a los miembros de un grupo fijo definido en el plugin |

**Plugins automáticos** (sin comando, corren con cada mensaje):
- `antiviewonce.js` — descarga el contenido "ver una vez" y lo manda al panel

### Crear un plugin

Crea un `.js` en `bot/plugins/`:

```js
export async function run({ conn, m, args, remoteJid, isGroup, sender, config }) {
  await conn.sendMessage(remoteJid, { text: 'Hola' }, { quoted: m })
}
export const command = ['hola']   // array vacío = plugin automático
```

---

## 🌐 API REST

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/chats` · `/chat/:id` | Chats y mensajes |
| GET | `/status` | Estado del servidor y del bot |
| GET | `/statuses` · `/calls` | Estados y llamadas |
| POST | `/message` | Mensaje entrante desde el bot |
| POST | `/chat/:id/clear` | Vaciar un chat |
| POST | `/group/:id/action` | Acciones de administración de grupo |
| GET | `/api/group/:id` · `/api/common/:id` | Info de grupo / grupos en común |
| GET/POST | `/api/me` | Perfil propio |
| POST | `/api/status` | Publicar un estado |
| POST | `/api/block` · GET `/api/blocklist` | Bloqueos |
| GET | `/api/preview?url=` | Vista previa de enlaces |
| GET/POST | `/api/storage/:id` · `/api/storage/:id/purge` | Uso y limpieza de multimedia |

Hay más rutas internas que usa el bot (`/reaction`, `/msg-status`, `/msg-edit`, `/presence`, `/call`, `/status-update`, `/api/system-event`).

### Eventos Socket.io

- **Cliente → servidor:** `join_chat`, `send_message`, `react`, `edit_message`, `delete_message`, `pin_message`, `send_poll`, `send_location`, `send_contact`, `typing`, `subscribe_presence`
- **Servidor → cliente:** `receive_message`, `chat_updated`, `message_updated`, `message_revoked`, `message_removed`, `new_status`, `call_update`, `calls_deleted`, `presence`

---

## 💾 Datos

Todo se guarda en `backend/data/` (ignorado por git):

- `chat.db` — SQLite con chats y mensajes
- `media/` — imágenes, videos, audios y documentos (se sirven en `/media`)
- `calls.json` — historial de llamadas
- `pass.txt` — contraseña del panel

Si vienes de la versión antigua con `chats.json`, puedes migrarla:

```bash
node backend/migrate.js
```

---

## 🔒 Seguridad

- **Nunca subas** `sesion/`, `secrets.jsonl`, `backend/data/` ni `.env` (ya están en `.gitignore`). La carpeta `sesion/` da acceso total a tu cuenta de WhatsApp.
- Define siempre `backend/data/pass.txt` si el panel es accesible desde fuera de tu equipo.
- Socket.io acepta cualquier origen (`cors: *`); la protección real es la contraseña del panel.

---

## 🔮 Ideas a futuro

- Variables de entorno en lugar de `bot/config.js` (número, owners, puerto)
- Puerto configurable (hoy está fijo en 3000)
- Grupo de exclusión de `.gg` configurable por comando o config
- Ocultar los mensajes de diagnóstico del bot cuando termine la depuración
- Tests automáticos

---

## ⚠️ Aviso

Este proyecto usa una librería **no oficial** de WhatsApp Web. Úsalo bajo tu propio riesgo: WhatsApp puede limitar o bloquear cuentas que usen clientes no oficiales.
