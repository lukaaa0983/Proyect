# 📡 Proyecto G Chat — Chat en tiempo real tipo WhatsApp

Sistema de mensajería en tiempo real desarrollado con **Node.js, Express y Socket.io**, con persistencia en JSON y frontend web vanilla.

---

## 🚀 Tecnologías usadas

- Node.js
- Express
- Socket.io
- HTML5 / CSS3 / JavaScript (vanilla)
- File System (fs) para persistencia en JSON
- CORS

---

## 📦 Características principales

### 💬 Chat en tiempo real
- Mensajes instantáneos usando Socket.io
- Comunicación bidireccional entre clientes
- Broadcast de mensajes a todos los usuarios conectados

### 👥 Sistema de chats
- Chats separados por ID (`chatId`)
- Cada chat tiene su propio historial
- Navegación entre conversaciones

### 💾 Persistencia
- Guardado automático en `./data/chats.json`
- Recuperación de historial al abrir un chat
- Límite de mensajes por chat para evitar sobrecarga

### 🌐 API REST
- `GET /chats` → devuelve todos los chats
- `GET /chat/:id` → devuelve mensajes de un chat específico
- `POST /message` → guarda mensajes en el servidor

### ⚡ Socket events
- `send_message` → envía mensajes en tiempo real
- `receive_message` → recibe mensajes en frontend
- `new_message` → notificación de nuevos mensajes

---

## 🧠 Estructura del proyecto

/project
├── server.js
├── /public
│   ├── index.html (lista de chats)
│   └── chat.html (chat individual)
├── /data
│   └── chats.json
└── package.json

---

## 📊 Estructura de datos (mensajes)

{
  "type": "text",
  "content": "Hola mundo",
  "senderName": "Usuario",
  "senderId": "12345",
  "timestamp": 1710000000000,
  "isGroup": false
}

### Tipos soportados:
- text → mensaje normal
- image → imagen (URL o base64)
- sticker → sticker (webp o imagen)

---

## ⚙️ Instalación

npm install

---

## ▶️ Ejecución

node server.js

Servidor corriendo en:

http://localhost:3000

---

## 🖥️ Frontend

### 📌 index.html
- Lista de chats
- Selección de conversación

### 💬 chat.html
- Vista del chat individual
- Render dinámico de mensajes
- Soporte para texto, imágenes y stickers

---

## 🎯 Objetivo del proyecto

Este proyecto busca ser una base de una:

> 💬 Aplicación de mensajería personalizada tipo WhatsApp

Con enfoque en:

- Comunicación en tiempo real
- Arquitectura simple pero escalable
- Sistema propio de chats
- Posible evolución a app móvil o desktop

---

## 🔮 Futuras mejoras

- 👤 Sistema de usuarios reales (login)
- 🟢 Estado online / typing...
- 📸 Subida de archivos real (no base64)
- 💾 Base de datos (MongoDB o PostgreSQL)
- 📱 Diseño mobile tipo WhatsApp
- 🔔 Notificaciones push
- 🧠 Sistema de bots o automatización 24/7

---

## ⚠️ Notas del proyecto

- Actualmente usa JSON como base de datos (no recomendado para producción)
- Socket.io se usa para comunicación en tiempo real
- Proyecto en fase de desarrollo / prototipo funcional

---

## 🧑‍💻 Autor

Proyecto desarrollado como base de aprendizaje y creación de sistema tipo chat personalizado con Node.js.
