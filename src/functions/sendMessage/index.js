import dotenv from 'dotenv';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { sendWebexMessage } from '../../shared/webexService.js';
import { WEBEX_API_URL } from '../../config/webexConfig.js';
import { logToFile } from '../../shared/logger.js';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const secretsClient = new SecretsManagerClient({
  region: process.env.AWS_REGION || 'us-east-1'
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

export const handler = async (event = {}) => {
  try {
    const { email, text } = event;
    if (!email || !text) {
      throw new Error('Missing required fields: email or text');
    }

    const token = await getBotToken();
    if (!token) throw new Error('WEBEX_BOT_TOKEN not available');

    const result = await sendWebexMessage(email, text, token, WEBEX_API_URL);
    const logMsg = `[${new Date().toISOString()}] Sent to ${email} | id=${result.id}`;
    logToFile(logMsg);

    return { success: true, messageId: result.id, email };
  } catch (err) {
    const logMsg = `[${new Date().toISOString()}] Failed for ${event?.email || 'unknown'} | error=${err.message}`;
    logToFile(logMsg);
    return { success: false, error: err.message, email: event?.email || null };
  }
};