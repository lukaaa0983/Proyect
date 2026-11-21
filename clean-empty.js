import * as db from "./backend/db.js"
const yes = process.argv.includes("--yes")
const n = db.purgeEmpty(!yes)
console.log(yes ? "Mensajes vacíos borrados: " + n : "Mensajes vacíos encontrados: " + n + " (para borrarlos: node clean-empty.js --yes)")
