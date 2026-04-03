import fs from 'fs';
export async function logToFile(msg: string) {
  fs.appendFileSync('debug.log', msg + '\n');
}
