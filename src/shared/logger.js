import fs from 'fs';
import path from 'path';

export function logToFile(message) {
  const defaultPath = path.resolve(process.cwd(), 'logs', 'messages.log');
  const logFile = process.env.LOG_FILE_PATH || defaultPath;
  const dir = path.dirname(logFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.appendFileSync(logFile, message + '\n');
}