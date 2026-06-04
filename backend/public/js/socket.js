const socket = io()

const SocketManager = {
  joinChat(chatId) {
    socket.emit('join_chat', chatId)
  },
  sendMessage(payload) {
    socket.emit('send_message', payload)
  },
  onChatUpdated(cb) {
    socket.on('chat_updated', cb)
  },
  onReceiveMessage(cb) {
    socket.on('receive_message', cb)
  }
}
