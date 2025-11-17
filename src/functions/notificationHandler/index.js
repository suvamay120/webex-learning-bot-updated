import dotenv from 'dotenv';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { sendWebexMessage } from '../../shared/webexService.js';
import { logToFile } from '../../shared/logger.js';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const secretsClient = new SecretsManagerClient({
  region: process.env.REGION || 'us-east-1'
});

async function getBotToken() {
  if (process.env.NODE_ENV !== 'production') {
    return process.env.WEBEX_BOT_TOKEN;
  }
  const secretName = process.env.WEBEX_BOT_TOKEN_SECRET_NAME || 'WebexBotToken';
  const data = await secretsClient.send(new GetSecretValueCommand({ SecretId: secretName }));
  if ('SecretString' in data) return data.SecretString;
  throw new Error('Secret is not a string');
}

function getApiUrl() {
  // Support both the existing typo and the corrected variable name
  return (
    process.env.WEBEX_MESSGING_API_URL ||
    process.env.WEBEX_MESSAGING_API_URL ||
    'https://webexapis.com/v1/messages'
  );
}

export const handler = async (event = {}) => {
  const failures = [];
  const records = Array.isArray(event?.Records) ? event.Records : [];
  console.log(`[sqs] batch received: count=${records.length}`);

  const token = await getBotToken();
  const apiUrl = getApiUrl();

  // Process records sequentially to respect downstream rate-limits
  for (const r of records) {
    const messageId = r.messageId;
    try {
      const body = JSON.parse(r.body);
      const { email, text } = body;
      if (!email || !text) throw new Error('Missing email or text');

      const result = await sendWebexMessage(email, text, token, apiUrl);
      const logMsg = `[${new Date().toISOString()}] SQS processed for ${email} | id=${result.id}`;
      logToFile(logMsg);
      console.log(logMsg);
    } catch (err) {
      const logMsg = `[${new Date().toISOString()}] SQS failed for messageId=${messageId} | error=${err.message}`;
      logToFile(logMsg);
      console.error(logMsg);
      failures.push({ itemIdentifier: messageId });
    }
  }

  // Partial batch response: failed items will be retried by Lambda/SQS
  const successCount = records.length - failures.length;
  console.log(`[sqs] batch summary: success=${successCount} failed=${failures.length}`);
  return { batchItemFailures: failures };
};