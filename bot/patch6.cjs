const fs = require('fs');
const file = 'index.js';
let src = fs.readFileSync(file, 'utf8');

const oldStr = `const logger  = pino({ level: 'silent', stream: { write: () => {} } });`;
const newStr = `const logger  = pino({ level: 'warn' }); // TEMPORAL: para diagnosticar el viewOnce, luego volver a 'silent'`;

if (!src.includes(oldStr)) {
  console.error('❌ No encontré la línea del logger.');
  process.exit(1);
}
src = src.replace(oldStr, newStr);
fs.writeFileSync(file, src);
console.log('✅ Logger puesto en modo "warn" temporalmente.');
