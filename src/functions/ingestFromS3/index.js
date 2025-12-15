import dotenv from 'dotenv';
import { UserModel, CourseModel } from '../../shared/dynamooseModels.js';
import crypto from 'crypto';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

async function readS3Object(bucket, key) {
  const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
  const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
  console.log(JSON.stringify({ stage: 'read_s3_start', bucket, key }));
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const chunks = [];
  for await (const chunk of res.Body) {
    chunks.push(Buffer.from(chunk));
  }
  const body = Buffer.concat(chunks).toString('utf-8');
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch (e) {
    console.error(JSON.stringify({ stage: 'read_s3_parse_error', error: e.message }));
    throw e;
  }
  console.log(JSON.stringify({ stage: 'read_s3_done', type: Array.isArray(parsed) ? 'array' : typeof parsed, count: Array.isArray(parsed) ? parsed.length : undefined }));
  return parsed;
}

export const handler = async () => {
  try {
    const bucket = process.env.INPUT_BUCKET_NAME;
    const key = process.env.INPUT_OBJECT_KEY || 'input/users.json';
    const table = process.env.USERS_TABLE_NAME;
    console.log(JSON.stringify({ stage: 'env_check', bucket_set: !!bucket, key, table_set: !!table }));
    if (!bucket || !table) {
      console.log(JSON.stringify({ stage: 'env_missing', bucket, table }));
      return { upserted: 0, skipped: 0 };
    }
    const data = await readS3Object(bucket, key);
    if (!Array.isArray(data) || data.length === 0) {
      console.log(JSON.stringify({ stage: 'no_data', reason: Array.isArray(data) ? 'empty_array' : 'not_array' }));
      return { upserted: 0, skipped: 0 };
    }
    const courses = await (async () => {
      try {
        if (process.env.COURSES_TABLE_NAME) {
          const items = await CourseModel.scan().exec();
          return items || [];
        }
        return [];
      } catch {
        return [];
      }
    })();
    const courseByName = new Map((courses || []).map(c => [c.name, c.courseId]));
    console.log(JSON.stringify({ stage: 'courses_loaded', count: courses.length }));
    let upserted = 0;
    let skipped = 0;
    for (const u of Array.isArray(data) ? data : []) {
      const item = {
        userId: u.id || crypto.randomUUID(),
        email: u.email,
        fullName: u.fullName,
        joiningDate: u.joiningDate || null,
        enrolledCourseIds: Array.isArray(u.enrolledCourseIds)
          ? u.enrolledCourseIds
          : Array.isArray(u.enrolledCourses)
            ? u.enrolledCourses.map(n => courseByName.get(n)).filter(Boolean)
            : (u.courseName ? [courseByName.get(u.courseName)].filter(Boolean) : []),
        attendedCourseIds: Array.isArray(u.attendedCourseIds)
          ? u.attendedCourseIds
          : Array.isArray(u.attendedCourses)
            ? u.attendedCourses.map(n => courseByName.get(n)).filter(Boolean)
            : [],
        notificationState: u.notificationState || 'pending',
        updatedAt: new Date().toISOString()
      };
      try {
        await UserModel.create(item, { overwrite: true });
        upserted++;
        if (upserted % 25 === 0) {
          console.log(JSON.stringify({ stage: 'progress', upserted }));
        }
      } catch (e) {
        skipped++;
        console.error(JSON.stringify({ stage: 'create_error', error: e?.message || 'unknown', userId: item.userId }));
      }
    }
    const summary = { upserted, skipped };
    console.log(JSON.stringify({ stage: 'ingest_done', summary }));
    return summary;
  } catch (err) {
    console.error(JSON.stringify({ stage: 'ingest_error', error: err.message }));
    return { error: err.message };
  }
};
