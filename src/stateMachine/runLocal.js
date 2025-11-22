import dotenv from 'dotenv';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { handler as checkAttendance } from '../functions/checkAttendance/index.js';
import { handler as reminderHandler } from '../functions/reminderHandler/index.js';
import { handler as sendMessage } from '../functions/sendMessage/index.js';
import { handler as ingestFromS3 } from '../functions/ingestFromS3/index.js';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function readJson(filePath) {
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

async function main() {
  try {
    const argPath = process.argv[2];
    const inputPath = argPath
      ? path.isAbsolute(argPath)
        ? argPath
        : path.resolve(process.cwd(), argPath)
      : path.resolve(__dirname, 'input.sample.json');

    const input = await readJson(inputPath);

    if (process.env.INPUT_BUCKET_NAME && process.env.USERS_TABLE_NAME) {
      const ingest = await ingestFromS3();
      console.log('[debug] IngestFromS3:', JSON.stringify(ingest, null, 2));
    }

    const check = await checkAttendance(input);
    console.log('[debug] CheckAttendance:', JSON.stringify({ count: check?.meta?.count ?? (check?.learners?.length ?? 0), activityStatus: check?.meta?.activityStatus, daysThreshold: check?.meta?.daysThreshold }, null, 2));
    const compose = await reminderHandler({ learners: check.learners, meta: check.meta });
    console.log('[debug] ComposeMessages:', JSON.stringify({ requested: compose?.messages?.length ?? 0, activityStatus: compose?.meta?.activityStatus, daysThreshold: compose?.meta?.daysThreshold }, null, 2));

    const results = [];
    for (const msg of compose.messages) {
      const res = await sendMessage(msg);
      results.push({ email: msg.email, ...res });
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;

    const summary = {
      requested: compose.messages.length,
      sent: successCount,
      failed: failCount,
      details: results
    };

    console.log(JSON.stringify(summary, null, 2));
  } catch (err) {
    console.error('Workflow failed:', err.message);
    process.exit(1);
  }
}

main();
