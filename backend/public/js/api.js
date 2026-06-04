const API = {
  async getChats() {
    const res = await fetch('/chats')
    return res.json()
  },
  async getChat(chatId) {
    const res = await fetch('/chat/' + encodeURIComponent(chatId))
    return res.json()
  },
  async getStatus() {
    const res = await fetch('/status')
    return res.json()
  }
}
