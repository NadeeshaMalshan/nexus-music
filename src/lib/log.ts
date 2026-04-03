import fs from 'fs';
export async function logToFile(msg) {
  fs.appendFileSync('debug.log', msg + '\n');
}
