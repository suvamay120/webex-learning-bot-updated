import dotenv from 'dotenv';
import { RuleModel } from '../../shared/dynamooseModels.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const handler = async () => {
  try {
    if (!process.env.RULES_TABLE_NAME) {
      return { inserted: 0 };
    }
    const seedPath = path.resolve(__dirname, '../../shared/rules.seed.json');
    const content = await fs.readFile(seedPath, 'utf-8');
    const payload = JSON.parse(content);
    await RuleModel.create(payload, { overwrite: true });
    return { inserted: 1 };
  } catch (err) {
    return { error: err.message };
  }
};

