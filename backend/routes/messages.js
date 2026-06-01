module.exports = function(message) {
  if (!global.io) return

  global.io.emit("new_message", message)
}
