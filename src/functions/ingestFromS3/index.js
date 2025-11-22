import dotenv from 'dotenv';
import { UserModel } from '../../shared/dynamooseModels.js';
import crypto from 'crypto';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

async function readS3Object(bucket, key) {
  const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
  const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const chunks = [];
  for await (const chunk of res.Body) {
    chunks.push(Buffer.from(chunk));
  }
  const body = Buffer.concat(chunks).toString('utf-8');
  return JSON.parse(body);
}

export const handler = async () => {
  try {
    const bucket = process.env.INPUT_BUCKET_NAME;
    const key = process.env.INPUT_OBJECT_KEY || 'input/users.json';
    const table = process.env.USERS_TABLE_NAME;
    if (!bucket || !table) {
      return { upserted: 0, skipped: 0 };
    }
    const data = await readS3Object(bucket, key);
    let upserted = 0;
    let skipped = 0;
    for (const u of Array.isArray(data) ? data : []) {
      const item = {
        userId: u.id || crypto.randomUUID(),
        email: u.email,
        fullName: u.fullName,
        courseName: u.courseName,
        startDate: u.startDate,
        endDate: u.endDate,
        activityStatus: u.activityStatus || 'moderately_active',
        attendedClasses: u.attendedClasses ?? 0,
        lastClassDate: u.lastClassDate || null,
        upcomingNextClassDate: u.upcomingNextClassDate || null,
        notificationState: u.notificationState || 'pending',
        updatedAt: new Date().toISOString()
      };
      try {
        await UserModel.create(item, { overwrite: true });
        upserted++;
      } catch {
        skipped++;
      }
    }
    return { upserted, skipped };
  } catch (err) {
    return { error: err.message };
  }
};
