import { SQSClient, SendMessageBatchCommand, SendMessageCommand } from '@aws-sdk/client-sqs';
import dotenv from 'dotenv';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const client = new SQSClient({ region: process.env.REGION || 'us-east-1' });

export async function sendToQueue(queueUrl, payload) {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  await client.send(new SendMessageCommand({ QueueUrl: queueUrl, MessageBody: body }));
}

export async function sendBatch(queueUrl, items) {
  // items: array of payloads; we create up to 10 entries per batch (SQS limit)
  const chunks = [];
  for (let i = 0; i < items.length; i += 10) {
    chunks.push(items.slice(i, i + 10));
  }

  for (const chunk of chunks) {
    const Entries = chunk.map((payload, idx) => ({
      Id: `msg-${Date.now()}-${idx}`,
      MessageBody: typeof payload === 'string' ? payload : JSON.stringify(payload)
    }));
    await client.send(new SendMessageBatchCommand({ QueueUrl: queueUrl, Entries }));
  }
}