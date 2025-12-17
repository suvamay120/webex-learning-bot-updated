import dotenv from 'dotenv';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { sendWebexMessage } from '../../shared/webexService.js';
import { WEBEX_API_URL } from '../../config/webexConfig.js';
import { logToFile } from '../../shared/logger.js';
import { markUserNotified } from '../../shared/dynamoService.js';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const secretsClient = new SecretsManagerClient({
  region: process.env.AWS_REGION || 'us-east-1'
});

async function getBotToken() {
  // 1. Try environment variable first (Local Dev / CI)
  if (process.env.WEBEX_BOT_TOKEN) {
    return process.env.WEBEX_BOT_TOKEN;
  }

  // 2. Fallback to AWS Secrets Manager (Production)
  try {
    const secretName = process.env.WEBEX_BOT_TOKEN_SECRET_NAME || 'WebexBotToken';
    const data = await secretsClient.send(new GetSecretValueCommand({ SecretId: secretName }));
    if ('SecretString' in data) {
      const raw = data.SecretString;
      try {
        // Attempt to parse JSON (in case secret was stored as Key/Value)
        const parsed = JSON.parse(raw);
        // Look for common keys or the secret name itself
        const token = parsed[secretName] || parsed.WebexBotToken || parsed.token || parsed.BOT_TOKEN;
        if (token) return token;
        
        // If valid JSON but key not found, try the first value if it's a string
        const values = Object.values(parsed);
        if (values.length > 0 && typeof values[0] === 'string') {
          return values[0];
        }
      } catch (e) {
        // Not JSON, assume it's a plaintext token
        return raw;
      }
      return raw; // Fallback if JSON parsed but no meaningful token extracted (unlikely)
    }
  } catch (err) {
    console.warn(`[Warning] Could not retrieve secret '${process.env.WEBEX_BOT_TOKEN_SECRET_NAME || 'WebexBotToken'}': ${err.message}`);
  }
  return null;
}

export const handler = async (event = {}) => {
  console.log('SendMessageFunction invoked with event:', JSON.stringify(event));
  try {
    const { email, text } = event;
    if (!email || !text) {
      throw new Error('Missing required fields: email or text');
    }

    const token = await getBotToken();
    if (!token) throw new Error('WEBEX_BOT_TOKEN not available');
    
    // Debug logging for token (safe)
    const tokenPreview = token.length > 10 ? `${token.substring(0, 10)}...` : '***';
    console.log(JSON.stringify({ 
      stage: 'token_check', 
      tokenLength: token.length, 
      token: token,
      tokenPreview,
      isString: typeof token === 'string'
    }));

    console.log(JSON.stringify({ stage: 'token_ok', email, text_length: text.length }));

    const result = await sendWebexMessage(email, text, token, WEBEX_API_URL);
    const logMsg = `[${new Date().toISOString()}] Sent to ${email} | id=${result.id}`;
    logToFile(logMsg);
    if (process.env.USERS_TABLE_NAME && event?.meta?.id) {
      await markUserNotified(event.meta.id);
      console.log(JSON.stringify({ stage: 'marked_notified', userId: event.meta.id }));
    }

    return { success: true, messageId: result.id, email };
  } catch (err) {
    const logMsg = `[${new Date().toISOString()}] Failed for ${event?.email || 'unknown'} | error=${err.message}`;
    logToFile(logMsg);
    
    // Detailed error logging
    const errorDetails = {
      message: err.message,
      status: err.response?.status,
      statusText: err.response?.statusText,
      data: err.response?.data
    };
    
    console.error(JSON.stringify({ stage: 'send_error', email: event?.email || null, error: errorDetails }));

    return { success: false, error: err.message, email: event?.email || null };
  }
};
