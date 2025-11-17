import dotenv from 'dotenv';
import { sendBatch } from '../../shared/sqsService.js';
import { logToFile } from '../../shared/logger.js';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

export const handler = async (event = {}) => {
  const queueUrl = process.env.NOTIFICATION_QUEUE_URL;
  if (!queueUrl) {
    throw new Error('NOTIFICATION_QUEUE_URL env var is not set');
  }

  const messages = Array.isArray(event?.messages) ? event.messages : [];
  if (messages.length === 0) {
    return { enqueued: 0 };
  }

  await sendBatch(queueUrl, messages);

  const logMsg = `[${new Date().toISOString()}] Enqueued ${messages.length} messages to SQS`;
  logToFile(logMsg);
  console.log(logMsg);

  return { enqueued: messages.length };
};