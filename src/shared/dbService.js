import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const learnersPath = path.resolve(__dirname, 'learners.json');

export async function getLearners() {
  const data = await fs.readFile(learnersPath, 'utf-8');
  return JSON.parse(data);
}