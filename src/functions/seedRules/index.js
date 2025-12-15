import dotenv from 'dotenv';
import { RuleModel, CourseModel } from '../../shared/dynamooseModels.js';
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
    let rulesInserted = 0;
    let coursesInserted = 0;

    if (process.env.RULES_TABLE_NAME) {
      const rulesSeedPath = path.resolve(__dirname, '../../shared/rules.seed.json');
      const rulesContent = await fs.readFile(rulesSeedPath, 'utf-8');
      const rulesPayload = JSON.parse(rulesContent);
      if (Array.isArray(rulesPayload)) {
        for (const r of rulesPayload) {
          await RuleModel.create(r, { overwrite: true });
          rulesInserted++;
        }
      } else {
        await RuleModel.create(rulesPayload, { overwrite: true });
        rulesInserted++;
      }
    }

    if (process.env.COURSES_TABLE_NAME) {
      const coursesSeedPath = path.resolve(__dirname, '../../shared/courses.seed.json');
      const coursesContent = await fs.readFile(coursesSeedPath, 'utf-8');
      const coursesPayload = JSON.parse(coursesContent);
      if (Array.isArray(coursesPayload)) {
        for (const c of coursesPayload) {
          await CourseModel.create(c, { overwrite: true });
          coursesInserted++;
        }
      }
    }

    console.log(JSON.stringify({ stage: 'seed_done', rulesInserted, coursesInserted }));
    return { rulesInserted, coursesInserted };
  } catch (err) {
    console.error(JSON.stringify({ stage: 'seed_error', error: err.message }));
    return { error: err.message };
  }
};
